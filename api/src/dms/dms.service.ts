import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { clamp } from '../common/cursor-page';
import { Database } from '../db/database';
import { PushService } from '../notifications/push.service';

/**
 * 1:1 쪽지. 두 사람 사이에 대화방 하나 (dm_threads, user_a < user_b).
 *  - 받는 사람이 정한 범위: 모두(all) · 내가 팔로우한 사람(following) · 받지 않기(none)
 *  - 둘 중 누구라도 차단했으면 보낼 수 없다. 1분에 20개까지 (도배 막기)
 *  - 대화방 나가기: 내 쪽에서만 그때까지의 쪽지를 지운다 (상대는 그대로). 새 쪽지가 오면 다시 보인다
 */
export type DmPolicy = 'all' | 'following' | 'none';
export const DM_POLICIES: DmPolicy[] = ['all', 'following', 'none'];
const MAX_LENGTH = 1000;
const RATE_PER_MINUTE = 20;
const PAGE = 30;
const UID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Peer {
  id: number;
  uid: string;
  nickname: string;
  avatarUrl: string | null;
  policy: DmPolicy;
}

export interface DmMessage {
  id: number;
  mine: boolean;
  content: string;
  read: boolean;
  createdAt: Date;
}

@Injectable()
export class DmsService {
  constructor(
    private readonly db: Database,
    private readonly push: PushService,
  ) {}

  private async peer(uid: string): Promise<Peer> {
    const row = UID.test(uid)
      ? await this.db.one<Peer>(
          `SELECT id, uid::text AS uid, nickname, dm_policy AS policy,
                  CASE WHEN avatar_id IS NULL THEN NULL ELSE '/api/images/' || avatar_id END AS "avatarUrl"
           FROM users WHERE uid::text = $1 AND withdrawn_at IS NULL`,
          [uid.toLowerCase()],
        )
      : undefined;
    if (!row) throw ApiError.notFound('없는 사용자예요');
    return row;
  }

  /** 이 사람에게 쪽지를 보낼 수 있는지 (안 되면 이유) */
  async canSend(senderId: number, peer: Pick<Peer, 'id' | 'policy'>): Promise<string | undefined> {
    if (peer.id === senderId) return '나에게는 쪽지를 보낼 수 없어요';
    const blocked = await this.db.one('SELECT 1 FROM user_blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)', [
      senderId,
      peer.id,
    ]);
    if (blocked) return '쪽지를 보낼 수 없는 사용자예요';
    if (peer.policy === 'none') return '이 사용자는 쪽지를 받지 않아요';
    if (peer.policy === 'following' && !(await this.db.one('SELECT 1 FROM user_follows WHERE follower_id = $1 AND followee_id = $2', [peer.id, senderId]))) {
      return '이 사용자는 자기가 팔로우한 사람의 쪽지만 받아요';
    }
    return undefined;
  }

  /** 프로필에서: 쪽지 보내기 버튼을 보여 줄지 */
  async canMessage(senderId: number | undefined, userId: number) {
    if (senderId == null || senderId === userId) return false;
    const policy = await this.db.one<{ policy: DmPolicy }>('SELECT dm_policy AS policy FROM users WHERE id = $1', [userId]);
    return !(await this.canSend(senderId, { id: userId, policy: policy?.policy ?? 'all' }));
  }

  private async thread(a: number, b: number, create: boolean) {
    const [lo, hi] = a < b ? [a, b] : [b, a];
    if (create) {
      await this.db.execute('INSERT INTO dm_threads (user_a, user_b) VALUES ($1, $2) ON CONFLICT DO NOTHING', [lo, hi]);
    }
    const row = await this.db.one<{ id: number; userA: number; clearedA: Date | null; clearedB: Date | null }>(
      'SELECT id, user_a AS "userA", cleared_a AS "clearedA", cleared_b AS "clearedB" FROM dm_threads WHERE user_a = $1 AND user_b = $2',
      [lo, hi],
    );
    return (
      row && { id: row.id, cleared: (who: number) => (who === row.userA ? row.clearedA : row.clearedB), side: (who: number) => (who === row.userA ? 'a' : 'b') }
    );
  }

  async send(senderId: number, uid: string, raw: unknown) {
    const content = typeof raw === 'string' ? raw.trim() : '';
    if (!content) throw ApiError.badRequest('쪽지 내용을 적어 주세요');
    if (content.length > MAX_LENGTH) throw ApiError.badRequest(`쪽지는 ${MAX_LENGTH}자까지 쓸 수 있어요`);
    const peer = await this.peer(uid);
    const reason = await this.canSend(senderId, peer);
    if (reason) throw ApiError.forbidden(reason);
    const recent = await this.db.one<{ n: number }>(
      "SELECT count(*)::int AS n FROM dm_messages WHERE sender_id = $1 AND created_at > now() - interval '1 minute'",
      [senderId],
    );
    if ((recent?.n ?? 0) >= RATE_PER_MINUTE) throw new ApiError(429, '쪽지를 너무 빨리 보내고 있어요. 잠시 후 다시 보내 주세요');
    const message = await this.db.transaction(async () => {
      const t = (await this.thread(senderId, peer.id, true))!;
      const row = await this.db.one<{ id: number; createdAt: Date }>(
        'INSERT INTO dm_messages (thread_id, sender_id, content) VALUES ($1, $2, $3) RETURNING id, created_at AS "createdAt"',
        [t.id, senderId, content],
      );
      await this.db.execute('UPDATE dm_threads SET updated_at = now() WHERE id = $1', [t.id]);
      return row!;
    });
    const me = await this.db.one<{ nickname: string; uid: string }>('SELECT nickname, uid::text AS uid FROM users WHERE id = $1', [senderId]);
    void this.push
      .send([{ userId: peer.id, title: `${me?.nickname ?? '누군가'}님의 쪽지`, body: content.replace(/\s+/g, ' ').slice(0, 80), url: `/u/${me?.uid ?? ''}` }])
      .catch(() => undefined);
    return { id: message.id, mine: true, content, read: false, createdAt: message.createdAt } satisfies DmMessage;
  }

  /** 대화 목록: 상대 · 마지막 쪽지 · 안 읽은 수 (최근 대화부터) */
  async threads(userId: number) {
    const rows = await this.db.query<{
      uid: string;
      nickname: string;
      avatarUrl: string | null;
      last: string;
      lastMine: boolean;
      lastAt: Date;
      unread: number;
    }>(
      `SELECT u.uid::text AS uid, u.nickname, CASE WHEN u.avatar_id IS NULL THEN NULL ELSE '/api/images/' || u.avatar_id END AS "avatarUrl",
              m.content AS last, m.sender_id = $1 AS "lastMine", m.created_at AS "lastAt",
              (SELECT count(*)::int FROM dm_messages x WHERE x.thread_id = t.id AND x.sender_id <> $1 AND x.read_at IS NULL
                 AND x.created_at > coalesce(CASE WHEN t.user_a = $1 THEN t.cleared_a ELSE t.cleared_b END, '-infinity')) AS unread
       FROM dm_threads t
       JOIN users u ON u.id = CASE WHEN t.user_a = $1 THEN t.user_b ELSE t.user_a END
       JOIN LATERAL (
         SELECT content, sender_id, created_at FROM dm_messages x
         WHERE x.thread_id = t.id AND x.created_at > coalesce(CASE WHEN t.user_a = $1 THEN t.cleared_a ELSE t.cleared_b END, '-infinity')
         ORDER BY x.id DESC LIMIT 1
       ) m ON TRUE
       WHERE (t.user_a = $1 OR t.user_b = $1) AND u.withdrawn_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM user_blocks k WHERE k.blocker_id = $1 AND k.blocked_id = u.id)
       ORDER BY t.updated_at DESC LIMIT 100`,
      [userId],
    );
    return rows.map((r) => ({
      user: { id: r.uid, nickname: r.nickname, avatarUrl: r.avatarUrl ?? undefined },
      last: r.last.slice(0, 100),
      lastMine: r.lastMine,
      lastAt: r.lastAt,
      unread: r.unread,
    }));
  }

  /** 한 사람과의 쪽지 (최근 것부터 30개씩). 열면 받은 쪽지는 읽음 */
  async messages(userId: number, uid: string, before?: number) {
    const peer = await this.peer(uid);
    const t = await this.thread(userId, peer.id, false);
    const user = { id: peer.uid, nickname: peer.nickname, avatarUrl: peer.avatarUrl ?? undefined };
    const blockedReason = await this.canSend(userId, peer);
    if (!t) return { user, items: [] as DmMessage[], canSend: !blockedReason, reason: blockedReason };
    const cleared = t.cleared(userId);
    const rows = await this.db.query<{ id: number; senderId: number; content: string; readAt: Date | null; createdAt: Date }>(
      `SELECT id, sender_id AS "senderId", content, read_at AS "readAt", created_at AS "createdAt" FROM dm_messages
       WHERE thread_id = $1 AND ($2::int IS NULL OR id < $2) AND ($3::timestamptz IS NULL OR created_at > $3)
       ORDER BY id DESC LIMIT ${PAGE + 1}`,
      [t.id, before ?? null, cleared],
    );
    await this.db.execute('UPDATE dm_messages SET read_at = now() WHERE thread_id = $1 AND sender_id <> $2 AND read_at IS NULL', [t.id, userId]);
    const page = rows.slice(0, PAGE);
    return {
      user,
      items: page.map((r) => ({ id: r.id, mine: r.senderId === userId, content: r.content, read: !!r.readAt, createdAt: r.createdAt })),
      nextCursor: rows.length > PAGE ? page[page.length - 1].id : undefined,
      canSend: !blockedReason,
      reason: blockedReason,
    };
  }

  async unread(userId: number) {
    const row = await this.db.one<{ n: number }>(
      `SELECT count(*)::int AS n FROM dm_messages m JOIN dm_threads t ON t.id = m.thread_id
       WHERE (t.user_a = $1 OR t.user_b = $1) AND m.sender_id <> $1 AND m.read_at IS NULL
         AND m.created_at > coalesce(CASE WHEN t.user_a = $1 THEN t.cleared_a ELSE t.cleared_b END, '-infinity')
         AND NOT EXISTS (SELECT 1 FROM user_blocks k WHERE k.blocker_id = $1 AND k.blocked_id = m.sender_id)`,
      [userId],
    );
    return { count: clamp(row?.n ?? 0, 0, 999) };
  }

  /** 대화방 나가기: 내 쪽에서만 지금까지의 쪽지를 지운다 */
  async leave(userId: number, uid: string) {
    const peer = await this.peer(uid);
    const t = await this.thread(userId, peer.id, false);
    if (t) await this.db.execute(`UPDATE dm_threads SET cleared_${t.side(userId)} = now() WHERE id = $1`, [t.id]);
  }

  async policy(userId: number) {
    const row = await this.db.one<{ policy: DmPolicy }>('SELECT dm_policy AS policy FROM users WHERE id = $1', [userId]);
    return { policy: row?.policy ?? 'all' };
  }

  async setPolicy(userId: number, policy: unknown) {
    if (!DM_POLICIES.includes(policy as DmPolicy)) throw ApiError.badRequest('쪽지 받기 설정을 다시 골라 주세요');
    await this.db.execute('UPDATE users SET dm_policy = $2 WHERE id = $1', [userId, policy]);
    return { policy: policy as DmPolicy };
  }
}

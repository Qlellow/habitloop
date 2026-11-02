import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { BadgesService } from '../badges/badges.service';
import { Database } from '../db/database';

/**
 * 메시지 표류병.
 *  - 띄우기: 300자까지, 하루 3개. 병은 바다(drifting)를 떠다닌다
 *  - 줍기: 바다를 보러 오면(GET /bottles/inbox) 손에 든 병이 없을 때 하나를 건네준다 (하루 3개까지).
 *    내가 띄운 병 · 전에 받은 병 · 차단하거나 신고로 막은 사람의 병은 오지 않는다. 오래 떠다닌 병부터
 *  - 받은 사람: 답장하고 다시 띄우기 / 그냥 다시 띄우기 / 신고. 하루 동안 그대로 두면 저절로 바다로 돌아간다
 *  - 열 명을 거치면 해변에 닿아(ashore) 여정을 마친다. 신고가 두 번 모이면 건져 낸다(removed)
 *  - 서로 누군지 모른다 (띄운 사람에게도 답장한 사람은 '어느 바닷가의 누군가')
 * 따로 도는 작업 없이 누가 바다를 볼 때마다 정리한다
 */
export const BOTTLE_MAX_LENGTH = 300;
export const DAILY_THROWS = 3;
export const DAILY_CATCHES = 3;
export const MAX_HOPS = 10;
const HOLD_HOURS = 24;
const REPORTS_TO_REMOVE = 2;
const TODAY = "(now() AT TIME ZONE 'Asia/Seoul')::date";

export type BottleStatus = 'drifting' | 'held' | 'ashore' | 'removed';
export type HopAction = 'reply' | 'release' | 'timeout' | 'report';

export interface HeldBottle {
  id: number;
  content: string;
  /** 나는 이 병을 주운 몇 번째 사람인지 */
  hops: number;
  createdAt: Date;
  heldAt: Date;
  /** 그대로 두면 이때 바다로 돌아간다 */
  releaseAt: Date;
}

export interface MyBottle {
  id: number;
  content: string;
  status: BottleStatus;
  hops: number;
  createdAt: Date;
  /** 거쳐 간 사람들이 한 일 (누군지는 없이) */
  journey: { at: Date; action: HopAction | null }[];
  replies: { id: number; content: string; createdAt: Date; read: boolean; letters: Letter[] }[];
}

/** 답장 뒤에 이어 주고받는 편지 (병 주인 ↔ 답장한 사람, 서로 누군지는 여전히 모른다) */
export interface Letter {
  id: number;
  mine: boolean;
  content: string;
  createdAt: Date;
}

/** 내가 답장한 병: 원래 병 · 내 답장 · 이어진 편지 */
export interface Conversation {
  replyId: number;
  bottle: { content: string; createdAt: Date };
  reply: { content: string; createdAt: Date };
  letters: Letter[];
  unread: number;
}

/** 답장 하나에 이어 주고받을 수 있는 편지 수 */
export const MAX_LETTERS = 30;

export interface Sea {
  /** 지금 손에 든 병 (없으면 비어 있다) */
  held?: HeldBottle;
  /** 오늘 더 띄울 수 있는 수 · 더 주울 수 있는 수 */
  throwsLeft: number;
  catchesLeft: number;
  /** 지금 바다를 떠다니는 병 수 (나를 뺀 모두의) */
  drifting: number;
  /** 내 병에 새로 온 답장 · 편지 수 */
  unreadReplies: number;
  /** 내가 답장한 병의 주인이 새로 보낸 편지 수 */
  unreadLetters: number;
}

@Injectable()
export class BottlesService {
  constructor(
    private readonly db: Database,
    private readonly badges: BadgesService,
  ) {}

  /** 하루 넘게 손에 든 병은 바다로 돌려보낸다 */
  private async sweep() {
    await this.db.transaction(async () => {
      await this.db.execute(
        `UPDATE bottle_hops h SET action = 'timeout', acted_at = now()
         FROM bottles b
         WHERE b.id = h.bottle_id AND h.user_id = b.holder_id AND h.action IS NULL
           AND b.status = 'held' AND b.held_at < now() - interval '${HOLD_HOURS} hours'`,
      );
      await this.db.execute(
        `UPDATE bottles SET status = 'drifting', holder_id = NULL, held_at = NULL, moved_at = now()
         WHERE status = 'held' AND held_at < now() - interval '${HOLD_HOURS} hours'`,
      );
    });
  }

  private async todayCount(sql: string, userId: number) {
    return Number((await this.db.one<{ n: string }>(sql, [userId]))?.n ?? 0);
  }

  /** 바다 보기: 손에 든 병이 없으면 하나 건네준다 */
  async sea(userId: number): Promise<Sea> {
    await this.sweep();
    let held = await this.held(userId);
    let catches = await this.todayCount(
      `SELECT count(*) AS n FROM bottle_hops WHERE user_id = $1 AND (received_at AT TIME ZONE 'Asia/Seoul')::date = ${TODAY}`,
      userId,
    );
    if (!held && catches < DAILY_CATCHES) {
      held = await this.catchOne(userId);
      if (held) catches++;
    }
    const [throws, drifting, unread, letters, toAuthor] = await Promise.all([
      this.todayCount(`SELECT count(*) AS n FROM bottles WHERE author_id = $1 AND (created_at AT TIME ZONE 'Asia/Seoul')::date = ${TODAY}`, userId),
      this.todayCount(`SELECT count(*) AS n FROM bottles WHERE status = 'drifting' AND author_id <> $1`, userId),
      this.todayCount(
        `SELECT count(*) AS n FROM bottle_replies r JOIN bottles b ON b.id = r.bottle_id WHERE b.author_id = $1 AND r.read_at IS NULL`,
        userId,
      ),
      this.todayCount(
        `SELECT count(*) AS n FROM bottle_letters l JOIN bottle_replies r ON r.id = l.reply_id WHERE r.author_id = $1 AND l.from_author AND l.read_at IS NULL`,
        userId,
      ),
      this.todayCount(
        `SELECT count(*) AS n FROM bottle_letters l JOIN bottle_replies r ON r.id = l.reply_id JOIN bottles b ON b.id = r.bottle_id
         WHERE b.author_id = $1 AND NOT l.from_author AND l.read_at IS NULL`,
        userId,
      ),
    ]);
    return {
      held,
      throwsLeft: Math.max(0, DAILY_THROWS - throws),
      catchesLeft: Math.max(0, DAILY_CATCHES - catches),
      drifting,
      unreadReplies: unread + toAuthor,
      unreadLetters: letters,
    };
  }

  private async held(userId: number): Promise<HeldBottle | undefined> {
    const row = await this.db.one<{ id: number; content: string; hops: number; createdAt: Date; heldAt: Date }>(
      `SELECT id, content, hops, created_at AS "createdAt", held_at AS "heldAt" FROM bottles WHERE status = 'held' AND holder_id = $1 LIMIT 1`,
      [userId],
    );
    return row ? { ...row, releaseAt: new Date(new Date(row.heldAt).getTime() + HOLD_HOURS * 3600_000) } : undefined;
  }

  /** 떠다니는 병 하나 줍기: 오래 떠다닌 것부터 (위쪽 몇 개 중 무작위) */
  private async catchOne(userId: number): Promise<HeldBottle | undefined> {
    return this.db.transaction(async () => {
      const pick = await this.db.one<{ id: number }>(
        `SELECT id FROM (
           SELECT b.id FROM bottles b
           WHERE b.status = 'drifting' AND b.author_id <> $1
             AND NOT EXISTS (SELECT 1 FROM bottle_hops h WHERE h.bottle_id = b.id AND h.user_id = $1)
             AND NOT EXISTS (SELECT 1 FROM bottle_mutes m WHERE m.user_id = $1 AND m.author_id = b.author_id)
             AND NOT EXISTS (SELECT 1 FROM user_blocks k WHERE (k.blocker_id = $1 AND k.blocked_id = b.author_id) OR (k.blocker_id = b.author_id AND k.blocked_id = $1))
           ORDER BY b.moved_at LIMIT 5
         ) c ORDER BY random() LIMIT 1`,
        [userId],
      );
      if (!pick) return undefined;
      // 동시에 두 사람이 같은 병을 집지 않게 상태를 확인하며 바꾼다
      const taken = await this.db.execute(
        `UPDATE bottles SET status = 'held', holder_id = $2, held_at = now(), hops = hops + 1, moved_at = now()
         WHERE id = $1 AND status = 'drifting'`,
        [pick.id, userId],
      );
      if (!taken) return undefined;
      await this.db.execute('INSERT INTO bottle_hops (bottle_id, user_id) VALUES ($1, $2)', [pick.id, userId]);
      return this.held(userId);
    });
  }

  async throw(userId: number, raw: string) {
    const content = (raw ?? '').trim();
    if (content.length < 5) throw ApiError.badRequest('병에 담을 말을 5자 넘게 적어 주세요');
    if (content.length > BOTTLE_MAX_LENGTH) throw ApiError.badRequest(`병에는 ${BOTTLE_MAX_LENGTH}자까지 담을 수 있어요`);
    const today = await this.todayCount(
      `SELECT count(*) AS n FROM bottles WHERE author_id = $1 AND (created_at AT TIME ZONE 'Asia/Seoul')::date = ${TODAY}`,
      userId,
    );
    if (today >= DAILY_THROWS) throw ApiError.tooMany(`병은 하루에 ${DAILY_THROWS}개까지 띄울 수 있어요`);
    const row = await this.db.one<{ id: number }>('INSERT INTO bottles (author_id, content) VALUES ($1, $2) RETURNING id', [userId, content]);
    await this.badges.checkQuietly(userId);
    return { id: row!.id };
  }

  /** 손에 든 병을 놓는다: 다시 바다로 (열 번째 사람이면 해변으로), 신고면 그 사람의 병을 더 받지 않는다 */
  /** 띄운 사람 id 를 돌려준다 (해변에 닿았으면 배지를 확인한다) */
  private async letGo(userId: number, bottleId: number, action: HopAction): Promise<number> {
    const bottle = await this.db.one<{ authorId: number; hops: number }>(
      `SELECT author_id AS "authorId", hops FROM bottles WHERE id = $1 AND status = 'held' AND holder_id = $2`,
      [bottleId, userId],
    );
    if (!bottle) throw ApiError.notFound('지금 들고 있는 병이 아니에요');
    await this.db.execute('UPDATE bottle_hops SET action = $3, acted_at = now() WHERE bottle_id = $1 AND user_id = $2', [bottleId, userId, action]);
    if (action === 'report') {
      await this.db.execute('INSERT INTO bottle_mutes (user_id, author_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, bottle.authorId]);
      await this.db.execute('UPDATE bottles SET reports = reports + 1 WHERE id = $1', [bottleId]);
    }
    await this.db.execute(
      `UPDATE bottles SET holder_id = NULL, held_at = NULL, moved_at = now(),
         status = CASE WHEN reports >= ${REPORTS_TO_REMOVE} THEN 'removed' WHEN hops >= ${MAX_HOPS} THEN 'ashore' ELSE 'drifting' END
       WHERE id = $1`,
      [bottleId],
    );
    return bottle.authorId;
  }

  async reply(userId: number, bottleId: number, raw: string) {
    const content = (raw ?? '').trim();
    if (content.length < 2) throw ApiError.badRequest('답장을 적어 주세요');
    if (content.length > BOTTLE_MAX_LENGTH) throw ApiError.badRequest(`답장은 ${BOTTLE_MAX_LENGTH}자까지 쓸 수 있어요`);
    const author = await this.db.transaction(async () => {
      const a = await this.letGo(userId, bottleId, 'reply');
      await this.db.execute('INSERT INTO bottle_replies (bottle_id, author_id, content) VALUES ($1, $2, $3)', [bottleId, userId, content]);
      return a;
    });
    await this.badges.checkQuietly(userId);
    await this.badges.checkQuietly(author);
  }

  async release(userId: number, bottleId: number) {
    await this.badges.checkQuietly(await this.db.transaction(() => this.letGo(userId, bottleId, 'release')));
  }

  async report(userId: number, bottleId: number) {
    await this.badges.checkQuietly(await this.db.transaction(() => this.letGo(userId, bottleId, 'report')));
  }

  /** 내가 띄운 병들: 상태 · 여정 · 답장 (보고 나면 답장은 읽음) */
  async mine(userId: number): Promise<MyBottle[]> {
    await this.sweep();
    const bottles = await this.db.query<{ id: number; content: string; status: BottleStatus; hops: number; createdAt: Date }>(
      `SELECT id, content, status, hops, created_at AS "createdAt" FROM bottles WHERE author_id = $1 ORDER BY id DESC LIMIT 30`,
      [userId],
    );
    if (!bottles.length) return [];
    const ids = bottles.map((b) => b.id);
    const [hops, replies, letters] = await Promise.all([
      this.db.query<{ bottleId: number; at: Date; action: HopAction | null }>(
        `SELECT bottle_id AS "bottleId", received_at AS at, action FROM bottle_hops WHERE bottle_id = ANY($1) ORDER BY received_at`,
        [ids],
      ),
      this.db.query<{ bottleId: number; id: number; content: string; createdAt: Date; readAt: Date | null }>(
        `SELECT r.bottle_id AS "bottleId", r.id, r.content, r.created_at AS "createdAt", r.read_at AS "readAt"
         FROM bottle_replies r WHERE r.bottle_id = ANY($1)
           AND NOT EXISTS (SELECT 1 FROM user_blocks k WHERE k.blocker_id = $2 AND k.blocked_id = r.author_id)
         ORDER BY r.id`,
        [ids, userId],
      ),
      this.db.query<{ replyId: number; id: number; fromAuthor: boolean; content: string; createdAt: Date }>(
        `SELECT l.reply_id AS "replyId", l.id, l.from_author AS "fromAuthor", l.content, l.created_at AS "createdAt"
         FROM bottle_letters l JOIN bottle_replies r ON r.id = l.reply_id WHERE r.bottle_id = ANY($1) ORDER BY l.id`,
        [ids],
      ),
    ]);
    await this.db.execute(
      `UPDATE bottle_letters l SET read_at = now() FROM bottle_replies r
       WHERE r.id = l.reply_id AND r.bottle_id = ANY($1) AND NOT l.from_author AND l.read_at IS NULL`,
      [ids],
    );
    await this.db.execute(
      'UPDATE bottle_replies SET read_at = now() WHERE read_at IS NULL AND bottle_id = ANY($1)',
      [ids],
    );
    // 여정을 마치고 돌아온 내 병을 다시 읽었다 (숨은 배지 '자기 자신과의 대화')
    if (bottles.some((b) => b.status === 'ashore')) {
      await this.badges.mark(userId, 'own_ashore');
      await this.badges.checkQuietly(userId);
    }
    return bottles.map((b) => ({
      ...b,
      // 신고로 건져 낸 병은 '해변에 닿음'으로만 보인다 (신고 사실은 알리지 않는다)
      status: b.status === 'removed' ? 'ashore' : b.status,
      journey: hops.filter((h) => h.bottleId === b.id).map(({ at, action }) => ({ at, action: action === 'report' ? 'release' : action })),
      replies: replies
        .filter((r) => r.bottleId === b.id)
        .map(({ id, content, createdAt, readAt }) => ({
          id,
          content,
          createdAt,
          read: !!readAt,
          letters: letters.filter((l) => l.replyId === id).map((l) => ({ id: l.id, mine: l.fromAuthor, content: l.content, createdAt: l.createdAt })),
        })),
    }));
  }

  /**
   * 답장에 이어 편지 쓰기: 병 주인과 그 답장을 쓴 사람만. 둘 중 누가 차단했으면 막는다.
   * 서로 이름은 끝까지 보이지 않는다 (병 주인 → '병을 띄운 사람', 답장한 사람 → '어느 바닷가의 누군가')
   */
  async letter(userId: number, replyId: number, raw: string): Promise<Letter> {
    const content = (raw ?? '').trim();
    if (content.length < 2) throw ApiError.badRequest('편지를 적어 주세요');
    if (content.length > BOTTLE_MAX_LENGTH) throw ApiError.badRequest(`편지는 ${BOTTLE_MAX_LENGTH}자까지 쓸 수 있어요`);
    const r = await this.db.one<{ replier: number; owner: number; letters: number }>(
      `SELECT r.author_id AS replier, b.author_id AS owner, (SELECT count(*)::int FROM bottle_letters l WHERE l.reply_id = r.id) AS letters
       FROM bottle_replies r JOIN bottles b ON b.id = r.bottle_id WHERE r.id = $1`,
      [replyId],
    );
    if (!r || (userId !== r.owner && userId !== r.replier)) throw ApiError.notFound('주고받을 수 없는 편지예요');
    const other = userId === r.owner ? r.replier : r.owner;
    const blocked = await this.db.one('SELECT 1 FROM user_blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)', [userId, other]);
    if (blocked) throw ApiError.forbidden('더는 편지를 주고받을 수 없어요');
    if (r.letters >= MAX_LETTERS) throw ApiError.badRequest(`편지는 한 답장에 ${MAX_LETTERS}통까지 주고받을 수 있어요`);
    const row = await this.db.one<{ id: number; createdAt: Date }>(
      'INSERT INTO bottle_letters (reply_id, from_author, content) VALUES ($1, $2, $3) RETURNING id, created_at AS "createdAt"',
      [replyId, userId === r.owner, content],
    );
    return { id: row!.id, mine: true, content, createdAt: row!.createdAt };
  }

  /** 내가 답장한 병들: 원래 병 · 내 답장 · 이어진 편지 (열면 병 주인의 편지는 읽음) */
  async conversations(userId: number): Promise<Conversation[]> {
    const rows = await this.db.query<{ replyId: number; bottle: string; bottleAt: Date; reply: string; replyAt: Date }>(
      `SELECT r.id AS "replyId", b.content AS bottle, b.created_at AS "bottleAt", r.content AS reply, r.created_at AS "replyAt"
       FROM bottle_replies r JOIN bottles b ON b.id = r.bottle_id
       WHERE r.author_id = $1 AND b.status <> 'removed'
         AND NOT EXISTS (SELECT 1 FROM user_blocks k WHERE k.blocker_id = $1 AND k.blocked_id = b.author_id)
       ORDER BY coalesce((SELECT max(l.id) FROM bottle_letters l WHERE l.reply_id = r.id), 0) DESC, r.id DESC LIMIT 30`,
      [userId],
    );
    if (!rows.length) return [];
    const ids = rows.map((r) => r.replyId);
    const letters = await this.db.query<{ replyId: number; id: number; fromAuthor: boolean; content: string; createdAt: Date; readAt: Date | null }>(
      `SELECT reply_id AS "replyId", id, from_author AS "fromAuthor", content, created_at AS "createdAt", read_at AS "readAt"
       FROM bottle_letters WHERE reply_id = ANY($1) ORDER BY id`,
      [ids],
    );
    await this.db.execute('UPDATE bottle_letters SET read_at = now() WHERE reply_id = ANY($1) AND from_author AND read_at IS NULL', [ids]);
    return rows.map((r) => {
      const mine = letters.filter((l) => l.replyId === r.replyId);
      return {
        replyId: r.replyId,
        bottle: { content: r.bottle, createdAt: r.bottleAt },
        reply: { content: r.reply, createdAt: r.replyAt },
        letters: mine.map((l) => ({ id: l.id, mine: !l.fromAuthor, content: l.content, createdAt: l.createdAt })),
        unread: mine.filter((l) => l.fromAuthor && !l.readAt).length,
      };
    });
  }
}

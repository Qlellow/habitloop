import { Injectable } from '@nestjs/common';
import { clamp, cursorPage, type CursorPage } from '../common/cursor-page';
import { Database } from '../db/database';
import { PushService } from './push.service';

export type NotificationType = 'comment' | 'reply' | 'like' | 'notice' | 'discovery';

export interface NotificationItem {
  id: number;
  type: NotificationType;
  /** 알림을 만든 사람 (공지는 쓴 사람). 공감은 마지막으로 누른 사람 */
  actor?: { id: string; nickname: string; avatarUrl?: string };
  /** 공감: 읽기 전까지 모인 사람 수 */
  count: number;
  post: { id: number; title: string; channelSlug: string; channelName: string };
  /** 댓글 · 답글: 그 댓글 앞부분 */
  comment?: { id: number; excerpt: string };
  read: boolean;
  createdAt: Date;
}

interface Row {
  id: number;
  type: NotificationType;
  actorUid: string | null;
  actorNickname: string | null;
  actorAvatar: string | null;
  count: number;
  postId: number;
  postTitle: string;
  channelSlug: string;
  channelName: string;
  commentId: number | null;
  commentContent: string | null;
  readAt: Date | null;
  createdAt: Date;
}

const MAX_PAGE_SIZE = 50;
const EXCERPT = 60;

/**
 * 알림. 글 · 댓글 · 공감을 처리하는 곳에서 부르고, 자기 자신에게는 보내지 않는다.
 * 알림을 못 만들어도 원래 동작(댓글 쓰기 등)은 성공해야 하므로 실패는 삼킨다.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly db: Database,
    private readonly push: PushService,
  ) {}

  /** 새 댓글: 글쓴이에게 / 답글: 원댓글 쓴 사람에게 (글쓴이와 원댓글 쓴 사람이 같으면 답글 알림 하나만) */
  async commented(postId: number, commentId: number, actorId: number, parentId: number | null) {
    await this.safe(async () => {
      const post = await this.db.one<{ authorId: number }>('SELECT author_id AS "authorId" FROM posts WHERE id = $1', [postId]);
      const parent =
        parentId == null ? undefined : await this.db.one<{ authorId: number }>('SELECT author_id AS "authorId" FROM comments WHERE id = $1', [parentId]);
      const ids: number[] = [];
      if (parent && parent.authorId !== actorId) ids.push(...(await this.insert(parent.authorId, 'reply', actorId, postId, commentId)));
      if (post && post.authorId !== actorId && post.authorId !== parent?.authorId) ids.push(...(await this.insert(post.authorId, 'comment', actorId, postId, commentId)));
      await this.pushFor(ids);
    });
  }

  /** 처음 공감: 읽기 전 같은 글의 공감 알림이 있으면 한 줄로 모은다 */
  async liked(postId: number, actorId: number) {
    await this.safe(async () => {
      const post = await this.db.one<{ authorId: number }>('SELECT author_id AS "authorId" FROM posts WHERE id = $1', [postId]);
      if (!post || post.authorId === actorId) return;
      if (await this.db.one('SELECT 1 FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2', [post.authorId, actorId])) return;
      const merged = await this.db.execute(
        `UPDATE notifications SET count = count + 1, actor_id = $3, created_at = now()
         WHERE id = (SELECT id FROM notifications WHERE user_id = $1 AND type = 'like' AND post_id = $2 AND read_at IS NULL
                     ORDER BY id DESC LIMIT 1)`,
        [post.authorId, postId, actorId],
      );
      // 모인 공감은 다시 울리지 않는다 (처음 한 번만 푸시)
      if (!merged) await this.pushFor(await this.insert(post.authorId, 'like', actorId, postId, null));
    });
  }

  /** 운영진 전용 카테고리(공지)에 새 글: 그 채널 팔로워 모두에게 (쓴 사람 제외) */
  async noticePosted(postId: number, channelId: number, authorId: number) {
    await this.safe(async () => {
      const rows = await this.db.query<{ id: number }>(
        `INSERT INTO notifications (user_id, type, actor_id, post_id)
         SELECT m.user_id, 'notice', $3, $1 FROM channel_members m
         WHERE m.channel_id = $2 AND m.user_id <> $3
           AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = m.user_id AND b.blocked_id = $3)
         RETURNING id`,
        [postId, channelId, authorId],
      );
      await this.pushFor(rows.map((r) => r.id));
    });
  }

  /** 내 글이 오늘의 발견에 뽑혔다 (보낸 사람 없음) */
  async discovered(postId: number, authorId: number) {
    await this.safe(async () => {
      const rows = await this.db.query<{ id: number }>(`INSERT INTO notifications (user_id, type, post_id) VALUES ($1, 'discovery', $2) RETURNING id`, [authorId, postId]);
      await this.pushFor(rows.map((r) => r.id));
    });
  }

  async list(userId: number, cursor: number | undefined, size: number): Promise<CursorPage<NotificationItem>> {
    const pageSize = clamp(size, 1, MAX_PAGE_SIZE);
    const rows = await this.db.query<Row>(
      `SELECT n.id, n.type, a.uid::text AS "actorUid", a.nickname AS "actorNickname",
              CASE WHEN a.avatar_id IS NULL THEN NULL ELSE '/api/images/' || a.avatar_id END AS "actorAvatar",
              n.count, p.id AS "postId", p.title AS "postTitle", c.slug AS "channelSlug", c.name AS "channelName",
              n.comment_id AS "commentId", cm.content AS "commentContent", n.read_at AS "readAt", n.created_at AS "createdAt"
       FROM notifications n
       JOIN posts p ON p.id = n.post_id
       JOIN channels c ON c.id = p.channel_id
       LEFT JOIN users a ON a.id = n.actor_id
       LEFT JOIN comments cm ON cm.id = n.comment_id
       WHERE n.user_id = $1 AND ($2::int IS NULL OR n.id < $2)
       ORDER BY n.id DESC LIMIT $3`,
      [userId, cursor ?? null, pageSize + 1],
    );
    return cursorPage(rows.map(toItem), pageSize);
  }

  async unreadCount(userId: number) {
    const row = await this.db.one<{ n: number }>('SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL', [userId]);
    return { count: row?.n ?? 0 };
  }

  async read(userId: number, id: number) {
    await this.db.execute('UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2 AND read_at IS NULL', [id, userId]);
  }

  async readAll(userId: number) {
    await this.db.execute('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [userId]);
  }

  /** 받는 사람이 actor 를 차단했으면 보내지 않는다. 만든 알림 번호를 돌려준다 (푸시용) */
  private async insert(userId: number, type: NotificationType, actorId: number, postId: number, commentId: number | null) {
    const rows = await this.db.query<{ id: number }>(
      `INSERT INTO notifications (user_id, type, actor_id, post_id, comment_id)
       SELECT $1::int, $2::varchar, $3::int, $4::int, $5::int
       WHERE NOT EXISTS (SELECT 1 FROM user_blocks WHERE blocker_id = $1::int AND blocked_id = $3::int)
       RETURNING id`,
      [userId, type, actorId, postId, commentId],
    );
    return rows.map((r) => r.id);
  }

  /** 방금 만든 알림을 그 사람의 앱으로 푸시 (알림 목록과 같은 문장) */
  private async pushFor(ids: number[]) {
    if (!ids.length) return;
    const rows = await this.db.query<{ userId: number; type: NotificationType; actor: string | null; postId: number; postTitle: string; channelName: string; comment: string | null }>(
      `SELECT n.user_id AS "userId", n.type, a.nickname AS actor, p.id AS "postId", p.title AS "postTitle", c.name AS "channelName", cm.content AS comment
       FROM notifications n JOIN posts p ON p.id = n.post_id JOIN channels c ON c.id = p.channel_id
       LEFT JOIN users a ON a.id = n.actor_id LEFT JOIN comments cm ON cm.id = n.comment_id
       WHERE n.id = ANY($1)`,
      [ids],
    );
    const who = (r: { actor: string | null }) => r.actor ?? '누군가';
    const short = (s: string | null) => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, EXCERPT);
    await this.push.send(
      rows.map((r) => {
        const title =
          r.type === 'comment' ? `${who(r)}님이 내 글에 댓글을 달았어요`
          : r.type === 'reply' ? `${who(r)}님이 내 댓글에 답글을 달았어요`
          : r.type === 'like' ? `${who(r)}님이 내 글을 좋아해요`
          : r.type === 'notice' ? `${r.channelName} 새 공지`
          : '내 글이 오늘의 발견에 뽑혔어요';
        const body = r.type === 'comment' || r.type === 'reply' ? short(r.comment) || r.postTitle : r.postTitle;
        return { userId: r.userId, title, body, url: `/post/${r.postId}` };
      }),
    );
  }

  private async safe(fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch {
      /* 알림은 덤: 실패해도 원래 요청은 그대로 성공 */
    }
  }
}

function toItem(r: Row): NotificationItem {
  const excerpt = r.commentContent?.replace(/\s+/g, ' ').trim();
  return {
    id: r.id,
    type: r.type,
    actor: r.actorUid ? { id: r.actorUid, nickname: r.actorNickname!, avatarUrl: r.actorAvatar ?? undefined } : undefined,
    count: r.count,
    post: { id: r.postId, title: r.postTitle, channelSlug: r.channelSlug, channelName: r.channelName },
    comment:
      r.commentId != null && excerpt != null
        ? { id: r.commentId, excerpt: [...excerpt].length > EXCERPT ? `${[...excerpt].slice(0, EXCERPT).join('')}…` : excerpt }
        : undefined,
    read: r.readAt != null,
    createdAt: r.createdAt,
  };
}

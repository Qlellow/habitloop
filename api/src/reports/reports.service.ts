import { Injectable } from '@nestjs/common';
import { ChannelsService } from '../channels/channels.service';
import { canModerate, isStaff, type ChannelRole } from '../channels/roles';
import { ApiError } from '../common/api-error';
import { Database } from '../db/database';
import { CommentsService } from '../posts/comments.service';
import { PostsService } from '../posts/posts.service';
import type { ReportAction, ReportReason } from './reports.dto';

interface GroupRow {
  postId: number;
  commentId: number | null;
  count: number;
  reasons: ReportReason[];
  details: string[] | null;
  status: string;
  lastReportedAt: Date;
  postTitle: string;
  excerpt: string;
  hidden: boolean;
  authorId: number;
  authorUid: string;
  authorNickname: string;
}

const LIST_SIZE = 100;
const EXCERPT = 120;

/**
 * 신고. 글 · 댓글을 신고하면 그 채널 운영진(소유자 · 관리자 · 매니저)의 신고함에 같은 대상끼리 모인다.
 * 운영진은 숨기기 · 지우기 · 문제 없음으로 처리한다. 숨기기 · 지우기는 자기보다 아래 역할의 글 · 댓글만 (글 삭제와 같은 규칙)
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly db: Database,
    private readonly channels: ChannelsService,
    private readonly posts: PostsService,
    private readonly comments: CommentsService,
  ) {}

  /** 글(commentId 없음) 또는 댓글 신고. 내 글 · 댓글은 신고할 수 없고, 같은 대상은 한 번만 */
  async report(userId: number, postId: number, commentId: number | undefined, reason: ReportReason, detail?: string) {
    const target = await this.target(postId, commentId);
    if (target.authorId === userId) throw ApiError.badRequest(commentId ? '내 댓글은 신고할 수 없어요' : '내 글은 신고할 수 없어요');
    const added = await this.db.execute(
      `INSERT INTO reports (reporter_id, channel_id, post_id, comment_id, reason, detail) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [userId, target.channelId, postId, commentId ?? null, reason, detail?.trim() || null],
    );
    if (!added) throw ApiError.conflict(commentId ? '이미 신고한 댓글이에요' : '이미 신고한 글이에요');
  }

  /** 신고함: open 은 처리 전, done 은 처리한 것 (숨김 · 문제 없음). 같은 대상의 신고는 한 줄로 */
  async list(slug: string, userId: number, status: 'open' | 'done') {
    const { channel, role } = await this.requireStaff(slug, userId);
    const rows = await this.db.query<GroupRow>(
      `SELECT r.post_id AS "postId", r.comment_id AS "commentId", count(*)::int AS count,
              array_agg(DISTINCT r.reason) AS reasons,
              (array_remove(array_agg(r.detail ORDER BY r.id DESC), NULL))[1:5] AS details,
              (array_agg(r.status ORDER BY r.id DESC))[1] AS status,
              max(r.created_at) AS "lastReportedAt",
              p.title AS "postTitle", COALESCE(cm.content, p.excerpt) AS excerpt,
              COALESCE(cm.hidden_at, p.hidden_at) IS NOT NULL AS hidden,
              a.id AS "authorId", a.uid::text AS "authorUid", a.nickname AS "authorNickname"
       FROM reports r
       JOIN posts p ON p.id = r.post_id
       LEFT JOIN comments cm ON cm.id = r.comment_id
       JOIN users a ON a.id = COALESCE(cm.author_id, p.author_id)
       WHERE r.channel_id = $1 AND ${status === 'open' ? "r.status = 'open'" : "r.status <> 'open'"}
       GROUP BY r.post_id, r.comment_id, p.title, p.excerpt, p.hidden_at, cm.content, cm.hidden_at, a.id
       ORDER BY max(r.id) DESC LIMIT $2`,
      [channel.id, LIST_SIZE],
    );
    const roles = await this.authorRoles(channel.id, [...new Set(rows.map((r) => r.authorId))]);
    return rows.map((r) => {
      const excerpt = r.excerpt.replace(/\s+/g, ' ').trim();
      return {
        postId: r.postId,
        commentId: r.commentId ?? undefined,
        postTitle: r.postTitle,
        excerpt: [...excerpt].length > EXCERPT ? `${[...excerpt].slice(0, EXCERPT).join('')}…` : excerpt,
        author: { id: r.authorUid, nickname: r.authorNickname },
        count: r.count,
        reasons: r.reasons,
        details: r.details ?? [],
        status: r.status,
        hidden: r.hidden,
        lastReportedAt: r.lastReportedAt,
        // 숨기기 · 지우기: 자기보다 아래 역할의 글 · 댓글만 (내 글은 안 됨)
        canAct: r.authorId !== userId && canModerate(role, roles.get(r.authorId)),
      };
    });
  }

  async act(slug: string, userId: number, postId: number, commentId: number | undefined, action: ReportAction) {
    const { channel, role } = await this.requireStaff(slug, userId);
    const target = await this.target(postId, commentId);
    if (target.channelId !== channel.id) throw ApiError.notFound('이 채널의 글이 아니에요');
    if (action !== 'dismiss') {
      const authorRole = await this.channels.roleOf(channel.id, target.authorId);
      if (target.authorId === userId || !canModerate(role, authorRole)) throw ApiError.forbidden('나보다 높은 운영진의 글 · 댓글은 처리할 수 없어요');
    }
    if (action === 'delete') {
      // 지우면 그 대상의 신고도 함께 사라진다 (FK ON DELETE CASCADE)
      if (commentId) await this.comments.remove(userId, postId, commentId);
      else await this.posts.remove(userId, postId);
      return;
    }
    const table = commentId ? 'comments' : 'posts';
    await this.db.transaction(async () => {
      if (action === 'hide' || action === 'unhide') {
        await this.db.execute(`UPDATE ${table} SET hidden_at = ${action === 'hide' ? 'now()' : 'NULL'} WHERE id = $1`, [commentId ?? postId]);
      }
      // 숨기면 '숨김', 숨김을 풀거나 문제 없음이면 '문제 없음'으로 처리한 것으로 남긴다
      await this.db.execute(
        `UPDATE reports SET status = $3, handled_by = $4, handled_at = now()
         WHERE post_id = $1 AND comment_id IS NOT DISTINCT FROM $2 AND status ${action === 'unhide' ? "<> 'open'" : "= 'open'"}`,
        [postId, commentId ?? null, action === 'hide' ? 'hidden' : 'dismissed', userId],
      );
    });
    if (!commentId) this.posts.visibilityChanged();
  }

  private async requireStaff(slug: string, userId: number) {
    const channel = await this.channels.findBySlug(slug);
    const role = await this.channels.roleOf(channel.id, userId);
    if (!isStaff(role)) throw ApiError.forbidden('채널 운영진만 볼 수 있어요');
    return { channel, role };
  }

  /** 신고 · 처리할 글 또는 댓글: 채널과 쓴 사람 */
  private async target(postId: number, commentId?: number) {
    const row = commentId
      ? await this.db.one<{ channelId: number; authorId: number }>(
          `SELECT p.channel_id AS "channelId", cm.author_id AS "authorId" FROM comments cm JOIN posts p ON p.id = cm.post_id
           WHERE cm.id = $1 AND cm.post_id = $2`,
          [commentId, postId],
        )
      : await this.db.one<{ channelId: number; authorId: number }>('SELECT channel_id AS "channelId", author_id AS "authorId" FROM posts WHERE id = $1', [
          postId,
        ]);
    if (!row) throw ApiError.notFound(commentId ? '댓글을 찾을 수 없어요' : '게시글을 찾을 수 없어요');
    return row;
  }

  private async authorRoles(channelId: number, userIds: number[]) {
    if (userIds.length === 0) return new Map<number, ChannelRole>();
    const rows = await this.db.query<{ userId: number; role: ChannelRole }>(
      'SELECT user_id AS "userId", role FROM channel_members WHERE channel_id = $1 AND user_id = ANY($2::int[])',
      [channelId, userIds],
    );
    return new Map(rows.map((r) => [r.userId, r.role]));
  }
}

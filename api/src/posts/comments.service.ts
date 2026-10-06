import { Injectable } from '@nestjs/common';
import { ChannelsService } from '../channels/channels.service';
import { badge, canModerate, type ChannelRole } from '../channels/roles';
import { ApiError } from '../common/api-error';
import { clamp, cursorPage, type CursorPage } from '../common/cursor-page';
import { Database } from '../db/database';

const MAX_PAGE_SIZE = 100;
/** 베스트 댓글이 되려면 받아야 하는 최소 좋아요 수 */
export const BEST_MIN_LIKES = 2;
const BEST_SIZE = 3;

interface CommentRow {
  id: number;
  authorId: number;
  authorNickname: string;
  authorAvatar: string | null;
  content: string;
  likeCount: number;
  createdAt: Date;
  updatedAt: Date | null;
  parentId: number | null;
}

const SELECT_COMMENT = `SELECT c.id, c.author_id AS "authorId", u.nickname AS "authorNickname",
  CASE WHEN u.avatar_id IS NULL THEN NULL ELSE '/api/images/' || u.avatar_id END AS "authorAvatar", c.content,
  c.like_count AS "likeCount", c.created_at AS "createdAt", c.updated_at AS "updatedAt", c.parent_id AS "parentId"
  FROM comments c JOIN users u ON u.id = c.author_id`;

@Injectable()
export class CommentsService {
  constructor(
    private readonly db: Database,
    private readonly channels: ChannelsService,
  ) {}

  /**
   * 댓글 목록: 최근 댓글이 위에 (키셋 페이지네이션). 답글은 각 댓글 아래에 오래된 순으로 함께 온다.
   */
  async list(postId: number, cursor: number | undefined, size: number, viewerId?: number): Promise<CursorPage<object & { id: number }>> {
    const pageSize = clamp(size, 1, MAX_PAGE_SIZE);
    const rows = await this.db.query<CommentRow>(
      `${SELECT_COMMENT} WHERE c.post_id = $1 AND c.parent_id IS NULL AND ($2::int IS NULL OR c.id < $2) ORDER BY c.id DESC LIMIT $3`,
      [postId, cursor ?? null, pageSize + 1],
    );
    const page = cursorPage(rows, pageSize);
    const replies = page.items.length
      ? await this.db.query<CommentRow>(`${SELECT_COMMENT} WHERE c.parent_id = ANY($1::int[]) ORDER BY c.id ASC`, [page.items.map((r) => r.id)])
      : [];
    const responses = await this.toResponses(postId, [...page.items, ...replies], viewerId);
    const byId = new Map(responses.map((r) => [r.id, { ...r, replies: [] as object[] }]));
    for (const r of replies) byId.get(r.parentId!)?.replies.push(byId.get(r.id)!);
    return { items: page.items.map((r) => byId.get(r.id)!), nextCursor: page.nextCursor };
  }

  /** 베스트 댓글: (post_id, like_count) 인덱스로 좋아요가 일정 수 이상인 댓글만 본다 */
  async best(postId: number, viewerId?: number) {
    const rows = await this.db.query<CommentRow>(
      `${SELECT_COMMENT} WHERE c.post_id = $1 AND c.like_count >= $2 ORDER BY c.like_count DESC, c.id ASC LIMIT $3`,
      [postId, BEST_MIN_LIKES, BEST_SIZE],
    );
    return this.toResponses(postId, rows, viewerId);
  }

  /** parentId 가 있으면 그 댓글의 답글 (답글에 다는 답글은 같은 댓글 아래에 모인다: 한 단계) */
  async create(userId: number, postId: number, content: string, parentId?: number) {
    const channelId = await this.channelOf(postId);
    let parent: number | null = null;
    if (parentId != null) {
      const p = await this.db.one<{ id: number; parentId: number | null }>(
        'SELECT id, parent_id AS "parentId" FROM comments WHERE id = $1 AND post_id = $2',
        [parentId, postId],
      );
      if (!p) throw ApiError.notFound('답글을 달 댓글이 없어요');
      parent = p.parentId ?? p.id;
    }
    const id = await this.db.transaction(async () => {
      const row = await this.db.one<{ id: number }>(
        'INSERT INTO comments (post_id, author_id, content, parent_id) VALUES ($1, $2, $3, $4) RETURNING id',
        [postId, userId, content, parent],
      );
      await this.db.execute('UPDATE posts SET comment_count = comment_count + 1 WHERE id = $1', [postId]);
      return row!.id;
    });
    const row = await this.db.one<CommentRow>(`${SELECT_COMMENT} WHERE c.id = $1`, [id]);
    const role = await this.channels.roleOf(channelId, userId);
    return this.toResponse(row!, userId, false, role, role);
  }

  async remove(userId: number, postId: number, commentId: number) {
    const comment = await this.find(postId, commentId);
    // 작성자 본인, 또는 작성자보다 높은 채널 운영진이 지울 수 있다
    if (comment.authorId !== userId) {
      const channelId = await this.channelOf(postId);
      const [role, authorRole] = await Promise.all([
        this.channels.roleOf(channelId, userId),
        this.channels.roleOf(channelId, comment.authorId),
      ]);
      if (!canModerate(role, authorRole)) throw ApiError.forbidden();
    }
    await this.db.transaction(async () => {
      // 답글도 함께 지워지므로(FK ON DELETE CASCADE) 그만큼 댓글 수를 줄인다
      const removed = await this.db.one<{ n: number }>('SELECT count(*)::int AS n FROM comments WHERE id = $1 OR parent_id = $1', [commentId]);
      await this.db.execute('DELETE FROM comments WHERE id = $1', [commentId]); // 댓글 좋아요는 FK ON DELETE CASCADE
      await this.db.execute('UPDATE posts SET comment_count = comment_count - $2 WHERE id = $1', [postId, removed!.n]);
    });
  }

  /** 댓글 수정: 쓴 사람만 */
  async update(userId: number, postId: number, commentId: number, content: string) {
    const comment = await this.find(postId, commentId);
    if (comment.authorId !== userId) throw ApiError.forbidden('내가 쓴 댓글만 고칠 수 있어요');
    await this.db.execute('UPDATE comments SET content = $1, updated_at = now() WHERE id = $2', [content, commentId]);
    const row = await this.db.one<CommentRow>(`${SELECT_COMMENT} WHERE c.id = $1`, [commentId]);
    const [res] = await this.toResponses(postId, [row!], userId);
    return res;
  }

  async like(userId: number, postId: number, commentId: number) {
    await this.find(postId, commentId);
    const likeCount = await this.db.transaction(async () => {
      const added = await this.db.execute(
        'INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2) ON CONFLICT (comment_id, user_id) DO NOTHING',
        [commentId, userId],
      );
      return this.addLikeCount(commentId, added);
    });
    return { liked: true, likeCount };
  }

  async unlike(userId: number, postId: number, commentId: number) {
    await this.find(postId, commentId);
    const likeCount = await this.db.transaction(async () => {
      const removed = await this.db.execute('DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2', [commentId, userId]);
      return this.addLikeCount(commentId, -removed);
    });
    return { liked: false, likeCount };
  }

  private async addLikeCount(commentId: number, delta: number): Promise<number> {
    const row = await this.db.one<{ n: number }>(
      'UPDATE comments SET like_count = like_count + $1 WHERE id = $2 RETURNING like_count AS n',
      [delta, commentId],
    );
    return row!.n;
  }

  private async channelOf(postId: number): Promise<number> {
    const row = await this.db.one<{ channelId: number }>('SELECT channel_id AS "channelId" FROM posts WHERE id = $1', [postId]);
    if (!row) throw ApiError.notFound('게시글을 찾을 수 없어요');
    return row.channelId;
  }

  private async find(postId: number, commentId: number) {
    const row = await this.db.one<{ authorId: number }>('SELECT author_id AS "authorId" FROM comments WHERE id = $1 AND post_id = $2', [
      commentId,
      postId,
    ]);
    if (!row) throw ApiError.notFound('댓글을 찾을 수 없어요');
    return row;
  }

  private async toResponses(postId: number, rows: CommentRow[], viewerId?: number) {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const authorIds = [...new Set(rows.map((r) => r.authorId))];
    const channel = await this.db.one<{ channelId: number }>('SELECT channel_id AS "channelId" FROM posts WHERE id = $1', [postId]);
    const [liked, staff, viewerRole] = await Promise.all([
      viewerId == null
        ? Promise.resolve(new Set<number>())
        : this.db
            .query<{ id: number }>('SELECT comment_id AS id FROM comment_likes WHERE user_id = $1 AND comment_id = ANY($2::int[])', [
              viewerId,
              ids,
            ])
            .then((r) => new Set(r.map((x) => x.id))),
      // 작성자 중 운영진인 사람만 IN 쿼리 한 번으로 찾는다 (닉네임 옆 배지)
      channel
        ? this.db.query<{ userId: number; role: ChannelRole }>(
            `SELECT user_id AS "userId", role FROM channel_members
             WHERE channel_id = $1 AND user_id = ANY($2::int[]) AND role <> 'MEMBER'`,
            [channel.channelId, authorIds],
          )
        : Promise.resolve([]),
      channel ? this.channels.roleOf(channel.channelId, viewerId) : Promise.resolve(undefined),
    ]);
    const roles = new Map(staff.map((s) => [s.userId, s.role]));
    return rows.map((r) => this.toResponse(r, viewerId, liked.has(r.id), roles.get(r.authorId), viewerRole));
  }

  /** deletable: 내 댓글이거나, 내가 작성자보다 높은 채널 운영진이라 지울 수 있는지 */
  private toResponse(
    c: CommentRow,
    viewerId: number | undefined,
    liked: boolean,
    authorRole: ChannelRole | undefined,
    viewerRole: ChannelRole | undefined,
  ) {
    const mine = viewerId != null && c.authorId === viewerId;
    return {
      id: c.id,
      authorId: c.authorId,
      authorNickname: c.authorNickname,
      authorAvatar: c.authorAvatar ?? undefined,
      authorRole: badge(authorRole),
      content: c.content,
      likeCount: c.likeCount,
      liked,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt ?? undefined,
      parentId: c.parentId ?? undefined,
      mine,
      deletable: mine || canModerate(viewerRole, authorRole),
    };
  }
}

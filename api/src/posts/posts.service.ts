import { Injectable } from '@nestjs/common';
import { CategoriesService } from '../channels/categories.service';
import { ChannelsService } from '../channels/channels.service';
import { MembershipService } from '../channels/membership.service';
import { badge, canModerate, type ChannelRole } from '../channels/roles';
import { ApiError } from '../common/api-error';
import { clamp, cursorPage, escapeLike, type CursorPage } from '../common/cursor-page';
import { TtlCache } from '../common/ttl-cache';
import { Database } from '../db/database';
import { makeExcerpt } from './excerpt';
import type { CreatePostInput, UpdatePostInput } from './posts.dto';

export interface PostSummary {
  id: number;
  channelSlug: string;
  channelName: string;
  categoryName?: string;
  title: string;
  excerpt: string;
  authorNickname: string;
  /** 작성자의 채널 운영진 역할 (닉네임 옆 배지). 일반 멤버는 없음 */
  authorRole?: ChannelRole;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: Date;
}

export interface PostSearch {
  channel?: string;
  category?: number;
  authorId?: number;
  q?: string;
}

export const MAX_PAGE_SIZE = 50;
const POPULAR_DAYS = 7;
const POPULAR_SIZE = 5;

/**
 * 목록 조회: 본문(TEXT) 없이 필요한 컬럼만 읽는다.
 * 작성자 역할은 (channel_id, user_id) unique 인덱스로 한 번에 붙인다.
 */
const SELECT_SUMMARY = `
  SELECT p.id, c.slug AS "channelSlug", c.name AS "channelName", cat.name AS "categoryName", p.title, p.excerpt,
         a.nickname AS "authorNickname", m.role AS "authorRole", p.like_count AS "likeCount",
         p.comment_count AS "commentCount", p.view_count AS "viewCount", p.created_at AS "createdAt"
  FROM posts p
  JOIN users a ON a.id = p.author_id
  JOIN channels c ON c.id = p.channel_id
  LEFT JOIN channel_categories cat ON cat.id = p.category_id
  LEFT JOIN channel_members m ON m.channel_id = p.channel_id AND m.user_id = p.author_id`;

function toSummary(row: PostSummary & { authorRole: ChannelRole | null; categoryName: string | null }): PostSummary {
  return { ...row, categoryName: row.categoryName ?? undefined, authorRole: badge(row.authorRole) };
}

interface PostRow {
  id: number;
  authorId: number;
  authorNickname: string;
  channelId: number;
  channelSlug: string;
  channelName: string;
  iconVersion: number;
  channelColor: number | null;
  categoryId: number | null;
  categoryName: string | null;
  title: string;
  content: string;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PostsService {
  /** 인기글은 모든 방문자가 같은 결과를 보므로 (전체/채널별로) 짧게 캐시한다 */
  private readonly popularCache = new TtlCache<PostSummary[]>(60_000);

  constructor(
    private readonly db: Database,
    private readonly channels: ChannelsService,
    private readonly categories: CategoriesService,
    private readonly membership: MembershipService,
  ) {}

  /**
   * 키셋 페이지네이션. 조건이 없는 필터는 SQL 에서 아예 빼서 (channel_id, id) 같은 복합 인덱스를 그대로 탄다.
   */
  async list(search: PostSearch, cursor: number | undefined, size: number): Promise<CursorPage<PostSummary>> {
    const pageSize = clamp(size, 1, MAX_PAGE_SIZE);
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      params.push(value);
      where.push(sql.replace('?', `$${params.length}`));
    };
    if (cursor != null) add('p.id < ?', cursor);
    if (search.channel) add('c.slug = ?', search.channel);
    if (search.category != null) add('p.category_id = ?', search.category);
    if (search.authorId != null) add('p.author_id = ?', search.authorId);
    if (search.q?.trim()) add("lower(p.title) LIKE ? ESCAPE '\\'", `%${escapeLike(search.q.trim().toLowerCase())}%`);
    params.push(pageSize + 1);
    const rows = await this.db.query(
      `${SELECT_SUMMARY} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY p.id DESC LIMIT $${params.length}`,
      params,
    );
    return cursorPage(rows.map(toSummary), pageSize);
  }

  popular(channel?: string): Promise<PostSummary[]> {
    return this.popularCache.getOrLoad(channel ?? '*', async () => {
      const since = new Date(Date.now() - POPULAR_DAYS * 24 * 3600 * 1000);
      const rows = channel
        ? await this.db.query(
            `${SELECT_SUMMARY} WHERE c.slug = $1 AND p.created_at >= $2
             ORDER BY p.like_count DESC, p.comment_count DESC, p.id DESC LIMIT $3`,
            [channel, since, POPULAR_SIZE],
          )
        : await this.db.query(
            `${SELECT_SUMMARY} WHERE p.created_at >= $1 ORDER BY p.like_count DESC, p.comment_count DESC, p.id DESC LIMIT $2`,
            [since, POPULAR_SIZE],
          );
      return rows.map(toSummary);
    });
  }

  /** 여러 채널의 최근 글 N개씩 (채널 목록 미리보기). 채널마다 (channel_id, id) 인덱스로 N행만 읽는다 */
  async recentByChannels(channelIds: number[], perChannel: number): Promise<PostSummary[]> {
    if (channelIds.length === 0 || perChannel <= 0) return [];
    const rows = await this.db.query(
      `${SELECT_SUMMARY}
       WHERE p.id IN (
         SELECT r.id FROM unnest($1::int[]) AS ch(id)
         CROSS JOIN LATERAL (SELECT id FROM posts WHERE channel_id = ch.id ORDER BY id DESC LIMIT $2) r)
       ORDER BY p.id DESC`,
      [channelIds, perChannel],
    );
    return rows.map(toSummary);
  }

  /**
   * 글 보기. viewer(계정 또는 비로그인 브라우저·앱을 가리키는 값)가 이 글을 처음 볼 때만 조회수가 오른다.
   * 본 기록 넣기와 조회수 올리기를 쿼리 하나로 한다 (이미 봤으면 INSERT 가 아무것도 안 해서 UPDATE 도 건너뛴다)
   */
  async detail(postId: number, viewerId?: number, viewer?: string) {
    if (viewer) {
      await this.db.execute(
        `WITH seen AS (
           INSERT INTO post_views (post_id, viewer) SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM posts WHERE id = $1)
           ON CONFLICT DO NOTHING RETURNING 1
         )
         UPDATE posts SET view_count = view_count + 1 WHERE id = $1 AND EXISTS (SELECT 1 FROM seen)`,
        [postId, viewer],
      );
    }
    const post = await this.find(postId);
    const liked = viewerId != null && !!(await this.db.one('SELECT 1 FROM post_likes WHERE post_id = $1 AND user_id = $2', [postId, viewerId]));
    return this.toDetail(post, viewerId, liked);
  }

  async create(userId: number, input: CreatePostInput) {
    const channel = await this.channels.findBySlug(input.channel);
    // 글쓰기는 채널 가입자만 (보기·공감·댓글은 가입 없이 가능)
    await this.membership.requireMember(channel, userId);
    const categoryId = await this.categories.resolveForPost(channel, input.categoryId, userId);
    const id = await this.db.transaction(async () => {
      const row = await this.db.one<{ id: number }>(
        `INSERT INTO posts (author_id, channel_id, category_id, title, content, excerpt)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [userId, channel.id, categoryId, input.title.trim(), input.content, makeExcerpt(input.content)],
      );
      await this.db.execute('UPDATE channels SET post_count = post_count + 1 WHERE id = $1', [channel.id]);
      return row!.id;
    });
    this.channels.popularCache.clear();
    return this.toDetail(await this.find(id), userId, false);
  }

  async update(userId: number, postId: number, input: UpdatePostInput) {
    const post = await this.find(postId);
    if (post.authorId !== userId) throw ApiError.forbidden();
    const requested = input.categoryId ?? null;
    // 이미 들어 있던 카테고리는 (운영진 전용이 됐더라도) 그대로 둘 수 있다
    const categoryId =
      requested === post.categoryId ? post.categoryId : await this.categories.resolveForPost({ id: post.channelId }, requested, userId);
    await this.db.execute('UPDATE posts SET category_id = $1, title = $2, content = $3, excerpt = $4, updated_at = now() WHERE id = $5', [
      categoryId,
      input.title.trim(),
      input.content,
      makeExcerpt(input.content),
      postId,
    ]);
    const liked = !!(await this.db.one('SELECT 1 FROM post_likes WHERE post_id = $1 AND user_id = $2', [postId, userId]));
    return this.toDetail(await this.find(postId), userId, liked);
  }

  async remove(userId: number, postId: number) {
    const post = await this.db.one<{ authorId: number; channelId: number }>(
      'SELECT author_id AS "authorId", channel_id AS "channelId" FROM posts WHERE id = $1',
      [postId],
    );
    if (!post) throw notFound();
    // 작성자 본인, 또는 작성자보다 높은 채널 운영진이 지울 수 있다
    if (post.authorId !== userId) {
      const [role, authorRole] = await Promise.all([
        this.channels.roleOf(post.channelId, userId),
        this.channels.roleOf(post.channelId, post.authorId),
      ]);
      if (!canModerate(role, authorRole)) throw ApiError.forbidden();
    }
    await this.db.transaction(async () => {
      await this.db.execute('DELETE FROM posts WHERE id = $1', [postId]); // 댓글·좋아요는 FK ON DELETE CASCADE
      await this.db.execute('UPDATE channels SET post_count = post_count - 1 WHERE id = $1', [post.channelId]);
    });
    this.popularCache.clear();
    this.channels.popularCache.clear();
  }

  /** 여러 번 눌러도 결과가 같다. 동시에 두 번 눌려도 (post_id, user_id) unique + ON CONFLICT 가 막는다 */
  async like(userId: number, postId: number) {
    await this.ensureExists(postId);
    const likeCount = await this.db.transaction(async () => {
      const added = await this.db.execute(
        'INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT (post_id, user_id) DO NOTHING',
        [postId, userId],
      );
      return this.addLikeCount(postId, added);
    });
    return { liked: true, likeCount };
  }

  async unlike(userId: number, postId: number) {
    await this.ensureExists(postId);
    const likeCount = await this.db.transaction(async () => {
      const removed = await this.db.execute('DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2', [postId, userId]);
      return this.addLikeCount(postId, -removed);
    });
    return { liked: false, likeCount };
  }

  private async addLikeCount(postId: number, delta: number): Promise<number> {
    const row = await this.db.one<{ n: number }>('UPDATE posts SET like_count = like_count + $1 WHERE id = $2 RETURNING like_count AS n', [
      delta,
      postId,
    ]);
    return row!.n;
  }

  private async ensureExists(postId: number) {
    if (!(await this.db.one('SELECT 1 FROM posts WHERE id = $1', [postId]))) throw notFound();
  }

  private async find(postId: number): Promise<PostRow> {
    const row = await this.db.one<PostRow>(
      `SELECT p.id, p.author_id AS "authorId", a.nickname AS "authorNickname", p.channel_id AS "channelId",
              c.slug AS "channelSlug", c.name AS "channelName", c.icon_version AS "iconVersion", c.color AS "channelColor",
              p.category_id AS "categoryId", cat.name AS "categoryName", p.title, p.content,
              p.like_count AS "likeCount", p.comment_count AS "commentCount", p.view_count AS "viewCount",
              p.created_at AS "createdAt", p.updated_at AS "updatedAt"
       FROM posts p JOIN users a ON a.id = p.author_id JOIN channels c ON c.id = p.channel_id
       LEFT JOIN channel_categories cat ON cat.id = p.category_id
       WHERE p.id = $1`,
      [postId],
    );
    if (!row) throw notFound();
    return row;
  }

  /** canModerate: 보는 사람이 작성자보다 높은 채널 운영진이라 이 글을 지울 수 있는지 */
  private async toDetail(post: PostRow, viewerId: number | undefined, liked: boolean) {
    const [authorRole, viewerRole] = await Promise.all([
      this.channels.roleOf(post.channelId, post.authorId),
      this.channels.roleOf(post.channelId, viewerId),
    ]);
    const mine = viewerId === post.authorId;
    return {
      id: post.id,
      channel: { slug: post.channelSlug, name: post.channelName, iconVersion: post.iconVersion, color: post.channelColor },
      category: post.categoryId == null ? undefined : { id: post.categoryId, name: post.categoryName },
      title: post.title,
      content: post.content,
      author: { id: post.authorId, nickname: post.authorNickname, role: badge(authorRole) },
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      viewCount: post.viewCount,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      liked,
      mine,
      canModerate: viewerId != null && !mine && canModerate(viewerRole, authorRole),
    };
  }
}

export const notFound = () => ApiError.notFound('게시글을 찾을 수 없어요');

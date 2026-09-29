import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { escapeLike } from '../common/cursor-page';
import { TtlCache } from '../common/ttl-cache';
import { Database } from '../db/database';
import type { ChannelInput, ChannelUpdateInput } from './channels.dto';
import { badge, canManage, isStaff, type ChannelRole } from './roles';

export interface ChannelSummary {
  id: number;
  slug: string;
  name: string;
  description: string;
  postCount: number;
  memberCount: number;
  /** 0 보다 크면 프로필 이미지가 있다: /api/channels/{slug}/icon?v={iconVersion} */
  iconVersion: number;
}

export interface CategoryResponse {
  id: number;
  name: string;
  ownerOnly: boolean;
}

export interface ChannelRow extends ChannelSummary {
  ownerId: number | null;
  ownerNickname: string | null;
  createdAt: Date;
}

/** 목록용 채널 컬럼 (별칭 c) */
export const SUMMARY_COLUMNS = `c.id, c.slug, c.name, c.description, c.post_count AS "postCount",
  c.member_count AS "memberCount", c.icon_version AS "iconVersion"`;

const POPULAR_SIZE = 30;
const SEARCH_SIZE = 30;
/** 라우트와 겹치거나 오해를 부를 수 있는 고리는 막는다 */
const RESERVED = new Set(['new', 'all', 'admin', 'api', 'me', 'search', 'write', 'loop', 'previews']);

export const notFound = () => ApiError.notFound('채널을 찾을 수 없어요');

@Injectable()
export class ChannelsService {
  /** 홈과 채널 목록에 매번 노출되므로 짧게 캐시한다 (가입·글쓰기로 숫자가 바뀌면 비운다) */
  readonly popularCache = new TtlCache<ChannelSummary[]>(60_000);

  constructor(private readonly db: Database) {}

  popular(): Promise<ChannelSummary[]> {
    return this.popularCache.getOrLoad('*', () =>
      this.db.query(`SELECT ${SUMMARY_COLUMNS} FROM channels c ORDER BY c.post_count DESC, c.id ASC LIMIT $1`, [POPULAR_SIZE]),
    );
  }

  /** 채널 이름에 검색어가 들어간 채널. 이름이 검색어로 시작하는 채널을 먼저, 그다음 글이 많은 순 */
  search(keyword: string): Promise<ChannelSummary[]> {
    const escaped = escapeLike(keyword.trim().toLowerCase());
    return this.db.query(
      `SELECT ${SUMMARY_COLUMNS} FROM channels c
       WHERE lower(c.name) LIKE $1 ESCAPE '\\'
       ORDER BY CASE WHEN lower(c.name) LIKE $2 ESCAPE '\\' THEN 0 ELSE 1 END, c.post_count DESC, c.id ASC
       LIMIT $3`,
      [`%${escaped}%`, `${escaped}%`, SEARCH_SIZE],
    );
  }

  async findBySlug(slug: string): Promise<ChannelRow> {
    const row = await this.db.one<ChannelRow>(
      `SELECT ${SUMMARY_COLUMNS}, c.owner_id AS "ownerId", u.nickname AS "ownerNickname", c.created_at AS "createdAt"
       FROM channels c LEFT JOIN users u ON u.id = c.owner_id WHERE c.slug = $1`,
      [slug],
    );
    if (!row) throw notFound();
    return row;
  }

  /** 보는 사람의 역할 (가입하지 않았거나 로그인하지 않았으면 undefined) */
  async roleOf(channelId: number, userId: number | undefined | null): Promise<ChannelRole | undefined> {
    if (userId == null) return undefined;
    const row = await this.db.one<{ role: ChannelRole }>(
      'SELECT role FROM channel_members WHERE channel_id = $1 AND user_id = $2',
      [channelId, userId],
    );
    return row?.role;
  }

  /** 채널 관리(정보·프로필·카테고리)는 소유자와 관리자만 */
  async requireManager(slug: string, userId: number): Promise<ChannelRow> {
    const channel = await this.findBySlug(slug);
    if (!canManage(await this.roleOf(channel.id, userId))) throw ApiError.forbidden('채널 소유자와 관리자만 할 수 있어요');
    return channel;
  }

  categories(channelId: number): Promise<CategoryResponse[]> {
    return this.db.query(
      'SELECT id, name, owner_only AS "ownerOnly" FROM channel_categories WHERE channel_id = $1 ORDER BY position ASC, id ASC',
      [channelId],
    );
  }

  async detail(slug: string, viewerId?: number) {
    return this.toDetail(await this.findBySlug(slug), viewerId);
  }

  async create(userId: number, input: ChannelInput) {
    const slug = input.slug.trim().toLowerCase();
    const name = input.name.trim();
    if (RESERVED.has(slug) || (await this.db.one('SELECT 1 FROM channels WHERE slug = $1', [slug]))) {
      throw ApiError.conflict('이미 사용 중인 고리예요');
    }
    if (await this.db.one('SELECT 1 FROM channels WHERE name = $1', [name])) {
      throw ApiError.conflict('같은 이름의 채널이 이미 있어요');
    }
    await this.db.transaction(async () => {
      const channel = await this.db.one<{ id: number }>(
        'INSERT INTO channels (slug, name, description, owner_id, member_count) VALUES ($1, $2, $3, $4, 1) RETURNING id',
        [slug, name, (input.description ?? '').trim(), userId],
      );
      // 만든 사람은 자동으로 가입된다
      await this.db.execute("INSERT INTO channel_members (channel_id, user_id, role) VALUES ($1, $2, 'OWNER')", [channel!.id, userId]);
    });
    this.popularCache.clear();
    return this.detail(slug, userId);
  }

  async update(userId: number, slug: string, input: ChannelUpdateInput) {
    const channel = await this.requireManager(slug, userId);
    const name = input.name.trim();
    if (name !== channel.name && (await this.db.one('SELECT 1 FROM channels WHERE name = $1', [name]))) {
      throw ApiError.conflict('같은 이름의 채널이 이미 있어요');
    }
    await this.db.execute('UPDATE channels SET name = $1, description = $2 WHERE id = $3', [
      name,
      (input.description ?? '').trim(),
      channel.id,
    ]);
    this.popularCache.clear();
    return this.detail(slug, userId);
  }

  /**
   * joined: 가입했는지 (가입해야 글을 쓸 수 있다), mine: 소유자인지, myRole: 운영진 역할 (일반 멤버·비회원은 없음)
   * canManage: 채널 관리 가능, staff: 운영진 전용 카테고리에 글쓰기 가능
   */
  private async toDetail(c: ChannelRow, viewerId?: number) {
    const [role, bookmarked, categories] = await Promise.all([
      this.roleOf(c.id, viewerId),
      viewerId == null
        ? Promise.resolve(false)
        : this.db.one('SELECT 1 FROM channel_bookmarks WHERE channel_id = $1 AND user_id = $2', [c.id, viewerId]).then(Boolean),
      this.categories(c.id),
    ]);
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      postCount: c.postCount,
      memberCount: c.memberCount,
      iconVersion: c.iconVersion,
      ownerNickname: c.ownerNickname ?? undefined,
      createdAt: c.createdAt,
      mine: role === 'OWNER',
      myRole: badge(role),
      canManage: canManage(role),
      staff: isStaff(role),
      joined: role !== undefined,
      bookmarked,
      categories,
    };
  }
}

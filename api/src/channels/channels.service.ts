import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { escapeLike } from '../common/cursor-page';
import { TtlCache } from '../common/ttl-cache';
import { Database } from '../db/database';
import { RewardsService } from '../users/rewards.service';
import { CHANNEL_COLOR_COUNT, type ChannelInput, type ChannelUpdateInput } from './channels.dto';
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
  /** 이미지가 없을 때 프로필 색 번호 (null 이면 고리로 정한 색) */
  color: number | null;
  /** public: 누구나 / private: 초대 코드로만 팔로우, 팔로워만 볼 수 있다 */
  visibility: Visibility;
  /** 만 19세 이상만 볼 수 있다 */
  adult: boolean;
}

export type Visibility = 'public' | 'private';

/** 볼 수 없는 채널을 열었을 때: 비공개(초대 필요) · 19세 이상(나이 확인 필요) */
export type Locked = 'private' | 'adult';

export interface CategoryResponse {
  id: number;
  name: string;
  ownerOnly: boolean;
  adult: boolean;
}

export interface ChannelRow extends ChannelSummary {
  ownerId: number | null;
  ownerNickname: string | null;
  createdAt: Date;
}

/** 목록용 채널 컬럼 (별칭 c) */
export const SUMMARY_COLUMNS = `c.id, c.slug, c.name, c.description, c.post_count AS "postCount",
  c.member_count AS "memberCount", c.icon_version AS "iconVersion", c.color, c.visibility, c.adult`;

/** 초대 코드: 헷갈리는 글자(0 O 1 I L)를 뺀 대문자·숫자 8자 */
const INVITE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const newInviteCode = () =>
  Array.from(randomBytes(8), (b) => INVITE_CHARS[b % INVITE_CHARS.length]).join('');

const POPULAR_SIZE = 30;
const SEARCH_SIZE = 30;
/** 라우트와 겹치거나 오해를 부를 수 있는 고리는 막는다 */
const RESERVED = new Set(['new', 'all', 'admin', 'api', 'me', 'search', 'write', 'loop', 'previews']);

export const notFound = () => ApiError.notFound('채널을 찾을 수 없어요');

@Injectable()
export class ChannelsService {
  /** 홈과 채널 목록에 매번 노출되므로 짧게 캐시한다 (가입·글쓰기로 숫자가 바뀌면 비운다) */
  readonly popularCache = new TtlCache<ChannelSummary[]>(60_000);

  constructor(
    private readonly db: Database,
    private readonly rewards: RewardsService,
  ) {}

  /**
   * 인기 채널. 비공개 채널은 목록·검색에 나오지 않고(초대로만), 19세 이상 채널은 나이를 확인한 사람에게만 보인다.
   * 모든 방문자가 같은 결과를 보므로 성인/일반 두 가지로만 캐시한다.
   */
  popular(adult = false): Promise<ChannelSummary[]> {
    return this.popularCache.getOrLoad(adult ? 'adult' : '*', () =>
      this.db.query(
        `SELECT ${SUMMARY_COLUMNS} FROM channels c WHERE c.visibility = 'public' AND ($2 OR NOT c.adult)
         ORDER BY c.post_count DESC, c.id ASC LIMIT $1`,
        [POPULAR_SIZE, adult],
      ),
    );
  }

  /** 채널 이름에 검색어가 들어간 채널. 이름이 검색어로 시작하는 채널을 먼저, 그다음 글이 많은 순 */
  search(keyword: string, adult = false): Promise<ChannelSummary[]> {
    const escaped = escapeLike(keyword.trim().toLowerCase());
    return this.db.query(
      `SELECT ${SUMMARY_COLUMNS} FROM channels c
       WHERE lower(c.name) LIKE $1 ESCAPE '\\' AND c.visibility = 'public' AND ($4 OR NOT c.adult)
       ORDER BY CASE WHEN lower(c.name) LIKE $2 ESCAPE '\\' THEN 0 ELSE 1 END, c.post_count DESC, c.id ASC
       LIMIT $3`,
      [`%${escaped}%`, `${escaped}%`, SEARCH_SIZE, adult],
    );
  }

  /** 만 19세 이상인지 (설정에서 생년월일로 나이를 확인한 사람만) */
  async isAdult(userId: number | undefined | null): Promise<boolean> {
    if (userId == null) return false;
    const row = await this.db.one<{ adult: boolean }>(
      "SELECT birth_date <= (current_date - interval '19 years') AS adult FROM users WHERE id = $1",
      [userId],
    );
    return !!row?.adult;
  }

  /** 이 채널을 볼 수 없으면 그 이유 (비공개인데 팔로워가 아님 / 19세 이상인데 나이 확인 안 됨) */
  async lockOf(c: ChannelRow, viewerId: number | undefined, role?: ChannelRole | null): Promise<Locked | undefined> {
    if (c.adult && !(await this.isAdult(viewerId))) return 'adult';
    if (c.visibility === 'private') {
      const r = role === undefined ? await this.roleOf(c.id, viewerId) : role;
      if (!r) return 'private';
    }
    return undefined;
  }

  /** 채널 안 글을 보기 전에: 볼 수 없으면 403 */
  async requireAccess(c: ChannelRow, viewerId: number | undefined) {
    const locked = await this.lockOf(c, viewerId);
    if (locked === 'adult') throw ApiError.forbidden('만 19세 이상만 볼 수 있는 채널이에요. 설정에서 나이를 확인해 주세요');
    if (locked === 'private') throw ApiError.forbidden('비공개 채널이에요. 초대를 받아 팔로우한 사람만 볼 수 있어요');
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
      'SELECT id, name, owner_only AS "ownerOnly", adult FROM channel_categories WHERE channel_id = $1 ORDER BY position ASC, id ASC',
      [channelId],
    );
  }

  async detail(slug: string, viewerId?: number) {
    return this.toDetail(await this.findBySlug(slug), viewerId);
  }

  async create(userId: number, input: ChannelInput) {
    const slug = input.slug.trim().toLowerCase();
    const name = input.name.trim();
    if (input.adult && !(await this.isAdult(userId))) throw ApiError.forbidden('19세 이상 채널은 나이를 확인한 사람만 만들 수 있어요');
    if (RESERVED.has(slug) || (await this.db.one('SELECT 1 FROM channels WHERE slug = $1', [slug]))) {
      throw ApiError.conflict('이미 사용 중인 고리예요');
    }
    if (await this.db.one('SELECT 1 FROM channels WHERE name = $1', [name])) {
      throw ApiError.conflict('같은 이름의 채널이 이미 있어요');
    }
    await this.db.transaction(async () => {
      const channel = await this.db.one<{ id: number }>(
        `INSERT INTO channels (slug, name, description, owner_id, member_count, color, visibility, adult, invite_code)
         VALUES ($1, $2, $3, $4, 1, $5, $6, $7, $8) RETURNING id`,
        [
          slug,
          name,
          (input.description ?? '').trim(),
          userId,
          input.color ?? Math.floor(Math.random() * CHANNEL_COLOR_COUNT),
          input.visibility ?? 'public',
          !!input.adult,
          newInviteCode(),
        ],
      );
      // 만든 사람은 자동으로 가입된다
      await this.db.execute("INSERT INTO channel_members (channel_id, user_id, role) VALUES ($1, $2, 'OWNER')", [channel!.id, userId]);
    });
    this.popularCache.clear();
    await this.rewards.checkBadges(userId);
    return this.detail(slug, userId);
  }

  async update(userId: number, slug: string, input: ChannelUpdateInput) {
    const channel = await this.requireManager(slug, userId);
    const name = input.name.trim();
    if (name !== channel.name && (await this.db.one('SELECT 1 FROM channels WHERE name = $1', [name]))) {
      throw ApiError.conflict('같은 이름의 채널이 이미 있어요');
    }
    if (input.adult && !channel.adult && !(await this.isAdult(userId))) {
      throw ApiError.forbidden('19세 이상 채널은 나이를 확인한 사람만 설정할 수 있어요');
    }
    await this.db.execute(
      `UPDATE channels SET name = $1, description = $2, color = COALESCE($4, color),
         visibility = COALESCE($5, visibility), adult = COALESCE($6, adult),
         invite_code = COALESCE(invite_code, $7)
       WHERE id = $3`,
      [name, (input.description ?? '').trim(), channel.id, input.color ?? null, input.visibility ?? null, input.adult ?? null, newInviteCode()],
    );
    this.popularCache.clear();
    return this.detail(slug, userId);
  }

  /**
   * joined: 가입했는지 (가입해야 글을 쓸 수 있다), mine: 소유자인지, myRole: 운영진 역할 (일반 멤버·비회원은 없음)
   * canManage: 채널 관리 가능, staff: 운영진 전용 카테고리에 글쓰기 가능
   */
  /** 초대 코드 새로 만들기 (예전 링크·코드·QR 은 더 이상 쓸 수 없다) */
  async regenerateInvite(userId: number, slug: string) {
    const channel = await this.requireManager(slug, userId);
    const code = newInviteCode();
    await this.db.execute('UPDATE channels SET invite_code = $1 WHERE id = $2', [code, channel.id]);
    return { inviteCode: code };
  }

  /** 초대 코드로 채널 찾기 (초대 화면: 이름·프로필·팔로워 수만) */
  async byInvite(code: string): Promise<ChannelRow> {
    const row = await this.db.one<ChannelRow>(
      `SELECT ${SUMMARY_COLUMNS}, c.owner_id AS "ownerId", NULL AS "ownerNickname", c.created_at AS "createdAt"
       FROM channels c WHERE c.invite_code = $1`,
      [code.trim().toUpperCase()],
    );
    if (!row) throw ApiError.notFound('초대 코드가 맞지 않거나 바뀌었어요');
    return row;
  }

  private async toDetail(c: ChannelRow, viewerId?: number) {
    const role = await this.roleOf(c.id, viewerId);
    const locked = await this.lockOf(c, viewerId, role ?? null);
    // 볼 수 없는 채널: 이름·프로필만 (소개·카테고리·글은 숨긴다)
    if (locked) {
      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        description: '',
        postCount: c.postCount,
        memberCount: c.memberCount,
        iconVersion: c.iconVersion,
        color: c.color,
        visibility: c.visibility,
        adult: c.adult,
        locked,
        createdAt: c.createdAt,
        mine: false,
        canManage: false,
        staff: false,
        joined: false,
        bookmarked: false,
        categories: [],
      };
    }
    const adultViewer = c.adult || (await this.isAdult(viewerId));
    const [bookmarked, allCategories, invite] = await Promise.all([
      viewerId == null
        ? Promise.resolve(false)
        : this.db.one('SELECT 1 FROM channel_bookmarks WHERE channel_id = $1 AND user_id = $2', [c.id, viewerId]).then(Boolean),
      this.categories(c.id),
      canManage(role) ? this.db.one<{ code: string | null }>('SELECT invite_code AS code FROM channels WHERE id = $1', [c.id]) : undefined,
    ]);
    // 19세 이상 카테고리는 나이를 확인한 사람(과 관리자)에게만
    const categories = adultViewer || canManage(role) ? allCategories : allCategories.filter((cat) => !cat.adult);
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      postCount: c.postCount,
      memberCount: c.memberCount,
      iconVersion: c.iconVersion,
      color: c.color,
      visibility: c.visibility,
      adult: c.adult,
      /** 운영진(관리)에게만: 초대 코드 */
      inviteCode: invite?.code ?? undefined,
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

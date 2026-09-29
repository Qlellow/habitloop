import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { Database } from '../db/database';
import type { CategoryInput } from './channels.dto';
import { ChannelsService, type CategoryResponse, type ChannelRow } from './channels.service';
import { isStaff } from './roles';

export const MAX_CATEGORIES = 20;

interface CategoryRow {
  id: number;
  channelId: number;
  name: string;
  ownerOnly: boolean;
}

/** 채널 안 카테고리. 모든 응답은 바뀐 뒤의 전체 목록이라, 클라이언트는 그대로 캐시에 덮어쓰면 된다. */
@Injectable()
export class CategoriesService {
  constructor(
    private readonly db: Database,
    private readonly channels: ChannelsService,
  ) {}

  async create(userId: number, slug: string, input: CategoryInput): Promise<CategoryResponse[]> {
    const channel = await this.channels.requireManager(slug, userId);
    const name = input.name.trim();
    const count = await this.db.one<{ n: number }>('SELECT count(*)::int AS n FROM channel_categories WHERE channel_id = $1', [channel.id]);
    if (count!.n >= MAX_CATEGORIES) throw ApiError.badRequest(`카테고리는 ${MAX_CATEGORIES}개까지 만들 수 있어요`);
    if (await this.db.one('SELECT 1 FROM channel_categories WHERE channel_id = $1 AND name = $2', [channel.id, name])) {
      throw ApiError.conflict('같은 이름의 카테고리가 이미 있어요');
    }
    await this.db.execute(
      `INSERT INTO channel_categories (channel_id, name, owner_only, position)
       SELECT $1, $2, $3, coalesce(max(position), -1) + 1 FROM channel_categories WHERE channel_id = $1`,
      [channel.id, name, !!input.ownerOnly],
    );
    return this.channels.categories(channel.id);
  }

  async update(userId: number, slug: string, categoryId: number, input: CategoryInput): Promise<CategoryResponse[]> {
    const channel = await this.channels.requireManager(slug, userId);
    const category = await this.find(channel, categoryId);
    const name = input.name.trim();
    if (name !== category.name && (await this.db.one('SELECT 1 FROM channel_categories WHERE channel_id = $1 AND name = $2', [channel.id, name]))) {
      throw ApiError.conflict('같은 이름의 카테고리가 이미 있어요');
    }
    await this.db.execute('UPDATE channel_categories SET name = $1, owner_only = $2 WHERE id = $3', [name, !!input.ownerOnly, category.id]);
    return this.channels.categories(channel.id);
  }

  /** 카테고리만 지우고 글은 남긴다 (posts.category_id 는 FK ON DELETE SET NULL) */
  async remove(userId: number, slug: string, categoryId: number): Promise<CategoryResponse[]> {
    const channel = await this.channels.requireManager(slug, userId);
    const category = await this.find(channel, categoryId);
    await this.db.execute('DELETE FROM channel_categories WHERE id = $1', [category.id]);
    return this.channels.categories(channel.id);
  }

  /** ids 순서대로 position 을 다시 매긴다. 채널의 카테고리를 빠짐없이 한 번씩 보내야 한다. */
  async reorder(userId: number, slug: string, ids: number[]): Promise<CategoryResponse[]> {
    const channel = await this.channels.requireManager(slug, userId);
    const current = new Set((await this.channels.categories(channel.id)).map((c) => c.id));
    const requested = new Set(ids);
    if (ids.length !== current.size || requested.size !== ids.length || [...requested].some((id) => !current.has(id))) {
      throw ApiError.badRequest('카테고리 목록이 바뀌었어요. 새로고침 후 다시 시도해 주세요');
    }
    // 한 번의 UPDATE 로: unnest(ids) WITH ORDINALITY 가 새 순서
    await this.db.execute(
      `UPDATE channel_categories c SET position = o.pos - 1
       FROM unnest($1::int[]) WITH ORDINALITY AS o(id, pos)
       WHERE c.id = o.id AND c.channel_id = $2`,
      [ids, channel.id],
    );
    return this.channels.categories(channel.id);
  }

  /**
   * 글을 쓸 때 고른 카테고리가 그 채널 것인지, 운영진 전용이면 쓰는 사람이 운영진인지 확인한다.
   * categoryId 가 없으면 카테고리 없이 쓴다.
   */
  async resolveForPost(channel: { id: number }, categoryId: number | null | undefined, userId: number): Promise<number | null> {
    if (categoryId == null) return null;
    const category = await this.db.one<CategoryRow>(
      'SELECT id, channel_id AS "channelId", name, owner_only AS "ownerOnly" FROM channel_categories WHERE id = $1',
      [categoryId],
    );
    if (!category || category.channelId !== channel.id) throw ApiError.badRequest('이 채널에 없는 카테고리예요');
    if (category.ownerOnly && !isStaff(await this.channels.roleOf(channel.id, userId))) {
      throw ApiError.forbidden(`'${category.name}' 카테고리는 채널 운영진만 쓸 수 있어요`);
    }
    return category.id;
  }

  private async find(channel: ChannelRow, categoryId: number): Promise<CategoryRow> {
    const category = await this.db.one<CategoryRow>(
      'SELECT id, channel_id AS "channelId", name, owner_only AS "ownerOnly" FROM channel_categories WHERE id = $1',
      [categoryId],
    );
    if (!category || category.channelId !== channel.id) throw ApiError.notFound('카테고리를 찾을 수 없어요');
    return category;
  }
}

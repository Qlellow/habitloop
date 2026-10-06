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
      `INSERT INTO channel_categories (channel_id, name, owner_only, adult, position)
       SELECT $1, $2, $3, $4, coalesce(max(position), -1) + 1 FROM channel_categories WHERE channel_id = $1`,
      [channel.id, name, !!input.ownerOnly, !!input.adult],
    );
    // 운영진 전용은 운영진 전용 카테고리 중 맨 아래(= 일반 카테고리 바로 위)로, 일반은 맨 아래로
    await this.normalize(channel.id);
    return this.channels.categories(channel.id);
  }

  async update(userId: number, slug: string, categoryId: number, input: CategoryInput): Promise<CategoryResponse[]> {
    const channel = await this.channels.requireManager(slug, userId);
    const category = await this.find(channel, categoryId);
    const name = input.name.trim();
    if (name !== category.name && (await this.db.one('SELECT 1 FROM channel_categories WHERE channel_id = $1 AND name = $2', [channel.id, name]))) {
      throw ApiError.conflict('같은 이름의 카테고리가 이미 있어요');
    }
    await this.db.execute('UPDATE channel_categories SET name = $1, owner_only = $2, adult = $3 WHERE id = $4', [
      name,
      !!input.ownerOnly,
      !!input.adult,
      category.id,
    ]);
    await this.normalize(channel.id);
    return this.channels.categories(channel.id);
  }

  /**
   * 카테고리를 지운다. 글은 지우지 않고 moveTo 카테고리로 옮긴다.
   * 카테고리가 있는 채널의 글은 카테고리가 꼭 있어야 하므로, 글이 있고 다른 카테고리가 남는다면 옮길 곳을 골라야 한다.
   * 마지막 카테고리면 채널에 카테고리가 없어지므로 글은 카테고리 없이 남는다 (posts.category_id 는 FK ON DELETE SET NULL).
   */
  async remove(userId: number, slug: string, categoryId: number, moveTo?: number): Promise<CategoryResponse[]> {
    const channel = await this.channels.requireManager(slug, userId);
    const category = await this.find(channel, categoryId);
    await this.db.transaction(async () => {
      const posts = await this.db.one<{ n: number }>('SELECT count(*)::int AS n FROM posts WHERE category_id = $1', [category.id]);
      const others = await this.db.one<{ n: number }>('SELECT count(*)::int AS n FROM channel_categories WHERE channel_id = $1 AND id <> $2', [
        channel.id,
        category.id,
      ]);
      if (posts!.n > 0 && others!.n > 0) {
        if (moveTo == null) throw ApiError.badRequest('이 카테고리의 글을 옮길 카테고리를 골라 주세요');
        if (moveTo === category.id) throw ApiError.badRequest('지우는 카테고리로는 옮길 수 없어요');
        const target = await this.find(channel, moveTo);
        await this.db.execute('UPDATE posts SET category_id = $1 WHERE category_id = $2', [target.id, category.id]);
      }
      await this.db.execute('DELETE FROM channel_categories WHERE id = $1', [category.id]);
    });
    return this.channels.categories(channel.id);
  }

  /** 카테고리별 글 수 (삭제 창에서 옮길 글이 몇 개인지 보여 준다) */
  async postCounts(userId: number, slug: string): Promise<Record<number, number>> {
    const channel = await this.channels.requireManager(slug, userId);
    const rows = await this.db.query<{ id: number; n: number }>(
      'SELECT category_id AS id, count(*)::int AS n FROM posts WHERE channel_id = $1 AND category_id IS NOT NULL GROUP BY category_id',
      [channel.id],
    );
    return Object.fromEntries(rows.map((r) => [r.id, r.n]));
  }

  /**
   * 운영진 전용 카테고리는 항상 일반 카테고리보다 위에 둔다. 각 무리 안에서는 지금 순서를 그대로 지킨다.
   * (새로 만든 운영진 전용 카테고리는 position 이 가장 크므로 운영진 전용 무리의 맨 아래로 간다)
   */
  private async normalize(channelId: number) {
    await this.db.execute(
      `UPDATE channel_categories c SET position = o.rn - 1
       FROM (SELECT id, row_number() OVER (ORDER BY owner_only DESC, position, id) AS rn FROM channel_categories WHERE channel_id = $1) o
       WHERE c.id = o.id`,
      [channelId],
    );
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
    // 운영진 전용을 일반 카테고리 아래로 옮겼더라도 다시 위로
    await this.normalize(channel.id);
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

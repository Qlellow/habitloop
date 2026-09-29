import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { Database } from '../db/database';
import { ChannelsService } from './channels.service';

export const MAX_ICON_BYTES = 512 * 1024;
const TYPES = new Set(['image/webp', 'image/png', 'image/jpeg']);

/**
 * 채널 프로필 이미지. 브라우저가 정사각형으로 자르고 작게 줄여서(256px) 올리므로 서버는 형식과 크기만 확인한다.
 * 이미지 주소에 버전(?v=)이 붙어 있어 한 번 받은 이미지는 1년 동안 캐시된다.
 */
@Injectable()
export class IconsService {
  constructor(
    private readonly db: Database,
    private readonly channels: ChannelsService,
  ) {}

  async get(slug: string): Promise<{ contentType: string; data: Buffer }> {
    const row = await this.db.one<{ contentType: string; data: Uint8Array }>(
      `SELECT i.content_type AS "contentType", i.data FROM channels c JOIN channel_icons i ON i.channel_id = c.id
       WHERE c.slug = $1 AND c.icon_version > 0`,
      [slug],
    );
    if (!row) {
      await this.channels.findBySlug(slug); // 채널이 없으면 채널 404
      throw ApiError.notFound('프로필 이미지가 없어요');
    }
    return { contentType: row.contentType, data: Buffer.from(row.data) };
  }

  /** 새 버전 번호를 돌려준다 */
  async upload(userId: number, slug: string, contentType: string | undefined, data: unknown): Promise<number> {
    const channel = await this.channels.requireManager(slug, userId);
    const type = (contentType ?? '').split(';')[0].trim().toLowerCase();
    if (!TYPES.has(type)) throw ApiError.badRequest('PNG, JPG, WEBP 이미지만 올릴 수 있어요');
    if (!Buffer.isBuffer(data) || data.length === 0) throw ApiError.badRequest('이미지를 골라 주세요');
    if (data.length > MAX_ICON_BYTES) throw ApiError.badRequest('이미지는 512KB 이하로 올려 주세요');
    const version = await this.db.transaction(async () => {
      await this.db.execute(
        `INSERT INTO channel_icons (channel_id, content_type, data) VALUES ($1, $2, $3)
         ON CONFLICT (channel_id) DO UPDATE SET content_type = EXCLUDED.content_type, data = EXCLUDED.data`,
        [channel.id, type, data],
      );
      // 올리면 버전을 올리고(양수), 지우면 부호만 바꾼다(음수)
      const row = await this.db.one<{ v: number }>(
        'UPDATE channels SET icon_version = abs(icon_version) + 1 WHERE id = $1 RETURNING icon_version AS v',
        [channel.id],
      );
      return row!.v;
    });
    this.channels.popularCache.clear();
    return version;
  }

  async remove(userId: number, slug: string) {
    const channel = await this.channels.requireManager(slug, userId);
    await this.db.transaction(async () => {
      await this.db.execute('DELETE FROM channel_icons WHERE channel_id = $1', [channel.id]);
      await this.db.execute('UPDATE channels SET icon_version = -abs(icon_version) WHERE id = $1', [channel.id]);
    });
    this.channels.popularCache.clear();
  }
}

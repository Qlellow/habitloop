import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { Database } from '../db/database';

/** 본문 이미지 한 장 최대 크기. 브라우저가 긴 변 1920px WebP 로 줄여서 올리므로 보통 수백 KB 다 */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const TYPES = new Set(['image/webp', 'image/png', 'image/jpeg', 'image/gif']);
/** 한 사람이 한 시간에 올릴 수 있는 장수 */
const HOURLY_LIMIT = 60;

/**
 * 글 본문에 넣는 이미지. 한 번 올린 이미지는 바뀌지 않으므로(편집은 주소 뒤 #설정으로만 한다)
 * 무작위 id 주소로 1년 동안 캐시된다. 자르기·크기·모서리 같은 편집은 원본을 건드리지 않는다.
 */
@Injectable()
export class ImagesService {
  constructor(private readonly db: Database) {}

  async upload(userId: number, contentType: string | undefined, data: unknown) {
    const type = (contentType ?? '').split(';')[0].trim().toLowerCase();
    if (!TYPES.has(type)) throw ApiError.badRequest('PNG, JPG, WEBP, GIF 이미지만 올릴 수 있어요');
    if (!Buffer.isBuffer(data) || data.length === 0) throw ApiError.badRequest('이미지를 골라 주세요');
    if (data.length > MAX_IMAGE_BYTES) throw ApiError.badRequest('이미지는 3MB 이하로 올려 주세요');
    const recent = await this.db.one<{ n: number }>(
      "SELECT count(*)::int AS n FROM images WHERE owner_id = $1 AND created_at > now() - interval '1 hour'",
      [userId],
    );
    if (recent!.n >= HOURLY_LIMIT) throw ApiError.tooMany('이미지를 너무 많이 올렸어요. 잠시 후 다시 시도해 주세요');
    const id = randomBytes(16).toString('base64url');
    await this.db.execute('INSERT INTO images (id, owner_id, content_type, data) VALUES ($1, $2, $3, $4)', [id, userId, type, data]);
    return { id, url: `/api/images/${id}` };
  }

  async get(id: string): Promise<{ contentType: string; data: Buffer }> {
    if (!/^[A-Za-z0-9_-]{16,32}$/.test(id)) throw ApiError.notFound('이미지가 없어요');
    const row = await this.db.one<{ contentType: string; data: Uint8Array }>(
      'SELECT content_type AS "contentType", data FROM images WHERE id = $1',
      [id],
    );
    if (!row) throw ApiError.notFound('이미지가 없어요');
    return { contentType: row.contentType, data: Buffer.from(row.data) };
  }
}

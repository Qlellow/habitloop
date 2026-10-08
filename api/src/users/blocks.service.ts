import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { Database } from '../db/database';

/**
 * 글 목록 SQL 에 붙이는 조건: $n(보는 사람)이 차단한 사람의 글은 뺀다. 비로그인($n 이 NULL)이면 아무것도 빼지 않는다.
 * p 는 posts 별칭
 */
export const notBlockedPost = (param: string) =>
  `NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE ub.blocker_id = ${param} AND ub.blocked_id = p.author_id)`;

export interface BlockedUser {
  id: string;
  nickname: string;
  avatarUrl?: string;
  blockedAt: Date;
}

/** 사용자 차단: 차단은 나에게만 영향이 있고, 상대에게 알리지 않는다 */
@Injectable()
export class BlocksService {
  constructor(private readonly db: Database) {}

  async block(userId: number, targetUid: string) {
    const target = await this.find(targetUid);
    if (target === userId) throw ApiError.badRequest('나는 차단할 수 없어요');
    await this.db.execute('INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, target]);
  }

  async unblock(userId: number, targetUid: string) {
    const target = await this.find(targetUid);
    await this.db.execute('DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2', [userId, target]);
  }

  /** 내가 차단한 사람들 (최근에 차단한 순) */
  async list(userId: number): Promise<BlockedUser[]> {
    const rows = await this.db.query<{ id: string; nickname: string; avatarUrl: string | null; blockedAt: Date }>(
      `SELECT u.uid::text AS id, u.nickname, CASE WHEN u.avatar_id IS NULL THEN NULL ELSE '/api/images/' || u.avatar_id END AS "avatarUrl",
              b.created_at AS "blockedAt"
       FROM user_blocks b JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id = $1 ORDER BY b.created_at DESC`,
      [userId],
    );
    return rows.map((r) => ({ ...r, avatarUrl: r.avatarUrl ?? undefined }));
  }

  /** viewer 가 차단한 사람 중 userIds 에 든 사람 (내부 id) */
  async blockedAmong(viewerId: number | undefined, userIds: number[]): Promise<Set<number>> {
    if (viewerId == null || userIds.length === 0) return new Set();
    const rows = await this.db.query<{ id: number }>(
      'SELECT blocked_id AS id FROM user_blocks WHERE blocker_id = $1 AND blocked_id = ANY($2::int[])',
      [viewerId, userIds],
    );
    return new Set(rows.map((r) => r.id));
  }

  /** viewer 가 차단한 사람들의 UUID (캐시된 인기글처럼 SQL 로 거를 수 없는 목록용) */
  async blockedUids(viewerId: number | undefined): Promise<Set<string>> {
    if (viewerId == null) return new Set();
    const rows = await this.db.query<{ uid: string }>(
      'SELECT u.uid::text AS uid FROM user_blocks b JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id = $1',
      [viewerId],
    );
    return new Set(rows.map((r) => r.uid));
  }

  async isBlocked(viewerId: number | undefined, userId: number) {
    return (await this.blockedAmong(viewerId, [userId])).has(userId);
  }

  private async find(uid: string): Promise<number> {
    const row = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid)
      ? await this.db.one<{ id: number }>('SELECT id FROM users WHERE uid::text = $1 AND withdrawn_at IS NULL', [uid.toLowerCase()])
      : undefined;
    if (!row) throw ApiError.notFound('없는 사용자예요');
    return row.id;
  }
}

import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { Database } from '../db/database';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * 사용자 팔로우: 좋아하는 작성자를 팔로우하면 홈의 '팔로우한 사람 새 글'에 그 사람 글이 모인다.
 * 팔로우하면 상대에게 알림이 간다 (차단한 사이는 팔로우할 수 없다)
 */
const UID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIST_SIZE = 100;

export interface FollowUser {
  id: string;
  nickname: string;
  avatarUrl?: string;
}

@Injectable()
export class FollowsService {
  constructor(
    private readonly db: Database,
    private readonly notifications: NotificationsService,
  ) {}

  async idOf(uid: string): Promise<number> {
    const row = UID.test(uid)
      ? await this.db.one<{ id: number }>('SELECT id FROM users WHERE uid::text = $1 AND withdrawn_at IS NULL', [uid.toLowerCase()])
      : undefined;
    if (!row) throw ApiError.notFound('없는 사용자예요');
    return row.id;
  }

  async follow(userId: number, uid: string, on: boolean) {
    const target = await this.idOf(uid);
    if (target === userId) throw ApiError.badRequest('나 자신은 팔로우할 수 없어요');
    if (on) {
      const blocked = await this.db.one('SELECT 1 FROM user_blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)', [
        userId,
        target,
      ]);
      if (blocked) throw ApiError.forbidden('팔로우할 수 없는 사용자예요');
      const added = await this.db.execute('INSERT INTO user_follows (follower_id, followee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, target]);
      if (added) await this.notifications.followed(target, userId);
    } else {
      await this.db.execute('DELETE FROM user_follows WHERE follower_id = $1 AND followee_id = $2', [userId, target]);
    }
    return { following: on, ...(await this.counts(target)) };
  }

  async counts(userId: number) {
    const row = await this.db.one<{ followers: number; following: number }>(
      `SELECT (SELECT count(*)::int FROM user_follows WHERE followee_id = $1) AS followers,
              (SELECT count(*)::int FROM user_follows WHERE follower_id = $1) AS following`,
      [userId],
    );
    return { followerCount: row?.followers ?? 0, followingCount: row?.following ?? 0 };
  }

  async isFollowing(viewerId: number | undefined, userId: number) {
    if (viewerId == null || viewerId === userId) return false;
    return !!(await this.db.one('SELECT 1 FROM user_follows WHERE follower_id = $1 AND followee_id = $2', [viewerId, userId]));
  }

  /** 팔로워 · 팔로잉 목록 (최근 순 100명) */
  async list(uid: string, kind: 'followers' | 'following'): Promise<FollowUser[]> {
    const id = await this.idOf(uid);
    const [mine, other] = kind === 'followers' ? ['followee_id', 'follower_id'] : ['follower_id', 'followee_id'];
    const rows = await this.db.query<{ id: string; nickname: string; avatarUrl: string | null }>(
      `SELECT u.uid::text AS id, u.nickname, CASE WHEN u.avatar_id IS NULL THEN NULL ELSE '/api/images/' || u.avatar_id END AS "avatarUrl"
       FROM user_follows f JOIN users u ON u.id = f.${other}
       WHERE f.${mine} = $1 AND u.withdrawn_at IS NULL ORDER BY f.created_at DESC LIMIT ${LIST_SIZE}`,
      [id],
    );
    return rows.map((r) => ({ ...r, avatarUrl: r.avatarUrl ?? undefined }));
  }
}

import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { escapeLike } from '../common/cursor-page';
import { Database } from '../db/database';
import { ChannelsService, type ChannelRow } from './channels.service';
import { isStaff, type ChannelRole } from './roles';

export interface StaffMember {
  userId: number;
  nickname: string;
  role: ChannelRole;
}

const SEARCH_SIZE = 10;
/** 한 채널의 운영진(소유자 제외) 최대 인원 */
const MAX_STAFF = 20;

const STAFF_ORDER = `CASE m.role WHEN 'OWNER' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END, m.id ASC`;

/** 채널 운영진(관리자·매니저) 지정. 지정과 해제는 소유자만 할 수 있다. */
@Injectable()
export class StaffService {
  constructor(
    private readonly db: Database,
    private readonly channels: ChannelsService,
  ) {}

  /** 운영진 (소유자 → 관리자 → 매니저, 같은 역할이면 먼저 가입한 순) */
  async staff(slug: string): Promise<StaffMember[]> {
    return this.findStaff((await this.channels.findBySlug(slug)).id);
  }

  private findStaff(channelId: number): Promise<StaffMember[]> {
    return this.db.query(
      `SELECT u.id AS "userId", u.nickname, m.role FROM channel_members m JOIN users u ON u.id = m.user_id
       WHERE m.channel_id = $1 AND m.role <> 'MEMBER' ORDER BY ${STAFF_ORDER}`,
      [channelId],
    );
  }

  /** 운영진으로 지정할 멤버를 닉네임으로 찾는다 (소유자만) */
  async searchMembers(userId: number | undefined, slug: string, keyword?: string): Promise<StaffMember[]> {
    const channel = await this.requireOwner(userId, slug);
    const escaped = escapeLike((keyword ?? '').trim().toLowerCase());
    if (!escaped) return [];
    return this.db.query(
      `SELECT u.id AS "userId", u.nickname, m.role FROM channel_members m JOIN users u ON u.id = m.user_id
       WHERE m.channel_id = $1 AND lower(u.nickname) LIKE $2 ESCAPE '\\' ORDER BY m.id ASC LIMIT $3`,
      [channel.id, `%${escaped}%`, SEARCH_SIZE],
    );
  }

  /** 멤버의 역할을 관리자·매니저·일반 멤버로 바꾼다. 여러 번 보내도 결과가 같다 */
  async changeRole(userId: number, slug: string, targetUserId: number, role: ChannelRole): Promise<StaffMember[]> {
    const channel = await this.requireOwner(userId, slug);
    if (role === 'OWNER') throw ApiError.badRequest('소유자는 넘길 수 없어요');
    const current = await this.channels.roleOf(channel.id, targetUserId);
    if (!current) throw ApiError.badRequest('채널에 가입한 사람만 운영진으로 지정할 수 있어요');
    if (current === 'OWNER') throw ApiError.badRequest('소유자의 역할은 바꿀 수 없어요');
    if (isStaff(role) && !isStaff(current) && (await this.findStaff(channel.id)).length > MAX_STAFF) {
      throw ApiError.badRequest(`운영진은 ${MAX_STAFF}명까지 지정할 수 있어요`);
    }
    await this.db.execute('UPDATE channel_members SET role = $1 WHERE channel_id = $2 AND user_id = $3', [
      role,
      channel.id,
      targetUserId,
    ]);
    return this.findStaff(channel.id);
  }

  private async requireOwner(userId: number | undefined, slug: string): Promise<ChannelRow> {
    const channel = await this.channels.findBySlug(slug);
    if (userId == null || channel.ownerId !== userId) throw ApiError.forbidden('운영진은 채널 소유자만 지정할 수 있어요');
    return channel;
  }
}

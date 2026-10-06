import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { Database } from '../db/database';
import { RewardsService } from '../users/rewards.service';
import { ChannelsService, SUMMARY_COLUMNS, type ChannelRow, type ChannelSummary } from './channels.service';
import { badge, type ChannelRole } from './roles';

/** 채널 팔로우(가입)와 북마크. 팔로우는 글쓰기 권한이고, 보기·공감·댓글에는 필요 없다. 북마크는 권한과 무관하다. */
@Injectable()
export class MembershipService {
  constructor(
    private readonly db: Database,
    private readonly channels: ChannelsService,
    private readonly rewards: RewardsService,
  ) {}

  /** 여러 번 눌러도 결과가 같다 (이미 가입했으면 그대로) */
  async join(userId: number, slug: string, code?: string) {
    const channel = await this.channels.findBySlug(slug);
    // 이미 팔로우했으면 그대로. 아니면 19세 이상 채널은 나이 확인, 비공개 채널은 초대 코드가 필요하다
    if (!(await this.channels.roleOf(channel.id, userId))) {
      if (channel.adult && !(await this.channels.isAdult(userId))) {
        throw ApiError.forbidden('만 19세 이상만 팔로우할 수 있는 채널이에요. 설정에서 나이를 확인해 주세요');
      }
      if (channel.visibility === 'private') {
        const row = await this.db.one<{ code: string | null }>('SELECT invite_code AS code FROM channels WHERE id = $1', [channel.id]);
        if (!code || !row?.code || code.trim().toUpperCase() !== row.code) {
          throw ApiError.forbidden('비공개 채널이에요. 받은 초대 코드나 링크로 팔로우해 주세요');
        }
      }
    }
    const memberCount = await this.db.transaction(async () => {
      // 동시에 두 번 눌려도 (channel_id, user_id) unique 제약 + ON CONFLICT 가 중복을 막는다
      const added = await this.db.execute(
        'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT (channel_id, user_id) DO NOTHING',
        [channel.id, userId],
      );
      return { added, count: await this.addMemberCount(channel.id, added) };
    });
    this.channels.popularCache.clear();
    // 팔로워가 늘면 채널 주인의 팔로워 배지 확인
    if (memberCount.added) await this.rewards.channelFollowed(channel.id);
    return { joined: true, memberCount: memberCount.count };
  }

  async leave(userId: number, slug: string) {
    const channel = await this.channels.findBySlug(slug);
    if (channel.ownerId === userId) throw ApiError.badRequest('채널을 만든 사람은 팔로우를 취소할 수 없어요');
    const memberCount = await this.db.transaction(async () => {
      const removed = await this.db.execute('DELETE FROM channel_members WHERE channel_id = $1 AND user_id = $2', [channel.id, userId]);
      return this.addMemberCount(channel.id, -removed);
    });
    this.channels.popularCache.clear();
    return { joined: false, memberCount };
  }

  private async addMemberCount(channelId: number, delta: number): Promise<number> {
    const row = await this.db.one<{ memberCount: number }>(
      'UPDATE channels SET member_count = member_count + $1 WHERE id = $2 RETURNING member_count AS "memberCount"',
      [delta, channelId],
    );
    return row!.memberCount;
  }

  /** 글쓰기 전에 확인: 가입하지 않았으면 403 */
  async requireMember(channel: ChannelRow, userId: number) {
    if (!(await this.channels.roleOf(channel.id, userId))) {
      throw ApiError.forbidden(`'${channel.name}' 채널을 팔로우해야 글을 쓸 수 있어요`);
    }
  }

  /** 여러 번 눌러도 결과가 같다 */
  async bookmark(userId: number, slug: string, on: boolean) {
    const channel = await this.channels.findBySlug(slug);
    if (on) {
      await this.db.execute(
        'INSERT INTO channel_bookmarks (channel_id, user_id) VALUES ($1, $2) ON CONFLICT (channel_id, user_id) DO NOTHING',
        [channel.id, userId],
      );
    } else {
      await this.db.execute('DELETE FROM channel_bookmarks WHERE channel_id = $1 AND user_id = $2', [channel.id, userId]);
    }
    return { bookmarked: on };
  }

  /** 최근에 북마크한 순 */
  bookmarkedChannels(userId: number): Promise<ChannelSummary[]> {
    return this.db.query(
      `SELECT ${SUMMARY_COLUMNS} FROM channel_bookmarks b JOIN channels c ON c.id = b.channel_id
       WHERE b.user_id = $1 ORDER BY b.id DESC`,
      [userId],
    );
  }

  /** 내가 팔로우한 채널. 북마크한 채널이 먼저, 그 안에서는 최근에 팔로우한 순. owner 면 팔로우 취소 대신 관리 버튼을 보여 준다 */
  async myChannels(userId: number) {
    const rows = await this.db.query<ChannelSummary & { role: ChannelRole }>(
      `SELECT ${SUMMARY_COLUMNS}, m.role FROM channel_members m JOIN channels c ON c.id = m.channel_id
       LEFT JOIN channel_bookmarks b ON b.channel_id = m.channel_id AND b.user_id = m.user_id
       WHERE m.user_id = $1 ORDER BY (b.id IS NOT NULL) DESC, m.id DESC`,
      [userId],
    );
    return rows.map(({ role, ...c }) => ({ ...c, role: badge(role), owner: role === 'OWNER' }));
  }

  /** 목록에 보이는 채널들 중 내가 가입한 것 (IN 쿼리 한 번) */
  async joinedAmong(userId: number | undefined, channelIds: number[]): Promise<Set<number>> {
    if (userId == null || channelIds.length === 0) return new Set();
    const rows = await this.db.query<{ channelId: number }>(
      'SELECT channel_id AS "channelId" FROM channel_members WHERE user_id = $1 AND channel_id = ANY($2::int[])',
      [userId, channelIds],
    );
    return new Set(rows.map((r) => r.channelId));
  }
}

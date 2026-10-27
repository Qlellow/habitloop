import { Injectable } from '@nestjs/common';
import { BadgesService } from '../badges/badges.service';
import { Database } from '../db/database';

/** 하루는 한국 시간 기준 */
const TODAY = "(now() AT TIME ZONE 'Asia/Seoul')::date";

export const ATTENDANCE_POINTS = 10;
export const STREAK_BONUS_POINTS = 50;
export const POST_POINTS = 5;
export const POST_POINTS_DAILY_LIMIT = 5;
export const LIKE_POINTS = 2;
export const INVITER_POINTS = 100;
export const INVITEE_POINTS = 30;
export const DISCOVERY_POINTS = 30;


/** 포인트 적립과 배지. 글쓰기 · 공감 · 가입 같은 일이 끝난 뒤 부른다 */
@Injectable()
export class RewardsService {
  constructor(
    private readonly db: Database,
    private readonly badgeBook: BadgesService,
  ) {}

  private async grant(userId: number, delta: number, reason: string) {
    await this.db.execute('UPDATE users SET points = points + $1 WHERE id = $2', [delta, userId]);
    await this.db.execute('INSERT INTO point_logs (user_id, delta, reason) VALUES ($1, $2, $3)', [userId, delta, reason]);
  }

  /** 내 글이 오늘의 발견에 뽑힘 (+30P) */
  async discovered(userId: number) {
    await this.db.transaction(() => this.grant(userId, DISCOVERY_POINTS, '오늘의 발견'));
    await this.checkBadges(userId);
  }

  /** 오늘 출석 체크 (하루 한 번 +10P, 7일 연속마다 +50P). 이미 했으면 awarded = false */
  async attend(userId: number) {
    const result = await this.db.transaction(async () => {
      const added = await this.db.execute(`INSERT INTO attendance (user_id, day) VALUES ($1, ${TODAY}) ON CONFLICT DO NOTHING`, [userId]);
      const streak = await this.streak(userId);
      let earned = 0;
      if (added) {
        await this.grant(userId, ATTENDANCE_POINTS, '출석');
        earned += ATTENDANCE_POINTS;
        if (streak % 7 === 0) {
          await this.grant(userId, STREAK_BONUS_POINTS, `${streak}일 연속 출석`);
          earned += STREAK_BONUS_POINTS;
        }
      }
      return { awarded: added > 0, earned, streak };
    });
    if (result.awarded) await this.checkBadges(userId);
    return result;
  }

  /** 오늘까지 며칠 연속으로 출석했는지 */
  private async streak(userId: number) {
    const rows = await this.db.query<{ gap: number }>(
      `SELECT ${TODAY} - day AS gap FROM attendance WHERE user_id = $1 AND day <= ${TODAY} ORDER BY day DESC LIMIT 400`,
      [userId],
    );
    let n = 0;
    while (n < rows.length && Number(rows[n].gap) === n) n++;
    return n;
  }

  /** 글을 쓰면 +5P (하루 5번까지) */
  async postWritten(userId: number) {
    await this.db.transaction(async () => {
      // 같은 사람이 동시에 여러 글을 올려도 하루 한도를 넘지 않게 줄 세운다
      await this.db.one('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [userId]);
      const today = await this.db.one<{ n: string }>(
        `SELECT count(*) AS n FROM point_logs
         WHERE user_id = $1 AND reason = '글 작성' AND (created_at AT TIME ZONE 'Asia/Seoul')::date = ${TODAY}`,
        [userId],
      );
      if (Number(today?.n ?? 0) < POST_POINTS_DAILY_LIMIT) await this.grant(userId, POST_POINTS, '글 작성');
    });
    await this.checkBadges(userId);
  }

  /** 내 글이 공감을 받으면 +2P (같은 사람의 공감은 한 번만, 내 글에 내가 누른 건 빼고) */
  /** 이 사람이 이 글에 처음 공감했으면 true (알림도 처음 한 번만 보낸다) */
  async postLiked(postId: number, likerId: number): Promise<boolean> {
    const post = await this.db.one<{ authorId: number }>('SELECT author_id AS "authorId" FROM posts WHERE id = $1', [postId]);
    if (!post || post.authorId === likerId) return false;
    const first = await this.db.transaction(async () => {
      const added = await this.db.execute('INSERT INTO like_rewards (post_id, liker_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [postId, likerId]);
      if (added) await this.grant(post.authorId, LIKE_POINTS, '공감 받음');
      return added > 0;
    });
    await this.checkBadges(post.authorId);
    return first;
  }

  /** 초대 코드로 가입하면 초대한 사람 +100P, 가입한 사람 +30P */
  async signedUp(userId: number, inviteCode?: string) {
    // 가입하자마자 받는 배지 (첫 번째 루퍼 · 베타 테스터)
    await this.checkBadges(userId);
    const code = inviteCode?.trim().toUpperCase();
    if (!code) return;
    const inviter = await this.db.one<{ id: number }>('SELECT id FROM users WHERE invite_code = $1 AND id <> $2', [code, userId]);
    if (!inviter) return;
    await this.db.transaction(async () => {
      await this.db.execute('UPDATE users SET invited_by = $1 WHERE id = $2', [inviter.id, userId]);
      await this.grant(inviter.id, INVITER_POINTS, '친구 초대');
      await this.grant(userId, INVITEE_POINTS, '초대받아 가입');
    });
    await this.checkBadges(inviter.id);
  }

  /** 채널에 팔로워가 늘면 채널 주인의 팔로워 배지를 확인한다 */
  async channelFollowed(channelId: number) {
    const channel = await this.db.one<{ ownerId: number | null }>('SELECT owner_id AS "ownerId" FROM channels WHERE id = $1', [channelId]);
    if (channel?.ownerId != null) await this.checkBadges(channel.ownerId);
  }

  /** 조건을 채운 배지를 준다 (이미 받은 건 그대로) */
  /** 배지 판정 (badges/badges.service.ts). 실패해도 원래 요청은 그대로 */
  async checkBadges(userId: number) {
    await this.badgeBook.checkQuietly(userId);
  }

  /** 받은 배지 (도감 순서대로, 그림 · 등급 포함) */
  badges(userId: number) {
    return this.badgeBook.earned(userId);
  }

  /** 내 초대 코드와 초대한 사람 수 */
  async invite(userId: number) {
    const row = await this.db.one<{ code: string; count: string }>(
      'SELECT invite_code AS code, (SELECT count(*) FROM users WHERE invited_by = $1) AS count FROM users WHERE id = $1',
      [userId],
    );
    return { code: row!.code, invitedCount: Number(row!.count) };
  }
}

import { Injectable } from '@nestjs/common';
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

interface Stats {
  posts: number;
  comments: number;
  likes: number;
  invites: number;
  channels: number;
  followers: number;
  streak: number;
}

/** 배지(도전과제). 한 번 받으면 조건이 다시 내려가도 남는다. 목록 순서가 프로필에 보이는 순서 */
const BADGES: { code: string; name: string; description: string; earned: (s: Stats) => boolean }[] = [
  { code: 'first_post', name: '첫 글', description: '처음으로 글을 썼어요', earned: (s) => s.posts >= 1 },
  { code: 'posts_10', name: '꾸준한 작가', description: '글을 10개 썼어요', earned: (s) => s.posts >= 10 },
  { code: 'posts_100', name: '루프의 기둥', description: '글을 100개 썼어요', earned: (s) => s.posts >= 100 },
  { code: 'first_comment', name: '첫 댓글', description: '처음으로 댓글을 달았어요', earned: (s) => s.comments >= 1 },
  { code: 'comments_100', name: '수다쟁이', description: '댓글을 100개 달았어요', earned: (s) => s.comments >= 100 },
  { code: 'likes_10', name: '첫 호응', description: '공감을 10개 받았어요', earned: (s) => s.likes >= 10 },
  { code: 'likes_100', name: '인기인', description: '공감을 100개 받았어요', earned: (s) => s.likes >= 100 },
  { code: 'likes_1000', name: '스타', description: '공감을 1,000개 받았어요', earned: (s) => s.likes >= 1000 },
  { code: 'streak_7', name: '일주일 출석', description: '7일 연속으로 출석했어요', earned: (s) => s.streak >= 7 },
  { code: 'streak_30', name: '한 달 출석', description: '30일 연속으로 출석했어요', earned: (s) => s.streak >= 30 },
  { code: 'invite_1', name: '첫 초대', description: '친구를 루프에 초대했어요', earned: (s) => s.invites >= 1 },
  { code: 'invite_10', name: '마당발', description: '친구 10명을 초대했어요', earned: (s) => s.invites >= 10 },
  { code: 'channel_open', name: '채널 개설', description: '채널을 만들었어요', earned: (s) => s.channels >= 1 },
  ...[10, 50, 100, 500, 1000].map((n) => ({
    code: `followers_${n}`,
    name: `팔로워 ${n.toLocaleString()}+`,
    description: `내 채널의 팔로워가 ${n.toLocaleString()}명을 넘었어요`,
    earned: (s: Stats) => s.followers >= n,
  })),
];

export interface BadgeResponse {
  code: string;
  name: string;
  description: string;
  earnedAt: Date;
}

/** 포인트 적립과 배지. 글쓰기 · 공감 · 가입 같은 일이 끝난 뒤 부른다 */
@Injectable()
export class RewardsService {
  constructor(private readonly db: Database) {}

  private async grant(userId: number, delta: number, reason: string) {
    await this.db.execute('UPDATE users SET points = points + $1 WHERE id = $2', [delta, userId]);
    await this.db.execute('INSERT INTO point_logs (user_id, delta, reason) VALUES ($1, $2, $3)', [userId, delta, reason]);
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
    if (result.awarded) await this.checkBadges(userId, result.streak);
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
  async postLiked(postId: number, likerId: number) {
    const post = await this.db.one<{ authorId: number }>('SELECT author_id AS "authorId" FROM posts WHERE id = $1', [postId]);
    if (!post || post.authorId === likerId) return;
    await this.db.transaction(async () => {
      const first = await this.db.execute('INSERT INTO like_rewards (post_id, liker_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [postId, likerId]);
      if (first) await this.grant(post.authorId, LIKE_POINTS, '공감 받음');
    });
    await this.checkBadges(post.authorId);
  }

  /** 초대 코드로 가입하면 초대한 사람 +100P, 가입한 사람 +30P */
  async signedUp(userId: number, inviteCode?: string) {
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
  async checkBadges(userId: number, streak = 0) {
    const row = await this.db.one<Record<keyof Stats, string>>(
      `SELECT (SELECT count(*) FROM posts WHERE author_id = $1) AS posts,
              (SELECT count(*) FROM comments WHERE author_id = $1) AS comments,
              (SELECT coalesce(sum(like_count), 0) FROM posts WHERE author_id = $1) AS likes,
              (SELECT count(*) FROM users WHERE invited_by = $1) AS invites,
              (SELECT count(*) FROM channels WHERE owner_id = $1) AS channels,
              (SELECT coalesce(max(member_count), 0) FROM channels WHERE owner_id = $1) AS followers`,
      [userId],
    );
    if (!row) return;
    const stats: Stats = {
      posts: Number(row.posts),
      comments: Number(row.comments),
      likes: Number(row.likes),
      invites: Number(row.invites),
      channels: Number(row.channels),
      followers: Number(row.followers),
      streak,
    };
    const codes = BADGES.filter((b) => b.earned(stats)).map((b) => b.code);
    if (codes.length) {
      await this.db.execute('INSERT INTO user_badges (user_id, code) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING', [userId, codes]);
    }
  }

  /** 받은 배지 (정해 둔 순서대로) */
  async badges(userId: number): Promise<BadgeResponse[]> {
    const rows = await this.db.query<{ code: string; earnedAt: Date }>('SELECT code, created_at AS "earnedAt" FROM user_badges WHERE user_id = $1', [
      userId,
    ]);
    const earned = new Map(rows.map((r) => [r.code, r.earnedAt]));
    return BADGES.filter((b) => earned.has(b.code)).map((b) => ({
      code: b.code,
      name: b.name,
      description: b.description,
      earnedAt: earned.get(b.code)!,
    }));
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

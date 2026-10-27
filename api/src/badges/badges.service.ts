import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { TtlCache } from '../common/ttl-cache';
import { Database } from '../db/database';
import { PetsService } from '../pets/pets.service';
import { DnaService } from '../users/dna.service';
import { BADGES, BADGE_BY_CODE, CLIENT_EVENTS, type BadgeCategory, type BadgeStats, type BadgeTier, type PetStageName } from './catalog';

/** 정식 오픈 날 (이 전에 가입하면 '베타 테스터'). BADGE_BETA_UNTIL=2027-01-01 처럼 바꿀 수 있다 */
const BETA_UNTIL = process.env.BADGE_BETA_UNTIL || '2027-01-01';
const KST = "AT TIME ZONE 'Asia/Seoul'";

export interface BadgeCard {
  code: string;
  name: string;
  description: string;
  icon: string;
  tier: BadgeTier;
  category: BadgeCategory;
  hidden: boolean;
  earned: boolean;
  earnedAt?: Date;
  /** 내 도감에서만: [지금, 목표] */
  progress?: [number, number];
  /** 이 배지를 가진 사람 비율 (%) */
  holders: number;
}

export interface BadgeBook {
  total: number;
  earned: number;
  featured?: string;
  badges: BadgeCard[];
}

/** 받은 배지 (프로필 · 새 배지 알림) */
export interface EarnedBadge {
  code: string;
  name: string;
  description: string;
  icon: string;
  tier: BadgeTier;
  earnedAt: Date;
}

const card = (code: string): Pick<EarnedBadge, 'code' | 'name' | 'description' | 'icon' | 'tier'> => {
  const b = BADGE_BY_CODE.get(code)!;
  return { code, name: b.name, description: b.description, icon: b.icon, tier: b.tier };
};

/**
 * 배지: 조건 판정 · 도감 · 화면에서 보내 온 기록(카운터) · 대표 배지 · 새 배지 알림.
 * 판정(check)은 글쓰기 · 댓글 · 공감 · 출석 · 표류병 · 음성방 같은 일이 끝난 뒤, 그리고 내 도감을 볼 때 부른다
 */
@Injectable()
export class BadgesService {
  private readonly holdersCache = new TtlCache<Map<string, number>>(5 * 60_000, 1);

  constructor(
    private readonly db: Database,
    private readonly pets: PetsService,
    private readonly dna: DnaService,
  ) {}

  /** 판정하는 데 쓰는 숫자를 한 번에 모은다 */
  async stats(userId: number): Promise<BadgeStats | undefined> {
    const row = await this.db.one<Record<string, string | boolean | null>>(
      `SELECT
         u.created_at < $2::date AS "betaUser",
         (now() ${KST})::date - (u.created_at ${KST})::date AS "daysSinceJoin",
         u.home_layout IS NOT NULL AS "homeSaved",
         (SELECT count(*) FROM posts WHERE author_id = $1) AS posts,
         (SELECT count(*) FROM comments WHERE author_id = $1) AS comments,
         (SELECT coalesce(sum(like_count), 0) FROM posts WHERE author_id = $1) AS likes,
         (SELECT count(*) FROM users WHERE invited_by = $1) AS invites,
         (SELECT count(*) FROM channels WHERE owner_id = $1) AS channels,
         (SELECT coalesce(max(member_count), 0) FROM channels WHERE owner_id = $1) AS followers,
         (SELECT count(*) FROM daily_discoveries d JOIN posts p ON p.id = d.post_id WHERE p.author_id = $1) AS discoveries,
         (SELECT count(*) FROM bottles WHERE author_id = $1) AS "bottlesThrown",
         (SELECT count(*) FROM bottle_replies WHERE author_id = $1) AS "bottleReplies",
         (SELECT count(*) FROM bottles WHERE author_id = $1 AND status = 'ashore') AS "bottlesAshore",
         (SELECT count(*) FROM posts WHERE author_id = $1 AND content ~ '\\|\\|\\S') AS "blindPosts",
         (SELECT count(*) FROM post_reactions WHERE user_id = $1) AS "reactionsGiven",
         EXISTS (SELECT 1 FROM post_reactions r JOIN posts p ON p.id = r.post_id WHERE p.author_id = $1
                 GROUP BY r.post_id HAVING count(DISTINCT r.kind) >= 5) AS "allFiveReactions",
         (SELECT coalesce(max(n), 0) FROM (SELECT count(*) AS n FROM post_reactions r JOIN posts p ON p.id = r.post_id
                 WHERE p.author_id = $1 AND r.kind = 'fire' GROUP BY r.post_id) f) AS "maxFire",
         (SELECT coalesce(max(comment_count), 0) FROM posts WHERE author_id = $1) AS "maxCommentsOnPost",
         (SELECT count(*) FROM comments c JOIN posts p ON p.id = c.post_id JOIN users a ON a.id = p.author_id
           WHERE c.author_id = $1 AND p.author_id <> $1 AND c.created_at < a.created_at + interval '7 days') AS "welcomeComments",
         EXISTS (SELECT 1 FROM comments c WHERE c.author_id = $1 AND c.like_count >= 3
                 AND c.like_count = (SELECT max(o.like_count) FROM comments o WHERE o.post_id = c.post_id)) AS "bestComment",
         (SELECT count(DISTINCT ch) FROM (
            SELECT channel_id AS ch FROM posts WHERE author_id = $1
            UNION SELECT p.channel_id FROM comments c JOIN posts p ON p.id = c.post_id WHERE c.author_id = $1) e) AS "exploredChannels",
         EXISTS (SELECT 1 FROM posts p JOIN channels ch ON ch.id = p.channel_id
                 WHERE p.author_id = $1 AND p.created_at < ch.created_at + interval '1 day'
                   AND NOT EXISTS (SELECT 1 FROM posts q WHERE q.channel_id = p.channel_id AND q.id < p.id)) AS pioneer,
         (SELECT count(*) FROM posts WHERE author_id = $1 AND extract(hour FROM created_at ${KST}) BETWEEN 2 AND 4) AS "dawnPosts",
         EXISTS (SELECT 1 FROM posts WHERE author_id = $1 AND id IN (777, 7777, 77777)) AS lucky,
         EXISTS (SELECT 1 FROM posts WHERE author_id = $1
                 AND extract(hour FROM created_at ${KST}) = 0 AND extract(minute FROM created_at ${KST}) = 0) AS midnight
       FROM users u WHERE u.id = $1`,
      [userId, BETA_UNTIL],
    );
    if (!row) return undefined;
    const [days, attendance, counters, pet, dna] = await Promise.all([
      // 아침 5~7시에 글이나 댓글을 남긴 날 (한국 날짜)
      this.db.query<{ day: string }>(
        `SELECT DISTINCT to_char(t ${KST}, 'YYYY-MM-DD') AS day FROM (
           SELECT created_at AS t FROM posts WHERE author_id = $1 UNION ALL SELECT created_at FROM comments WHERE author_id = $1
         ) a WHERE extract(hour FROM t ${KST}) IN (5, 6) ORDER BY 1`,
        [userId],
      ),
      this.db.query<{ gap: number }>(
        `SELECT (now() ${KST})::date - day AS gap FROM attendance WHERE user_id = $1 AND day <= (now() ${KST})::date ORDER BY day DESC LIMIT 400`,
        [userId],
      ),
      this.db.query<{ key: string; value: number }>('SELECT key, value FROM user_counters WHERE user_id = $1', [userId]),
      this.pets.mine(userId).catch(() => null),
      this.dna.ofUser(userId).catch(() => undefined),
    ]);
    const n = (k: string) => Number(row[k] ?? 0);
    const b = (k: string) => row[k] === true;
    let streak = 0;
    while (streak < attendance.length && Number(attendance[streak].gap) === streak) streak++;
    const counterMap: Record<string, number> = {};
    for (const c of counters) {
      if (c.key.startsWith('pat:')) counterMap.pat_max = Math.max(counterMap.pat_max ?? 0, Number(c.value));
      else counterMap[c.key] = Number(c.value);
    }
    return {
      userId,
      posts: n('posts'),
      comments: n('comments'),
      likes: n('likes'),
      invites: n('invites'),
      channels: n('channels'),
      followers: n('followers'),
      streak,
      daysSinceJoin: n('daysSinceJoin'),
      discoveries: n('discoveries'),
      bottlesThrown: n('bottlesThrown'),
      bottleReplies: n('bottleReplies'),
      bottlesAshore: n('bottlesAshore'),
      blindPosts: n('blindPosts'),
      reactionsGiven: n('reactionsGiven'),
      allFiveReactions: b('allFiveReactions'),
      maxFire: n('maxFire'),
      maxCommentsOnPost: n('maxCommentsOnPost'),
      welcomeComments: n('welcomeComments'),
      bestComment: b('bestComment'),
      exploredChannels: n('exploredChannels'),
      pioneer: b('pioneer'),
      homeSaved: b('homeSaved'),
      dawnPosts: n('dawnPosts'),
      earlyBirdStreak: longestRun(days.map((d) => d.day)),
      lucky: b('lucky'),
      midnight: b('midnight'),
      petStage: (pet?.stage as PetStageName | undefined) ?? 'none',
      dnaComplete: !!dna?.ready && Object.values(dna.traits).every((v) => v >= 30),
      betaUser: b('betaUser'),
      counters: counterMap,
    };
  }

  /** 조건을 채운 배지를 준다. 새로 받은 배지 코드를 돌려준다 */
  async check(userId: number): Promise<string[]> {
    const stats = await this.stats(userId);
    if (!stats) return [];
    const codes = BADGES.filter((b) => b.earned(stats)).map((b) => b.code);
    if (!codes.length) return [];
    const added = await this.db.query<{ code: string }>(
      'INSERT INTO user_badges (user_id, code) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING RETURNING code',
      [userId, codes],
    );
    return added.map((a) => a.code);
  }

  /** 판정은 덤: 실패해도 원래 요청은 그대로 */
  async checkQuietly(userId: number) {
    try {
      return await this.check(userId);
    } catch {
      return [];
    }
  }

  /** 카운터 하나 올리기 (minIntervalSec 안에 다시 오면 세지 않는다) */
  async bump(userId: number, key: string, minIntervalSec = 0) {
    await this.db.execute(
      `INSERT INTO user_counters (user_id, key, value, updated_at) VALUES ($1, $2, 1, now())
       ON CONFLICT (user_id, key) DO UPDATE SET value = user_counters.value + 1, updated_at = now()
       WHERE user_counters.updated_at <= now() - make_interval(secs => $3)`,
      [userId, key, minIntervalSec],
    );
  }

  /** 한 번만 세는 기록 (이미 있으면 그대로) */
  async mark(userId: number, key: string) {
    await this.db.execute('INSERT INTO user_counters (user_id, key, value) VALUES ($1, $2, 1) ON CONFLICT DO NOTHING', [userId, key]);
  }

  /** 화면에서 보낸 기록 (정해 둔 이름만). 새로 받은 배지를 돌려준다 */
  async clientEvent(userId: number, event: string) {
    const interval = CLIENT_EVENTS[event];
    if (interval == null) throw ApiError.badRequest('모르는 기록이에요');
    await this.bump(userId, event, interval);
    return { badges: (await this.check(userId)).map(card) };
  }

  /** 배지를 가진 사람 비율 (%) */
  private holders(): Promise<Map<string, number>> {
    return this.holdersCache.getOrLoad('all', async () => {
      const [total, rows] = await Promise.all([
        this.db.one<{ n: string }>('SELECT count(*) AS n FROM users WHERE withdrawn_at IS NULL'),
        this.db.query<{ code: string; n: string }>('SELECT code, count(*) AS n FROM user_badges GROUP BY code'),
      ]);
      const all = Math.max(1, Number(total?.n ?? 1));
      return new Map(rows.map((r) => [r.code, Math.round((Number(r.n) / all) * 1000) / 10]));
    });
  }

  /** 도감: 모든 배지와 받았는지 · 진행도(내 것만) · 가진 사람 비율 */
  async book(targetId: number, own: boolean): Promise<BadgeBook> {
    if (own) await this.check(targetId);
    const [rows, user, holders, stats] = await Promise.all([
      this.db.query<{ code: string; earnedAt: Date }>('SELECT code, created_at AS "earnedAt" FROM user_badges WHERE user_id = $1', [targetId]),
      this.db.one<{ featured: string | null }>('SELECT featured_badge AS featured FROM users WHERE id = $1', [targetId]),
      this.holders(),
      own ? this.stats(targetId) : Promise.resolve(undefined),
    ]);
    const earned = new Map(rows.map((r) => [r.code, r.earnedAt]));
    const badges = BADGES.map((b): BadgeCard => {
      const got = earned.has(b.code);
      const secret = !!b.hidden && !got;
      return {
        code: b.code,
        name: secret ? '???' : b.name,
        description: secret ? '조건이 숨겨진 배지예요. 우연히 받게 될지도 몰라요' : b.description,
        icon: secret ? '❔' : b.icon,
        tier: secret ? 'common' : b.tier, // 숨은 배지는 등급도 가린다
        category: b.category,
        hidden: !!b.hidden,
        earned: got,
        earnedAt: earned.get(b.code),
        progress: stats && b.progress && !got && !secret ? b.progress(stats) : undefined,
        holders: holders.get(b.code) ?? 0,
      };
    });
    return { total: BADGES.length, earned: badges.filter((b) => b.earned).length, featured: user?.featured ?? undefined, badges };
  }

  /** 받은 배지 (도감 순서대로) */
  async earned(userId: number): Promise<EarnedBadge[]> {
    const rows = await this.db.query<{ code: string; earnedAt: Date }>('SELECT code, created_at AS "earnedAt" FROM user_badges WHERE user_id = $1', [userId]);
    const at = new Map(rows.map((r) => [r.code, r.earnedAt]));
    return BADGES.filter((b) => at.has(b.code)).map((b) => ({ ...card(b.code), earnedAt: at.get(b.code)! }));
  }

  /** 대표 배지 달기 · 떼기 (받은 배지만) */
  async feature(userId: number, code: string | null) {
    if (code != null) {
      if (!BADGE_BY_CODE.has(code)) throw ApiError.badRequest('모르는 배지예요');
      if (!(await this.db.one('SELECT 1 FROM user_badges WHERE user_id = $1 AND code = $2', [userId, code]))) throw ApiError.badRequest('아직 받지 않은 배지예요');
    }
    await this.db.execute('UPDATE users SET featured_badge = $2 WHERE id = $1', [userId, code]);
    return { featured: code ?? undefined };
  }

  /** 새로 받았지만 아직 알리지 않은 배지 */
  async unseen(userId: number) {
    const rows = await this.db.query<{ code: string; earnedAt: Date }>(
      'SELECT code, created_at AS "earnedAt" FROM user_badges WHERE user_id = $1 AND seen_at IS NULL ORDER BY created_at',
      [userId],
    );
    return rows.filter((r) => BADGE_BY_CODE.has(r.code)).map((r) => ({ ...card(r.code), earnedAt: r.earnedAt }));
  }

  async markSeen(userId: number) {
    await this.db.execute('UPDATE user_badges SET seen_at = now() WHERE user_id = $1 AND seen_at IS NULL', [userId]);
  }
}

/** 날짜(YYYY-MM-DD, 오름차순) 목록에서 가장 긴 연속 일수 */
export function longestRun(days: string[]): number {
  let best = 0;
  let run = 0;
  let prev: number | undefined;
  for (const d of days) {
    const t = Date.parse(`${d}T00:00:00Z`) / 86_400_000;
    run = prev != null && t - prev === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}

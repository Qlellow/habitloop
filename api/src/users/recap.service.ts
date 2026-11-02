import { timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '../auth/jwt.service';
import { featuredBadge, type FeaturedBadge } from '../badges/catalog';
import { ApiError } from '../common/api-error';
import { TtlCache } from '../common/ttl-cache';
import { Database } from '../db/database';

/**
 * 주간 회고: 한 주(한국 시각 월요일 0시 ~ 다음 월요일 0시) 동안의 활동을 카드 한 장으로.
 *  - 쓴 글 · 댓글, 받은 공감 · 반응 · 조회, 보낸 응원, 새 배지, 가장 반응이 좋았던 글, 가장 많이 머문 채널, 가장 활발한 시간
 *  - 지난주와 비교 (글 · 댓글 · 받은 공감)
 * 활동 DNA 처럼 공개 채널 · 숨기지 않은 글의 활동만 세서 누구나 볼 수 있다 (공유 링크로 받은 사람도).
 * 출석한 요일은 개인 기록이라 본인, 또는 본인이 만든 공유 링크(서명 s)로 연 사람에게만 준다.
 */
export interface RecapStats {
  posts: number;
  comments: number;
  /** 받은 공감 (글 + 댓글) */
  likesReceived: number;
  /** 받은 감정 반응 */
  reactionsReceived: number;
  /** 내 글이 새로 읽힌 수 */
  views: number;
  /** 보낸 응원 (공감 + 반응) */
  cheersGiven: number;
}

export interface WeeklyRecap {
  user: { id: string; nickname: string; avatarUrl?: string | null };
  /** 그 주 월요일 · 일요일 (YYYY-MM-DD, 한국 날짜) */
  week: { start: string; end: string; current: boolean };
  /** 가입한 주(또는 첫 글을 쓴 주)의 월요일. 이보다 앞 주로는 넘기지 않는다 */
  firstWeek: string;
  stats: RecapStats;
  prev: Pick<RecapStats, 'posts' | 'comments' | 'likesReceived'>;
  /** 월 ~ 일 출석 (본인 · 서명된 공유 링크만) */
  attendance?: boolean[];
  topPost?: { id: number; title: string; likes: number; comments: number; channel: { slug: string; name: string } };
  topChannel?: { slug: string; name: string; count: number };
  /** 가장 활발했던 시각 (한국 시각 0~23, 글 · 댓글 기준) */
  peakHour?: number;
  badges: FeaturedBadge[];
  /** 본인에게만: 출석까지 보이는 공유 링크용 서명 */
  shareKey?: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** 이만큼 지난 주까지 볼 수 있다 */
const MAX_WEEKS = 52;
const KST = "'Asia/Seoul'";

const sameKey = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

@Injectable()
export class RecapService {
  /** 지난 주는 바뀌지 않으니 오래, 이번 주는 짧게 (출석 · 서명은 캐시 밖에서 붙인다) */
  private readonly cache = new TtlCache<Omit<WeeklyRecap, 'attendance' | 'shareKey'>>(5 * 60_000, 2000);

  constructor(
    private readonly db: Database,
    private readonly jwt: JwtService,
  ) {}

  /** week: 그 주의 아무 날 (YYYY-MM-DD). 없으면 지난주. viewerId: 로그인한 사람, key: 공유 링크의 서명 */
  async of(uid: string, week: string | undefined, viewerId?: number, key?: string): Promise<WeeklyRecap> {
    const user = UID.test(uid)
      ? await this.db.one<{ id: number; uid: string; nickname: string; avatarUrl: string | null; firstWeek: string }>(
          `SELECT u.id, u.uid::text AS uid, u.nickname,
                  CASE WHEN u.avatar_id IS NULL THEN NULL ELSE '/api/images/' || u.avatar_id END AS "avatarUrl",
                  to_char(date_trunc('week', least(u.created_at, (SELECT min(p.created_at) FROM posts p WHERE p.author_id = u.id)) AT TIME ZONE ${KST}), 'YYYY-MM-DD') AS "firstWeek"
           FROM users u WHERE u.uid::text = $1 AND u.withdrawn_at IS NULL`,
          [uid.toLowerCase()],
        )
      : undefined;
    if (!user) throw ApiError.notFound('없는 사용자예요');
    if (week !== undefined && (!DATE.test(week) || Number.isNaN(Date.parse(week)))) throw ApiError.badRequest('주를 YYYY-MM-DD 로 알려 주세요');

    // 그 주의 월요일 (한국 날짜). 이번 주보다 뒤 · 너무 오래된 주는 받지 않는다
    const range = await this.db.one<{ start: string; end: string; current: boolean; tooOld: boolean; future: boolean }>(
      `WITH w AS (
         SELECT date_trunc('week', coalesce($1::date, (now() AT TIME ZONE ${KST})::date - 7))::date AS start,
                date_trunc('week', (now() AT TIME ZONE ${KST})::date)::date AS this_week
       )
       SELECT to_char(start, 'YYYY-MM-DD') AS start, to_char(start + 6, 'YYYY-MM-DD') AS "end",
              start = this_week AS current, start < this_week - ${MAX_WEEKS * 7} AS "tooOld", start > this_week AS future
       FROM w`,
      [week ?? null],
    );
    if (!range || range.future) throw ApiError.badRequest('아직 오지 않은 주예요');
    if (range.tooOld) throw ApiError.badRequest(`최근 ${MAX_WEEKS}주까지만 볼 수 있어요`);

    const body = await this.cache.getOrLoad(`${user.id}:${range.start}`, async () => ({
      user: { id: user.uid, nickname: user.nickname, avatarUrl: user.avatarUrl },
      week: { start: range.start, end: range.end, current: range.current },
      firstWeek: user.firstWeek,
      ...(await this.load(user.id, range.start)),
    }));

    const own = viewerId === user.id;
    const signed = !!key && sameKey(key, this.jwt.mac('recap', `${user.uid}:${range.start}`));
    return {
      ...body,
      ...(own || signed ? { attendance: await this.attendance(user.id, range.start) } : {}),
      ...(own ? { shareKey: this.jwt.mac('recap', `${user.uid}:${range.start}`) } : {}),
    };
  }

  private async attendance(userId: number, start: string): Promise<boolean[]> {
    const rows = await this.db.query<{ i: number }>(
      `SELECT (day - $2::date)::int AS i FROM attendance WHERE user_id = $1 AND day >= $2::date AND day < $2::date + 7`,
      [userId, start],
    );
    const days = Array.from({ length: 7 }, () => false);
    for (const r of rows) days[r.i] = true;
    return days;
  }

  private async load(userId: number, start: string) {
    // $2 = 월요일 (한국 날짜) → 그 주의 시작 · 끝 시각, 지난주 시작 시각
    const FROM = `(($2::date)::timestamp AT TIME ZONE ${KST})`;
    const TO = `(($2::date + 7)::timestamp AT TIME ZONE ${KST})`;
    const PREV = `(($2::date - 7)::timestamp AT TIME ZONE ${KST})`;
    const OPEN = `JOIN channels ch ON ch.id = p.channel_id AND ch.visibility = 'public'`;
    const [counts, top, channel, hour, badges] = await Promise.all([
      this.db.one<Record<string, string>>(
        `SELECT
           (SELECT count(*) FROM posts p ${OPEN} WHERE p.author_id = $1 AND p.hidden_at IS NULL AND p.created_at >= ${FROM} AND p.created_at < ${TO}) AS posts,
           (SELECT count(*) FROM posts p ${OPEN} WHERE p.author_id = $1 AND p.hidden_at IS NULL AND p.created_at >= ${PREV} AND p.created_at < ${FROM}) AS "prevPosts",
           (SELECT count(*) FROM comments c JOIN posts p ON p.id = c.post_id ${OPEN}
             WHERE c.author_id = $1 AND c.hidden_at IS NULL AND c.created_at >= ${FROM} AND c.created_at < ${TO}) AS comments,
           (SELECT count(*) FROM comments c JOIN posts p ON p.id = c.post_id ${OPEN}
             WHERE c.author_id = $1 AND c.hidden_at IS NULL AND c.created_at >= ${PREV} AND c.created_at < ${FROM}) AS "prevComments",
           (SELECT count(*) FROM post_likes l JOIN posts p ON p.id = l.post_id ${OPEN}
             WHERE p.author_id = $1 AND l.user_id <> $1 AND l.created_at >= ${FROM} AND l.created_at < ${TO})
           + (SELECT count(*) FROM comment_likes l JOIN comments c ON c.id = l.comment_id JOIN posts p ON p.id = c.post_id ${OPEN}
             WHERE c.author_id = $1 AND l.user_id <> $1 AND l.created_at >= ${FROM} AND l.created_at < ${TO}) AS "likesReceived",
           (SELECT count(*) FROM post_likes l JOIN posts p ON p.id = l.post_id ${OPEN}
             WHERE p.author_id = $1 AND l.user_id <> $1 AND l.created_at >= ${PREV} AND l.created_at < ${FROM})
           + (SELECT count(*) FROM comment_likes l JOIN comments c ON c.id = l.comment_id JOIN posts p ON p.id = c.post_id ${OPEN}
             WHERE c.author_id = $1 AND l.user_id <> $1 AND l.created_at >= ${PREV} AND l.created_at < ${FROM}) AS "prevLikesReceived",
           (SELECT count(*) FROM post_reactions r JOIN posts p ON p.id = r.post_id ${OPEN}
             WHERE p.author_id = $1 AND r.user_id <> $1 AND r.created_at >= ${FROM} AND r.created_at < ${TO}) AS "reactionsReceived",
           (SELECT count(*) FROM post_views v JOIN posts p ON p.id = v.post_id ${OPEN}
             WHERE p.author_id = $1 AND v.created_at >= ${FROM} AND v.created_at < ${TO}) AS views,
           (SELECT count(*) FROM post_likes l JOIN posts p ON p.id = l.post_id ${OPEN}
             WHERE l.user_id = $1 AND p.author_id <> $1 AND l.created_at >= ${FROM} AND l.created_at < ${TO})
           + (SELECT count(*) FROM post_reactions r JOIN posts p ON p.id = r.post_id ${OPEN}
             WHERE r.user_id = $1 AND p.author_id <> $1 AND r.created_at >= ${FROM} AND r.created_at < ${TO}) AS "cheersGiven"`,
        [userId, start],
      ),
      // 이번 주에 공감 · 댓글을 가장 많이 받은 내 글 (언제 쓴 글이든)
      this.db.one<{ id: number; title: string; likes: string; comments: string; slug: string; name: string }>(
        `SELECT * FROM (
           SELECT p.id, p.title, ch.slug, ch.name,
                  (SELECT count(*) FROM post_likes l WHERE l.post_id = p.id AND l.user_id <> $1 AND l.created_at >= ${FROM} AND l.created_at < ${TO}) AS likes,
                  (SELECT count(*) FROM comments c WHERE c.post_id = p.id AND c.author_id <> $1 AND c.hidden_at IS NULL AND c.created_at >= ${FROM} AND c.created_at < ${TO}) AS comments
           FROM posts p ${OPEN} AND NOT ch.adult
           WHERE p.author_id = $1 AND p.hidden_at IS NULL AND p.created_at < ${TO}
         ) t ORDER BY likes * 2 + comments DESC, id DESC LIMIT 1`,
        [userId, start],
      ),
      this.db.one<{ slug: string; name: string; count: string }>(
        `SELECT ch.slug, ch.name, count(*) AS count FROM (
           SELECT p.channel_id FROM posts p WHERE p.author_id = $1 AND p.hidden_at IS NULL AND p.created_at >= ${FROM} AND p.created_at < ${TO}
           UNION ALL
           SELECT p.channel_id FROM comments c JOIN posts p ON p.id = c.post_id
           WHERE c.author_id = $1 AND c.hidden_at IS NULL AND c.created_at >= ${FROM} AND c.created_at < ${TO}
         ) a JOIN channels ch ON ch.id = a.channel_id AND ch.visibility = 'public' AND NOT ch.adult
         GROUP BY ch.id ORDER BY count(*) DESC, ch.id LIMIT 1`,
        [userId, start],
      ),
      this.db.one<{ h: number }>(
        `SELECT extract(hour FROM t AT TIME ZONE ${KST})::int AS h FROM (
           SELECT p.created_at AS t FROM posts p ${OPEN} WHERE p.author_id = $1 AND p.hidden_at IS NULL AND p.created_at >= ${FROM} AND p.created_at < ${TO}
           UNION ALL
           SELECT c.created_at FROM comments c JOIN posts p ON p.id = c.post_id ${OPEN}
           WHERE c.author_id = $1 AND c.hidden_at IS NULL AND c.created_at >= ${FROM} AND c.created_at < ${TO}
         ) a GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1`,
        [userId, start],
      ),
      this.db.query<{ code: string }>(`SELECT code FROM user_badges WHERE user_id = $1 AND created_at >= ${FROM} AND created_at < ${TO} ORDER BY created_at`, [
        userId,
        start,
      ]),
    ]);
    const n = (k: string) => Number(counts?.[k] ?? 0);
    const likes = Number(top?.likes ?? 0);
    const replies = Number(top?.comments ?? 0);
    return {
      stats: {
        posts: n('posts'),
        comments: n('comments'),
        likesReceived: n('likesReceived'),
        reactionsReceived: n('reactionsReceived'),
        views: n('views'),
        cheersGiven: n('cheersGiven'),
      },
      prev: { posts: n('prevPosts'), comments: n('prevComments'), likesReceived: n('prevLikesReceived') },
      // 이번 주에 반응이 하나도 없었으면 '가장 반응이 좋았던 글' 은 없다
      topPost: top && likes + replies > 0 ? { id: top.id, title: top.title, likes, comments: replies, channel: { slug: top.slug, name: top.name } } : undefined,
      topChannel: channel ? { slug: channel.slug, name: channel.name, count: Number(channel.count) } : undefined,
      peakHour: hour?.h,
      badges: badges.map((b) => featuredBadge(b.code)).filter((b): b is FeaturedBadge => !!b),
    };
  }
}

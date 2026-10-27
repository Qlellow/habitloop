import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { TtlCache } from '../common/ttl-cache';
import { Database } from '../db/database';

/**
 * 활동 DNA: 글 · 댓글 · 공감 · 반응을 언제, 어디서, 어떻게 했는지로 커뮤니티 성향을 그린다.
 *  - 다섯 가지 성향(0~100): 글쓰기 · 대화 · 탐험 · 응원 · 깊이
 *  - 가장 활발한 시간대 + 가장 강한 성향 → 유형 이름 ('새벽형 탐험가', '저녁형 이야기꾼' …)
 *  - 최근 활동 순서(글 · 댓글 · 공감 · 반응)는 DNA 가닥의 염기쌍이 된다
 * 공개 채널 · 숨기지 않은 글에서의 활동만 센다 (비공개 채널 활동이 프로필로 새지 않게). 사람마다 10분 캐시
 */
export type DnaTrait = 'create' | 'talk' | 'explore' | 'cheer' | 'depth';
export type DnaPeriod = 'dawn' | 'morning' | 'day' | 'evening' | 'night';
export type DnaBase = 'post' | 'comment' | 'like' | 'reaction';

export interface DnaInput {
  posts: number;
  comments: number;
  likesGiven: number;
  reactionsGiven: number;
  channels: number;
  avgPostLength: number;
  hours: number[];
}

export interface DnaResponse {
  /** 활동이 너무 적으면 아직 DNA 를 그리지 않는다 (유형 없이 숫자만) */
  ready: boolean;
  type?: { period: DnaPeriod; trait: DnaTrait };
  traits: Record<DnaTrait, number>;
  /** 한국 시각 0~23시별 활동 수 (글 + 댓글) */
  hours: number[];
  /** 많이 활동한 채널 (최대 3) */
  channels: { slug: string; name: string; count: number }[];
  /** 최근 활동 순서 (오래된 것 → 최근, 최대 32) */
  sequence: DnaBase[];
  stats: { posts: number; comments: number; likesGiven: number; reactionsGiven: number; likesReceived: number };
}

/** 유형을 붙이려면 글 + 댓글이 이만큼은 있어야 */
const READY_ACTIVITY = 3;
const SEQUENCE = 32;

const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** 시각 → 시간대 (가장 많이 활동한 3시간 묶음의 가운데로) */
export function periodOf(hours: number[]): DnaPeriod {
  let best = 0;
  let at = 12;
  for (let h = 0; h < 24; h++) {
    // 같으면 가운데 시각이 더 많은 쪽
    const sum = (hours[(h + 23) % 24] + hours[h] + hours[(h + 1) % 24]) * 100 + hours[h];
    if (sum > best) [best, at] = [sum, h];
  }
  if (at < 6) return 'dawn';
  if (at < 11) return 'morning';
  if (at < 17) return 'day';
  if (at < 22) return 'evening';
  return 'night';
}

/** 숫자 → 다섯 성향 (서로 비교할 수 있게 0~100) */
export function traitsOf(d: DnaInput): Record<DnaTrait, number> {
  const output = d.posts * 3 + d.comments;
  return {
    create: clamp100(output ? ((d.posts * 3) / output) * 100 : 0),
    talk: clamp100(output ? (d.comments / output) * 100 : 0),
    explore: clamp100((d.channels / 6) * 100),
    cheer: clamp100(((d.likesGiven + d.reactionsGiven) / Math.max(1, d.likesGiven + d.reactionsGiven + d.posts * 2 + d.comments)) * 100),
    depth: clamp100((d.avgPostLength / 800) * 100),
  };
}

/** 가장 강한 성향 (같으면 앞 순서) */
export const topTrait = (t: Record<DnaTrait, number>): DnaTrait =>
  (Object.keys(t) as DnaTrait[]).reduce((a, b) => (t[b] > t[a] ? b : a), 'create');

@Injectable()
export class DnaService {
  private readonly cache = new TtlCache<DnaResponse>(10 * 60_000, 2000);

  constructor(private readonly db: Database) {}

  async of(uid: string): Promise<DnaResponse> {
    const user = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid)
      ? await this.db.one<{ id: number }>('SELECT id FROM users WHERE uid::text = $1 AND withdrawn_at IS NULL', [uid.toLowerCase()])
      : undefined;
    if (!user) throw ApiError.notFound('없는 사용자예요');
    return this.cache.getOrLoad(String(user.id), () => this.load(user.id));
  }

  /** 배지(DNA 완성)용: 사람 id 로 (캐시를 함께 쓴다) */
  ofUser(userId: number): Promise<DnaResponse> {
    return this.cache.getOrLoad(String(userId), () => this.load(userId));
  }

  private async load(userId: number): Promise<DnaResponse> {
    const OPEN = `JOIN channels ch ON ch.id = p.channel_id AND ch.visibility = 'public'`;
    const [counts, hourRows, channels, seq] = await Promise.all([
      this.db.one<Record<string, string>>(
        `SELECT
           (SELECT count(*) FROM posts p ${OPEN} WHERE p.author_id = $1 AND p.hidden_at IS NULL) AS posts,
           (SELECT count(*) FROM comments c JOIN posts p ON p.id = c.post_id ${OPEN} WHERE c.author_id = $1 AND c.hidden_at IS NULL) AS comments,
           (SELECT count(*) FROM post_likes l JOIN posts p ON p.id = l.post_id ${OPEN} WHERE l.user_id = $1) AS "likesGiven",
           (SELECT count(*) FROM post_reactions r JOIN posts p ON p.id = r.post_id ${OPEN} WHERE r.user_id = $1) AS "reactionsGiven",
           (SELECT coalesce(sum(p.like_count), 0) FROM posts p ${OPEN} WHERE p.author_id = $1 AND p.hidden_at IS NULL) AS "likesReceived",
           (SELECT coalesce(avg(char_length(p.content)), 0) FROM posts p ${OPEN} WHERE p.author_id = $1 AND p.hidden_at IS NULL) AS "avgPostLength"`,
        [userId],
      ),
      this.db.query<{ h: number; n: string }>(
        `SELECT extract(hour FROM t AT TIME ZONE 'Asia/Seoul')::int AS h, count(*) AS n FROM (
           SELECT p.created_at AS t FROM posts p ${OPEN} WHERE p.author_id = $1 AND p.hidden_at IS NULL
           UNION ALL
           SELECT c.created_at FROM comments c JOIN posts p ON p.id = c.post_id ${OPEN} WHERE c.author_id = $1 AND c.hidden_at IS NULL
         ) a GROUP BY 1`,
        [userId],
      ),
      this.db.query<{ slug: string; name: string; count: string }>(
        `SELECT ch.slug, ch.name, count(*) AS count FROM (
           SELECT p.channel_id FROM posts p WHERE p.author_id = $1 AND p.hidden_at IS NULL
           UNION ALL
           SELECT p.channel_id FROM comments c JOIN posts p ON p.id = c.post_id WHERE c.author_id = $1 AND c.hidden_at IS NULL
         ) a JOIN channels ch ON ch.id = a.channel_id AND ch.visibility = 'public' AND NOT ch.adult
         GROUP BY ch.id ORDER BY count(*) DESC, ch.id LIMIT 6`,
        [userId],
      ),
      this.db.query<{ kind: DnaBase }>(
        `SELECT kind FROM (
           SELECT 'post' AS kind, p.created_at AS t FROM posts p ${OPEN} WHERE p.author_id = $1 AND p.hidden_at IS NULL
           UNION ALL SELECT 'comment', c.created_at FROM comments c JOIN posts p ON p.id = c.post_id ${OPEN} WHERE c.author_id = $1 AND c.hidden_at IS NULL
           UNION ALL SELECT 'like', l.created_at FROM post_likes l JOIN posts p ON p.id = l.post_id ${OPEN} WHERE l.user_id = $1
           UNION ALL SELECT 'reaction', r.created_at FROM post_reactions r JOIN posts p ON p.id = r.post_id ${OPEN} WHERE r.user_id = $1
         ) a ORDER BY t DESC LIMIT ${SEQUENCE}`,
        [userId],
      ),
    ]);
    const n = (k: string) => Number(counts?.[k] ?? 0);
    const hours = Array.from({ length: 24 }, () => 0);
    for (const r of hourRows) hours[r.h] = Number(r.n);
    const input: DnaInput = {
      posts: n('posts'),
      comments: n('comments'),
      likesGiven: n('likesGiven'),
      reactionsGiven: n('reactionsGiven'),
      channels: channels.length,
      avgPostLength: n('avgPostLength'),
      hours,
    };
    const traits = traitsOf(input);
    const ready = input.posts + input.comments >= READY_ACTIVITY;
    return {
      ready,
      type: ready ? { period: periodOf(hours), trait: topTrait(traits) } : undefined,
      traits,
      hours,
      channels: channels.slice(0, 3).map((c) => ({ ...c, count: Number(c.count) })),
      sequence: seq.map((r) => r.kind).reverse(),
      stats: { posts: input.posts, comments: input.comments, likesGiven: input.likesGiven, reactionsGiven: input.reactionsGiven, likesReceived: n('likesReceived') },
    };
  }
}

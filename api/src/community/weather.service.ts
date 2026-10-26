import { Injectable } from '@nestjs/common';
import { TtlCache } from '../common/ttl-cache';
import { Database } from '../db/database';

/**
 * 커뮤니티 감정 날씨: 최근 24시간의 글 · 댓글 · 공감 · 감정 반응으로 커뮤니티 분위기를 날씨로 나타낸다.
 *  calm 잔잔함(조용한 날) · sunny 맑음(즐거운 날) · hot 쨍쨍(뜨거운 날) · partly 구름 조금 ·
 *  windy 바람(놀라운 소식) · cloudy 흐림(고민이 많은 날) · rain 비(위로가 필요한 날)
 * 모두에게 같은 결과라 5분 동안 재사용한다
 */
export type Weather = 'calm' | 'sunny' | 'hot' | 'partly' | 'windy' | 'cloudy' | 'rain';

export interface MoodStats {
  posts: number;
  comments: number;
  likes: number;
  clap: number;
  laugh: number;
  wow: number;
  sad: number;
  fire: number;
}

export interface WeatherResponse {
  weather: Weather;
  /** 체감 온도 (활동이 많을수록 높다, 8 ~ 35) */
  temperature: number;
  /** 활동량 (글 × 3 + 댓글 × 2 + 공감 + 반응) */
  activity: number;
  stats: MoodStats;
  updatedAt: Date;
}

/** 활동이 이보다 적으면 '잔잔함' */
const CALM_ACTIVITY = 8;
/** '쨍쨍'은 활동이 이만큼은 있어야 */
const HOT_ACTIVITY = 40;

/** 통계 → 날씨 (순서대로 처음 맞는 것) */
export function weatherOf(s: MoodStats): { weather: Weather; temperature: number; activity: number } {
  const moods = s.likes + s.clap + s.laugh + s.wow + s.sad + s.fire;
  const activity = s.posts * 3 + s.comments * 2 + moods;
  const temperature = Math.round(8 + Math.min(27, activity * 0.4));
  const share = (n: number) => n / Math.max(1, moods);
  let weather: Weather;
  if (activity < CALM_ACTIVITY) weather = 'calm';
  else if (share(s.sad) >= 0.4) weather = 'rain';
  else if (share(s.sad) >= 0.2) weather = 'cloudy';
  else if (share(s.wow) >= 0.3) weather = 'windy';
  else if (share(s.fire + s.laugh) >= 0.45 && activity >= HOT_ACTIVITY) weather = 'hot';
  else if (share(s.likes + s.clap + s.laugh + s.fire) >= 0.6) weather = 'sunny';
  else weather = 'partly';
  return { weather, temperature, activity };
}

@Injectable()
export class WeatherService {
  private readonly cache = new TtlCache<WeatherResponse>(5 * 60_000, 1);

  constructor(private readonly db: Database) {}

  now(): Promise<WeatherResponse> {
    return this.cache.getOrLoad('now', async () => {
      // 공개 채널 · 숨기지 않은 글만 (비공개 채널의 분위기는 밖으로 새지 않게)
      // 최근 24시간 것만 created_at 인덱스로 먼저 고르고, 그 글이 공개 채널 · 숨기지 않은 글인지 확인한다
      // (전체 글을 훑지 않게 글 목록을 먼저 만들지 않는다)
      const open = (alias: string) =>
        `EXISTS (SELECT 1 FROM posts p JOIN channels c ON c.id = p.channel_id
                 WHERE p.id = ${alias}.post_id AND c.visibility = 'public' AND p.hidden_at IS NULL)`;
      const since = "now() - interval '24 hours'";
      const row = await this.db.one<Record<keyof MoodStats, string>>(
        `SELECT
           (SELECT count(*) FROM posts p JOIN channels c ON c.id = p.channel_id
             WHERE p.created_at >= ${since} AND c.visibility = 'public' AND p.hidden_at IS NULL) AS posts,
           (SELECT count(*) FROM comments m WHERE m.created_at >= ${since} AND m.hidden_at IS NULL AND ${open('m')}) AS comments,
           (SELECT count(*) FROM post_likes l WHERE l.created_at >= ${since} AND ${open('l')}) AS likes,
           ${(['clap', 'laugh', 'wow', 'sad', 'fire'] as const)
             .map((k) => `(SELECT count(*) FROM post_reactions r WHERE r.created_at >= ${since} AND r.kind = '${k}' AND ${open('r')}) AS ${k}`)
             .join(',\n           ')}`,
      );
      const stats = Object.fromEntries(Object.entries(row ?? {}).map(([k, v]) => [k, Number(v)])) as unknown as MoodStats;
      return { ...weatherOf(stats), stats, updatedAt: new Date() };
    });
  }
}

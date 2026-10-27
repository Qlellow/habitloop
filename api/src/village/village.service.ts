import { Injectable } from '@nestjs/common';
import { ChannelsService } from '../channels/channels.service';
import { TtlCache } from '../common/ttl-cache';
import { Database } from '../db/database';
import { BRICKS, VILLAGE, weeklyGoal } from './catalog';

const KST = "'Asia/Seoul'";
/** 이번 주 월요일 0시 (한국 시간) */
const WEEK_START = `(date_trunc('week', now() AT TIME ZONE ${KST}) AT TIME ZONE ${KST})`;
const NEW_DAYS = 3;

interface Counts {
  posts: number;
  comments: number;
  reactions: number;
  followers: number;
}

const bricksOf = (c: Counts) => c.posts * BRICKS.post + c.comments * BRICKS.comment + c.reactions * BRICKS.reaction + c.followers * BRICKS.follower;

/** 기간 안의 활동 수 ($2 ≤ 시각 < $3, 둘 다 없으면 전체) */
const COUNTS_SQL = `SELECT
  (SELECT count(*) FROM posts p WHERE p.channel_id = $1 AND p.hidden_at IS NULL
     AND ($2::timestamptz IS NULL OR p.created_at >= $2) AND ($3::timestamptz IS NULL OR p.created_at < $3))::int AS posts,
  (SELECT count(*) FROM comments c JOIN posts p ON p.id = c.post_id WHERE p.channel_id = $1 AND c.hidden_at IS NULL
     AND ($2::timestamptz IS NULL OR c.created_at >= $2) AND ($3::timestamptz IS NULL OR c.created_at < $3))::int AS comments,
  ((SELECT count(*) FROM post_likes l JOIN posts p ON p.id = l.post_id WHERE p.channel_id = $1
     AND ($2::timestamptz IS NULL OR l.created_at >= $2) AND ($3::timestamptz IS NULL OR l.created_at < $3))
   + (SELECT count(*) FROM post_reactions r JOIN posts p ON p.id = r.post_id WHERE p.channel_id = $1
     AND ($2::timestamptz IS NULL OR r.created_at >= $2) AND ($3::timestamptz IS NULL OR r.created_at < $3)))::int AS reactions,
  (SELECT count(*) FROM channel_members m WHERE m.channel_id = $1 AND m.role <> 'OWNER'
     AND ($2::timestamptz IS NULL OR m.joined_at >= $2) AND ($3::timestamptz IS NULL OR m.joined_at < $3))::int AS followers`;

/**
 * 채널 마을: 채널 활동(벽돌)으로 자라는 공동 마을.
 * 누적 벽돌은 지금까지의 최고치를 저장해 두므로(글이 지워져도) 한 번 생긴 건물은 사라지지 않는다.
 * 계산은 채널마다 30초 캐시
 */
@Injectable()
export class VillageService {
  private readonly cache = new TtlCache<object>(30_000, 2000);

  constructor(
    private readonly db: Database,
    private readonly channels: ChannelsService,
  ) {}

  async village(slug: string, viewerId?: number) {
    const channel = await this.channels.findBySlug(slug);
    await this.channels.requireAccess(channel, viewerId);
    return this.cache.getOrLoad(String(channel.id), () => this.build(channel.id));
  }

  private counts(channelId: number, from: string | null, to: string | null) {
    return this.db.one<Counts>(COUNTS_SQL, [channelId, from, to]).then((c) => c!);
  }

  private async build(channelId: number) {
    const range = (await this.db.one<{ week: string; last: string }>(
      `SELECT ${WEEK_START} AS week, ${WEEK_START} - interval '7 days' AS last`,
    ))!;
    const [total, week, lastWeek, saved, contributors] = await Promise.all([
      this.counts(channelId, null, null),
      this.counts(channelId, range.week, null),
      this.counts(channelId, range.last, range.week),
      this.db.one<{ peak: number; unlocked: Record<string, string> }>('SELECT peak, unlocked FROM channel_villages WHERE channel_id = $1', [channelId]),
      this.contributors(channelId, range.week),
    ]);

    // 최고치를 올리고, 새로 넘은 목표의 건물을 해금 시각과 함께 남긴다
    const now = bricksOf(total);
    const peak = Math.max(now, saved?.peak ?? 0);
    const unlocked = { ...(saved?.unlocked ?? {}) };
    let changed = !saved || peak !== saved.peak;
    for (const item of VILLAGE) {
      if (item.bricks <= peak && !unlocked[item.code]) {
        // 마을이 처음 생길 때 이미 넘어 있던 건물은 '새로 생김' 표시 없이
        unlocked[item.code] = saved ? new Date().toISOString() : '1970-01-01T00:00:00.000Z';
        changed = true;
      }
    }
    if (changed) {
      await this.db.execute(
        `INSERT INTO channel_villages (channel_id, peak, unlocked) VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (channel_id) DO UPDATE SET peak = GREATEST(channel_villages.peak, EXCLUDED.peak),
           unlocked = channel_villages.unlocked || EXCLUDED.unlocked, updated_at = now()`,
        [channelId, peak, JSON.stringify(unlocked)],
      );
    }

    const level = Object.keys(unlocked).length;
    const next = VILLAGE.find((i) => !unlocked[i.code]);
    const newSince = Date.now() - NEW_DAYS * 86_400_000;
    const goal = weeklyGoal(level);
    return {
      bricks: peak,
      level,
      maxLevel: VILLAGE.length,
      next: next && { code: next.code, name: next.name, bricks: next.bricks, need: next.bricks - peak },
      /** 지금 쌓여 있는 벽돌의 출처 */
      breakdown: total,
      items: VILLAGE.map((i) => {
        const at = unlocked[i.code];
        return {
          code: i.code,
          name: i.name,
          description: i.description,
          kind: i.kind,
          bricks: i.bricks,
          unlocked: !!at,
          unlockedAt: at && !at.startsWith('1970') ? at : undefined,
          isNew: !!at && Date.parse(at) > newSince,
        };
      }),
      week: { bricks: bricksOf(week), goal, from: range.week },
      /** 지난주 공동 목표를 넘겼으면 이번 주 내내 축제 (등불 · 폭죽) */
      festival: bricksOf(lastWeek) >= goal,
      contributors,
    };
  }

  /** 이번 주 마을에 벽돌을 가장 많이 쌓은 사람 (5명) */
  private contributors(channelId: number, from: string) {
    return this.db
      .query<{ id: string; nickname: string; avatarUrl: string | null; bricks: number }>(
        `SELECT u.uid::text AS id, u.nickname,
                CASE WHEN u.avatar_id IS NULL THEN NULL ELSE '/api/images/' || u.avatar_id END AS "avatarUrl",
                sum(a.pts)::int AS bricks
         FROM (
           SELECT author_id AS uid, ${BRICKS.post} AS pts FROM posts WHERE channel_id = $1 AND hidden_at IS NULL AND created_at >= $2
           UNION ALL SELECT c.author_id, ${BRICKS.comment} FROM comments c JOIN posts p ON p.id = c.post_id
             WHERE p.channel_id = $1 AND c.hidden_at IS NULL AND c.created_at >= $2
           UNION ALL SELECT l.user_id, ${BRICKS.reaction} FROM post_likes l JOIN posts p ON p.id = l.post_id WHERE p.channel_id = $1 AND l.created_at >= $2
           UNION ALL SELECT r.user_id, ${BRICKS.reaction} FROM post_reactions r JOIN posts p ON p.id = r.post_id WHERE p.channel_id = $1 AND r.created_at >= $2
         ) a JOIN users u ON u.id = a.uid AND u.withdrawn_at IS NULL
         GROUP BY u.id ORDER BY bricks DESC, u.id ASC LIMIT 5`,
        [channelId, from],
      )
      .then((rows) => rows.map((r) => ({ ...r, avatarUrl: r.avatarUrl ?? undefined })));
  }
}

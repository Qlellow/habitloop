import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { TtlCache } from '../common/ttl-cache';
import { Database } from '../db/database';
import { NotificationsService } from '../notifications/notifications.service';
import { BlocksService } from '../users/blocks.service';
import { RewardsService } from '../users/rewards.service';
import { SELECT_SUMMARY, toSummary, type PostSummary } from './posts.service';

/** 왜 골랐는지 (화면에 짧은 이유로 보인다) */
export type DiscoveryReason = 'talk' | 'warm' | 'long' | 'hidden';

export interface DiscoveryResponse {
  /** 한국 날짜 (YYYY-MM-DD) */
  day: string;
  reason?: DiscoveryReason;
  /** 오늘 고를 글이 없거나, 보는 사람이 그 글쓴이를 차단했으면 비어 있다 */
  post?: PostSummary;
  /** 지난 발견 (어제부터 최근 6일) */
  past: { day: string; post: { id: number; title: string; channelName: string } }[];
}

const TODAY = "(now() AT TIME ZONE 'Asia/Seoul')::date";
/** 이만큼 지난 글 중에서 (방금 올라온 글은 아직 반응이 모일 시간이 없었다) */
const MIN_AGE_HOURS = 3;
const MAX_AGE_DAYS = 14;
/** 공감이 이보다 많으면 이미 충분히 주목받은 글 */
const MAX_LIKES = 5;
/** 같은 사람이 이 기간 안에 또 뽑히지 않게 */
const AUTHOR_COOLDOWN_DAYS = 7;
/** 점수 상위 몇 개 중에서 날짜로 하나를 고른다 (매일 같은 기준이라도 다양하게) */
const SHORTLIST = 5;

interface Candidate {
  id: number;
  authorId: number;
  likes: number;
  comments: number;
  views: number;
  length: number;
  score: number;
}

/**
 * 오늘의 발견: 조회수 · 공감이 적어도 흥미로운 글을 매일 하나 골라 소개한다 (인기 글에만 관심이 쏠리지 않게).
 *  - 후보: 3시간 ~ 14일 된 공개 채널 글, 숨기지 않음, 공감 5개 이하, 이번 주 인기글(공감 받은 글 상위 5개) 밖, 한 번도 뽑힌 적 없음, 글쓴이가 최근 7일 안에 뽑히지 않음
 *  - 점수: (댓글 × 3 + 공감 × 2) ÷ (1 + 조회/30) + 글 길이(최대 3000자) ÷ 600 + 사진 1
 *    → 본 사람에 비해 반응이 좋거나, 정성 들인 긴 글
 *  - 그날 처음 볼 때 골라 기록하고(하루 종일 같은 글), 글쓴이에게 알림 + 30P
 */
@Injectable()
export class DiscoveryService {
  private readonly cache = new TtlCache<Omit<DiscoveryResponse, 'post'> & { post?: PostSummary }>(60_000, 4);

  constructor(
    private readonly db: Database,
    private readonly blocks: BlocksService,
    private readonly notifications: NotificationsService,
    private readonly rewards: RewardsService,
  ) {}

  async today(viewerId?: number): Promise<DiscoveryResponse> {
    const day = await this.dayKey();
    const [base, blocked] = await Promise.all([this.cache.getOrLoad(day, () => this.load(day)), this.blocks.blockedUids(viewerId)]);
    if (base.post && blocked.has(base.post.authorId)) return { ...base, reason: undefined, post: undefined };
    return base;
  }

  private async dayKey(): Promise<string> {
    const row = await this.db.one<{ day: string }>(`SELECT to_char(${TODAY}, 'YYYY-MM-DD') AS day`);
    return row!.day;
  }

  private async load(day: string): Promise<DiscoveryResponse> {
    let picked = await this.picked(day);
    if (!picked) {
      const choice = await this.choose(day);
      if (choice) {
        const inserted = await this.db.execute(
          'INSERT INTO daily_discoveries (day, post_id, reason) VALUES ($1::date, $2, $3) ON CONFLICT (day) DO NOTHING',
          [day, choice.post.id, choice.reason],
        );
        // 동시에 두 요청이 골랐으면 먼저 넣은 쪽만 알림 · 포인트
        if (inserted) {
          await this.notifications.discovered(choice.post.id, choice.authorId);
          await this.rewards.discovered(choice.authorId).catch(() => undefined);
        }
        picked = await this.picked(day);
      }
    }
    const past = await this.db.query<{ day: string; id: number; title: string; channelName: string }>(
      `SELECT to_char(d.day, 'YYYY-MM-DD') AS day, p.id, p.title, c.name AS "channelName"
       FROM daily_discoveries d JOIN posts p ON p.id = d.post_id JOIN channels c ON c.id = p.channel_id
       WHERE d.day < $1::date AND d.day >= $1::date - 6 AND p.hidden_at IS NULL
       ORDER BY d.day DESC`,
      [day],
    );
    return { day, reason: picked?.reason, post: picked?.post, past: past.map(({ day: d, ...post }) => ({ day: d, post })) };
  }

  private async picked(day: string): Promise<{ post: PostSummary; reason: DiscoveryReason } | undefined> {
    const pick = await this.db.one<{ postId: number; reason: DiscoveryReason }>(
      'SELECT post_id AS "postId", reason FROM daily_discoveries WHERE day = $1::date',
      [day],
    );
    if (!pick) return undefined;
    const row = await this.db.one(`${SELECT_SUMMARY} WHERE p.id = $1 AND p.hidden_at IS NULL`, [pick.postId]);
    return row ? { post: toSummary(row), reason: pick.reason } : undefined;
  }

  private async choose(day: string): Promise<{ post: PostSummary; authorId: number; reason: DiscoveryReason } | undefined> {
    const rows = await this.db.query<Candidate>(
      `SELECT p.id, p.author_id AS "authorId", p.like_count AS likes, p.comment_count AS comments, p.view_count AS views,
              char_length(p.content) AS length,
              (p.comment_count * 3 + p.like_count * 2) / (1 + p.view_count / 30.0)
                + LEAST(char_length(p.content), 3000) / 600.0
                + CASE WHEN p.content LIKE '%](/api/images/%' THEN 1 ELSE 0 END AS score
       FROM posts p
       JOIN channels c ON c.id = p.channel_id
       LEFT JOIN channel_categories cat ON cat.id = p.category_id
       WHERE p.created_at <= now() - interval '${MIN_AGE_HOURS} hours'
         AND p.created_at >= now() - interval '${MAX_AGE_DAYS} days'
         AND p.hidden_at IS NULL AND c.visibility = 'public' AND NOT c.adult AND cat.adult IS NOT TRUE
         AND p.like_count <= ${MAX_LIKES} AND char_length(p.content) >= 80
         AND p.id NOT IN (SELECT post_id FROM daily_discoveries)
         AND p.author_id NOT IN (
           SELECT q.author_id FROM daily_discoveries d JOIN posts q ON q.id = d.post_id
           WHERE d.day > $1::date - ${AUTHOR_COOLDOWN_DAYS})
         AND p.id NOT IN (
           -- 이번 주 인기글(공감을 받은 글 중 상위 5개)은 이미 주목받았다
           SELECT id FROM posts WHERE created_at >= now() - interval '7 days' AND hidden_at IS NULL AND like_count > 0
           ORDER BY like_count DESC, comment_count DESC, id DESC LIMIT 5)
       ORDER BY score DESC, p.id DESC
       LIMIT ${SHORTLIST}`,
      [day],
    );
    if (!rows.length) return undefined;
    // 날짜로 정해지는 순번: 같은 날에는 언제 물어도 같은 글
    const n = createHash('sha256').update(`discovery:${day}`).digest().readUInt32BE(0) % rows.length;
    const c = rows[n];
    const row = await this.db.one(`${SELECT_SUMMARY} WHERE p.id = $1`, [c.id]);
    if (!row) return undefined;
    return { post: toSummary(row), authorId: c.authorId, reason: reasonOf(c) };
  }
}

/** 고른 이유: 가장 두드러진 점 하나 */
export function reasonOf(c: Pick<Candidate, 'likes' | 'comments' | 'views' | 'length'>): DiscoveryReason {
  const perView = (n: number) => n / Math.max(1, c.views);
  if (c.comments >= 3 && perView(c.comments) >= 0.1) return 'talk';
  if (c.likes >= 1 && perView(c.likes) >= 0.15) return 'warm';
  if (c.length >= 800) return 'long';
  return 'hidden';
}

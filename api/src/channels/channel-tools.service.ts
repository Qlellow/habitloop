import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { TtlCache } from '../common/ttl-cache';
import { Database } from '../db/database';
import { ChannelsService } from './channels.service';
import { canManage, isStaff } from './roles';

/**
 * 채널 운영 도구.
 *  - 자동 검열: 운영진이 정한 금칙어가 들어간 글 · 댓글은 올라가지 않는다. 링크 제한을 켜면 운영진만 바깥 링크를 쓸 수 있다.
 *    운영진은 검열을 받지 않는다 (공지에 금칙어 목록을 적을 수 있게)
 *  - 랭킹 시즌: 한 달(한국 시각) 동안 이 채널에서 한 활동 점수 순위. 글 5점 · 댓글 2점 · 받은 공감 1점
 *    (한 달에 글 30개 · 댓글 100개까지만 센다). 달이 바뀐 뒤 처음 열어 볼 때 지난 시즌 1~3위를 기록하고 포인트를 준다
 */
export type LinkPolicy = 'all' | 'staff';
export const LINK_POLICIES: LinkPolicy[] = ['all', 'staff'];
export const MAX_BANNED_WORDS = 50;
const SEASON = /^\d{4}-(0[1-9]|1[0-2])$/;
const RANK_SIZE = 20;
const PRIZES = [300, 200, 100];
const KST = "'Asia/Seoul'";
/** 사이트 밖으로 가는 링크 (본문 이미지 /api/images · 사이트 안 상대 주소는 괜찮다) */
const OUTSIDE_LINK = /\bhttps?:\/\/|\bwww\.[a-z0-9-]+\.[a-z]/i;

export interface RankRow {
  rank: number;
  user: { id: string; nickname: string; avatarUrl?: string };
  score: number;
  posts: number;
  comments: number;
  likes: number;
}

@Injectable()
export class ChannelToolsService {
  private readonly rankCache = new TtlCache<RankRow[]>(60_000, 500);

  constructor(
    private readonly db: Database,
    private readonly channels: ChannelsService,
  ) {}

  /* ───── 자동 검열 ───── */

  /** 글 · 댓글을 올리기 전에: 걸리면 400 (어떤 말 때문인지 알려 준다) */
  async check(channelId: number, userId: number, text: string) {
    const rule = await this.db.one<{ words: string[]; linkPolicy: LinkPolicy }>(
      'SELECT banned_words AS words, link_policy AS "linkPolicy" FROM channels WHERE id = $1',
      [channelId],
    );
    if (!rule || (!rule.words.length && rule.linkPolicy === 'all')) return;
    if (isStaff(await this.channels.roleOf(channelId, userId))) return;
    const lower = text.toLowerCase();
    const hit = rule.words.find((w) => lower.includes(w));
    if (hit) throw ApiError.badRequest(`이 채널에서는 쓸 수 없는 말이 들어 있어요: '${hit}'`);
    if (rule.linkPolicy === 'staff' && OUTSIDE_LINK.test(text)) throw ApiError.badRequest('이 채널은 운영진만 바깥 링크를 올릴 수 있어요');
  }

  async automod(slug: string, userId: number) {
    const channel = await this.channels.findBySlug(slug);
    if (!canManage(await this.channels.roleOf(channel.id, userId))) throw ApiError.forbidden('채널 소유자와 관리자만 할 수 있어요');
    const row = await this.db.one<{ bannedWords: string[]; linkPolicy: LinkPolicy }>(
      'SELECT banned_words AS "bannedWords", link_policy AS "linkPolicy" FROM channels WHERE id = $1',
      [channel.id],
    );
    return row!;
  }

  async setAutomod(slug: string, userId: number, input: { bannedWords?: unknown; linkPolicy?: unknown }) {
    const channel = await this.channels.findBySlug(slug);
    if (!canManage(await this.channels.roleOf(channel.id, userId))) throw ApiError.forbidden('채널 소유자와 관리자만 할 수 있어요');
    const raw = input.bannedWords;
    if (!Array.isArray(raw) || raw.some((w) => typeof w !== 'string')) throw ApiError.badRequest('금칙어 목록을 보내 주세요');
    const words = [...new Set((raw as string[]).map((w) => w.trim().toLowerCase()).filter(Boolean))];
    if (words.length > MAX_BANNED_WORDS) throw ApiError.badRequest(`금칙어는 ${MAX_BANNED_WORDS}개까지예요`);
    if (words.some((w) => w.length > 30)) throw ApiError.badRequest('금칙어는 30자까지예요');
    if (!LINK_POLICIES.includes(input.linkPolicy as LinkPolicy)) throw ApiError.badRequest('링크 제한을 다시 골라 주세요');
    await this.db.execute('UPDATE channels SET banned_words = $2, link_policy = $3 WHERE id = $1', [channel.id, words, input.linkPolicy]);
    return { bannedWords: words, linkPolicy: input.linkPolicy as LinkPolicy };
  }

  /* ───── 랭킹 시즌 ───── */

  private async currentSeason() {
    return (await this.db.one<{ s: string }>(`SELECT to_char(now() AT TIME ZONE ${KST}, 'YYYY-MM') AS s`))!.s;
  }

  private prevSeason(season: string) {
    const [y, m] = season.split('-').map(Number);
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  }

  /** 한 시즌의 순위 (상위 20명) */
  private rows(channelId: number, season: string): Promise<RankRow[]> {
    return this.rankCache.getOrLoad(`${channelId}:${season}`, async () => {
      const FROM = `((($2 || '-01')::date)::timestamp AT TIME ZONE ${KST})`;
      const TO = `((($2 || '-01')::date + interval '1 month')::timestamp AT TIME ZONE ${KST})`;
      const rows = await this.db.query<{ uid: string; nickname: string; avatarUrl: string | null; posts: number; comments: number; likes: number }>(
        `WITH p AS (
           SELECT author_id AS u, count(*)::int AS n FROM posts
           WHERE channel_id = $1 AND hidden_at IS NULL AND created_at >= ${FROM} AND created_at < ${TO} GROUP BY 1
         ), c AS (
           SELECT c.author_id AS u, count(*)::int AS n FROM comments c JOIN posts p ON p.id = c.post_id
           WHERE p.channel_id = $1 AND c.hidden_at IS NULL AND c.created_at >= ${FROM} AND c.created_at < ${TO} GROUP BY 1
         ), l AS (
           SELECT p.author_id AS u, count(*)::int AS n FROM post_likes l JOIN posts p ON p.id = l.post_id
           WHERE p.channel_id = $1 AND p.hidden_at IS NULL AND l.user_id <> p.author_id AND l.created_at >= ${FROM} AND l.created_at < ${TO} GROUP BY 1
         )
         SELECT u.uid::text AS uid, u.nickname, CASE WHEN u.avatar_id IS NULL THEN NULL ELSE '/api/images/' || u.avatar_id END AS "avatarUrl",
                coalesce(p.n, 0) AS posts, coalesce(c.n, 0) AS comments, coalesce(l.n, 0) AS likes
         FROM (SELECT u FROM p UNION SELECT u FROM c UNION SELECT u FROM l) a
         JOIN users u ON u.id = a.u AND u.withdrawn_at IS NULL
         LEFT JOIN p ON p.u = a.u LEFT JOIN c ON c.u = a.u LEFT JOIN l ON l.u = a.u`,
        [channelId, season],
      );
      return rows
        .map((r) => ({
          user: { id: r.uid, nickname: r.nickname, avatarUrl: r.avatarUrl ?? undefined },
          posts: r.posts,
          comments: r.comments,
          likes: r.likes,
          score: Math.min(r.posts, 30) * 5 + Math.min(r.comments, 100) * 2 + r.likes,
        }))
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score || b.likes - a.likes || a.user.nickname.localeCompare(b.user.nickname))
        .slice(0, RANK_SIZE)
        .map((r, i) => ({ rank: i + 1, ...r }));
    });
  }

  /** 끝난 시즌의 1~3위를 한 번만 기록하고 포인트를 준다 */
  private async finalize(channelId: number, season: string) {
    const top = (await this.rows(channelId, season)).slice(0, PRIZES.length);
    for (const r of top) {
      await this.db.transaction(async () => {
        const added = await this.db.query<{ userId: number }>(
          `INSERT INTO channel_season_winners (channel_id, season, rank, user_id, score)
           SELECT $1, $2, $3, id, $5 FROM users WHERE uid::text = $4
           ON CONFLICT DO NOTHING RETURNING user_id AS "userId"`,
          [channelId, season, r.rank, r.user.id, r.score],
        );
        for (const a of added) {
          const prize = PRIZES[r.rank - 1];
          const name = (await this.db.one<{ name: string }>('SELECT name FROM channels WHERE id = $1', [channelId]))?.name ?? '';
          await this.db.execute('UPDATE users SET points = points + $1 WHERE id = $2', [prize, a.userId]);
          await this.db.execute('INSERT INTO point_logs (user_id, delta, reason) VALUES ($1, $2, $3)', [
            a.userId,
            prize,
            `${name} ${season} 시즌 ${r.rank}위`.slice(0, 40),
          ]);
        }
      });
    }
  }

  async ranking(slug: string, raw: string | undefined, viewerId?: number) {
    const channel = await this.channels.findBySlug(slug);
    await this.channels.requireAccess(channel, viewerId);
    const current = await this.currentSeason();
    const season = raw ?? current;
    if (!SEASON.test(season)) throw ApiError.badRequest('시즌을 YYYY-MM 으로 알려 주세요');
    if (season > current) throw ApiError.badRequest('아직 오지 않은 시즌이에요');
    const first = (await this.db.one<{ s: string }>(`SELECT to_char(created_at AT TIME ZONE ${KST}, 'YYYY-MM') AS s FROM channels WHERE id = $1`, [
      channel.id,
    ]))!.s;
    if (season < first) throw ApiError.badRequest('채널이 생기기 전 시즌이에요');
    // 지난 시즌 마무리 (처음 열어 본 사람이 기록을 남긴다)
    const prev = this.prevSeason(current);
    if (prev >= first) await this.finalize(channel.id, prev);
    if (season < current) await this.finalize(channel.id, season);
    const ranks = await this.rows(channel.id, season);
    const me = viewerId == null ? undefined : (await this.db.one<{ uid: string }>('SELECT uid::text AS uid FROM users WHERE id = $1', [viewerId]))?.uid;
    return {
      season,
      current: season === current,
      firstSeason: first,
      ranks,
      me: me ? (ranks.find((r) => r.user.id === me) ?? null) : undefined,
      prizes: PRIZES,
    };
  }
}

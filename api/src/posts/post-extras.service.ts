import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { Database } from '../db/database';

/**
 * 글에 붙는 것들: 투표 · 시리즈(연재).
 *  - 투표: 선택지 2~6개 · 여러 개 고르기 · 마감 시각. 결과는 투표했거나 마감됐거나 글쓴이일 때만 (먼저 보고 따라 고르지 않게)
 *  - 시리즈: 글쓴이가 만든 묶음. 글 보기에서 같은 시리즈의 이전 · 다음 화와 목차를 보여 준다
 */
export interface PollInput {
  options: string[];
  multiple: boolean;
  closesInHours: number | null;
}

export interface PollView {
  multiple: boolean;
  closesAt: Date | null;
  closed: boolean;
  /** 결과를 볼 수 있는지 (투표함 · 마감 · 글쓴이) */
  revealed: boolean;
  total: number;
  /** 투표한 사람 수 */
  voters: number;
  options: { id: number; label: string; votes?: number }[];
  myVotes: number[];
}

export interface SeriesView {
  id: number;
  title: string;
  /** 같은 시리즈의 글 (올린 순서), 지금 글의 위치 */
  posts: { id: number; title: string }[];
  index: number;
}

const MAX_OPTIONS = 6;
const MAX_HOURS = 24 * 30;
const MAX_SERIES_POSTS = 200;

@Injectable()
export class PostExtrasService {
  constructor(private readonly db: Database) {}

  /* ───── 투표 ───── */

  parsePoll(raw: { options?: unknown; multiple?: unknown; closesInHours?: unknown } | undefined): PollInput | undefined {
    if (!raw) return undefined;
    if (!Array.isArray(raw.options)) throw ApiError.badRequest('투표 선택지를 넣어 주세요');
    const options = raw.options.map((o) => (typeof o === 'string' ? o.trim() : '')).filter(Boolean);
    if (options.length < 2 || options.length > MAX_OPTIONS) throw ApiError.badRequest(`투표 선택지는 2~${MAX_OPTIONS}개로 만들어 주세요`);
    if (options.some((o) => o.length > 50)) throw ApiError.badRequest('투표 선택지는 50자 이내로 입력해 주세요');
    if (new Set(options).size !== options.length) throw ApiError.badRequest('같은 선택지가 두 번 있어요');
    const hours = raw.closesInHours == null ? null : Number(raw.closesInHours);
    if (hours != null && (!Number.isInteger(hours) || hours < 1 || hours > MAX_HOURS)) throw ApiError.badRequest('투표 마감은 1시간 ~ 30일 사이로 정해 주세요');
    return { options, multiple: raw.multiple === true, closesInHours: hours };
  }

  async createPoll(postId: number, poll: PollInput) {
    await this.db.execute(
      `INSERT INTO polls (post_id, multiple, closes_at) VALUES ($1, $2, CASE WHEN $3::int IS NULL THEN NULL ELSE now() + make_interval(hours => $3::int) END)`,
      [postId, poll.multiple, poll.closesInHours],
    );
    for (const [i, label] of poll.options.entries()) {
      await this.db.execute('INSERT INTO poll_options (post_id, position, label) VALUES ($1, $2, $3)', [postId, i, label]);
    }
  }

  async poll(postId: number, viewerId: number | undefined, authorId: number): Promise<PollView | undefined> {
    const poll = await this.db.one<{ multiple: boolean; closesAt: Date | null; closed: boolean }>(
      'SELECT multiple, closes_at AS "closesAt", (closes_at IS NOT NULL AND closes_at <= now()) AS closed FROM polls WHERE post_id = $1',
      [postId],
    );
    if (!poll) return undefined;
    const [options, mine, voters] = await Promise.all([
      this.db.query<{ id: number; label: string; votes: number }>('SELECT id, label, votes FROM poll_options WHERE post_id = $1 ORDER BY position', [postId]),
      viewerId == null
        ? Promise.resolve([])
        : this.db.query<{ optionId: number }>('SELECT option_id AS "optionId" FROM poll_votes WHERE post_id = $1 AND user_id = $2', [postId, viewerId]),
      this.db.one<{ n: number }>('SELECT count(DISTINCT user_id)::int AS n FROM poll_votes WHERE post_id = $1', [postId]),
    ]);
    const myVotes = mine.map((m) => m.optionId);
    const revealed = poll.closed || myVotes.length > 0 || viewerId === authorId;
    return {
      ...poll,
      revealed,
      total: revealed ? options.reduce((n, o) => n + o.votes, 0) : 0,
      voters: voters?.n ?? 0,
      options: options.map((o) => (revealed ? o : { id: o.id, label: o.label })),
      myVotes,
    };
  }

  /** 투표하기 · 바꾸기 · 취소(빈 배열). 마감 전까지 */
  async vote(postId: number, userId: number, optionIds: unknown, authorId: number): Promise<PollView> {
    const poll = await this.db.one<{ multiple: boolean; closed: boolean }>(
      'SELECT multiple, (closes_at IS NOT NULL AND closes_at <= now()) AS closed FROM polls WHERE post_id = $1',
      [postId],
    );
    if (!poll) throw ApiError.notFound('투표가 없는 글이에요');
    if (poll.closed) throw ApiError.badRequest('마감된 투표예요');
    if (!Array.isArray(optionIds) || optionIds.some((x) => !Number.isInteger(x))) throw ApiError.badRequest('고른 선택지를 보내 주세요');
    const picked = [...new Set(optionIds as number[])];
    if (!poll.multiple && picked.length > 1) throw ApiError.badRequest('하나만 고를 수 있는 투표예요');
    const valid = await this.db.query<{ id: number }>('SELECT id FROM poll_options WHERE post_id = $1 AND id = ANY($2)', [postId, picked]);
    if (valid.length !== picked.length) throw ApiError.badRequest('없는 선택지예요');
    await this.db.transaction(async () => {
      await this.db.execute('DELETE FROM poll_votes WHERE post_id = $1 AND user_id = $2', [postId, userId]);
      for (const id of picked) await this.db.execute('INSERT INTO poll_votes (post_id, user_id, option_id) VALUES ($1, $2, $3)', [postId, userId, id]);
      await this.db.execute('UPDATE poll_options o SET votes = (SELECT count(*) FROM poll_votes v WHERE v.option_id = o.id) WHERE o.post_id = $1', [postId]);
    });
    return (await this.poll(postId, userId, authorId))!;
  }

  /* ───── 시리즈 ───── */

  /** 글에 넣을 시리즈 번호: 새로 만들거나, 내 시리즈인지 확인. undefined 면 바꾸지 않는다 */
  async resolveSeries(userId: number, input: { seriesId?: number | null; newSeries?: string }): Promise<number | null | undefined> {
    const name = input.newSeries?.trim();
    if (name) {
      const row = await this.db.one<{ id: number }>('INSERT INTO post_series (author_id, title) VALUES ($1, $2) RETURNING id', [userId, name]);
      return row!.id;
    }
    if (input.seriesId === undefined) return undefined;
    if (input.seriesId === null) return null;
    const own = await this.db.one('SELECT 1 FROM post_series WHERE id = $1 AND author_id = $2', [input.seriesId, userId]);
    if (!own) throw ApiError.badRequest('내 시리즈만 고를 수 있어요');
    const full = await this.db.one<{ n: number }>('SELECT count(*)::int AS n FROM posts WHERE series_id = $1', [input.seriesId]);
    if ((full?.n ?? 0) >= MAX_SERIES_POSTS) throw ApiError.badRequest(`시리즈 하나에는 글을 ${MAX_SERIES_POSTS}개까지 넣을 수 있어요`);
    return input.seriesId;
  }

  async mySeries(userId: number) {
    return this.db.query<{ id: number; title: string; count: number }>(
      `SELECT s.id, s.title, (SELECT count(*)::int FROM posts p WHERE p.series_id = s.id) AS count
       FROM post_series s WHERE s.author_id = $1 ORDER BY s.id DESC LIMIT 100`,
      [userId],
    );
  }

  async series(postId: number, seriesId: number | null, viewerId?: number): Promise<SeriesView | undefined> {
    if (seriesId == null) return undefined;
    const s = await this.db.one<{ title: string; authorId: number }>('SELECT title, author_id AS "authorId" FROM post_series WHERE id = $1', [seriesId]);
    if (!s) return undefined;
    // 숨긴 글은 글쓴이에게만
    const posts = await this.db.query<{ id: number; title: string }>(
      `SELECT id, title FROM posts WHERE series_id = $1 AND (hidden_at IS NULL OR author_id = $2) ORDER BY id LIMIT ${MAX_SERIES_POSTS}`,
      [seriesId, viewerId ?? null],
    );
    return { id: seriesId, title: s.title, posts, index: posts.findIndex((p) => p.id === postId) };
  }
}

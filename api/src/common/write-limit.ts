import { ApiError } from './api-error';
import type { Database } from '../db/database';

/**
 * 도배 막기: 한 사람이 짧은 시간에 올린 글 · 댓글 수를 센다.
 * 기본값은 보통 쓰는 사람은 닿지 않을 만큼 (환경 변수로 바꿀 수 있다. 테스트는 넉넉히 두고 필요할 때만 줄인다)
 */
const limitOf = (name: string, fallback: number) => Number(process.env[name]) || fallback;

/** 글: 10분에 10개 */
export async function checkPostRate(db: Database, userId: number) {
  const limit = limitOf('POST_RATE_LIMIT', 10);
  const row = await db.one<{ n: number }>("SELECT count(*)::int AS n FROM posts WHERE author_id = $1 AND created_at > now() - interval '10 minutes'", [userId]);
  if (row!.n >= limit) throw ApiError.tooMany('글을 너무 자주 올리고 있어요. 잠시 후 다시 올려 주세요');
}

/** 댓글: 1분에 10개 */
export async function checkCommentRate(db: Database, userId: number) {
  const limit = limitOf('COMMENT_RATE_LIMIT', 10);
  const row = await db.one<{ n: number }>("SELECT count(*)::int AS n FROM comments WHERE author_id = $1 AND created_at > now() - interval '1 minute'", [userId]);
  if (row!.n >= limit) throw ApiError.tooMany('댓글을 너무 자주 달고 있어요. 잠시 후 다시 달아 주세요');
}

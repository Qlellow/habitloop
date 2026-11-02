import { Injectable } from '@nestjs/common';
import { ChannelsService } from '../channels/channels.service';
import { isStaff } from '../channels/roles';
import { ApiError } from '../common/api-error';
import { Database } from '../db/database';

/**
 * 습관 체크인 (루프 = HabitLoop): 습관을 만들고 매일 체크하면 연속 일수 · 잔디가 쌓이고 펫이 자란다 (pets.service 의 경험치).
 *  - 날짜는 한국 날짜. 오늘과 지난 2일까지만 체크 · 취소할 수 있다 (깜빡한 날 채우기)
 *  - 습관은 10개까지 (보관한 습관은 세지 않는다)
 * 채널 챌린지: 운영진이 기간(7~60일)을 정해 열면, 팔로워가 참여해 자기 습관으로 체크하고 채널에서 서로의 달성률을 본다
 */
const MAX_HABITS = 10;
const BACKFILL_DAYS = 2;
/** 잔디 칸 수 (12주) */
const GRASS_DAYS = 84;
const TODAY = "(now() AT TIME ZONE 'Asia/Seoul')::date";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface HabitView {
  id: number;
  title: string;
  emoji: string;
  /** 오늘까지 이어진 날 수 (오늘 아직 안 했으면 어제까지) */
  streak: number;
  best: number;
  total: number;
  checkedToday: boolean;
  /** 최근 84일 (오래된 날 → 오늘) 체크 여부 */
  grass: boolean[];
  challenge?: { id: number; title: string; channelSlug: string; channelName: string; startsOn: string; endsOn: string };
}

const cleanTitle = (raw: unknown) => {
  const t = String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!t || [...t].length > 30) throw ApiError.badRequest('습관 이름은 1~30자로 적어 주세요');
  return t;
};
const cleanEmoji = (raw: unknown) => {
  const e = String(raw ?? '').trim();
  return e && [...e].length <= 4 ? e : '✅';
};

/** 체크한 날들(오름차순 'YYYY-MM-DD') → 지금 연속 · 가장 긴 연속 */
export function streaks(days: string[], today: string) {
  const t = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86400_000;
  let best = 0;
  let run = 0;
  let prev: number | undefined;
  for (const d of days) {
    const n = t(d);
    run = prev != null && n === prev + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = n;
  }
  const last = prev;
  const now = t(today);
  const streak = last != null && (last === now || last === now - 1) ? run : 0;
  return { streak, best };
}

@Injectable()
export class HabitsService {
  constructor(
    private readonly db: Database,
    private readonly channels: ChannelsService,
  ) {}

  private async today() {
    return (await this.db.one<{ d: string }>(`SELECT to_char(${TODAY}, 'YYYY-MM-DD') AS d`))!.d;
  }

  async list(userId: number): Promise<HabitView[]> {
    const habits = await this.db.query<{
      id: number;
      title: string;
      emoji: string;
      challengeId: number | null;
      cTitle: string | null;
      slug: string | null;
      cName: string | null;
      startsOn: string | null;
      endsOn: string | null;
    }>(
      `SELECT h.id, h.title, h.emoji, h.challenge_id AS "challengeId", c.title AS "cTitle", ch.slug, ch.name AS "cName",
              to_char(c.starts_on, 'YYYY-MM-DD') AS "startsOn", to_char(c.ends_on, 'YYYY-MM-DD') AS "endsOn"
       FROM habits h LEFT JOIN channel_challenges c ON c.id = h.challenge_id LEFT JOIN channels ch ON ch.id = c.channel_id
       WHERE h.user_id = $1 AND h.archived_at IS NULL ORDER BY h.id`,
      [userId],
    );
    if (!habits.length) return [];
    const today = await this.today();
    const checks = await this.db.query<{ habitId: number; day: string }>(
      `SELECT habit_id AS "habitId", to_char(day, 'YYYY-MM-DD') AS day FROM habit_checks WHERE habit_id = ANY($1) ORDER BY day`,
      [habits.map((h) => h.id)],
    );
    const start = Date.parse(`${today}T00:00:00Z`) / 86400_000 - (GRASS_DAYS - 1);
    return habits.map((h) => {
      const days = checks.filter((c) => c.habitId === h.id).map((c) => c.day);
      const grass = Array.from({ length: GRASS_DAYS }, () => false);
      for (const d of days) {
        const i = Date.parse(`${d}T00:00:00Z`) / 86400_000 - start;
        if (i >= 0 && i < GRASS_DAYS) grass[i] = true;
      }
      return {
        id: h.id,
        title: h.title,
        emoji: h.emoji,
        ...streaks(days, today),
        total: days.length,
        checkedToday: days[days.length - 1] === today,
        grass,
        challenge:
          h.challengeId != null && h.slug
            ? { id: h.challengeId, title: h.cTitle!, channelSlug: h.slug, channelName: h.cName!, startsOn: h.startsOn!, endsOn: h.endsOn! }
            : undefined,
      };
    });
  }

  async create(userId: number, input: { title?: unknown; emoji?: unknown }) {
    const count = await this.db.one<{ n: number }>('SELECT count(*)::int AS n FROM habits WHERE user_id = $1 AND archived_at IS NULL', [userId]);
    if ((count?.n ?? 0) >= MAX_HABITS) throw ApiError.badRequest(`습관은 ${MAX_HABITS}개까지 만들 수 있어요`);
    await this.db.execute('INSERT INTO habits (user_id, title, emoji) VALUES ($1, $2, $3)', [userId, cleanTitle(input.title), cleanEmoji(input.emoji)]);
    return this.list(userId);
  }

  private async own(userId: number, id: number) {
    const h = await this.db.one('SELECT 1 FROM habits WHERE id = $1 AND user_id = $2 AND archived_at IS NULL', [id, userId]);
    if (!h) throw ApiError.notFound('없는 습관이에요');
  }

  async update(userId: number, id: number, input: { title?: unknown; emoji?: unknown }) {
    await this.own(userId, id);
    await this.db.execute('UPDATE habits SET title = $3, emoji = $4 WHERE id = $1 AND user_id = $2', [
      id,
      userId,
      cleanTitle(input.title),
      cleanEmoji(input.emoji),
    ]);
    return this.list(userId);
  }

  /** 보관 (체크 기록은 남는다). 챌린지 습관이면 챌린지에서도 빠진다 */
  async archive(userId: number, id: number) {
    await this.own(userId, id);
    await this.db.execute('UPDATE habits SET archived_at = now(), challenge_id = NULL WHERE id = $1', [id]);
    return this.list(userId);
  }

  /** 체크 · 취소. day 를 안 주면 오늘. 오늘과 지난 2일까지만 */
  async check(userId: number, id: number, rawDay: string | undefined, on: boolean) {
    await this.own(userId, id);
    const today = await this.today();
    const day = rawDay ?? today;
    if (!DATE.test(day) || Number.isNaN(Date.parse(day))) throw ApiError.badRequest('날짜를 YYYY-MM-DD 로 알려 주세요');
    const diff = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86400_000;
    if (diff < 0) throw ApiError.badRequest('아직 오지 않은 날이에요');
    if (diff > BACKFILL_DAYS) throw ApiError.badRequest(`지난 ${BACKFILL_DAYS}일까지만 체크할 수 있어요`);
    if (on) await this.db.execute('INSERT INTO habit_checks (habit_id, day) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, day]);
    else await this.db.execute('DELETE FROM habit_checks WHERE habit_id = $1 AND day = $2', [id, day]);
    return (await this.list(userId)).find((h) => h.id === id)!;
  }

  /* ───── 채널 챌린지 ───── */

  async challenges(slug: string, viewerId?: number) {
    const channel = await this.channels.findBySlug(slug);
    await this.channels.requireAccess(channel, viewerId);
    const rows = await this.db.query<{
      id: number;
      title: string;
      emoji: string;
      startsOn: string;
      endsOn: string;
      days: number;
      participants: number;
      ended: boolean;
      myHabit: number | null;
    }>(
      `SELECT c.id, c.title, c.emoji, to_char(c.starts_on, 'YYYY-MM-DD') AS "startsOn", to_char(c.ends_on, 'YYYY-MM-DD') AS "endsOn",
              (c.ends_on - c.starts_on + 1) AS days, c.ends_on < ${TODAY} AS ended,
              (SELECT count(*)::int FROM habits h WHERE h.challenge_id = c.id) AS participants,
              (SELECT h.id FROM habits h WHERE h.challenge_id = c.id AND h.user_id = $2) AS "myHabit"
       FROM channel_challenges c WHERE c.channel_id = $1 AND c.ends_on >= ${TODAY} - 30
       ORDER BY c.ends_on < ${TODAY}, c.starts_on DESC LIMIT 10`,
      [channel.id, viewerId ?? null],
    );
    return Promise.all(
      rows.map(async ({ myHabit, ...c }) => ({
        ...c,
        joined: myHabit != null,
        myDone: myHabit == null ? undefined : await this.doneIn(myHabit, c.startsOn, c.endsOn),
        top: await this.leaders(c.id, c.startsOn, c.endsOn, 5),
      })),
    );
  }

  private async doneIn(habitId: number, from: string, to: string) {
    const r = await this.db.one<{ n: number }>('SELECT count(*)::int AS n FROM habit_checks WHERE habit_id = $1 AND day BETWEEN $2 AND $3', [
      habitId,
      from,
      to,
    ]);
    return r?.n ?? 0;
  }

  private leaders(challengeId: number, from: string, to: string, limit: number) {
    return this.db.query<{ id: string; nickname: string; avatarUrl: string | null; done: number }>(
      `SELECT u.uid::text AS id, u.nickname, CASE WHEN u.avatar_id IS NULL THEN NULL ELSE '/api/images/' || u.avatar_id END AS "avatarUrl",
              (SELECT count(*)::int FROM habit_checks k WHERE k.habit_id = h.id AND k.day BETWEEN $2 AND $3) AS done
       FROM habits h JOIN users u ON u.id = h.user_id AND u.withdrawn_at IS NULL
       WHERE h.challenge_id = $1 ORDER BY done DESC, h.id LIMIT ${limit}`,
      [challengeId, from, to],
    );
  }

  /** 챌린지 열기 (운영진): 오늘부터 days 일 */
  async openChallenge(slug: string, userId: number, input: { title?: unknown; emoji?: unknown; days?: unknown }) {
    const channel = await this.channels.findBySlug(slug);
    if (!isStaff(await this.channels.roleOf(channel.id, userId))) throw ApiError.forbidden('운영진만 챌린지를 열 수 있어요');
    const days = Number(input.days);
    if (!Number.isInteger(days) || days < 7 || days > 60) throw ApiError.badRequest('챌린지 기간은 7~60일로 정해 주세요');
    const open = await this.db.one<{ n: number }>(`SELECT count(*)::int AS n FROM channel_challenges WHERE channel_id = $1 AND ends_on >= ${TODAY}`, [
      channel.id,
    ]);
    if ((open?.n ?? 0) >= 3) throw ApiError.badRequest('진행 중인 챌린지는 3개까지예요');
    await this.db.execute(
      `INSERT INTO channel_challenges (channel_id, title, emoji, starts_on, ends_on, created_by) VALUES ($1, $2, $3, ${TODAY}, ${TODAY} + $4::int - 1, $5)`,
      [channel.id, cleanTitle(input.title), cleanEmoji(input.emoji), days, userId],
    );
    return this.challenges(slug, userId);
  }

  /** 챌린지 참여: 내 습관 목록에 그 챌린지 습관이 생긴다 */
  async join(challengeId: number, userId: number) {
    const c = await this.db.one<{ slug: string; title: string; emoji: string; ended: boolean }>(
      `SELECT ch.slug, c.title, c.emoji, c.ends_on < ${TODAY} AS ended FROM channel_challenges c JOIN channels ch ON ch.id = c.channel_id WHERE c.id = $1`,
      [challengeId],
    );
    if (!c) throw ApiError.notFound('없는 챌린지예요');
    if (c.ended) throw ApiError.badRequest('끝난 챌린지예요');
    const channel = await this.channels.findBySlug(c.slug);
    await this.channels.requireAccess(channel, userId);
    if (!(await this.channels.roleOf(channel.id, userId))) throw ApiError.forbidden('채널을 팔로우하면 참여할 수 있어요');
    const count = await this.db.one<{ n: number }>('SELECT count(*)::int AS n FROM habits WHERE user_id = $1 AND archived_at IS NULL', [userId]);
    if ((count?.n ?? 0) >= MAX_HABITS) throw ApiError.badRequest(`습관은 ${MAX_HABITS}개까지예요. 다른 습관을 보관하고 참여해 주세요`);
    await this.db.execute('INSERT INTO habits (user_id, title, emoji, challenge_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [
      userId,
      c.title,
      c.emoji,
      challengeId,
    ]);
    return this.challenges(c.slug, userId);
  }
}

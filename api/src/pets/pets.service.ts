import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { Database } from '../db/database';
import { PET_ITEMS, PET_ITEM_BY_ID } from './pet-items';

/** 고를 수 있는 펫 (웹의 도트 그림과 같게) */
export const PET_SPECIES = ['slime', 'cat', 'chick'] as const;
export type PetSpecies = (typeof PET_SPECIES)[number];

/**
 * 경험치: 펫을 데려온 뒤의 활동으로 계산한다 (따로 쌓아 두지 않아 빠지는 활동이 없다).
 *   글 30 · 댓글 10 (하루에 글 5개 · 댓글 20개까지만 쳐서 도배로 키우지 못하게)
 *   내 글이 받은 좋아요 3 · 감정 반응 2, 하루 한 번 쓰다듬기 5, 습관 체크 5 (하루 10번까지)
 * 글 · 댓글을 지우면 그만큼 빠진다.
 */
const XP = { post: 30, comment: 10, like: 3, reaction: 2, pat: 5, habit: 5 };
const DAILY_CAP = { post: 5, comment: 20, habit: 10 };

/** 레벨 L 이 되는 데 필요한 경험치: 10 × L² (Lv1 = 10, Lv5 = 250, Lv10 = 1000, Lv20 = 4000) */
const xpForLevel = (level: number) => 10 * level * level;
const levelOf = (xp: number) => Math.floor(Math.sqrt(xp / 10));

/** 레벨에 따라 모습이 바뀐다: 알 → 아기 → 어린이 → 어른 */
function stageOf(level: number) {
  if (level < 1) return 'egg';
  if (level < 5) return 'baby';
  if (level < 10) return 'junior';
  return 'adult';
}

interface PetRow {
  species: PetSpecies;
  name: string;
  shown: boolean;
  adoptedAt: Date;
  pettedAt: Date | null;
  bonusXp: number;
  hat: string | null;
  color: string | null;
}

const KST = "interval '9 hours'";

@Injectable()
export class PetsService {
  constructor(private readonly db: Database) {}

  private row(userId: number) {
    return this.db.one<PetRow>(
      `SELECT species, name, shown, adopted_at AS "adoptedAt", petted_at AS "pettedAt", bonus_xp AS "bonusXp", hat, color FROM pets WHERE user_id = $1`,
      [userId],
    );
  }

  /** 펫 데려오기 (한 사람에 하나) */
  async adopt(userId: number, input: { species?: string; name?: string }) {
    const species = String(input.species ?? '');
    if (!(PET_SPECIES as readonly string[]).includes(species)) throw ApiError.badRequest('고를 수 없는 펫이에요');
    const name = cleanName(input.name);
    const added = await this.db.execute('INSERT INTO pets (user_id, species, name) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING', [userId, species, name]);
    if (!added) throw ApiError.conflict('이미 펫이 있어요');
    return this.mine(userId);
  }

  /** 이름 바꾸기 · 프로필에 전시하기 */
  async update(userId: number, input: { name?: string; shown?: boolean }) {
    if (!(await this.row(userId))) throw ApiError.notFound('아직 펫이 없어요');
    if (input.name !== undefined) await this.db.execute('UPDATE pets SET name = $2 WHERE user_id = $1', [userId, cleanName(input.name)]);
    if (typeof input.shown === 'boolean') await this.db.execute('UPDATE pets SET shown = $2 WHERE user_id = $1', [userId, input.shown]);
    return this.mine(userId);
  }

  /** 쓰다듬기: 하루(한국 시간) 한 번 경험치 +5. 이미 했으면 gained = false */
  async pat(userId: number) {
    if (!(await this.row(userId))) throw ApiError.notFound('아직 펫이 없어요');
    const gained = await this.db.execute(
      `UPDATE pets SET bonus_xp = bonus_xp + $2, petted_at = now()
       WHERE user_id = $1 AND (petted_at IS NULL OR (petted_at + ${KST})::date < (now() + ${KST})::date)`,
      [userId, XP.pat],
    );
    return { gained: gained > 0, xp: gained > 0 ? XP.pat : 0, pet: await this.mine(userId) };
  }

  /** 내 펫 (없으면 null) */
  async mine(userId: number) {
    const pet = await this.row(userId);
    return pet ? this.describe(userId, pet, true) : null;
  }

  /** 다른 사람 프로필에 보이는 펫 (전시를 껐으면 없음) */
  async shownOf(userId: number) {
    const pet = await this.row(userId);
    if (!pet?.shown) return undefined;
    const { species, name, level, stage, mood, accessory, color } = await this.describe(userId, pet, false);
    return { species, name, level, stage, mood, accessory, color };
  }

  /* ───── 꾸미기 (포인트로 산 아이템) ───── */

  /** 꾸미기 가게: 내 포인트 · 아이템마다 가졌는지 · 입었는지 */
  async shop(userId: number) {
    const pet = await this.row(userId);
    if (!pet) throw ApiError.notFound('아직 펫이 없어요');
    const [{ level }, owned, points] = await Promise.all([
      this.describe(userId, pet, false),
      this.db.query<{ item: string }>('SELECT item FROM pet_items WHERE user_id = $1', [userId]),
      this.db.one<{ points: number }>('SELECT points FROM users WHERE id = $1', [userId]),
    ]);
    const have = new Set(owned.map((o) => o.item));
    return {
      points: points?.points ?? 0,
      hat: pet.hat,
      color: pet.color,
      items: PET_ITEMS.map((i) => ({
        ...i,
        owned: have.has(i.id) || (i.freeAt != null && level >= i.freeAt),
        equipped: (i.kind === 'hat' ? pet.hat : pet.color) === i.id,
      })),
    };
  }

  async buy(userId: number, itemId: string) {
    const item = PET_ITEM_BY_ID.get(itemId);
    if (!item) throw ApiError.notFound('없는 아이템이에요');
    const shop = await this.shop(userId);
    if (shop.items.find((i) => i.id === itemId)!.owned) throw ApiError.conflict('이미 가진 아이템이에요');
    await this.db.transaction(async () => {
      const paid = await this.db.execute('UPDATE users SET points = points - $2 WHERE id = $1 AND points >= $2', [userId, item.price]);
      if (!paid) throw ApiError.badRequest(`포인트가 모자라요 (${item.price.toLocaleString()}P 필요)`);
      await this.db.execute('INSERT INTO point_logs (user_id, delta, reason) VALUES ($1, $2, $3)', [userId, -item.price, `펫 꾸미기: ${item.name}`]);
      await this.db.execute('INSERT INTO pet_items (user_id, item) VALUES ($1, $2)', [userId, itemId]);
    });
    return this.shop(userId);
  }

  /** 입히기 · 벗기기 (null). 가진 아이템만 */
  async equip(userId: number, input: { hat?: unknown; color?: unknown }) {
    const shop = await this.shop(userId);
    const pick = (kind: 'hat' | 'color', v: unknown) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      const item = shop.items.find((i) => i.id === v && i.kind === kind);
      if (!item) throw ApiError.badRequest('고를 수 없는 아이템이에요');
      if (!item.owned) throw ApiError.badRequest('먼저 아이템을 사 주세요');
      return item.id;
    };
    const hat = pick('hat', input.hat);
    const color = pick('color', input.color);
    if (hat !== undefined) await this.db.execute('UPDATE pets SET hat = $2 WHERE user_id = $1', [userId, hat]);
    if (color !== undefined) await this.db.execute('UPDATE pets SET color = $2 WHERE user_id = $1', [userId, color]);
    return this.shop(userId);
  }

  private async describe(userId: number, pet: PetRow, full: boolean) {
    const s = await this.db.one<{ posts: number; comments: number; likes: number; reactions: number; habits: number; lastActive: Date | null }>(
      `SELECT
         (SELECT coalesce(sum(least(n, ${DAILY_CAP.post})), 0)::int FROM (
            SELECT count(*) AS n FROM posts WHERE author_id = $1 AND created_at >= $2 GROUP BY (created_at + ${KST})::date) d) AS posts,
         (SELECT coalesce(sum(least(n, ${DAILY_CAP.comment})), 0)::int FROM (
            SELECT count(*) AS n FROM comments WHERE author_id = $1 AND created_at >= $2 GROUP BY (created_at + ${KST})::date) d) AS comments,
         (SELECT count(*)::int FROM post_likes l JOIN posts p ON p.id = l.post_id
            WHERE p.author_id = $1 AND l.user_id <> $1 AND l.created_at >= $2) AS likes,
         (SELECT count(*)::int FROM post_reactions r JOIN posts p ON p.id = r.post_id
            WHERE p.author_id = $1 AND r.user_id <> $1 AND r.created_at >= $2) AS reactions,
         (SELECT coalesce(sum(least(n, ${DAILY_CAP.habit})), 0)::int FROM (
            SELECT count(*) AS n FROM habit_checks k JOIN habits h ON h.id = k.habit_id
            WHERE h.user_id = $1 AND k.created_at >= $2 GROUP BY k.day) d) AS habits,
         GREATEST(
           (SELECT max(created_at) FROM posts WHERE author_id = $1),
           (SELECT max(created_at) FROM comments WHERE author_id = $1)
         ) AS "lastActive"`,
      [userId, pet.adoptedAt],
    );
    const stats = { posts: s!.posts, comments: s!.comments, likes: s!.likes, reactions: s!.reactions, habits: s!.habits };
    const xp =
      stats.posts * XP.post + stats.comments * XP.comment + stats.likes * XP.like + stats.reactions * XP.reaction + stats.habits * XP.habit + pet.bonusXp;
    const level = levelOf(xp);
    // 기분: 최근에 활동(글 · 댓글 · 쓰다듬기)했을수록 신난다
    const last = Math.max(+(s!.lastActive ?? 0), +(pet.pettedAt ?? 0), +pet.adoptedAt);
    const idleHours = (Date.now() - last) / 3_600_000;
    const mood = idleHours < 24 ? 'happy' : idleHours < 72 ? 'calm' : 'sleepy';
    // 꾸미기: 고른 모자 · 색. 고르지 않았으면 레벨 15 리본, 20 왕관
    const accessory = pet.hat ?? (level >= 20 ? 'crown' : level >= 15 ? 'ribbon' : undefined);
    const base = { species: pet.species, name: pet.name, level, stage: stageOf(level), mood, accessory, color: pet.color ?? undefined };
    if (!full) return base;
    const todayKst = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
    const pettedKst = pet.pettedAt ? new Date(+pet.pettedAt + 9 * 3_600_000).toISOString().slice(0, 10) : '';
    return {
      ...base,
      xp,
      levelXp: xpForLevel(level),
      nextXp: xpForLevel(level + 1),
      shown: pet.shown,
      adoptedAt: pet.adoptedAt,
      pettedToday: pettedKst === todayKst,
      stats,
    };
  }
}

function cleanName(raw: unknown) {
  const name = String(raw ?? '').trim().replace(/\s+/g, ' ');
  const len = [...name].length;
  if (len < 1 || len > 12) throw ApiError.badRequest('이름은 1~12자로 지어 주세요');
  return name;
}

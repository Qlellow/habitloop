import { Injectable, Logger } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { Database } from '../db/database';
import { escapeLike } from '../common/cursor-page';
import { ChannelsService, type ChannelRow } from '../channels/channels.service';
import { isStaff } from '../channels/roles';
import { accessToken, liveKit, liveKitConfig, type LkParticipant } from './livekit';

/** 채널마다 음성방은 이만큼까지 */
const MAX_ROOMS = 10;
const MAX_PARTICIPANTS = 50;
/** 방에 누가 있는지는 잠깐 기억해 둔다 (채널 화면을 여러 사람이 동시에 열어도 LiveKit 을 덜 부르게) */
const PRESENCE_TTL = 5000;
/** 음성 · 화면 공유만 (카메라는 아직) */
const SOURCES = ['microphone', 'screen_share', 'screen_share_audio'];

interface RoomRow {
  id: number;
  channelId: number;
  name: string;
  maxParticipants: number;
  position: number;
}

export interface VoiceMember {
  id: string;
  nickname: string;
  avatarUrl?: string;
  muted: boolean;
  sharing: boolean;
}

/** LiveKit 안 방 이름 */
const lkRoom = (r: Pick<RoomRow, 'id' | 'channelId'>) => `loop-c${r.channelId}-r${r.id}`;

const TRACK_SOURCE = { MICROPHONE: 2, SCREEN_SHARE: 3 } as const;
const isSource = (s: string | number | undefined, name: keyof typeof TRACK_SOURCE) => s === name || s === TRACK_SOURCE[name];

function member(p: LkParticipant): VoiceMember {
  let avatarUrl: string | undefined;
  try {
    avatarUrl = (JSON.parse(p.metadata || '{}') as { avatarUrl?: string }).avatarUrl;
  } catch {
    // 메타데이터가 이상하면 사진 없이
  }
  const mic = p.tracks?.find((t) => isSource(t.source, 'MICROPHONE'));
  return {
    id: p.identity,
    nickname: p.name || '알 수 없음',
    avatarUrl,
    muted: !mic || !!mic.muted,
    sharing: !!p.tracks?.some((t) => isSource(t.source, 'SCREEN_SHARE')),
  };
}

/**
 * 채널 음성채팅. 운영진이 채널에 고정 음성방을 만들고, 채널을 볼 수 있는 로그인한 사람이 들어간다.
 * 들어갈 때 API 가 권한을 확인하고 LiveKit 입장 토큰을 준다. 실제 음성 · 화면 공유는 브라우저 ↔ LiveKit 사이에서 오간다.
 */
@Injectable()
export class VoiceService {
  private readonly log = new Logger('Voice');
  private readonly presence = new Map<string, { at: number; members: VoiceMember[] }>();

  constructor(
    private readonly db: Database,
    private readonly channels: ChannelsService,
  ) {}

  private async rooms(channelId: number) {
    return this.db.query<RoomRow>(
      `SELECT id, channel_id AS "channelId", name, max_participants AS "maxParticipants", position
       FROM voice_rooms WHERE channel_id = $1 ORDER BY position, id`,
      [channelId],
    );
  }

  /** 지금 방에 있는 사람 (LiveKit 을 못 부르면 빈 목록) */
  private async membersOf(room: RoomRow, fresh = false): Promise<VoiceMember[]> {
    const cfg = liveKitConfig();
    if (!cfg) return [];
    const key = lkRoom(room);
    const cached = this.presence.get(key);
    if (!fresh && cached && Date.now() - cached.at < PRESENCE_TTL) return cached.members;
    try {
      const members = (await liveKit.participants(cfg, key)).map(member);
      this.presence.set(key, { at: Date.now(), members });
      return members;
    } catch (e) {
      // 방이 아직 없으면(아무도 안 들어옴) 404 — 빈 방
      this.presence.set(key, { at: Date.now(), members: [] });
      if (!String(e).includes('404')) this.log.warn(`참가자 목록을 못 받았어요: ${String(e)}`);
      return [];
    }
  }

  private async requireStaff(channel: ChannelRow, userId: number) {
    if (!isStaff(await this.channels.roleOf(channel.id, userId))) throw ApiError.forbidden('음성방은 운영진만 만들고 바꿀 수 있어요');
  }

  /**
   * 음성방 찾기 (커맨드 팔레트의 voice:). 방 이름이나 채널 이름에 검색어가 들어간 방,
   * 볼 수 있는 채널만 (비공개는 팔로워만, 19세 이상은 확인한 사람만). 사람이 많은 방부터
   */
  async search(q: string | undefined, viewerId?: number) {
    const keyword = (q ?? '').trim().toLowerCase().slice(0, 30);
    const adult = await this.channels.isAdult(viewerId);
    const rows = await this.db.query<RoomRow & { slug: string; channelName: string; iconVersion: number; color: number | null }>(
      `SELECT r.id, r.channel_id AS "channelId", r.name, r.max_participants AS "maxParticipants", r.position,
              c.slug, c.name AS "channelName", c.icon_version AS "iconVersion", c.color
       FROM voice_rooms r JOIN channels c ON c.id = r.channel_id
       WHERE ($1 = '' OR lower(r.name) LIKE $2 ESCAPE '\\' OR lower(c.name) LIKE $2 ESCAPE '\\')
         AND ($3 OR NOT c.adult)
         AND (c.visibility = 'public' OR EXISTS (SELECT 1 FROM channel_members m WHERE m.channel_id = c.id AND m.user_id = $4))
       ORDER BY (lower(r.name) LIKE $5 ESCAPE '\\') DESC, c.member_count DESC, r.position, r.id
       LIMIT 30`,
      [keyword, `%${escapeLike(keyword)}%`, adult, viewerId ?? null, `${escapeLike(keyword)}%`],
    );
    const rooms = await Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        name: r.name,
        maxParticipants: r.maxParticipants,
        members: await this.membersOf(r),
        channel: { slug: r.slug, name: r.channelName, iconVersion: r.iconVersion, color: r.color },
      })),
    );
    // 지금 사람이 있는 방을 먼저 (같으면 검색 순서 그대로)
    rooms.sort((a, b) => Number(b.members.length > 0) - Number(a.members.length > 0) || b.members.length - a.members.length);
    return { enabled: !!liveKitConfig(), rooms: rooms.slice(0, 10) };
  }

  /** 채널의 음성방 목록 + 방마다 지금 있는 사람 */
  async list(slug: string, viewerId?: number) {
    const channel = await this.channels.findBySlug(slug);
    await this.channels.requireAccess(channel, viewerId);
    const [rows, role] = await Promise.all([this.rooms(channel.id), this.channels.roleOf(channel.id, viewerId)]);
    const rooms = await Promise.all(
      rows.map(async (r) => ({ id: r.id, name: r.name, maxParticipants: r.maxParticipants, members: await this.membersOf(r) })),
    );
    return { enabled: !!liveKitConfig(), canManage: isStaff(role), rooms };
  }

  private parse(body: { name?: unknown; maxParticipants?: unknown }, partial: boolean) {
    const out: { name?: string; maxParticipants?: number } = {};
    if (body.name !== undefined || !partial) {
      const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
      if (!name || [...name].length > 30) throw ApiError.badRequest('방 이름은 1~30자로 적어 주세요');
      out.name = name;
    }
    if (body.maxParticipants !== undefined) {
      const n = Number(body.maxParticipants);
      if (!Number.isInteger(n) || n < 2 || n > MAX_PARTICIPANTS) throw ApiError.badRequest(`최대 인원은 2~${MAX_PARTICIPANTS}명이에요`);
      out.maxParticipants = n;
    }
    return out;
  }

  async create(slug: string, userId: number, body: { name?: unknown; maxParticipants?: unknown }) {
    const channel = await this.channels.findBySlug(slug);
    await this.requireStaff(channel, userId);
    const input = this.parse(body ?? {}, false);
    const count = Number((await this.db.one<{ n: string }>('SELECT count(*) AS n FROM voice_rooms WHERE channel_id = $1', [channel.id]))?.n ?? 0);
    if (count >= MAX_ROOMS) throw ApiError.badRequest(`음성방은 채널마다 ${MAX_ROOMS}개까지 만들 수 있어요`);
    const row = await this.db.one<RoomRow>(
      `INSERT INTO voice_rooms (channel_id, name, max_participants, position) VALUES ($1, $2, $3, $4)
       RETURNING id, channel_id AS "channelId", name, max_participants AS "maxParticipants", position`,
      [channel.id, input.name, input.maxParticipants ?? 25, count],
    );
    return { id: row!.id, name: row!.name, maxParticipants: row!.maxParticipants, members: [] as VoiceMember[] };
  }

  private async roomIn(channel: ChannelRow, roomId: number) {
    const room = (await this.rooms(channel.id)).find((r) => r.id === roomId);
    if (!room) throw ApiError.notFound('없는 음성방이에요');
    return room;
  }

  async update(slug: string, roomId: number, userId: number, body: { name?: unknown; maxParticipants?: unknown }) {
    const channel = await this.channels.findBySlug(slug);
    await this.requireStaff(channel, userId);
    const room = await this.roomIn(channel, roomId);
    const input = this.parse(body ?? {}, true);
    const next = { ...room, ...input };
    await this.db.execute('UPDATE voice_rooms SET name = $2, max_participants = $3 WHERE id = $1', [room.id, next.name, next.maxParticipants]);
    return { id: room.id, name: next.name, maxParticipants: next.maxParticipants, members: await this.membersOf(room) };
  }

  /** 방 지우기: 들어와 있던 사람도 모두 나가게 된다 */
  async remove(slug: string, roomId: number, userId: number) {
    const channel = await this.channels.findBySlug(slug);
    await this.requireStaff(channel, userId);
    const room = await this.roomIn(channel, roomId);
    await this.db.execute('DELETE FROM voice_rooms WHERE id = $1', [room.id]);
    const cfg = liveKitConfig();
    if (cfg) await liveKit.deleteRoom(cfg, lkRoom(room)).catch(() => undefined);
    this.presence.delete(lkRoom(room));
  }

  /** 입장 토큰: 채널을 볼 수 있는 로그인한 사람만. 방이 가득 찼으면 409 */
  async token(roomId: number, userId: number) {
    const cfg = liveKitConfig();
    if (!cfg) throw ApiError.badRequest('음성채팅이 아직 준비되지 않았어요');
    const room = await this.db.one<RoomRow & { slug: string }>(
      `SELECT r.id, r.channel_id AS "channelId", r.name, r.max_participants AS "maxParticipants", r.position, c.slug
       FROM voice_rooms r JOIN channels c ON c.id = r.channel_id WHERE r.id = $1`,
      [roomId],
    );
    if (!room) throw ApiError.notFound('없는 음성방이에요');
    const channel = await this.channels.findBySlug(room.slug);
    await this.channels.requireAccess(channel, userId);
    const user = await this.db.one<{ uid: string; nickname: string; avatarUrl: string | null }>(
      `SELECT uid::text AS uid, nickname, CASE WHEN avatar_id IS NULL THEN NULL ELSE '/api/images/' || avatar_id END AS "avatarUrl"
       FROM users WHERE id = $1`,
      [userId],
    );
    if (!user) throw ApiError.unauthorized();
    const members = await this.membersOf(room, true);
    if (members.length >= room.maxParticipants && !members.some((m) => m.id === user.uid)) throw ApiError.conflict('방이 가득 찼어요');
    // 인원 제한을 LiveKit 에도 걸어 둔다 (이미 있으면 그대로). 실패해도 들어가는 데는 지장 없다
    await liveKit.createRoom(cfg, lkRoom(room), room.maxParticipants).catch((e) => this.log.warn(`방을 못 만들었어요: ${String(e)}`));
    const token = accessToken(
      cfg,
      { room: lkRoom(room), roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true, canPublishSources: SOURCES, canUpdateOwnMetadata: false },
      { identity: user.uid, name: user.nickname, metadata: JSON.stringify({ avatarUrl: user.avatarUrl ?? undefined }) },
    );
    this.presence.delete(lkRoom(room));
    return {
      url: cfg.url,
      token,
      room: { id: room.id, name: room.name, maxParticipants: room.maxParticipants },
      channel: { slug: channel.slug, name: channel.name, iconVersion: channel.iconVersion, color: channel.color },
    };
  }
}

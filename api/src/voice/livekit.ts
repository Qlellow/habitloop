import jwt from 'jsonwebtoken';

/**
 * LiveKit (음성 · 화면 공유 미디어 서버) 와 이야기하는 작은 도구.
 * 환경 변수 LIVEKIT_URL (wss://…) · LIVEKIT_API_KEY · LIVEKIT_API_SECRET 를 모두 넣어야 켜진다.
 * SDK 없이: 입장 토큰은 JWT, 서버 API 는 Twirp(JSON over HTTP) 라 직접 부른다.
 */

export interface LiveKitConfig {
  url: string;
  key: string;
  secret: string;
}

export function liveKitConfig(): LiveKitConfig | undefined {
  const url = process.env.LIVEKIT_URL?.trim();
  const key = process.env.LIVEKIT_API_KEY?.trim();
  const secret = process.env.LIVEKIT_API_SECRET?.trim();
  return url && key && secret ? { url, key, secret } : undefined;
}

/** LiveKit 권한 (video grant) */
export interface VideoGrant {
  room?: string;
  roomJoin?: boolean;
  roomCreate?: boolean;
  roomList?: boolean;
  roomAdmin?: boolean;
  canPublish?: boolean;
  canSubscribe?: boolean;
  canPublishData?: boolean;
  canPublishSources?: string[];
  canUpdateOwnMetadata?: boolean;
}

export function accessToken(
  cfg: LiveKitConfig,
  grant: VideoGrant,
  who?: { identity: string; name: string; metadata?: string },
  ttl: string | number = '6h',
) {
  return jwt.sign({ video: grant, ...(who ? { name: who.name, metadata: who.metadata } : {}) }, cfg.secret, {
    issuer: cfg.key,
    expiresIn: ttl as jwt.SignOptions['expiresIn'],
    notBefore: 0,
    ...(who ? { subject: who.identity, jwtid: who.identity } : {}),
  });
}

export interface LkParticipant {
  identity: string;
  name?: string;
  metadata?: string;
  /** 들어온 시각 (초). JSON 에서는 문자열로 올 수 있다 */
  joined_at?: string | number;
  joinedAt?: string | number;
  tracks?: { source?: string | number; muted?: boolean; type?: string | number }[];
}

/** 서버 API 부르기 (실패하면 던진다). 오래 걸리면 끊는다 */
async function twirp<T>(cfg: LiveKitConfig, method: string, body: object, grant: VideoGrant): Promise<T> {
  const base = cfg.url.replace(/^ws/, 'http').replace(/\/$/, '');
  const res = await fetch(`${base}/twirp/livekit.RoomService/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken(cfg, grant, undefined, 60)}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`LiveKit ${method} ${res.status}`);
  return (await res.json()) as T;
}

export const liveKit = {
  /** 방이 없으면 만든다 (인원 제한 · 비면 5분 뒤 닫기). 이미 있으면 그대로 */
  createRoom: (cfg: LiveKitConfig, name: string, maxParticipants: number) =>
    twirp(cfg, 'CreateRoom', { name, empty_timeout: 300, max_participants: maxParticipants }, { roomCreate: true }),
  participants: async (cfg: LiveKitConfig, room: string) =>
    (await twirp<{ participants?: LkParticipant[] }>(cfg, 'ListParticipants', { room }, { roomAdmin: true, room })).participants ?? [],
  deleteRoom: (cfg: LiveKitConfig, room: string) => twirp(cfg, 'DeleteRoom', { room }, { roomCreate: true }),
};

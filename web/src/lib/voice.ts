import { useSyncExternalStore } from 'react';
import type { VideoTrack } from 'livekit-client';
import type { VoiceJoin } from '@loop/shared';

/**
 * 채널 음성채팅 상태 (화면을 옮겨도 이어진다). React 에서는 useVoice() 로 읽는다.
 * 실제 연결(LiveKit)은 lib/voiceEngine.ts 에 있고, 처음 방에 들어갈 때 불러온다 (첫 화면 번들을 가볍게).
 */

export interface VoicePerson {
  /** 사용자 UUID */
  id: string;
  nickname: string;
  avatarUrl?: string;
  local: boolean;
  speaking: boolean;
  muted: boolean;
  sharing: boolean;
  /** 내가 듣는 이 사람의 볼륨 (0~1.5) */
  volume: number;
  /** 들어온 시각 (ms) */
  joinedAt?: number;
}

/** 통화 시작: 지금 있는 사람 중 가장 먼저 들어온 시각 */
export const callSince = (people: { joinedAt?: number }[]) => {
  const t = people.map((p) => p.joinedAt).filter((x): x is number => !!x);
  return t.length ? Math.min(...t) : undefined;
};

export interface VoiceScreen {
  /** 화면을 공유하는 사람 */
  id: string;
  nickname: string;
  local: boolean;
  track: VideoTrack;
}

export interface VoiceState {
  status: 'idle' | 'connecting' | 'connected' | 'reconnecting';
  join?: VoiceJoin;
  people: VoicePerson[];
  micOn: boolean;
  /** 듣기 끄기 (마이크도 함께 꺼진다) */
  deafened: boolean;
  sharing: boolean;
  screens: VoiceScreen[];
  /** 마이크를 쓸 수 없어 듣기만 하는 중 */
  listenOnly: boolean;
  noiseSuppression: boolean;
  /** 브라우저가 소리 자동 재생을 막았다 (화면을 한 번 누르면 풀린다) */
  audioBlocked: boolean;
}

export interface VoicePrefs {
  noiseSuppression: boolean;
  /** 사람별 볼륨 (UUID → 0~1.5) */
  volumes: Record<string, number>;
  micDevice?: string;
  speakerDevice?: string;
}

const PREFS = 'loop.voice';

function loadPrefs(): VoicePrefs {
  try {
    return { noiseSuppression: true, volumes: {}, ...(JSON.parse(localStorage.getItem(PREFS) ?? '{}') as Partial<VoicePrefs>) };
  } catch {
    return { noiseSuppression: true, volumes: {} };
  }
}

let prefs = loadPrefs();
export const getPrefs = () => prefs;
export function savePrefs(patch: Partial<VoicePrefs>) {
  prefs = { ...prefs, ...patch };
  try {
    localStorage.setItem(PREFS, JSON.stringify(prefs));
  } catch {
    // 저장소를 못 쓰면 이번 방문에만
  }
}

// join 도 꼭 비운다: 상태는 합쳐서 바뀌므로 키가 없으면 이전 방 정보가 남아 다시 들어갈 수 없게 된다
export const idleState = (): VoiceState => ({
  status: 'idle',
  join: undefined,
  people: [],
  micOn: false,
  deafened: false,
  sharing: false,
  screens: [],
  listenOnly: false,
  noiseSuppression: prefs.noiseSuppression,
  audioBlocked: false,
});

/**
 * 새로고침해도 들어가 있던 방으로 다시 들어가도록 이 탭에 기억한다 (sessionStorage: 새 탭 · 브라우저를 닫으면 사라짐).
 * 통화 끊기를 누르거나 방에서 내보내지면 지운다.
 */
const RESUME = 'loop.voice.resume';
export function rememberRoom(roomId: number | undefined) {
  try {
    if (roomId == null) sessionStorage.removeItem(RESUME);
    else sessionStorage.setItem(RESUME, String(roomId));
  } catch {
    // 저장소를 못 쓰면 새로고침 때 다시 들어가지 않는다
  }
}
/** 새로고침 전에 들어가 있던 방 (다시 들어갈 방이 있는지) */
export function rememberedRoom() {
  try {
    const n = Number(sessionStorage.getItem(RESUME));
    return Number.isInteger(n) && n > 0 ? n : undefined;
  } catch {
    return undefined;
  }
}

let state: VoiceState = idleState();
const listeners = new Set<() => void>();

export function setVoiceState(patch: Partial<VoiceState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const engine = () => import('./voiceEngine');

/** 차단한 사람 (엔진을 불러오기 전에 받아 둔다) */
let blockedIds: string[] = [];
export const getBlocked = () => blockedIds;

export const voice = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** 음성방 들어가기 (다른 방에 있었으면 나와서) */
  join: async (roomId: number) => {
    await (await engine()).join(roomId);
    rememberRoom(roomId);
  },
  /** 나가기. keepResume: 새로고침 · 창 닫기로 끊길 때 (다시 열면 그 방으로) */
  leave: async (opts: { keepResume?: boolean } = {}) => {
    if (!opts.keepResume) rememberRoom(undefined);
    if (state.status === 'idle') return;
    (await engine()).leave();
  },
  /** 새로고침 전에 들어가 있던 방으로 다시 들어간다. 못 들어가면 잊는다 */
  async resume() {
    const roomId = rememberedRoom();
    if (roomId == null || state.status !== 'idle') return false;
    try {
      await voice.join(roomId);
      return true;
    } catch {
      rememberRoom(undefined);
      return false;
    }
  },
  /** 막힌 소리 재생 풀기 (사용자가 화면을 누를 때) */
  startAudio: async () => (await engine()).startAudio(),
  toggleMic: async () => (await engine()).toggleMic(),
  setDeafened: async (on: boolean) => (await engine()).setDeafened(on),
  toggleScreen: async () => (await engine()).toggleScreen(),
  setVolume: async (id: string, v: number) => (await engine()).setVolume(id, v),
  setNoiseSuppression: async (on: boolean) => (await engine()).setNoiseSuppression(on),
  devices: async (kind: MediaDeviceKind) => (await engine()).devices(kind),
  setDevice: async (kind: 'audioinput' | 'audiooutput', id: string) => (await engine()).setDevice(kind, id),
  /** 내가 차단한 사람은 들리지 않게 */
  setBlocked(ids: string[]) {
    blockedIds = ids;
    if (state.status !== 'idle') void engine().then((e) => e.applyBlocked());
  },
};

export function useVoice() {
  return useSyncExternalStore(voice.subscribe, voice.get, voice.get);
}

/** 화면 공유를 할 수 있는 브라우저인지 (폰 브라우저는 대부분 안 된다) */
export const canShareScreen = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices;

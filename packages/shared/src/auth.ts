import { useSyncExternalStore } from 'react';
import type { AuthResponse, User } from './types';

interface AuthState {
  token: string | null;
  user: User | null;
  /** 저장소에서 로그인 정보를 다 읽었는지 (앱은 비동기로 읽는다) */
  ready: boolean;
}

/** 웹은 localStorage, 앱은 SecureStore 처럼 플랫폼마다 다른 저장소를 끼운다 */
export interface AuthStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

const STORAGE_KEY = 'loop.auth';
const VIEWER_KEY = 'loop.viewer';

/**
 * 이 브라우저·앱을 가리키는 무작위 값. 비로그인으로 글을 볼 때 조회수를 한 번만 세는 데만 쓴다 (X-Viewer 헤더).
 * 저장소를 읽기 전에도 쓸 수 있게 먼저 하나 만들어 두고, 저장된 값이 있으면 그 값으로 바꾼다.
 */
const randomId = () => Array.from({ length: 24 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
let viewerId = randomId();

function loadViewerId(adapter: AuthStorage) {
  const fresh = viewerId;
  const keep = (saved: string | null) => {
    if (saved && /^[a-z0-9]{8,40}$/.test(saved)) viewerId = saved;
    else void Promise.resolve(adapter.setItem(VIEWER_KEY, fresh)).catch(() => undefined);
  };
  try {
    const saved = adapter.getItem(VIEWER_KEY);
    if (saved instanceof Promise) saved.then(keep, () => undefined);
    else keep(saved);
  } catch {
    // 저장소를 못 쓰면 이번 실행 동안만 같은 값을 쓴다
  }
}
const signedOut = { token: null, user: null };

let state: AuthState = { ...signedOut, ready: false };
let storage: AuthStorage | null = null;
const listeners = new Set<() => void>();

function set(next: AuthState) {
  state = next;
  listeners.forEach((l) => l());
}

function parse(raw: string | null): Pick<AuthState, 'token' | 'user'> {
  try {
    if (raw) return JSON.parse(raw) as Pick<AuthState, 'token' | 'user'>;
  } catch {
    // 깨진 값은 무시하고 비로그인으로 시작
  }
  return signedOut;
}

async function persist(next: Pick<AuthState, 'token' | 'user'>) {
  try {
    if (next.token) await storage?.setItem(STORAGE_KEY, JSON.stringify(next));
    else await storage?.removeItem(STORAGE_KEY);
  } catch {
    // 저장에 실패해도 이번 실행 동안은 로그인 상태를 유지한다
  }
}

export const authStore = {
  /**
   * 앱 시작 시 한 번 호출. 저장소가 동기(localStorage)면 첫 렌더 전에 바로 끝나고,
   * 비동기(SecureStore)면 Promise 가 끝날 때 ready 가 된다.
   */
  init(adapter: AuthStorage): void | Promise<void> {
    storage = adapter;
    loadViewerId(adapter);
    let raw: string | null | Promise<string | null>;
    try {
      raw = adapter.getItem(STORAGE_KEY);
    } catch {
      raw = null;
    }
    if (raw instanceof Promise) {
      return raw.then(
        (value) => set({ ...parse(value), ready: true }),
        () => set({ ...signedOut, ready: true }),
      );
    }
    set({ ...parse(raw), ready: true });
  },
  /** 다른 탭에서 로그인 상태가 바뀌었을 때 (웹) 다시 읽는다 */
  reload() {
    if (storage) void authStore.init(storage);
  },
  /**
   * 저장된 로그인이 아직 유효한지 서버에 한 번 확인하고, 최신 사용자 정보(닉네임 등)로 바꾼다.
   * 서버 DB 가 초기화됐거나 계정이 없어졌으면 api() 가 401 을 받아 자동으로 로그아웃된다.
   */
  async verify(fetchMe: () => Promise<User>) {
    const token = state.token;
    if (!token) return;
    try {
      const user = await fetchMe();
      if (state.token === token) authStore.signIn({ token, user });
    } catch {
      // 401 은 api() 가 이미 로그아웃 처리. 네트워크 오류면 그대로 둔다
    }
  },
  getToken: () => state.token,
  getViewerId: () => viewerId,
  getUser: () => state.user,
  signIn(res: AuthResponse) {
    const next = { token: res.token, user: res.user };
    set({ ...next, ready: true });
    void persist(next);
  },
  /** 사용자 정보만 바꾼다 (2단계 인증 켜기/끄기 등) */
  updateUser(user: User) {
    if (state.token) authStore.signIn({ token: state.token, user });
  },
  signOut() {
    set({ ...signedOut, ready: true });
    void persist(signedOut);
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** Context 대신 외부 스토어 구독: 인증 상태를 쓰는 컴포넌트만 다시 렌더링된다. */
export function useAuth() {
  const snapshot = useSyncExternalStore(authStore.subscribe, () => state, () => state);
  return { user: snapshot.user, isLoggedIn: snapshot.token != null, ready: snapshot.ready };
}

import { useSyncExternalStore } from 'react';
import type { AuthResponse, User } from '../api/types';

interface AuthState {
  token: string | null;
  user: User | null;
}

const STORAGE_KEY = 'loop.auth';

function load(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AuthState;
  } catch {
    // 저장소 접근이 막힌 환경(시크릿 모드 등)에서는 비로그인 상태로 시작
  }
  return { token: null, user: null };
}

let state: AuthState = load();
const listeners = new Set<() => void>();

function emit(next: AuthState) {
  state = next;
  try {
    if (next.token) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

export const authStore = {
  getToken: () => state.token,
  signIn: (res: AuthResponse) => emit({ token: res.token, user: res.user }),
  signOut: () => emit({ token: null, user: null }),
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

// 다른 탭에서 로그인/로그아웃하면 동기화
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      state = load();
      listeners.forEach((l) => l());
    }
  });
}

/** Context 대신 외부 스토어 구독: 인증 상태를 쓰는 컴포넌트만 다시 렌더링된다. */
export function useAuth() {
  const snapshot = useSyncExternalStore(authStore.subscribe, () => state);
  return { user: snapshot.user, isLoggedIn: snapshot.token != null };
}

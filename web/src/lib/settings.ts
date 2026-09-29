import { useSyncExternalStore } from 'react';

/** 이 브라우저에만 저장되는 화면 설정 */
export interface Settings {
  theme: 'system' | 'light' | 'dark';
  /** 글쓰기 편집기를 열 때의 보기 방식 */
  editorMode: 'write' | 'split' | 'preview';
  /** 글 목록에 본문 미리보기 두 줄을 보여 줄지 */
  showExcerpt: boolean;
}

const KEY = 'loop.settings';
const DEFAULTS: Settings = { theme: 'system', editorMode: 'split', showExcerpt: true };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    // 저장소를 못 쓰면 기본값
  }
  return DEFAULTS;
}

let state = load();
const listeners = new Set<() => void>();

/** 'system' 이면 속성을 지워 OS 설정(prefers-color-scheme)을 따른다 */
export function applyTheme(theme: Settings['theme']) {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
}

export function updateSettings(patch: Partial<Settings>) {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 저장 실패해도 이번 방문 동안은 적용
  }
  if (patch.theme) applyTheme(patch.theme);
  listeners.forEach((l) => l());
}

export function getSettings() {
  return state;
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

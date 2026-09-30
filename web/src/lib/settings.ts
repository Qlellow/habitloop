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

/**
 * 테마가 바뀌는 순간에는 모든 transition 을 잠깐 끈다.
 * 안 그러면 transition-colors 가 걸린 버튼·입력칸만 색이 천천히 바뀌어서 나머지 화면과 따로 깜빡인다.
 */
function withoutTransitions(change: () => void) {
  const root = document.documentElement;
  root.classList.add('theme-switching');
  change();
  // 바뀐 색을 transition 없이 한 번 계산하게 한 뒤 다음 프레임에 되돌린다
  void getComputedStyle(root).backgroundColor;
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
}

/** 'system' 이면 속성을 지워 OS 설정(prefers-color-scheme)을 따른다 */
export function applyTheme(theme: Settings['theme']) {
  const root = document.documentElement;
  withoutTransitions(() => {
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
  });
}

// '시스템 설정'일 때 OS 가 밝게/어둡게 바뀌어도 같은 방법으로 깜빡임 없이 바꾼다
try {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.theme === 'system') withoutTransitions(() => {});
  });
} catch {
  // matchMedia 가 없는 환경은 무시
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

import { useSyncExternalStore } from 'react';

/** 이 브라우저에만 저장되는 화면 설정 */
export interface Settings {
  /** time: 시간대(아침 · 낮 · 저녁 · 새벽)에 따라 배경과 포인트 색이 바뀐다 */
  theme: 'system' | 'light' | 'dark' | 'time';
  /** 시간대 테마: auto 면 지금 시각을 따르고, 아니면 그 시간대로 고정 */
  timeTheme: 'auto' | Period;
  /** 글쓰기 편집기를 열 때의 보기 방식 */
  editorMode: 'write' | 'split' | 'preview';
  /** 글 목록에 본문 미리보기 두 줄을 보여 줄지 */
  showExcerpt: boolean;
}

const KEY = 'loop.settings';
const DEFAULTS: Settings = { theme: 'system', timeTheme: 'auto', editorMode: 'split', showExcerpt: true };

/** 시간대. 새벽 · 저녁은 어두운 화면, 아침 · 낮은 밝은 화면 */
export type Period = 'morning' | 'day' | 'evening' | 'dawn';
export const PERIODS: Record<Period, { label: string; hours: string }> = {
  morning: { label: '아침', hours: '오전 5시 ~ 11시' },
  day: { label: '낮', hours: '오전 11시 ~ 오후 5시' },
  evening: { label: '저녁', hours: '오후 5시 ~ 10시' },
  dawn: { label: '새벽', hours: '오후 10시 ~ 오전 5시' },
};

/** 이 기기 시각으로 지금 시간대 (index.html 의 첫 화면 스크립트와 같은 기준) */
export function periodAt(date = new Date()): Period {
  const h = date.getHours();
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 17) return 'day';
  if (h >= 17 && h < 22) return 'evening';
  return 'dawn';
}

/** 지금 보여 줄 시간대 (시간대 테마가 아니면 없음) */
export function activePeriod(s: Pick<Settings, 'theme' | 'timeTheme'>): Period | undefined {
  if (s.theme !== 'time') return undefined;
  return s.timeTheme === 'auto' ? periodAt() : s.timeTheme;
}

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

/**
 * 테마 적용. 'system' 이면 속성을 지워 OS 설정(prefers-color-scheme)을 따른다.
 * 시간대 테마는 data-time 으로 배경 · 포인트 색을 바꾸고, 저녁 · 새벽은 어두운 화면(data-theme=dark)을 바탕으로 한다
 */
function setThemeAttributes(s: Pick<Settings, 'theme' | 'timeTheme'>) {
  const root = document.documentElement;
  const period = activePeriod(s);
  if (period) {
    root.dataset.theme = period === 'evening' || period === 'dawn' ? 'dark' : 'light';
    root.dataset.time = period;
  } else {
    delete root.dataset.time;
    if (s.theme === 'system' || s.theme === 'time') delete root.dataset.theme;
    else root.dataset.theme = s.theme;
  }
}

/** 설정을 바꿀 때: 바로 바꾼다 */
export function applyTheme(s: Pick<Settings, 'theme' | 'timeTheme'> = state) {
  withoutTransitions(() => setThemeAttributes(s));
}

/** 시간이 흘러 시간대가 넘어갈 때: 1.2초 동안 색이 자연스럽게 바뀐다 */
function fadeTheme() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return applyTheme(state);
  const root = document.documentElement;
  root.classList.add('theme-fade');
  setThemeAttributes(state);
  window.setTimeout(() => root.classList.remove('theme-fade'), 1500);
}

// 시간대 테마(자동)는 1분마다, 그리고 탭으로 돌아올 때 시간대가 넘어갔는지 본다
try {
  const check = () => {
    if (state.theme !== 'time' || state.timeTheme !== 'auto') return;
    if (document.documentElement.dataset.time !== periodAt()) fadeTheme();
  };
  window.setInterval(check, 60_000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
} catch {
  // 브라우저가 아닌 환경은 무시
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
  if (patch.theme || patch.timeTheme) applyTheme(state);
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

// 첫 화면은 index.html 의 스크립트가 칠하고, 앱이 뜨면 같은 규칙으로 한 번 더 맞춘다
try {
  setThemeAttributes(state);
} catch {
  // 브라우저가 아닌 환경은 무시
}

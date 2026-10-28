import { useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';
import { vars } from 'nativewind';
import { secureStorage } from './storage';

/** 화면 테마: 기기 설정을 따르거나 밝게 · 어둡게 고정 (설정 화면에서 고르고, 이 기기에 저장) */
export type ThemePref = 'system' | 'light' | 'dark';
const THEME_KEY = 'loop.theme';
let pref: ThemePref = 'system';
const listeners = new Set<() => void>();

void Promise.resolve(secureStorage.getItem(THEME_KEY))
  .then((v) => {
    if (v === 'light' || v === 'dark') setThemePref(v, false);
  })
  .catch(() => undefined);

export function setThemePref(next: ThemePref, save = true) {
  pref = next;
  listeners.forEach((l) => l());
  if (save) void Promise.resolve(next === 'system' ? secureStorage.removeItem(THEME_KEY) : secureStorage.setItem(THEME_KEY, next)).catch(() => undefined);
}

export function useThemePref() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    () => pref,
  );
}

/** 지금 그릴 색 모드 (고른 테마, 아니면 기기 설정) */
export function useScheme(): 'light' | 'dark' {
  const system = useColorScheme();
  const p = useThemePref();
  return p === 'system' ? (system === 'dark' ? 'dark' : 'light') : p;
}

// 웹과 같은 토스 톤의 팔레트 (다크 모드 포함)
const light = {
  bg: '#f2f4f6',
  surface: '#ffffff',
  pressed: '#f9fafb',
  textStrong: '#191f28',
  text: '#333d4b',
  sub: '#6b7684',
  weak: '#8b95a1',
  line: '#f2f4f6',
  border: '#e5e8eb',
  field: '#f2f4f6',
  primary: '#3182f6',
  primaryPressed: '#2272eb',
  primaryWeak: '#e8f3ff',
  danger: '#f04452',
  dangerWeak: '#ffeeee',
  skeleton: '#eef0f3',
  toast: 'rgba(25,31,40,0.94)',
};

const dark: typeof light = {
  bg: '#101013',
  surface: '#1c1c21',
  pressed: '#26262c',
  textStrong: '#f2f2f4',
  text: '#d9d9de',
  sub: '#9e9ea6',
  weak: '#7e7e87',
  line: '#2a2a31',
  border: '#2a2a31',
  field: '#2a2a31',
  primary: '#3182f6',
  primaryPressed: '#2272eb',
  primaryWeak: 'rgba(49,130,246,0.18)',
  danger: '#f04452',
  dangerWeak: 'rgba(240,68,82,0.16)',
  skeleton: '#26262c',
  toast: 'rgba(70,70,80,0.96)',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useScheme() === 'dark' ? dark : light;
}

/**
 * 팔레트를 NativeWind 가 읽는 CSS 변수로 바꾼다. 루트에 한 번 걸어 두면
 * className 의 bg-surface, text-fg-strong 같은 색이 라이트/다크에 맞게 풀린다.
 * (변수 이름은 packages/shared/tailwind-preset.cjs · 웹 global.css 와 같다)
 */
function toVars(c: Colors) {
  return vars({
    '--bg': c.bg,
    '--surface': c.surface,
    '--surface-pressed': c.pressed,
    '--text': c.text,
    '--text-strong': c.textStrong,
    '--text-sub': c.sub,
    '--text-weak': c.weak,
    '--line': c.line,
    '--field': c.field,
    '--border': c.border,
    '--primary': c.primary,
    '--primary-pressed': c.primaryPressed,
    '--primary-weak': c.primaryWeak,
    '--danger': c.danger,
    '--danger-weak': c.dangerWeak,
    '--skeleton': c.skeleton,
    '--toast-bg': c.toast,
  });
}

const themes = { light: toVars(light), dark: toVars(dark) };

export function useThemeVars() {
  return useScheme() === 'dark' ? themes.dark : themes.light;
}

import { useColorScheme } from 'react-native';
import { vars } from 'nativewind';

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
  return useColorScheme() === 'dark' ? dark : light;
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
  return useColorScheme() === 'dark' ? themes.dark : themes.light;
}

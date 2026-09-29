import { useMemo } from 'react';
import { Platform, StyleSheet, useColorScheme } from 'react-native';

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
  primaryWeak: '#e8f3ff',
  danger: '#f04452',
  dangerWeak: '#ffeeee',
  skeleton: '#eef0f3',
  onPrimary: '#ffffff',
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
  primaryWeak: 'rgba(49,130,246,0.18)',
  danger: '#f04452',
  dangerWeak: 'rgba(240,68,82,0.16)',
  skeleton: '#26262c',
  onPrimary: '#ffffff',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

/** 색상에 따라 달라지는 스타일을 테마가 바뀔 때만 다시 만든다 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (c: Colors) => T) {
  return function useStyles() {
    const c = useColors();
    return useMemo(() => StyleSheet.create(factory(c)), [c]);
  };
}

export const radius = { lg: 18, md: 14, sm: 10 };
export const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

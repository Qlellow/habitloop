import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * API 서버 주소.
 * 1) EXPO_PUBLIC_API_URL 이 있으면 그 값 (운영 빌드)
 * 2) 개발 중에는 Expo 개발 서버가 떠 있는 PC 의 주소:8080 (실기기 + Expo Go 에서 그대로 동작)
 * 3) 그 외에는 에뮬레이터 기본값
 */
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:8080`;
  return Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';
}

export const API_URL = resolveApiUrl();

import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * API 서버 주소.
 * 1) EXPO_PUBLIC_API_URL 이 있으면 그 값 (운영 빌드)
 * 2) 개발 중에는 Expo 개발 서버가 떠 있는 PC 의 주소:3000 (실기기 + Expo Go 에서 그대로 동작)
 * 3) 그 외에는 에뮬레이터 기본값
 */
/** 백엔드(Spring Boot) 포트 */
const API_PORT = 3000;

function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:${API_PORT}`;
  return Platform.OS === 'android' ? `http://10.0.2.2:${API_PORT}` : `http://localhost:${API_PORT}`;
}

export const API_URL = resolveApiUrl();

/**
 * 웹 사이트 주소 (글 · 초대 링크 공유용). EXPO_PUBLIC_WEB_URL 이 없으면 API 주소와 같다고 본다
 * (배포는 한 도메인에서 웹과 /api 를 함께 내보낸다)
 */
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? API_URL).replace(/\/$/, '');

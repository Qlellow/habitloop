import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * 관리자 페이지 설정 (환경 변수). 관리자 계정은 사이트 회원 계정과 따로다 (회원가입 필요 없음).
 * - ADMIN_KEY: 관리자 페이지 주소에 들어가는 비밀 값 (영문 · 숫자 · - · _ 32자 이상). 사이트 주소/{ADMIN_KEY} 로만 열린다
 * - ADMIN_EMAIL: 관리자 로그인 이메일. 로그인할 때마다 이 주소로 인증번호를 보낸다
 * - ADMIN_PASSWORD: 관리자 비밀번호 (12자 이상)
 * 셋 중 하나라도 없거나 형식이 맞지 않으면 관리자 기능이 통째로 꺼진다 (모든 관리자 API 가 404)
 */
export const ADMIN_KEY_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const MIN_PASSWORD = 12;

const sha = (v: string) => createHash('sha256').update(v).digest();
/** 길이가 달라도 걸리는 시간이 같도록 해시로 비교한다 */
const same = (a: string, b: string) => timingSafeEqual(sha(a), sha(b));

export interface AdminConfig {
  key: string;
  email: string;
  password: string;
}

export function adminConfig(): AdminConfig | undefined {
  const key = process.env.ADMIN_KEY?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!key || !ADMIN_KEY_PATTERN.test(key) || !email?.includes('@') || !password || password.length < MIN_PASSWORD) return undefined;
  return { key, email, password };
}

export function sameKey(given: unknown): boolean {
  const config = adminConfig();
  return !!config && typeof given === 'string' && same(given, config.key);
}

/** 이메일 · 비밀번호가 둘 다 맞는지 (둘 다 늘 비교해서 어느 쪽이 틀렸는지 시간으로 드러나지 않게) */
export function checkAdmin(email: string, password: string): boolean {
  const config = adminConfig();
  if (!config) return false;
  const emailOk = same(email.trim().toLowerCase(), config.email);
  const passwordOk = same(password, config.password);
  return emailOk && passwordOk;
}

/** 관리자 토큰에 넣는 값: 이메일 · 비밀번호 · 주소 키 중 하나라도 바꾸면 이미 받은 토큰을 못 쓴다 */
export function adminVersion(config: AdminConfig) {
  return createHash('sha256').update(`${config.email}\n${config.password}\n${config.key}`).digest('hex').slice(0, 24);
}

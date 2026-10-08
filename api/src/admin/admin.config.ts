import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * 관리자 페이지 설정 (환경 변수).
 * - ADMIN_KEY: 관리자 페이지 주소에 들어가는 비밀 값 (영문 · 숫자 · - · _ 32자 이상). 사이트 주소/{ADMIN_KEY} 로만 열린다.
 *   비어 있거나 짧으면 관리자 기능이 통째로 꺼진다 (모든 관리자 API 가 404)
 * - ADMIN_EMAILS: 관리자 로그인을 허락할 계정 이메일 (쉼표로 여러 개). 여기 없는 계정은 비밀번호가 맞아도 들어갈 수 없다
 */
export const ADMIN_KEY_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

export function adminKey(): string | undefined {
  const key = process.env.ADMIN_KEY?.trim();
  return key && ADMIN_KEY_PATTERN.test(key) ? key : undefined;
}

export function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** 길이가 달라도 걸리는 시간이 같도록 해시로 비교한다 */
export function sameKey(given: unknown): boolean {
  const key = adminKey();
  if (!key || typeof given !== 'string') return false;
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(key).digest();
  return timingSafeEqual(a, b);
}

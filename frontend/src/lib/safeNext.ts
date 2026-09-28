/** 로그인 후 이동 경로. 외부 URL 로의 오픈 리다이렉트를 막기 위해 내부 경로만 허용한다. */
export function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

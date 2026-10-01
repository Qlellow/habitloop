// Hermes(React Native) 는 Intl.RelativeTimeFormat 과 compact 숫자 포맷을 보장하지 않으므로 직접 만든다.

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function timeAgo(iso: string, now = Date.now()): string {
  const date = new Date(iso);
  const diff = (now - date.getTime()) / 1000;
  if (diff < MINUTE) return '방금 전';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}분 전`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}시간 전`;
  if (diff < 2 * DAY) return '어제';
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}일 전`;
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  const md = `${date.getMonth() + 1}월 ${date.getDate()}일`;
  return sameYear ? md : `${date.getFullYear()}년 ${md}`;
}

function trim(n: number): string {
  return (Math.floor(n * 10) / 10).toFixed(1).replace(/\.0$/, '');
}

/** 1234 → 1.2천, 12345 → 1.2만, 123456789 → 1.2억 */
export function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${trim(n / 1000)}천`;
  if (n < 100_000_000) return `${trim(n / 10_000)}만`;
  return `${trim(n / 100_000_000)}억`;
}

// 채널마다 이미지 없이도 구분되도록 slug 로 정해지는 색
const CHANNEL_COLORS = ['#3182f6', '#00c471', '#ff8a3d', '#8b5cf6', '#f04452', '#0ab4c9', '#e5a500', '#4e5968'];

export function channelColor(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) | 0;
  return CHANNEL_COLORS[Math.abs(h) % CHANNEL_COLORS.length];
}

/** 로그인 후 이동 경로. 외부 URL 로의 오픈 리다이렉트를 막기 위해 내부 경로만 허용한다. */
export function safeNext(next: string | null | undefined, fallback = '/'): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}

/**
 * 마크다운을 한 줄 요약용 평문으로 (채널 목록의 소개 등).
 * 제목·목록·인용 기호, 강조, 코드, 링크·이미지 문법을 걷어 내고 공백을 하나로 모은다.
 */
export function plainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/(\*\*|__|\*|~~|`)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ───────── 이메일 인증번호 ───────── */

/** 인증번호 자릿수와 유효 시간 (서버와 같게 맞춘다) */
export const CODE_LENGTH = 6;
export const CODE_TTL_SECONDS = 5 * 60;

/** 입력한 글자를 인증번호 형식(영문 대문자 + 1~9)으로 정리한다. 소문자는 대문자로 바꾼다 */
export function cleanCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z1-9]/g, '').slice(0, CODE_LENGTH);
}

/** 남은 초 → "4:05" */
export function mmss(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/* ───────── 비밀번호 규칙 (서버 api/src/common/validators.ts 와 같은 기준) ───────── */

const PW_SPECIAL = /[!-/:-@[-`{-~]/;
const PW_ALLOWED = /^[A-Za-z0-9!-/:-@[-`{-~]*$/;

/** 회원가입·비밀번호 바꾸기 화면에 보여 줄 조건 목록 */
export function passwordRules(v: string) {
  return [
    { label: '8자 이상', ok: v.length >= 8 && v.length <= 64 },
    { label: '숫자 포함', ok: /[0-9]/.test(v) },
    { label: '특수문자 포함', ok: PW_SPECIAL.test(v) },
    { label: '영문·숫자·특수문자만', ok: v.length > 0 && PW_ALLOWED.test(v) },
  ];
}

/** 비밀번호가 규칙에 맞지 않으면 무엇이 문제인지 한 가지 (맞으면 undefined) */
export function passwordProblem(v: string): string | undefined {
  if (!v) return '비밀번호를 입력해 주세요';
  if (v.length < 8) return `비밀번호는 8자 이상이어야 해요 (지금 ${v.length}자)`;
  if (v.length > 64) return '비밀번호는 64자까지 쓸 수 있어요';
  if (!PW_ALLOWED.test(v)) return '영문, 숫자, 특수문자만 쓸 수 있어요 (한글·공백 불가)';
  if (!/[0-9]/.test(v)) return '숫자를 하나 이상 넣어 주세요';
  if (!PW_SPECIAL.test(v)) return '특수문자를 하나 이상 넣어 주세요 (예: ! @ # $)';
  return undefined;
}

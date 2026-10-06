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
export const CHANNEL_COLORS = ['#3182f6', '#00c471', '#ff8a3d', '#8b5cf6', '#f04452', '#0ab4c9', '#e5a500', '#4e5968'];

/**
 * 이미지가 없는 채널 프로필 색. 채널을 만들 때 고른 색 번호(color)가 있으면 그 색,
 * 없으면(예전 채널) 고리로 정한다. 고리를 입력하는 동안 색이 바뀌지 않게 새 채널은 번호를 쓴다.
 */
export function channelColor(slug: string, color?: number | null): string {
  if (color != null && CHANNEL_COLORS[color]) return CHANNEL_COLORS[color];
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

export type PasswordLevel = 0 | 1 | 2 | 3 | 4;

/**
 * 비밀번호 강도: 0 없음 · 1 약함 · 2 보통 · 3 강함 · 4 매우 강함.
 * 조건 세 가지(8자 이상 · 숫자 · 특수문자)를 몇 개 채웠는지로 정하고, 셋 다 채우면 '강함'(= 쓸 수 있는 비밀번호).
 * 여기에 12자 이상이거나 영문 대·소문자를 섞으면 '매우 강함'. 허용되지 않는 글자가 있으면 '약함'.
 */
export function passwordStrength(v: string): { level: PasswordLevel; label: string; missing: string[] } {
  if (!v) return { level: 0, label: '', missing: ['8자 이상', '숫자', '특수문자'] };
  const missing = [
    v.length < 8 && '8자 이상',
    !/[0-9]/.test(v) && '숫자',
    !PW_SPECIAL.test(v) && '특수문자',
  ].filter(Boolean) as string[];
  if (!PW_ALLOWED.test(v) || v.length > 64) return { level: 1, label: '약함', missing };
  const met = 3 - missing.length;
  if (met <= 1) return { level: 1, label: '약함', missing };
  if (met === 2) return { level: 2, label: '보통', missing };
  const extra = v.length >= 12 || (/[a-z]/.test(v) && /[A-Z]/.test(v));
  return extra ? { level: 4, label: '매우 강함', missing } : { level: 3, label: '강함', missing };
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

/** 기본 배너 (누구나 무료). id 는 서버의 BANNER_PRESETS 와 같아야 한다 */
export const BANNER_PRESETS: { id: string; label: string; background: string }[] = [
  { id: 'sky', label: '하늘', background: 'linear-gradient(120deg, #6ec6ff 0%, #3182f6 100%)' },
  { id: 'sunset', label: '노을', background: 'linear-gradient(120deg, #ffb86c 0%, #f04452 100%)' },
  { id: 'mint', label: '민트', background: 'linear-gradient(120deg, #a8f0d4 0%, #00c471 100%)' },
  { id: 'grape', label: '포도', background: 'linear-gradient(120deg, #c7a6ff 0%, #8b5cf6 100%)' },
  { id: 'peach', label: '복숭아', background: 'linear-gradient(120deg, #ffe0d1 0%, #ff9eb5 100%)' },
  { id: 'night', label: '밤하늘', background: 'linear-gradient(120deg, #1e2a52 0%, #4b3f8f 60%, #8b5cf6 100%)' },
  { id: 'forest', label: '숲', background: 'linear-gradient(120deg, #c9e79a 0%, #2f8f5b 100%)' },
  { id: 'mono', label: '모노', background: 'linear-gradient(120deg, #d1d6db 0%, #4e5968 100%)' },
];

/** 커스텀 배너를 여는 데 드는 포인트 (서버의 CUSTOM_BANNER_COST) */
export const CUSTOM_BANNER_COST = 300;

/** 배너 값('p:…' · 'i:…')을 CSS background 로. 없으면 undefined */
export function bannerBackground(banner: string | null | undefined, apiBase = ''): string | undefined {
  if (!banner) return undefined;
  if (banner.startsWith('p:')) return BANNER_PRESETS.find((b) => b.id === banner.slice(2))?.background;
  if (banner.startsWith('i:')) return `center / cover no-repeat url("${apiBase}/api/images/${banner.slice(2)}")`;
  return undefined;
}

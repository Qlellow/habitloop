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

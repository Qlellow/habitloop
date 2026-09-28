// Intl 포매터는 생성 비용이 커서 모듈 로드 시 한 번만 만든다
const rtf = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' });
const dateFmt = new Intl.DateTimeFormat('ko', { year: 'numeric', month: 'long', day: 'numeric' });
const compactFmt = new Intl.NumberFormat('ko', { notation: 'compact', maximumFractionDigits: 1 });

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < MINUTE) return '방금 전';
  if (diff < HOUR) return rtf.format(-Math.floor(diff / MINUTE), 'minute');
  if (diff < DAY) return rtf.format(-Math.floor(diff / HOUR), 'hour');
  if (diff < 7 * DAY) return rtf.format(-Math.floor(diff / DAY), 'day');
  return dateFmt.format(new Date(iso));
}

export function compact(n: number): string {
  return n < 1000 ? String(n) : compactFmt.format(n);
}

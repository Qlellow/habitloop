import { ApiError } from '../common/api-error';

/**
 * 나만의 홈: 홈 화면 위젯 배치.
 * 12칸 격자 위에 위젯마다 위치(x, y) · 크기(w, h) · 설정(o)을 둔다. 화면에 그리는 법은 web/src/lib/homeGrid.ts.
 * 위젯 종류는 web/src/components/home/widgets.tsx 와 같게 맞춘다.
 */
export const WIDGET_TYPES = [
  'feed',
  'popular',
  'discovery',
  'weather',
  'bottle',
  'followed',
  'hotChannels',
  'notifications',
  'activity',
  'channel',
  'pet',
  'makeChannel',
  'greeting',
  'memo',
  'shortcuts',
] as const;

export const GRID_COLS = 12;
const MAX_WIDGETS = 24;
const MAX_ROWS = 400;
const MAX_H = 40;
const MAX_OPTIONS = 16;
const MAX_TEXT = 500;
/** 저장하는 JSON 크기 한도 */
const MAX_BYTES = 24_000;

export interface HomeWidget {
  id: string;
  type: (typeof WIDGET_TYPES)[number];
  x: number;
  y: number;
  w: number;
  h: number;
  o?: Record<string, string | number | boolean>;
}

export interface HomeLayout {
  v: 1;
  /** 위로 붙이기: 빈 줄 없이 위젯을 위로 모은다 */
  compact: boolean;
  widgets: HomeWidget[];
}

const bad = (why: string) => ApiError.badRequest(`홈 배치가 올바르지 않아요 (${why})`);
const isInt = (n: unknown, min: number, max: number): n is number => Number.isInteger(n) && (n as number) >= min && (n as number) <= max;

/** 받은 배치를 검사하고 알려진 필드만 남긴다 */
export function parseHomeLayout(raw: unknown): HomeLayout {
  if (!raw || typeof raw !== 'object') throw bad('형식');
  const { v, compact, widgets } = raw as Record<string, unknown>;
  if (v !== 1) throw bad('버전');
  if (!Array.isArray(widgets) || widgets.length > MAX_WIDGETS) throw bad(`위젯은 ${MAX_WIDGETS}개까지`);
  const ids = new Set<string>();
  const out: HomeWidget[] = widgets.map((w: unknown) => {
    if (!w || typeof w !== 'object') throw bad('위젯');
    const { id, type, x, y, w: width, h, o } = w as Record<string, unknown>;
    if (typeof id !== 'string' || !/^[a-z0-9]{1,16}$/.test(id) || ids.has(id)) throw bad('위젯 id');
    ids.add(id);
    if (!WIDGET_TYPES.includes(type as HomeWidget['type'])) throw bad('위젯 종류');
    if (!isInt(width, 1, GRID_COLS) || !isInt(x, 0, GRID_COLS - 1) || x + width > GRID_COLS) throw bad('가로 위치');
    if (!isInt(h, 1, MAX_H) || !isInt(y, 0, MAX_ROWS)) throw bad('세로 위치');
    const widget: HomeWidget = { id, type: type as HomeWidget['type'], x, y, w: width, h };
    if (o != null) {
      if (typeof o !== 'object' || Array.isArray(o)) throw bad('설정');
      const entries = Object.entries(o);
      if (entries.length > MAX_OPTIONS) throw bad('설정');
      for (const [k, val] of entries) {
        if (!/^[a-zA-Z]{1,20}$/.test(k)) throw bad('설정 이름');
        const ok =
          typeof val === 'boolean' ||
          (typeof val === 'number' && Number.isFinite(val) && Math.abs(val) < 1e6) ||
          (typeof val === 'string' && val.length <= MAX_TEXT);
        if (!ok) throw bad('설정 값');
      }
      if (entries.length) widget.o = Object.fromEntries(entries) as HomeWidget['o'];
    }
    return widget;
  });
  const layout: HomeLayout = { v: 1, compact: compact !== false, widgets: out };
  if (Buffer.byteLength(JSON.stringify(layout)) > MAX_BYTES) throw bad('너무 커요');
  return layout;
}

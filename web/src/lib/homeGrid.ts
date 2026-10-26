import type { HomeLayout, HomeWidget } from '@loop/shared';

/**
 * 나만의 홈 격자 엔진 (화면과 상관없는 순수 함수).
 * 가로 12칸 · 세로는 줄(ROW px + GAP) 단위. 위젯은 칸 위치(x, y)와 크기(w, h)를 가진다.
 *
 * 옮기기 · 크기 바꾸기는 '끌기 시작했을 때의 배치'에서 매번 새로 계산한다 (조금씩 어긋나며 쌓이지 않게):
 *  1) 끄는 위젯을 그 자리에 고정하고, 겹치는 위젯은 아래로 밀어낸다
 *  2) 위로 붙이기를 켰으면 나머지를 위로 모은다 (끄는 위젯은 고정이라 그 주위로 모인다 → 아래로 끌면 자리가 바뀐다)
 *  3) 고정을 풀고 한 번 더 정리한다 (끄는 위젯도 위로 붙는다). 미리 보이는 모습 = 놓았을 때의 모습
 */

export const COLS = 12;
/** 한 줄 높이 (px) 와 칸 사이 간격 */
export const ROW = 56;
export const GAP = 16;
export const MAX_H = 40;
export const MAX_WIDGETS = 24;

export type Box = Pick<HomeWidget, 'x' | 'y' | 'w' | 'h'>;

export const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const byPosition = (a: Box, b: Box) => a.y - b.y || a.x - b.x;

const clone = (widgets: HomeWidget[]) => widgets.map((w) => ({ ...w }));

/** 가로 크기 · 위치를 12칸 안으로 */
export function clampBox<T extends Box>(b: T, min = { w: 1, h: 1 }): T {
  const w = Math.max(min.w, Math.min(COLS, Math.round(b.w)));
  const h = Math.max(min.h, Math.min(MAX_H, Math.round(b.h)));
  return { ...b, w, h, x: Math.max(0, Math.min(COLS - w, Math.round(b.x))), y: Math.max(0, Math.round(b.y)) };
}

/**
 * 겹치지 않게 정리한다. 위에서부터 차례로:
 *  - compact 면 위로 갈 수 있는 만큼 올리고
 *  - 이미 놓인 위젯과 겹치면 겹치지 않을 때까지 내린다
 * fixed 위젯은 움직이지 않는다 (끄는 중인 위젯).
 */
export function settle(widgets: HomeWidget[], compact: boolean, fixed?: string): HomeWidget[] {
  const items = clone(widgets).sort(byPosition);
  const placed: HomeWidget[] = items.filter((w) => w.id === fixed);
  for (const it of items) {
    if (it.id === fixed) continue;
    if (compact) while (it.y > 0 && !placed.some((p) => overlaps({ ...it, y: it.y - 1 }, p))) it.y--;
    for (;;) {
      const hit = placed.filter((p) => overlaps(it, p));
      if (!hit.length) break;
      // 겹친 것들 중 가장 아래 끝 바로 밑으로 (한 줄씩 내리는 것보다 빠르고 결과는 같다)
      it.y = Math.max(...hit.map((p) => p.y + p.h));
    }
    placed.push(it);
  }
  return placed.sort(byPosition);
}

/** 위젯 하나의 칸(위치 · 크기)을 바꾸고 나머지를 정리한다 (옮기기 · 크기 바꾸기 · 키보드) */
export function place(layout: HomeLayout, id: string, box: Partial<Box>, min?: { w: number; h: number }): HomeLayout {
  const widgets = layout.widgets.map((w) => (w.id === id ? clampBox({ ...w, ...box }, min) : w));
  const first = settle(widgets, layout.compact, id);
  return { ...layout, widgets: settle(first, layout.compact) };
}

/** 이 크기의 위젯이 들어갈 첫 빈자리 (위 → 아래, 왼쪽 → 오른쪽) */
export function findSpot(widgets: Box[], w: number, h: number): { x: number; y: number } {
  for (let y = 0; ; y++) {
    for (let x = 0; x + w <= COLS; x++) {
      if (!widgets.some((o) => overlaps({ x, y, w, h }, o))) return { x, y };
    }
  }
}

export function addWidget(layout: HomeLayout, widget: Omit<HomeWidget, 'x' | 'y'>): HomeLayout {
  const spot = findSpot(layout.widgets, widget.w, widget.h);
  return { ...layout, widgets: settle([...layout.widgets, { ...widget, ...spot }], layout.compact) };
}

export function removeWidget(layout: HomeLayout, id: string): HomeLayout {
  return { ...layout, widgets: settle(layout.widgets.filter((w) => w.id !== id), layout.compact) };
}

/** 위로 붙이기 켜고 끄기: 켜면 바로 위로 모은다 */
export function setCompact(layout: HomeLayout, compact: boolean): HomeLayout {
  return { ...layout, compact, widgets: settle(layout.widgets, compact) };
}

/**
 * 보기 화면에서 실제 높이로 다시 놓기. 높이가 내용으로 정해지는 위젯(높이 반응형)은 정한 줄 수와 실제 높이가 달라서,
 * 그대로 두면 아래 위젯과 사이가 벌어지거나 겹친다. 그래서 같은 세로줄의 아래 위젯을 실제 높이에 맞춰 올리거나 내린다.
 * 사용자가 일부러 띄운 간격은 그대로 둔다: 위젯마다, 같은 세로줄에서 위에 있던 위젯들의 새 아래 끝(가장 아래) + 바로 위와의 원래 간격.
 * need: 위젯 id → 실제 필요한 줄 수 (없으면 정한 높이 그대로)
 */
export function reflowLayout<T extends Box & { id: string }>(widgets: T[], need: Record<string, number>): T[] {
  const sorted = [...widgets].sort(byPosition);
  const done = new Map<string, T>();
  for (const w of sorted) {
    const h = Math.max(1, need[w.id] ?? w.h);
    // 같은 세로줄에서 위에 있던 위젯들의 (원래 · 새) 아래 끝 중 가장 아래. 위에 아무것도 없으면 제자리
    let oldBottom: number | undefined;
    let newBottom = 0;
    for (const a of sorted) {
      const moved = done.get(a.id);
      if (!moved || a.y + a.h > w.y || a.x >= w.x + w.w || w.x >= a.x + a.w) continue;
      oldBottom = Math.max(oldBottom ?? 0, a.y + a.h);
      newBottom = Math.max(newBottom, moved.y + moved.h);
    }
    // 바로 위와의 원래 간격은 그대로
    done.set(w.id, { ...w, y: oldBottom == null ? w.y : newBottom + (w.y - oldBottom), h });
  }
  return sorted.map((w) => done.get(w.id)!);
}

export interface FollowGroup {
  ids: string[];
  x: number;
  w: number;
  /** 묶음의 위 끝 */
  y: number;
  /** 묶음이 따라 내려갈 수 있는 아래 끝 (그 아래 다른 위젯이 있으면 거기 앞까지, 없으면 격자 끝) */
  stop: number;
}

/**
 * 보기 화면에서 스크롤을 따라 내려오는 옆 단 묶음 (다른 페이지의 사이드바처럼).
 * 내용만큼 늘어나는 긴 위젯(글 목록 등) 옆에 있으면서 그 세로줄과 겹치지 않는 위젯들을, 세로줄이 겹치는 것끼리 한 묶음으로.
 * 묶음은 칸을 아래 끝까지 넓혀 그 안에서 화면에 붙어(sticky) 따라온다.
 */
export function followGroups<T extends Box & { id: string }>(widgets: T[], isLong: (w: T) => boolean, gap: number): FollowGroup[] {
  const longs = widgets.filter(isLong);
  const cols = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w;
  const side = widgets.filter((w) => !isLong(w) && !longs.some((l) => cols(l, w)) && longs.some((l) => l.y < w.y + w.h && w.y < l.y + l.h));
  // 세로줄이 겹치는 것끼리 묶기
  const groups: T[][] = [];
  for (const w of [...side].sort(byPosition)) {
    const hit = groups.filter((g) => g.some((o) => cols(o, w)));
    const merged = hit.flat().concat(w);
    for (const g of hit) groups.splice(groups.indexOf(g), 1);
    groups.push(merged);
  }
  const end = widgets.reduce((n, w) => Math.max(n, w.y + w.h), 0);
  return groups.map((g) => {
    const x = Math.min(...g.map((w) => w.x));
    const right = Math.max(...g.map((w) => w.x + w.w));
    const y = Math.min(...g.map((w) => w.y));
    const bottom = Math.max(...g.map((w) => w.y + w.h));
    const box = { x, w: right - x, y, h: bottom - y };
    // 아래에 묶음 밖 위젯이 같은 세로줄에 있으면 그 위젯 바로 위(간격 남기고)까지만
    const below = widgets.filter((o) => !g.includes(o) && o.y >= bottom && cols(o, box)).map((o) => o.y - gap);
    return { ids: g.map((w) => w.id), x, w: box.w, y, stop: Math.max(bottom, Math.min(end, ...below)) };
  });
}

/** 격자에 쓰인 줄 수 */
export const rowsOf = (widgets: Box[]) => widgets.reduce((n, w) => Math.max(n, w.y + w.h), 0);

/** 좁은 화면(한 줄로 쌓기)에서의 순서: 위 → 아래, 같은 줄이면 왼쪽부터 */
export const stackOrder = <T extends Box>(widgets: T[]) => [...widgets].sort(byPosition);

/** 줄 수 → px 높이 */
export const rowsPx = (h: number) => h * ROW + (h - 1) * GAP;

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

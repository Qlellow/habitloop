import type { PetPublic, PetSpecies, PetStage } from '../types';

/**
 * 커뮤니티 펫 도트(픽셀) 그림. 종 · 자란 단계 · 표정으로 그때그때 만든다 (18 × 18 칸). 웹 · 앱이 함께 쓴다
 *   몸: 자랄수록 커지는 타원 (슬라임은 바닥이 납작) + 테두리 · 그림자 · 하이라이트
 *   종마다: 고양이 귀 · 꼬리 · 하얀 배, 병아리 부리 · 날개 · 발 · 볏, 슬라임 새싹
 *   표정: 눈(깜빡 · 졸림), 볼, 입 / 꾸미기: 리본(Lv15) · 왕관(Lv20)
 */

export const PET_GRID = 18;
const G = PET_GRID;
type Grid = (string | undefined)[][];

const PALETTE: Record<PetSpecies, Record<string, string>> = {
  slime: { o: '#1f6b3a', b: '#5ad17a', d: '#38a85a', l: '#b6f5c6', w: '#ffffff', e: '#1b2a22', c: '#ff9ab0', m: '#1b2a22', n: '#ff9ab0', g: '#2f7d2a' },
  cat: { o: '#5b3a1e', b: '#f4a35b', d: '#d07a33', l: '#ffd2a0', w: '#fff3e3', e: '#2b1d12', c: '#ff9ab0', m: '#2b1d12', n: '#ff7a9a', g: '#2f7d2a' },
  chick: { o: '#7a5a00', b: '#ffd84a', d: '#f0b400', l: '#fff3a8', w: '#ffffff', e: '#2b2310', c: '#ffab9a', m: '#2b2310', n: '#ff8a1f', g: '#2f7d2a' },
};
const COMMON = { r: '#e8404a', k: '#a8202a', y: '#ffc21a', Y: '#fff1a0' };
const EGG = { o: '#5b4b3a', s: '#fff4dc', d: '#e8d6b4', x: '#5b4b3a' };

const SIZE: Record<Exclude<PetStage, 'egg'>, [number, number]> = { baby: [10, 8], junior: [12, 10], adult: [14, 12] };

export interface PetLook {
  species: PetSpecies;
  stage: PetStage;
  /** 눈 감음 (깜빡 · 잠) */
  eyesClosed?: boolean;
  happy?: boolean;
  accessory?: PetPublic['accessory'];
  /** 걸을 때 두 장을 번갈아 */
  frame?: 0 | 1;
  /** 알: 부화까지 얼마나 왔는지 (0 ~ 1) → 금이 간다 */
  progress?: number;
}

export function buildPet(look: PetLook): { grid: Grid; colors: Record<string, string> } {
  const grid: Grid = Array.from({ length: G }, () => Array<string | undefined>(G).fill(undefined));
  const set = (x: number, y: number, k: string) => {
    if (x >= 0 && x < G && y >= 0 && y < G) grid[y][x] = k;
  };
  const get = (x: number, y: number) => (x >= 0 && x < G && y >= 0 && y < G ? grid[y][x] : undefined);
  const cx = (G - 1) / 2;

  if (look.stage === 'egg') {
    const rx = 4.2;
    const ry = 5.3;
    const cy = 16 - ry + 0.5;
    for (let y = 0; y < G; y++)
      for (let x = 0; x < G; x++) {
        const ny = (y - cy) / ry;
        // 위가 좁은 달걀 모양
        const w = rx * (ny < 0 ? 1 - ny * ny * 0.25 : 1);
        if (((x - cx) / w) ** 2 + ny ** 2 <= 1) set(x, y, ny > 0.45 ? 'd' : 's');
      }
    outline(grid, set, get);
    // 종 색 점박이
    for (const [x, y] of [[7, 9], [10, 11], [7, 13], [10, 14]]) if (get(x, y) && get(x, y) !== 'o') set(x, y, 'b');
    // 부화가 가까울수록 금이 간다
    const cracks = [[6, 12], [7, 11], [8, 12], [9, 11], [10, 12], [11, 11]];
    cracks.slice(0, Math.floor((look.progress ?? 0) * (cracks.length + 1))).forEach(([x, y]) => set(x, y, 'x'));
    return { grid, colors: { ...EGG, b: PALETTE[look.species].b } };
  }

  const [w, h] = SIZE[look.stage];
  const rx = w / 2;
  const ry = h / 2;
  const cy = 16 - ry + 0.5;
  const squash = look.frame ? 0.06 : 0;
  for (let y = 0; y < G; y++)
    for (let x = 0; x < G; x++) {
      const nx = (x - cx) / (rx * (1 + squash));
      const ny = (y - cy) / (ry * (1 - squash));
      // 슬라임은 아래가 납작한 젤리
      const inside = look.species === 'slime' && ny > 0 ? Math.abs(nx) ** 2.6 + Math.abs(ny) ** 4 <= 1 : nx * nx + ny * ny <= 1;
      if (!inside) continue;
      let k = 'b';
      if (ny > 0.5) k = 'd';
      if (look.species === 'cat' && Math.abs(nx) < 0.42 && ny > 0.05) k = 'w';
      if (nx < -0.2 && nx > -0.72 && ny < -0.3 && ny > -0.85) k = 'l';
      set(x, y, k);
    }
  outline(grid, set, get);

  const top = grid.findIndex((row) => row.some(Boolean));
  const left = Math.min(...grid.map((row) => row.findIndex(Boolean)).filter((i) => i >= 0));
  const right = G - 1 - left;
  const ey = Math.round(cy - ry * 0.12);
  const d = Math.max(1, Math.round(rx * 0.42 - 0.5));
  const exL = 8 - d;
  const exR = 9 + d;

  // 눈 (감으면 아래 한 줄만)
  for (const ex of [exL, exR]) {
    if (look.eyesClosed) set(ex, ey + 1, 'e');
    else {
      set(ex, ey, 'e');
      set(ex, ey + 1, 'e');
    }
  }
  // 볼
  set(exL - 1, ey + 2, 'c');
  set(exR + 1, ey + 2, 'c');

  if (look.species === 'cat') {
    // 귀: 머리 위 양옆의 삼각형 (안쪽은 분홍)
    const xL = Math.round(cx - rx * 0.5);
    for (const [ax, m] of [[xL, 1], [G - 1 - xL, -1]] as const) {
      set(ax, top - 2, 'o');
      set(ax - m, top - 1, 'o');
      set(ax, top - 1, 'c');
      set(ax + m, top - 1, 'o');
      set(ax - 2 * m, top, 'o');
      set(ax - m, top, 'b');
      set(ax, top, 'c');
      set(ax + m, top, 'b');
      set(ax + 2 * m, top, 'o');
    }
    // 코 · 입
    set(8, ey + 1, 'n');
    set(9, ey + 1, 'n');
    if (look.happy) {
      set(8, ey + 2, 'm');
      set(9, ey + 2, 'm');
    }
    // 꼬리 (걸을 때 끝이 살랑)
    if (look.stage !== 'baby') {
      const tip = look.frame ? 0 : -1;
      set(right + 1, Math.round(cy) + 2, 'o');
      set(right + 2, Math.round(cy) + 1, 'd');
      set(right + 2, Math.round(cy), 'd');
      set(right + 3, Math.round(cy) - 1 + tip + 1, 'd');
    }
  } else if (look.species === 'chick') {
    // 부리
    set(8, ey + 2, 'n');
    set(9, ey + 2, 'n');
    if (look.happy) set(8, ey + 3, 'n');
    // 날개 (걸을 때 파닥)
    const wy = Math.round(cy) + (look.frame ? 0 : 1);
    set(left + 1, wy, 'd');
    set(left + 1, wy + 1, 'd');
    set(right - 1, wy, 'd');
    set(right - 1, wy + 1, 'd');
    // 발
    for (const x of [6, 7, 10, 11]) set(x, 17, 'n');
    // 머리 위: 아기 · 어린이는 깃털 한 가닥, 어른은 볏
    if (look.stage === 'adult') {
      set(8, top - 1, 'r');
      set(9, top - 1, 'r');
      set(9, top - 2, 'r');
      set(10, top - 1, 'r');
    } else {
      set(9, top - 1, 'o');
      set(8, top - 2, 'o');
    }
  } else {
    // 슬라임: 입 + 어린이부터 머리에 새싹
    if (look.happy) {
      set(8, ey + 2, 'm');
      set(9, ey + 2, 'm');
    }
    if (look.stage !== 'baby') {
      set(9, top - 1, 'g');
      set(9, top - 2, 'g');
      set(10, top - 3, 'g');
      if (look.stage === 'adult') set(8, top - 3, 'g');
    }
  }

  // 꾸미기
  if (look.accessory === 'crown') {
    for (let x = 6; x <= 11; x++) set(x, top - 1, 'y');
    for (const x of [6, 8, 9, 11]) set(x, top - 2, 'y');
    set(8, top - 1, 'Y');
  } else if (look.accessory === 'ribbon') {
    const a = exR;
    set(a, top - 1, 'r');
    set(a + 1, top - 1, 'k');
    set(a + 2, top - 1, 'r');
    set(a, top, 'r');
    set(a + 2, top, 'r');
  }
  return { grid, colors: { ...PALETTE[look.species], ...COMMON } };
}

/** 몸 가장자리(바깥과 닿은 칸)를 테두리로 */
function outline(grid: Grid, set: (x: number, y: number, k: string) => void, get: (x: number, y: number) => string | undefined) {
  const edge: [number, number][] = [];
  for (let y = 0; y < G; y++)
    for (let x = 0; x < G; x++) {
      if (!grid[y][x]) continue;
      if (!get(x - 1, y) || !get(x + 1, y) || !get(x, y - 1) || !get(x, y + 1)) edge.push([x, y]);
    }
  edge.forEach(([x, y]) => set(x, y, 'o'));
}

/** 같은 색이 이어지는 가로 칸을 한 사각형으로 */
export function petRects(look: PetLook) {
  const { grid, colors } = buildPet(look);
  const rects: { x: number; y: number; w: number; c: string }[] = [];
  grid.forEach((row, y) => {
    let x = 0;
    while (x < G) {
      const k = row[x];
      if (!k) {
        x++;
        continue;
      }
      let w = 1;
      while (x + w < G && row[x + w] === k) w++;
      rects.push({ x, y, w, c: colors[k] ?? '#f0f' });
      x += w;
    }
  });
  return rects;
}

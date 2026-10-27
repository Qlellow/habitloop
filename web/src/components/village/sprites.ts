/**
 * 채널 마을 도트 그림. 건물마다 작은 칸 그림(Pix)을 함수로 만든다.
 * 칸의 색은 글자 하나(팔레트 키)로 두고, 실제 색은 CSS 변수(village.css 의 .vk-*)가 정한다 → 라이트 · 다크(밤) 테마
 *   o 테두리 · w 벽 · W 벽 그늘 · r 빨간 지붕 · R 그늘 · b 파란 지붕 · B 그늘 · n 나무 · N 짙은 나무 · s 돌 · S 짙은 돌
 *   g 잎 · G 짙은 잎 · t 줄기 · y 창(밤에 불빛) · c 천 · C 천 그늘 · a 물 · A 깊은 물 · f 불꽃 · F 불꽃 속
 *   p 분홍 꽃 · v 보라 꽃 · e 흰색 · k 어두운 문 · l 등불 · m 쇠 · h 금색
 */
export class Pix {
  readonly cells = new Map<string, string>();
  constructor(
    readonly w: number,
    readonly h: number,
  ) {}
  px(x: number, y: number, c: string) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.cells.set(`${x},${y}`, c);
    return this;
  }
  get(x: number, y: number) {
    return this.cells.get(`${x},${y}`);
  }
  rect(x: number, y: number, w: number, h: number, c: string) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
    return this;
  }
  /** 삼각 지붕: 꼭대기 (cx, top) 에서 아래로 갈수록 한 칸씩 넓어진다. 오른쪽 절반은 그늘 색 */
  roof(cx: number, top: number, rows: number, c: string, shade = c) {
    for (let j = 0; j < rows; j++) for (let i = -j; i <= j; i++) this.px(cx + i, top + j, i > 0 ? shade : c);
    return this;
  }
  /** 칠한 칸 바깥에 테두리 (이미 칠한 칸은 그대로) */
  outline(c = 'o') {
    const add: [number, number][] = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        const near = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => {
          const k = this.get(x + dx, y + dy);
          return k && k !== c;
        });
        if (near) add.push([x, y]);
      }
    add.forEach(([x, y]) => this.px(x, y, c));
    return this;
  }
  /** 같은 색이 이어지는 가로 칸을 한 사각형으로 */
  rects() {
    const out: { x: number; y: number; w: number; c: string }[] = [];
    for (let y = 0; y < this.h; y++) {
      let x = 0;
      while (x < this.w) {
        const c = this.get(x, y);
        if (!c) {
          x++;
          continue;
        }
        let w = 1;
        while (x + w < this.w && this.get(x + w, y) === c) w++;
        out.push({ x, y, w, c });
        x += w;
      }
    }
    return out;
  }
}

/** 창문 (2×2, 십자 창살) */
const win = (p: Pix, x: number, y: number) => p.rect(x, y, 2, 2, 'y').px(x, y, 'e');

const sprites = {
  campfire() {
    const p = new Pix(9, 4);
    p.rect(1, 3, 7, 1, 'N').rect(2, 2, 2, 1, 'n').rect(5, 2, 2, 1, 'n');
    return p;
  },
  /** 모닥불 불꽃 (따로 그려 깜빡인다) */
  flame() {
    const p = new Pix(9, 6);
    p.px(4, 0, 'F').rect(3, 1, 3, 1, 'f').px(4, 1, 'F').rect(2, 2, 5, 2, 'f').rect(3, 2, 3, 2, 'F').rect(3, 4, 3, 1, 'f');
    return p;
  },
  /** 목록 그림: 장작 + 불꽃 */
  campfireIcon() {
    const p = new Pix(9, 10);
    sprites.flame().cells.forEach((c, k) => {
      const [x, y] = k.split(',').map(Number);
      p.px(x, y, c);
    });
    sprites.campfire().cells.forEach((c, k) => {
      const [x, y] = k.split(',').map(Number);
      p.px(x, y + 6, c);
    });
    return p;
  },
  tent() {
    const p = new Pix(15, 11);
    p.roof(7, 1, 9, 'c', 'C');
    p.rect(6, 6, 3, 4, 'k').px(7, 5, 'k');
    p.rect(0, 10, 15, 1, 'N');
    p.px(7, 0, 'n');
    return p.outline();
  },
  well() {
    const p = new Pix(13, 14);
    p.roof(6, 0, 4, 'r', 'R');
    p.rect(2, 4, 1, 5, 'N').rect(10, 4, 1, 5, 'N');
    p.rect(3, 5, 7, 1, 'n').px(6, 6, 'm').px(6, 7, 'm');
    p.rect(1, 9, 11, 4, 's').rect(2, 9, 9, 1, 'A');
    for (const x of [1, 4, 7, 10]) p.px(x, 11, 'S');
    return p.outline();
  },
  flowers() {
    const p = new Pix(14, 4);
    const f = [
      [1, 'p'],
      [4, 'v'],
      [7, 'h'],
      [10, 'p'],
      [12, 'v'],
    ] as const;
    for (const [x, c] of f) p.px(x, 1, c).px(x - 1, 2, 'g').px(x, 2, 'G').px(x + 1, 2, 'g');
    p.rect(0, 3, 14, 1, 'G');
    return p;
  },
  cottage() {
    const p = new Pix(22, 20);
    p.rect(15, 1, 3, 6, 's').px(16, 0, 'S');
    p.roof(10, 2, 9, 'r', 'R');
    p.rect(3, 11, 15, 8, 'w').rect(14, 11, 4, 8, 'W');
    p.rect(9, 14, 3, 5, 'k').px(11, 16, 'h');
    win(p, 5, 13);
    win(p, 14, 13);
    return p.outline();
  },
  board() {
    const p = new Pix(14, 12);
    p.rect(1, 2, 12, 6, 'n').rect(1, 7, 12, 1, 'N');
    p.rect(2, 3, 3, 3, 'e').rect(6, 3, 2, 2, 'h').rect(9, 3, 3, 3, 'e').px(3, 4, 'k').px(10, 4, 'k');
    p.rect(2, 8, 1, 4, 'N').rect(11, 8, 1, 4, 'N');
    p.rect(0, 1, 14, 1, 'r');
    return p.outline();
  },
  lamp() {
    const p = new Pix(5, 14);
    p.rect(1, 1, 3, 3, 'l').rect(0, 0, 5, 1, 'm').rect(1, 4, 3, 1, 'm');
    p.rect(2, 5, 1, 8, 'm').rect(1, 13, 3, 1, 'm');
    return p;
  },
  cafe() {
    const p = new Pix(30, 20);
    p.rect(1, 2, 28, 2, 'b').rect(1, 1, 28, 1, 'B');
    p.rect(2, 4, 26, 15, 'w').rect(22, 4, 6, 15, 'W');
    // 줄무늬 차양
    for (let x = 1; x < 29; x++) p.rect(x, 8, 1, 3, x % 4 < 2 ? 'r' : 'e');
    p.rect(1, 11, 28, 1, 'R');
    p.rect(4, 13, 6, 4, 'y').rect(4, 13, 6, 1, 'e');
    p.rect(13, 12, 4, 7, 'k').px(16, 15, 'h');
    p.rect(20, 13, 6, 4, 'y').rect(20, 13, 6, 1, 'e');
    p.rect(9, 5, 12, 2, 'n').rect(11, 5, 1, 1, 'e').rect(14, 5, 2, 1, 'e').rect(18, 5, 1, 1, 'e');
    return p.outline();
  },
  bench() {
    const p = new Pix(22, 18);
    // 나무
    p.rect(14, 2, 7, 7, 'g').rect(13, 4, 9, 3, 'g').rect(17, 3, 3, 5, 'G').rect(16, 9, 2, 8, 't');
    // 벤치
    p.rect(1, 11, 11, 1, 'n').rect(1, 13, 11, 1, 'n').rect(2, 14, 1, 3, 'N').rect(10, 14, 1, 3, 'N').rect(1, 10, 1, 4, 'N').rect(11, 10, 1, 4, 'N');
    return p.outline();
  },
  library() {
    const p = new Pix(34, 24);
    p.roof(17, 1, 8, 's', 'S').rect(3, 8, 28, 2, 'S');
    p.rect(4, 10, 26, 12, 'w').rect(25, 10, 5, 12, 'W');
    for (const x of [6, 11, 21, 26]) p.rect(x, 10, 2, 12, 'e').px(x + 1, 10, 'W');
    p.rect(14, 13, 6, 9, 'k').rect(15, 14, 4, 1, 'y');
    p.rect(2, 22, 30, 2, 'S');
    p.rect(15, 4, 4, 2, 'h');
    return p.outline();
  },
  fountain() {
    const p = new Pix(24, 12);
    p.rect(2, 7, 20, 4, 's').rect(3, 7, 18, 1, 'a').rect(1, 11, 22, 1, 'S');
    for (const x of [3, 9, 15, 20]) p.px(x, 9, 'S');
    p.rect(10, 3, 4, 4, 's').rect(11, 2, 2, 1, 'S');
    return p.outline();
  },
  /** 분수 물줄기 (따로 그려 반짝인다) */
  spray() {
    const p = new Pix(24, 8);
    p.rect(11, 0, 2, 3, 'a').px(10, 1, 'e').px(13, 1, 'e').px(9, 3, 'a').px(14, 3, 'a').px(8, 5, 'a').px(15, 5, 'a').px(12, 0, 'e');
    return p;
  },
  windmill() {
    const p = new Pix(24, 34);
    for (let j = 0; j < 20; j++) {
      const half = 4 + Math.floor(j / 4);
      p.rect(12 - half, 13 + j, half * 2, 1, j % 6 === 0 ? 'W' : 'w');
      p.rect(12, 13 + j, half, 1, j % 6 === 0 ? 'S' : 'W');
    }
    p.roof(12, 8, 6, 'r', 'R');
    p.rect(10, 28, 4, 5, 'k').rect(10, 20, 3, 3, 'y');
    return p.outline();
  },
  /** 풍차 날개 (중심 (12,12) 를 축으로 돈다) */
  blades() {
    const p = new Pix(25, 25);
    for (let i = 2; i < 12; i++) {
      p.px(12, i, 'N').px(12, 24 - i, 'N').px(i, 12, 'N').px(24 - i, 12, 'N');
      if (i < 9) {
        p.rect(13, i, 2, 1, 'e').rect(10, 24 - i, 2, 1, 'e').rect(i, 10, 1, 2, 'e').rect(24 - i, 13, 1, 2, 'e');
      }
    }
    p.rect(11, 11, 3, 3, 'm');
    return p;
  },
  clocktower() {
    const p = new Pix(16, 44);
    p.roof(8, 0, 9, 'b', 'B');
    p.rect(2, 9, 12, 33, 's').rect(10, 9, 4, 33, 'S');
    p.rect(4, 12, 8, 8, 'e').rect(7, 13, 1, 4, 'k').rect(7, 16, 3, 1, 'k');
    win(p, 7, 24);
    win(p, 7, 30);
    p.rect(6, 36, 4, 6, 'k');
    p.rect(1, 42, 14, 2, 'S');
    return p.outline();
  },
  lighthouse() {
    const p = new Pix(14, 46);
    p.roof(7, 0, 4, 'r', 'R');
    p.rect(3, 4, 8, 5, 'l').rect(2, 9, 10, 2, 'm');
    for (let j = 0; j < 33; j++) {
      const half = 3 + Math.floor(j / 11);
      p.rect(7 - half, 11 + j, half * 2, 1, Math.floor(j / 6) % 2 ? 'r' : 'e');
    }
    p.rect(6, 38, 2, 6, 'k');
    return p.outline();
  },
  castle() {
    const p = new Pix(48, 38);
    const tower = (x: number, top: number) => {
      p.rect(x, top, 10, 38 - top - 2, 's').rect(x + 7, top, 3, 38 - top - 2, 'S');
      for (let i = 0; i < 10; i += 3) p.rect(x + i, top - 2, 2, 2, 's');
      p.rect(x + 4, top + 5, 2, 3, 'y');
    };
    p.rect(8, 14, 32, 22, 's').rect(32, 14, 8, 22, 'S');
    for (let i = 8; i < 40; i += 4) p.rect(i, 12, 2, 2, 's');
    tower(1, 8);
    tower(37, 8);
    // 가운데 탑 + 깃발
    p.rect(19, 4, 10, 10, 's').rect(26, 4, 3, 10, 'S').roof(24, 0, 4, 'b', 'B');
    p.rect(21, 22, 6, 14, 'k').rect(22, 21, 4, 1, 'k');
    p.rect(13, 18, 2, 3, 'y').rect(33, 18, 2, 3, 'y').rect(23, 7, 2, 3, 'y');
    p.rect(0, 36, 48, 2, 'S');
    p.outline();
    p.rect(24, 0, 1, 1, 'o');
    return p;
  },
  /** 공사 중 (다음에 생길 자리) */
  scaffold() {
    const p = new Pix(16, 14);
    p.rect(1, 0, 1, 13, 'n').rect(14, 0, 1, 13, 'n').rect(1, 4, 14, 1, 'n').rect(1, 9, 14, 1, 'n');
    for (let i = 0; i < 4; i++) p.px(2 + i * 3, 5 + i, 'N').px(3 + i * 3, 5 + i, 'N');
    p.rect(5, 11, 6, 2, 'r').rect(6, 10, 4, 1, 'R');
    p.rect(0, 13, 16, 1, 'N');
    return p;
  },
  villager() {
    const p = new Pix(3, 6);
    p.px(1, 0, 'e').rect(0, 1, 3, 1, 'e').rect(0, 2, 3, 2, 'c').px(0, 4, 'k').px(2, 4, 'k').px(0, 5, 'k').px(2, 5, 'k');
    return p;
  },
} as const;

export type SpriteName = keyof typeof sprites;

const cache = new Map<SpriteName, Pix>();
export function sprite(name: SpriteName): Pix {
  let p = cache.get(name);
  if (!p) cache.set(name, (p = sprites[name]()));
  return p;
}

/**
 * 마을 지도 (240 × 90 칸): 건물마다 놓일 자리 (x, 바닥 y). 뒤쪽(바닥이 위)부터 그린다.
 * 건물 하나가 여러 자리를 쓰기도 한다 (가로등 셋)
 */
export const LOTS: Record<string, { sprite: SpriteName; x: number; base: number }[]> = {
  windmill: [{ sprite: 'windmill', x: 6, base: 58 }],
  castle: [{ sprite: 'castle', x: 166, base: 54 }],
  lighthouse: [{ sprite: 'lighthouse', x: 222, base: 62 }],
  clocktower: [{ sprite: 'clocktower', x: 124, base: 64 }],
  library: [{ sprite: 'library', x: 84, base: 66 }],
  cottage: [{ sprite: 'cottage', x: 38, base: 68 }],
  cafe: [{ sprite: 'cafe', x: 146, base: 70 }],
  tent: [{ sprite: 'tent', x: 64, base: 72 }],
  well: [{ sprite: 'well', x: 186, base: 74 }],
  board: [{ sprite: 'board', x: 20, base: 82 }],
  bench: [{ sprite: 'bench', x: 196, base: 84 }],
  fountain: [{ sprite: 'fountain', x: 104, base: 86 }],
  campfire: [{ sprite: 'campfire', x: 76, base: 85 }],
  lamps: [
    { sprite: 'lamp', x: 52, base: 88 },
    { sprite: 'lamp', x: 140, base: 88 },
    { sprite: 'lamp', x: 182, base: 88 },
  ],
  flowers: [
    { sprite: 'flowers', x: 4, base: 89 },
    { sprite: 'flowers', x: 160, base: 90 },
    { sprite: 'flowers', x: 222, base: 89 },
  ],
};

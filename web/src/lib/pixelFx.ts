import type { FxDesign } from './settings';

/**
 * 인터랙티브 커서: 도트(픽셀) 파티클.
 * 고른 디자인(별 · 하트 · 벚꽃 · 눈 · 불꽃) 하나가 상황마다 다른 애니메이션을 낸다.
 *   움직일 때 → 꼬리, 버튼에 올릴 때 → 반짝임 등, 누를 때 → 터짐, 글을 쓸 때 → 글자 커서 주위를 맴돈다
 * 그리고 디자인마다 아주 낮은 확률로 숨은 애니메이션이 나온다 (소행성 · 눈 쌓이기 · 폭죽 · 큰 하트 · 무지개 하트 · 꽃바람 · 함박눈).
 *
 * 모든 그림은 3px 도트를 격자에 맞춰 찍는다 (흐릿하게 번지지 않는 도트 그래픽).
 * 성능: 화면을 덮는 캔버스 하나에 사각형만 그린다 (DOM 을 만들지 않음). 그릴 게 없으면 멈춘다.
 */

/** 도트 한 칸 (CSS px) */
const PX = 3;
const MAX = 260;
const TARGET = 'a[href], button:not(:disabled), [role="button"], [role="option"], [role="radio"], [role="switch"], [role="menuitem"], [role="tab"], summary, [data-fx]';
const TYPING = 'textarea, input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]), [contenteditable="true"], [contenteditable=""]';

/**
 * 숨은 애니메이션 확률 ('아주 가끔' 보이게)
 *  - click: 버튼 · 링크를 누를 때마다 (약 300번에 1번)
 *  - snowPile: 눈 디자인으로 버튼에 2.5초 머무를 때마다 (30번에 1번)
 *  - rainbow: 하트 디자인으로 마우스를 움직이는 동안 1분에 한 번만 굴린다 (평균 20분에 1번)
 */
const HIDDEN = { click: 0.003, snowPile: 1 / 30, rainbow: 0.05 };
const RAINBOW_EVERY = 60_000;

/* ───────── 도트 그림 ───────── */

type Sprite = [number, number, number][];
/** 문자열 도트 그림 → 칸 목록. '.' 는 빈칸, 숫자는 팔레트 번호 */
const sprite = (...rows: string[]): Sprite =>
  rows.flatMap((row, y) => [...row].flatMap((ch, x) => (ch === '.' ? [] : [[x - (row.length - 1) / 2, y - (rows.length - 1) / 2, Number(ch)] as [number, number, number]])));

/** 90° 돌린 그림 (소행성이 굴러가게) */
const rot = (sp: Sprite): Sprite => sp.map(([x, y, c]) => [-y, x, c]);
const ROCK = sprite('..000.', '.01120', '011220', '012202', '.0220.', '..00..');
const ROCK_FRAMES = [ROCK, rot(ROCK), rot(rot(ROCK)), rot(rot(rot(ROCK)))];

const S_ICICLE = [sprite('0', '1'), sprite('0', '0', '1'), sprite('0', '0', '0', '1')];

const S = {
  px: sprite('0'),
  plus: sprite('.0.', '010', '.0.'),
  cross: sprite('..0..', '..0..', '00100', '..0..', '..0..'),
  star: sprite('..0..', '.010.', '01110', '.0.0.', '0...0'),
  heartS: sprite('0.0', '010', '.0.'),
  heartB: sprite('.0.0.', '01000', '00000', '.000.', '..0..'),
  petal: sprite('.00', '010', '00.'),
  petalB: sprite('..00', '.010', '0100', '00..'),
  flower: sprite('.0.0.', '00100', '.010.', '00100', '.0.0.'),
  flakeS: sprite('0.0', '.1.', '0.0'),
  flakeB: sprite('0.0.0', '.000.', '00100', '.000.', '0.0.0'),
  flame: sprite('.0.', '010', '121', '.1.'),
  spark: sprite('0.0', '.1.', '0.0'),
  smoke: sprite('00', '00'),
};

/** 색 팔레트: 0 = 주색, 1 = 밝은 가운데, 2 = 진한 테두리 (밝은 화면에서도 보이게) */
const PALETTE: Record<FxDesign, string[]> = {
  star: ['#ffc21a', '#fff3b0', '#e09a00'],
  heart: ['#ff4d6d', '#ffc2cf', '#d61f45'],
  sakura: ['#ff9eb5', '#fff0f3', '#e86a8a'],
  snow: ['#8fcbff', '#ffffff', '#4a9be8'],
  fire: ['#ff7a1a', '#ffd23f', '#ffffff'],
};
const FIREWORK = ['#ff4d6d', '#ffd23f', '#4dd2ff', '#7cff6b', '#c77dff', '#ff9f1c'];
const SMOKE = ['#9aa0aa', '#c7cbd3'];
/** 소행성: 0 = 테두리, 1 = 밝은 면, 2 = 바위 */
const ROCK_COLORS = ['#5f564e', '#c2b6a6', '#8a7f73'];
const BLAZE = ['#ff7a1a', '#ffd23f', '#ffffff'];
/** 서리 · 고드름 (밝은 화면에서도 보이게 진한 파랑 섞기) */
const FROST = [['#8fcbff'], ['#cfeaff'], ['#5aa8f0'], ['#ffffff']];
const ICICLE = ['#8fcbff', '#ffffff'];

/* ───────── 파티클 ───────── */

interface Point {
  x: number;
  y: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  frames: Sprite[];
  /** 이 간격(ms)마다 그림을 넘긴다. 없으면 수명에 맞춰 한 번 */
  frameMs?: number;
  colors: string[];
  gravity: number;
  /** 이 시간(ms)이 지나야 떨어지기 시작한다 (원형으로 퍼진 뒤 떨어지게) */
  gravityAfter?: number;
  /** 투명도 배수 */
  alpha?: number;
  drag: number;
  sway: number;
  /** 도트 크기 배수 */
  scale: number;
  seed: number;
  /** 글자 커서 주위를 맴돈다 */
  orbit?: { c: Point; r: number; a: number; w: number };
  /** 어떤 점을 향해 날아간다. 닿으면 onArrive */
  seek?: { to: () => Point; k: number; onArrive?: () => void };
  /** 정해진 시간(dur) 동안 from → to 로 점점 빨라지며 (소행성) */
  path?: { from: Point; to: () => Point; dur: number; onArrive: () => void };
  /** 버튼 테두리에 붙은 서리: 버튼 왼쪽 위에서 (dx, dy) 자리에 붙어 있는다 */
  anchor?: { dx: number; dy: number };
  /** 이 높이에 닿으면 멈춰 쌓인다 */
  land?: number;
  landed?: boolean;
  /** 사라지기 시작한 때 (수명과 따로) */
  fadeAt?: number;
  tag?: string;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

let particles: Particle[] = [];
/** 그리는 도중(파티클을 옮기는 중)에 생긴 파티클은 여기 모았다가 끝나고 합친다 (filter 중에 넣으면 사라진다) */
let updating = false;
let pending: Particle[] = [];
function add(p: Partial<Particle> & { x: number; y: number; frames: Sprite[]; colors: string[] }) {
  if (particles.length >= MAX) {
    // 넘치면 꼬리표 없는(평범한) 파티클부터 버린다
    const i = particles.findIndex((q) => !q.tag && !q.orbit);
    particles.splice(i < 0 ? 0 : i, 1);
  }
  const full: Particle = { vx: 0, vy: 0, age: 0, life: 800, gravity: 0, drag: 0.98, sway: 0, scale: 1, seed: Math.random() * 1000, ...p };
  (updating ? pending : particles).push(full);
  return full;
}
const fadeOut = (p: Particle) => {
  if (p.fadeAt == null) p.fadeAt = p.age;
};

/** 사각형 테두리 위의 아무 점 (여백 pad) */
function onEdge(r: DOMRect, pad = 4): Point {
  const w = r.width + pad * 2;
  const h = r.height + pad * 2;
  const x0 = r.left - pad;
  const y0 = r.top - pad;
  let d = Math.random() * (w + h) * 2;
  if (d < w) return { x: x0 + d, y: y0 };
  d -= w;
  if (d < h) return { x: x0 + w, y: y0 + d };
  d -= h;
  if (d < w) return { x: x0 + w - d, y: y0 + h };
  return { x: x0, y: y0 + h - (d - w) };
}

/* ───────── 상태 ───────── */

let design: FxDesign = 'star';
let colors = PALETTE.star;
let specialOnly = false;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let raf = 0;
let lastTime = 0;
let now = 0;
const pointer = { x: -1, y: -1, has: false };
let travel = 0;
let hoverEl: HTMLElement | null = null;
let hoverClock = 0;
let hoverTimer = 0;
let snowPile = false;
/** 눈: 버튼 테두리가 점점 얼어붙는다 */
let frostClock = 0;
let frostAge = 0;
let rainbowUntil = 0;
/** 무지개 하트를 마지막으로 굴린 때 (하트가 생길 때마다 굴리면 너무 자주 나와서 1분에 한 번만) */
let rainbowRolled = 0;
/** 글자 커서 위치 (맴도는 파티클이 따라간다) */
const caret: Point & { h: number } = { x: 0, y: 0, h: 18 };
/** 맴도는 고리의 가운데: 글자 줄 바로 위 (글자를 가리지 않게) */
const halo: Point = { x: 0, y: 0 };
let lastTypeAt = -1e9;
/** 개발용: 다음 클릭을 숨은 애니메이션으로 */
let forceHidden = false;

/** 지금 색 (하트의 숨은 무지개 동안에는 색이 돈다) */
const c = () => (design === 'heart' && now < rainbowUntil ? [`hsl(${(now / 4) % 360} 90% 62%)`, '#fff', `hsl(${(now / 4 + 40) % 360} 90% 45%)`] : colors);

/** 한 점에서 사방으로 */
function burst(x: number, y: number, n: number, opts: Partial<Particle> & { frames: Sprite[]; speed: [number, number] }) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
    const sp = rand(opts.speed[0], opts.speed[1]);
    add({ life: rand(500, 800), drag: 0.92, colors: c(), ...opts, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp });
  }
}

/** 누를 때: 3 ~ 5개가 같은 속도로 고르게 퍼져 원을 그린다 */
function ring(x: number, y: number, opts: Partial<Particle> & { frames: Sprite[]; speed?: number }) {
  const n = 3 + Math.floor(Math.random() * 3);
  const a0 = Math.random() * Math.PI * 2;
  const sp = opts.speed ?? rand(2.4, 2.8);
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * Math.PI * 2;
    add({ life: 700, drag: 0.9, colors: c(), ...opts, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp });
  }
}

/* ───────── 디자인별 애니메이션 ───────── */

interface Design {
  /** 움직일 때: 이만큼(px)마다 하나 */
  trailEvery: number;
  trail(x: number, y: number): void;
  /** 버튼에 올려 둔 동안: 이 간격(ms)마다 */
  hoverRate: number;
  hover(r: DOMRect): void;
  click(x: number, y: number): void;
  /** 글 쓸 때: 글자 커서 주위를 맴도는 파티클 + 글자마다 하나 */
  orbit: { n: number; r: number; w: number; frames: Sprite[]; frameMs?: number };
  key(x: number, y: number): void;
  /** 숨은 애니메이션 (버튼을 누를 때 아주 낮은 확률). el: 누른 버튼 */
  hiddenClick(x: number, y: number, el?: HTMLElement): void;
}

const DESIGNS: Record<FxDesign, Design> = {
  star: {
    trailEvery: 30,
    trail: (x, y) => add({ x, y, frames: [S.plus, S.px], vx: rand(-0.2, 0.2), vy: rand(-0.2, 0.2), life: rand(400, 650), colors: c() }),
    hoverRate: 220,
    // 반짝반짝: 버튼 둘레에서 작게 → 크게 → 작게
    hover: (r) => add({ ...onEdge(r, 6), frames: [S.px, S.plus, S.cross, S.plus, S.px], life: rand(1000, 1500), colors: c() }),
    click: (x, y) => ring(x, y, { frames: [S.star, S.plus], life: 650 }),
    orbit: { n: 3, r: 13, w: 0.006, frames: [S.plus, S.cross, S.plus], frameMs: 220 },
    key: (x, y) => add({ x: x + rand(-6, 6), y, frames: [S.px, S.plus, S.px], vy: -0.4, life: 450, colors: c(), alpha: 0.85 }),
    // 숨은 1: 하늘에서 소행성이 떨어져 버튼을 쿵! 하고 대신 눌러 준다 (asteroidClick)
    hiddenClick: (x, y, el) => asteroidClick(x, y, el),
  },
  heart: {
    trailEvery: 34,
    trail: (x, y) => {
      // 숨은 2: 잠깐 무지개 하트 (움직이는 동안 1분에 한 번 굴림)
      if (now - rainbowRolled >= RAINBOW_EVERY) {
        rainbowRolled = now;
        if (Math.random() < HIDDEN.rainbow) rainbowUntil = now + 5000;
      }
      add({ x, y, frames: [S.heartS], vy: rand(-0.6, -0.3), vx: rand(-0.2, 0.2), sway: 0.4, life: rand(500, 750), colors: c() });
    },
    hoverRate: 170,
    // 두근두근: 버튼 위쪽에서 하트가 뛰며 떠오른다
    hover: (r) =>
      add({ x: rand(r.left + 6, r.right - 6), y: r.top - 2, frames: [S.heartS, S.heartB], frameMs: 260, vy: rand(-0.8, -0.5), sway: 0.5, life: rand(800, 1200), colors: c() }),
    // 분수처럼 위로 솟았다 떨어진다
    click: (x, y) => {
      const n = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++)
        add({ x, y, frames: [S.heartB, S.heartS], vx: rand(-2.2, 2.2), vy: rand(-4, -2), gravity: 0.12, life: rand(700, 1000), colors: c() });
    },
    orbit: { n: 2, r: 12, w: 0.005, frames: [S.heartS, S.heartB], frameMs: 300 },
    key: (x, y) => add({ x: x + rand(-4, 4), y, frames: [S.heartS], vy: -0.6, sway: 0.4, life: 500, colors: c(), alpha: 0.85 }),
    // 숨은 1: 누른 곳에 큰 하트가 그려지고 두 번 뛴 뒤 터진다
    hiddenClick: (x, y) => {
      const born = now;
      const pts: Point[] = [];
      for (let t = 0; t < Math.PI * 2; t += Math.PI / 14) {
        pts.push({ x: 16 * Math.sin(t) ** 3, y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) });
      }
      pts.forEach((pt, i) => {
        const h = add({ x: x + rand(-80, 80), y: y + rand(-80, 80), frames: [S.heartS], life: 1e9, colors: c(), tag: 'big-heart' });
        h.seek = {
          to: () => {
            const beat = 2.6 + Math.max(0, Math.sin((now - born) / 120)) * 0.5;
            return { x: x + pt.x * beat, y: y + pt.y * beat };
          },
          k: 0.12,
        };
        window.setTimeout(() => {
          h.seek = undefined;
          const a = Math.atan2(h.y - y, h.x - x);
          h.vx = Math.cos(a) * 3;
          h.vy = Math.sin(a) * 3;
          h.drag = 0.93;
          fadeOut(h);
        }, 1500 + i * 8);
      });
    },
  },
  sakura: {
    trailEvery: 32,
    trail: (x, y) => add({ x, y, frames: [S.petal], vx: rand(-0.3, 0.3), vy: rand(0.2, 0.5), sway: 0.9, life: rand(700, 1000), colors: c() }),
    hoverRate: 360,
    // 꽃잎이 버튼 위에서 하늘하늘 떨어진다
    hover: (r) =>
      add({ x: rand(r.left, r.right), y: r.top - rand(2, 10), frames: [S.petal, S.petalB], frameMs: 300, vy: rand(0.3, 0.6), vx: rand(-0.2, 0.2), sway: 1.2, life: rand(900, 1300), colors: c() }),
    // 꽃잎이 원을 그리며 퍼졌다가 흩날리며 떨어진다
    click: (x, y) => ring(x, y, { frames: [S.petal, S.petalB], frameMs: 260, gravity: 0.035, gravityAfter: 220, sway: 1.1, life: 1400 }),
    orbit: { n: 4, r: 14, w: 0.004, frames: [S.petal, S.petalB], frameMs: 280 },
    key: (x, y) => add({ x: x + rand(-4, 4), y, frames: [S.px, S.petal], vy: -0.4, sway: 0.8, life: 500, colors: c(), alpha: 0.85 }),
    // 숨은 1: 꽃바람이 화면을 가로지른다
    hiddenClick: () => {
      for (let i = 0; i < 70; i++) {
        window.setTimeout(() => {
          add({ x: -10, y: rand(0, innerHeight), frames: [S.petal, S.petalB], frameMs: 250, vx: rand(4, 7), vy: rand(-0.6, 0.6), sway: 2, drag: 0.995, life: rand(2200, 3200), colors: c() });
          wake();
        }, i * 22);
      }
    },
  },
  snow: {
    trailEvery: 30,
    trail: (x, y) => add({ x, y, frames: [S.flakeS, S.px], vx: rand(-0.2, 0.2), vy: rand(0.2, 0.5), sway: 0.6, life: rand(700, 1000), colors: c() }),
    hoverRate: 300,
    // 버튼 위로 눈이 내린다 (숨은: 오래 올려 두면 버튼 위에 쌓인다)
    hover: (r) =>
      add({
        x: rand(r.left + 2, r.right - 2),
        y: r.top - rand(16, 30),
        frames: [S.flakeS, S.px],
        vy: rand(0.4, 0.7),
        sway: snowPile ? 0 : 0.5,
        drag: 1,
        life: snowPile ? 1e9 : rand(900, 1200),
        land: snowPile ? r.top - 2 - Math.floor(Math.random() * 3) * PX : undefined,
        colors: c(),
        tag: snowPile ? 'pile' : undefined,
      }),
    // 눈 결정이 원을 그리며 퍼졌다가 흩날리며 내려앉는다
    click: (x, y) => ring(x, y, { frames: [S.flakeB, S.flakeS], frameMs: 300, gravity: 0.025, gravityAfter: 220, sway: 0.9, life: 1500 }),
    orbit: { n: 4, r: 15, w: 0.003, frames: [S.flakeS, S.flakeB, S.flakeS], frameMs: 300 },
    key: (x, y) => add({ x: x + rand(-6, 6), y, frames: [S.px, S.flakeS], vy: -0.4, sway: 0.5, life: 500, colors: c(), alpha: 0.85 }),
    // 숨은 1: 온 화면에 눈이 펑펑
    hiddenClick: () => {
      for (let i = 0; i < 120; i++) {
        window.setTimeout(() => {
          add({ x: rand(0, innerWidth), y: -10, frames: [pick([S.flakeS, S.flakeB, S.px])], vy: rand(1, 2.2), sway: 1, drag: 1, life: rand(3500, 5000), colors: c() });
          wake();
        }, i * 35);
      }
    },
  },
  fire: {
    trailEvery: 26,
    trail: (x, y) => add({ x, y, frames: [S.px], vx: rand(-0.4, 0.4), vy: rand(-1, -0.5), life: rand(350, 600), colors: [pick(colors)] }),
    hoverRate: 220,
    // 버튼 위쪽 가장자리에서 불꽃이 너울거린다
    hover: (r) => {
      add({ x: rand(r.left + 4, r.right - 4), y: r.top + 1, frames: [S.flame, S.plus, S.px], vy: rand(-1.1, -0.6), vx: rand(-0.2, 0.2), gravity: -0.01, life: rand(450, 700), colors: c() });
      if (Math.random() < 0.15) add({ x: rand(r.left, r.right), y: r.top - 14, frames: [S.smoke], vy: -0.4, sway: 0.4, life: 900, colors: SMOKE });
    },
    // 불티가 원을 그리며 퍼졌다가 반짝이며 떨어진다
    click: (x, y) => ring(x, y, { frames: [S.spark, S.plus, S.px, S.plus], frameMs: 90, gravity: 0.06, gravityAfter: 200, life: 1000 }),
    orbit: { n: 3, r: 12, w: 0.008, frames: [S.flame, S.plus], frameMs: 160 },
    key: (x, y) => add({ x: x + rand(-4, 4), y, frames: [S.px], vy: -0.9, vx: rand(-0.3, 0.3), life: 400, colors: [pick(colors)], alpha: 0.85 }),
    // 숨은 1: 화면 아래에서 폭죽이 솟아 누른 곳에서 터진다
    hiddenClick: (x, y) => {
      const rocket = add({ x, y: innerHeight + 10, frames: [S.plus], life: 1e9, colors: ['#ffffff', '#ffd23f'], tag: 'rocket' });
      rocket.seek = {
        to: () => ({ x, y }),
        k: 0.08,
        onArrive: () => {
          fadeOut(rocket);
          for (let ring = 0; ring < 2; ring++) {
            const col = pick(FIREWORK);
            burst(x, y, 22, { frames: [S.plus, S.px], speed: ring ? [1.5, 2.2] : [3.2, 4.2], gravity: 0.04, colors: [col, '#ffffff', col], life: 1200, drag: 0.95 });
          }
        },
      };
    },
  },
};

/* ───────── 눈: 버튼 테두리가 점점 얼어붙는다 ───────── */

/** 올려 둔 동안 테두리에 서리가 하나씩 맺히고(처음엔 성기게 → 점점 빽빽하게), 1초쯤 지나면 아래에 고드름이 달린다 */
function growFrost(r: DOMRect, dt: number) {
  frostAge += dt;
  frostClock += dt;
  const perimeter = (r.width + r.height) * 2;
  const cap = Math.min(110, Math.round(perimeter / 4));
  let frost = 0;
  let icicles = 0;
  for (const p of particles) {
    if (p.tag === 'frost') frost++;
    else if (p.tag === 'icicle') icicles++;
  }
  // 점점 빨리 언다
  const every = Math.max(28, 90 - frostAge / 40);
  while (frostClock >= every) {
    frostClock -= every;
    if (frost < cap) {
      const e = onEdge(r, rand(-1, 2));
      add({ x: e.x, y: e.y, frames: [Math.random() < 0.18 ? S.plus : S.px], life: 1e9, colors: pick(FROST), tag: 'frost', anchor: { dx: e.x - r.left, dy: e.y - r.top } });
      frost++;
    }
    // 고드름: 아래쪽 가장자리에 길이 제각각으로
    if (frostAge > 1000 && icicles < Math.round(r.width / 14) && Math.random() < 0.25) {
      const len = Math.floor(Math.random() * 3);
      const dx = rand(6, r.width - 6);
      add({ x: r.left + dx, y: r.bottom, frames: [S_ICICLE[len]], life: 1e9, colors: ICICLE, tag: 'icicle', anchor: { dx, dy: r.height + 2 + len * PX * 0.5 } });
      icicles++;
    }
  }
}

/** 마우스를 떼면 서리는 녹아 사라지고 고드름은 똑 떨어진다 */
function meltFrost() {
  frostAge = 0;
  frostClock = 0;
  for (const p of particles) {
    if (p.tag !== 'frost' && p.tag !== 'icicle') continue;
    p.anchor = undefined;
    if (p.tag === 'icicle') {
      p.gravity = 0.15;
      p.life = p.age + 700;
    } else {
      p.vy = rand(0, 0.4);
      p.gravity = Math.random() < 0.3 ? 0.04 : 0;
      fadeOut(p);
    }
    p.tag = undefined;
  }
}

/* ───────── 숨은: 소행성이 떨어져 버튼을 대신 눌러 준다 (별) ───────── */

/** 사용자가 누른 진짜 클릭은 잠깐 붙잡아 두고, 소행성이 부딪히는 순간 대신 누른다 */
let held: { el: HTMLElement; clicked: boolean } | null = null;

function onClickCapture(e: MouseEvent) {
  if (!held || !e.isTrusted) return;
  const el = (e.target as Element).closest<HTMLElement>(TARGET);
  if (el !== held.el) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  held.clicked = true;
}

function asteroidClick(x: number, y: number, el?: HTMLElement) {
  if (!el) return DESIGNS.star.click(x, y);
  held = { el, clicked: false };
  const hold = held;
  const r = el.getBoundingClientRect();
  const hit = () => {
    const b = el.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  };
  const dir = Math.random() < 0.5 ? -1 : 1;
  const from = { x: r.left + r.width / 2 + dir * rand(160, 280), y: -24 };
  // 데굴데굴 구르며 불꼬리를 달고 떨어지는 바위
  const star = add({ ...from, frames: ROCK_FRAMES, frameMs: 70, life: 1e9, colors: ROCK_COLORS, scale: 2, tag: 'asteroid' });
  star.path = {
    from,
    to: hit,
    dur: 620,
    onArrive: () => {
      fadeOut(star);
      const p = hit();
      // 쿵: 버튼이 납작하게 눌렸다가 튕겨 오른다
      el.animate(
        [
          { translate: '0 0', scale: '1 1' },
          { translate: '0 5px', scale: '1.08 0.8', offset: 0.22 },
          { translate: '0 -3px', scale: '0.96 1.06', offset: 0.55 },
          { translate: '0 0', scale: '1 1' },
        ],
        { duration: 480, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' },
      );
      // 쾅: 바위가 부서져 조각이 양옆으로 튀고, 흙먼지가 피어오르고, 불티 · 별가루가 번쩍
      const top = el.getBoundingClientRect().top;
      for (let i = 0; i < 12; i++) {
        const side = i % 2 ? 1 : -1;
        add({ x: p.x + side * rand(2, 14), y: top, frames: [pick([S.smoke, S.px, S.plus])], vx: side * rand(1.2, 3.6), vy: rand(-4, -1.8), gravity: 0.2, drag: 0.99, life: rand(600, 900), colors: ROCK_COLORS });
      }
      for (let i = 0; i < 6; i++) add({ x: p.x + rand(-14, 14), y: top - rand(0, 6), frames: [S.smoke], vx: rand(-0.6, 0.6), vy: rand(-0.7, -0.3), sway: 0.3, life: rand(700, 1000), colors: SMOKE, scale: 1 + Math.floor(Math.random() * 2) });
      burst(p.x, p.y, 8, { frames: [S.spark, S.px], speed: [2.5, 4], colors: BLAZE, life: 420, drag: 0.88 });
      // 펑! 별이 번쩍 크게 빛나고, 별들이 원을 그리며 터져 나간다
      add({ x: p.x, y: p.y, frames: [S.star, S.cross, S.star], life: 260, colors: c(), scale: 3 });
      const n = 10;
      const a0 = Math.random() * Math.PI;
      for (let i = 0; i < n; i++) {
        const a = a0 + (i / n) * Math.PI * 2;
        const sp = i % 2 ? 3.2 : 4.4;
        add({ x: p.x, y: p.y, frames: [S.star, S.star, S.plus, S.px], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.9, gravity: 0.03, gravityAfter: 300, life: rand(800, 1000), colors: c(), scale: i % 2 ? 1 : 2 });
      }
      // 눌린 맨 아래에서 진짜로 누른다
      window.setTimeout(() => {
        if (held === hold) held = null;
        if (hold.clicked && el.isConnected && !(el as HTMLButtonElement).disabled) el.click();
      }, 110);
    },
  };
  // 혹시 소행성이 못 닿아도 클릭이 사라지지 않게
  window.setTimeout(() => {
    if (held !== hold) return;
    held = null;
    if (hold.clicked && el.isConnected) el.click();
  }, 1500);
}

/* ───────── 글자 커서 위치 ───────── */

const MIRROR_PROPS = [
  'boxSizing', 'width', 'height', 'overflowX', 'overflowY', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize',
  'lineHeight', 'fontFamily', 'textAlign', 'textTransform', 'textIndent', 'letterSpacing', 'wordSpacing', 'tabSize',
] as const;

/** 입력칸 · 글상자 · 편집기 안의 글자 커서 화면 좌표 */
function caretPoint(el: HTMLElement): Point & { h: number } {
  const r = el.getBoundingClientRect();
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    // 같은 모양의 보이지 않는 상자에 커서 앞 글자까지만 넣고 끝 위치를 잰다
    const pos = el.selectionEnd ?? el.value.length;
    const cs = getComputedStyle(el);
    const mirror = document.createElement('div');
    const st = mirror.style;
    for (const k of MIRROR_PROPS) st[k] = cs[k];
    st.position = 'fixed';
    st.visibility = 'hidden';
    st.top = '0';
    st.left = '-9999px';
    st.whiteSpace = el instanceof HTMLTextAreaElement ? 'pre-wrap' : 'pre';
    st.overflowWrap = 'break-word';
    mirror.textContent = el.type === 'password' ? '•'.repeat(pos) : el.value.slice(0, pos);
    const mark = document.createElement('span');
    mark.textContent = '​';
    mirror.appendChild(mark);
    document.body.appendChild(mirror);
    const x = r.left + mark.offsetLeft - el.scrollLeft;
    const y = r.top + mark.offsetTop - el.scrollTop + mark.offsetHeight / 2;
    mirror.remove();
    return { x: Math.min(Math.max(x, r.left), r.right), y: Math.min(Math.max(y, r.top), r.bottom), h: mark.offsetHeight || parseFloat(cs.lineHeight) || 18 };
  }
  const sel = window.getSelection();
  if (sel && sel.rangeCount) {
    const range = sel.getRangeAt(0).cloneRange();
    range.collapse(false);
    const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
    if (rect && (rect.width || rect.height || rect.x)) return { x: rect.left, y: rect.top + rect.height / 2, h: rect.height || 18 };
  }
  return { x: r.left + 12, y: r.top + r.height / 2, h: 18 };
}

/* ───────── 그리기 ───────── */

function resize() {
  if (!canvas || !ctx) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}

function frame(t: number) {
  raf = requestAnimationFrame(frame);
  if (!ctx) return;
  const dt = lastTime ? Math.min(t - lastTime, 50) : 16.7;
  lastTime = t;
  now = t;
  const f = dt / 16.7;
  const d = DESIGNS[design];

  // 버튼에 올려 둔 동안
  if (hoverEl && !hoverEl.isConnected) setHover(null);
  const hoverRect = hoverEl?.getBoundingClientRect();
  if (hoverEl && hoverRect) {
    hoverClock += dt;
    while (hoverClock >= d.hoverRate) {
      hoverClock -= d.hoverRate;
      d.hover(hoverRect);
    }
    if (design === 'snow') growFrost(hoverRect, dt);
  }

  // 글 쓰기를 멈추면 맴돌던 파티클이 사라진다
  const typing = now - lastTypeAt < 1400;

  ctx.clearRect(0, 0, innerWidth, innerHeight);
  updating = true;
  particles = particles.filter((p) => {
    p.age += dt;
    if (p.anchor && hoverRect) {
      p.x = hoverRect.left + p.anchor.dx;
      p.y = hoverRect.top + p.anchor.dy;
    } else if (p.orbit) {
      if (!typing) fadeOut(p);
      p.orbit.a += p.orbit.w * dt;
      p.x = p.orbit.c.x + Math.cos(p.orbit.a) * p.orbit.r;
      p.y = p.orbit.c.y + Math.sin(p.orbit.a) * p.orbit.r * 0.3;
    } else if (p.path) {
      const k = Math.min(1, p.age / p.path.dur);
      const e = k * k * k; // 처음엔 천천히, 땅에 가까울수록 빠르게
      const to = p.path.to();
      p.x = p.path.from.x + (to.x - p.path.from.x) * e;
      p.y = p.path.from.y + (to.y - p.path.from.y) * e;
      // 불꼬리: 빨라질수록 길고 굵게, 가끔 연기
      for (let i = 0; i < 1 + Math.floor(k * 3); i++) add({ x: p.x + rand(-3, 3), y: p.y + rand(-3, 3), frames: [pick([S.px, S.px, S.plus])], life: rand(250, 450), colors: [pick(BLAZE)], vy: rand(-0.3, 0.1), vx: rand(-0.3, 0.3) });
      if (Math.random() < 0.35) add({ x: p.x + rand(-4, 4), y: p.y - 4, frames: [S.smoke], life: rand(400, 650), colors: SMOKE, vy: -0.2, sway: 0.3 });
      if (k >= 1) {
        const done = p.path.onArrive;
        p.path = undefined;
        done();
      }
    } else if (p.seek) {
      const to = p.seek.to();
      p.x += (to.x - p.x) * Math.min(1, p.seek.k * f);
      p.y += (to.y - p.y) * Math.min(1, p.seek.k * f);
      // 폭죽은 지나간 자리에 가루를 남긴다
      if (p.tag === 'rocket' && Math.random() < 0.7) add({ x: p.x, y: p.y, frames: [S.px], life: 350, colors: p.colors, vy: 0.2 });
      if (p.seek.onArrive && Math.hypot(to.x - p.x, to.y - p.y) < 6) {
        const done = p.seek.onArrive;
        p.seek = undefined;
        done();
      }
    } else if (!p.landed) {
      const g = p.gravityAfter && p.age < p.gravityAfter ? 0 : p.gravity;
      p.vy += g * f;
      p.vx *= p.drag ** f;
      if (!g) p.vy *= p.drag ** f;
      p.x += p.vx * f;
      p.y += p.vy * f;
      if (p.land != null && p.y >= p.land) {
        p.y = p.land;
        p.landed = true;
      }
    }
    // 수명 · 사라지기
    let alpha: number;
    if (p.fadeAt != null) {
      alpha = 1 - (p.age - p.fadeAt) / 450;
      if (alpha <= 0) return false;
    } else {
      const k = p.age / p.life;
      if (k >= 1) return false;
      alpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    }
    const frames = p.frames;
    const idx = p.frameMs ? Math.floor((p.age + p.seed) / p.frameMs) % frames.length : Math.min(frames.length - 1, Math.floor((p.age / p.life) * frames.length));
    const shape = frames[idx];
    const size = PX * p.scale;
    const swayIn = p.gravityAfter ? Math.max(0, Math.min(1, (p.age - p.gravityAfter) / 300)) : 1;
    const sway = p.sway && !p.landed ? Math.sin((p.age + p.seed) / 170) * p.sway * 4 * swayIn : 0;
    // 도트가 격자에 딱 맞게 (흐릿하지 않게)
    const ox = Math.round((p.x + sway) / PX) * PX;
    const oy = Math.round(p.y / PX) * PX;
    ctx!.globalAlpha = alpha * (p.alpha ?? 1);
    for (const [cx, cy, ci] of shape) {
      ctx!.fillStyle = p.colors[ci] ?? p.colors[0];
      ctx!.fillRect(ox + Math.round(cx * size), oy + Math.round(cy * size), size, size);
    }
    return true;
  });
  updating = false;
  if (pending.length) {
    particles.push(...pending);
    pending = [];
  }
  ctx.globalAlpha = 1;

  if (!hoverEl && particles.length === 0) {
    cancelAnimationFrame(raf);
    raf = 0;
    lastTime = 0;
  }
}

function wake() {
  if (!raf && ctx) raf = requestAnimationFrame(frame);
}

/* ───────── 이벤트 ───────── */

const allowed = (el: Element | null) => !!el && (!specialOnly || !!el.closest('[data-fx-zone]')) && !el.closest('[data-fx-off]');

function setHover(el: HTMLElement | null) {
  if (el === hoverEl) return;
  meltFrost();
  // 쌓였던 눈은 녹아내린다
  for (const p of particles) {
    if (p.tag === 'pile') {
      p.landed = false;
      p.land = undefined;
      p.gravity = 0.05;
      p.life = p.age + 700;
      p.tag = undefined;
    }
  }
  hoverEl = el;
  snowPile = false;
  window.clearTimeout(hoverTimer);
  hoverClock = DESIGNS[design].hoverRate * 0.7;
  if (!el) return;
  // 숨은: 눈 디자인으로 버튼에 오래 올려 두면 눈이 쌓인다
  if (design === 'snow') hoverTimer = window.setTimeout(() => hoverEl === el && Math.random() < HIDDEN.snowPile && (snowPile = true), 2500);
  wake();
}

function onOver(e: PointerEvent) {
  if (e.pointerType !== 'mouse') return;
  const el = (e.target as Element).closest<HTMLElement>(TARGET);
  setHover(el && allowed(el) ? el : null);
}

function onOut(e: PointerEvent) {
  if (!e.relatedTarget) setHover(null);
}

function onMove(e: PointerEvent) {
  if (e.pointerType !== 'mouse') return;
  const dx = e.clientX - pointer.x;
  const dy = e.clientY - pointer.y;
  const had = pointer.has;
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.has = true;
  if (!had || !allowed(e.target as Element)) return;
  const dist = Math.hypot(dx, dy);
  if (dist > 160) return;
  travel += dist;
  const d = DESIGNS[design];
  while (travel >= d.trailEvery) {
    travel -= d.trailEvery;
    d.trail(pointer.x + rand(-2, 2), pointer.y + rand(-2, 2));
  }
  wake();
}

function onDown(e: PointerEvent) {
  if (e.pointerType !== 'mouse' || !allowed(e.target as Element)) return;
  const d = DESIGNS[design];
  const btn = (e.target as Element).closest<HTMLElement>(TARGET);
  // 새 탭으로 열기(Ctrl · ⌘ · Shift) 나 오른쪽 클릭은 그대로 둔다
  const plain = e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey;
  const roll = forceHidden || Math.random() < HIDDEN.click;
  forceHidden = false;
  if (btn && plain && !held && roll) d.hiddenClick(e.clientX, e.clientY, btn);
  else d.click(e.clientX, e.clientY);
  wake();
}

function onInput(e: Event) {
  const el = e.target as HTMLElement;
  if (!el.matches?.(TYPING) && !el.isContentEditable) return;
  if (!allowed(el)) return;
  // 편집기는 입력 직후에 글자 커서가 옮겨지므로 다음 프레임에 잰다
  requestAnimationFrame(() => {
    const p = caretPoint(el);
    caret.x = p.x;
    caret.y = p.y;
    caret.h = p.h;
    // 글자 줄 위쪽 (줄 높이의 절반 + 여백)
    halo.x = p.x;
    halo.y = p.y - p.h / 2 - 7;
    const d = DESIGNS[design];
    lastTypeAt = performance.now();
    if (!particles.some((q) => q.orbit && q.fadeAt == null)) {
      for (let i = 0; i < d.orbit.n; i++) {
        add({ x: halo.x, y: halo.y, frames: [d.orbit.frames[0]], life: 1e9, colors: c(), alpha: 0.85, orbit: { c: halo, r: 10, a: (i / d.orbit.n) * Math.PI * 2, w: d.orbit.w } });
      }
    }
    d.key(halo.x, halo.y);
    wake();
  });
}

const onHide = () => {
  if (document.visibilityState === 'hidden') {
    particles = [];
    setHover(null);
  }
};

/** 켜기. 돌려주는 함수로 끈다 */
export function startPixelFx(opts: { design: FxDesign; specialOnly: boolean }) {
  design = opts.design;
  colors = PALETTE[design];
  specialOnly = opts.specialOnly;
  canvas = document.createElement('canvas');
  canvas.className = 'pixel-fx';
  canvas.setAttribute('aria-hidden', 'true');
  ctx = canvas.getContext('2d');
  document.body.appendChild(canvas);
  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('pointerover', onOver, { passive: true });
  document.addEventListener('pointerout', onOut, { passive: true });
  document.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('click', onClickCapture, true);
  document.addEventListener('input', onInput, true);
  document.addEventListener('visibilitychange', onHide);
  if (import.meta.env.DEV) (window as unknown as { __loopFx?: unknown }).__loopFx = debugHidden;
  return () => {
    cancelAnimationFrame(raf);
    raf = 0;
    lastTime = 0;
    particles = [];
    hoverEl = null;
    pointer.has = false;
    window.clearTimeout(hoverTimer);
    window.removeEventListener('resize', resize);
    document.removeEventListener('pointerover', onOver);
    document.removeEventListener('pointerout', onOut);
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerdown', onDown);
    window.removeEventListener('click', onClickCapture, true);
    held = null;
    document.removeEventListener('input', onInput, true);
    document.removeEventListener('visibilitychange', onHide);
    canvas?.remove();
    canvas = null;
    ctx = null;
  };
}

/** 개발 중 확인용: 숨은 애니메이션을 바로 띄운다 (개발 서버에서만 window.__loopFx) */
function debugHidden(kind: 'click' | 'next' | 'pile' | 'rainbow', x = pointer.x, y = pointer.y) {
  if (kind === 'click') DESIGNS[design].hiddenClick(x, y, document.elementFromPoint(x, y)?.closest<HTMLElement>(TARGET) ?? undefined);
  if (kind === 'next') forceHidden = true;
  if (kind === 'pile') snowPile = true;
  if (kind === 'rainbow') rainbowUntil = now + 5000;
  wake();
}

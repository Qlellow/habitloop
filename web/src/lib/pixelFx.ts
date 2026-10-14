/**
 * 도트 파티클 (마인크래프트 모드 "Inventory Particles" 처럼).
 * 마우스를 올린 "아이템"(버튼 · 링크 · 아이콘 · 채널 프로필 …)이 자기에게 어울리는 도트 파티클을 뿜는다.
 *   하트 → 빨간 하트가 떠오르고, 트로피 → 금빛이 반짝이고, 연필 → 흑연 가루가 떨어지고, 집 → 굴뚝 연기 …
 * 따로 정해 두지 않은 아이템은 그 색을 뽑아 "패밀리" 파티클(부서지는 조각)을 자동으로 만든다.
 * 누르면 터지고, 움직이면 작은 도트 가루가 흩날린다.
 *
 * 성능: 화면 전체를 덮는 캔버스 하나에 사각형만 그린다 (DOM 을 만들지 않음). 파티클이 없고 아무것도 안 올렸으면 멈춘다.
 */

/** 도트 한 칸의 크기 (CSS px) */
const PX = 3;
const MAX = 180;
const TARGET =
  '[data-fx], a[href], button:not(:disabled), [role="button"], [role="option"], [role="radio"], [role="switch"], [role="menuitem"], [role="tab"]';

type Sprite = [number, number, number][]; // [x, y, 색 번호]
/** 문자열 도트 그림 → 칸 목록. '.' 는 빈칸, 숫자는 팔레트 번호 */
const sprite = (...rows: string[]): Sprite =>
  rows.flatMap((row, y) => [...row].flatMap((ch, x) => (ch === '.' ? [] : [[x - (row.length - 1) / 2, y - (rows.length - 1) / 2, Number(ch)] as [number, number, number]])));

const S = {
  heart: sprite('.0.0.', '01000', '00000', '.000.', '..0..'),
  ring: sprite('.00.', '0..0', '0..0', '.00.'),
  plusSmall: sprite('.0.', '010', '.0.'),
  plusBig: sprite('..0..', '..0..', '00100', '..0..', '..0..'),
  star: sprite('..0..', '.010.', '01110', '.010.', '..0..'),
  note: sprite('..00', '..0.', '..0.', '000.', '00..'),
  orb: sprite('.01.', '0120', '0210', '.10.'),
  flame: sprite('.0.', '010', '121', '.1.'),
  px1: sprite('0'),
  px2: sprite('00', '01'),
  px3: sprite('.0.', '000', '.0.'),
};

interface Family {
  frames: Sprite[];
  /** 팔레트: 고정 색이거나, 아이템에서 뽑은 색으로 */
  colors?: string[];
  /** 뿜는 간격 (ms) */
  rate: number;
  life: [number, number];
  vx: [number, number];
  vy: [number, number];
  gravity: number;
  drag?: number;
  /** 좌우로 하늘하늘 */
  sway?: number;
  /** 시간이 갈수록 도트가 커진다 (연기) */
  grow?: boolean;
  /** 어디서 나오나: 아이템 전체 / 위쪽 가장자리 / 오른쪽 위 (굴뚝) / 아래쪽 */
  from?: 'rect' | 'top' | 'chimney' | 'bottom';
}

const FAMILIES: Record<string, Family> = {
  heart: { frames: [S.heart], colors: ['#ff4d6d', '#ffc2cf'], rate: 170, life: [900, 1400], vx: [-0.15, 0.15], vy: [-0.9, -0.5], gravity: -0.004, sway: 0.5 },
  bubble: { frames: [S.ring, S.plusSmall], colors: ['#8ec5ff', '#ffffff'], rate: 190, life: [700, 1100], vx: [-0.2, 0.2], vy: [-0.8, -0.4], gravity: 0, sway: 0.7 },
  gold: { frames: [S.plusSmall, S.plusBig, S.plusSmall], colors: ['#ffd23f', '#fff6c2'], rate: 130, life: [500, 800], vx: [-0.1, 0.1], vy: [-0.15, 0.05], gravity: 0 },
  star: { frames: [S.px3, S.star, S.px3], colors: ['#ffe066', '#fffbe0'], rate: 150, life: [600, 1000], vx: [-0.2, 0.2], vy: [-0.3, 0.1], gravity: 0.002 },
  note: { frames: [S.note], colors: ['#ffcf33'], rate: 260, life: [900, 1300], vx: [-0.25, 0.25], vy: [-0.8, -0.5], gravity: 0, sway: 0.9 },
  graphite: { frames: [S.px1, S.px2], colors: ['#5b6170', '#f2c879'], rate: 90, life: [600, 900], vx: [-0.4, 0.4], vy: [-0.4, 0.2], gravity: 0.09, from: 'bottom' },
  xp: { frames: [S.orb], colors: ['#7ccf1f', '#b6f542', '#efffb0'], rate: 160, life: [800, 1200], vx: [-0.9, 0.9], vy: [-1.8, -1], gravity: 0.07 },
  smoke: { frames: [S.px2], colors: ['#9aa0aa', '#c7cbd3'], rate: 140, life: [900, 1400], vx: [-0.12, 0.12], vy: [-0.6, -0.35], gravity: 0, sway: 0.4, grow: true, from: 'top' },
  chimney: { frames: [S.px2], colors: ['#9aa0aa', '#c7cbd3'], rate: 150, life: [900, 1400], vx: [0.02, 0.2], vy: [-0.6, -0.35], gravity: 0, sway: 0.3, grow: true, from: 'chimney' },
  flame: { frames: [S.flame, S.px3], colors: ['#ff7a1a', '#ffd23f', '#ffffff'], rate: 110, life: [450, 750], vx: [-0.2, 0.2], vy: [-1, -0.6], gravity: -0.01, from: 'top' },
  glint: { frames: [S.px1, S.plusSmall, S.px1], colors: ['#ffffff', '#cfe6ff'], rate: 150, life: [400, 700], vx: [-0.05, 0.05], vy: [-0.05, 0.05], gravity: 0 },
  // 아이템 색에서 뽑아 만드는 기본 파티클: 부서진 조각이 톡 튀었다 떨어진다
  family: { frames: [S.px2, S.px1], rate: 170, life: [600, 1000], vx: [-0.7, 0.7], vy: [-1.4, -0.6], gravity: 0.06 },
  // 움직일 때 흩날리는 가루
  dust: { frames: [S.px1], rate: 0, life: [350, 600], vx: [-0.3, 0.3], vy: [-0.3, 0.2], gravity: 0.03 },
};

/** 아이콘 이름 → 파티클 */
const ICON_FAMILY: Record<string, string> = {
  heart: 'heart',
  comment: 'bubble',
  'mail-line': 'note',
  trophy: 'gold',
  star: 'star',
  moon: 'star',
  sun: 'flame',
  bell: 'note',
  clock: 'note',
  pencil: 'graphite',
  doc: 'graphite',
  wrench: 'graphite',
  plus: 'xp',
  'check-circle': 'xp',
  home: 'chimney',
  gear: 'smoke',
  logout: 'smoke',
  close: 'smoke',
  'alert-circle': 'flame',
  search: 'glint',
  eye: 'glint',
  'eye-off': 'glint',
  image: 'glint',
  'lock-line': 'glint',
  pin: 'gold',
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  fam: Family;
  colors: string[];
  seed: number;
}

interface Source {
  el: HTMLElement;
  /** 파티클이 나오는 곳 (아이콘이면 아이콘, 아니면 아이템 전체) */
  from: Element;
  fam: Family;
  colors: string[];
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/* ───────── 색 ───────── */

let probe: CanvasRenderingContext2D | null = null;
/** 어떤 CSS 색이든 #rrggbb / rgba 로 (캔버스가 알아듣는 형태) */
function toRgb(color: string): [number, number, number, number] | undefined {
  probe ??= document.createElement('canvas').getContext('2d');
  if (!probe || !color) return undefined;
  probe.fillStyle = '#000';
  probe.fillStyle = color;
  probe.clearRect(0, 0, 1, 1);
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a / 255];
}
const hex = (r: number, g: number, b: number) => `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
const mix = ([r, g, b]: number[], to: number, k: number) => hex(r + (to - r) * k, g + (to - g) * k, b + (to - b) * k);

function primary() {
  return getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#3182f6';
}

/** 아이템의 대표 색: 지정한 색 → 배경색(투명하지 않으면) → 글자색 */
function itemColors(el: HTMLElement): string[] {
  const cs = getComputedStyle(el);
  const pick = [el.dataset.fxColor, cs.backgroundColor, cs.color].map((c) => (c ? toRgb(c) : undefined)).find((c) => c && c[3] > 0.5);
  const base = pick ?? toRgb(primary()) ?? [49, 130, 246, 1];
  return [hex(base[0], base[1], base[2]), mix(base, 255, 0.45), mix(base, 0, 0.25)];
}

/** 이 아이템이 뿜을 파티클 */
function sourceOf(el: HTMLElement): Source {
  const explicit = el.dataset.fx;
  const icon = el.matches('svg[data-icon]') ? el : el.querySelector('svg[data-icon]');
  const iconFam = icon ? ICON_FAMILY[icon.getAttribute('data-icon') ?? ''] : undefined;
  const cls = typeof el.className === 'string' ? el.className : '';
  let name = explicit && explicit !== 'auto' ? explicit : iconFam;
  if (!name && /\b(bg-danger|text-danger)\b/.test(cls)) name = 'flame';
  if (!name && /\bbg-primary\b/.test(cls)) name = 'xp';
  // 아이콘이 없으면 안에 든 채널 · 사용자 프로필 색으로 (채널 링크 등)
  const inner = !name && !explicit ? el.querySelector<HTMLElement>('[data-fx]') : null;
  const fam = FAMILIES[name ?? 'family'] ?? FAMILIES.family;
  return { el, from: iconFam && icon ? icon : (inner ?? el), fam, colors: fam.colors ?? itemColors(inner ?? el) };
}

/* ───────── 엔진 ───────── */

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let source: Source | null = null;
let raf = 0;
let lastTime = 0;
let emitClock = 0;
let travel = 0;
let specialOnly = false;
const pointer = { x: -1, y: -1, has: false };

function resize() {
  if (!canvas || !ctx) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}

function spawn(fam: Family, colors: string[], x: number, y: number, boost = 1) {
  if (particles.length >= MAX) particles.shift();
  particles.push({
    x,
    y,
    vx: rand(fam.vx[0], fam.vx[1]) * boost,
    vy: rand(fam.vy[0], fam.vy[1]) * boost,
    age: 0,
    life: rand(fam.life[0], fam.life[1]),
    fam,
    colors,
    seed: Math.random() * 1000,
  });
}

/** 아이템의 어디서 나올지 */
function spawnPoint(src: Source) {
  const r = src.from.getBoundingClientRect();
  switch (src.fam.from) {
    case 'top':
      return { x: rand(r.left + r.width * 0.2, r.right - r.width * 0.2), y: r.top + 2 };
    case 'bottom':
      return { x: rand(r.left + r.width * 0.3, r.right - r.width * 0.3), y: r.bottom - 2 };
    case 'chimney':
      return { x: r.left + r.width * 0.72, y: r.top + r.height * 0.15 };
    default:
      return { x: rand(r.left + 2, r.right - 2), y: rand(r.top + 2, r.bottom - 2) };
  }
}

function frame(now: number) {
  raf = requestAnimationFrame(frame);
  if (!ctx || !canvas) return;
  const dt = lastTime ? Math.min(now - lastTime, 50) : 16.7;
  lastTime = now;
  const f = dt / 16.7;

  // 올려 둔 아이템이 화면에서 사라졌으면 그만
  if (source && !source.el.isConnected) source = null;
  if (source && source.fam.rate) {
    emitClock += dt;
    while (emitClock >= source.fam.rate) {
      emitClock -= source.fam.rate;
      const p = spawnPoint(source);
      spawn(source.fam, source.colors, p.x, p.y);
    }
  }

  ctx.clearRect(0, 0, innerWidth, innerHeight);
  particles = particles.filter((p) => {
    p.age += dt;
    const t = p.age / p.life;
    if (t >= 1) return false;
    p.vy += p.fam.gravity * f;
    const drag = p.fam.drag ?? 0.985;
    p.vx *= drag ** f;
    p.x += p.vx * f;
    p.y += p.vy * f;
    const sway = p.fam.sway ? Math.sin((p.age + p.seed) / 160) * p.fam.sway * 4 : 0;
    // 반짝임: 수명에 따라 그림이 바뀐다 (작게 → 크게 → 작게)
    const frames = p.fam.frames;
    const shape = frames[Math.min(frames.length - 1, Math.floor(t * frames.length))];
    const size = PX * (p.fam.grow ? 1 + Math.floor(t * 2.2) : 1);
    // 도트가 격자에 딱 맞게 (흐릿하지 않게)
    const ox = Math.round((p.x + sway) / PX) * PX;
    const oy = Math.round(p.y / PX) * PX;
    ctx!.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
    for (const [cx, cy, ci] of shape) {
      ctx!.fillStyle = p.colors[ci] ?? p.colors[0];
      ctx!.fillRect(ox + Math.round(cx * size), oy + Math.round(cy * size), size, size);
    }
    return true;
  });
  ctx.globalAlpha = 1;

  if (!source && particles.length === 0) {
    cancelAnimationFrame(raf);
    raf = 0;
    lastTime = 0;
  }
}

const wake = () => {
  if (!raf) raf = requestAnimationFrame(frame);
};

function allowed(el: Element) {
  return !specialOnly || !!el.closest('[data-fx-zone]');
}

function onOver(e: PointerEvent) {
  if (e.pointerType !== 'mouse') return;
  const el = (e.target as Element).closest<HTMLElement>(TARGET);
  if (el?.closest('[data-fx-off]')) return setSource(null);
  setSource(el && allowed(el) ? el : null);
}

function setSource(el: HTMLElement | null) {
  if (el === source?.el) return;
  source = el ? sourceOf(el) : null;
  // 올리자마자 하나 톡
  emitClock = source ? source.fam.rate * 0.8 : 0;
  if (source) wake();
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
  // 움직일 때: 올려 둔 아이템 색, 아니면 포인트 색 가루
  const colors = source?.colors ?? [primary()];
  while (travel >= 16) {
    travel -= 16;
    spawn(FAMILIES.dust, colors, pointer.x + rand(-3, 3), pointer.y + rand(-3, 3));
  }
  wake();
}

function onDown(e: PointerEvent) {
  if (e.pointerType !== 'mouse' || !allowed(e.target as Element)) return;
  const el = (e.target as Element).closest<HTMLElement>(TARGET);
  const src = el && !el.closest('[data-fx-off]') ? (source?.el === el ? source : sourceOf(el)) : null;
  // 누르면 터진다: 아이템 파티클 + 조각
  const fam = src?.fam ?? FAMILIES.family;
  const colors = src?.colors ?? [primary()];
  for (let i = 0; i < 8; i++) spawn(fam, colors, e.clientX + rand(-4, 4), e.clientY + rand(-4, 4), 1.6);
  for (let i = 0; i < 6; i++) spawn(FAMILIES.family, colors, e.clientX, e.clientY, 1.4);
  wake();
}

/** 창 밖으로 나가면 그만 */
const onOut = (e: PointerEvent) => {
  if (!e.relatedTarget) setSource(null);
};

const onHide = () => {
  if (document.visibilityState === 'hidden') {
    particles = [];
    source = null;
  }
};

/** 켜기. 돌려주는 함수로 끈다 */
export function startPixelFx(opts: { specialOnly: boolean }) {
  specialOnly = opts.specialOnly;
  canvas = document.createElement('canvas');
  canvas.className = 'pixel-fx';
  canvas.setAttribute('aria-hidden', 'true');
  ctx = canvas.getContext('2d');
  document.body.appendChild(canvas);
  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('pointerover', onOver, { passive: true });
  document.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerdown', onDown, { passive: true });
  document.addEventListener('pointerout', onOut, { passive: true });
  document.addEventListener('visibilitychange', onHide);
  return () => {
    cancelAnimationFrame(raf);
    raf = 0;
    lastTime = 0;
    particles = [];
    source = null;
    pointer.has = false;
    window.removeEventListener('resize', resize);
    document.removeEventListener('pointerover', onOver);
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerdown', onDown);
    document.removeEventListener('pointerout', onOut);
    document.removeEventListener('visibilitychange', onHide);
    canvas?.remove();
    canvas = null;
    ctx = null;
  };
}

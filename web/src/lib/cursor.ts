import type { CursorStyle } from './settings';

/**
 * 인터랙티브 커서 엔진. 특별한 화면(CursorZone) 안에서만 기본 커서 대신 그린다.
 * - 링크 · 버튼 · [data-cursor] 위에 올리면 커서가 그 모양으로 변하고, 버튼은 자석처럼 커서 쪽으로 살짝 끌려온다
 * - 입력칸 위에서는 기본 글자 커서로 돌아간다 (글자 위치를 정확히 짚어야 하므로)
 * 한 번에 한 영역만 움직이므로 엔진은 하나 (DOM 을 직접 그려서 매 프레임 React 를 다시 그리지 않는다)
 */

const TARGET = 'a[href], button:not(:disabled), [role="button"], [data-cursor]';
const NATIVE = 'input, textarea, select, [contenteditable="true"]';
/** 자석: 가운데에서 떨어진 거리의 이만큼 끌려오고, 최대 MAGNET_MAX px */
const MAGNET = 0.28;
const MAGNET_MAX = 12;
const TRAIL = 14;
const MAX_PARTICLES = 60;

/**
 * 움직일 때 흩날리는 파티클 (디자인마다 다르게). every: 이만큼(px) 움직일 때마다 하나, burst: 누를 때 터지는 개수
 * 링: 불꽃 / 물방울: 떨어지는 방울 / 유리: 떠오르는 기포 / 스포트라이트: 빛 속 먼지 / 꼬리: 반짝이는 별
 */
const FX: Record<CursorStyle, { cls: string; every: number; burst: number; life: [number, number]; size: [number, number] }> = {
  ring: { cls: 'fx-spark', every: 12, burst: 12, life: [380, 620], size: [3, 5] },
  blob: { cls: 'fx-drop', every: 20, burst: 9, life: [600, 900], size: [6, 12] },
  glass: { cls: 'fx-bubble', every: 26, burst: 8, life: [800, 1200], size: [6, 14] },
  spotlight: { cls: 'fx-mote', every: 14, burst: 14, life: [900, 1500], size: [2, 4] },
  trail: { cls: 'fx-star', every: 18, burst: 10, life: [500, 800], size: [7, 12] },
};

interface Particle {
  el: HTMLElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  age: number;
  life: number;
  size: number;
  /** 물결치듯 좌우로 흔들리는 정도 (기포) */
  wobble: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));

let style: CursorStyle = 'ring';
let zone: HTMLElement | null = null;
let root: HTMLDivElement | null = null;
let parts: HTMLElement[] = [];
let raf = 0;
let visible = false;
let down = false;
let target: HTMLElement | null = null;
let targetRadius = 0;
const pointer = { x: -100, y: -100 };
const smooth = { x: -100, y: -100 };
const box: Box = { x: 0, y: 0, w: 0, h: 0, r: 0 };
let trail: { x: number; y: number }[] = [];
let particles: Particle[] = [];
let travel = 0;
let lastTime = 0;
const last = { x: -100, y: -100 };
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** 파티클 하나. (vx, vy): 커서가 움직인 방향 */
function spawn(x: number, y: number, vx: number, vy: number, burst = false) {
  if (!root || particles.length >= MAX_PARTICLES) return;
  const fx = FX[style];
  const el = document.createElement('div');
  el.className = `cursor-particle ${fx.cls}`;
  root.appendChild(el);
  const size = rand(fx.size[0], fx.size[1]);
  el.style.width = el.style.height = `${size}px`;
  const a = Math.random() * Math.PI * 2;
  const p: Particle = { el, x, y, vx: 0, vy: 0, rot: rand(0, 360), vr: rand(-4, 4), age: 0, life: rand(fx.life[0], fx.life[1]), size, wobble: 0 };
  const spread = burst ? rand(1.5, 3.2) : rand(0.2, 0.7);
  switch (style) {
    case 'ring': // 뒤로 튀는 불꽃
      p.vx = -vx * 0.04 + Math.cos(a) * spread;
      p.vy = -vy * 0.04 + Math.sin(a) * spread;
      break;
    case 'blob': // 똑 떨어지는 방울 (중력)
      p.vx = Math.cos(a) * spread * 0.6;
      p.vy = Math.sin(a) * spread * 0.6 - (burst ? 1.5 : 0);
      break;
    case 'glass': // 떠오르는 기포
      p.vx = Math.cos(a) * spread * 0.4;
      p.vy = -rand(0.4, 0.9) - (burst ? spread * 0.6 : 0);
      p.wobble = rand(0.6, 1.4);
      break;
    case 'spotlight': // 천천히 떠다니는 먼지
      p.x += rand(-60, 60);
      p.y += rand(-60, 60);
      p.vx = Math.cos(a) * 0.15 * (burst ? 6 : 1);
      p.vy = Math.sin(a) * 0.15 * (burst ? 6 : 1);
      break;
    case 'trail': // 반짝이며 도는 별
      p.vx = Math.cos(a) * spread * 0.5;
      p.vy = Math.sin(a) * spread * 0.5;
      p.vr = rand(-8, 8);
      break;
  }
  particles.push(p);
}

function stepParticles(dt: number) {
  const f = dt / 16.7; // 60fps 기준 속도
  particles = particles.filter((p) => {
    p.age += dt;
    const t = p.age / p.life;
    if (t >= 1) {
      p.el.remove();
      return false;
    }
    if (style === 'blob') p.vy += 0.12 * f;
    else p.vx *= 0.96 ** f;
    if (style !== 'blob' && style !== 'glass') p.vy *= 0.96 ** f;
    p.x += p.vx * f;
    p.y += p.vy * f;
    p.rot += p.vr * f;
    const sway = p.wobble ? Math.sin(p.age / 140) * p.wobble * 3 : 0;
    // 꼬리 별은 반짝이고(커졌다 작아졌다), 나머지는 사라지며 작아진다
    const scale = style === 'trail' ? Math.sin(t * Math.PI) * 1.2 : style === 'spotlight' ? 1 : 1 - t * 0.7;
    const alpha = style === 'spotlight' ? Math.sin(t * Math.PI) : 1 - t * t;
    p.el.style.transform = `translate3d(${p.x + sway}px, ${p.y}px, 0) translate(-50%, -50%) rotate(${p.rot}deg) scale(${scale})`;
    p.el.style.opacity = String(alpha);
    return true;
  });
}

/** 움직인 거리만큼 파티클을 뿌린다 */
function emitOnMove() {
  const dx = pointer.x - last.x;
  const dy = pointer.y - last.y;
  const dist = Math.hypot(dx, dy);
  last.x = pointer.x;
  last.y = pointer.y;
  if (!visible || dist > 200) return; // 영역에 막 들어올 때의 순간 이동은 무시
  travel += dist;
  const every = FX[style].every;
  while (travel >= every) {
    travel -= every;
    spawn(pointer.x, pointer.y, dx, dy);
  }
}

function burst() {
  for (let i = 0; i < FX[style].burst; i++) spawn(pointer.x, pointer.y, 0, 0, true);
}

function build() {
  root?.remove();
  particles = [];
  travel = 0;
  last.x = pointer.x;
  last.y = pointer.y;
  root = document.createElement('div');
  root.className = `cursor-fx cursor-style-${style}`;
  root.setAttribute('aria-hidden', 'true');
  const make = (cls: string) => {
    const el = document.createElement('div');
    el.className = cls;
    root!.appendChild(el);
    return el;
  };
  switch (style) {
    case 'ring':
      parts = [make('cursor-ring'), make('cursor-dot')];
      break;
    case 'blob':
      parts = [make('cursor-blob')];
      break;
    case 'glass':
      parts = [make('cursor-glass')];
      break;
    case 'spotlight':
      parts = [make('cursor-light'), make('cursor-dot')];
      break;
    case 'trail':
      parts = Array.from({ length: TRAIL }, (_, i) => {
        const el = make('cursor-trail-dot');
        const size = 12 - (i * 9) / TRAIL;
        el.style.width = el.style.height = `${size}px`;
        el.style.opacity = String(1 - i / TRAIL);
        return el;
      });
      trail = parts.map(() => ({ ...pointer }));
      break;
  }
  document.body.appendChild(root);
  // 처음 들어올 때 커서가 화면 구석에서 날아오지 않게
  smooth.x = pointer.x;
  smooth.y = pointer.y;
  Object.assign(box, { x: pointer.x - 17, y: pointer.y - 17, w: 34, h: 34, r: 17 });
}

function setTarget(next: HTMLElement | null) {
  if (next === target) return;
  if (target) target.style.translate = '';
  target?.classList.remove('cursor-hovered');
  target = next;
  if (target) {
    target.classList.add('cursor-hovered');
    targetRadius = parseFloat(getComputedStyle(target).borderTopLeftRadius) || 0;
  }
  root?.classList.toggle('is-hover', !!target);
}

/** 고른 요소의 박스 (자석으로 끌려온 위치 포함) + 여백 */
function targetBox(pad: number): Box {
  const r = target!.getBoundingClientRect();
  return { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2, r: Math.min(targetRadius + pad, (r.height + pad * 2) / 2) };
}

/** 박스를 부드럽게 따라가며 모양을 바꾼다 (원 ↔ 버튼 모양) */
function morph(el: HTMLElement, to: Box, k: number) {
  box.x = lerp(box.x, to.x, k);
  box.y = lerp(box.y, to.y, k);
  box.w = lerp(box.w, to.w, k);
  box.h = lerp(box.h, to.h, k);
  box.r = lerp(box.r, to.r, k);
  el.style.transform = `translate3d(${box.x}px, ${box.y}px, 0)`;
  el.style.width = `${box.w}px`;
  el.style.height = `${box.h}px`;
  el.style.borderRadius = `${box.r}px`;
}

const circle = (cx: number, cy: number, size: number): Box => ({ x: cx - size / 2, y: cy - size / 2, w: size, h: size, r: size / 2 });

function frame(now: number) {
  raf = requestAnimationFrame(frame);
  if (!root) return;
  const dt = lastTime ? Math.min(now - lastTime, 50) : 16.7;
  lastTime = now;
  emitOnMove();
  stepParticles(dt);
  root.classList.toggle('is-visible', visible);
  root.classList.toggle('is-down', down);
  // 영역을 벗어나 파티클도 다 사라지면 멈춘다 (다시 들어오면 pointerenter 에서 다시 돈다)
  if (!visible && !target && particles.length === 0) {
    cancelAnimationFrame(raf);
    raf = 0;
    return;
  }
  const press = down ? 0.86 : 1;

  // 자석: 버튼이 커서 쪽으로 끌려온다
  if (target && !target.hasAttribute('data-cursor-still')) {
    const r = target.getBoundingClientRect();
    const tx = parseFloat(target.style.translate) || 0;
    const ty = parseFloat(target.style.translate.split(' ')[1] ?? '') || 0;
    const cx = r.left - tx + r.width / 2;
    const cy = r.top - ty + r.height / 2;
    target.style.translate = `${clamp((pointer.x - cx) * MAGNET, MAGNET_MAX)}px ${clamp((pointer.y - cy) * MAGNET, MAGNET_MAX)}px`;
  }

  smooth.x = lerp(smooth.x, pointer.x, style === 'spotlight' ? 0.14 : 0.22);
  smooth.y = lerp(smooth.y, pointer.y, style === 'spotlight' ? 0.14 : 0.22);

  switch (style) {
    case 'ring': {
      const [ring, dot] = parts;
      dot.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0) translate(-50%, -50%) scale(${target ? 0 : press})`;
      morph(ring, target ? targetBox(6) : circle(smooth.x, smooth.y, 34 * press), target ? 0.24 : 0.2);
      break;
    }
    case 'glass': {
      morph(parts[0], target ? targetBox(4) : circle(smooth.x, smooth.y, 46 * press), target ? 0.22 : 0.24);
      break;
    }
    case 'blob': {
      // 빠르게 움직이면 움직이는 방향으로 늘어난다 (말랑한 물방울)
      const vx = pointer.x - smooth.x;
      const vy = pointer.y - smooth.y;
      const speed = Math.min(Math.hypot(vx, vy) / 40, 0.8);
      const angle = Math.atan2(vy, vx);
      const size = (target ? 64 : 22) * press;
      box.w = lerp(box.w, size, 0.2);
      parts[0].style.width = parts[0].style.height = `${box.w}px`;
      parts[0].style.transform = `translate3d(${smooth.x}px, ${smooth.y}px, 0) translate(-50%, -50%) rotate(${angle}rad) scale(${1 + speed}, ${1 - speed * 0.45})`;
      break;
    }
    case 'spotlight': {
      const [light, dot] = parts;
      dot.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0) translate(-50%, -50%) scale(${press})`;
      if (target) {
        const t = targetBox(0);
        morph(light, circle(t.x + t.w / 2, t.y + t.h / 2, Math.max(t.w, t.h) + 140), 0.16);
      } else {
        morph(light, circle(smooth.x, smooth.y, 320), 0.16);
      }
      break;
    }
    case 'trail': {
      // 머리는 커서를, 나머지는 바로 앞 점을 따라간다 (꼬리)
      trail.forEach((p, i) => {
        const lead = i === 0 ? pointer : trail[i - 1];
        p.x = lerp(p.x, lead.x, i === 0 ? 0.55 : 0.42);
        p.y = lerp(p.y, lead.y, i === 0 ? 0.55 : 0.42);
        parts[i].style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -50%) scale(${press})`;
      });
      break;
    }
  }
}

function onMove(e: PointerEvent) {
  if (e.pointerType !== 'mouse') return;
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  const el = e.target as Element | null;
  const native = !!el?.closest(NATIVE);
  visible = !native;
  const t = native ? null : (el?.closest<HTMLElement>(TARGET) ?? null);
  setTarget(t && zone?.contains(t) ? t : null);
}
const onDown = (e: PointerEvent) => {
  if (e.pointerType !== 'mouse' || !visible) return;
  down = true;
  burst();
};
const onUp = () => (down = false);
const onLeave = () => {
  visible = false;
  setTarget(null);
};

/** 영역에 커서 효과를 켠다. 돌려주는 함수로 끈다 */
export function bindCursorZone(el: HTMLElement, s: CursorStyle) {
  const enter = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    zone = el;
    if (style !== s || !root) {
      style = s;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      build();
    }
    onMove(e);
    if (!raf) {
      lastTime = 0;
      raf = requestAnimationFrame(frame);
    }
  };
  const leave = () => {
    if (zone !== el) return;
    onLeave();
  };
  el.addEventListener('pointerenter', enter);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', leave);
  el.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  return () => {
    el.removeEventListener('pointerenter', enter);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerleave', leave);
    el.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
    if (zone === el) {
      setTarget(null);
      zone = null;
      cancelAnimationFrame(raf);
      raf = 0;
      root?.remove();
      root = null;
      visible = false;
    }
  };
}

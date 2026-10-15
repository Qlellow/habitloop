import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLocation } from 'react-router-dom';
import { PET_STAGES, useAuth, useMyPet, usePatPet, type Pet } from '@loop/shared';
import { PetSprite } from './Pet';
import { toast } from './Toast';
import { useMediaQuery } from '../lib/media';
import { updateSettings, useSettings } from '../lib/settings';
import { cn } from '../lib/cn';

/**
 * 데스크톱 펫: 내 펫이 사이트 화면 위를 돌아다닌다 (마우스가 있는 기기에서만).
 *   걷기 · 앉기 · 졸기 · 카드 위로 폴짝 · 벽 타기(어린이부터) · 커서 쫓아가기
 *   마우스로 집어 들 수 있고(대롱대롱), 던지면 중력으로 떨어져 착지한다. 누르면 쓰다듬기
 * 위치는 매 프레임 DOM 에 직접 쓰고, 모습(걸음 · 눈)만 React 로 가끔 바꾼다
 */

const SCALE = 4;
const SIZE = 18 * SCALE; // 72px
const GRAVITY = 2200; // px/s²
const PERCH = 'main section, main article, aside section, aside nav';

type Mode = 'idle' | 'walk' | 'chase' | 'sit' | 'sleep' | 'jump' | 'fall' | 'land' | 'climb' | 'hang' | 'drag';

interface State {
  x: number;
  /** 발이 닿은 높이 (화면 좌표) */
  y: number;
  vx: number;
  vy: number;
  mode: Mode;
  dir: 1 | -1;
  until: number;
  /** 올라가 있는 카드 (없으면 화면 바닥) */
  perch: Element | null;
  /** 뛰어오를 카드 */
  target: Element | null;
  side: -1 | 1;
}

const now = () => performance.now();
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const floorY = () => window.innerHeight - 4;
const isNight = () => {
  const h = (new Date().getUTCHours() + 9) % 24;
  return h >= 23 || h < 6;
};

function Roamer({ pet }: { pet: Pet }) {
  const el = useRef<HTMLDivElement>(null);
  const s = useRef<State>({ x: window.innerWidth - 120, y: floorY(), vx: 0, vy: 0, mode: 'fall', dir: -1, until: 0, perch: null, target: null, side: 1 });
  const pointer = useRef({ x: -1, y: -1, at: 0 });
  const drag = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean; lx: number; ly: number; lt: number } | null>(null);
  const [look, setLook] = useState({ mode: 'fall' as Mode, frame: 0 as 0 | 1, blink: false });
  const [hearts, setHearts] = useState<number[]>([]);
  const [hover, setHover] = useState(false);
  const pat = usePatPet();
  const egg = pet.stage === 'egg';
  const speed = egg ? 18 : pet.stage === 'baby' ? 40 : pet.stage === 'junior' ? 60 : 72;

  // 처음엔 화면 위에서 톡 떨어진다
  useEffect(() => {
    s.current.y = -SIZE;
    s.current.x = window.innerWidth - rand(120, 260);
    // 개발 중 확인용 (배포 빌드에는 없음)
    if (import.meta.env.DEV) (window as unknown as { __dpet?: State }).__dpet = s.current;
  }, []);

  // 커서 위치 (쫓아가기용)
  useEffect(() => {
    const move = (e: PointerEvent) => {
      pointer.current = { x: e.clientX, y: e.clientY, at: now() };
      const d = drag.current;
      if (!d) return;
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 4) d.moved = true;
      const t = now();
      const st = s.current;
      st.vx = ((e.clientX - d.lx) / Math.max(1, t - d.lt)) * 1000;
      st.vy = ((e.clientY - d.ly) / Math.max(1, t - d.lt)) * 1000;
      d.lx = e.clientX;
      d.ly = e.clientY;
      d.lt = t;
      st.x = e.clientX - d.dx;
      st.y = e.clientY - d.dy;
    };
    const up = () => {
      const d = drag.current;
      if (!d) return;
      drag.current = null;
      const st = s.current;
      if (!d.moved) {
        // 쓰다듬기 (제자리에서 뗐을 때)
        st.mode = 'land';
        st.until = now() + 250;
        setHearts((h) => [...h, Date.now(), Date.now() + 1, Date.now() + 2]);
        if (!pat.isPending) pat.mutate(undefined, { onSuccess: (r) => r.gained && toast(`${pet.name} 쓰다듬기 · 경험치 +${r.xp}`) });
        return;
      }
      // 던지기: 놓는 순간의 속도로 날아간다
      st.vx = Math.max(-1400, Math.min(1400, st.vx));
      st.vy = Math.max(-1400, Math.min(1400, st.vy));
      st.mode = 'fall';
      st.perch = null;
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [pat, pet.name]);

  // 다음에 할 일
  const choose = () => {
    const st = s.current;
    const t = now();
    const sleepy = pet.mood === 'sleepy' || isNight();
    const r = Math.random();
    if (!egg && sleepy && r < 0.55) return set('sleep', rand(6000, 12000));
    if (egg) {
      if (r < 0.4) return walk(rand(30, 120), rand(2500, 4500));
      return set('idle', rand(1500, 3500));
    }
    // 커서가 최근에 움직였고 가까우면 쫓아간다
    if (pointer.current.at > t - 3000 && r < 0.2) return set('chase', rand(2500, 4000));
    if (r < 0.45) return walk(rand(80, 320), rand(2500, 5000));
    if (r < 0.6 && !st.perch) {
      const card = pickPerch();
      if (card) return jumpTo(card);
    }
    if (r < 0.68 && pet.stage !== 'baby' && !st.perch) {
      // 벽 타기: 가까운 벽으로 걸어간 뒤 (도착하면 climb)
      st.side = st.x < window.innerWidth / 2 ? -1 : 1;
      st.dir = st.side;
      return set('walk', 15000);
    }
    if (r < 0.85) return set('sit', rand(3000, 6000));
    if (st.perch && r < 0.93) {
      // 카드에서 뛰어내리기
      st.vx = st.dir * rand(80, 160);
      st.vy = -rand(300, 500);
      st.perch = null;
      return set('jump', 0);
    }
    return set('idle', rand(1500, 3000));
  };

  const set = (mode: Mode, ms: number) => {
    s.current.mode = mode;
    s.current.until = now() + ms;
  };

  const walk = (dist: number, ms: number) => {
    const st = s.current;
    st.dir = Math.random() < 0.5 ? -1 : 1;
    if (st.x + st.dir * dist > window.innerWidth - SIZE / 2 || st.x + st.dir * dist < SIZE / 2) st.dir = (st.dir * -1) as 1 | -1;
    set('walk', ms);
  };

  const pickPerch = () => {
    const st = s.current;
    const cards = [...document.querySelectorAll(PERCH)].filter((c) => {
      const r = c.getBoundingClientRect();
      return r.width > 160 && r.top > 90 && r.top < window.innerHeight - SIZE - 40 && Math.abs(r.left + r.width / 2 - st.x) < 700;
    });
    return cards[Math.floor(Math.random() * cards.length)] ?? null;
  };

  /** 포물선으로 폴짝: 카드보다 40px 높이 솟았다가 내려앉는다 */
  const jumpTo = (card: Element) => {
    const st = s.current;
    const r = card.getBoundingClientRect();
    const tx = Math.max(r.left + SIZE / 2, Math.min(r.right - SIZE / 2, st.x + rand(-120, 120)));
    const apex = Math.min(st.y, r.top) - 40;
    st.vy = -Math.sqrt(2 * GRAVITY * (st.y - apex));
    const T = -st.vy / GRAVITY + Math.sqrt((2 * (r.top - apex)) / GRAVITY);
    st.vx = (tx - st.x) / T;
    st.dir = st.vx >= 0 ? 1 : -1;
    st.target = card;
    set('jump', 0);
  };

  // 움직임 (매 프레임)
  useEffect(() => {
    let raf = 0;
    let last = now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = now();
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const st = s.current;
      const W = window.innerWidth;
      const ground = () => (st.perch ? st.perch.getBoundingClientRect().top : floorY());

      if (drag.current) st.mode = 'drag';
      switch (st.mode) {
        case 'drag':
          break;
        case 'walk':
        case 'chase': {
          if (st.mode === 'chase') {
            const dx = pointer.current.x - st.x;
            st.dir = dx >= 0 ? 1 : -1;
            if (Math.abs(dx) < 24) {
              st.vy = -380;
              st.vx = 0;
              setHearts((h) => [...h, Date.now()]);
              set('jump', 0);
              break;
            }
          }
          st.x += st.dir * speed * (st.mode === 'chase' ? 1.6 : 1) * dt;
          if (st.perch) {
            const r = st.perch.getBoundingClientRect();
            if (st.x < r.left + 8 || st.x > r.right - 8) {
              // 카드 끝에서 떨어진다
              st.perch = null;
              st.vx = st.dir * speed;
              st.vy = 0;
              set('fall', 0);
            }
          } else if (st.x < SIZE / 2 || st.x > W - SIZE / 2) {
            st.x = Math.max(SIZE / 2, Math.min(W - SIZE / 2, st.x));
            // 벽에 닿으면: 어린이부터는 가끔 벽을 탄다
            if (pet.stage !== 'baby' && !egg && Math.random() < 0.6) {
              st.side = st.x < W / 2 ? -1 : 1;
              set('climb', 0);
            } else st.dir = (st.dir * -1) as 1 | -1;
          }
          st.y = ground();
          break;
        }
        case 'climb':
          st.x = st.side < 0 ? SIZE / 2 - 8 : W - SIZE / 2 + 8;
          st.y -= 40 * dt;
          if (st.y < window.innerHeight * 0.4) set('hang', rand(1200, 2600));
          break;
        case 'hang':
          if (t > st.until) {
            st.vx = -st.side * rand(120, 220);
            st.vy = -200;
            set('fall', 0);
          }
          break;
        case 'jump':
        case 'fall': {
          st.vy += GRAVITY * dt;
          st.x += st.vx * dt;
          st.y += st.vy * dt;
          if (st.x < SIZE / 2 || st.x > W - SIZE / 2) {
            st.x = Math.max(SIZE / 2, Math.min(W - SIZE / 2, st.x));
            st.vx *= -0.5;
          }
          if (st.vy > 0) {
            // 뛰어오르던 카드 위에 닿으면 올라선다
            const card = st.target;
            if (card) {
              const r = card.getBoundingClientRect();
              if (st.y >= r.top && st.y - st.vy * dt <= r.top + 2 && st.x > r.left && st.x < r.right) {
                st.perch = card;
                st.target = null;
              }
            }
            if (st.perch || st.y >= floorY()) {
              st.y = st.perch ? st.perch.getBoundingClientRect().top : floorY();
              st.vx = 0;
              st.vy = 0;
              st.target = null;
              set('land', 260);
            }
          }
          break;
        }
        default: {
          // 서 있기 · 앉기 · 졸기 · 착지: 올라간 카드가 스크롤되면 따라가고, 화면 밖으로 나가면 떨어진다
          if (st.perch) {
            const r = st.perch.getBoundingClientRect();
            if (r.top < 64 || r.top > window.innerHeight || !st.perch.isConnected) {
              st.perch = null;
              set('fall', 0);
              st.vx = 0;
              st.vy = 0;
            } else st.y = r.top;
          } else st.y = floorY();
          if (t > st.until) {
            if (st.mode === 'land') set('idle', rand(600, 1500));
            else choose();
          }
        }
      }
      if ((st.mode === 'walk' || st.mode === 'chase') && t > st.until) choose();

      const node = el.current;
      if (node) {
        node.style.transform = `translate3d(${Math.round(st.x - SIZE / 2)}px, ${Math.round(st.y - SIZE)}px, 0)`;
        node.style.setProperty('--dpet-dir', String(st.mode === 'climb' || st.mode === 'hang' ? -st.side : st.dir));
        node.dataset.mode = st.mode;
        node.dataset.side = String(st.side);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // choose · jumpTo 는 pet 에만 기대므로 pet 이 바뀔 때만 다시 건다
  }, [pet.stage, pet.mood]);

  // 모습: 걸음 그림 · 깜빡임 (가끔만 React 로)
  useEffect(() => {
    const t = window.setInterval(() => {
      const mode = s.current.mode;
      setLook((l) => ({
        mode,
        frame: mode === 'walk' || mode === 'chase' || mode === 'climb' || mode === 'drag' ? ((l.frame ? 0 : 1) as 0 | 1) : 0,
        blink: Math.random() < 0.06,
      }));
    }, 200);
    return () => window.clearInterval(t);
  }, []);

  // 다 뜬 하트 치우기
  useEffect(() => {
    if (!hearts.length) return;
    const t = window.setTimeout(() => setHearts([]), 1500);
    return () => window.clearTimeout(t);
  }, [hearts]);

  return (
    <div
      ref={el}
      className={cn('dpet', `dpet-${look.mode}`)}
      style={{ width: SIZE, height: SIZE } as CSSProperties}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <div
        className="dpet-body"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          const st = s.current;
          drag.current = { dx: e.clientX - st.x, dy: e.clientY - st.y, sx: e.clientX, sy: e.clientY, moved: false, lx: e.clientX, ly: e.clientY, lt: now() };
          st.perch = null;
          st.target = null;
        }}
        title={`${pet.name} (끌어서 옮기기 · 눌러서 쓰다듬기)`}
      >
        <PetSprite
          size={SCALE}
          species={pet.species}
          stage={pet.stage}
          accessory={pet.accessory}
          eyesClosed={look.blink || look.mode === 'sleep'}
          happy={look.mode === 'chase' || look.mode === 'land' || hearts.length > 0}
          frame={look.frame}
          progress={egg ? pet.xp / 10 : 0}
        />
        {look.mode === 'sleep' && (
          <span className="pet-zzz" aria-hidden>
            <i>z</i>
            <i>z</i>
            <i>Z</i>
          </span>
        )}
        {hearts.map((id, i) => (
          <span key={id} className="pet-heart" style={{ '--i': i % 3 } as CSSProperties} aria-hidden>
            ♥
          </span>
        ))}
      </div>
      {hover && look.mode !== 'drag' && (
        <div className="dpet-tag">
          <b>{pet.name}</b> Lv.{pet.level} · {PET_STAGES[pet.stage].label}
          <button
            type="button"
            onClick={() => {
              updateSettings({ petRoam: false });
              toast('펫을 쉬게 했어요. 마이페이지 › 펫에서 다시 데리고 다닐 수 있어요');
            }}
          >
            숨기기
          </button>
        </div>
      )}
    </div>
  );
}

/** 로그인했고, 펫이 있고, '화면에 데리고 다니기'를 켰을 때 (펫 방이 있는 마이페이지 › 펫에서는 숨긴다) */
export function DesktopPet() {
  const { isLoggedIn } = useAuth();
  const { petRoam } = useSettings();
  const can = useMediaQuery('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  const { pathname } = useLocation();
  const { data: pet } = useMyPet(isLoggedIn && can && petRoam);
  if (!isLoggedIn || !can || !petRoam || !pet || pathname === '/me/pet') return null;
  return <Roamer pet={pet} />;
}

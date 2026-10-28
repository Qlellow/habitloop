import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { PET_GRID as G, petRects, type PetLook as Look, type PetPublic } from '@loop/shared';
import { cn } from '../lib/cn';

/**
 * 커뮤니티 펫: 도트(픽셀) 그림 + 행동.
 * 그림은 종 · 자란 단계 · 표정으로 그때그때 만든다 (18 × 18 칸).
 *   몸: 자랄수록 커지는 타원 (슬라임은 바닥이 납작) + 테두리 · 그림자 · 하이라이트
 *   종마다: 고양이 귀 · 꼬리 · 하얀 배, 병아리 부리 · 날개 · 발 · 볏, 슬라임 새싹
 *   표정: 눈(깜빡 · 졸림), 볼, 입 / 꾸미기: 리본(Lv15) · 왕관(Lv20)
 */

/** 도트 그림 (SVG, 같은 색이 이어지는 칸은 한 사각형으로) */
export function PetSprite({ size = 6, className, ...look }: Look & { size?: number; className?: string }) {
  // look 은 매번 새 객체라 값들로 다시 만들지 정한다
  const rects = useMemo(() => petRects(look), [look.species, look.stage, look.eyesClosed, look.happy, look.accessory, look.frame, look.progress]);
  return (
    <svg className={className} width={G * size} height={G * size} viewBox={`0 0 ${G} ${G}`} shapeRendering="crispEdges" aria-hidden>
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.c} />
      ))}
    </svg>
  );
}

/* ───────── 행동 ───────── */

type Action = 'idle' | 'walk' | 'hop' | 'spin' | 'sleep' | 'wobble';

const isNight = () => {
  const h = (new Date().getUTCHours() + 9) % 24;
  return h >= 23 || h < 6;
};

/**
 * 살아 움직이는 펫. room 이면 칸 안을 돌아다닌다.
 *   알: 데굴데굴 흔들림 (부화가 가까울수록 자주) · 아기: 제자리에서 통통 · 어린이: 걷고 뛰고 · 어른: 걷고 뛰고 빙글
 *   졸리거나 밤(23~6시)이면 잠을 잔다 (Zzz) · 기분이 좋으면 가끔 하트
 * pats 가 바뀌면(쓰다듬으면) 펄쩍 뛰며 하트가 퐁퐁
 */
export function PetActor({
  pet,
  size = 6,
  room = false,
  progress = 0,
  pats = 0,
  onPet,
}: {
  pet: PetPublic;
  size?: number;
  room?: boolean;
  progress?: number;
  pats?: number;
  onPet?: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [blink, setBlink] = useState(false);
  const [frame, setFrame] = useState<0 | 1>(0);
  const [action, setAction] = useState<Action>(pet.stage === 'egg' ? 'wobble' : 'idle');
  const [x, setX] = useState(50); // 칸 안 가로 위치 (%)
  const [dir, setDir] = useState<1 | -1>(1);
  const [hearts, setHearts] = useState<number[]>([]);
  const sleeping = pet.stage !== 'egg' && (pet.mood === 'sleepy' || isNight());

  // 깜빡
  useEffect(() => {
    let t = 0;
    const loop = () => {
      t = window.setTimeout(() => {
        setBlink(true);
        window.setTimeout(() => setBlink(false), 140);
        loop();
      }, 2200 + Math.random() * 2600);
    };
    loop();
    return () => window.clearTimeout(t);
  }, []);

  // 걸음 · 파닥임 그림 넘기기
  useEffect(() => {
    if (action !== 'walk') return setFrame(0);
    const t = window.setInterval(() => setFrame((f) => (f ? 0 : 1)), 220);
    return () => window.clearInterval(t);
  }, [action]);

  // 다음 행동 고르기
  useEffect(() => {
    if (sleeping) return setAction('sleep');
    let t = 0;
    const next = () => {
      let a: Action;
      if (pet.stage === 'egg') a = Math.random() < 0.3 + progress * 0.5 ? 'wobble' : 'idle';
      else if (pet.stage === 'baby') a = Math.random() < 0.5 ? 'hop' : 'idle';
      else {
        const r = Math.random();
        a = room && r < 0.45 ? 'walk' : r < 0.65 ? 'hop' : pet.stage === 'adult' && r < 0.75 ? 'spin' : 'idle';
      }
      if (a === 'walk') {
        setX((cur) => {
          const to = Math.max(12, Math.min(88, cur + (Math.random() < 0.5 ? -1 : 1) * (15 + Math.random() * 30)));
          setDir(to >= cur ? 1 : -1);
          return to;
        });
      }
      setAction(a);
      if (pet.mood === 'happy' && Math.random() < 0.25) setHearts((h) => [...h, Date.now()]);
      t = window.setTimeout(next, a === 'walk' ? 1800 : 1400 + Math.random() * 1600);
    };
    t = window.setTimeout(next, 600);
    return () => window.clearTimeout(t);
  }, [pet.stage, pet.mood, room, sleeping, progress]);

  // 쓰다듬기
  useEffect(() => {
    if (!pats) return;
    setAction(pet.stage === 'egg' ? 'wobble' : 'hop');
    setHearts((h) => [...h, Date.now(), Date.now() + 1, Date.now() + 2]);
  }, [pats, pet.stage]);

  // 다 뜬 하트는 치운다
  useEffect(() => {
    if (!hearts.length) return;
    const t = window.setTimeout(() => setHearts((h) => h.slice(-3).filter((id) => Date.now() - id < 1400)), 1500);
    return () => window.clearTimeout(t);
  }, [hearts]);

  const body = (
    <div
      className={cn('pet-body', `pet-${action}`)}
      // 다시 같은 행동이어도 애니메이션이 처음부터 나오게
      key={`${action}-${pats}`}
      style={{ '--pet-dir': dir } as CSSProperties}
    >
      <PetSprite
        size={size}
        species={pet.species}
        stage={pet.stage}
        accessory={pet.accessory}
        eyesClosed={blink || action === 'sleep'}
        happy={pet.mood === 'happy' || action === 'hop'}
        frame={frame}
        progress={progress}
      />
      {action === 'sleep' && (
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
  );

  return (
    <div
      ref={boxRef}
      className={cn('pet-actor', room && 'pet-room-actor', onPet && 'cursor-pointer')}
      style={room ? ({ left: `${x}%`, '--pet-dir': dir } as CSSProperties) : undefined}
      onClick={onPet}
      title={onPet ? '쓰다듬기' : undefined}
    >
      {body}
    </div>
  );
}

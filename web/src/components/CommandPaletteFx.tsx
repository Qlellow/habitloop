import type { CSSProperties } from 'react';
import type { FxDesign } from '../lib/settings';

/**
 * 커맨드 팔레트를 인터랙티브 커서 디자인에 맞춘 장식 (설정 › 커맨드 팔레트도 커서 디자인으로).
 * 색(포인트 · 빛)은 global.css 의 .cmdk[data-fx] 가 바꾸고, 여기서는 도트 그림을 그린다:
 *  - 검색줄 오른쪽의 도트 배지 (별 반짝 · 하트 두근 · 벚꽃 살랑 · 눈 빙글 · 불꽃 일렁)
 *  - 팔레트 안을 떠다니는 도트 입자 (별은 반짝이고, 하트 · 불티는 떠오르고, 꽃잎 · 눈은 흩날리며 내린다)
 * 도트는 한 칸짜리 요소에 box-shadow 로 칸을 찍어 그린다 (커서 효과와 같은 도트 느낌).
 */

type Pixels = [number, number][];

const SPRITES: Record<FxDesign, Pixels> = {
  // 십자 별
  star: [[2, 0], [2, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [2, 3], [2, 4]],
  // 7×6 하트
  heart: [
    [1, 0], [2, 0], [4, 0], [5, 0],
    [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1],
    [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2],
    [1, 3], [2, 3], [3, 3], [4, 3], [5, 3],
    [2, 4], [3, 4], [4, 4],
    [3, 5],
  ],
  // 다섯 잎 꽃
  sakura: [[2, 0], [1, 1], [3, 1], [0, 2], [2, 2], [4, 2], [1, 3], [3, 3], [1, 4], [3, 4]],
  // 눈 결정
  snow: [
    [0, 0], [2, 0], [4, 0],
    [1, 1], [2, 1], [3, 1],
    [0, 2], [1, 2], [2, 2], [3, 2], [4, 2],
    [1, 3], [2, 3], [3, 3],
    [0, 4], [2, 4], [4, 4],
  ],
  // 불티 (마름모)
  fire: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [1, 3]],
};

/** 가운데 한 칸만 밝게 (꽃술 · 별 가운데 · 불씨 심지) */
const CORE: Partial<Record<FxDesign, [number, number]>> = { star: [2, 2], sakura: [2, 2], fire: [1, 1] };

function sprite(design: FxDesign, px: number, color: string, core = '#fff'): CSSProperties {
  const c = CORE[design];
  const colorOf = (x: number, y: number) => (c && c[0] === x && c[1] === y ? core : color);
  // 그림자는 요소 자기 칸(0,0)에는 그려지지 않는다 (요소 밑에 가려진다) → 그 칸은 배경색으로 칠한다
  const origin = SPRITES[design].some(([x, y]) => x === 0 && y === 0);
  return {
    width: px,
    height: px,
    background: origin ? colorOf(0, 0) : undefined,
    boxShadow: SPRITES[design]
      .filter(([x, y]) => x !== 0 || y !== 0)
      .map(([x, y]) => `${x * px}px ${y * px}px 0 0 ${colorOf(x, y)}`)
      .join(','),
  };
}

const size = (design: FxDesign) => {
  const pts = SPRITES[design];
  return { w: Math.max(...pts.map((p) => p[0])) + 1, h: Math.max(...pts.map((p) => p[1])) + 1 };
};

/** 입자 자리 · 크기 · 속도 (매번 같은 모양이 되도록 고정값) */
const PARTICLES = [
  { x: 6, y: 18, d: 0, t: 7, s: 2 },
  { x: 18, y: 62, d: 1.6, t: 9, s: 3 },
  { x: 29, y: 34, d: 3.1, t: 8, s: 2 },
  { x: 41, y: 80, d: 0.8, t: 10, s: 2 },
  { x: 53, y: 12, d: 2.4, t: 7.5, s: 3 },
  { x: 64, y: 54, d: 4.2, t: 9.5, s: 2 },
  { x: 76, y: 28, d: 1.2, t: 8.5, s: 2 },
  { x: 87, y: 72, d: 3.6, t: 7, s: 3 },
  { x: 95, y: 40, d: 2, t: 10.5, s: 2 },
  { x: 12, y: 90, d: 5, t: 8, s: 2 },
  { x: 47, y: 46, d: 5.6, t: 9, s: 2 },
  { x: 70, y: 92, d: 0.4, t: 8, s: 2 },
];

export function CommandPaletteFx({ design, still }: { design: FxDesign; still?: boolean }) {
  const { w, h } = size(design);
  return (
    <div className={`cmdk-fx${still ? ' is-still' : ''}`} aria-hidden>
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="cmdk-fx-p"
          style={
            {
              left: `${p.x}%`,
              top: `${p.y}%`,
              animationDelay: `${-p.d}s`,
              animationDuration: `${p.t}s`,
              '--sway': `${i % 2 ? 14 : -14}px`,
            } as CSSProperties
          }
        >
          <i style={{ ...sprite(design, p.s, i % 3 === 0 ? 'var(--fx-b)' : 'var(--fx-a)'), marginLeft: (-w * p.s) / 2, marginTop: (-h * p.s) / 2 }} />
        </span>
      ))}
    </div>
  );
}

/** 검색줄 오른쪽 도트 배지 */
export function CommandPaletteFxBadge({ design }: { design: FxDesign }) {
  const { w, h } = size(design);
  const px = 3;
  return (
    <span className="cmdk-fx-badge" aria-hidden style={{ width: w * px, height: h * px }}>
      <i style={sprite(design, px, 'var(--fx-a)')} />
    </span>
  );
}

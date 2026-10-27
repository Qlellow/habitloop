import { memo, type CSSProperties, type ReactNode } from 'react';
import type { Village } from '@loop/shared';
import { cn } from '../../lib/cn';
import { LOTS, sprite, type Pix, type SpriteName } from './sprites';
import '../../styles/village.css';

const W = 240;
const H = 90;

/** 도트 그림 하나 (칸 색은 .vk-* 클래스가 정한다) */
function Sprite({ p, x, y, className, style, children }: { p: Pix; x: number; y: number; className?: string; style?: CSSProperties; children?: ReactNode }) {
  return (
    <g transform={`translate(${x} ${y})`} className={className} style={style}>
      {p.rects().map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} className={`vk-${r.c}`} />
      ))}
      {children}
    </g>
  );
}

/** 이름으로 도트 그림 하나 (목록 · 카드의 작은 그림) */
export function VillageIcon({ name, size, fit, locked, className }: { name: SpriteName; size?: number; fit?: [number, number]; locked?: boolean; className?: string }) {
  const p = sprite(name);
  // fit: 이 상자(가로, 세로 px) 안에 들어가는 가장 큰 크기 (작은 장식은 4배까지)
  size ??= fit ? Math.min(4, fit[0] / p.w, fit[1] / p.h) : 3;
  return (
    <svg className={cn('village-icon', locked && 'is-locked', className)} width={p.w * size} height={p.h * size} viewBox={`0 0 ${p.w} ${p.h}`} shapeRendering="crispEdges" aria-hidden>
      <Sprite p={p} x={0} y={0} />
    </svg>
  );
}

/** 건물 코드 → 대표 그림 */
export const iconOf = (code: string): SpriteName => (code === 'campfire' ? 'campfireIcon' : (LOTS[code]?.[0]?.sprite ?? 'scaffold'));

/** 언덕 윤곽 (도트처럼 계단) */
const HILLS = (() => {
  const pts: string[] = [`0,${H}`];
  for (let x = 0; x <= W; x += 4) {
    const y = 50 - 7 * Math.sin(x / 34) - 5 * Math.sin(x / 13 + 1) + (x > 150 && x < 225 ? -6 * Math.sin(((x - 150) / 75) * Math.PI) : 0);
    const r = Math.round(y);
    pts.push(`${x},${r}`, `${x + 4},${r}`);
  }
  pts.push(`${W},${H}`);
  return pts.join(' ');
})();

/**
 * 채널 마을 그림 (240 × 90 칸). 해금된 건물만 서 있고, 다음에 생길 자리에는 공사장이 있다.
 * 모닥불은 깜빡이고, 풍차는 돌고, 분수는 반짝이고, 주민이 길을 오간다. 축제 주간에는 등불 줄과 폭죽
 */
export const VillageScene = memo(function VillageScene({ village, className, compact }: { village: Village; className?: string; compact?: boolean }) {
  const have = new Set(village.items.filter((i) => i.unlocked).map((i) => i.code));
  const fresh = new Set(village.items.filter((i) => i.isNew).map((i) => i.code));
  const names = new Map(village.items.map((i) => [i.code, i.name]));
  type Placed = { code: string; sprite: SpriteName; x: number; base: number; building: boolean };
  const placed: Placed[] = [];
  for (const [code, lots] of Object.entries(LOTS)) {
    if (have.has(code)) lots.forEach((l) => placed.push({ code, ...l, building: true }));
    else if (village.next?.code === code) placed.push({ code, sprite: 'scaffold', x: lots[0].x + Math.max(0, (sprite(lots[0].sprite).w - 16) / 2), base: lots[0].base, building: false });
  }
  placed.sort((a, b) => a.base - b.base);
  const walkers = Math.min(6, Math.max(1, Math.round(village.breakdown.followers / 2)));

  return (
    <svg
      className={cn('village-scene', village.festival && 'is-festival', compact && 'is-compact', className)}
      viewBox={`0 0 ${W} ${H}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`마을 Lv.${village.level}: ${[...have].map((c) => names.get(c)).join(', ')}`}
    >
      <rect width={W} height={H} className="vk-sky" />
      <rect y={34} width={W} height={20} className="vk-sky2" />
      <rect x={206} y={8} width={10} height={10} className="vk-sun" />
      <rect x={204} y={10} width={14} height={6} className="vk-sun" />
      <g className="village-clouds">
        {[
          [20, 10],
          [96, 16],
          [150, 6],
        ].map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <rect x={2} width={10} height={2} className="vk-cloud" />
            <rect y={2} width={16} height={3} className="vk-cloud" />
          </g>
        ))}
      </g>
      <polygon points={HILLS} className="vk-hill" shapeRendering="crispEdges" />
      <rect y={62} width={W} height={28} className="vk-grass" />
      <rect y={78} width={W} height={5} className="vk-path" />
      <rect y={83} width={W} height={1} className="vk-path2" />

      {village.festival && (
        <g className="village-festival" aria-hidden>
          <path d={`M0 6 Q60 18 120 6 Q180 18 240 6`} className="village-garland" fill="none" />
          {Array.from({ length: 13 }, (_, i) => {
            const x = 6 + i * 19;
            const t = (x % 120) / 120;
            const y = 6 + 12 * 4 * t * (1 - t) * 0.82;
            return <rect key={i} x={x} y={y} width={3} height={4} className={`vk-lantern${i % 3}`} />;
          })}
          {[
            [40, 22],
            [130, 14],
            [196, 26],
          ].map(([x, y], i) => (
            <g key={i} className="village-firework" style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${i * 0.9}s` }}>
              {Array.from({ length: 8 }, (_, k) => {
                const a = (k / 8) * Math.PI * 2;
                return <rect key={k} x={x + Math.round(Math.cos(a) * 6)} y={y + Math.round(Math.sin(a) * 6)} width={1} height={1} className={`vk-lantern${k % 3}`} />;
              })}
            </g>
          ))}
        </g>
      )}

      {placed.map((p, i) => {
        const s = sprite(p.sprite);
        const x = p.x;
        const y = p.base - s.h;
        return (
          <g key={`${p.code}-${i}`} className={cn('village-lot', !p.building && 'is-next')}>
            <title>{p.building ? names.get(p.code) : `공사 중: ${names.get(p.code)}`}</title>
            <Sprite p={s} x={x} y={y} />
            {p.sprite === 'campfire' && <Sprite p={sprite('flame')} x={x} y={y - 6} className="village-flame" />}
            {p.sprite === 'fountain' && <Sprite p={sprite('spray')} x={x} y={y - 6} className="village-spray" />}
            {p.sprite === 'windmill' && (
              // 돌리는 transform(CSS)과 자리 transform(속성)을 다른 요소에 둔다
              <g className="village-blades" style={{ transformOrigin: `${x + 12}px ${y + 10.5}px` }}>
                <Sprite p={sprite('blades')} x={x - 0.5} y={y - 2} />
              </g>
            )}
            {p.sprite === 'lamp' && <rect x={x - 2} y={y - 1} width={9} height={6} className="village-glow" />}
            {fresh.has(p.code) && p.building && i === placed.findIndex((q) => q.code === p.code) && (
              <g className="village-new">
                <rect x={x + s.w / 2 - 0.5} y={y - 5} width={1} height={3} className="vk-h" />
                <rect x={x + s.w / 2 - 1.5} y={y - 4} width={3} height={1} className="vk-h" />
              </g>
            )}
          </g>
        );
      })}

      {!compact &&
        Array.from({ length: walkers }, (_, i) => (
          <g
            key={i}
            className="village-walker"
            style={{ '--d': `${18 + i * 5}s`, '--delay': `${-i * 4.3}s`, '--from': `${8 + i * 12}px`, '--to': `${150 + i * 13}px` } as CSSProperties}
          >
            <Sprite p={sprite('villager')} x={0} y={76} className={`village-walker-${i % 4}`} />
          </g>
        ))}
    </svg>
  );
});

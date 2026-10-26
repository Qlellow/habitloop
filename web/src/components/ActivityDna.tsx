import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { compact, useActivityDna, type ActivityDna as Dna, type DnaBase, type DnaPeriod, type DnaTrait } from '@loop/shared';
import { ui } from './ui';
import { cn } from '../lib/cn';

/**
 * 활동 DNA (프로필): 언제 · 어디서 · 어떻게 활동했는지로 그린 커뮤니티 성향 (API /api/users/:id/dna).
 *  - 돌아가는 이중 나선: 최근 활동이 염기쌍 (글 · 댓글 · 공감 · 반응마다 색이 다르다)
 *  - 유형: 가장 활발한 시간대 + 가장 강한 성향 ('새벽형 탐험가')
 *  - 다섯 성향 오각형 · 24시간 시계 · 자주 가는 채널
 */

const PERIOD: Record<DnaPeriod, { icon: string; word: string; desc: string }> = {
  dawn: { icon: '🌙', word: '새벽형', desc: '모두가 잠든 새벽에 가장 활발해요' },
  morning: { icon: '🌅', word: '아침형', desc: '하루를 루프와 함께 시작해요' },
  day: { icon: '☀️', word: '한낮의', desc: '해가 높을 때 가장 활발해요' },
  evening: { icon: '🌇', word: '저녁형', desc: '하루를 마무리하며 들러요' },
  night: { icon: '🦉', word: '올빼미', desc: '늦은 밤에 가장 활발해요' },
};

export const TRAIT: Record<DnaTrait, { label: string; noun: string; desc: string }> = {
  create: { label: '글쓰기', noun: '이야기꾼', desc: '글로 이야기를 먼저 꺼내는 사람' },
  talk: { label: '대화', noun: '토론가', desc: '댓글로 대화를 이어 가는 사람' },
  explore: { label: '탐험', noun: '탐험가', desc: '여러 채널을 두루 돌아다니는 사람' },
  cheer: { label: '응원', noun: '응원단장', desc: '반응으로 다른 사람에게 힘을 보태는 사람' },
  depth: { label: '깊이', noun: '사색가', desc: '길고 깊이 있는 글을 쓰는 사람' },
};
const TRAITS = Object.keys(TRAIT) as DnaTrait[];

const BASE: Record<DnaBase | 'none', { color: string; label: string }> = {
  post: { color: '#4f7cff', label: '글' },
  comment: { color: '#22b07d', label: '댓글' },
  like: { color: '#f0577b', label: '공감' },
  reaction: { color: '#f5b84a', label: '반응' },
  none: { color: 'var(--line)', label: '' },
};

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 돌아가는 이중 나선. 화면에 보일 때만 움직인다 */
function Helix({ sequence }: { sequence: DnaBase[] }) {
  const ref = useRef<SVGSVGElement>(null);
  const [t, setT] = useState(0);
  useEffect(() => {
    if (reduced()) return;
    let raf = 0;
    let visible = true;
    const start = performance.now();
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    if (ref.current) io.observe(ref.current);
    let last = 0;
    const tick = (now: number) => {
      // 30fps 면 충분하다
      if (visible && now - last > 33) {
        last = now;
        setT((now - start) / 1000);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, []);
  // 활동이 적으면 빈 염기쌍으로 채운다
  const pairs: (DnaBase | 'none')[] = sequence.length >= 14 ? sequence : [...Array.from({ length: 14 - sequence.length }, () => 'none' as const), ...sequence];
  // 넓게 그리고 화면 폭에 맞춰 줄인다 (폰에서는 낮아진다)
  const W = 640;
  const H = 112;
  const mid = H / 2;
  const amp = 38;
  const x0 = 14;
  const step = (W - x0 * 2) / (pairs.length - 1);
  const phase = (x: number) => t * 1.4 + (x - x0) * 0.028;
  const strand = (sign: 1 | -1) => {
    let d = '';
    for (let x = x0; x <= W - x0 + 0.1; x += 4) d += `${d ? 'L' : 'M'}${x.toFixed(1)} ${(mid + sign * amp * Math.sin(phase(x))).toFixed(1)}`;
    return d;
  };
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="dna-helix" role="img" aria-label={`최근 활동 ${sequence.length}개를 염기쌍으로 그린 이중 나선`}>
      <path d={strand(-1)} className="dna-strand dna-strand-back" />
      {pairs.map((b, i) => {
        const x = x0 + i * step;
        const s = Math.sin(phase(x));
        const depth = Math.cos(phase(x));
        const y1 = mid + amp * s;
        const y2 = mid - amp * s;
        const color = BASE[b].color;
        return (
          <g key={i} opacity={0.45 + 0.55 * ((depth + 1) / 2)}>
            <line x1={x} y1={y1} x2={x} y2={y2} stroke={color} strokeWidth={2.4} strokeLinecap="round" opacity={b === 'none' ? 0.5 : 0.8} />
            <circle cx={x} cy={y1} r={3 + depth * 1.1} fill={color} />
            <circle cx={x} cy={y2} r={3 - depth * 1.1} fill={color} />
          </g>
        );
      })}
      <path d={strand(1)} className="dna-strand" />
    </svg>
  );
}

/** 다섯 성향 오각형 */
function Radar({ traits }: { traits: Dna['traits'] }) {
  const c = 90;
  const r = 62;
  const at = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / TRAITS.length;
    return [c + Math.cos(a) * r * v, c + Math.sin(a) * r * v] as const;
  };
  const ring = (v: number) => TRAITS.map((_, i) => at(i, v).join(',')).join(' ');
  return (
    <svg viewBox="0 0 180 180" className="dna-radar" role="img" aria-label={TRAITS.map((k) => `${TRAIT[k].label} ${traits[k]}`).join(', ')}>
      {[0.25, 0.5, 0.75, 1].map((v) => (
        <polygon key={v} points={ring(v)} className="dna-radar-grid" />
      ))}
      {TRAITS.map((_, i) => {
        const [x, y] = at(i, 1);
        return <line key={i} x1={c} y1={c} x2={x} y2={y} className="dna-radar-grid" />;
      })}
      <polygon points={TRAITS.map((k, i) => at(i, Math.max(0.04, traits[k] / 100)).join(',')).join(' ')} className="dna-radar-shape" />
      {TRAITS.map((k, i) => {
        const [x, y] = at(i, 1.24);
        return (
          <text key={k} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="dna-radar-label">
            {TRAIT[k].label}
          </text>
        );
      })}
    </svg>
  );
}

/** 24시간 시계: 시각마다 활동 수만큼 바깥으로 뻗는 막대 */
function HourClock({ hours }: { hours: number[] }) {
  const max = Math.max(1, ...hours);
  const c = 70;
  return (
    <svg viewBox="0 0 140 140" className="dna-clock" role="img" aria-label="시간대별 활동">
      <circle cx={c} cy={c} r={30} className="dna-clock-face" />
      {hours.map((n, h) => {
        const a = -Math.PI / 2 + (h / 24) * 2 * Math.PI;
        const len = 4 + (n / max) * 30;
        return (
          <line
            key={h}
            x1={c + Math.cos(a) * 34}
            y1={c + Math.sin(a) * 34}
            x2={c + Math.cos(a) * (34 + len)}
            y2={c + Math.sin(a) * (34 + len)}
            className={cn('dna-clock-bar', n === max && n > 0 && 'is-peak')}
            strokeOpacity={n ? 0.35 + 0.65 * (n / max) : 0.18}
          />
        );
      })}
      {[0, 6, 12, 18].map((h) => {
        const a = -Math.PI / 2 + (h / 24) * 2 * Math.PI;
        return (
          <text key={h} x={c + Math.cos(a) * 20} y={c + Math.sin(a) * 20} textAnchor="middle" dominantBaseline="middle" className="dna-clock-label">
            {h}
          </text>
        );
      })}
    </svg>
  );
}

export function ActivityDnaCard({ userId, nickname }: { userId: string; nickname: string }) {
  const { data } = useActivityDna(userId);
  const title = useMemo(() => {
    if (!data?.type) return undefined;
    const p = PERIOD[data.type.period];
    const tr = TRAIT[data.type.trait];
    return { icon: p.icon, name: `${p.word} ${tr.noun}`, desc: `${p.desc}. ${tr.desc}이에요.` };
  }, [data]);
  if (!data) return null;
  return (
    <section className={cn(ui.card, 'dna-card overflow-hidden')}>
      <div className={ui.cardHead}>
        <h2 className={ui.sectionTitle}>활동 DNA</h2>
        <span className="text-[12px] text-fg-weak">공개 채널 활동으로 그렸어요</span>
      </div>
      <div className="px-5 pb-5">
        <Helix sequence={data.sequence} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[12px] text-fg-weak">
          {(['post', 'comment', 'like', 'reaction'] as const).map((b) => (
            <span key={b} className="inline-flex items-center gap-1">
              <i className="inline-block w-2 h-2 rounded-full" style={{ background: BASE[b].color }} />
              {BASE[b].label}
            </span>
          ))}
          <span className="ml-auto">최근 활동 {data.sequence.length}개</span>
        </div>

        <div className="mt-4">
          {title ? (
            <>
              <div className="text-[13px] text-fg-weak">{nickname}님은</div>
              <div className="dna-type">
                <span aria-hidden>{title.icon}</span> {title.name}
              </div>
              <p className="m-0 mt-1 text-[14px] text-fg-sub">{title.desc}</p>
            </>
          ) : (
            <>
              <div className="dna-type text-fg-sub">🧬 아직 DNA를 그리는 중</div>
              <p className="m-0 mt-1 text-[14px] text-fg-sub">글과 댓글이 3개 넘게 모이면 유형이 나타나요.</p>
            </>
          )}
        </div>

        <div className="dna-grid mt-4">
          <div className="dna-panel">
            <div className="dna-panel-title">성향</div>
            <Radar traits={data.traits} />
          </div>
          <div className="dna-panel">
            <div className="dna-panel-title">활동 시간</div>
            <HourClock hours={data.hours} />
          </div>
          <div className="dna-panel">
            <div className="dna-panel-title">기록</div>
            <dl className="dna-stats">
              <dt>글</dt>
              <dd>{compact(data.stats.posts)}</dd>
              <dt>댓글</dt>
              <dd>{compact(data.stats.comments)}</dd>
              <dt>받은 공감</dt>
              <dd>{compact(data.stats.likesReceived)}</dd>
              <dt>남긴 공감 · 반응</dt>
              <dd>{compact(data.stats.likesGiven + data.stats.reactionsGiven)}</dd>
            </dl>
            {data.channels.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {data.channels.map((c) => (
                  <Link key={c.slug} to={`/c/${c.slug}`} className="dna-chip">
                    {c.name} <span className="opacity-60 tabular-nums">{c.count}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

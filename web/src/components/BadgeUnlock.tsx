import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { markBadgesSeen, queryClient, useUnseenBadges, type Badge } from '@loop/shared';
import { BadgeMedal, TIER_LABEL } from './BadgeMedal';
import { preload } from '../lib/preload';

const SHOW_MS = 5200;
const SPARK_COLORS = ['#ffd24a', '#ff8a3d', '#5b9dff', '#8b6bff', '#2fd39a', '#ff6fa8'];
const SPARKS = Array.from({ length: 12 }, (_, i) => ({
  a: `${i * 30 + (i % 2) * 12}deg`,
  d: `${38 + (i % 3) * 12}px`,
  c: SPARK_COLORS[i % SPARK_COLORS.length],
}));

/**
 * 새 배지 알림: 서버가 '아직 알리지 않은 배지'를 주면 본 것으로 표시하고, 하나씩 띄운다 (5초씩, 마우스를 올리면 멈춤).
 * 글 · 댓글을 쓴 뒤 바로 뜨도록 그런 요청이 끝날 때도 새로 물어본다
 */
export function BadgeUnlock() {
  const unseen = useUnseenBadges();
  // 한 번에 여러 개(4개 이상)를 받으면 하나로 묶어 알린다
  const [queue, setQueue] = useState<Badge[][]>([]);
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const shown = useRef(new Set<string>());

  useEffect(() => {
    const fresh = (unseen.data ?? []).filter((b) => !shown.current.has(b.code));
    if (!fresh.length) return;
    fresh.forEach((b) => shown.current.add(b.code));
    setQueue((q) => [...q, ...(fresh.length > 3 ? [fresh] : fresh.map((b) => [b]))]);
    void markBadgesSeen().catch(() => undefined);
  }, [unseen.data]);

  // 글 · 댓글 · 공감 · 출석처럼 배지가 생길 수 있는 요청이 끝나면 곧바로 다시 확인한다
  useEffect(
    () =>
      queryClient.getMutationCache().subscribe((e) => {
        if (e.type === 'updated' && e.action.type === 'success') void queryClient.invalidateQueries({ queryKey: ['badges', 'new'] });
      }),
    [],
  );

  const current = queue[0];
  const head = current?.[0];
  useEffect(() => {
    if (!current || paused) return;
    const t = window.setTimeout(() => setLeaving(true), SHOW_MS);
    return () => window.clearTimeout(t);
  }, [current, paused]);
  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => {
      setQueue((q) => q.slice(1));
      setLeaving(false);
    }, 280);
    return () => window.clearTimeout(t);
  }, [leaving]);

  if (!current || !head) return null;
  const many = current.length > 1;
  return (
    <div
      key={head.code}
      className="badge-unlock fixed z-[60] right-6 bottom-6 max-[520px]:left-3 max-[520px]:right-3 max-[520px]:bottom-[calc(var(--tabbar-h)+12px)] w-[340px] max-[520px]:w-auto overflow-hidden rounded-xl border border-border bg-surface shadow-pop"
      data-leaving={leaving || undefined}
      role="status"
      aria-live="polite"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      <div className="flex items-center gap-4 p-4 pr-3">
        <div className="relative flex-none">
          {many ? (
            <span className="relative block w-[64px] h-[64px]">
              {current.slice(0, 3).map((b, i) => (
                <BadgeMedal key={b.code} icon={b.icon} tier={b.tier} size={44} style={{ position: 'absolute', left: i * 10, top: i * 10, zIndex: 3 - i }} />
              ))}
            </span>
          ) : (
            <BadgeMedal icon={head.icon} tier={head.tier} size={64} />
          )}
          <span className="badge-sparks" aria-hidden>
            {SPARKS.map((s, i) => (
              <i key={i} style={{ '--a': s.a, '--d': s.d, '--c': s.c } as React.CSSProperties} />
            ))}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          {many ? (
            <>
              <div className="text-[12px] font-bold text-fg-weak">새 배지를 받았어요!</div>
              <div className="mt-0.5 text-[17px] font-bold text-fg-strong truncate">배지 {current.length}개</div>
              <div className="text-[13px] text-fg-sub leading-snug line-clamp-2">{current.map((b) => b.name).join(' · ')}</div>
            </>
          ) : (
            <>
              <div className="text-[12px] font-bold text-fg-weak">
                새 배지를 받았어요! ·{' '}
                <span className="badge-tier-text" data-tier={head.tier}>
                  {TIER_LABEL[head.tier]}
                </span>
              </div>
              <div className="mt-0.5 text-[17px] font-bold text-fg-strong truncate">{head.name}</div>
              <div className="text-[13px] text-fg-sub leading-snug line-clamp-2">{head.description}</div>
            </>
          )}
          <div className="mt-2 flex items-center gap-3 text-[13px] font-semibold">
            <Link to="/badges" className="text-primary hover:underline" onPointerEnter={preload.badges} onClick={() => setLeaving(true)}>
              도감 보기
            </Link>
            {queue.length > 1 && <span className="text-fg-weak font-medium">+{queue.length - 1}개 더</span>}
          </div>
        </div>
        <button type="button" className="self-start w-7 h-7 grid place-items-center rounded-sm text-fg-weak hover:bg-field hover:text-fg-strong" aria-label="닫기" onClick={() => setLeaving(true)}>
          ✕
        </button>
      </div>
      <div
        className="badge-unlock-timer h-[3px] bg-primary"
        style={{ '--t': `${SHOW_MS}ms`, animationPlayState: paused ? 'paused' : 'running' } as React.CSSProperties}
      />
    </div>
  );
}

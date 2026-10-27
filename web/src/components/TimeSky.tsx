import { memo, useEffect, useRef } from 'react';
import { reportBadgeEvent } from '@loop/shared';

/** 별 자리 · 크기 · 밝기 (그릴 때마다 바뀌지 않게 고정된 씨앗으로 만든다) */
const GROUPS = 6;
const STARS = (() => {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  return Array.from({ length: 90 }, () => ({
    left: rand() * 100,
    top: rand() * 92,
    size: rand() < 0.12 ? 3 : rand() < 0.5 ? 2 : 1.4,
    min: 0.15 + rand() * 0.35,
  }));
})();

/**
 * 시간대 테마의 하늘: 일출(아침) · 한낮의 해와 햇살(낮) · 지는 해와 첫 별 몇 개(저녁) · 달과 반짝이는 별(새벽).
 * 무엇을 보일지는 CSS(:root[data-time])가 정해서, 시간대가 바뀌어도 다시 그리지 않는다. 시간대 테마가 아니면 숨는다
 */
export const TimeSky = memo(function TimeSky() {
  const shooting = useShootingStarCatch();
  return (
    <div className="time-sky" aria-hidden>
      <div className="sky-rays" />
      <div className="sky-sun" />
      <div className="sky-moon" />
      <div className="sky-stars">
        {/* 별을 여섯 무리로 나눠 무리째 반짝인다 (별 90개가 저마다 움직이면 매 프레임 스타일을 다시 계산한다) */}
        {Array.from({ length: GROUPS }, (_, g) => (
          <div key={g} className="sky-star-group" style={{ '--d': `${2.6 + g * 0.7}s`, '--delay': `${-g * 0.9}s` } as React.CSSProperties}>
            {STARS.map((s, i) =>
              i % GROUPS !== g ? null : (
                <span
                  key={i}
                  // 저녁에는 하늘 위쪽(노을이 닿지 않는 곳)의 몇 개만 먼저 뜬다
                  className={s.top < 50 && i % 3 === 0 ? 'sky-star sky-star-early' : 'sky-star'}
                  style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, opacity: 0.55 + s.min }}
                />
              ),
            )}
          </div>
        ))}
      </div>
      <div ref={shooting} className="sky-shooting" />
    </div>
  );
});

/**
 * 숨은 배지 '별똥별': 새벽 하늘에 별똥별이 지나가는 순간 그 근처를 누르면 잡힌다.
 * 하늘은 화면 뒤에 깔려 있어 직접 눌리지 않으므로, 누른 자리가 별똥별 가까이인지 본다
 */
function useShootingStarCatch() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = ref.current;
      if (!el || e.button !== 0) return;
      const style = getComputedStyle(el);
      if (style.display === 'none' || Number(style.opacity) < 0.2) return;
      const r = el.getBoundingClientRect();
      const pad = 36;
      if (e.clientX >= r.left - pad && e.clientX <= r.right + pad && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad) {
        void reportBadgeEvent('shooting_star');
      }
    };
    document.addEventListener('pointerdown', onDown, { passive: true });
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);
  return ref;
}

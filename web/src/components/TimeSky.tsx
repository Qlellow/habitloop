import { memo } from 'react';

/** 별 자리 · 크기 · 반짝이는 박자 (그릴 때마다 바뀌지 않게 고정된 씨앗으로 만든다) */
const STARS = (() => {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  return Array.from({ length: 90 }, () => ({
    left: rand() * 100,
    top: rand() * 92,
    size: rand() < 0.12 ? 3 : rand() < 0.5 ? 2 : 1.4,
    duration: 2 + rand() * 4,
    delay: -rand() * 6,
    min: 0.15 + rand() * 0.35,
  }));
})();

/**
 * 시간대 테마의 하늘: 일출(아침) · 한낮의 해와 햇살(낮) · 지는 해(저녁) · 달과 반짝이는 별(새벽).
 * 무엇을 보일지는 CSS(:root[data-time])가 정해서, 시간대가 바뀌어도 다시 그리지 않는다. 시간대 테마가 아니면 숨는다
 */
export const TimeSky = memo(function TimeSky() {
  return (
    <div className="time-sky" aria-hidden>
      <div className="sky-rays" />
      <div className="sky-sun" />
      <div className="sky-moon" />
      <div className="sky-stars">
        {STARS.map((s, i) => (
          <span
            key={i}
            className="sky-star"
            style={
              {
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: s.size,
                height: s.size,
                '--d': `${s.duration}s`,
                '--delay': `${s.delay}s`,
                '--min': s.min,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <div className="sky-shooting" />
    </div>
  );
});

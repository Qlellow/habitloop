import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';

/**
 * 메이슨리(Pinterest 식) 레이아웃: 카드 높이를 억지로 맞추지 않고, 순서대로 가장 짧은 열에 쌓는다.
 * CSS columns 와 달리 읽는 순서(왼쪽 → 오른쪽)가 유지된다.
 * 높이는 그려 보기 전에 데이터로 추정(estimate)해서, 자리를 옮기며 깜빡이지 않게 한다.
 */
export function Masonry<T>({
  items,
  keyOf,
  estimate,
  render,
  minColumnWidth = 360,
  gap = 16,
  singleColumnBelow = 860,
  className,
}: {
  items: T[];
  keyOf: (item: T) => string;
  /** 카드 높이 추정값(px). 열을 고르는 데만 쓴다 */
  estimate: (item: T) => number;
  render: (item: T) => ReactNode;
  minColumnWidth?: number;
  gap?: number;
  /** 화면 너비가 이 값 이하면 한 열로 (태블릿·폰) */
  singleColumnBelow?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);

  // 그리기 전에 너비를 재서 열 수를 정한다 (창 크기가 바뀌면 다시)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setColumns(window.innerWidth <= singleColumnBelow ? 1 : Math.max(1, Math.floor((el.clientWidth + gap) / (minColumnWidth + gap))));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [gap, minColumnWidth, singleColumnBelow]);

  const cols: T[][] = Array.from({ length: columns }, () => []);
  const heights = new Array<number>(columns).fill(0);
  for (const item of items) {
    // 가장 짧은 열 (같으면 왼쪽)
    let target = 0;
    for (let i = 1; i < columns; i++) if (heights[i] < heights[target] - 1) target = i;
    cols[target].push(item);
    heights[target] += estimate(item) + gap;
  }

  return (
    <div ref={ref} className={cn('flex items-start', className)} style={{ gap }}>
      {cols.map((col, i) => (
        <div key={i} className="flex-1 min-w-0 flex flex-col" style={{ gap }}>
          {col.map((item) => (
            <div key={keyOf(item)}>{render(item)}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

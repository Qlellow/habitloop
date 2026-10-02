import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';

interface Drag {
  from: number;
  to: number;
  dy: number;
  tops: number[];
  heights: number[];
}

/**
 * 끌어서 순서 바꾸기 (Sortable). 손잡이를 잡고 끌면 그 줄이 손가락·마우스를 따라오고,
 * 지나간 다른 줄들은 부드럽게 비켜 준다. 놓으면 onDrop(원래 자리, 새 자리).
 * 목록(ul)에 listRef 를, 각 줄(li)에 itemStyle(i) 를, 손잡이에 handleProps(i) 를 붙인다.
 */
export function useSortable(onDrop: (from: number, to: number) => void) {
  const listRef = useRef<HTMLUListElement>(null);
  const startY = useRef(0);
  const [drag, setDrag] = useState<Drag>();

  const handleProps = (index: number) => ({
    onPointerDown: (e: ReactPointerEvent) => {
      if (e.button !== 0 || !listRef.current) return;
      e.preventDefault();
      const items = Array.from(listRef.current.children) as HTMLElement[];
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      startY.current = e.clientY;
      setDrag({ from: index, to: index, dy: 0, tops: items.map((el) => el.offsetTop), heights: items.map((el) => el.offsetHeight) });
    },
    onPointerMove: (e: ReactPointerEvent) => {
      if (!drag) return;
      const first = drag.tops[0];
      const last = drag.tops[drag.tops.length - 1] + drag.heights[drag.heights.length - 1];
      // 목록 밖으로는 끌려 나가지 않게
      const dy = Math.max(first - drag.tops[drag.from], Math.min(last - drag.tops[drag.from] - drag.heights[drag.from], e.clientY - startY.current));
      const center = drag.tops[drag.from] + drag.heights[drag.from] / 2 + dy;
      const to = drag.tops.filter((top, j) => j !== drag.from && top + drag.heights[j] / 2 <= center).length;
      setDrag({ ...drag, dy, to });
    },
    onPointerUp: () => {
      if (drag && drag.to !== drag.from) onDrop(drag.from, drag.to);
      setDrag(undefined);
    },
    onPointerCancel: () => setDrag(undefined),
    style: { touchAction: 'none', cursor: drag ? 'grabbing' : 'grab' } as CSSProperties,
  });

  const itemStyle = (i: number): CSSProperties | undefined => {
    if (!drag) return undefined;
    const { from, to, dy, tops, heights } = drag;
    if (i === from) {
      return { transform: `translateY(${dy}px)`, position: 'relative', zIndex: 2, transition: 'none', boxShadow: 'var(--shadow-pop)', background: 'var(--surface)', borderRadius: 8 };
    }
    // 끌고 있는 줄이 차지하던 자리만큼 비켜 준다
    const slot = from < tops.length - 1 ? tops[from + 1] - tops[from] : heights[from];
    let shift = 0;
    if (from < to && i > from && i <= to) shift = -slot;
    if (to < from && i >= to && i < from) shift = slot;
    return { transform: shift ? `translateY(${shift}px)` : undefined, transition: 'transform 0.18s ease' };
  };

  return { listRef, handleProps, itemStyle, dragging: drag !== undefined };
}

/** 배열에서 from 자리 항목을 to 자리로 옮긴 새 배열 */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

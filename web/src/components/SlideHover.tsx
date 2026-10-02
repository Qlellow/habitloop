import { useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';

interface Spot {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * 목록 안에서 hover 상자가 항목을 따라 미끄러져 움직인다 (인기 채널 · 마이페이지 메뉴).
 * 처음 들어올 때는 그 자리에서 나타나고, 목록 안에서 다른 항목으로 옮기면 이전 자리에서 부드럽게 옮겨 간다.
 * 항목(a · button)은 자기 hover 배경을 쓰지 않는다.
 */
export function SlideHover({ children, className, highlight = 'bg-field' }: { children: ReactNode; className?: string; highlight?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState<Spot>();
  const [visible, setVisible] = useState(false);
  // 밖에서 처음 들어올 때는 미끄러지지 않고 바로 그 자리에 나타난다
  const [instant, setInstant] = useState(true);

  const over = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const box = ref.current;
    const item = (e.target as HTMLElement).closest<HTMLElement>('a, button');
    if (!box || !item || !box.contains(item)) return;
    const b = box.getBoundingClientRect();
    const r = item.getBoundingClientRect();
    setInstant(!visible);
    setSpot({ left: r.left - b.left, top: r.top - b.top, width: r.width, height: r.height });
    setVisible(true);
  };

  return (
    <div ref={ref} className={cn('relative isolate', className)} onPointerOver={over} onPointerLeave={() => setVisible(false)}>
      <span
        aria-hidden
        className={cn(
          'absolute left-0 top-0 -z-10 rounded-sm pointer-events-none',
          highlight,
          instant ? 'transition-opacity duration-150' : 'transition-[transform,width,height,opacity] duration-200 ease-out',
        )}
        style={
          spot
            ? { transform: `translate(${spot.left}px, ${spot.top}px)`, width: spot.width, height: spot.height, opacity: visible ? 1 : 0 }
            : { opacity: 0 }
        }
      />
      {children}
    </div>
  );
}

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ui } from './ui';
import { cn } from '../lib/cn';

/** 이 높이(px)를 넘는 본문은 접어서 COLLAPSED 만큼만 보여 준다 (조금만 넘는 글까지 접지 않도록 둘을 나눈다) */
const LIMIT = 900;
const COLLAPSED = 640;

/**
 * 긴 본문 접기: 너무 길면 아래를 흐리게 가리고 "더 보기" 버튼을 둔다.
 * 이미지가 늦게 불러와져 높이가 바뀌어도 다시 잰다 (ResizeObserver).
 */
export function CollapsibleBody({ children }: { children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const [tall, setTall] = useState(false);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const measure = () => setTall(el.scrollHeight > LIMIT);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const collapsed = tall && !open;
  return (
    <div ref={topRef} className="scroll-mt-24">
      <div className={cn('relative', collapsed && 'overflow-hidden')} style={collapsed ? { maxHeight: COLLAPSED } : undefined}>
        <div ref={innerRef}>{children}</div>
        {collapsed && <div aria-hidden className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-surface pointer-events-none" />}
      </div>
      {tall && (
        <div className="flex justify-center mt-3">
          <button
            type="button"
            aria-expanded={open}
            className={cn(ui.button, ui.ghost, ui.small, 'gap-1.5 px-4')}
            onClick={() => {
              setOpen(!open);
              // 접을 때는 본문 처음으로 돌아가서 어디까지 읽었는지 잃지 않게
              if (open) topRef.current?.scrollIntoView({ block: 'start' });
            }}
          >
            {open ? '접기' : '더 보기'}
            <span aria-hidden className={cn('inline-block transition-transform duration-200', open && 'rotate-180')}>
              ⌄
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

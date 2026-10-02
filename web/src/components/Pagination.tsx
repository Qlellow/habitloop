import { ChevronLeftIcon, ChevronRightIcon } from './Icons';
import { cn } from '../lib/cn';

/** 1 … 4 5 [6] 7 8 … 20 처럼 지금 페이지 둘레만 보여 준다 */
function pageItems(page: number, pages: number): (number | '…')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const from = Math.max(2, Math.min(page - 2, pages - 5));
  const to = Math.min(pages - 1, Math.max(page + 2, 6));
  const items: (number | '…')[] = [1];
  if (from > 2) items.push('…');
  for (let n = from; n <= to; n++) items.push(n);
  if (to < pages - 1) items.push('…');
  items.push(pages);
  return items;
}

const btn =
  'grid place-items-center min-w-9 h-9 px-2 rounded-md text-[15px] font-semibold tabular-nums text-fg-sub transition-colors ' +
  'hover:bg-field hover:text-fg-strong disabled:opacity-35 disabled:pointer-events-none ' +
  'aria-[current=page]:bg-primary aria-[current=page]:text-white aria-[current=page]:hover:bg-primary';

/** 번호 페이지 이동 (루프 디자인: 둥근 칸, 지금 페이지는 파랑) */
export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  if (pages <= 1) return null;
  return (
    <nav className="flex items-center justify-center gap-1 px-4 py-4 border-t border-line" aria-label="페이지">
      <button type="button" className={cn(btn, '[&>svg]:w-4 [&>svg]:h-4')} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="이전 페이지">
        <ChevronLeftIcon />
      </button>
      {pageItems(page, pages).map((n, i) =>
        n === '…' ? (
          <span key={`gap-${i}`} className="w-6 text-center text-fg-weak" aria-hidden>
            …
          </span>
        ) : (
          <button key={n} type="button" className={btn} aria-current={n === page ? 'page' : undefined} onClick={() => onChange(n)}>
            {n}
          </button>
        ),
      )}
      <button type="button" className={cn(btn, '[&>svg]:w-4 [&>svg]:h-4')} disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="다음 페이지">
        <ChevronRightIcon />
      </button>
    </nav>
  );
}

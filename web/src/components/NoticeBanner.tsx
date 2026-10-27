import { Link } from 'react-router-dom';
import { markNoticeSeen, NOTICE_KIND, useNewNotice } from '../lib/notices';
import { preload } from '../lib/preload';
import { cn } from '../lib/cn';

/** 홈 맨 위: 아직 보지 않은 새 공지 (30일 안). 누르거나 닫으면 다시 뜨지 않는다 */
export function NoticeBanner() {
  const n = useNewNotice();
  if (!n) return null;
  return (
    <div className="flex items-center gap-2 min-w-0 h-11 pl-4 pr-1.5 rounded-lg border border-[color-mix(in_srgb,var(--primary)_28%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_7%,var(--surface))] animate-pop">
      <span aria-hidden>📢</span>
      <span className={cn('flex-none px-1.5 py-px rounded-sm text-[12px] font-bold', NOTICE_KIND[n.kind].className)}>{NOTICE_KIND[n.kind].label}</span>
      <Link to={`/notices/${n.id}`} className="min-w-0 flex-1 truncate text-[14px] font-semibold text-fg-strong hover:text-primary" onPointerEnter={preload.notice}>
        {n.title}
      </Link>
      <Link to={`/notices/${n.id}`} className="flex-none text-[13px] font-semibold text-primary max-[520px]:hidden" onPointerEnter={preload.notice}>
        자세히 →
      </Link>
      <button type="button" className="flex-none w-8 h-8 grid place-items-center rounded-sm text-fg-weak hover:bg-field hover:text-fg-strong" aria-label="새 공지 안내 닫기" onClick={() => markNoticeSeen(n.id)}>
        ✕
      </button>
    </div>
  );
}

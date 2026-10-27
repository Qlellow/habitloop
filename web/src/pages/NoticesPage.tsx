import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSiteNotices, type NoticeKind, type NoticeSummary } from '@loop/shared';
import { Page } from '../components/Layout';
import { ui } from '../components/ui';
import { cn } from '../lib/cn';
import { markNoticeSeen, noticeDate, NOTICE_KIND, NOTICE_KINDS } from '../lib/notices';
import { preload } from '../lib/preload';

export function NoticeKindBadge({ kind, className }: { kind: NoticeKind; className?: string }) {
  return <span className={cn('inline-flex items-center h-[22px] px-2 rounded-sm text-[12px] font-bold flex-none', NOTICE_KIND[kind].className, className)}>{NOTICE_KIND[kind].label}</span>;
}

function Row({ n }: { n: NoticeSummary }) {
  return (
    <li>
      <Link
        to={`/notices/${n.id}`}
        className="group flex flex-col gap-1.5 px-5 py-4 border-t border-line hover:bg-[color-mix(in_srgb,var(--field)_55%,transparent)] max-[520px]:px-4"
        onPointerEnter={preload.notice}
      >
        <span className="flex items-center gap-2 min-w-0">
          {n.pinned && (
            <span className="text-[13px]" aria-label="고정 공지">
              📌
            </span>
          )}
          <NoticeKindBadge kind={n.kind} />
          {n.version && <span className="text-[12px] font-semibold text-fg-weak tabular-nums">{n.version}</span>}
          <time className="ml-auto flex-none text-[13px] text-fg-weak tabular-nums" dateTime={n.createdAt}>
            {noticeDate(n.createdAt)}
          </time>
        </span>
        <span className="text-[16px] font-bold text-fg-strong group-hover:text-primary truncate">{n.title}</span>
        {n.excerpt && <span className="text-[14px] text-fg-sub line-clamp-2">{n.excerpt}</span>}
      </Link>
    </li>
  );
}

/** 사이트 공지사항: 업데이트 소식 · 공지 · 이벤트 · 점검 (관리자가 관리자 화면에서 쓴다) */
export default function NoticesPage() {
  const [kind, setKind] = useState<NoticeKind>();
  const q = useSiteNotices(kind);
  const first = q.data?.pages[0];
  const pinned = first?.pinned ?? [];
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  // 목록을 열면 맨 위(가장 최근) 공지까지 본 것으로
  const newest = Math.max(0, ...pinned.map((n) => n.id), ...items.map((n) => n.id));
  useEffect(() => {
    if (!kind) markNoticeSeen(newest);
  }, [kind, newest]);

  return (
    <Page variant="single">
      <div>
        <h1 className="m-0 text-[24px] font-bold text-fg-strong">공지사항</h1>
        <p className="mt-1 mb-0 text-[15px] text-fg-sub">루프의 새 기능 · 업데이트 소식과 안내를 모았어요.</p>
      </div>
      <section className={ui.card}>
        <div className={cn(ui.chips, 'px-5 py-4 max-[520px]:px-4')}>
          <button type="button" className={cn(ui.chip, 'h-8')} aria-pressed={!kind} onClick={() => setKind(undefined)}>
            전체
          </button>
          {NOTICE_KINDS.map((k) => (
            <button key={k} type="button" className={cn(ui.chip, 'h-8')} aria-pressed={kind === k} onClick={() => setKind(k)}>
              {NOTICE_KIND[k].label}
            </button>
          ))}
        </div>
        {q.isPending ? (
          <div className={ui.spinner} />
        ) : pinned.length + items.length === 0 ? (
          <p className={cn(ui.empty, 'border-t border-line')}>아직 올라온 공지가 없어요</p>
        ) : (
          <ul className="list-none m-0 p-0">
            {pinned.map((n) => (
              <Row key={n.id} n={n} />
            ))}
            {items.map((n) => (
              <Row key={n.id} n={n} />
            ))}
          </ul>
        )}
        {q.hasNextPage && (
          <div className="border-t border-line p-3 text-center">
            <button type="button" className={cn(ui.button, ui.text)} disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
              {q.isFetchingNextPage ? '불러오는 중…' : '더 보기'}
            </button>
          </div>
        )}
      </section>
    </Page>
  );
}

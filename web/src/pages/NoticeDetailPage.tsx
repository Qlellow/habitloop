import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, useSiteNotice } from '@loop/shared';
import { Page } from '../components/Layout';
import { Markdown } from '../components/Markdown';
import { ui } from '../components/ui';
import { cn } from '../lib/cn';
import { markNoticeSeen, noticeDate } from '../lib/notices';
import { NoticeKindBadge } from './NoticesPage';
import NotFoundPage from './NotFoundPage';
import { usePageTitle } from '../lib/title';

/** 공지 자세히: 마크다운 본문 + 이전 · 다음 공지 */
export default function NoticeDetailPage() {
  const id = Number(useParams().id);
  const { data: n, error } = useSiteNotice(id);
  usePageTitle(n?.title);
  useEffect(() => markNoticeSeen(n?.id), [n?.id]);

  if (!Number.isInteger(id) || id < 1 || (error instanceof ApiError && error.status === 404)) return <NotFoundPage message="없는 공지예요" />;
  return (
    <Page variant="single">
      <Link to="/notices" className={cn(ui.cardLink, 'self-start')}>
        ← 공지사항
      </Link>
      <article className={cn(ui.card, 'px-8 py-7 max-[520px]:px-4 max-[520px]:py-5')}>
        {!n ? (
          <div className={ui.spinner} />
        ) : (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <NoticeKindBadge kind={n.kind} />
              {n.version && <span className="text-[13px] font-semibold text-fg-weak tabular-nums">{n.version}</span>}
              {n.pinned && <span className="text-[13px] text-fg-weak">📌 고정</span>}
            </div>
            <h1 className="mt-3 mb-0 text-[26px] leading-tight font-bold text-fg-strong max-[520px]:text-[22px]">{n.title}</h1>
            <p className="mt-2 mb-0 text-[13px] text-fg-weak tabular-nums">
              {noticeDate(n.createdAt)}
              {n.updatedAt && ` · ${noticeDate(n.updatedAt)} 고침`}
            </p>
            <div className="mt-6 pt-6 border-t border-line">
              <Markdown source={n.body} />
            </div>
          </>
        )}
      </article>
      {n && (n.prev || n.next) && (
        <nav className={cn(ui.card, 'grid grid-cols-2 max-[520px]:grid-cols-1')} aria-label="다른 공지">
          {[
            ['이전 공지', n.prev],
            ['다음 공지', n.next],
          ].map(([label, x], i) =>
            x && typeof x === 'object' ? (
              <Link key={i} to={`/notices/${x.id}`} className={cn('px-5 py-4 hover:bg-field min-w-0', i === 1 && 'text-right border-l border-line max-[520px]:border-l-0 max-[520px]:border-t max-[520px]:text-left')}>
                <span className="block text-[12px] text-fg-weak">{label as string}</span>
                <span className="block mt-0.5 text-[15px] font-semibold text-fg-strong truncate">{x.title}</span>
              </Link>
            ) : (
              <span key={i} className={cn(i === 1 && 'border-l border-line max-[520px]:hidden')} />
            ),
          )}
        </nav>
      )}
    </Page>
  );
}

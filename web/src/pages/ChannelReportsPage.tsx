import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { REPORT_REASONS, timeAgo, useChannel, useChannelReports, useReportAction, type ReportAction, type ReportGroup } from '@loop/shared';
import { ChannelIcon } from '../components/ChannelIcon';
import { Page } from '../components/Layout';
import { toast } from '../components/Toast';
import { ui } from '../components/ui';
import { cn } from '../lib/cn';
import s from './pages.styles';

const reasonLabel = (r: string) => REPORT_REASONS.find((x) => x.value === r)?.label ?? r;

const DONE_LABEL: Record<string, string> = { hidden: '숨김', dismissed: '문제 없음' };

/** 신고함 한 줄: 신고된 글 · 댓글, 사유, 처리 버튼 */
function ReportRow({ report: r, slug, done }: { report: ReportGroup; slug: string; done: boolean }) {
  const action = useReportAction(slug);
  const what = r.commentId ? '댓글' : '글';
  const run = (a: ReportAction) => {
    if (a === 'delete' && !confirm(`이 ${what}을 지울까요? 지우면 되돌릴 수 없어요.`)) return;
    action.mutate(
      { postId: r.postId, commentId: r.commentId, action: a },
      {
        onSuccess: () =>
          toast(
            { hide: `${what}을 숨겼어요`, unhide: `${what}을 다시 보이게 했어요`, delete: `${what}을 지웠어요`, dismiss: '문제 없음으로 처리했어요' }[a],
          ),
        onError: (e) => toast(e.message),
      },
    );
  };

  return (
    <li className="py-4 border-b border-line last:border-b-0">
      <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
        <span className={cn(ui.badge, r.commentId ? 'bg-field text-fg-sub' : '')}>{what}</span>
        {done ? (
          <span className={cn(ui.badge, r.status === 'hidden' ? 'bg-danger-weak text-danger-text' : 'bg-field text-fg-sub')}>
            {DONE_LABEL[r.status] ?? r.status}
          </span>
        ) : (
          <span className="font-bold text-danger-text">신고 {r.count.toLocaleString()}건</span>
        )}
        <span className="text-fg-weak">· {timeAgo(r.lastReportedAt)}</span>
      </div>
      <Link to={`/posts/${r.postId}`} className="block mt-1.5 group">
        <span className="block text-[15px] font-semibold text-fg-strong group-hover:underline underline-offset-2">{r.postTitle}</span>
        {r.excerpt && <span className="block mt-0.5 text-sm text-fg-sub line-clamp-2">{r.commentId ? `“${r.excerpt}”` : r.excerpt}</span>}
      </Link>
      <div className="mt-1 text-[13px] text-fg-weak">
        쓴 사람{' '}
        <Link to={`/u/${r.author.id}`} className="font-medium text-fg-sub hover:underline underline-offset-2">
          {r.author.nickname}
        </Link>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {r.reasons.map((reason) => (
          <span key={reason} className="px-2 py-0.5 rounded-full bg-field text-xs font-semibold text-fg-sub">
            {reasonLabel(reason)}
          </span>
        ))}
      </div>
      {r.details.length > 0 && (
        <ul className="list-none m-0 mt-2 p-0 flex flex-col gap-1">
          {r.details.map((d, i) => (
            <li key={i} className="px-3 py-2 rounded-sm bg-field text-[13px] text-fg-sub whitespace-pre-wrap break-words">
              {d}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2 mt-3">
        {done ? (
          r.hidden &&
          r.canAct && (
            <button type="button" className={cn(ui.button, ui.ghost, ui.small)} disabled={action.isPending} onClick={() => run('unhide')}>
              숨김 풀기
            </button>
          )
        ) : (
          <>
            {r.canAct && (
              <>
                <button type="button" className={cn(ui.button, ui.secondary, ui.small)} disabled={action.isPending} onClick={() => run('hide')}>
                  숨기기
                </button>
                <button type="button" className={cn(ui.button, ui.small, 'bg-danger text-white hover:brightness-95')} disabled={action.isPending} onClick={() => run('delete')}>
                  지우기
                </button>
              </>
            )}
            <button type="button" className={cn(ui.button, ui.ghost, ui.small)} disabled={action.isPending} onClick={() => run('dismiss')}>
              문제 없음
            </button>
            {!r.canAct && <span className="self-center text-[13px] text-fg-weak">나보다 높은 운영진의 {what}이라 숨기거나 지울 수 없어요</span>}
          </>
        )}
      </div>
    </li>
  );
}

/** 채널 신고함 (운영진만): 처리 전 / 처리함 */
export default function ChannelReportsPage() {
  const { slug = '' } = useParams();
  const { data: channel, isPending, isPlaceholderData, isError } = useChannel(slug);
  const [tab, setTab] = useState<'open' | 'done'>('open');
  const reports = useChannelReports(slug, tab);

  if (isPending || isPlaceholderData) {
    return (
      <Page variant="single">
        <div className={ui.spinner} />
      </Page>
    );
  }
  if (isError || !channel.staff) return <Navigate to={`/c/${slug}`} replace />;

  return (
    <Page variant="single">
      <div className={cn(s.pageHead, 'items-center')}>
        <div className="flex items-center gap-3 min-w-0">
          <ChannelIcon channel={channel} size={44} />
          <h1 className={s.pageTitle}>{channel.name} 신고함</h1>
        </div>
        <Link to={`/c/${slug}`} className={ui.cardLink}>
          채널로 돌아가기 →
        </Link>
      </div>
      <section className={cn(ui.card, 'px-5 pt-2 pb-1')}>
        <div className={ui.tabs} role="tablist" aria-label="신고 상태">
          <button type="button" role="tab" className={ui.tab} aria-selected={tab === 'open'} onClick={() => setTab('open')}>
            처리 전{channel.reportCount ? ` ${channel.reportCount}` : ''}
          </button>
          <button type="button" role="tab" className={ui.tab} aria-selected={tab === 'done'} onClick={() => setTab('done')}>
            처리함
          </button>
        </div>
        {reports.isPending ? (
          <div className={ui.spinner} />
        ) : reports.isError ? (
          <p className={ui.empty}>{reports.error.message}</p>
        ) : reports.data.length === 0 ? (
          <p className={ui.empty}>{tab === 'open' ? '처리할 신고가 없어요' : '처리한 신고가 없어요'}</p>
        ) : (
          <ul className="list-none m-0 p-0">
            {reports.data.map((r) => (
              <ReportRow key={`${r.postId}-${r.commentId ?? ''}`} report={r} slug={slug} done={tab === 'done'} />
            ))}
          </ul>
        )}
      </section>
      <p className={cn(ui.help, 'px-1')}>
        숨기면 쓴 사람과 운영진에게만 보여요. 지우면 되돌릴 수 없어요. 숨기기 · 지우기는 나보다 아래 역할의 글 · 댓글만 할 수 있어요.
      </p>
    </Page>
  );
}

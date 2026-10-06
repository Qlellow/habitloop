import { useEffect, useState } from 'react';
import { useAuth, useMyInvite, usePointLogs, type PointLogFilter } from '@loop/shared';
import { CloseIcon } from '../../components/Icons';
import { toast } from '../../components/Toast';
import { ui } from '../../components/ui';
import s from './my.styles';
import { Modal } from '../../components/Modal';
import { cn } from '../../lib/cn';

/** 포인트 모으는 법 (API 의 RewardsService 와 같은 값) */
const POINT_RULES = [
  ['매일 출석', '+10P · 7일 연속마다 +50P'],
  ['글 쓰기', '+5P · 하루 5번까지'],
  ['내 글이 공감 받기', '공감 하나에 +2P'],
  ['친구 초대', '친구가 가입하면 +100P (친구도 +30P)'],
] as const;

const dateTime = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const ORDERS = [
  ['latest', '최신순'],
  ['oldest', '오래된순'],
] as const;
const TYPES = [
  [undefined, '전체'],
  ['earn', '적립'],
  ['spend', '사용'],
] as const;

/** 포인트 내역 팝업: 내용 · 포인트 · 날짜 표, 정렬(최신순/오래된순) · 종류(전체/적립/사용) 필터 */
function PointLogDialog({ onClose }: { onClose: () => void }) {
  const [filter, setFilter] = useState<PointLogFilter>({ order: 'latest' });
  const logs = usePointLogs(filter);
  const items = logs.data?.pages.flatMap((p) => p.items) ?? [];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <Modal onClose={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="point-log-title"
        className="w-full max-w-[560px] h-[min(640px,85dvh)] flex flex-col rounded-xl border border-border bg-surface shadow-pop"
      >
        <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-3">
          <h2 id="point-log-title" className="m-0 text-lg font-bold text-fg-strong">
            포인트 내역
          </h2>
          <button type="button" className={cn(ui.button, ui.text, ui.small, 'w-8 px-0')} aria-label="닫기" onClick={onClose}>
            <CloseIcon width={18} height={18} />
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 pb-3">
          <div className={ui.chips} role="group" aria-label="종류">
            {TYPES.map(([type, label]) => (
              <button
                key={label}
                type="button"
                className={ui.chip}
                aria-pressed={filter.type === type}
                onClick={() => setFilter((f) => ({ ...f, type }))}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={ui.chips} role="group" aria-label="정렬">
            {ORDERS.map(([order, label]) => (
              <button
                key={order}
                type="button"
                className={ui.chip}
                aria-pressed={filter.order === order}
                onClick={() => setFilter((f) => ({ ...f, order }))}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {logs.isPending ? (
            <div className={ui.spinner} />
          ) : items.length === 0 ? (
            <p className={cn(ui.empty, 'py-8')}>{filter.type === 'earn' ? '적립한 포인트가 없어요' : filter.type === 'spend' ? '사용한 포인트가 없어요' : '아직 포인트 내역이 없어요'}</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="text-left text-[13px] text-fg-weak [&>th]:font-semibold [&>th]:py-2 border-b border-border">
                  <th className="w-full">내용</th>
                  <th className="text-right pr-5">포인트</th>
                  <th className="text-right">날짜</th>
                </tr>
              </thead>
              <tbody>
                {items.map((l) => (
                  <tr key={l.id} className="border-b border-line last:border-b-0 [&>td]:py-2.5">
                    <td className="text-fg pr-4">{l.reason}</td>
                    <td className={cn('text-right pr-5 font-bold tabular-nums whitespace-nowrap', l.delta < 0 ? 'text-danger-text' : 'text-primary')}>
                      {l.delta > 0 ? '+' : ''}
                      {l.delta.toLocaleString()}P
                    </td>
                    <td className="text-right text-fg-weak tabular-nums whitespace-nowrap">{dateTime(l.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {logs.hasNextPage && (
            <button
              type="button"
              className={cn(ui.button, ui.ghost, ui.full, 'mt-3')}
              disabled={logs.isFetchingNextPage}
              onClick={() => logs.fetchNextPage()}
            >
              {logs.isFetchingNextPage ? '불러오는 중…' : '더 보기'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** 마이페이지 · 포인트: 가진 포인트 · 내역 · 모으는 법 · 친구 초대 (커스텀 배너 열기는 내 정보 수정에) */
export default function PointsPage() {
  const { user } = useAuth();
  const invite = useMyInvite();
  const [showLogs, setShowLogs] = useState(false);
  if (!user) return null;
  const link = invite.data ? `${location.origin}/signup?ref=${invite.data.code}` : '';
  const copy = () =>
    navigator.clipboard.writeText(link).then(
      () => toast('초대 링크를 복사했어요'),
      () => toast('복사하지 못했어요. 직접 선택해서 복사해 주세요'),
    );

  return (
    <>
      <div className={s.head}>
        <h1 className={s.title}>포인트</h1>
      </div>
      <section className={cn(ui.card, s.section, 'flex items-center justify-between gap-4')}>
        <div>
          <div className="text-[13px] font-semibold text-fg-sub">가진 포인트</div>
          <div className="mt-0.5 text-[28px] font-extrabold text-primary tabular-nums">{(user.points ?? 0).toLocaleString()}P</div>
        </div>
        <button type="button" className={cn(ui.button, ui.secondary)} onClick={() => setShowLogs(true)}>
          포인트 내역
        </button>
      </section>
      <section className={cn(ui.card, s.section)}>
        <h2 className={s.sectionTitle}>포인트 모으기</h2>
        <p className={s.sectionDesc}>모은 포인트로 커스텀 배너 같은 꾸미기를 열 수 있어요. (내 정보 수정 → 배너)</p>
        <ul className="list-none m-0 p-0 grid grid-cols-2 gap-2 max-[520px]:grid-cols-1">
          {POINT_RULES.map(([what, how]) => (
            <li key={what} className="rounded-md bg-field px-3 py-2.5">
              <div className="text-[13px] font-semibold text-fg-strong">{what}</div>
              <div className="text-[13px] text-primary font-semibold mt-0.5">{how}</div>
            </li>
          ))}
        </ul>
      </section>
      <section className={cn(ui.card, s.section)}>
        <h2 className={s.sectionTitle}>친구 초대</h2>
        <p className={s.sectionDesc}>내 초대 링크로 친구가 가입하면 나는 +100P, 친구는 +30P 를 받아요.</p>
        <div className="flex items-center gap-2">
          <input
            id="invite-link"
            className={cn(ui.input, 'flex-1 min-w-0')}
            readOnly
            value={link}
            aria-label="내 초대 링크"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button type="button" className={cn(ui.button, ui.secondary, ui.small)} onClick={copy} disabled={!link}>
            복사
          </button>
        </div>
        {invite.data && <p className={ui.help}>지금까지 {invite.data.invitedCount.toLocaleString()}명을 초대했어요.</p>}
      </section>
      {showLogs && <PointLogDialog onClose={() => setShowLogs(false)} />}
    </>
  );
}

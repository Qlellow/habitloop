import { useEffect, useState } from 'react';
import { REPORT_REASONS, useReport, type ReportReason } from '@loop/shared';
import { CloseIcon } from './Icons';
import { Modal } from './Modal';
import { toast } from './Toast';
import { ui } from './ui';
import { cn } from '../lib/cn';

/** 글 · 댓글 신고 팝업: 사유 하나 고르기 + 자세한 내용(선택). 신고는 그 채널 운영진의 신고함으로 간다 */
export function ReportDialog({ postId, commentId, onClose }: { postId: number; commentId?: number; onClose: () => void }) {
  const [reason, setReason] = useState<ReportReason>();
  const [detail, setDetail] = useState('');
  const report = useReport();
  const what = commentId ? '댓글' : '글';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = () => {
    if (!reason) return;
    report.mutate(
      { postId, commentId, reason, detail },
      {
        onSuccess: () => {
          toast(`${what}을 신고했어요. 채널 운영진이 확인할 거예요`);
          onClose();
        },
        onError: (e) => toast(e.message),
      },
    );
  };

  return (
    <Modal onClose={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="report-title" className="w-full max-w-[420px] rounded-xl border border-border bg-surface shadow-pop">
        <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-1">
          <h2 id="report-title" className="m-0 text-lg font-bold text-fg-strong">
            {what} 신고
          </h2>
          <button type="button" className={cn(ui.button, ui.text, ui.small, 'w-8 px-0')} aria-label="닫기" onClick={onClose}>
            <CloseIcon width={18} height={18} />
          </button>
        </div>
        <p className="m-0 px-6 text-sm text-fg-sub">신고는 이 채널 운영진에게만 보이고, 누가 신고했는지는 알리지 않아요.</p>
        <div role="radiogroup" aria-label="신고 사유" className="flex flex-col gap-1 px-4 pt-4">
          {REPORT_REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={reason === r.value}
              onClick={() => setReason(r.value)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-sm text-left text-[15px] text-fg transition-colors hover:bg-field',
                reason === r.value && 'bg-primary-weak text-primary font-semibold hover:bg-primary-weak',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'flex-none grid place-items-center w-[18px] h-[18px] rounded-full border-2 transition-colors',
                  reason === r.value ? 'border-primary' : 'border-border',
                )}
              >
                {reason === r.value && <span className="w-2 h-2 rounded-full bg-primary" />}
              </span>
              {r.label}
            </button>
          ))}
        </div>
        <div className="px-6 pt-3">
          <textarea
            className={cn(ui.textarea, 'min-h-[84px]')}
            placeholder="자세한 내용 (선택)"
            aria-label="자세한 내용"
            maxLength={300}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
          />
        </div>
        <div className="flex gap-2 px-6 pt-4 pb-6">
          <button type="button" className={cn(ui.button, ui.secondary, 'flex-1')} onClick={onClose}>
            취소
          </button>
          <button type="button" className={cn(ui.button, 'flex-1 bg-danger text-white hover:brightness-95')} disabled={!reason || report.isPending} onClick={submit}>
            {report.isPending ? '신고하는 중…' : '신고하기'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

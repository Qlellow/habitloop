import { useEffect, useRef, useState } from 'react';
import { useSignOut } from '@loop/shared';
import { Modal } from './Modal';
import { ui } from './ui';
import { cn } from '../lib/cn';

/** 한 번 더 확인하는 작은 창 (로그아웃 등). Esc · 바깥을 누르면 닫힌다 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '확인',
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    confirmRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <Modal onClose={onClose}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-[360px] p-6 rounded-xl border border-border bg-surface shadow-pop">
        <h2 id="confirm-title" className="m-0 text-lg font-bold text-fg-strong">
          {title}
        </h2>
        {message && <p className="mt-2 mb-0 text-[15px] text-fg-sub">{message}</p>}
        <div className="flex gap-2 mt-6">
          <button type="button" className={cn(ui.button, ui.ghost, 'flex-1')} onClick={onClose}>
            취소
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={cn(ui.button, danger ? 'bg-danger text-white hover:brightness-95' : ui.primary, 'flex-1')}
            onClick={() => {
              onClose();
              onConfirm();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** 로그아웃 버튼: 누르면 확인 창을 띄우고, 확인하면 로그아웃한 뒤 after 를 부른다 */
export function useConfirmSignOut(after?: () => void) {
  const signOut = useSignOut();
  const [open, setOpen] = useState(false);
  return {
    ask: () => setOpen(true),
    dialog: (
      <ConfirmDialog
        open={open}
        title="로그아웃할까요?"
        message="이 기기에서 로그아웃해요. 다시 글을 쓰거나 댓글을 남기려면 로그인해야 해요."
        confirmLabel="로그아웃"
        danger
        onConfirm={() => {
          signOut();
          after?.();
        }}
        onClose={() => setOpen(false)}
      />
    ),
  };
}

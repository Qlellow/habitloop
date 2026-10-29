import { useSyncExternalStore } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * 어디서나 부르는 확인 창: `if (!(await ask('글을 삭제할까요?', { danger: true }))) return;`
 * 브라우저 기본 confirm() 대신 사이트와 같은 모양의 창을 띄운다 (화면에는 ConfirmHost 하나만 둔다)
 */
interface AskOptions {
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}
interface Pending extends AskOptions {
  title: string;
  resolve: (ok: boolean) => void;
}

let pending: Pending | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function ask(title: string, options: AskOptions = {}): Promise<boolean> {
  // 이미 떠 있는 창이 있으면 취소로 닫고 새 창을 띄운다
  pending?.resolve(false);
  return new Promise((resolve) => {
    pending = { title, ...options, resolve };
    notify();
  });
}

function settle(ok: boolean) {
  if (!pending) return;
  const { resolve } = pending;
  pending = null;
  notify();
  resolve(ok);
}

export function ConfirmHost() {
  const p = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => pending,
  );
  return (
    <ConfirmDialog
      open={!!p}
      title={p?.title ?? ''}
      message={p?.message}
      confirmLabel={p?.confirmLabel}
      danger={p?.danger}
      onConfirm={() => settle(true)}
      onClose={() => settle(false)}
    />
  );
}

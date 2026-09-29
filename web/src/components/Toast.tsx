import { useSyncExternalStore } from 'react';
import s from './Layout.styles';

let message: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function toast(text: string) {
  message = text;
  clearTimeout(timer);
  timer = setTimeout(() => {
    message = null;
    notify();
  }, 2200);
  notify();
}

export function Toaster() {
  const text = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => message,
  );
  return text ? (
    <div className={s.toast} role="status" key={text}>
      {text}
    </div>
  ) : null;
}

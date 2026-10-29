import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/cn';

const EXIT_MS = 180;
/** StrictMode 처럼 같은 DOM 으로 다시 붙는 경우 사라지는 복제본을 바로 거둔다 */
const ghosts = new WeakMap<Element, HTMLElement>();

/** 팝업에서 Esc 를 누르면 닫는다 (팝업마다 한 번) */
export function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
}

/** 열린 팝업들 (나중에 연 것이 위). Tab 가두기는 맨 위 팝업만 한다 */
const stack: HTMLElement[] = [];

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 키보드 사용자를 위한 포커스: 열리면 팝업 안으로 옮기고, Tab 은 팝업 안에서만 돌고, 닫히면 연 자리(버튼)로 돌려준다
 */
function useFocusInside(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const opener = document.activeElement as HTMLElement | null;
    // 안의 컴포넌트가 이미 포커스를 정했으면(autoFocus 등) 그대로 둔다
    if (!node.contains(document.activeElement)) {
      const first = node.querySelector<HTMLElement>(FOCUSABLE);
      const dialog = node.querySelector<HTMLElement>('[role="dialog"], [role="alertdialog"]');
      if (first) first.focus({ preventScroll: true });
      else if (dialog) {
        dialog.tabIndex = -1;
        dialog.focus({ preventScroll: true });
      }
    }
    stack.push(node);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || stack[stack.length - 1] !== node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !node.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(node), 1);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [ref]);
}

/**
 * 팝업 바탕(백드롭) + 내용. 열릴 때 백드롭과 내용이 함께 fade-in 되고,
 * 닫힐 때(부모가 이 컴포넌트를 없애는 순간) 마지막 모습을 복제해 fade-out 시킨 뒤 지운다.
 * 그래서 쓰는 쪽은 {open && <Modal …/>} 처럼 평소대로 렌더링만 하면 된다.
 */
export function Modal({ onClose, children, className }: { onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusInside(ref);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    ghosts.get(node)?.remove();
    ghosts.delete(node);
    return () => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const ghost = node.cloneNode(true) as HTMLElement;
      ghost.classList.add('modal-exit');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.removeAttribute('id');
      document.body.appendChild(ghost);
      ghosts.set(node, ghost);
      const remove = () => {
        ghost.remove();
        if (ghosts.get(node) === ghost) ghosts.delete(node);
      };
      ghost.addEventListener('animationend', (e) => e.target === ghost && remove());
      setTimeout(remove, EXIT_MS + 120);
    };
  }, []);

  return createPortal(
    <div
      ref={ref}
      className={cn('modal-backdrop fixed inset-0 z-50 grid place-items-center p-4 bg-black/50', className)}
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      {children}
    </div>,
    document.body,
  );
}

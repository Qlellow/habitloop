import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/cn';

const EXIT_MS = 180;
/** StrictMode 처럼 같은 DOM 으로 다시 붙는 경우 사라지는 복제본을 바로 거둔다 */
const ghosts = new WeakMap<Element, HTMLElement>();

/**
 * 팝업 바탕(백드롭) + 내용. 열릴 때 백드롭과 내용이 함께 fade-in 되고,
 * 닫힐 때(부모가 이 컴포넌트를 없애는 순간) 마지막 모습을 복제해 fade-out 시킨 뒤 지운다.
 * 그래서 쓰는 쪽은 {open && <Modal …/>} 처럼 평소대로 렌더링만 하면 된다.
 */
export function Modal({ onClose, children, className }: { onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

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

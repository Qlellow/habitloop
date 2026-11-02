import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from './Icons';

/**
 * 글 이미지 크게 보기 (여러 장이면 넘겨 보기): ← → · 스와이프 · 아래 썸네일 · Esc 로 닫기.
 * 본문(Markdown)에서 이미지를 누르면 그 글의 모든 이미지를 이 순서로 연다
 */
export interface ViewerImage {
  src: string;
  alt: string;
}

export function ImageViewer({ images, start, onClose }: { images: ViewerImage[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const swipe = useRef<number>(undefined);
  const closeRef = useRef<HTMLButtonElement>(null);
  const many = images.length > 1;
  const go = (d: number) => setI((n) => (n + d + images.length) % images.length);

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && many) go(-1);
      else if (e.key === 'ArrowRight' && many) go(1);
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prevFocus?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const img = images[i];
  return createPortal(
    <div
      className="image-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={`이미지 ${i + 1} / ${images.length}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onPointerDown={(e) => (swipe.current = e.clientX)}
      onPointerUp={(e) => {
        const dx = e.clientX - (swipe.current ?? e.clientX);
        swipe.current = undefined;
        if (many && Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="image-viewer-top">
        {many && (
          <span className="tabular-nums" aria-live="polite">
            {i + 1} / {images.length}
          </span>
        )}
        <a href={img.src} target="_blank" rel="noopener noreferrer" className="ml-auto">
          원본
        </a>
        <button ref={closeRef} type="button" aria-label="닫기" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <figure className="image-viewer-stage" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <img key={img.src} src={img.src} alt={img.alt} draggable={false} />
        {img.alt && <figcaption>{img.alt}</figcaption>}
      </figure>
      {many && (
        <>
          <button type="button" className="image-viewer-nav is-prev" aria-label="이전 이미지" onClick={() => go(-1)}>
            <ChevronLeftIcon />
          </button>
          <button type="button" className="image-viewer-nav is-next" aria-label="다음 이미지" onClick={() => go(1)}>
            <ChevronRightIcon />
          </button>
          <div className="image-viewer-thumbs">
            {images.map((im, n) => (
              <button key={n} type="button" aria-label={`${n + 1}번째 이미지`} aria-current={n === i || undefined} onClick={() => setI(n)}>
                <img src={im.src} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}

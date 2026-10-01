import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from './Icons';
import { scrollToElement } from '../lib/scroll';

/** 이 높이(px)를 넘는 본문은 접어서 COLLAPSED 만큼만 보여 준다 (조금만 넘는 글까지 접지 않도록 둘을 나눈다) */
const LIMIT = 900;
const COLLAPSED = 640;

// 채널 소개(ChannelIntro)의 더 보기와 같은 모양: 버튼처럼 보이지 않게 그라데이션 위에 회색 글자만
const s = {
  wrap: 'relative overflow-hidden transition-[max-height] duration-500 ease-in-out',
  fade:
    'absolute inset-x-0 bottom-0 flex items-end justify-center h-32 pb-0.5 ' +
    'bg-gradient-to-b from-transparent via-[color-mix(in_srgb,var(--surface)_70%,transparent)] to-surface',
  toggle:
    'inline-flex items-center gap-1 px-2 py-1.5 text-sm font-semibold text-fg-weak transition-colors hover:text-fg-sub ' +
    '[&>svg]:w-4 [&>svg]:h-4',
  collapseRow: 'flex justify-center pt-2',
};

/**
 * 긴 본문 접기: 너무 길면 아래쪽을 그라데이션으로 가리고 '더 보기'를 띄운다.
 * - 더 보기: 부드럽게 펼쳐진다 / 숨기기: 접으면서 본문 처음이 보이도록 부드럽게 올라간다
 * 이미지가 늦게 불러와져 높이가 바뀌어도 다시 잰다 (ResizeObserver).
 */
export function CollapsibleBody({ children }: { children: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(0);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    const measure = () => setFull(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const collapsible = full > LIMIT;
  const collapse = () => {
    setOpen(false);
    if (wrap.current) scrollToElement(wrap.current);
  };

  return (
    <div
      ref={wrap}
      id="post-body"
      className={s.wrap}
      // 펼칠 때는 숨기기 줄(약 44px)까지 들어가게
      style={collapsible ? { maxHeight: open ? full + 56 : COLLAPSED } : undefined}
    >
      <div ref={body}>{children}</div>
      {collapsible &&
        (open ? (
          <div className={s.collapseRow}>
            <button type="button" className={s.toggle} onClick={collapse} aria-expanded aria-controls="post-body">
              <ChevronUpIcon />
              숨기기
            </button>
          </div>
        ) : (
          <div className={s.fade}>
            <button type="button" className={s.toggle} onClick={() => setOpen(true)} aria-expanded={false} aria-controls="post-body">
              <ChevronDownIcon />
              더 보기
            </button>
          </div>
        ))}
    </div>
  );
}

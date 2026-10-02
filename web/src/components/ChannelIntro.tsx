import { lazy, Suspense, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { plainText } from '@loop/shared';
import { ChevronDownIcon, ChevronUpIcon } from './Icons';
import { scrollToElement } from '../lib/scroll';
import { cn } from '../lib/cn';

// 마크다운 파서는 소개가 있는 채널에서만 받는다
const Markdown = lazy(() => import('./Markdown').then((m) => ({ default: m.Markdown })));

/** 채널 헤더(아이콘·이름·소개)가 이보다 길어지면 소개를 접는다 */
const HEADER_MAX = 200;
/** 접었을 때도 소개가 최소 이만큼은 보이게 */
const MIN_VISIBLE = 48;

const s = {
  wrap: 'relative mt-5 overflow-hidden transition-[max-height] duration-500 ease-in-out',
  body: 'text-[15px] leading-[1.7] text-fg-sub [&>:first-child]:mt-0 [&>:last-child]:mb-0',
  // 버튼처럼 보이지 않게: 테두리·배경 없이 그라데이션 위에 회색 글자만
  fade:
    'absolute inset-x-0 bottom-0 flex items-end justify-center h-24 pb-0.5 ' +
    'bg-gradient-to-b from-transparent via-[color-mix(in_srgb,var(--surface)_70%,transparent)] to-surface',
  toggle:
    'inline-flex items-center gap-1 px-2 py-1.5 text-sm font-semibold text-fg-weak transition-colors hover:text-fg-sub ' +
    '[&>svg]:w-4 [&>svg]:h-4',
  collapseRow: 'flex justify-center pt-2',
};

/**
 * 채널 소개 (마크다운).
 * 헤더 전체가 200px 을 넘으면 소개 아래쪽을 그라데이션으로 가리고 '더 보기'를 띄운다.
 * - 더 보기: 펼치면서 소개 첫 줄이 화면 위쪽에 오도록 부드럽게 내려간다
 * - 숨기기: 접으면서 채널 헤더가 보이도록 부드럽게 올라간다
 */
export function ChannelIntro({
  source,
  headerRef,
}: {
  source: string;
  /** 숨기기를 누르면 여기로 올라간다 */
  headerRef: RefObject<HTMLElement | null>;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [limit, setLimit] = useState<number | null>(null); // null: 접을 필요 없음
  const [full, setFull] = useState(0);
  const [open, setOpen] = useState(false);

  // 소개 내용(마크다운 로딩, 이미지, 창 너비)에 따라 높이가 바뀌므로 계속 잰다
  useLayoutEffect(() => {
    // 높이를 재는 헤더 영역(아이콘·이름·소개) = 소개의 부모.
    // (부모의 ref 는 자식의 layout effect 보다 늦게 붙으므로 ref 대신 DOM 으로 찾는다)
    const banner = wrap.current?.parentElement;
    const measure = () => {
      if (!banner || !wrap.current || !body.current) return;
      const others = banner.offsetHeight - wrap.current.offsetHeight; // 헤더에서 소개를 뺀 높이 (접힘과 무관하게 일정)
      const height = body.current.offsetHeight;
      setFull(height);
      setLimit(others + height > HEADER_MAX ? Math.max(MIN_VISIBLE, HEADER_MAX - others) : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (body.current) ro.observe(body.current);
    // 패딩이 바뀌어도(카테고리 탭 유무) 다시 재도록 border-box 로 본다
    if (banner) ro.observe(banner, { box: 'border-box' });
    return () => ro.disconnect();
  }, []);

  const collapsible = limit !== null;
  const expand = () => {
    setOpen(true);
    if (wrap.current) scrollToElement(wrap.current);
  };
  const collapse = () => {
    setOpen(false);
    if (headerRef.current) scrollToElement(headerRef.current);
  };

  return (
    <div
      ref={wrap}
      id="channel-intro"
      className={s.wrap}
      // 펼칠 때는 숨기기 줄(약 44px)까지 들어가게
      style={collapsible ? { maxHeight: open ? full + 56 : limit } : undefined}
    >
      <div ref={body}>
        <Suspense fallback={<p className={cn(s.body, 'm-0')}>{plainText(source)}</p>}>
          <Markdown source={source} className={s.body} />
        </Suspense>
      </div>
      {collapsible &&
        (open ? (
          <div className={s.collapseRow}>
            <button type="button" className={s.toggle} onClick={collapse} aria-expanded aria-controls="channel-intro">
              <ChevronUpIcon />
              숨기기
            </button>
          </div>
        ) : (
          <div className={s.fade}>
            <button type="button" className={s.toggle} onClick={expand} aria-expanded={false} aria-controls="channel-intro">
              <ChevronDownIcon />
              더 보기
            </button>
          </div>
        ))}
    </div>
  );
}

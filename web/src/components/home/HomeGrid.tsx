import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { HomeLayout, HomeWidget } from '@loop/shared';
import { WIDGET, optionsOf, type Options } from './widgets';
import { GAP, ROW, rowsPx, shrinkLayout, stackOrder } from '../../lib/homeGrid';
import { ui } from '../ui';
import { cn } from '../../lib/cn';

/** 위젯 모양 (설정 › 모양) */
const STYLE: Record<string, string> = {
  card: 'bg-surface border border-border rounded-lg',
  plain: 'bg-transparent border border-transparent rounded-lg',
  tint: 'bg-primary-weak border border-transparent rounded-lg',
  glass: 'home-glass rounded-lg',
};

/**
 * 미리보기 위젯은 안에서 스크롤하지 않고 넘치는 부분을 자른다.
 * 이때 반쯤 잘린 항목이 남지 않게, 칸 아래로 삐져나가는 목록 항목(li)은 통째로 숨긴다
 */
function useClipPartial(on: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = ref.current;
    if (!on || !box) return;
    let frame = 0;
    const clip = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bottom = box.getBoundingClientRect().bottom + 1;
        for (const li of box.querySelectorAll('li')) {
          li.style.visibility = '';
          if (li.getBoundingClientRect().bottom > bottom) li.style.visibility = 'hidden';
        }
      });
    };
    clip();
    const ro = new ResizeObserver(clip);
    ro.observe(box);
    const mo = new MutationObserver(clip);
    mo.observe(box, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      mo.disconnect();
      for (const li of box.querySelectorAll('li')) li.style.visibility = '';
    };
  }, [on]);
  return ref;
}

/** 위젯 하나의 틀: 제목 줄(+ 더 보기) · 내용. 정한 높이에 맞출 때는 내용이 안에서 스크롤된다 (미리보기 위젯은 잘린다) */
export function WidgetFrame({
  widget,
  o,
  editing = false,
  scroll,
  setOption,
  style,
  className,
  children,
  ref,
}: {
  widget: HomeWidget;
  o: Options;
  editing?: boolean;
  /** 내용을 정한 높이 안에서 스크롤 (아니면 내용만큼 늘어난다) */
  scroll: boolean;
  setOption: (key: string, value: string | number | boolean) => void;
  style?: CSSProperties;
  className?: string;
  children?: ReactNode;
  ref?: (el: HTMLElement | null) => void;
}) {
  const def = WIDGET[widget.type];
  const title = (o.title as string) || def.title(o);
  const more = def.more?.(o);
  const Body = def.Body;
  // 정한 높이에 맞추는 위젯: 보통은 안에서 스크롤, 미리보기 위젯은 들어가는 만큼만
  const clipped = scroll && !!def.preview;
  const bodyRef = useClipPartial(clipped);
  return (
    <section
      className={cn('home-widget flex flex-col min-w-0 overflow-hidden', STYLE[o.style as string] ?? STYLE.card, className)}
      style={style}
      ref={ref}
      aria-label={title || def.label}
      data-widget={widget.type}
      data-id={widget.id}
    >
      {title && !o.hideTitle && (
        <div className={cn(ui.cardHead, 'flex-none')}>
          <h2 className={cn(ui.sectionTitle, 'text-base truncate')}>{title}</h2>
          {more && !editing && (
            <Link to={more} className={cn(ui.cardLink, 'flex-none text-[13px]')}>
              더 보기
            </Link>
          )}
        </div>
      )}
      <div
        ref={bodyRef}
        className={cn('flex-1 min-h-0', clipped ? 'overflow-hidden' : scroll && 'overflow-y-auto overscroll-contain', !title || o.hideTitle ? 'pt-3' : '')}
      >
        <Body widget={widget} o={o} setOption={setOption} editing={editing} />
      </div>
      {children}
    </section>
  );
}

const SUB = 8;
const PER = (ROW + GAP) / SUB;

/**
 * 미리보기 위젯의 실제 높이를 재서 (8px) 줄 수로 바꾼다 (ResizeObserver).
 * 위젯의 높이는 내용으로만 정해지고 격자 위치와는 상관없어서, 다시 놓아도 또 바뀌지 않는다
 */
function usePreviewRows() {
  const [rows, setRows] = useState<Record<string, number>>({});
  const nodes = useRef(new Map<string, Element>());
  const ro = useMemo(
    () =>
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver((entries) =>
            setRows((prev) => {
              let next = prev;
              for (const e of entries) {
                const id = (e.target as HTMLElement).dataset.id!;
                const px = e.target.getBoundingClientRect().height;
                const n = Math.max(1, Math.ceil((px - 0.5) / SUB));
                if (next[id] !== n) next = { ...next, [id]: n };
              }
              return next;
            }),
          ),
    [],
  );
  useEffect(() => () => ro?.disconnect(), [ro]);
  const refs = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const observe = (id: string) => {
    let fn = refs.current.get(id);
    if (!fn) {
      fn = (el) => {
        const old = nodes.current.get(id);
        if (old) ro?.unobserve(old);
        nodes.current.delete(id);
        if (el) {
          nodes.current.set(id, el);
          ro?.observe(el);
        } else {
          setRows(({ [id]: _, ...rest }) => rest);
        }
      };
      refs.current.set(id, fn);
    }
    return fn;
  };
  return { rows, observe };
}

/** 이 위젯 아래(가로로 겹치는 칸)에 다른 위젯이 없는지: 그래야 '따라오기'가 다른 위젯을 덮지 않는다 */
const nothingBelow = (w: HomeWidget, all: HomeWidget[]) =>
  !all.some((o) => o.id !== w.id && o.y >= w.y + w.h && o.x < w.x + w.w && w.x < o.x + o.w);

/**
 * 보기 모드: CSS 격자(12칸)에 위젯을 칸 위치대로 놓는다.
 * '내용만큼 늘리기' 위젯은 줄이 늘어나 아래 위젯을 밀어낸다 (글 목록의 무한 스크롤). 좁은 화면에서는 한 줄로 쌓는다.
 */
export const HomeGrid = memo(function HomeGrid({
  layout,
  onOption,
}: {
  layout: HomeLayout;
  onOption: (id: string, key: string, value: string | number | boolean) => void;
}) {
  const order = new Map(stackOrder(layout.widgets).map((w, i) => [w.id, i]));
  // 미리보기 위젯은 정한 높이가 '최대'일 뿐: 내용이 적으면 그만큼 줄어들고, 줄어든 만큼 아래 위젯을 끌어올린다
  const isPreview = (w: HomeWidget) => !optionsOf(w).fit && !!WIDGET[w.type].preview;
  const need = usePreviewRows();
  // 보기 화면의 격자는 8px 줄(SUB) 단위: 한 줄(ROW+GAP)이 PER 줄. 줄어든 높이를 px 가까이 맞춰 빈틈이 남지 않게
  const shown = useMemo(() => {
    const fine = layout.widgets.map((w) => ({ ...w, y: w.y * PER, h: w.h * PER - GAP / SUB }));
    const placed = new Map(shrinkLayout(fine, need.rows).map((w) => [w.id, w]));
    return fine.map((w) => placed.get(w.id) ?? w);
  }, [layout.widgets, need.rows]);
  return (
    <div className="home-grid">
      {shown.map((w, i) => {
        const o = optionsOf(w);
        const sticky = o.sticky && !o.fit && nothingBelow(w, shown);
        const preview = isPreview(layout.widgets[i]);
        // 정한 높이 (미리보기 위젯은 최대 높이)
        const maxRows = layout.widgets[i].h;
        return (
          <WidgetFrame
            key={w.id}
            ref={preview ? need.observe(w.id) : undefined}
            widget={w}
            o={o}
            scroll={!o.fit}
            setOption={(k, v) => onOption(w.id, k, v)}
            className={cn(!!o.hideMobile && 'home-hide-mobile', !!sticky && 'home-sticky')}
            style={{
              gridColumn: `${w.x + 1} / span ${w.w}`,
              gridRow: `${w.y + 1} / span ${w.h}`,
              minHeight: preview ? undefined : rowsPx(maxRows),
              height: o.fit || preview ? undefined : rowsPx(maxRows),
              maxHeight: preview ? rowsPx(maxRows) : undefined,
              order: order.get(w.id),
            }}
          />
        );
      })}
    </div>
  );
});

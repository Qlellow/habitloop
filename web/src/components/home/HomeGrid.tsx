import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { HomeLayout, HomeWidget } from '@loop/shared';
import { WIDGET, isAutoHeight, optionsOf, type Options } from './widgets';
import { GAP, ROW, followGroups, reflowLayout, rowsPx, stackOrder } from '../../lib/homeGrid';
import { useFollowScroll } from '../Layout';
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
  // 정한 높이에 맞추는 위젯: 보통은 안에서 스크롤, 미리보기 위젯은 들어가는 만큼만 (높이 반응형이면 잘릴 일이 없다)
  const auto = isAutoHeight(widget, o);
  const clipped = scroll && !!def.preview && !auto;
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
        className={cn('flex-1 min-h-0', clipped ? 'overflow-hidden' : scroll && !auto && 'overflow-y-auto overscroll-contain', !title || o.hideTitle ? 'pt-3' : '')}
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
  const byId = new Map(layout.widgets.map((w) => [w.id, w]));
  // 높이 반응형 위젯은 높이 = 내용 (최소 크기는 지킨다): 실제 높이를 재서 아래 위젯을 그만큼 올리고 내린다
  const need = usePreviewRows();
  // 보기 화면의 격자는 8px 줄(SUB) 단위: 한 줄(ROW+GAP)이 PER 줄. 줄어든 높이를 px 가까이 맞춰 빈틈이 남지 않게
  const shown = useMemo(() => {
    const fine = layout.widgets.map((w) => ({ ...w, y: w.y * PER, h: w.h * PER - GAP / SUB }));
    const placed = new Map(reflowLayout(fine, need.rows).map((w) => [w.id, w]));
    return fine.map((w) => placed.get(w.id) ?? w);
  }, [layout.widgets, need.rows]);
  // 긴 글 목록 옆의 단은 묶어서 스크롤을 따라 내려온다 (다른 페이지의 사이드바처럼)
  const groups = useMemo(() => followGroups(shown, (w) => !!optionsOf(w).fit, GAP / SUB), [shown]);
  const grouped = new Set(groups.flatMap((g) => g.ids));
  const gridRef = useRef<HTMLDivElement>(null);
  useFollowScroll(() => gridRef.current?.querySelectorAll<HTMLElement>('.home-follow-inner') ?? []);
  // 격자 맨 아래 줄 (따라오는 위젯은 여기까지 칸을 늘려야 그 안에서 움직일 수 있다)
  const end = shown.reduce((n, w) => Math.max(n, w.y + w.h), 0) + 1;

  /** 위젯 하나. 묶음 안이면 묶음의 왼쪽 위를 (0, 0) 으로 */
  const widget = (w: (typeof shown)[number], at?: { x: number; y: number }) => {
    const o = optionsOf(w);
    const sticky = !at && o.sticky && !o.fit && nothingBelow(w, shown);
    const saved = byId.get(w.id)!;
    const auto = isAutoHeight(saved, o);
    return (
      <WidgetFrame
        key={w.id}
        ref={auto ? need.observe(w.id) : undefined}
        widget={w}
        o={o}
        scroll={!o.fit}
        setOption={(k, v) => onOption(w.id, k, v)}
        className={cn(!!o.hideMobile && 'home-hide-mobile', !!sticky && 'home-sticky')}
        style={{
          gridColumn: `${w.x - (at?.x ?? 0) + 1} / span ${w.w}`,
          // position: sticky 는 자기 칸(grid area) 안에서만 따라오므로, 따라오는 위젯은 칸을 격자 끝까지 (높이는 그대로)
          gridRow: sticky ? `${w.y + 1} / ${end}` : `${w.y - (at?.y ?? 0) + 1} / span ${w.h}`,
          // 정한 높이 (높이 반응형이면 내용만큼, 최소 크기보다 작아지지 않게)
          minHeight: rowsPx(auto ? WIDGET[w.type].min.h : saved.h),
          height: o.fit || auto ? undefined : rowsPx(saved.h),
          order: order.get(w.id),
        }}
      />
    );
  };

  return (
    <div className="home-grid" ref={gridRef}>
      {shown.filter((w) => !grouped.has(w.id)).map((w) => widget(w))}
      {groups.map((g) => (
        <div key={g.ids[0]} className="home-follow" style={{ gridColumn: `${g.x + 1} / span ${g.w}`, gridRow: `${g.y + 1} / ${g.stop + 1}` }}>
          <FollowStack cols={g.w}>{shown.filter((w) => g.ids.includes(w.id)).map((w) => widget(w, g))}</FollowStack>
        </div>
      ))}
    </div>
  );
});

/**
 * 따라오는 묶음: 화면 위쪽(헤더 아래)에 붙는다. 묶음이 화면보다 길면 아래 끝이 보일 때까지 올라간 뒤 붙는다
 */
function FollowStack({ cols, children }: { cols: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState<number>();
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const fit = () => {
      const header = el.ownerDocument.documentElement;
      const base = parseFloat(getComputedStyle(header).getPropertyValue('--header-h')) || 64;
      setTop(Math.min(base + 40, window.innerHeight - el.offsetHeight - 16));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener('resize', fit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, []);
  return (
    <div ref={ref} className="home-follow-inner" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, top }}>
      {children}
    </div>
  );
}

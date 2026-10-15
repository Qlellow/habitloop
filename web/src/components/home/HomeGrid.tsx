import { memo, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { HomeLayout, HomeWidget } from '@loop/shared';
import { WIDGET, optionsOf, type Options } from './widgets';
import { rowsPx, stackOrder } from '../../lib/homeGrid';
import { ui } from '../ui';
import { cn } from '../../lib/cn';

/** 위젯 모양 (설정 › 모양) */
const STYLE: Record<string, string> = {
  card: 'bg-surface border border-border rounded-lg',
  plain: 'bg-transparent border border-transparent rounded-lg',
  tint: 'bg-primary-weak border border-transparent rounded-lg',
  glass: 'home-glass rounded-lg',
};

/** 위젯 하나의 틀: 제목 줄(+ 더 보기) · 내용. 정한 높이에 맞출 때는 내용이 안에서 스크롤된다 */
export function WidgetFrame({
  widget,
  o,
  editing = false,
  scroll,
  setOption,
  style,
  className,
  children,
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
}) {
  const def = WIDGET[widget.type];
  const title = (o.title as string) || def.title(o);
  const more = def.more?.(o);
  const Body = def.Body;
  return (
    <section
      className={cn('home-widget flex flex-col min-w-0 overflow-hidden', STYLE[o.style as string] ?? STYLE.card, className)}
      style={style}
      aria-label={title || def.label}
      data-widget={widget.type}
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
      <div className={cn('flex-1 min-h-0', scroll && 'overflow-y-auto overscroll-contain', !title || o.hideTitle ? 'pt-3' : '')}>
        <Body widget={widget} o={o} setOption={setOption} editing={editing} />
      </div>
      {children}
    </section>
  );
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
  return (
    <div className="home-grid">
      {layout.widgets.map((w) => {
        const o = optionsOf(w);
        const sticky = o.sticky && !o.fit && nothingBelow(w, layout.widgets);
        return (
          <WidgetFrame
            key={w.id}
            widget={w}
            o={o}
            scroll={!o.fit}
            setOption={(k, v) => onOption(w.id, k, v)}
            className={cn(!!o.hideMobile && 'home-hide-mobile', !!sticky && 'home-sticky')}
            style={{
              gridColumn: `${w.x + 1} / span ${w.w}`,
              gridRow: `${w.y + 1} / span ${w.h}`,
              minHeight: rowsPx(w.h),
              height: o.fit ? undefined : rowsPx(w.h),
              order: order.get(w.id),
            }}
          />
        );
      })}
    </div>
  );
});

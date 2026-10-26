import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useAuth, useChannels, useMyChannels, type HomeLayout, type HomeWidget, type HomeWidgetType } from '@loop/shared';
import { COMMON, WIDGET, WIDGETS, compactOptions, optionsOf, type OptionDef, type Options } from './widgets';
import { WidgetFrame } from './HomeGrid';
import { TEMPLATES, fromTemplate, type Template, type TemplateCtx } from '../../lib/homeLayout';
import { COLS, GAP, MAX_WIDGETS, ROW, addWidget, newId, place, removeWidget, rowsOf, rowsPx, setCompact, type Box } from '../../lib/homeGrid';
import { CloseIcon } from '../Icons';
import { toast } from '../Toast';
import { ui } from '../ui';
import { cn } from '../../lib/cn';

/**
 * 나만의 홈 편집 모드.
 *  - 위젯을 끌어 옮기고(다른 위젯은 비켜 준다), 왼쪽 · 오른쪽 · 아래 · 모서리를 끌어 크기를 바꾼다
 *  - 키보드: 위젯에 초점을 두고 방향키로 옮기기, Shift+방향키로 크기, Delete 로 빼기, Enter 로 설정
 *  - 위로 붙이기를 끄면 빈칸을 남기고 원하는 곳 어디에나 둘 수 있다
 *  - 되돌리기 · 다시 하기 (Ctrl+Z · Ctrl+Shift+Z), 템플릿, 위젯마다 설정
 * 화면 폭이 넓은(860px 이상) 곳에서만 연다.
 */

type Mode = 'move' | 'e' | 'w' | 's' | 'se' | 'sw';
type Panel = 'add' | 'templates' | 'settings' | null;

interface Drag {
  id: string;
  mode: Mode;
  /** 시작할 때 포인터 (페이지 좌표) */
  px: number;
  py: number;
  /** 시작할 때 위젯 칸과 px 위치 */
  start: HomeWidget;
  left: number;
  top: number;
  width: number;
  height: number;
  base: HomeLayout;
}

const steps = (cw: number) => {
  const col = (cw - GAP * (COLS - 1)) / COLS;
  return { col, colStep: col + GAP, rowStep: ROW + GAP };
};

const pxBox = (b: Box, cw: number) => {
  const { col, colStep, rowStep } = steps(cw);
  return { left: b.x * colStep, top: b.y * rowStep, width: b.w * col + (b.w - 1) * GAP, height: rowsPx(b.h) };
};

const same = (a: HomeLayout, b: HomeLayout) => JSON.stringify(a) === JSON.stringify(b);

export function HomeEditor({
  initial,
  ctx,
  onCancel,
  onSave,
  saving,
}: {
  initial: HomeLayout;
  ctx: TemplateCtx;
  onCancel: () => void;
  /** reset: 기본 홈으로 되돌렸으면 저장 대신 지운다 */
  onSave: (layout: HomeLayout, reset: boolean) => void;
  saving: boolean;
}) {
  const [layout, setLayout] = useState(initial);
  const [past, setPast] = useState<HomeLayout[]>([]);
  const [future, setFuture] = useState<HomeLayout[]>([]);
  const [reset, setReset] = useState(false);
  const [preview, setPreview] = useState<HomeLayout>();
  const [dragPx, setDragPx] = useState<{ left: number; top: number; width: number; height: number }>();
  const [selected, setSelected] = useState<string>();
  const [panel, setPanel] = useState<Panel>('add');
  const [flash, setFlash] = useState<string>();
  const [announce, setAnnounce] = useState('');
  const canvas = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(1000);
  const drag = useRef<Drag | undefined>(undefined);
  const previewRef = useRef<HomeLayout | undefined>(undefined);
  const pointer = useRef({ x: 0, y: 0 });

  const shown = preview ?? layout;

  useLayoutEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCw(el.clientWidth));
    ro.observe(el);
    setCw(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const commit = useCallback(
    (next: HomeLayout, opts: { keepReset?: boolean } = {}) => {
      if (same(next, layout)) return;
      setPast((p) => [...p.slice(-49), layout]);
      setFuture([]);
      setLayout(next);
      if (!opts.keepReset) setReset(false);
    },
    [layout],
  );

  const undo = useCallback(() => {
    if (!past.length) return;
    setFuture((f) => [layout, ...f]);
    setLayout(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
  }, [past, layout]);

  const redo = useCallback(() => {
    if (!future.length) return;
    setPast((p) => [...p, layout]);
    setLayout(future[0]);
    setFuture((f) => f.slice(1));
  }, [future, layout]);

  const dirty = !same(layout, initial) || reset;

  // 페이지를 떠나려 하면 저장 안 한 변경을 알려 준다
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // 되돌리기 · 다시 하기 · Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest('input, textarea, select, [contenteditable]');
      if (typing) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key === 'Escape') setSelected(undefined);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  /* ───── 끌기 (옮기기 · 크기) ───── */

  const update = useCallback(() => {
    const d = drag.current;
    if (!d) return;
    const { colStep, rowStep } = steps(cw);
    const dx = pointer.current.x - d.px;
    const dy = pointer.current.y + window.scrollY - d.py;
    const min = WIDGET[d.start.type].min;
    let box: Partial<Box>;
    let px = { left: d.left, top: d.top, width: d.width, height: d.height };
    if (d.mode === 'move') {
      px = { ...px, left: Math.max(-20, Math.min(cw - d.width + 20, d.left + dx)), top: Math.max(-20, d.top + dy) };
      box = { x: Math.round(px.left / colStep), y: Math.round(px.top / rowStep) };
    } else {
      const east = d.mode === 'e' || d.mode === 'se';
      const west = d.mode === 'w' || d.mode === 'sw';
      const south = d.mode === 's' || d.mode === 'se' || d.mode === 'sw';
      if (east) px.width = Math.max(20, Math.min(cw - d.left, d.width + dx));
      if (west) {
        const left = Math.max(0, Math.min(d.left + d.width - 20, d.left + dx));
        px = { ...px, left, width: d.width + (d.left - left) };
      }
      if (south) px.height = Math.max(20, d.height + dy);
      const w = Math.max(min.w, Math.round((px.width + GAP) / colStep));
      const h = Math.max(min.h, Math.round((px.height + GAP) / rowStep));
      box = { w, h };
      if (west) box.x = Math.max(0, d.start.x + d.start.w - w);
    }
    setDragPx(px);
    previewRef.current = place(d.base, d.id, box, min);
    setPreview(previewRef.current);
  }, [cw]);

  // 끄는 동안 화면 위 · 아래 끝에 가까우면 스크롤한다
  useEffect(() => {
    if (!dragPx) return;
    let raf = 0;
    const tick = () => {
      const y = pointer.current.y;
      const speed = y < 110 ? -14 : y > window.innerHeight - 60 ? 14 : 0;
      if (speed) {
        window.scrollBy(0, speed);
        update();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dragPx != null, update]); // eslint-disable-line react-hooks/exhaustive-deps

  const startDrag = (e: ReactPointerEvent, w: HomeWidget, mode: Mode) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setSelected(w.id);
    const box = pxBox(w, cw);
    drag.current = { id: w.id, mode, px: e.clientX, py: e.clientY + window.scrollY, start: w, base: layout, ...box };
    pointer.current = { x: e.clientX, y: e.clientY };
    const move = (ev: PointerEvent) => {
      pointer.current = { x: ev.clientX, y: ev.clientY };
      update();
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      document.body.classList.remove('home-dragging');
      drag.current = undefined;
      setDragPx(undefined);
      setPreview(undefined);
      if (previewRef.current) commit(previewRef.current);
      previewRef.current = undefined;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    document.body.classList.add('home-dragging');
    setDragPx(box);
  };

  /* ───── 키보드 ───── */

  const onItemKey = (e: ReactKeyboardEvent, w: HomeWidget) => {
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const a = arrows[e.key];
    if (a) {
      e.preventDefault();
      const min = WIDGET[w.type].min;
      const next = e.shiftKey ? place(layout, w.id, { w: w.w + a[0], h: w.h + a[1] }, min) : place(layout, w.id, { x: w.x + a[0], y: w.y + a[1] }, min);
      commit(next);
      const n = next.widgets.find((x) => x.id === w.id)!;
      setAnnounce(`${WIDGET[w.type].label}: ${n.x + 1}번째 칸, ${n.y + 1}번째 줄, 가로 ${n.w}칸 세로 ${n.h}줄`);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      remove(w.id);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      setSelected(w.id);
      setPanel('settings');
    }
  };

  /* ───── 위젯 더하기 · 빼기 · 설정 ───── */

  const add = (type: HomeWidgetType, o?: HomeWidget['o']) => {
    if (layout.widgets.length >= MAX_WIDGETS) return toast(`위젯은 ${MAX_WIDGETS}개까지 둘 수 있어요`);
    const def = WIDGET[type];
    const id = newId();
    const next = addWidget(layout, { id, type, w: def.size.w, h: def.size.h, ...(o ? { o } : {}) });
    commit(next);
    setSelected(id);
    setFlash(id);
    window.setTimeout(() => setFlash((f) => (f === id ? undefined : f)), 1200);
    // 새 위젯이 보이게
    const w = next.widgets.find((x) => x.id === id)!;
    const top = (canvas.current?.getBoundingClientRect().top ?? 0) + window.scrollY + pxBox(w, cw).top;
    if (top < window.scrollY + 120 || top > window.scrollY + window.innerHeight - 160) window.scrollTo({ top: top - 180, behavior: 'smooth' });
    setAnnounce(`${def.label} 위젯을 더했어요`);
  };

  const remove = (id: string) => {
    const w = layout.widgets.find((x) => x.id === id);
    commit(removeWidget(layout, id));
    if (selected === id) setSelected(undefined);
    if (w) toast(`${WIDGET[w.type].label} 위젯을 뺐어요 · Ctrl+Z 로 되돌리기`);
  };

  const duplicate = (w: HomeWidget) => add(w.type, w.o);

  const setOptions = (id: string, patch: Options) =>
    commit({
      ...layout,
      widgets: layout.widgets.map((w) => (w.id === id ? { ...w, o: compactOptions(w, { ...optionsOf(w), ...patch }) } : w)),
    });

  const applyTemplate = (t: Template) => {
    commit(fromTemplate(t, ctx));
    setSelected(undefined);
    toast(`'${t.label}' 템플릿을 적용했어요 · 되돌리기로 돌아갈 수 있어요`);
  };

  const toDefault = () => {
    commit(fromTemplate(TEMPLATES[0], ctx), { keepReset: true });
    setReset(true);
    setSelected(undefined);
  };

  const rows = rowsOf(shown.widgets);
  // 아래에 빈 줄을 넉넉히 두어 맨 아래로도 끌어 놓을 수 있게
  const height = rowsPx(Math.max(rows + 4, 10));
  const sel = layout.widgets.find((w) => w.id === selected);
  const dragging = drag.current?.id;
  const target = dragging ? shown.widgets.find((w) => w.id === dragging) : undefined;

  return (
    <div className="home-editor">
      <div className="home-toolbar" role="toolbar" aria-label="홈 꾸미기">
        <div className="flex items-baseline gap-2 mr-auto min-w-0">
          <h1 className="m-0 text-[17px] font-bold text-fg-strong whitespace-nowrap">홈 꾸미기</h1>
          <span className="text-[13px] text-fg-weak whitespace-nowrap">
            위젯 {layout.widgets.length}/{MAX_WIDGETS}
          </span>
        </div>
        <button type="button" className={cn(ui.button, ui.small, panel === 'add' ? ui.secondary : ui.text)} onClick={() => setPanel(panel === 'add' ? null : 'add')}>
          위젯 추가
        </button>
        <button type="button" className={cn(ui.button, ui.small, panel === 'templates' ? ui.secondary : ui.text)} onClick={() => setPanel(panel === 'templates' ? null : 'templates')}>
          템플릿
        </button>
        <label className="home-switch" title="켜면 빈 줄 없이 위로 모이고, 끄면 원하는 곳 어디에나 빈칸을 두고 놓을 수 있어요">
          <button type="button" role="switch" aria-checked={layout.compact} onClick={() => commit(setCompact(layout, !layout.compact))} />
          위로 붙이기
        </label>
        <span className="w-px h-5 bg-border mx-1" aria-hidden />
        <button type="button" className={cn(ui.button, ui.text, ui.small, 'px-2')} onClick={undo} disabled={!past.length} title="되돌리기 (Ctrl+Z)" aria-label="되돌리기">
          ↶
        </button>
        <button type="button" className={cn(ui.button, ui.text, ui.small, 'px-2')} onClick={redo} disabled={!future.length} title="다시 하기 (Ctrl+Shift+Z)" aria-label="다시 하기">
          ↷
        </button>
        <button type="button" className={cn(ui.button, ui.text, ui.small)} onClick={toDefault}>
          기본으로
        </button>
        <span className="w-px h-5 bg-border mx-1" aria-hidden />
        <button
          type="button"
          className={cn(ui.button, ui.ghost, ui.small)}
          onClick={() => (!dirty || confirm('바꾼 내용을 저장하지 않고 나갈까요?')) && onCancel()}
        >
          취소
        </button>
        <button type="button" className={cn(ui.button, ui.primary, ui.small)} disabled={saving} onClick={() => onSave(layout, reset)}>
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>

      <p className="home-hint">
        위젯을 끌어 옮기고 가장자리를 끌어 크기를 바꿔요. 방향키로 옮기기 · Shift+방향키로 크기 · Delete 로 빼기.
        {!layout.compact && ' 지금은 빈칸을 남길 수 있어요.'}
      </p>

      <div
        ref={canvas}
        className={cn('home-canvas', dragging && 'is-dragging')}
        style={{ height }}
        onPointerDown={(e) => e.target === e.currentTarget && setSelected(undefined)}
      >
        {/* 칸 · 줄 안내선 */}
        <div className="home-guides" aria-hidden style={{ backgroundSize: `100% ${ROW + GAP}px` }}>
          {Array.from({ length: COLS }, (_, i) => (
            <i key={i} />
          ))}
        </div>
        {target && (
          <div className="home-placeholder" style={{ transform: `translate(${pxBox(target, cw).left}px, ${pxBox(target, cw).top}px)`, ...sizeOf(pxBox(target, cw)) }} aria-hidden />
        )}
        {shown.widgets.map((w) => {
          const def = WIDGET[w.type];
          const o = optionsOf(w);
          const isDrag = w.id === dragging && dragPx;
          const box = isDrag ? dragPx : pxBox(w, cw);
          return (
            <div
              key={w.id}
              className={cn('home-item', isDrag && 'is-drag', selected === w.id && 'is-selected', flash === w.id && 'is-new')}
              style={{ transform: `translate(${box.left}px, ${box.top}px)`, ...sizeOf(box) }}
            >
              {/* 미리보기 위젯은 내용만큼만 그리고, 남는 칸은 점선(내용이 늘면 여기까지 커짐)으로 */}
              {!o.fit && def.preview ? (
                <>
                  <span className="home-item-reserve" aria-hidden>
                    <span>내용이 늘면 여기까지</span>
                  </span>
                  <WidgetFrame widget={w} o={o} editing scroll setOption={() => {}} className="relative max-h-full pointer-events-none select-none" />
                </>
              ) : (
                <WidgetFrame widget={w} o={{ ...o, fit: false }} editing scroll={false} setOption={() => {}} className="h-full pointer-events-none select-none" />
              )}
              <div
                className="home-item-cover"
                tabIndex={0}
                role="button"
                aria-label={`${def.label} 위젯: 가로 ${w.w}칸 세로 ${w.h}줄. 방향키로 옮기기, Shift+방향키로 크기, Delete 로 빼기, Enter 로 설정`}
                onPointerDown={(e) => startDrag(e, w, 'move')}
                onKeyDown={(e) => onItemKey(e, w)}
                onFocus={() => setSelected(w.id)}
                onDoubleClick={() => setPanel('settings')}
              >
                <span className="home-item-tag">
                  <b aria-hidden>{def.glyph}</b>
                  {(o.title as string) || def.label}
                  <span className="opacity-70 tabular-nums">
                    {w.w}×{w.h}
                  </span>
                </span>
                <span className="home-item-actions" onPointerDown={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    title="설정"
                    aria-label={`${def.label} 설정`}
                    onClick={() => {
                      setSelected(w.id);
                      setPanel('settings');
                    }}
                  >
                    ⚙
                  </button>
                  {def.multi && (
                    <button type="button" title="복제" aria-label={`${def.label} 복제`} onClick={() => duplicate(w)}>
                      ⧉
                    </button>
                  )}
                  <button type="button" title="빼기" aria-label={`${def.label} 빼기`} onClick={() => remove(w.id)}>
                    ✕
                  </button>
                </span>
              </div>
              {(['w', 'e', 's', 'sw', 'se'] as const).map((m) => (
                <span key={m} className={`home-handle home-handle-${m}`} onPointerDown={(e) => startDrag(e, w, m)} aria-hidden />
              ))}
            </div>
          );
        })}
        {layout.widgets.length === 0 && (
          <div className="absolute inset-x-0 top-24 text-center text-fg-sub">
            비어 있어요. 오른쪽에서 위젯을 더하거나 템플릿을 골라 보세요.
          </div>
        )}
      </div>

      <div className="sr-only" aria-live="polite">
        {announce}
      </div>

      {panel && (
        <aside className="home-panel" aria-label="홈 꾸미기 도구">
          <div className="flex items-center gap-1 px-3 pt-3 pb-2 border-b border-line">
            {(
              [
                ['add', '위젯 추가'],
                ['templates', '템플릿'],
                ['settings', '설정'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={cn(ui.chip, 'h-8 px-3 text-[13px]')}
                aria-pressed={panel === key}
                disabled={key === 'settings' && !sel}
                onClick={() => setPanel(key)}
              >
                {label}
              </button>
            ))}
            <button type="button" className="ml-auto grid place-items-center w-8 h-8 rounded-sm text-fg-sub hover:bg-field [&>svg]:w-4 [&>svg]:h-4" aria-label="도구 닫기" onClick={() => setPanel(null)}>
              <CloseIcon />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {panel === 'add' && <Catalog layout={layout} onAdd={add} />}
            {panel === 'templates' && <Templates ctx={ctx} onApply={applyTemplate} />}
            {panel === 'settings' &&
              (sel ? (
                <Settings
                  key={sel.id}
                  widget={sel}
                  onChange={(patch) => setOptions(sel.id, patch)}
                  onBox={(box) => commit(place(layout, sel.id, box, WIDGET[sel.type].min))}
                  onRemove={() => remove(sel.id)}
                  onDuplicate={WIDGET[sel.type].multi ? () => duplicate(sel) : undefined}
                />
              ) : (
                <p className="text-sm text-fg-weak">위젯을 누르면 설정이 여기에 나와요.</p>
              ))}
          </div>
        </aside>
      )}
    </div>
  );
}

const sizeOf = (b: { width: number; height: number }) => ({ width: b.width, height: b.height });

/* ───── 위젯 추가 ───── */

function Catalog({ layout, onAdd }: { layout: HomeLayout; onAdd: (type: HomeWidgetType) => void }) {
  const { isLoggedIn } = useAuth();
  const used = new Set(layout.widgets.map((w) => w.type));
  const full = layout.widgets.length >= MAX_WIDGETS;
  return (
    <ul className="list-none m-0 p-0 grid gap-2">
      {WIDGETS.map((def) => {
        const taken = !def.multi && used.has(def.type);
        return (
          <li key={def.type} className="home-catalog-item">
            <span className="home-catalog-glyph" aria-hidden>
              {def.glyph}
            </span>
            <span className="flex-1 min-w-0">
              <span className="flex items-baseline gap-1.5">
                <b className="text-[14px] text-fg-strong">{def.label}</b>
                <span className="text-[11px] text-fg-weak tabular-nums">
                  {def.size.w}×{def.size.h}
                </span>
              </span>
              <span className="block text-[12px] leading-[1.45] text-fg-sub">{def.desc}</span>
              {def.login && !isLoggedIn && <span className="block text-[11px] text-fg-weak">로그인하면 내용이 보여요</span>}
            </span>
            <button
              type="button"
              className={cn(ui.button, ui.small, taken ? ui.ghost : ui.secondary, 'flex-none px-2.5')}
              disabled={taken || full}
              onClick={() => onAdd(def.type)}
              aria-label={`${def.label} 위젯 추가`}
            >
              {taken ? '놓여 있음' : '추가'}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ───── 템플릿 ───── */

function MiniMap({ layout }: { layout: HomeLayout }) {
  const rows = Math.max(rowsOf(layout.widgets), 1);
  return (
    <div className="home-minimap" style={{ aspectRatio: `${COLS} / ${Math.min(rows, 24) * 0.9}` }} aria-hidden>
      {layout.widgets.map((w) => (
        <i
          key={w.id}
          data-type={w.type}
          style={{ left: `${(w.x / COLS) * 100}%`, top: `${(w.y / rows) * 100}%`, width: `${(w.w / COLS) * 100}%`, height: `${(w.h / rows) * 100}%` }}
        />
      ))}
    </div>
  );
}

function Templates({ ctx, onApply }: { ctx: TemplateCtx; onApply: (t: Template) => void }) {
  const previews = useMemo(() => TEMPLATES.map((t) => ({ t, layout: fromTemplate(t, ctx) })), [ctx]);
  return (
    <ul className="list-none m-0 p-0 grid grid-cols-2 gap-2.5">
      {previews.map(({ t, layout }) => (
        <li key={t.key}>
          <button type="button" className="home-template" onClick={() => onApply(t)}>
            <MiniMap layout={layout} />
            <b className="block mt-2 text-[13px] text-fg-strong">{t.label}</b>
            <span className="block text-[11px] leading-[1.4] text-fg-sub">{t.desc}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ───── 위젯 설정 ───── */

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="home-stepper">
      <span>{label}</span>
      <button type="button" aria-label={`${label} 줄이기`} disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <b className="tabular-nums">{value}</b>
      <button type="button" aria-label={`${label} 늘리기`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}

function ChannelSelect({ value, allowAll, onChange, label }: { value: string; allowAll?: boolean; onChange: (v: string) => void; label: string }) {
  const { isLoggedIn } = useAuth();
  const all = useChannels().data ?? [];
  const mine = useMyChannels(isLoggedIn).data ?? [];
  const seen = new Set<string>();
  const options = [...mine, ...all].filter((c) => !seen.has(c.slug) && seen.add(c.slug));
  return (
    <select className="home-select" value={value} aria-label={label} onChange={(e) => onChange(e.target.value)}>
      {allowAll ? <option value="">전체 채널</option> : <option value="">채널 고르기</option>}
      {mine.length > 0 && (
        <optgroup label="내 채널">
          {options.slice(0, mine.length).map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label="모든 채널">
        {options.slice(mine.length).map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name}
          </option>
        ))}
      </optgroup>
    </select>
  );
}

function OptionField({ def, value, onChange }: { def: OptionDef; value: string | number | boolean; onChange: (v: string | number | boolean) => void }) {
  switch (def.kind) {
    case 'switch':
      return (
        <div className="home-option">
          <span>
            {def.label}
            {def.help && <small>{def.help}</small>}
          </span>
          <button type="button" role="switch" aria-checked={!!value} aria-label={def.label} className="home-mini-switch" onClick={() => onChange(!value)} />
        </div>
      );
    case 'select':
      return (
        <div className="home-option is-col">
          <span>{def.label}</span>
          <div className="home-seg" role="radiogroup" aria-label={def.label}>
            {def.choices.map((c) => (
              <button key={String(c.value)} type="button" role="radio" aria-checked={value === c.value} onClick={() => onChange(c.value)}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      );
    case 'channel':
      return (
        <div className="home-option is-col">
          <span>{def.label}</span>
          <ChannelSelect value={String(value)} allowAll={def.allowAll} label={def.label} onChange={onChange} />
        </div>
      );
    case 'text':
      return <TextOption def={def} value={String(value)} onChange={onChange} />;
  }
}

function TextOption({ def, value, onChange }: { def: Extract<OptionDef, { kind: 'text' }>; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <label className="home-option is-col">
      <span>{def.label}</span>
      <input
        className={cn(ui.input, 'h-9 text-sm')}
        value={text}
        maxLength={def.max}
        placeholder={def.placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== value && onChange(text.trim())}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </label>
  );
}

function Settings({
  widget,
  onChange,
  onBox,
  onRemove,
  onDuplicate,
}: {
  widget: HomeWidget;
  onChange: (patch: Options) => void;
  onBox: (box: Partial<Box>) => void;
  onRemove: () => void;
  onDuplicate?: () => void;
}) {
  const def = WIDGET[widget.type];
  const o = optionsOf(widget);
  return (
    <div className="grid gap-4">
      <div className="flex items-start gap-2.5">
        <span className="home-catalog-glyph" aria-hidden>
          {def.glyph}
        </span>
        <div>
          <b className="text-[15px] text-fg-strong">{def.label}</b>
          <p className="m-0 text-[12px] text-fg-sub">{def.desc}</p>
        </div>
      </div>

      <section>
        <h3 className="home-panel-title">크기 · 위치</h3>
        <div className="grid grid-cols-2 gap-1.5">
          <Stepper label="가로 칸" value={widget.w} min={def.min.w} max={COLS} onChange={(w) => onBox({ w })} />
          <Stepper label="세로 줄" value={widget.h} min={def.min.h} max={40} onChange={(h) => onBox({ h })} />
          <Stepper label="왼쪽에서" value={widget.x + 1} min={1} max={COLS - widget.w + 1} onChange={(x) => onBox({ x: x - 1 })} />
          <Stepper label="위에서" value={widget.y + 1} min={1} max={400} onChange={(y) => onBox({ y: y - 1 })} />
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {(
            [
              ['왼쪽 끝', { x: 0 }],
              ['가운데', { x: Math.round((COLS - widget.w) / 2) }],
              ['오른쪽 끝', { x: COLS - widget.w }],
              ['꽉 차게', { x: 0, w: COLS }],
            ] as const
          ).map(([label, box]) => (
            <button key={label} type="button" className={cn(ui.chip, 'h-7 px-2.5 text-[12px]')} onClick={() => onBox(box)}>
              {label}
            </button>
          ))}
        </div>
      </section>

      {def.options && def.options.length > 0 && (
        <section>
          <h3 className="home-panel-title">{def.label} 설정</h3>
          <div className="grid gap-2.5">
            {def.options.map((opt) => (
              <OptionField key={opt.key} def={opt} value={o[opt.key]} onChange={(v) => onChange({ [opt.key]: v })} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="home-panel-title">모양</h3>
        <div className="grid gap-2.5">
          {COMMON.map((opt) => (
            <OptionField key={opt.key} def={opt} value={o[opt.key]} onChange={(v) => onChange({ [opt.key]: v })} />
          ))}
        </div>
      </section>

      <div className="flex gap-2">
        {onDuplicate && (
          <button type="button" className={cn(ui.button, ui.ghost, ui.small, 'flex-1')} onClick={onDuplicate}>
            복제
          </button>
        )}
        <button type="button" className={cn(ui.button, ui.ghost, ui.small, ui.danger, 'flex-1')} onClick={onRemove}>
          빼기
        </button>
      </div>
    </div>
  );
}

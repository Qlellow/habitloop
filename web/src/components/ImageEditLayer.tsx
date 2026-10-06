import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import {
  applyImageStyles,
  buildImageSrc,
  DEFAULT_PARAMS,
  findImageToken,
  parseImageSrc,
  removeImageToken,
  replaceImageToken,
  type ImageAlign,
  type ImageParams,
} from '../lib/postImage';
import { CropModal } from './CropModal';
import { toast } from './Toast';
import { cn } from '../lib/cn';

type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
type Popover = 'radius' | 'size' | 'caption' | undefined;
interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const HOVER_DELAY = 1000;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const HANDLE_POS: Record<Handle, string> = {
  nw: 'left-0 top-0 cursor-nwse-resize',
  n: 'left-1/2 top-0 cursor-ns-resize',
  ne: 'left-full top-0 cursor-nesw-resize',
  e: 'left-full top-1/2 cursor-ew-resize',
  se: 'left-full top-full cursor-nwse-resize',
  s: 'left-1/2 top-full cursor-ns-resize',
  sw: 'left-0 top-full cursor-nesw-resize',
  w: 'left-0 top-1/2 cursor-ew-resize',
};

const tool =
  'flex-none h-8 px-2.5 rounded-md text-[13px] font-semibold text-fg-sub whitespace-nowrap transition-colors ' +
  'hover:bg-field hover:text-fg-strong aria-pressed:bg-primary-weak aria-pressed:text-primary disabled:opacity-35';

/**
 * 편집 미리보기 위의 이미지 편집 도구 (Notion · 한글처럼 본문 안에서 바로 보며 고친다).
 * - 이미지에 마우스를 1초 올리거나, 클릭·Tab 으로 포커스하면 선택된다
 * - 꼭짓점을 끌면 비율을 지킨 채로, 변의 점을 끌면 가로·세로 따로 크기가 실시간으로 바뀐다 (꼭짓점 + Shift: 자유롭게)
 * - 메뉴와 펼침 칸은 이 상자(미리보기) 밖으로 나가지 않는다 (나란히 보기에서 작성 칸에 가려지지 않게)
 * - 위에 뜨는 메뉴: 자르기(사각형·원형) · 이미지 바꾸기 · 모서리 둥글기 · 정렬 · 크기 · 캡션 · 원래대로 · 삭제
 * 바뀐 설정은 마크다운의 이미지 주소 뒤 #설정으로 저장된다 (원본 이미지는 그대로).
 */
export function ImageEditLayer({
  hostRef,
  source,
  onChange,
  uploadFile,
  autoSelect,
}: {
  /** 렌더링된 본문을 감싸는 상자 (position: relative) */
  hostRef: RefObject<HTMLDivElement | null>;
  source: string;
  onChange: (next: string) => void;
  /** 이미지 바꾸기: 파일을 올리고 주소를 돌려준다 */
  uploadFile: (file: File) => Promise<string>;
  /** 이 이미지를 바로 선택해 메뉴를 띄운다 (작성 화면의 이미지 편집 칸). seq 가 바뀔 때마다 다시 선택한다 */
  autoSelect?: { index: number; seq: number };
}) {
  const [selected, setSelected] = useState<number>();
  const [box, setBox] = useState<Box>();
  const [popover, setPopover] = useState<Popover>();
  const [cropping, setCropping] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');
  const [sizeDraft, setSizeDraft] = useState('');
  /** 끌어서 크기를 바꾸는 동안의 크기(%) — 메뉴의 숫자가 실시간으로 바뀐다 */
  const [liveW, setLiveW] = useState<number>();
  const layerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [widths, setWidths] = useState({ host: 0, toolbar: 0, toolbarH: 40, pop: 0 });
  const fileRef = useRef<HTMLInputElement>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const leaveTimer = useRef<number | undefined>(undefined);
  /** 마우스를 1초 올려서 선택된 경우: 이미지와 메뉴에서 벗어나면 닫는다 */
  const byHover = useRef(false);
  const drag = useRef<{ handle: Handle; startW: number; startH: number; px: number; py: number; contentW: number; params: ImageParams; nr: number } | undefined>(undefined);

  const token = selected !== undefined ? findImageToken(source, selected) : undefined;
  const parsed = token ? parseImageSrc(token.src) : undefined;
  const params = parsed?.params ?? DEFAULT_PARAMS;

  const element = useCallback(
    (i = selected) => (i === undefined ? null : hostRef.current?.querySelector<HTMLElement>(`.loop-img[data-i="${i}"]`)),
    [hostRef, selected],
  );

  /** 선택한 이미지 틀의 위치·크기 (host 기준) */
  const measure = useCallback(() => {
    const host = hostRef.current;
    const frame = element()?.querySelector<HTMLElement>('.loop-img-frame');
    if (!host || !frame) return setBox((b) => (b === undefined ? b : undefined));
    const h = host.getBoundingClientRect();
    const r = frame.getBoundingClientRect();
    const next = { left: r.left - h.left, top: r.top - h.top, width: r.width, height: r.height };
    // 값이 같으면 그대로 두어 다시 그리기가 반복되지 않게
    setBox((b) =>
      b && Math.abs(b.left - next.left) < 0.5 && Math.abs(b.top - next.top) < 0.5 && Math.abs(b.width - next.width) < 0.5 && Math.abs(b.height - next.height) < 0.5
        ? b
        : next,
    );
  }, [hostRef, element]);

  const deselect = useCallback(() => {
    setSelected(undefined);
    setPopover(undefined);
    byHover.current = false;
  }, []);

  // 이미지를 키보드(Tab)로도 고를 수 있게 하고, 선택한 이미지 위치를 다시 잰다
  const decorate = useCallback(() => {
    hostRef.current?.querySelectorAll<HTMLElement>('.loop-img').forEach((el) => {
      if (el.tabIndex !== 0) el.tabIndex = 0;
      el.setAttribute('aria-label', '이미지 편집');
      el.classList.add('loop-img-editable');
      // 이미지를 끌면 브라우저가 복사해서 놓아 버린다 (같은 자리에 놓아도 이미지가 하나 더 생긴다)
      el.querySelector('img')?.setAttribute('draggable', 'false');
    });
    measure();
  }, [hostRef, measure]);
  useLayoutEffect(decorate, [decorate, source]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(host);
    // 미리보기는 늦게(lazy) 그려지고, 본문이 바뀔 때마다 새로 그려진다
    const mo = new MutationObserver((records) => {
      if (records.some((r) => r.type === 'childList')) decorate();
    });
    mo.observe(host, { childList: true, subtree: true });
    // 이미지가 늦게 받아지면 높이가 바뀐다
    const onLoad = () => measure();
    host.addEventListener('load', onLoad, true);
    return () => {
      ro.disconnect();
      mo.disconnect();
      host.removeEventListener('load', onLoad, true);
    };
  }, [hostRef, measure, decorate]);

  // 이미지에 마우스 1초 → 선택, 클릭·포커스 → 바로 선택
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const indexOf = (t: EventTarget | null) => {
      const el = (t as HTMLElement | null)?.closest?.<HTMLElement>('.loop-img');
      return el?.dataset.i !== undefined ? Number(el.dataset.i) : undefined;
    };
    const over = (e: PointerEvent) => {
      const i = indexOf(e.target);
      if (i === undefined) return;
      window.clearTimeout(leaveTimer.current);
      if (i === selected) return;
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = window.setTimeout(() => {
        byHover.current = true;
        setPopover(undefined);
        setSelected(i);
      }, HOVER_DELAY);
    };
    const out = (e: PointerEvent) => {
      if (indexOf(e.target) === undefined) return;
      window.clearTimeout(hoverTimer.current);
      if (byHover.current && !popover && !drag.current) {
        leaveTimer.current = window.setTimeout(() => {
          if (!layerRef.current?.matches(':hover')) deselect();
        }, 400);
      }
    };
    const pick = (e: Event) => {
      const i = indexOf(e.target);
      if (i === undefined) return;
      window.clearTimeout(hoverTimer.current);
      byHover.current = false;
      if (i !== selected) setPopover(undefined);
      setSelected(i);
    };
    const noDrag = (e: DragEvent) => {
      if (indexOf(e.target) !== undefined) e.preventDefault();
    };
    host.addEventListener('dragstart', noDrag);
    host.addEventListener('pointerover', over);
    host.addEventListener('pointerout', out);
    host.addEventListener('click', pick);
    host.addEventListener('focusin', pick);
    return () => {
      host.removeEventListener('dragstart', noDrag);
      host.removeEventListener('pointerover', over);
      host.removeEventListener('pointerout', out);
      host.removeEventListener('click', pick);
      host.removeEventListener('focusin', pick);
    };
  }, [hostRef, selected, popover, deselect]);

  // 다른 곳을 누르거나 Esc → 선택 해제
  useEffect(() => {
    if (selected === undefined) return;
    const down = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (layerRef.current?.contains(t) || t.closest('.loop-img') || t.closest('[role="dialog"]')) return;
      deselect();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !cropping) {
        if (popover) setPopover(undefined);
        else deselect();
      }
    };
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('keydown', key);
    };
  }, [selected, popover, cropping, deselect]);

  // 크기 직접 입력 칸은 지금 크기를 따라간다 (프리셋을 누르거나 끌어서 바꿨을 때)
  useEffect(() => setSizeDraft(String(Math.round(params.w * 10) / 10)), [params.w]);

  // 작성 화면의 편집 칸: 커서가 놓인 이미지를 바로 선택한다
  const autoIndex = autoSelect?.index;
  const autoSeq = autoSelect?.seq;
  useEffect(() => {
    if (autoIndex === undefined) return;
    byHover.current = false;
    setSelected((cur) => {
      if (cur !== autoIndex) setPopover(undefined);
      return autoIndex;
    });
  }, [autoIndex, autoSeq]);

  // 메뉴·펼침 칸의 너비를 재서, 미리보기 상자 밖으로 나가지 않게 자리를 맞춘다 (그리기 전에 한 번 더 그린다)
  useLayoutEffect(() => {
    const next = {
      host: hostRef.current?.clientWidth ?? 0,
      toolbar: toolbarRef.current?.offsetWidth ?? 0,
      toolbarH: toolbarRef.current?.offsetHeight ?? 40,
      pop: popRef.current?.offsetWidth ?? 0,
    };
    setWidths((w) => (w.host === next.host && w.toolbar === next.toolbar && w.toolbarH === next.toolbarH && w.pop === next.pop ? w : next));
  });

  // 이미지가 지워지거나 본문에서 사라지면 선택 해제
  useEffect(() => {
    if (selected !== undefined && !token) deselect();
  }, [selected, token, deselect]);

  if (selected === undefined || !token || !parsed || !box) {
    return <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden />;
  }

  const commit = (next: ImageParams, alt = token.alt) => onChange(replaceImageToken(source, selected, alt, buildImageSrc(parsed.url, next)));
  const naturalRatio = () => {
    const img = element()?.querySelector('img');
    return img && img.naturalWidth ? img.naturalHeight / img.naturalWidth : (params.nr ?? 1);
  };

  /* ───── 크기 조절 (실시간) ───── */
  const startResize = (handle: Handle) => (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const el = element();
    const content = el?.parentElement?.getBoundingClientRect().width ?? box.width;
    drag.current = { handle, startW: box.width, startH: box.height, px: e.clientX, py: e.clientY, contentW: content, params, nr: naturalRatio() };
  };
  const moveResize = (e: ReactPointerEvent) => {
    const d = drag.current;
    const el = element();
    if (!d || !el) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    // 가운데 정렬이면 양쪽으로 함께 커지므로 가로 변화량을 두 배로
    const k = d.params.align === 'center' ? 2 : 1;
    let w = d.startW;
    let h = d.startH;
    if (d.handle.includes('e')) w = d.startW + dx * k;
    if (d.handle.includes('w')) w = d.startW - dx * k;
    if (d.handle.includes('s')) h = d.startH + dy;
    if (d.handle.includes('n')) h = d.startH - dy;
    w = clamp(w, d.contentW * 0.1, d.contentW);
    h = clamp(h, 24, 4000);
    // 꼭짓점: 가로를 기준으로 처음 비율을 지킨다 (Shift 를 누르면 가로·세로 따로)
    if (d.handle.length === 2 && !e.shiftKey) {
      h = (w * d.startH) / d.startW;
      if (h < 24) {
        h = 24;
        w = (h * d.startW) / d.startH;
      }
    }
    const next: ImageParams = { ...d.params, w: (w / d.contentW) * 100, ar: h / w, nr: d.nr };
    applyImageStyles(el, next);
    setLiveW(next.w);
    measure();
  };
  const endResize = () => {
    const d = drag.current;
    drag.current = undefined;
    setLiveW(undefined);
    const el = element();
    if (!d || !el) return;
    const frame = el.querySelector<HTMLElement>('.loop-img-frame')!.getBoundingClientRect();
    commit({ ...d.params, w: Math.round((frame.width / d.contentW) * 1000) / 10, ar: frame.height / frame.width, nr: d.nr });
  };

  /* ───── 메뉴 동작 ───── */
  const replaceImage = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    try {
      const url = await uploadFile(file);
      // 새 사진에는 이전 사진 기준의 자르기·비율이 맞지 않으므로 그것만 지운다
      onChange(replaceImageToken(source, selected, token.alt, buildImageSrc(url, { ...params, crop: undefined, ar: undefined, nr: undefined })));
      toast('이미지를 바꿨어요');
    } catch (e) {
      toast((e as Error).message);
    }
  };

  const applySize = () => {
    const n = Number(sizeDraft);
    if (!sizeDraft.trim() || !Number.isFinite(n)) return setSizeDraft(String(Math.round(params.w)));
    const w = Math.round(clamp(n, 5, 100) * 10) / 10;
    setSizeDraft(String(w));
    if (w !== params.w) commit({ ...params, w });
  };

  const saveCaption = () => {
    commit(params, captionDraft.trim());
    setPopover(undefined);
  };

  // 메뉴는 이미지 위에 (자리가 없으면 아래에). 좁은 미리보기에서는 메뉴가 두 줄로 접힌다
  const toolbarTop = box.top - widths.toolbarH - 8 < 0 ? box.top + box.height + 8 : box.top - widths.toolbarH - 8;
  const fit = (left: number, width: number) => clamp(left, 0, Math.max(0, widths.host - width));
  // 메뉴는 이미지 가운데 위에, 캡션 칸은 이미지 왼쪽 끝에 맞춘다. 둘 다 상자 안에서만
  const toolbarLeft = fit(box.left + box.width / 2 - widths.toolbar / 2, widths.toolbar);
  const popLeft = fit(popover === 'caption' ? box.left : toolbarLeft, widths.pop);
  // 캡션 칸은 캡션이 보일 자리(이미지 바로 아래)에 연다. 메뉴가 이미지 아래에 있으면 메뉴 아래에
  const toolbarAbove = toolbarTop < box.top;
  const popTop = popover === 'caption' && toolbarAbove ? box.top + box.height + 8 : toolbarTop + widths.toolbarH + 6;
  const align = (a: ImageAlign) => commit({ ...params, align: a });

  return (
    <div ref={layerRef} className="absolute inset-0 pointer-events-none z-10" onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize}>
      {/* 선택 테두리 + 크기 조절 점 */}
      <div
        className="absolute outline outline-2 outline-primary"
        style={{ left: box.left, top: box.top, width: box.width, height: box.height, borderRadius: params.shape === 'circle' ? '50%' : params.r }}
      />
      <div className="absolute" style={{ left: box.left, top: box.top, width: box.width, height: box.height }}>
        {(Object.keys(HANDLE_POS) as Handle[]).map((h) => (
          <span
            key={h}
            role="presentation"
            title={h.length === 2 ? '끌어서 크기 조절 (비율 유지, Shift: 자유롭게)' : '끌어서 가로·세로 따로 조절'}
            className={cn('absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white border-2 border-primary shadow pointer-events-auto touch-none', HANDLE_POS[h])}
            onPointerDown={startResize(h)}
          />
        ))}
      </div>

      {/* 이미지 바로 위 메뉴 (Notion 처럼) */}
      <div
        ref={toolbarRef}
        role="toolbar"
        aria-label="이미지 편집"
        className="absolute flex flex-wrap items-center gap-0.5 p-1 rounded-lg border border-border bg-surface shadow-pop pointer-events-auto animate-pop max-w-full"
        style={{ left: toolbarLeft, top: toolbarTop }}
      >
        <button type="button" className={tool} onClick={() => setCropping(true)} title="자르기 (사각형·원형)">
          ✂ 자르기
        </button>
        <button type="button" className={tool} onClick={() => fileRef.current?.click()} title="다른 사진으로 바꾸기">
          ⇄ 바꾸기
        </button>
        <span className="w-px h-5 mx-0.5 bg-border" />
        <button
          type="button"
          className={tool}
          aria-pressed={popover === 'size'}
          onClick={() => {
            setSizeDraft(String(Math.round(params.w * 10) / 10));
            setPopover(popover === 'size' ? undefined : 'size');
          }}
          title="크기 (25·50·75·100% 또는 직접 입력)"
        >
          <span className="tabular-nums">{Math.round(liveW ?? params.w)}%</span> ▾
        </button>
        <button
          type="button"
          className={tool}
          aria-pressed={popover === 'radius'}
          disabled={params.shape === 'circle'}
          onClick={() => setPopover(popover === 'radius' ? undefined : 'radius')}
          title={params.shape === 'circle' ? '원형은 모서리를 바꿀 수 없어요' : '모서리 둥글기'}
        >
          ◜ 모서리
        </button>
        {(
          [
            ['left', '⇤', '왼쪽 정렬'],
            ['center', '↔', '가운데 정렬'],
            ['right', '⇥', '오른쪽 정렬'],
          ] as const
        ).map(([a, label, title]) => (
          <button key={a} type="button" className={cn(tool, 'w-8 px-0')} aria-pressed={params.align === a} onClick={() => align(a)} title={title} aria-label={title}>
            {label}
          </button>
        ))}
        <span className="w-px h-5 mx-0.5 bg-border" />
        <button
          type="button"
          className={tool}
          aria-pressed={popover === 'caption'}
          onClick={() => {
            setCaptionDraft(token.alt);
            setPopover(popover === 'caption' ? undefined : 'caption');
          }}
          title="캡션 (이미지 아래 설명)"
        >
          💬 캡션
        </button>
        <button
          type="button"
          className={tool}
          onClick={() => commit({ ...DEFAULT_PARAMS })}
          title="크기·자르기·모양을 처음 상태로"
        >
          ↺ 원래대로
        </button>
        <button
          type="button"
          // 삭제는 항상 빨강 (다크 테마에서는 더 밝은 빨강)
          className={cn(tool, 'text-danger-text hover:text-danger-text hover:bg-danger-weak')}
          onClick={() => {
            onChange(removeImageToken(source, selected));
            deselect();
          }}
          title="이미지 삭제"
        >
          🗑
        </button>
      </div>

      {/* 메뉴 아래 펼침: 크기 / 모서리 / 캡션 */}
      {popover && (
        <div
          ref={popRef}
          className="absolute max-w-full p-3 rounded-lg border border-border bg-surface shadow-pop pointer-events-auto animate-pop"
          style={{ left: popLeft, top: popTop }}
        >
          {popover === 'size' && (
            <div className="flex flex-wrap items-center gap-1">
              {[25, 50, 75, 100].map((w) => (
                <button key={w} type="button" className={tool} aria-pressed={Math.round(params.w) === w} onClick={() => commit({ ...params, w })}>
                  {w}%
                </button>
              ))}
              <span className="w-px h-5 mx-1 bg-border" />
              {/* 원하는 크기 직접 입력 (5 ~ 100%) */}
              <label className="flex items-center gap-1 text-[13px] font-semibold text-fg-sub">
                <input
                  type="number"
                  min={5}
                  max={100}
                  inputMode="numeric"
                  aria-label="크기 직접 입력 (%)"
                  value={sizeDraft}
                  onChange={(e) => setSizeDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    applySize();
                  }}
                  onBlur={applySize}
                  className="w-14 h-8 px-2 rounded-md bg-field text-right tabular-nums text-fg-strong outline-none focus:ring-2 focus:ring-primary/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
                %
              </label>
            </div>
          )}
          {popover === 'radius' && (
            <label className="flex items-center gap-3 text-[13px] font-semibold text-fg-sub whitespace-nowrap">
              모서리
              <input
                type="range"
                min={0}
                max={48}
                value={params.r}
                onChange={(e) => commit({ ...params, r: Number(e.target.value) })}
                className="w-40 accent-[var(--primary)]"
              />
              <span className="w-9 tabular-nums text-fg-strong">{params.r}px</span>
            </label>
          )}
          {popover === 'caption' && (
            // 글쓰기 폼 안에 있으므로 <form> 을 겹치지 않는다 (겹치면 Enter·저장이 글 전체를 등록해 버린다)
            <div className="flex items-center gap-2">
              <input
                autoFocus
                className="w-64 min-w-0 flex-1 h-9 px-2.5 rounded-md bg-field text-sm outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="이미지 아래에 보일 설명"
                aria-label="캡션"
                maxLength={120}
                value={captionDraft}
                onChange={(e) => setCaptionDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  saveCaption();
                }}
              />
              <button type="button" className={cn(tool, 'bg-primary text-white hover:bg-primary-pressed hover:text-white')} onClick={saveCaption}>
                캡션 저장
              </button>
            </div>
          )}
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void replaceImage(e.target.files?.[0])} />

      {cropping && (
        <CropModal
          src={parsed.url}
          initial={params.crop}
          initialShape={params.shape}
          onClose={() => setCropping(false)}
          onApply={({ crop, shape, naturalRatio: nr }) => {
            // 자르면 자른 영역의 원래 비율로 보이게 자유 변형(ar)은 지운다
            commit({ ...params, crop: crop.w > 0.999 && crop.h > 0.999 ? undefined : crop, shape, ar: undefined, nr });
            setCropping(false);
          }}
        />
      )}
    </div>
  );
}

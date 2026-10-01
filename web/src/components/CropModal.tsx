import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import type { CropRect, ImageShape } from '../lib/postImage';
import { ui } from './ui';
import { cn } from '../lib/cn';

type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const MIN = 0.04;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** 정해진 가로세로 비율(px 기준)로 이미지 안에 들어가는 가장 큰 가운데 영역 */
function fitAspect(aspect: number, stageRatio: number): CropRect {
  // stageRatio = 이미지 가로/세로. 영역 가로(비율) = aspect * 세로(비율) / stageRatio
  let h = 1;
  let w = (aspect * h) / stageRatio;
  if (w > 1) {
    w = 1;
    h = (w * stageRatio) / aspect;
  }
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

/**
 * 이미지 자르기 창. 사각형 · 원형(타원) 영역을 끌어서 옮기고, 모서리·변의 점을 끌어서 자유롭게 크기를 바꾼다.
 * 영역은 이미지 밖으로 나갈 수 없다. Shift 를 누른 채 모서리를 끌면 지금 비율을 유지한다.
 * aspect 를 주면(프로필 이미지 1:1 등) 그 비율로 고정된다.
 */
export function CropModal({
  src,
  title = '이미지 자르기',
  initial,
  initialShape = 'rect',
  shapes = true,
  aspect,
  applyLabel = '적용',
  onApply,
  onClose,
}: {
  src: string;
  title?: string;
  initial?: CropRect;
  initialShape?: ImageShape;
  /** 원형/사각형을 고를 수 있게 할지 */
  shapes?: boolean;
  /** 가로/세로 비율 고정 (px 기준). 없으면 자유 */
  aspect?: number;
  applyLabel?: string;
  onApply: (result: { crop: CropRect; shape: ImageShape; naturalRatio: number }) => void;
  onClose: () => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number }>();
  const [crop, setCrop] = useState<CropRect>(initial ?? { x: 0, y: 0, w: 1, h: 1 });
  const [shape, setShape] = useState<ImageShape>(initialShape);
  const [ratio, setRatio] = useState<number | undefined>(aspect);
  const drag = useRef<{ handle: Handle; start: CropRect; px: number; py: number; shift: boolean } | undefined>(undefined);

  // Esc 로 닫기, 열려 있는 동안 뒤 페이지 스크롤 막기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const stageRatio = natural ? natural.w / natural.h : 1;

  // 비율을 고르면(또는 처음부터 고정이면) 그 비율의 가장 큰 가운데 영역으로
  const pickRatio = (r: number | undefined) => {
    setRatio(r);
    if (r) setCrop(fitAspect(r, stageRatio));
  };
  useEffect(() => {
    if (natural && aspect && !initial) setCrop(fitAspect(aspect, natural.w / natural.h));
  }, [natural, aspect, initial]);

  const onPointerDown = (handle: Handle) => (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { handle, start: crop, px: e.clientX, py: e.clientY, shift: e.shiftKey };
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    const stage = stageRef.current;
    if (!d || !stage) return;
    const rect = stage.getBoundingClientRect();
    const dx = (e.clientX - d.px) / rect.width;
    const dy = (e.clientY - d.py) / rect.height;
    const s = d.start;
    if (d.handle === 'move') {
      setCrop({ ...s, x: clamp(s.x + dx, 0, 1 - s.w), y: clamp(s.y + dy, 0, 1 - s.h) });
      return;
    }
    let { x, y, w, h } = s;
    const right = s.x + s.w;
    const bottom = s.y + s.h;
    if (d.handle.includes('w')) {
      x = clamp(s.x + dx, 0, right - MIN);
      w = right - x;
    }
    if (d.handle.includes('e')) w = clamp(s.w + dx, MIN, 1 - s.x);
    if (d.handle.includes('n')) {
      y = clamp(s.y + dy, 0, bottom - MIN);
      h = bottom - y;
    }
    if (d.handle.includes('s')) h = clamp(s.h + dy, MIN, 1 - s.y);

    // 비율 고정(정해진 비율 또는 Shift): 가로 기준으로 세로를 맞추고, 이미지를 넘으면 함께 줄인다
    const lock = ratio ?? (e.shiftKey || d.shift ? (s.w * rect.width) / (s.h * rect.height) : undefined);
    if (lock && d.handle.length === 2) {
      const toH = (ww: number) => (ww * rect.width) / (rect.height * lock);
      h = toH(w);
      const maxH = d.handle.includes('n') ? bottom : 1 - s.y;
      if (h > maxH) {
        h = maxH;
        w = (h * rect.height * lock) / rect.width;
      }
      if (d.handle.includes('w')) x = right - w;
      if (d.handle.includes('n')) y = bottom - h;
    }
    setCrop({ x, y, w, h });
  };

  const onPointerUp = () => {
    drag.current = undefined;
  };

  const handles: Handle[] = ratio ? ['nw', 'ne', 'sw', 'se'] : ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  const handlePos: Record<Exclude<Handle, 'move'>, string> = {
    nw: 'left-0 top-0 cursor-nwse-resize',
    n: 'left-1/2 top-0 cursor-ns-resize',
    ne: 'left-full top-0 cursor-nesw-resize',
    e: 'left-full top-1/2 cursor-ew-resize',
    se: 'left-full top-full cursor-nwse-resize',
    s: 'left-1/2 top-full cursor-ns-resize',
    sw: 'left-0 top-full cursor-nesw-resize',
    w: 'left-0 top-1/2 cursor-ew-resize',
  };

  // 편집 도구 같은 다른 레이어 안에서 열어도 영향받지 않게 body 바로 아래에 그린다
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/60 animate-pop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-[640px] rounded-xl border border-border bg-surface shadow-pop overflow-hidden">
        <div className="flex items-center justify-between px-5 h-14 border-b border-border">
          <h2 className="m-0 text-base font-bold text-fg-strong">{title}</h2>
          <button type="button" className={cn(ui.button, ui.text, ui.small, 'w-8 px-0 text-lg')} aria-label="닫기" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="grid place-items-center p-5 bg-[#0d1117]">
          <div
            ref={stageRef}
            className="relative select-none touch-none max-w-full"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <img
              src={src}
              alt=""
              draggable={false}
              onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              className="block max-w-full max-h-[56vh] w-auto h-auto pointer-events-none"
            />
            {natural && (
              <div className="absolute inset-0 overflow-hidden">
                <div
                  className="absolute cursor-move outline outline-2 outline-white/90"
                  style={{
                    left: `${crop.x * 100}%`,
                    top: `${crop.y * 100}%`,
                    width: `${crop.w * 100}%`,
                    height: `${crop.h * 100}%`,
                    borderRadius: shape === 'circle' ? '50%' : 0,
                    // 영역 바깥을 어둡게
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
                  }}
                  onPointerDown={onPointerDown('move')}
                />
              </div>
            )}
            {natural && (
              // 크기 조절 점: 영역의 바깥 사각형 모서리·변 가운데 (원형이어도 사각형 기준)
              <div
                className="absolute pointer-events-none"
                style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}
              >
                {shape === 'circle' && <div className="absolute inset-0 border border-dashed border-white/50" />}
                {handles.map((h) => (
                  <span
                    key={h}
                    role="presentation"
                    className={cn(
                      'absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white border border-black/30 shadow pointer-events-auto',
                      handlePos[h as Exclude<Handle, 'move'>],
                    )}
                    onPointerDown={onPointerDown(h)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-t border-border">
          {shapes && (
            <div className="inline-flex p-[3px] rounded-[7px] bg-field" role="group" aria-label="모양">
              {(
                [
                  ['rect', '▢ 사각형'],
                  ['circle', '◯ 원형'],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={shape === v}
                  onClick={() => setShape(v)}
                  className="h-8 px-3 rounded-[5px] text-[13px] font-semibold text-fg-sub hover:text-fg-strong aria-pressed:bg-surface aria-pressed:text-fg-strong aria-pressed:shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {!aspect && (
            <div className="inline-flex p-[3px] rounded-[7px] bg-field" role="group" aria-label="비율">
              {(
                [
                  [undefined, '자유'],
                  [1, '1:1'],
                  [4 / 3, '4:3'],
                  [16 / 9, '16:9'],
                ] as const
              ).map(([r, label]) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={ratio === r}
                  onClick={() => pickRatio(r)}
                  className="h-8 px-2.5 rounded-[5px] text-[13px] font-semibold text-fg-sub hover:text-fg-strong aria-pressed:bg-surface aria-pressed:text-fg-strong aria-pressed:shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className={cn(ui.button, ui.text, ui.small)}
            onClick={() => (aspect ? setCrop(fitAspect(aspect, stageRatio)) : (setRatio(undefined), setCrop({ x: 0, y: 0, w: 1, h: 1 })))}
          >
            처음으로
          </button>
          <span className="flex-1" />
          <button type="button" className={cn(ui.button, ui.ghost)} onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className={cn(ui.button, ui.primary)}
            disabled={!natural}
            onClick={() => natural && onApply({ crop, shape, naturalRatio: natural.h / natural.w })}
          >
            {applyLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

import { useEffect, useRef, useState } from 'react';
import { updateSettings, useSettings, type Settings } from '../lib/settings';
import { toast } from './Toast';
import { cn } from '../lib/cn';

/**
 * 몰입 모드 (글 화면): 헤더 · 사이드바 · 인기글 · 푸터 · 하늘 장식 · 펫을 숨기고 글과 댓글만 남긴다.
 * 위쪽 작은 막대에서 글자 크기와 본문 너비를 바꾼다 (이 브라우저에 기억). F 로 켜고 끄고, Esc 로 나간다.
 * 숨기는 건 global.css 의 html.focus-mode 가 맡는다.
 */

export const FOCUS_WIDTH: Record<Settings['focusWidth'], { px: number; label: string }> = {
  narrow: { px: 620, label: '좁게' },
  normal: { px: 760, label: '보통' },
  wide: { px: 960, label: '넓게' },
};
export const FOCUS_FONT = { min: 14, max: 24, step: 1 };

export function toggleFocusMode(on?: boolean) {
  const next = on ?? !document.documentElement.classList.contains('focus-mode');
  updateSettings({ focusMode: next });
  toast(next ? '몰입 모드 · Esc 로 나가요' : '몰입 모드를 껐어요');
}

const typing = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]');

/** 글 화면에서 부른다: 켜져 있으면 html 에 표시를 달고, F · Esc 단축키를 받는다 */
export function useFocusMode() {
  const { focusMode, focusFont, focusWidth } = useSettings();
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('focus-mode', focusMode);
    root.style.setProperty('--focus-font', `${focusFont}px`);
    root.style.setProperty('--focus-w', `${FOCUS_WIDTH[focusWidth].px}px`);
    return () => {
      root.classList.remove('focus-mode');
      root.style.removeProperty('--focus-font');
      root.style.removeProperty('--focus-w');
    };
  }, [focusMode, focusFont, focusWidth]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target) || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (e.key === 'f' || e.key === 'F' || e.key === 'ㄹ') {
        e.preventDefault();
        toggleFocusMode();
      } else if (e.key === 'Escape' && document.documentElement.classList.contains('focus-mode')) {
        toggleFocusMode(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return focusMode;
}

/** 몰입 모드 위쪽 막대: 글자 크기 · 너비 · 나가기. 가만히 있으면 흐려졌다가 마우스를 움직이면 다시 또렷하게 */
export function FocusBar() {
  const { focusFont, focusWidth } = useSettings();
  const [idle, setIdle] = useState(false);
  const timer = useRef(0);
  useEffect(() => {
    const wake = () => {
      setIdle(false);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setIdle(true), 2500);
    };
    wake();
    window.addEventListener('pointermove', wake, { passive: true });
    window.addEventListener('keydown', wake);
    return () => {
      window.clearTimeout(timer.current);
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('keydown', wake);
    };
  }, []);
  const font = (d: number) => updateSettings({ focusFont: Math.max(FOCUS_FONT.min, Math.min(FOCUS_FONT.max, focusFont + d)) });
  return (
    <div className={cn('focus-bar', idle && 'is-idle')} role="toolbar" aria-label="몰입 모드" data-fx-off="">
      <span className="focus-bar-title focus-bar-wide">몰입 모드</span>
      <span className="focus-bar-sep focus-bar-wide" aria-hidden />
      <span className="focus-bar-group" aria-label="글자 크기">
        <button type="button" onClick={() => font(-FOCUS_FONT.step)} disabled={focusFont <= FOCUS_FONT.min} aria-label="글자 작게" title="글자 작게">
          <span className="text-[12px]">가</span>−
        </button>
        <b className="tabular-nums" aria-live="polite">
          {focusFont}
        </b>
        <button type="button" onClick={() => font(FOCUS_FONT.step)} disabled={focusFont >= FOCUS_FONT.max} aria-label="글자 크게" title="글자 크게">
          <span className="text-[16px]">가</span>+
        </button>
      </span>
      {/* 너비는 넓은 화면에서만 (폰은 화면 폭이 곧 본문 폭) */}
      <span className="focus-bar-sep focus-bar-wide" aria-hidden />
      <span className="focus-bar-group focus-bar-wide" role="radiogroup" aria-label="본문 너비">
        {(Object.keys(FOCUS_WIDTH) as Settings['focusWidth'][]).map((w) => (
          <button key={w} type="button" role="radio" aria-checked={focusWidth === w} className="focus-bar-seg" onClick={() => updateSettings({ focusWidth: w })}>
            {FOCUS_WIDTH[w].label}
          </button>
        ))}
      </span>
      <span className="focus-bar-sep" aria-hidden />
      <button type="button" className="focus-bar-exit" onClick={() => toggleFocusMode(false)} title="몰입 모드 나가기 (Esc · F)">
        나가기 <kbd>Esc</kbd>
      </button>
    </div>
  );
}

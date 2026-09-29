import { lazy, Suspense, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { getSettings } from '../lib/settings';
import { ui } from './ui';
import { cn } from '../lib/cn';
import s from './MarkdownEditor.styles';

// 미리보기를 켜기 전에는 마크다운 파서를 받지 않는다
const Preview = lazy(() => import('./Markdown').then((m) => ({ default: m.Markdown })));
const preloadPreview = () => void import('./Markdown');

type Mode = 'write' | 'split' | 'preview';
type Action = { label: string; title: string; apply: (sel: string) => [before: string, text: string, after: string] };

const ACTIONS: Action[] = [
  { label: 'B', title: '굵게 (Ctrl+B)', apply: (t) => ['**', t || '굵은 글씨', '**'] },
  { label: 'I', title: '기울임 (Ctrl+I)', apply: (t) => ['*', t || '기울인 글씨', '*'] },
  { label: 'H', title: '소제목', apply: (t) => ['\n## ', t || '소제목', '\n'] },
  { label: '•', title: '목록', apply: (t) => ['\n- ', t || '항목', '\n'] },
  { label: '“', title: '인용', apply: (t) => ['\n> ', t || '인용문', '\n'] },
  { label: '</>', title: '코드', apply: (t) => (t.includes('\n') ? ['\n```\n', t, '\n```\n'] : ['`', t || 'code', '`']) },
  { label: '🔗', title: '링크 (Ctrl+K)', apply: (t) => ['[', t || '링크 텍스트', '](https://)'] },
  { label: '🖼', title: '이미지', apply: (t) => ['![', t || '설명', '](https://)'] },
];

const SHORTCUTS: Record<string, number> = { b: 0, i: 1, k: 6 };

export function MarkdownEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // 설정의 기본 보기 방식을 따르되, 좁은 화면에서는 나란히 보기 대신 작성으로 연다
  const [mode, setMode] = useState<Mode>(() => {
    const preferred = getSettings().editorMode;
    return preferred === 'split' && window.innerWidth < 1000 ? 'write' : preferred;
  });
  const ref = useRef<HTMLTextAreaElement>(null);

  const apply = (action: Action) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const [before, text, after] = action.apply(value.slice(start, end));
    // 값을 즉시 DOM 에 반영한 뒤 삽입한 텍스트를 선택해 두면, 바로 타이핑해서 덮어쓸 수 있다
    flushSync(() => onChange(value.slice(0, start) + before + text + after + value.slice(end)));
    el.focus();
    el.setSelectionRange(start + before.length, start + before.length + text.length);
  };

  const showEditor = mode !== 'preview';
  const showPreview = mode !== 'write';

  return (
    <div className={s.editor}>
      <div className={s.bar}>
        <div className={s.tools} role="toolbar" aria-label="서식">
          {ACTIONS.map((a) => (
            <button
              key={a.title}
              type="button"
              className={s.tool}
              title={a.title}
              aria-label={a.title}
              disabled={!showEditor}
              onMouseDown={(e) => e.preventDefault()} // 텍스트 선택이 풀리지 않게
              onClick={() => apply(a)}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div className={s.modes} role="tablist" aria-label="보기 방식">
          {(
            [
              ['write', '작성'],
              ['split', '나란히'],
              ['preview', '미리보기'],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              onPointerEnter={m !== 'write' ? preloadPreview : undefined}
              className={cn(s.mode, m === 'split' && s.splitOnly)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className={cn(s.panes, mode === 'split' && s.split)}>
        {showEditor && (
          <textarea
            ref={ref}
            className={cn(ui.textarea, s.textarea)}
            placeholder={'내용을 입력해 주세요\n\n**굵게**, # 제목, - 목록, [링크](https://) 같은 마크다운 문법을 쓸 수 있어요'}
            maxLength={20000}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              const idx = SHORTCUTS[e.key.toLowerCase()];
              if ((e.ctrlKey || e.metaKey) && idx !== undefined) {
                e.preventDefault();
                apply(ACTIONS[idx]);
              }
            }}
            aria-label="내용"
          />
        )}
        {showPreview && (
          <div className={cn(s.preview, mode === 'split' && s.previewInSplit)} aria-label="미리보기">
            {value.trim() ? (
              <Suspense fallback={<div className={ui.spinner} />}>
                <Preview source={value} />
              </Suspense>
            ) : (
              <p className={s.empty}>미리 볼 내용이 없어요</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

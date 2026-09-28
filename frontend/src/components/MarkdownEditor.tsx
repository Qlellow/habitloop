import { lazy, Suspense, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import ui from './ui.module.css';
import s from './MarkdownEditor.module.css';

// 미리보기를 누르기 전에는 마크다운 파서를 받지 않는다
const Preview = lazy(() => import('./Markdown').then((m) => ({ default: m.Markdown })));
const preloadPreview = () => void import('./Markdown');

type Action = { label: string; title: string; apply: (sel: string) => [before: string, text: string, after: string] };

const ACTIONS: Action[] = [
  { label: 'B', title: '굵게', apply: (t) => ['**', t || '굵은 글씨', '**'] },
  { label: 'I', title: '기울임', apply: (t) => ['*', t || '기울인 글씨', '*'] },
  { label: 'H', title: '제목', apply: (t) => ['\n## ', t || '제목', '\n'] },
  { label: '•', title: '목록', apply: (t) => ['\n- ', t || '항목', '\n'] },
  { label: '“', title: '인용', apply: (t) => ['\n> ', t || '인용문', '\n'] },
  { label: '</>', title: '코드', apply: (t) => (t.includes('\n') ? ['\n```\n', t, '\n```\n'] : ['`', t || 'code', '`']) },
  { label: '🔗', title: '링크', apply: (t) => ['[', t || '링크 텍스트', '](https://)'] },
  { label: '🖼', title: '이미지', apply: (t) => ['![', t || '설명', '](https://)'] },
];

export function MarkdownEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');
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

  return (
    <div className={s.editor}>
      <div className={s.bar}>
        <div className={s.tabs} role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'write'} onClick={() => setTab('write')}>
            작성
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'preview'}
            onClick={() => setTab('preview')}
            onPointerEnter={preloadPreview}
          >
            미리보기
          </button>
        </div>
        {tab === 'write' && (
          <div className={s.tools} role="toolbar" aria-label="서식">
            {ACTIONS.map((a) => (
              <button
                key={a.title}
                type="button"
                title={a.title}
                aria-label={a.title}
                onMouseDown={(e) => e.preventDefault()} // 텍스트 선택이 풀리지 않게
                onClick={() => apply(a)}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {tab === 'write' ? (
        <textarea
          ref={ref}
          className={`${ui.textarea} ${s.textarea}`}
          placeholder={'자유롭게 이야기를 나눠 보세요\n\n**굵게**, # 제목, - 목록, [링크](https://) 같은 마크다운 문법을 쓸 수 있어요'}
          maxLength={20000}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="내용"
        />
      ) : (
        <div className={s.preview}>
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
  );
}

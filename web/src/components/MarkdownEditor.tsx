import { lazy, Suspense, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import { uploadPostImage } from '@loop/shared';
import { flushSync } from 'react-dom';
import { getSettings } from '../lib/settings';
import { findImageToken, imageIndexAt, prepareUpload } from '../lib/postImage';
import { ImageEditLayer } from './ImageEditLayer';
import { ImageIcon } from './Icons';
import { toast } from './Toast';
import { ui } from './ui';
import { cn } from '../lib/cn';
import s from './MarkdownEditor.styles';

// 미리보기를 켜기 전에는 마크다운 파서를 받지 않는다
const Preview = lazy(() => import('./Markdown').then((m) => ({ default: m.Markdown })));
const ImageOnly = lazy(() => import('./Markdown').then((m) => ({ default: m.MarkdownImage })));
const preloadPreview = () => void import('./Markdown');

type Mode = 'write' | 'split' | 'preview';
type Action = { label: string; title: string; apply: (sel: string) => [before: string, text: string, after: string] };

const ACTIONS: Action[] = [
  { label: 'B', title: '굵게 (Ctrl+B)', apply: (t) => ['**', t || '굵은 글씨', '**'] },
  { label: 'I', title: '기울임 (Ctrl+I)', apply: (t) => ['*', t || '기울인 글씨', '*'] },
  { label: 'H', title: '소제목', apply: (t) => ['\n## ', t || '소제목', '\n'] },
  { label: '•', title: '목록', apply: (t) => ['\n- ', t || '항목', '\n'] },
  { label: '“', title: '인용', apply: (t) => ['\n> ', t || '인용문', '\n'] },
  // 코드 블록(``` ```): 여러 줄을 그대로 넣을 수 있다
  { label: '</>', title: '코드 블록', apply: (t) => ['\n```\n', t || '코드', '\n```\n'] },
  { label: '🔗', title: '링크 (Ctrl+K)', apply: (t) => ['[', t || '링크 텍스트', '](https://)'] },
];

/** 사진 파일을 올리고 본문에 넣을 주소를 돌려준다 (긴 변 1920px WebP 로 줄여서) */
async function uploadImageFile(file: File): Promise<string> {
  return (await uploadPostImage(await prepareUpload(file))).url;
}

let uploadSeq = 0;

const SHORTCUTS: Record<string, number> = { b: 0, i: 1, k: 6 };

export function MarkdownEditor({
  value,
  onChange,
  compact,
  maxLength = 20000,
  placeholder = '내용을 입력해 주세요\n\n**굵게**, # 제목, - 목록, [링크](https://) 같은 마크다운 문법을 쓸 수 있어요',
  label = '내용',
}: {
  value: string;
  onChange: (v: string) => void;
  /** 채널 소개처럼 짧은 글: 편집 영역을 낮게 */
  compact?: boolean;
  maxLength?: number;
  placeholder?: string;
  label?: string;
}) {
  // 설정의 기본 보기 방식을 따르되, 좁은 화면에서는 나란히 보기 대신 작성으로 연다
  const [mode, setMode] = useState<Mode>(() => {
    const preferred = getSettings().editorMode;
    return preferred === 'split' && window.innerWidth < 1000 ? 'write' : preferred;
  });
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewHostRef = useRef<HTMLDivElement>(null);
  const panelHostRef = useRef<HTMLDivElement>(null);
  /** 작성 화면에서 커서가 놓인 이미지 (몇 번째) → 아래에 그 이미지 편집 칸을 연다 */
  const [caret, setCaret] = useState<{ index: number; seq: number }>();
  const caretImage = caret?.index;
  const caretToken = caretImage !== undefined ? findImageToken(value, caretImage) : undefined;
  // 사진을 올리는 동안 사용자가 계속 글을 써도 최신 본문에 반영되도록
  const valueRef = useRef(value);
  valueRef.current = value;
  const [uploading, setUploading] = useState(0);
  // 비동기로 고칠 때는 다시 그려지기 전에도 최신 본문을 쓰도록 바로 기억해 둔다
  const setValue = (next: string) => {
    valueRef.current = next;
    onChange(next);
  };

  /**
   * 사진 넣기 (🖼 버튼 · 붙여넣기 · 끌어다 놓기): 커서 자리에 '올리는 중' 표시를 넣고,
   * 다 올라가면 그 자리를 ![](이미지 주소) 로 바꾼다. 실패하면 표시를 지운다.
   */
  const insertImages = (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (!images.length) return;
    const el = ref.current;
    const at = el && mode !== 'preview' ? el.selectionEnd : valueRef.current.length;
    const markers = images.map(() => `[⏳ 이미지 올리는 중… #${++uploadSeq}]`);
    const before = valueRef.current.slice(0, at);
    const pad = before && !before.endsWith('\n') ? '\n' : '';
    setValue(before + pad + markers.join('\n') + '\n' + valueRef.current.slice(at));
    setUploading((n) => n + images.length);
    images.forEach((file, i) => {
      uploadImageFile(file)
        .then((url) => setValue(valueRef.current.replace(markers[i], `![](${url})`)))
        .catch((e: Error) => {
          setValue(valueRef.current.replace(`${markers[i]}\n`, '').replace(markers[i], ''));
          toast(e.message);
        })
        .finally(() => setUploading((n) => n - 1));
    });
  };

  const onPaste = (e: ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files);
    if (files.some((f) => f.type.startsWith('image/'))) {
      e.preventDefault();
      insertImages(files);
    }
  };
  const onDrop = (e: DragEvent) => {
    const files = Array.from(e.dataTransfer.files);
    if (files.some((f) => f.type.startsWith('image/'))) {
      e.preventDefault();
      insertImages(files);
    }
  };

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
          <button
            type="button"
            className={s.tool}
            title="사진 넣기 (붙여넣기 · 끌어다 놓기도 돼요). 넣은 사진 줄을 클릭하면 바로 편집할 수 있어요"
            aria-label="사진 넣기"
            onClick={() => fileRef.current?.click()}
          >
            {uploading > 0 ? '⏳' : <ImageIcon className="w-[18px] h-[18px] mx-auto" />}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              insertImages(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
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
            className={cn(ui.textarea, s.textarea, compact && s.compact)}
            placeholder={placeholder}
            maxLength={maxLength}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPaste={onPaste}
            onDrop={onDrop}
            onSelect={(e) => {
              const i = imageIndexAt(e.currentTarget.value, e.currentTarget.selectionStart);
              if (i !== undefined) preloadPreview();
              setCaret((c) => (i === undefined ? undefined : { index: i, seq: (c?.seq ?? 0) + 1 }));
            }}
            onKeyDown={(e) => {
              const idx = SHORTCUTS[e.key.toLowerCase()];
              if ((e.ctrlKey || e.metaKey) && idx !== undefined) {
                e.preventDefault();
                apply(ACTIONS[idx]);
              }
            }}
            aria-label={label}
          />
        )}
        {mode === 'write' && caretToken && caretImage !== undefined && (
          // 작성 화면에서도 이미지를 바로 고칠 수 있게: 커서가 놓인 이미지만 본문과 같은 너비로 보여 주고 편집 도구를 띄운다
          <div className={s.imagePanel} aria-label="이미지 편집 칸">
            <div className={s.imagePanelHead}>
              <span>이미지 편집 · 꼭짓점을 끌면 크기, 위 메뉴로 자르기·캡션</span>
              <button type="button" className={s.imagePanelClose} aria-label="이미지 편집 칸 닫기" onClick={() => setCaret(undefined)}>
                ✕
              </button>
            </div>
            <div ref={panelHostRef} className={s.imagePanelHost}>
              <Suspense fallback={<div className={ui.spinner} />}>
                <div className={s.imagePanelImage}>
                  <ImageOnly markdown={value.slice(caretToken.start, caretToken.end)} index={caretImage} />
                </div>
              </Suspense>
              <ImageEditLayer hostRef={panelHostRef} source={value} onChange={onChange} uploadFile={uploadImageFile} autoSelect={caret} />
            </div>
          </div>
        )}
        {showPreview && (
          <div
            className={cn(s.preview, compact && s.compactPreview, mode === 'split' && s.previewInSplit)}
            aria-label="미리보기"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
          >
            {value.trim() ? (
              // 미리보기 안의 이미지는 바로 편집할 수 있다 (크기 조절 · 자르기 · 모서리 · 캡션 …)
              <div ref={previewHostRef} className="relative">
                <Suspense fallback={<div className={ui.spinner} />}>
                  <Preview source={value} />
                </Suspense>
                <ImageEditLayer hostRef={previewHostRef} source={value} onChange={onChange} uploadFile={uploadImageFile} />
              </div>
            ) : (
              <p className={s.empty}>미리 볼 내용이 없어요</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

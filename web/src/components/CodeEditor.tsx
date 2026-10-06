import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { EditorSelection, EditorState, RangeSetBuilder, type Extension } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, keymap, placeholder as placeholderExt, type DecorationSet, type KeyBinding, type ViewUpdate } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { tags as t } from '@lezer/highlight';
import { cn } from '../lib/cn';

/** 바깥(마크다운 편집기)에서 쓰는 편집 동작: 선택 영역 읽기 · 바꾸기 · 포커스 */
export interface CodeEditorHandle {
  selection(): { from: number; to: number };
  replace(from: number, to: number, text: string, select?: { from: number; to: number }): void;
  focus(): void;
}

/** 마크다운 문법과 코드 블록 안의 언어 문법 색 (본문 코드 블록 색과 같은 토큰: global.css --code-*) */
const loopHighlight = HighlightStyle.define([
  { tag: t.heading, fontWeight: '700', color: 'var(--text-strong)' },
  { tag: t.strong, fontWeight: '700' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.link, color: 'var(--primary)' },
  { tag: t.url, color: 'var(--primary)' },
  { tag: [t.processingInstruction, t.monospace], color: 'var(--code-fg)' },
  { tag: t.quote, color: 'var(--text-sub)' },
  { tag: [t.keyword, t.operatorKeyword, t.controlKeyword, t.definitionKeyword, t.modifier], color: 'var(--code-keyword)' },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--code-string)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--code-number)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--code-func)' },
  { tag: [t.typeName, t.className, t.tagName, t.standard(t.variableName)], color: 'var(--code-type)' },
  { tag: [t.propertyName, t.attributeName], color: 'var(--code-attr)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--code-comment)', fontStyle: 'italic' },
]);

/** ``` 코드 블록 줄: 고정폭 글꼴 + 배경 띠 (디스코드처럼 쓰는 동안에도 코드처럼 보이게) */
const codeLine = Decoration.line({ class: 'cm-loop-code' });
const fenceLine = Decoration.line({ class: 'cm-loop-code cm-loop-fence' });
const codeBlocks = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged || syntaxTree(u.startState) !== syntaxTree(u.state)) this.decorations = this.build(u.view);
    }
    build(view: EditorView) {
      const builder = new RangeSetBuilder<Decoration>();
      for (const { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
          from,
          to,
          enter: (node) => {
            if (node.name !== 'FencedCode') return;
            const first = view.state.doc.lineAt(node.from).number;
            const last = view.state.doc.lineAt(node.to).number;
            for (let n = first; n <= last; n++) {
              const line = view.state.doc.line(n);
              builder.add(line.from, line.from, n === first || n === last ? fenceLine : codeLine);
            }
            return false;
          },
        });
      }
      return builder.finish();
    }
  },
  { decorations: (v) => v.decorations },
);

const theme = EditorView.theme({
  '&': { backgroundColor: 'var(--surface)', color: 'var(--text)', fontSize: '15px' },
  '&.cm-focused': { outline: 'none', boxShadow: 'inset 0 0 0 2px color-mix(in srgb, var(--primary) 40%, transparent)' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.6' },
  '.cm-content': { padding: '18px 0', caretColor: 'var(--text-strong)' },
  '.cm-line': { padding: '0 20px' },
  '.cm-placeholder': { color: 'var(--text-weak)', whiteSpace: 'pre-wrap' },
  '.cm-cursor': { borderLeftColor: 'var(--text-strong)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'color-mix(in srgb, var(--primary) 22%, transparent) !important',
  },
  '.cm-loop-code': {
    fontFamily: "'JetBrains Mono', 'D2Coding', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    fontSize: '13.5px',
    backgroundColor: 'var(--code-bg)',
  },
  '.cm-loop-fence': { color: 'var(--code-dim)' },
});

/**
 * 마크다운 글쓰기 칸 (CodeMirror). textarea 와 달리 ``` 코드 블록 안을 고정폭 글꼴과 언어별 색으로 보여 준다.
 * ``` 옆에 언어 이름(js, python …)을 쓰면 그 언어 문법으로 칠한다.
 */
export const CodeEditor = forwardRef<
  CodeEditorHandle,
  {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label: string;
    maxLength?: number;
    minHeight: number;
    className?: string;
    /** 커서(선택 끝)가 움직일 때 */
    onCaret?: (pos: number) => void;
    /** 붙여넣기 · 끌어다 놓기로 들어온 파일. true 를 돌려주면 편집기는 아무것도 하지 않는다 */
    onFiles?: (files: File[]) => boolean;
    keys?: KeyBinding[];
  }
>(function CodeEditor({ value, onChange, placeholder, label, maxLength, minHeight, className, onCaret, onFiles, keys = [] }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | undefined>(undefined);
  // 이벤트 처리기는 최신 것을 쓰도록 ref 로
  const latest = useRef({ onChange, onCaret, onFiles });
  latest.current = { onChange, onCaret, onFiles };

  useEffect(() => {
    const extensions: Extension[] = [
      history(),
      keymap.of([...keys, ...defaultKeymap, ...historyKeymap]),
      EditorView.lineWrapping,
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      syntaxHighlighting(loopHighlight),
      codeBlocks,
      theme,
      EditorView.contentAttributes.of({ 'aria-label': label, role: 'textbox', 'aria-multiline': 'true' }),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) latest.current.onChange(u.state.doc.toString());
        if (u.selectionSet || u.docChanged) latest.current.onCaret?.(u.state.selection.main.head);
      }),
      EditorView.domEventHandlers({
        paste: (e) => {
          const files = Array.from(e.clipboardData?.files ?? []);
          if (files.length && latest.current.onFiles?.(files)) {
            e.preventDefault();
            return true;
          }
          return false;
        },
        drop: (e) => {
          const files = Array.from(e.dataTransfer?.files ?? []);
          if (files.length && latest.current.onFiles?.(files)) {
            e.preventDefault();
            return true;
          }
          return false;
        },
      }),
    ];
    if (placeholder) extensions.push(placeholderExt(placeholder));
    if (maxLength) extensions.push(EditorState.changeFilter.of((tr) => tr.newDoc.length <= maxLength));
    view.current = new EditorView({ state: EditorState.create({ doc: value, extensions }), parent: host.current! });
    return () => view.current?.destroy();
    // 처음 한 번만 만든다 (값은 아래에서 맞춘다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 바깥에서 값이 바뀌면(사진 올리기 · 이미지 편집 등) 편집기 내용을 맞춘다
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const current = v.state.doc.toString();
    if (current === value) return;
    const head = Math.min(v.state.selection.main.head, value.length);
    v.dispatch({ changes: { from: 0, to: current.length, insert: value }, selection: EditorSelection.cursor(head) });
  }, [value]);

  useImperativeHandle(ref, () => ({
    selection: () => {
      const r = view.current!.state.selection.main;
      return { from: r.from, to: r.to };
    },
    replace: (from, to, text, select) => {
      const v = view.current!;
      v.dispatch({ changes: { from, to, insert: text }, selection: select ? EditorSelection.range(select.from, select.to) : undefined });
      v.focus();
    },
    focus: () => view.current?.focus(),
  }));

  return <div ref={host} className={cn('resize-y overflow-hidden [&_.cm-editor]:h-full', className)} style={{ minHeight, height: minHeight }} />;
});

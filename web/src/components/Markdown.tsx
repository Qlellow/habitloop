import { memo, useCallback, useEffect, useMemo, useRef, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { marked, type Tokens } from 'marked';
import DOMPurify from 'dompurify';
import { applyImageStyles, parseImageSrc } from '../lib/postImage';

marked.setOptions({ gfm: true, breaks: true });

/** 코드 블록 언어 이름 (``` 옆에 쓴 이름 → 머리줄에 보일 이름) */
const LANG_LABEL: Record<string, string> = {
  js: 'JavaScript', javascript: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', typescript: 'TypeScript', tsx: 'TSX',
  py: 'Python', python: 'Python', java: 'Java', kt: 'Kotlin', kotlin: 'Kotlin', c: 'C', cpp: 'C++', 'c++': 'C++',
  cs: 'C#', csharp: 'C#', go: 'Go', rs: 'Rust', rust: 'Rust', rb: 'Ruby', ruby: 'Ruby', php: 'PHP', swift: 'Swift',
  sql: 'SQL', html: 'HTML', xml: 'XML', css: 'CSS', scss: 'SCSS', json: 'JSON', yaml: 'YAML', yml: 'YAML',
  md: 'Markdown', markdown: 'Markdown', sh: 'Shell', bash: 'Bash', shell: 'Shell', zsh: 'Shell', diff: 'Diff',
  dockerfile: 'Dockerfile', lua: 'Lua', r: 'R', dart: 'Dart', ini: 'INI', toml: 'TOML', txt: 'Text', text: 'Text',
};
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * 코드 블록 문법 강조는 본문에 코드 블록이 있을 때만 highlight.js 를 받아 칠한다 (글 대부분은 코드가 없다).
 * 처음에는 이스케이프한 글자 그대로 그리고, 받은 뒤 ``` 옆의 언어로 칠한다 (모르는 언어면 그대로)
 */
let hljsLoad: Promise<typeof import('highlight.js/lib/common').default> | undefined;
const loadHljs = () => (hljsLoad ??= import('highlight.js/lib/common').then((m) => m.default));

function highlightIn(root: HTMLElement) {
  const blocks = root.querySelectorAll<HTMLElement>('.loop-code code[data-lang]:not([data-hl])');
  if (!blocks.length) return;
  void loadHljs().then((hljs) => {
    blocks.forEach((el) => {
      const language = el.dataset.lang!;
      el.dataset.hl = '1';
      if (!hljs.getLanguage(language)) return;
      el.innerHTML = hljs.highlight(el.textContent ?? '', { language }).value;
    });
  });
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 렌더할 때마다 0 부터 센다: 편집 미리보기가 data-i 로 마크다운의 몇 번째 이미지인지 찾는다
let imageIndex = 0;

/**
 * 이미지: 캡션·크기·자르기 같은 편집 설정(주소 뒤 #)을 data-* 로 옮겨 두고,
 * sanitize 한 뒤에 그 값(숫자만)으로 스타일을 입힌다. 사용자가 style 속성을 직접 넣을 수는 없다.
 */
marked.use({
  renderer: {
    /** 코드 블록: 머리줄(언어 · 복사) + 줄 번호 + 문법 강조된 코드 (디스코드처럼) */
    code({ text, lang }: Tokens.Code) {
      const language = (lang ?? '').trim().split(/\s/)[0].toLowerCase();
      const label = LANG_LABEL[language] ?? (language ? language : '코드');
      const lines = text.replace(/\n$/, '').split('\n').length;
      const nums = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
      return (
        '<div class="loop-code">' +
        `<div class="loop-code-head"><span class="loop-code-lang">${escapeHtml(label)}</span>` +
        '<span class="loop-code-copy" role="button" tabindex="0" data-copy="1">복사</span></div>' +
        `<div class="loop-code-body"><pre class="loop-code-nums" aria-hidden="true">${nums}</pre>` +
        // 문법 강조는 그린 뒤에 (highlightIn). data-lang 은 sanitize 를 거쳐도 남는다
        `<pre><code class="hljs${language ? ` language-${escapeHtml(language)}" data-lang="${escapeHtml(language)}` : ''}">${escapeHtml(text.replace(/\n$/, ''))}</code></pre></div></div>`
      );
    },
    image({ href, text }: Tokens.Image) {
      const { url } = parseImageSrc(href);
      const caption = text.trim();
      return (
        `<span class="loop-img" data-i="${imageIndex++}" data-src="${escapeAttr(href)}">` +
        `<span class="loop-img-frame"><img src="${escapeAttr(url)}" alt="${escapeAttr(caption)}"></span>` +
        (caption ? `<span class="loop-img-cap">${escapeAttr(caption)}</span>` : '') +
        '</span>'
      );
    },
  },
});

/**
 * 블라인드: ||가릴 문장|| 은 가려 두었다가 누르면 드러난다 (퀴즈 · 반전 · 스포일러 방지).
 * 여는 || 바로 뒤와 닫는 || 바로 앞은 공백이 아니어야 한다 (표의 빈 칸 '| |' 과 헷갈리지 않게)
 */
marked.use({
  extensions: [
    {
      name: 'blind',
      level: 'inline',
      start: (src: string) => src.indexOf('||'),
      tokenizer(src: string) {
        const m = /^\|\|(?=\S)([\s\S]*?\S)\|\|/.exec(src);
        if (!m) return undefined;
        return { type: 'blind', raw: m[0], tokens: this.lexer.inlineTokens(m[1]) };
      },
      renderer(token) {
        return `<span class="loop-blind" role="button" tabindex="0" aria-label="가려진 내용 (눌러서 보기)">${this.parser.parseInline(token.tokens ?? [])}</span>`;
      },
    },
  ],
});

/** 이 사이트 안을 가리키는 링크면 경로(/c/free?x=1#y)를, 아니면 null */
function internalPath(href: string | null): string | null {
  if (!href) return null;
  if (href.startsWith('/') && !href.startsWith('//')) return href;
  try {
    const url = new URL(href);
    return url.origin === location.origin ? url.pathname + url.search + url.hash : null;
  } catch {
    return null;
  }
}

// 사용자가 쓴 마크다운은 HTML 로 바뀌므로 반드시 sanitize 해서 스크립트 삽입(XSS)을 막는다
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    // 이 사이트 안 링크(/posts/1 · 이 사이트 주소)는 지금 탭에서 바로 옮겨 가고, 바깥 링크만 새 탭으로 연다
    const path = internalPath(node.getAttribute('href'));
    if (path) {
      node.setAttribute('href', path);
      node.setAttribute('data-internal', '');
    } else {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer nofollow');
    }
  }
  if (node.tagName === 'IMG') {
    // 본문 이미지는 화면에 가까워질 때 받는다
    node.setAttribute('loading', 'lazy');
    node.setAttribute('decoding', 'async');
    node.setAttribute('referrerpolicy', 'no-referrer');
  }
});

export function renderMarkdown(source: string): string {
  imageIndex = 0;
  const body = DOMPurify.sanitize(marked.parse(source, { async: false }), {
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe'],
    FORBID_ATTR: ['style'],
    RETURN_DOM: true,
  }) as HTMLElement;
  // 편집 설정은 sanitize 를 거친 data-src 에서 숫자로만 다시 읽어 스타일로 바꾼다
  body.querySelectorAll<HTMLElement>('.loop-img[data-src]').forEach((el) => {
    applyImageStyles(el, parseImageSrc(el.dataset.src ?? '').params);
  });
  return body.innerHTML;
}

/**
 * 본문 안의 누를 수 있는 것 (본문은 HTML 로 그리므로 눌린 곳을 찾아서 처리한다):
 * 블라인드는 드러내고(다시 누르면 가린다), 코드 블록의 '복사'는 복사한다
 */
function onBodyClick(e: MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>, navigate: (to: string) => void) {
  if ('key' in e && e.key !== 'Enter' && e.key !== ' ') return;
  // 사이트 안 링크: 새로 불러오지 않고 앱 안에서 옮겨 간다 (Ctrl · ⌘ · 가운데 버튼은 브라우저대로 새 탭)
  const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-internal]');
  if (link && !link.closest('.loop-blind:not(.is-open)')) {
    if ('key' in e || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(link.getAttribute('href') ?? '/');
    return;
  }
  const blind = (e.target as HTMLElement).closest<HTMLElement>('.loop-blind');
  if (blind) {
    // 드러난 블라인드 안의 링크는 그대로 열린다
    if (blind.classList.contains('is-open') && (e.target as HTMLElement).closest('a')) return;
    e.preventDefault();
    const open = blind.classList.toggle('is-open');
    blind.setAttribute('aria-label', open ? '드러난 내용 (눌러서 다시 가리기)' : '가려진 내용 (눌러서 보기)');
    return;
  }
  const button = (e.target as HTMLElement).closest<HTMLElement>('[data-copy]');
  const code = button?.closest('.loop-code')?.querySelector('pre:not(.loop-code-nums) code');
  if (!button || !code) return;
  e.preventDefault();
  void navigator.clipboard.writeText(code.textContent ?? '').then(
    () => {
      button.textContent = '복사됨';
      button.dataset.copied = '1';
      window.setTimeout(() => {
        button.textContent = '복사';
        delete button.dataset.copied;
      }, 1500);
    },
    () => (button.textContent = '복사 못 함'),
  );
}

/** 같은 본문이면 다시 파싱하지 않도록 memo + useMemo */
export const Markdown = memo(function Markdown({ source, className }: { source: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(source), [source]);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const onClick = useCallback((e: MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>) => onBodyClick(e, navigate), [navigate]);
  useEffect(() => {
    if (ref.current) highlightIn(ref.current);
  }, [html]);
  return (
    <div
      ref={ref}
      className={className ? `prose ${className}` : 'prose'}
      onClick={onClick}
      onKeyDown={onClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

/**
 * 작성 화면의 이미지 편집 칸: 이미지 하나만 본문과 같은 모양으로 그린다.
 * 편집 도구가 본문의 몇 번째 이미지인지 찾을 수 있게 data-i 를 그 순서로 바꿔 둔다.
 */
export const MarkdownImage = memo(function MarkdownImage({ markdown, index }: { markdown: string; index: number }) {
  const html = useMemo(() => renderMarkdown(markdown).replace('data-i="0"', `data-i="${index}"`), [markdown, index]);
  return <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />;
});

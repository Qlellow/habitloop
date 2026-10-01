import { memo, useMemo } from 'react';
import { marked, type Tokens } from 'marked';
import DOMPurify from 'dompurify';
import { applyImageStyles, parseImageSrc } from '../lib/postImage';

marked.setOptions({ gfm: true, breaks: true });

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 렌더할 때마다 0 부터 센다: 편집 미리보기가 data-i 로 마크다운의 몇 번째 이미지인지 찾는다
let imageIndex = 0;

/**
 * 이미지: 캡션·크기·자르기 같은 편집 설정(주소 뒤 #)을 data-* 로 옮겨 두고,
 * sanitize 한 뒤에 그 값(숫자만)으로 스타일을 입힌다. 사용자가 style 속성을 직접 넣을 수는 없다.
 */
marked.use({
  renderer: {
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

// 사용자가 쓴 마크다운은 HTML 로 바뀌므로 반드시 sanitize 해서 스크립트 삽입(XSS)을 막는다
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer nofollow');
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

/** 같은 본문이면 다시 파싱하지 않도록 memo + useMemo */
export const Markdown = memo(function Markdown({ source, className }: { source: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(source), [source]);
  return <div className={className ? `prose ${className}` : 'prose'} dangerouslySetInnerHTML={{ __html: html }} />;
});

/**
 * 작성 화면의 이미지 편집 칸: 이미지 하나만 본문과 같은 모양으로 그린다.
 * 편집 도구가 본문의 몇 번째 이미지인지 찾을 수 있게 data-i 를 그 순서로 바꿔 둔다.
 */
export const MarkdownImage = memo(function MarkdownImage({ markdown, index }: { markdown: string; index: number }) {
  const html = useMemo(() => renderMarkdown(markdown).replace('data-i="0"', `data-i="${index}"`), [markdown, index]);
  return <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />;
});

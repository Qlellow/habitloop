export const EXCERPT_LENGTH = 150;

/** 목록 미리보기: 마크다운 문법 기호를 걷어내고 150자(length)로 자른다 (순서대로 적용) */
export function makeExcerpt(content: string, length = EXCERPT_LENGTH): string {
  const text = content
    .replace(/```[^\n]*\n?|~~~[^\n]*\n?/g, '')
    .replace(/!\[([^\]]*)]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/^\s*([-*_]\s*){3,}$/gm, '')
    .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+\[[ xX]]\s+|[-*+]\s+|\d+[.)]\s+)/gm, '')
    .replace(/(\*\*|__|~~|`|\*)/g, '')
    .replace(/<[^>]+>/g, '');
  const flat = text.trim().replace(/\s+/g, ' ');
  return [...flat].length <= length ? flat : [...flat].slice(0, length).join('');
}

export const EXCERPT_LENGTH = 150;

/** 목록 미리보기: 마크다운 문법 기호를 걷어내고 150자(length)로 자른다 (순서대로 적용) */
export function makeExcerpt(content: string, length = EXCERPT_LENGTH): string {
  const text = content
    // 블라인드(||가릴 내용||)는 목록 미리보기에서도 드러나지 않게
    .replace(/\|\|(?=\S)[\s\S]*?\S\|\|/g, '▒▒▒')
    // 본문에 쓴 <script> · <style> 같은 HTML 은 화면에서 지워지므로 그 안의 글자도 요약에 넣지 않는다
    .replace(/<(script|style|iframe|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/```[^\n]*\n?|~~~[^\n]*\n?/g, '')
    .replace(/!\[([^\]]*)]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/^\s*([-*_]\s*){3,}$/gm, '')
    .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+\[[ xX]]\s+|[-*+]\s+|\d+[.)]\s+)/gm, '')
    // 표: 구분줄(| --- | :-: |)은 지우고 칸 사이 | 는 띄어쓰기로
    .replace(/^\s*\|?(\s*:?-+:?\s*\|)+\s*(:?-+:?)?\s*$/gm, '')
    .replace(/\s*\|\s*/g, ' ')
    .replace(/(\*\*|__|~~|`|\*)/g, '')
    .replace(/<[^>]+>/g, '');
  const flat = text.trim().replace(/\s+/g, ' ');
  return [...flat].length <= length ? flat : [...flat].slice(0, length).join('');
}

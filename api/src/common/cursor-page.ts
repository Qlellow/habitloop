/**
 * 키셋(커서) 페이지네이션 응답. OFFSET 없이 마지막 id 기준으로 다음 페이지를 조회하므로
 * 페이지가 깊어져도 조회 비용이 일정하다.
 */
export interface CursorPage<T> {
  items: T[];
  nextCursor?: number;
}

/** size + 1 개를 조회한 결과로 다음 페이지가 있는지 판단한다 */
export function cursorPage<T extends { id: number }>(fetched: T[], size: number): CursorPage<T> {
  if (fetched.length <= size) return { items: fetched };
  const items = fetched.slice(0, size);
  return { items, nextCursor: items[size - 1].id };
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** 쿼리 파라미터 정수 (없거나 숫자가 아니면 undefined) */
export function intParam(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isInteger(n) ? n : undefined;
}

/** LIKE 검색어의 \ % _ 를 글자 그대로 찾도록 이스케이프 (ESCAPE '\') */
export function escapeLike(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

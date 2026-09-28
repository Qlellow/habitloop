import type { Category } from '../api/types';

// 서버의 enum 과 같은 값. 정적인 데이터라 요청 없이 번들에 포함한다.
export const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'FREE', label: '자유' },
  { value: 'QUESTION', label: '질문' },
  { value: 'INFO', label: '정보' },
  { value: 'DAILY', label: '일상' },
];

export const CATEGORY_LABEL: Record<Category, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label]),
) as Record<Category, string>;

export function isCategory(value: string | null): value is Category {
  return value != null && value in CATEGORY_LABEL;
}

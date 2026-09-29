import { twMerge } from 'tailwind-merge';

/** 클래스 합치기. 뒤에 온 클래스가 앞의 같은 속성을 덮어쓴다 (예: cn('bg-field', 'bg-primary') → 'bg-primary') */
export function cn(...classes: (string | false | null | undefined)[]) {
  return twMerge(classes.filter(Boolean).join(' '));
}

import { twMerge } from 'tailwind-merge';

/**
 * Tailwind 클래스 합치기. 부딪히는 클래스(h-10 과 h-8 등)는 뒤에 쓴 것이 이긴다.
 * 예) cn(ui.button, ui.small, active && 'text-primary')
 */
export function cn(...classes: (string | false | null | undefined)[]) {
  return twMerge(classes.filter(Boolean).join(' '));
}

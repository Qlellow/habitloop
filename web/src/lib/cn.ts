import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind.config.js 에 새로 만든 값을 tailwind-merge 에도 알려 준다.
 * 모르는 값(max-w-page 등)은 같은 속성으로 보지 않아 두 클래스가 모두 남고, 그러면 CSS 순서에 따라 엉뚱한 값이 이긴다.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'max-w': [{ 'max-w': ['page'] }],
      h: [{ h: ['header'] }],
      shadow: [{ shadow: ['pop', 'glow'] }],
      animate: [{ animate: ['pop', 'toast-in', 'fade-up'] }],
      ease: [{ ease: ['toss'] }],
    },
  },
});

/** 클래스 합치기. 같은 속성이면 뒤에 온 클래스가 앞의 것을 덮어쓴다 (예: cn(ui.button, ui.small)) */
export function cn(...classes: (string | false | null | undefined)[]) {
  return twMerge(classes.filter(Boolean).join(' '));
}

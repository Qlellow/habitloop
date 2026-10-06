/** 글 목록 (Tailwind) */
const s = {
  list: 'list-none m-0 p-0',
  // 화면 밖 항목은 레이아웃/페인트를 건너뛰어 긴 목록에서도 스크롤이 가볍다.
  // 구분선은 카드 끝까지 긋지 않고 좌우를 본문 여백(20px)만큼 들인다.
  item:
    '[content-visibility:auto] [contain-intrinsic-size:auto_118px] ' +
    "[&:not(:first-child)]:before:content-[''] [&:not(:first-child)]:before:block [&:not(:first-child)]:before:h-px " +
    '[&:not(:first-child)]:before:mx-5 [&:not(:first-child)]:before:bg-line',
  link: 'group block px-5 py-4 transition-colors hover:bg-pressed',
  meta: 'flex items-center gap-1.5 min-h-5 text-[13px] text-fg-weak',
  time: 'ml-auto flex-none',
  author: 'mt-1.5 max-w-full inline-flex items-center gap-1.5 text-[13px] text-fg-sub font-medium',
  // 제목·내용(왼쪽)과 공감·댓글·조회(오른쪽 아래)
  bottom: 'flex items-end gap-4 mt-1 max-[520px]:flex-col max-[520px]:items-stretch max-[520px]:gap-1.5',
  badge: 'font-semibold text-primary',
  title: 'mt-1 mb-0.5 text-base font-semibold leading-[1.45] text-fg-strong transition-colors group-hover:text-primary',
  excerpt: 'm-0 text-sm text-fg-sub line-clamp-2',
  stats: 'flex-none flex items-center gap-3 text-[13px] text-fg-weak max-[520px]:justify-end',
  stat: 'inline-flex items-center gap-[3px] [&>svg]:w-3.5 [&>svg]:h-3.5',
  sentinel: 'h-px',
  skeletonItem: 'px-5 py-4 [&:not(:first-child)]:shadow-[inset_0_1px_0_var(--line)]',
};

export default s;

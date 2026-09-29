/** 왼쪽 채널 사이드바 · 오른쪽 인기글 카드 (Tailwind) */
const s = {
  block: 'py-1',
  heading: 'm-0 px-2.5 pt-1.5 pb-2 text-[13px] font-bold text-fg-weak',
  section: 'mb-3.5 pb-2.5 border-b border-border',
  hint: 'm-0 px-2.5 pt-0.5 pb-1.5 text-[13px] text-fg-weak',
  list: 'list-none m-0 p-0',
  channel:
    'flex items-center gap-2.5 px-2.5 py-[7px] rounded-sm text-[15px] font-medium text-fg transition-colors ' +
    'hover:bg-field aria-[current=page]:bg-primary-weak aria-[current=page]:text-primary aria-[current=page]:font-bold',
  channelName: 'flex-1 min-w-0 truncate',
  more: 'block px-2.5 py-2 text-sm font-medium text-fg-sub hover:text-primary',
  rank: 'flex items-baseline gap-3 px-5 py-2.5 transition-colors hover:bg-pressed [li:last-child>&]:pb-4',
  rankNo: 'flex-none w-4 font-bold text-primary',
  rankBody: 'flex-1 min-w-0',
  rankTitle: 'line-clamp-2 text-[15px] font-medium text-fg-strong',
  rankMeta: 'block text-[13px] text-fg-weak',
};

export default s;

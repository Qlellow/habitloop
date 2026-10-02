/** 글쓰기 (Tailwind) */
const s = {
  head: 'flex items-center justify-between gap-4',
  channel: 'group flex items-center gap-2.5 [&>span:last-child]:flex [&>span:last-child]:flex-col',
  channelName: 'text-[17px] font-bold text-fg-strong group-hover:text-primary',
  channelSlug: 'text-[13px] text-fg-weak',
  // 카테고리 드롭다운 + 제목을 한 줄에 (좁은 화면에서는 위아래로)
  titleRow: 'flex gap-2 mb-4 max-[600px]:flex-col',
  categoryRow: 'flex flex-wrap items-center gap-1.5 mb-4',
  categoryLabel: 'mr-1.5 text-sm font-semibold text-fg-sub',
  categoryChip:
    'inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border text-sm font-semibold text-fg-sub transition-colors ' +
    'hover:bg-field hover:text-fg-strong aria-checked:border-primary aria-checked:bg-primary-weak aria-checked:text-primary ' +
    '[&_span]:text-[11px] [&_span]:py-0 [&_span]:px-1.5',
  title: 'flex-1 min-w-0 h-[46px] text-lg font-semibold',
  // 팔로우 안내
  gate: 'flex flex-col items-center px-6 py-14 text-center',
  gateTitle: 'mt-[18px] mb-1.5 text-xl font-bold text-fg-strong',
  gateDesc: 'mt-0 mb-6 text-fg-sub',
  gateActions: 'flex flex-wrap justify-center gap-2',
};

export default s;

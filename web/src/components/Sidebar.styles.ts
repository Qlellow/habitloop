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
  // 인기 채널: hover 배경은 SlideHover 가 그린다
  popularChannel:
    'flex items-center gap-2.5 px-2.5 py-[7px] rounded-sm text-[15px] font-medium text-fg ' +
    'aria-[current=page]:bg-primary-weak aria-[current=page]:text-primary aria-[current=page]:font-bold',
  trophy: 'flex-none grid place-items-center w-5 [&>svg]:w-5 [&>svg]:h-5',
  channelName: 'flex-1 min-w-0 truncate',
  more: 'block px-2.5 py-2 text-sm font-medium text-fg-sub hover:text-primary',
  // 왼쪽 사이드바가 숨는 폭(1100px 이하)에서 홈 본문 위에 보이는 가로 채널 줄
  strip: 'hidden max-[1100px]:block',
  stripHead: 'flex items-baseline justify-between px-1 mb-2',
  stripTitle: 'm-0 text-[13px] font-bold text-fg-weak',
  stripMore: 'text-[13px] font-medium text-fg-sub hover:text-primary',
  stripList:
    'flex gap-2 overflow-x-auto list-none m-0 p-0 pb-1 -mx-4 px-4 ' +
    '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
  stripItem:
    'flex-none flex items-center gap-2 h-10 pl-1.5 pr-3.5 rounded-full border border-border bg-surface ' +
    'text-[14px] font-semibold text-fg whitespace-nowrap transition-colors hover:bg-field',
  stripBadge: 'text-[11px] font-bold text-primary',
  // 인기글: hover 배경은 SlideHover 가 그린다 (인기 채널과 같은 둥근 상자). 글자는 카드 제목과 같은 줄(20px)에서 시작
  rankList: 'px-2.5 pb-2.5',
  rank: 'flex items-center gap-3 px-2.5 py-2.5 rounded-sm',
  rankNo: 'flex-none w-5 text-center text-[15px] font-bold text-fg-weak',
  rankBody: 'flex-1 min-w-0',
  rankTitle: 'line-clamp-2 text-[15px] font-medium text-fg-strong',
  rankMeta: 'block text-[13px] text-fg-weak',
};

export default s;

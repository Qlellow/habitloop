/** 채널 목록: 채널 카드 + 최근 글 미리보기 (Tailwind) */
const s = {
  tools: 'flex items-center gap-2 max-[860px]:flex-wrap',
  // 채널 검색칸은 헤더 검색이 숨는 폰(520px 이하)에서만 보인다
  search: 'relative hidden max-[520px]:block max-[520px]:w-full',
  searchIcon: 'absolute left-0.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-fg-weak pointer-events-none peer-focus:text-primary',
  board: 'flex flex-col overflow-hidden rounded-lg border border-border bg-surface',
  head: 'group flex items-center gap-3 px-[18px] pt-4 pb-3',
  headText: 'flex-1 min-w-0 flex flex-col',
  name: 'text-[17px] font-bold text-fg-strong transition-colors group-hover:text-primary',
  joined: 'ml-2 px-[7px] py-px rounded-[5px] bg-primary-weak text-primary text-xs font-semibold align-[2px]',
  meta: 'text-[13px] text-fg-weak',
  go: 'text-[22px] text-fg-weak',
  desc: '-mt-1 mx-[18px] mb-2.5 text-sm text-fg-sub truncate',
  list: 'list-none m-0 pt-1 pb-2 border-t border-line',
  row: 'group flex items-center gap-1.5 px-[18px] py-[7px] text-sm transition-colors hover:bg-pressed',
  badge: 'flex-none px-1.5 rounded-[5px] bg-field text-xs font-semibold leading-5 text-fg-sub',
  title: 'min-w-0 truncate text-fg',
  comments: 'flex-none text-[13px] font-semibold text-primary',
  time: 'flex-none ml-auto pl-2 text-xs text-fg-weak',
  empty: 'm-0 px-[18px] pt-[22px] pb-[26px] border-t border-line text-sm text-center text-fg-weak',
  more: 'block px-[18px] py-[11px] border-t border-line text-[13px] font-semibold text-fg-sub text-center hover:text-primary hover:bg-pressed',
};

export default s;

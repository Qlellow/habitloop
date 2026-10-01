/** 헤더 채널 검색 드롭다운 (Tailwind) */
const s = {
  // 폰(520px 이하)에서는 헤더에서 빼고 채널 페이지 안의 검색칸을 쓴다
  root: 'relative flex-1 min-w-[120px] max-w-[440px] max-[520px]:hidden',
  icon: 'absolute left-3 top-5 -translate-y-1/2 w-[18px] h-[18px] text-fg-weak pointer-events-none z-[1]',
  input: 'h-10 pl-[38px] rounded-md',
  // 좁은 화면에서는 드롭다운을 화면 폭에 맞춘다
  menu:
    'absolute z-40 top-[calc(100%+6px)] inset-x-0 overflow-hidden rounded-md border border-border bg-surface shadow-pop ' +
    'animate-pop max-[520px]:fixed max-[520px]:top-[calc(64px+4px)] max-[520px]:inset-x-3',
  // 결과가 많아도 화면을 덮지 않도록 높이를 제한하고 안에서 스크롤
  list: 'list-none m-0 p-1.5 max-h-[min(360px,calc(100vh-64px-40px))] overflow-y-auto overscroll-contain',
  item: 'flex items-center gap-2.5 px-2.5 py-2 rounded-sm cursor-pointer',
  active: 'bg-field',
  body: 'min-w-0 flex flex-col',
  name: 'text-[15px] font-semibold text-fg-strong truncate',
  mark: 'bg-transparent text-primary font-extrabold',
  meta: 'text-xs text-fg-weak truncate',
  empty: 'px-2.5 py-4 text-sm text-fg-weak text-center',
  all: 'mt-1 p-2.5 border-t border-line rounded-b-sm text-[13px] font-semibold text-fg-sub cursor-pointer',
  allActive: 'bg-field text-primary',
};

export default s;

/** 마이페이지 (Tailwind) */
const s = {
  // 왼쪽 메뉴 (좁은 화면에서는 가로 탭처럼)
  side: 'pt-[18px] px-3 pb-3 max-[860px]:p-3',
  me: 'flex items-center gap-2.5 px-1.5 pb-3.5 mb-2 border-b border-line',
  avatar: 'flex-none grid place-items-center w-10 h-10 rounded-full bg-primary-weak text-primary font-bold',
  meText: 'min-w-0',
  nickname: 'font-bold text-fg-strong truncate',
  email: 'text-[13px] text-fg-weak truncate',
  menu: 'list-none m-0 p-0 max-[860px]:flex max-[860px]:gap-1 max-[860px]:overflow-x-auto',
  link:
    'block w-full px-2.5 py-[9px] rounded-sm text-[15px] font-medium text-fg-sub text-left transition-colors ' +
    // hover 배경은 SlideHover 가 그린다 (항목 사이를 미끄러져 움직임)
    'hover:text-fg-strong aria-[current=page]:bg-primary-weak aria-[current=page]:text-primary ' +
    'aria-[current=page]:font-bold max-[860px]:whitespace-nowrap',
  logoutButton: 'text-danger-text hover:text-danger-text',
  logout: 'mt-2 pt-2 border-t border-line max-[860px]:m-0 max-[860px]:p-0 max-[860px]:border-0',

  // 공통 섹션
  head: 'mb-1',
  title: 'm-0 text-[22px] font-bold text-fg-strong',
  desc: 'mt-1 mb-0 text-sm text-fg-sub',
  section: 'px-6 py-[22px]',
  sectionTitle: 'mt-0 mb-1 text-[17px] font-bold text-fg-strong',
  sectionDesc: 'mt-0 mb-4 text-sm text-fg-sub',
  row: 'flex items-stretch gap-2 [&>button]:h-auto [&>input]:flex-1 [&>input]:min-w-0',
  readonly: 'px-3.5 py-[11px] rounded-sm bg-field text-fg-sub',
  actions: 'flex justify-end mt-1',

  // 채널 목록 (구분선은 좌우를 들여서)
  channelList: 'list-none m-0 pb-1.5',
  channelItem: '[&:not(:first-child)]:mx-5 [&:not(:first-child)]:shadow-[inset_0_1px_0_var(--line)]',
  channel: 'flex items-center gap-3 px-5 py-3 [li:not(:first-child)>&]:px-0',
  channelLink: 'group flex-1 min-w-0 flex items-center gap-3',
  channelBody: 'min-w-0 flex flex-col',
  channelName: 'font-bold text-fg-strong group-hover:text-primary',
  channelMeta: 'text-[13px] text-fg-weak truncate',

  // 설정
  option:
    'flex items-center justify-between gap-4 py-4 [&:not(:first-of-type)]:shadow-[inset_0_1px_0_var(--line)] ' +
    'max-[860px]:flex-col max-[860px]:items-start',
  optionLabel: 'font-semibold text-fg-strong',
  optionDesc: 'text-[13px] text-fg-weak',
  sessionList: 'list-none m-0 mb-1 p-0 rounded-md bg-pressed',
  session: 'flex items-center gap-3 px-4 py-3 [&:not(:first-child)]:shadow-[inset_0_1px_0_var(--line)]',
  sessionIcon: 'flex-none grid place-items-center w-9 h-9 rounded-full bg-surface text-lg',
  inlineForm: 'flex flex-col gap-2.5 mt-1 mb-2 p-4 rounded-md bg-pressed',
  inlineActions: 'flex items-center gap-1.5',
  segment: 'flex-none inline-flex p-[3px] rounded-sm bg-field',
  segmentButton:
    'h-8 px-3.5 rounded text-sm font-semibold text-fg-sub ' +
    'aria-checked:bg-surface aria-checked:text-fg-strong aria-checked:shadow-[0_1px_2px_rgba(0,0,0,0.08)]',
  switch:
    "relative flex-none w-[46px] h-7 rounded-[14px] bg-fg-weak transition-colors after:content-[''] after:absolute " +
    'after:top-[3px] after:left-[3px] after:w-[22px] after:h-[22px] after:rounded-full after:bg-white ' +
    'after:shadow-[0_1px_3px_rgba(0,0,0,0.2)] after:transition-transform aria-checked:bg-primary aria-checked:after:translate-x-[18px]',
};

export default s;

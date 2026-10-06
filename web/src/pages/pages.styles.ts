/** 여러 페이지가 함께 쓰는 조각: 페이지 머리, 채널 배너, 글 본문, 댓글, 폼, 로그인, 채널 관리 (Tailwind) */
const divider =
  "[&:not(:first-child)]:before:content-[''] [&:not(:first-child)]:before:block [&:not(:first-child)]:before:h-px " +
  '[&:not(:first-child)]:before:bg-line';

const s = {
  // 페이지 머리
  pageHead: 'flex flex-wrap items-end justify-between gap-4 mb-1',
  pageTitle: 'm-0 text-2xl font-bold text-fg-strong',
  pageDesc: 'mt-1 mb-0 text-fg-sub',

  // 채널 배너
  banner: 'px-6 pt-6 pb-3',
  bannerTop: 'flex flex-wrap items-center gap-x-4 gap-y-3',
  bannerInfo: 'flex-1 min-w-[120px]',
  bannerName: 'm-0 text-2xl font-bold text-fg-strong',
  bannerSlug: 'text-sm text-fg-weak whitespace-nowrap',
  bannerActions: 'flex gap-2',

  // 글 본문
  article: 'px-8 py-7 max-[860px]:px-[18px] max-[860px]:py-[22px]',
  crumbs: 'flex items-center gap-1.5 text-sm text-fg-weak [&_a]:font-semibold [&_a]:text-primary [&_a:hover]:underline',
  title: 'mt-2 mb-4 text-[28px] font-bold leading-[1.35] text-fg-strong max-[860px]:text-[23px]',
  byline: 'flex items-center gap-2.5 pb-5 border-b border-line',
  avatar: 'flex-none grid place-items-center w-[38px] h-[38px] rounded-full bg-primary-weak text-primary font-bold',
  bylineName: 'flex items-center gap-1.5 font-semibold text-fg-strong',
  bylineMeta: 'text-[13px] text-fg-weak',
  bylineActions: 'ml-auto flex gap-1',
  content: 'mt-6 mb-8 min-h-20',
  reactions: 'flex justify-center',
  likeButton:
    'inline-flex items-center gap-2 h-11 px-5 rounded-md border border-border bg-surface font-semibold text-fg-sub transition-colors ' +
    'hover:border-danger hover:text-danger aria-pressed:border-danger aria-pressed:bg-danger-weak aria-pressed:text-danger ' +
    '[&>svg]:w-5 [&>svg]:h-5',

  // 댓글
  composer: 'px-5 pb-4 [&_textarea]:min-h-[84px]',
  composerFoot: 'flex items-center justify-between mt-2 [&>button]:ml-auto text-[13px] text-fg-weak',
  loginPrompt: 'mx-5 mt-0 mb-4 p-4 rounded-md bg-field text-center text-fg-sub [&_a]:text-primary [&_a]:font-semibold',
  comments: 'list-none m-0 p-0 border-t border-line',
  // 구분선은 좌우를 본문 여백만큼 들인다 (padding 안쪽에 그려짐)
  comment: `px-5 py-3.5 ${divider} [&:not(:first-child)]:before:-mt-3.5 [&:not(:first-child)]:before:mb-3.5`,
  commentHead: 'flex items-center gap-2 text-sm',
  commentAuthor: 'inline-flex items-center gap-1.5 font-semibold text-fg-strong',
  commentTime: 'text-[13px] text-fg-weak',
  commentBody: 'mt-1 mb-2 whitespace-pre-wrap',
  commentActions: 'flex items-center gap-1',
  commentLike:
    'inline-flex items-center gap-1 h-7 pl-2 pr-2.5 rounded-sm text-[13px] font-semibold text-fg-sub transition-colors ' +
    'hover:bg-field aria-pressed:text-danger [&>svg]:w-[15px] [&>svg]:h-[15px]',
  commentAction: 'px-2 py-1 rounded-sm text-[13px] text-fg-weak hover:bg-field hover:text-fg-sub',
  // 삭제는 로그아웃처럼 항상 빨강 (다크 테마는 밝은 빨강)
  commentDelete: 'px-2 py-1 rounded-sm text-[13px] text-danger-text hover:bg-danger-weak',
  bestList:
    'list-none mx-5 mt-0 mb-4 py-0.5 rounded-md bg-primary-weak ' +
    '[&>li:not(:first-child)]:before:bg-[color-mix(in_srgb,var(--primary)_14%,transparent)]',
  bestBadge: 'px-[7px] py-px rounded-sm bg-primary text-white text-[11px] font-extrabold',

  // 폼
  formCard: 'px-8 pt-7 pb-8 max-[860px]:px-[18px] max-[860px]:py-[22px]',
  formFoot: 'flex justify-end gap-2 mt-5',
  iconPicker: 'flex items-center gap-4',
  staffList: 'list-none m-0 p-0',
  staffRow: 'flex items-center justify-between gap-3 py-2.5 border-t border-line first:border-t-0',
  staffName: 'flex items-center gap-1.5 min-w-0 font-semibold text-fg-strong',
  staffRole: 'text-sm text-fg-weak',
  staffSearch: 'mt-3 pt-4 border-t border-border flex flex-col gap-1',
  roleSegment: 'inline-flex p-[3px] rounded-[7px] bg-field',
  segmentButton:
    'h-7 px-3 rounded-[5px] text-[13px] font-semibold text-fg-sub hover:text-fg-strong disabled:opacity-60 ' +
    'aria-pressed:bg-surface aria-pressed:text-fg-strong aria-pressed:shadow-[0_1px_2px_rgba(0,0,0,0.08)]',
  iconPickerBody: 'flex flex-col gap-2 min-w-0',
  iconPickerActions: 'flex flex-wrap gap-1.5',

  // 채널 카드 (사이드바)
  sideChannel: 'p-5',
  sideChannelTop: 'flex items-center gap-3 mb-2.5',
  sideChannelName: 'text-[17px] font-bold text-fg-strong',
  sideChannelDesc: 'mt-0 mb-3.5 text-sm text-fg-sub line-clamp-3',

  // 채널 관리
  settingsSection: 'p-6',
  settingsTitle: 'mt-0 mb-1 text-lg font-bold text-fg-strong',
  settingsDesc: 'mt-0 mb-4 text-sm text-fg-sub',
  catTable: 'list-none mt-0 mb-4 p-0 border border-border rounded-md overflow-hidden',
  catRow: 'flex items-center gap-2.5 min-h-14 px-3 py-2 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-line',
  catName: 'flex-1 min-w-0 flex items-center gap-2 font-semibold text-fg-strong',
  catEdit: 'flex-1 flex flex-wrap items-center gap-2.5',
  input: 'flex-1 min-w-[160px]',
  toggle:
    'inline-flex items-center gap-1.5 text-sm font-medium text-fg cursor-pointer whitespace-nowrap ' +
    '[&_input]:w-4 [&_input]:h-4 [&_input]:accent-primary',
  addRow: 'flex flex-wrap items-center gap-2.5 [&>input]:flex-1 [&>input]:min-w-[200px]',
};

export default s;

/** 헤더 · 사용자 메뉴 · 페이지 그리드 · 토스트 (Tailwind) */
const s = {
  // 85% 불투명 + 뒤를 강하게 흐리게. 경계선 없이 아래 띠(.header-fade)로 블러가 서서히 옅어진다
  header:
    'sticky top-0 z-30 bg-[color-mix(in_srgb,var(--surface)_85%,transparent)] ' +
    'backdrop-blur-[24px] backdrop-saturate-[1.8]',
  headerInner: 'flex items-center gap-5 h-header max-w-page mx-auto px-6 max-[860px]:gap-3 max-[860px]:px-4',
  // 로고·메뉴는 드래그로 글자가 선택되지 않게 (select-none)
  logo: 'flex-none flex items-center gap-2 text-xl font-extrabold tracking-[-0.03em] text-fg-strong select-none',
  logoMark: 'w-7 h-7',
  // 아주 좁은 화면: 홈은 로고로, 채널은 검색으로 갈 수 있으니 글자 메뉴를 숨겨 검색창 자리를 만든다
  // 검색창이 넓어져도 메뉴는 줄어들지 않는다 (파이어폭스는 '채널'을 두 줄로 접었다)
  nav: 'flex-none flex gap-0.5 select-none max-[520px]:hidden',
  navLink:
    'flex items-center h-9 px-3 rounded-sm text-[15px] font-semibold whitespace-nowrap text-fg-sub transition-colors ' +
    'hover:bg-field hover:text-fg-strong aria-[current=page]:text-fg-strong',
  actions: 'ml-auto flex items-center gap-2 select-none',

  menuWrap: 'relative',
  userButton:
    'flex items-center gap-2 h-10 pl-1 pr-2.5 rounded-md font-semibold whitespace-nowrap text-fg-strong transition-colors ' +
    'hover:bg-field aria-expanded:bg-field',
  userName: 'max-[520px]:hidden',
  avatar: 'flex-none grid place-items-center w-8 h-8 rounded-full bg-primary-weak text-primary text-sm font-bold',
  menu:
    'absolute right-0 top-[calc(100%+8px)] min-w-[200px] p-1.5 rounded-md border border-border bg-surface ' +
    'shadow-pop animate-pop',
  menuHead: 'px-3 py-2.5 mb-1 border-b border-line',
  menuName: 'font-bold text-fg-strong',
  menuEmail: 'text-[13px] text-fg-weak',
  menuItem: 'block w-full px-3 py-[9px] rounded-sm text-left text-[15px] text-fg hover:bg-field',

  // 페이지 그리드: 창이 좁아지면 왼쪽 → 오른쪽 사이드바 순서로 접는다 (일반 반응형 웹)
  // 위 여백은 헤더 아래 블러 띠(.header-fade, 32px · 좁으면 20px)보다 넓게: 처음 화면에서는 아무것도 흐려지지 않게
  page: 'grid items-start gap-6 w-full max-w-page mx-auto px-6 pt-10 pb-20 max-[860px]:px-4 max-[860px]:pt-5 max-[860px]:pb-16',
  three: 'grid-cols-[220px_minmax(0,1fr)_300px] max-[1100px]:grid-cols-[minmax(0,1fr)_300px] max-[860px]:grid-cols-1',
  twoRight: 'grid-cols-[minmax(0,1fr)_320px] max-[860px]:grid-cols-1',
  withNav: 'grid-cols-[220px_minmax(0,1fr)] max-w-[1080px] max-[860px]:grid-cols-1',
  single: 'grid-cols-1 max-w-[880px]',
  // 몰입 모드: 본문 너비는 사용자가 고른 값 (--focus-w)
  focus: 'grid-cols-1 max-w-[var(--focus-w,740px)] transition-[max-width] duration-300',
  wide: 'grid-cols-1',
  narrow: 'grid-cols-1 max-w-[440px] pt-16',
  side: 'sticky top-[calc(64px+40px)] flex flex-col gap-4 max-[860px]:static',
  leftInThree: 'max-[1100px]:hidden',
  // 마이페이지 메뉴: 화면에 붙어 따라오지 않고 페이지와 함께 스크롤된다
  sideStatic: 'static',
  main: 'min-w-0 flex flex-col gap-4',

  // 폰 하단 탭바: 헤더의 글자 메뉴가 숨는 폭(520px 이하)에서만 보인다
  tabBar:
    'hidden max-[520px]:flex fixed inset-x-0 bottom-0 z-30 border-t border-border pb-[env(safe-area-inset-bottom)] ' +
    'bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] backdrop-blur-[14px] backdrop-saturate-[1.8]',
  tab:
    'flex-1 flex flex-col items-center justify-center gap-0.5 h-14 text-[11px] font-semibold text-fg-weak ' +
    'aria-[current=page]:text-fg-strong active:bg-pressed [&>svg]:w-6 [&>svg]:h-6',

  // 사이트 푸터: 페이지가 짧아도 화면 맨 아래에 붙는다 (App 의 Root 가 세로 flex)
  footer: 'mt-auto border-t border-border bg-surface',
  footerInner:
    'flex flex-wrap items-center gap-x-6 gap-y-2 max-w-page mx-auto px-6 py-6 text-[13px] text-fg-weak max-[860px]:px-4',
  footerLogo: 'flex items-center gap-1.5 text-sm font-extrabold text-fg-sub',
  footerNav: 'flex gap-4 [&>a:hover]:text-fg-strong',
  contact: 'm-0 flex flex-wrap items-center gap-x-2 gap-y-1',
  contactLink:
    'inline-flex items-center h-7 px-2.5 rounded-sm bg-field text-[13px] font-semibold text-fg-sub transition-colors ' +
    'hover:bg-field-hover hover:text-fg-strong',
  copyright: 'm-0 ml-auto max-[520px]:ml-0 max-[520px]:w-full',
  toast:
    'fixed left-1/2 bottom-8 max-[520px]:bottom-[calc(var(--tabbar-h)+16px)] -translate-x-1/2 z-50 max-w-[calc(100vw-40px)] px-5 py-3 rounded-md bg-toast ' +
    'text-white text-[15px] font-medium shadow-pop animate-toast-in',
};

export default s;

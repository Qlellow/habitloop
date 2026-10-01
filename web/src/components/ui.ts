/**
 * 공통 UI 조각 (Tailwind 클래스). 조합할 때는 cn() 으로 합쳐서 크기·색이 올바르게 덮어써지게 한다.
 * 예) cn(ui.button, ui.primary, ui.small)
 * 데스크톱 웹 기준 크기: 버튼 40px, 본문 15px.
 */
export const ui = {
  card: 'bg-surface border border-border rounded-lg overflow-hidden',
  cardHead: 'flex items-center justify-between gap-3 px-5 pt-[18px] pb-2.5',
  sectionTitle: 'm-0 text-[17px] font-bold text-fg-strong',
  cardLink: 'text-sm font-medium text-fg-sub hover:text-primary',

  button:
    'inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-sm text-[15px] font-semibold whitespace-nowrap ' +
    'transition-colors disabled:opacity-40 disabled:cursor-default',
  primary: 'bg-primary text-white [&:not(:disabled)]:hover:bg-primary-pressed',
  secondary: 'bg-primary-weak text-primary [&:not(:disabled)]:hover:bg-[color-mix(in_srgb,var(--primary)_18%,transparent)]',
  ghost: 'bg-field text-fg [&:not(:disabled)]:hover:bg-field-hover',
  text: 'bg-transparent text-fg-sub px-2.5 [&:not(:disabled)]:hover:bg-field [&:not(:disabled)]:hover:text-fg-strong',
  danger: 'text-danger [&:not(:disabled)]:hover:text-danger',
  small: 'h-8 px-3 text-sm',
  large: 'h-12 px-[22px] text-base',
  full: 'w-full',

  // 필터 칩
  chips: 'flex flex-wrap gap-2',
  chip:
    'h-[34px] px-3.5 rounded-sm bg-field text-fg-sub text-sm font-semibold transition-colors hover:text-fg-strong ' +
    'aria-pressed:bg-fg-strong aria-pressed:text-surface',

  // 밑줄 탭
  tabs: 'flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]',
  tab:
    'relative flex-none h-[46px] px-3.5 text-[15px] font-semibold text-fg-sub hover:text-fg-strong ' +
    'aria-selected:text-fg-strong aria-selected:after:absolute aria-selected:after:inset-x-2.5 aria-selected:after:-bottom-px ' +
    "aria-selected:after:h-0.5 aria-selected:after:rounded-sm aria-selected:after:bg-fg-strong aria-selected:after:content-['']",

  // 폼
  field: 'block mb-[18px]',
  label: 'block mb-1.5 text-sm font-semibold text-fg-sub',
  help: 'mt-1.5 mb-0 text-[13px] text-fg-weak',
  // 한 줄 입력칸: 밑줄형. 포커스되면 밑줄이 왼쪽부터 브랜드 색으로 칠해진다
  // (input 에는 ::after 를 못 붙이므로 아래쪽 배경 그라디언트의 너비를 0% → 100% 로 늘린다, 0.22초 ease-in-out)
  input:
    'w-full h-11 border-0 border-b-[1.5px] border-[color-mix(in_srgb,var(--text-weak)_45%,transparent)] rounded-none ' +
    'bg-transparent bg-[linear-gradient(var(--primary),var(--primary))] bg-no-repeat bg-[length:0%_2px] bg-[position:0_100%] ' +
    'px-0.5 text-[15px] outline-none transition-[background-size,border-color] duration-[220ms] ease-in-out ' +
    'hover:border-[color-mix(in_srgb,var(--text-weak)_80%,transparent)] focus:bg-[length:100%_2px] focus-visible:outline-none ' +
    'placeholder:text-fg-weak disabled:text-fg-weak',
  textarea:
    'w-full border border-transparent rounded-sm bg-field px-3.5 py-[11px] text-[15px] outline-none transition-colors ' +
    'hover:border-border focus:border-primary focus:bg-surface focus-visible:outline-none placeholder:text-fg-weak ' +
    'resize-y min-h-[120px] leading-[1.65]',
  error: 'mt-0 mb-3.5 text-sm text-danger',

  empty: 'py-12 px-5 text-center text-fg-weak text-[15px]',
  skeleton: 'bg-skeleton rounded-sm animate-pulse',
  spinner: 'w-[22px] h-[22px] my-6 mx-auto rounded-full border-[2.5px] border-border border-t-primary animate-spin',
  badge: 'inline-block px-2 py-px rounded-sm bg-primary-weak text-primary text-xs font-semibold',
};

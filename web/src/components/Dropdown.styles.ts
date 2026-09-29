/** 드롭다운 메뉴 (select 대체) (Tailwind) */
const s = {
  root: 'relative',
  trigger:
    'group flex items-center gap-2 w-full h-full min-h-[46px] pl-3.5 pr-3 rounded-sm border border-transparent bg-field ' +
    'text-[15px] font-semibold text-left transition-colors hover:border-border ' +
    'aria-expanded:border-primary aria-expanded:bg-surface focus-visible:outline-none focus-visible:border-primary focus-visible:bg-surface',
  value: 'flex-1 min-w-0 text-fg-strong truncate',
  placeholder: 'flex-1 text-fg-weak font-medium',
  chevron: 'flex-none text-fg-weak transition-transform group-aria-expanded:rotate-180 group-aria-expanded:text-primary',
  menu:
    'absolute z-20 top-[calc(100%+6px)] left-0 min-w-full w-max max-w-[320px] max-h-[300px] overflow-y-auto m-0 p-1.5 list-none ' +
    'rounded-md border border-border bg-surface shadow-pop animate-pop',
  option:
    'flex items-center gap-2 px-2.5 py-[9px] rounded-sm text-[15px] text-fg cursor-pointer ' +
    'aria-selected:text-primary aria-selected:font-semibold',
  active: 'bg-field',
  optionLabel: 'flex-1 whitespace-nowrap',
  check: 'flex-none text-primary',
};

export default s;

/** 마크다운 편집기 (Tailwind) */
const s = {
  editor: 'border border-border rounded-md overflow-hidden',
  bar: 'flex flex-wrap items-center justify-between gap-2 px-2 py-1.5 border-b border-border bg-pressed',
  tools: 'flex gap-0.5 overflow-x-auto [scrollbar-width:none]',
  tool:
    'flex-none min-w-8 h-8 px-1.5 rounded-sm text-sm font-bold text-fg-sub ' +
    '[&:not(:disabled)]:hover:bg-field [&:not(:disabled)]:hover:text-fg-strong disabled:opacity-35 disabled:cursor-default',
  modes: 'inline-flex p-[3px] rounded-[7px] bg-field',
  mode:
    'h-7 px-3 rounded-[5px] text-[13px] font-semibold text-fg-sub ' +
    'aria-selected:bg-surface aria-selected:text-fg-strong aria-selected:shadow-[0_1px_2px_rgba(0,0,0,0.08)]',
  // 좁은 화면에서는 나란히 보기를 쓰지 않는다
  splitOnly: 'max-[860px]:hidden',
  panes: 'grid',
  split: 'grid-cols-2 max-[860px]:grid-cols-1',
  textarea:
    'min-h-[460px] border-0 rounded-none bg-surface px-5 py-[18px] text-[15px] resize-y hover:border-transparent ' +
    'focus:border-0 focus:shadow-[inset_0_0_0_2px_color-mix(in_srgb,var(--primary)_40%,transparent)]',
  preview: 'min-h-[460px] max-h-[720px] overflow-y-auto px-5 py-[18px] bg-surface',
  previewInSplit: 'border-l border-border max-[860px]:border-l-0 max-[860px]:border-t',
  empty: 'm-0 text-fg-weak',
};

export default s;

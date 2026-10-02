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
  // 스크롤바가 생겨도 폭이 그대로이게 (폭이 바뀌면 이미지 크기·메뉴 위치가 다시 바뀌며 스크롤바가 생겼다 사라졌다 반복한다)
  preview: 'min-h-[460px] max-h-[720px] overflow-y-auto [scrollbar-gutter:stable] px-5 py-[18px] bg-surface',
  previewInSplit: 'border-l border-border max-[860px]:border-l-0 max-[860px]:border-t',
  empty: 'm-0 text-fg-weak',
  // 작성 화면의 이미지 편집 칸 (커서가 이미지 줄에 있을 때)
  imagePanel: 'border-t border-border bg-pressed',
  imagePanelHead: 'flex items-center justify-between gap-2 px-5 pt-2.5 text-[12px] font-semibold text-fg-weak',
  imagePanelClose: 'grid place-items-center w-7 h-7 rounded-sm text-fg-sub hover:bg-field hover:text-fg-strong',
  // 메뉴가 이미지 위에 뜰 자리(pt-14)를 남긴다
  // 편집 도구는 칸 전체 너비를 쓰고(메뉴가 한 줄로 들어가게), 이미지는 본문보다 좁게(최대 520px) 보여 준다.
  // 크기는 % 라서 넓이가 달라도 비율은 같다. 위(pt)는 메뉴, 아래(pb)는 캡션·크기 칸이 열릴 자리
  imagePanelHost: 'relative px-5 pt-16 pb-16',
  imagePanelImage: 'max-w-[520px] mx-auto [&_.loop-img]:mt-0 [&_.loop-img]:mb-0',
  // 채널 소개처럼 짧은 글: 편집 영역을 낮게
  compact: 'min-h-[220px]',
  compactPreview: 'min-h-[220px] max-h-[480px]',
};

export default s;

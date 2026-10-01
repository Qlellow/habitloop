/** 로그인 · 회원가입 · 비밀번호 찾기 (Tailwind) */
const s = {
  // 화면 가운데 큰 카드. 로그인·회원가입 카드 높이를 같게(680px) 해서 서로 바꿀 때 크기가 튀지 않는다.
  // 860px 이하는 입력만, 520px 이하는 카드 테두리 없이 화면 전체
  page: 'flex-1 flex items-center justify-center px-6 py-6 [@media(max-height:820px)]:py-3 max-[520px]:p-0 max-[520px]:items-stretch',
  card:
    'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] w-full max-w-[1040px] min-h-[680px] rounded-[24px] overflow-hidden ' +
    'bg-surface border border-border shadow-[0_24px_60px_rgba(0,29,58,0.08)] ' +
    'max-[860px]:grid-cols-1 max-[860px]:max-w-[480px] max-[860px]:min-h-0 ' +
    'max-[520px]:rounded-none max-[520px]:border-0 max-[520px]:shadow-none',
  formPane: 'flex flex-col px-14 py-7 [@media(max-height:820px)]:py-5 max-[860px]:px-8 max-[860px]:py-8 max-[520px]:px-5 max-[520px]:py-5',
  top: 'flex items-center justify-end gap-3',
  step: 'px-3 py-1 rounded-full bg-primary-weak text-[12px] font-bold text-primary',
  switch: 'mt-5 mb-0 text-center text-sm text-fg-sub',
  switchLink:
    "relative ml-2 font-semibold text-primary after:absolute after:left-0 after:right-0 after:-bottom-0.5 after:h-px after:bg-current " +
    "after:content-[''] after:origin-left after:scale-x-0 after:transition-transform after:duration-200 after:ease-in-out hover:after:scale-x-100",
  body: 'flex-1 flex flex-col justify-center w-full max-w-[400px] mx-auto pt-4 pb-1 max-[520px]:pt-6',
  title: 'm-0 text-[30px] leading-tight font-extrabold tracking-[-0.02em] text-fg-strong max-[520px]:text-[28px]',
  desc: 'mt-2 mb-6 text-[15px] text-fg-weak leading-relaxed',

  // 밑줄형 입력칸. 밑줄은 다크 모드에서도 배경과 구분되도록 회색 글자색을 섞어 만든다
  field: 'mb-2',
  // 포커스되면 밑줄이 왼쪽부터 브랜드 색으로 빠르게 칠해진다 (::after 를 scaleX 0 → 1, 0.22초 ease-in-out)
  // 밑줄은 global.css 의 .underline-field: 회색 선 위를 파란 선이 왼쪽부터 덮는다
  inputRow: 'underline-field group relative flex items-center gap-3 h-[52px]',
  inputRowError: 'underline-error',
  icon: 'flex-none text-fg-weak group-focus-within:text-primary [&>svg]:w-[22px] [&>svg]:h-[22px]',
  iconError: 'text-danger group-focus-within:text-danger',
  input:
    'flex-1 min-w-0 h-full bg-transparent text-[16px] font-medium text-fg-strong outline-none ' +
    'placeholder:text-fg-weak placeholder:font-normal',
  validIcon: 'flex-none w-[22px] h-[22px] text-[var(--role-admin)]',
  eye: 'flex-none grid place-items-center w-9 h-9 -mr-1.5 rounded-full text-fg-weak transition-colors hover:bg-field hover:text-fg-strong',
  // 안내 문구 자리는 항상 한 줄만큼 비워 둔다 → 오류가 떠도 칸 높이·화면이 늘어나지 않는다
  below: 'flex items-center justify-between gap-3 h-5 mt-1.5',
  belowTall: 'h-[42px] items-start',
  error: 'flex items-center gap-1.5 min-w-0 m-0 text-[13px] font-medium text-danger animate-fade-up [&>span]:truncate',
  // 글자 링크(비밀번호 찾기 등): 마우스를 올리면 파랗게 바뀌며 밑줄이 왼쪽부터 그어진다 (ease-in-out)
  aside:
    // 밑줄 없이 hover 때 글자색만 부드럽게 바뀐다
    'flex-none ml-auto text-[13px] font-semibold text-fg-sub transition-colors duration-200 ease-in-out hover:text-primary',

  // 비밀번호 강도 (4칸 막대 + 한 줄 안내)
  meterWrap: 'flex flex-col gap-1.5 w-full min-w-0',
  meter: 'grid grid-cols-4 gap-1.5',
  meterBar: 'h-1 rounded-full bg-field transition-colors duration-300 ease-in-out',
  barWeak: 'bg-danger',
  barFair: 'bg-[#f5a700]',
  barStrong: 'bg-primary',
  barVeryStrong: 'bg-[var(--role-admin)]',
  textWeak: 'text-danger',
  textFair: 'text-[#f5a700]',
  textStrong: 'text-primary',
  textVeryStrong: 'text-[var(--role-admin)]',
  meterText: 'flex items-center gap-2 m-0 min-w-0 text-[12.5px] leading-[18px] text-fg-weak',
  meterLabel: 'flex-none font-bold',

  // 알약 버튼
  // 알약 버튼 (마우스를 올렸을 때의 유리 효과는 global.css 의 .glass-button)
  submit:
    'flex items-center justify-center gap-2.5 w-full h-14 mt-4 px-6 rounded-full bg-primary text-white text-[16px] font-bold ' +
    'shadow-[0_10px_24px_rgba(49,130,246,0.28)] transition-[transform,box-shadow] duration-500 ease-in-out ' +
    '[&:not(:disabled)]:active:scale-[0.99] disabled:opacity-50 disabled:shadow-none disabled:cursor-default',
  submitLabel: 'relative',
  spinner: 'relative w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin',
  formError:
    'flex items-center gap-2 mt-0 mb-4 px-3.5 py-3 rounded-md bg-danger-weak text-sm font-medium text-danger animate-fade-up',
  subActions: 'flex items-center justify-between gap-2 mt-5',
  textButton: 'h-9 px-2 rounded-sm text-sm font-semibold text-fg-sub hover:bg-field hover:text-fg-strong',
  demo: 'mt-6 px-3.5 py-3 rounded-md bg-field text-[13px] text-fg-sub',

  // 오른쪽 브랜드 그림 (다크 모드에서도 파란 바탕 그대로)
  brand: 'relative overflow-hidden p-12 max-[860px]:hidden',
  brandLogin: 'bg-[linear-gradient(155deg,#4b93ff_0%,#3182f6_40%,#1b64da_100%)]',
  brandSignup: 'bg-[linear-gradient(160deg,#8b7bff_0%,#6b5cf6_45%,#4a3fd8_100%)]',
  brandShapeA: 'absolute -right-24 -top-28 w-[360px] h-[360px] rounded-[80px] rotate-[24deg] bg-white/10',
  brandShapeB: 'absolute -left-20 -bottom-32 w-[420px] h-[420px] rounded-full bg-[#0f4cbf]/40',
  brandShapeC: 'absolute -left-28 top-[38%] w-[340px] h-[340px] rounded-[90px] rotate-[-18deg] bg-white/10',
  brandShapeD: 'absolute -right-24 -bottom-24 w-[380px] h-[380px] rounded-full bg-[#3a2fc0]/45',
  brandHead: 'relative flex flex-col gap-5',
  brandTitle: 'm-0 text-[26px] leading-[1.35] font-extrabold tracking-[-0.02em] text-white',
  // 떠 있는 카드: 0.9초 동안 천천히 올라온 뒤 4초 주기로 둥실둥실 (키프레임은 global.css).
  // 동그라미끼리, 네모끼리 같은 박자로 움직이고 네모가 0.3초 늦게 따라간다
  floatCard:
    'absolute flex flex-col gap-2.5 p-5 rounded-[20px] bg-white text-[#191f28] shadow-[0_20px_40px_rgba(0,30,90,0.25)]',
  popularCard: 'left-12 right-20 top-[46%] [animation:auth-rise_0.9s_cubic-bezier(0.22,1,0.36,1)_150ms_both,auth-float_4s_ease-in-out_1.4s_infinite]',
  channelCard: 'right-10 bottom-12 w-[290px] [animation:auth-rise_0.9s_cubic-bezier(0.22,1,0.36,1)_350ms_both,auth-float_4s_ease-in-out_1.4s_infinite]',
  floatLabel: 'text-[12px] font-bold text-[#f5a700]',
  rankRow: 'flex items-baseline gap-3 min-w-0 text-[14px] font-semibold',
  rankSkeleton: 'h-[21px] rounded-md bg-[#f2f4f6] animate-pulse',
  rankNo: 'flex-none w-3 text-[#3182f6]',
  chips: 'flex flex-wrap gap-1.5',
  chip: 'flex items-center gap-1.5 h-8 pl-1 pr-2.5 rounded-full bg-[#f2f4f6] text-[13px] font-semibold',
  chipMeta: 'text-[11px] font-medium text-[#8b95a1]',
  chipSkeleton: 'w-20 h-8 rounded-full bg-[#f2f4f6] animate-pulse',
  bubble:
    'absolute grid place-items-center w-14 h-14 rounded-full bg-white text-2xl shadow-[0_14px_30px_rgba(0,30,90,0.25)]',
  bubbleA: 'right-12 top-[30%] [animation:auth-rise_0.9s_cubic-bezier(0.22,1,0.36,1)_550ms_both,auth-float_4s_ease-in-out_1.0s_infinite]',
  bubbleB: 'left-16 bottom-16 w-12 h-12 text-xl [animation:auth-rise_0.9s_cubic-bezier(0.22,1,0.36,1)_750ms_both,auth-float_4s_ease-in-out_1.0s_infinite]',
  benefitCard: 'left-12 right-16 top-[42%] [animation:auth-rise_0.9s_cubic-bezier(0.22,1,0.36,1)_150ms_both,auth-float_4s_ease-in-out_1.4s_infinite]',
  benefitRow: 'flex items-center gap-2.5 text-[14px] font-semibold',
  benefitCheck: 'grid place-items-center w-5 h-5 rounded-full bg-[#efedff] text-[11px] font-black text-[#6b5cf6]',
  safeCard: 'right-10 bottom-12 w-[260px] gap-1 [animation:auth-rise_0.9s_cubic-bezier(0.22,1,0.36,1)_350ms_both,auth-float_4s_ease-in-out_1.4s_infinite]',
  safeIcon: 'text-2xl mb-1',
  safeTitle: 'text-[15px] font-bold',
  safeDesc: 'text-[13px] text-[#6b7684]',
  bubbleC: 'right-14 top-[30%] [animation:auth-rise_0.9s_cubic-bezier(0.22,1,0.36,1)_550ms_both,auth-float_4s_ease-in-out_1.0s_infinite]',
  bubbleD: 'left-14 bottom-20 w-12 h-12 text-xl [animation:auth-rise_0.9s_cubic-bezier(0.22,1,0.36,1)_750ms_both,auth-float_4s_ease-in-out_1.0s_infinite]',
};

export default s;

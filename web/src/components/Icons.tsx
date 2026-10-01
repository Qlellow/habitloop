import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true } as const;

export const BackIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const SearchIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2.2" />
    <path d="M16 16l4 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

export const UserIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="8.5" r="4" fill="currentColor" />
    <path d="M4 20c0-3.6 3.6-6 8-6s8 2.4 8 6" fill="currentColor" />
  </svg>
);

export const PencilIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16v4z" fill="currentColor" />
  </svg>
);

export const HeartIcon = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base} {...p}>
    <path
      d="M12 20s-7.5-4.6-7.5-10.2C4.5 7.1 6.5 5 9 5c1.4 0 2.4.7 3 1.6C12.6 5.7 13.6 5 15 5c2.5 0 4.5 2.1 4.5 4.8C19.5 15.4 12 20 12 20z"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

export const CommentIcon = (p: P) => (
  <svg {...base} {...p}>
    <path
      d="M5 5h14a1 1 0 011 1v10a1 1 0 01-1 1h-7l-4 3v-3H5a1 1 0 01-1-1V6a1 1 0 011-1z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

export const MoreIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="5" cy="12" r="1.8" fill="currentColor" />
    <circle cx="12" cy="12" r="1.8" fill="currentColor" />
    <circle cx="19" cy="12" r="1.8" fill="currentColor" />
  </svg>
);

const stroke = { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const ChevronDownIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 9l6 6 6-6" {...stroke} />
  </svg>
);

export const ChevronUpIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M18 15l-6-6-6 6" {...stroke} />
  </svg>
);

/** 소유자 배지: 별 */
export const StarIcon = (p: P) => (
  <svg {...base} {...p}>
    <path
      d="M12 2.8l2.75 5.57 6.15.9-4.45 4.33 1.05 6.12L12 16.83l-5.5 2.89 1.05-6.12L3.1 9.27l6.15-.9L12 2.8z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

/** 관리자 배지: 톱니바퀴 */
export const GearIcon = (p: P) => (
  <svg {...base} {...p}>
    <path
      d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
      {...stroke}
      strokeWidth="2.2"
    />
    <circle cx="12" cy="12" r="3" {...stroke} strokeWidth="2.2" />
  </svg>
);

/** 매니저 배지: 몽키 스패너 */
export const WrenchIcon = (p: P) => (
  <svg {...base} {...p}>
    <path
      d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
      {...stroke}
      strokeWidth="2.2"
    />
  </svg>
);

export const HomeIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 10.5L12 4l8 6.5V19a1 1 0 01-1 1h-4.5v-5.5h-5V20H5a1 1 0 01-1-1v-8.5z" fill="currentColor" />
  </svg>
);

export const GridIcon = (p: P) => (
  <svg {...base} {...p}>
    <rect x="4" y="4" width="7" height="7" rx="2" fill="currentColor" />
    <rect x="13" y="4" width="7" height="7" rx="2" fill="currentColor" />
    <rect x="4" y="13" width="7" height="7" rx="2" fill="currentColor" />
    <rect x="13" y="13" width="7" height="7" rx="2" fill="currentColor" />
  </svg>
);

/* ───────── 로그인 · 회원가입 입력칸 (외곽선 아이콘) ───────── */
const line = { stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;

export const MailLineIcon = (p: P) => (
  <svg {...base} {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" {...line} />
    <path d="M4.5 7.5l7.5 5.5 7.5-5.5" {...line} />
  </svg>
);

export const LockLineIcon = (p: P) => (
  <svg {...base} {...p}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" {...line} />
    <path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" {...line} />
  </svg>
);

export const UserLineIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="8.5" r="3.8" {...line} />
    <path d="M4.8 19.5c.9-3.3 3.8-5.3 7.2-5.3s6.3 2 7.2 5.3" {...line} />
  </svg>
);

/** 비밀번호 보기 (눈 외곽선) */
export const EyeIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M2.8 12S6.2 5.8 12 5.8 21.2 12 21.2 12 17.8 18.2 12 18.2 2.8 12 2.8 12z" {...line} />
    <circle cx="12" cy="12" r="3" {...line} />
  </svg>
);

/** 비밀번호 숨기기 (사선이 그어진 눈 외곽선) */
export const EyeOffIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M10.6 6c.46-.1.92-.2 1.4-.2 5.8 0 9.2 6.2 9.2 6.2a17 17 0 01-2.6 3.3M6.4 7.6A16.6 16.6 0 002.8 12S6.2 18.2 12 18.2c1.7 0 3.2-.5 4.5-1.3" {...line} />
    <path d="M9.9 9.9a3 3 0 004.2 4.2" {...line} />
    <path d="M4 4l16 16" {...line} />
  </svg>
);

export const CheckCircleIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="8.5" {...line} />
    <path d="M8.3 12.2l2.5 2.5 4.9-5" {...line} />
  </svg>
);

export const AlertCircleIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="8.5" {...line} />
    <path d="M12 7.8v5" {...line} />
    <circle cx="12" cy="16.2" r="1" fill="currentColor" />
  </svg>
);

export const ArrowRightIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" {...line} strokeWidth={2.2} />
  </svg>
);

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

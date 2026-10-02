import typography from '@tailwindcss/typography';
import preset from '../packages/shared/tailwind-preset.cjs';

/** @type {import('tailwindcss').Config} */
export default {
  presets: [preset],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      maxWidth: { page: '1240px' },
      height: { header: '64px' },
      spacing: { header: '64px' },
      boxShadow: {
        pop: '0 12px 32px rgba(0, 29, 58, 0.14)',
        glow: '0 6px 20px rgba(49, 130, 246, 0.12)',
      },
      keyframes: {
        pop: { from: { opacity: '0', transform: 'translateY(-4px)' } },
        'toast-in': { from: { opacity: '0', transform: 'translate(-50%, 8px)' } },
        'fade-up': { from: { opacity: '0', transform: 'translateY(6px)' } },
      },
      animation: {
        pop: 'pop 0.12s ease-out',
        'toast-in': 'toast-in 0.2s ease-out',
        'fade-up': 'fade-up 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) both',
      },
      transitionTimingFunction: { toss: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      // 글 본문(마크다운): typography 플러그인의 prose 를 디자인 토큰 색에 맞춘다 (다크 모드도 자동)
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-body': 'var(--text)',
            '--tw-prose-headings': 'var(--text-strong)',
            '--tw-prose-links': 'var(--primary)',
            '--tw-prose-bold': 'var(--text-strong)',
            '--tw-prose-counters': 'var(--text-sub)',
            '--tw-prose-bullets': 'var(--text-weak)',
            '--tw-prose-hr': 'var(--line)',
            '--tw-prose-quotes': 'var(--text-sub)',
            '--tw-prose-quote-borders': 'var(--border)',
            '--tw-prose-code': 'var(--text-strong)',
            '--tw-prose-pre-code': 'var(--text-strong)',
            '--tw-prose-pre-bg': 'var(--field)',
            '--tw-prose-th-borders': 'var(--line)',
            '--tw-prose-td-borders': 'var(--line)',
            maxWidth: 'none',
            fontSize: '16px',
            lineHeight: '1.75',
            overflowWrap: 'anywhere',
            // 제목 위아래 간격을 줄여 #, ##, ### 가 이어질 때 너무 벌어지지 않게
            h1: { fontSize: '22px', marginTop: '1.1em', marginBottom: '0.45em' },
            h2: { fontSize: '20px', marginTop: '1em', marginBottom: '0.4em' },
            h3: { fontSize: '18px', marginTop: '0.9em', marginBottom: '0.35em' },
            h4: { fontSize: '17px', marginTop: '0.85em', marginBottom: '0.3em' },
            'h1 + *, h2 + *, h3 + *, h4 + *': { marginTop: '0' },
            '> :first-child': { marginTop: '0' },
            a: { textUnderlineOffset: '3px' },
            'code::before': { content: 'none' },
            'code::after': { content: 'none' },
            code: { padding: '2px 6px', borderRadius: '6px', background: 'var(--field)', fontWeight: '400', fontSize: '0.88em' },
            'pre code': { padding: '0', background: 'none', fontSize: '14px' },
            pre: { borderRadius: '8px' },
            blockquote: { fontStyle: 'normal', fontWeight: '400' },
            'blockquote p:first-of-type::before': { content: 'none' },
            'blockquote p:last-of-type::after': { content: 'none' },
            img: { borderRadius: '8px' },
            table: { display: 'block', overflowX: 'auto' },
            th: { background: 'var(--field)', padding: '8px 12px' },
            td: { padding: '8px 12px' },
          },
        },
      },
    },
  },
  plugins: [typography],
};

/**
 * 웹(Tailwind)과 앱(NativeWind)이 함께 쓰는 디자인 토큰.
 * 색은 CSS 변수를 가리키므로, 라이트/다크 값은 각 앱의 global.css 에서 바꾼다.
 *   웹: web/src/styles/global.css   앱: mobile/global.css
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        pressed: 'var(--surface-pressed)',
        fg: {
          DEFAULT: 'var(--text)',
          strong: 'var(--text-strong)',
          sub: 'var(--text-sub)',
          weak: 'var(--text-weak)',
        },
        line: 'var(--line)',
        field: 'var(--field)',
        border: 'var(--border)',
        primary: {
          DEFAULT: 'var(--primary)',
          pressed: 'var(--primary-pressed)',
          weak: 'var(--primary-weak)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          weak: 'var(--danger-weak)',
        },
        skeleton: 'var(--skeleton)',
        toast: 'var(--toast-bg)',
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '10px',
      },
    },
  },
};

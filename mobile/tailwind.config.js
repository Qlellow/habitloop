const { platformSelect } = require('nativewind/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  // 색 이름(bg, surface, fg-strong, primary …)은 웹과 같은 공유 프리셋을 쓴다.
  // 실제 색 값은 src/theme.ts 의 팔레트가 루트에서 CSS 변수로 내려준다.
  presets: [require('nativewind/preset'), require('../packages/shared/tailwind-preset.cjs')],
  theme: {
    extend: {
      // 손가락으로 누르는 앱은 웹보다 살짝 둥글게
      borderRadius: { sm: '10px', md: '14px', lg: '18px' },
      fontFamily: {
        mono: platformSelect({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
      },
    },
  },
  plugins: [],
};

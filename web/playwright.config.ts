import { defineConfig, devices } from '@playwright/test';

/**
 * 화면 자동 테스트 (E2E): 진짜 API(메모리 DB + 샘플 데이터) 와 빌드한 웹을 띄우고 브라우저로 주요 흐름을 따라간다.
 *   npm run e2e -w web   (먼저 npm run build -w api && npm run build -w web)
 * 이미 3000 · 3001 에 서버가 떠 있으면 그대로 쓴다 (개발 중)
 * 크로미움 경로를 바꾸려면 PW_CHROMIUM=/경로/chromium
 */
const CI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  // 실패는 실패로 본다 (다시 돌려서 넘기지 않는다). 대신 실패하면 추적 · 화면을 남긴다
  retries: 0,
  forbidOnly: CI,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    // 이미 띄운 다른 주소(예: 빌드 미리보기 3002)로 돌리려면 E2E_BASE_URL
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } }, testIgnore: /mobile\.spec/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec/ },
  ],
  webServer: [
    {
      // DATABASE_URL 이 없으면 메모리 DB 에 샘플 데이터(체험 계정 demo@loop.dev)를 넣고 뜬다
      command: 'node ../api/dist/main.js',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: !CI,
      timeout: 60_000,
      env: { NO_COLOR: '1', PORT: '3000' },
    },
    {
      command: 'npx vite preview --port 3001 --strictPort',
      url: 'http://localhost:3001',
      reuseExistingServer: !CI,
      timeout: 60_000,
    },
  ],
});

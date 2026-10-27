import { expect, type Page } from '@playwright/test';

export const DEMO = { email: 'demo@loop.dev', password: 'password1234' };

/**
 * 이 테스트 동안 화면에서 난 오류를 모은다 (페이지 오류 · 콘솔 오류).
 * 일부러 없는 주소를 연 경우처럼 예상한 응답 오류는 allow 로 뺀다
 */
export function watchErrors(page: Page, allow: RegExp[] = []) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    // 리소스 404 · 401 같은 응답 오류는 화면이 처리한다 (allow 로 따로 확인)
    if (/Failed to load resource/.test(text)) return;
    if (allow.some((r) => r.test(text))) return;
    errors.push(`console: ${text}`);
  });
  return {
    errors,
    expectNone: () => expect(errors, errors.join('\n')).toEqual([]),
  };
}

/** 로그인 화면으로 로그인 (체험 계정) */
export async function login(page: Page) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(DEMO.email);
  await page.locator('input[type="password"]').fill(DEMO.password);
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByRole('button', { name: /메뉴$/ })).toBeVisible();
}

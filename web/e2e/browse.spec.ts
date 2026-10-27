import { expect, test } from '@playwright/test';
import { watchErrors } from './helpers';

test.describe('둘러보기 (비로그인)', () => {
  test('홈에서 글을 누르면 본문이 바로 보인다 (홈 캐시를 거쳐 들어가도)', async ({ page }) => {
    const w = watchErrors(page);
    await page.goto('/');
    const first = page.locator('.home-grid a[href^="/posts/"]').first();
    await expect(first).toBeVisible();
    const title = (await first.locator('span').filter({ hasText: /\S/ }).nth(0).innerText()).trim();
    await first.click();
    await expect(page).toHaveURL(/\/posts\/\d+$/);
    // 뼈대(로딩 칸)에서 멈추지 않고 제목 · 본문이 나온다
    await expect(page.locator('article h1')).toBeVisible();
    await expect(page.locator('article .bg-skeleton')).toHaveCount(0);
    expect(title.length).toBeGreaterThan(0);
    w.expectNone();
  });

  test('주요 화면이 오류 없이 열린다', async ({ page }) => {
    const w = watchErrors(page);
    for (const [path, heading] of [
      ['/channels', /채널/],
      ['/c/daily', /일상/],
      ['/c/daily/village', /마을/],
      ['/notices', /공지사항/],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
    }
    w.expectNone();
  });

  test('없는 주소 · 없는 글은 안내 화면', async ({ page }) => {
    await page.goto('/no-such-page');
    await expect(page.getByText(/없는|찾을 수 없/).first()).toBeVisible();
    await page.goto('/posts/99999999');
    await expect(page.getByText('삭제되었거나 없는 글이에요')).toBeVisible();
  });

  test('화면이 렌더 중 깨져도 헤더는 남고 안내가 뜬다 (오류 경계)', async ({ page }) => {
    await page.route(/\/api\/posts\/\d+$/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"id":1,"title":"깨진 글"}' }));
    await page.goto('/posts/1');
    await expect(page.getByRole('alert')).toContainText('문제가 생겼어요');
    await expect(page.locator('.site-header')).toBeVisible();
    // 다른 화면으로 가면 다시 정상
    await page.unroute(/\/api\/posts\/\d+$/);
    await page.locator('.site-header').getByRole('link', { name: '채널' }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('커맨드 팔레트로 이동 (Ctrl+K)', async ({ page }) => {
    await page.goto('/');
    // 단축키는 화면이 다 뜬 뒤에 걸린다
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('Control+k');
    const input = page.locator('input.cmdk-input');
    await expect(input).toBeVisible();
    await input.fill('공지사항');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/notices$/);
  });
});

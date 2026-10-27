import { expect, test } from '@playwright/test';
import { watchErrors } from './helpers';

test('폰: 하단 탭바로 이동하고 가로로 넘치지 않는다', async ({ page }) => {
  const w = watchErrors(page);
  await page.goto('/');
  const tabbar = page.locator('.site-tabbar');
  await expect(tabbar).toBeVisible();
  await tabbar.getByRole('link', { name: '채널' }).click();
  await expect(page).toHaveURL(/\/channels$/);
  for (const path of ['/', '/channels', '/c/daily', '/c/daily/village', '/notices']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} 가로 넘침`).toBeLessThanOrEqual(1);
  }
  w.expectNone();
});

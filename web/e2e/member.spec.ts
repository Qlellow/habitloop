import { expect, test } from '@playwright/test';
import { login, watchErrors } from './helpers';

test.describe('회원 흐름', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('글쓰기 → 댓글 → 감정 반응 → 삭제', async ({ page }) => {
    const w = watchErrors(page);
    const title = `E2E 테스트 글 ${Date.now()}`;
    await page.goto('/write?channel=free');
    await page.getByPlaceholder('제목을 입력해 주세요').fill(title);
    await page.locator('.cm-content').click();
    await page.keyboard.type('자동 테스트가 쓴 **본문**이에요');
    await page.getByRole('button', { name: '올리기' }).click();

    await expect(page).toHaveURL(/\/posts\/\d+$/);
    await expect(page.locator('article h1')).toHaveText(title);
    await expect(page.locator('article strong').first()).toHaveText('본문');

    // 댓글
    const box = page.getByPlaceholder(/댓글/).first();
    await box.fill('E2E 댓글');
    await box.press('Control+Enter');
    await expect(page.getByText('E2E 댓글').first()).toBeVisible();

    // 감정 반응: 누르면 켜지고 숫자가 1
    const clap = page.locator('.rx-chip').first();
    await clap.click();
    await expect(clap).toHaveAttribute('aria-pressed', 'true');
    await expect(clap.locator('.rx-count')).toHaveText('1');

    // 삭제 (확인 창은 수락)
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: '삭제' }).first().click();
    await expect(page).toHaveURL(/\/c\/free$/);
    await expect(page.getByText(title)).toHaveCount(0);
    w.expectNone();
  });

  test('배지 도감: 받은 배지를 대표 배지로 달기 · 떼기', async ({ page }) => {
    await page.goto('/badges');
    await expect(page.getByRole('heading', { name: '내 배지 도감' })).toBeVisible();
    await page.locator('.badge-card[data-earned]').first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: '대표 배지로 달기' }).click();
    await expect(page.getByText('대표 배지로 달았어요')).toBeVisible();
    await page.locator('.badge-card[data-earned]').first().click();
    await page.getByRole('dialog').getByRole('button', { name: '대표 배지 떼기' }).click();
    await expect(page.getByText('대표 배지를 뗐어요')).toBeVisible();
  });

  test('마이페이지 · 설정 · 마을 화면이 오류 없이 열린다', async ({ page }) => {
    const w = watchErrors(page);
    for (const path of ['/me/profile', '/me/posts', '/me/points', '/me/pet', '/me/settings', '/c/free/village', '/sea']) {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
    }
    w.expectNone();
  });
});

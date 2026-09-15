import { expect, test } from '@playwright/test';

test('shows the stage-one status', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Trať je připravená.' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveAttribute('width', '320');
  await expect(page.locator('canvas')).toHaveAttribute('height', '200');
});

test('gallery exposes every playable zone', async ({ page }) => {
  await page.goto('/#/gallery');
  await expect(page.locator('[data-zone]')).toHaveCount(42);
  await page.locator('[data-zone="42"]').click();
  await expect(page.getByRole('heading', { name: 'Zóna 42' })).toBeVisible();
  await expect(page.getByText('FIELD82.DAT')).toBeVisible();
});

test('diagnostics can advance exactly one microtick', async ({ page }) => {
  await page.goto('/#/diagnostics');
  await expect(page.getByRole('heading', { name: 'Diagnostika simulace' })).toBeVisible();
  await page.getByRole('button', { name: '+ 1 mikrotick' }).click();
  await expect(page.locator('#diagnostic-state')).toContainText('"tick": 1');
  await expect(page.locator('#diagnostic-state')).toContainText('"microStep": 1');
});

test('campaign starts from the keyboard and returns to menu', async ({ page }) => {
  await page.goto('/#/play');
  const canvas = page.locator('#game-canvas');
  await expect(canvas).toHaveAttribute('data-mode', 'ready');
  await page.keyboard.press('Enter');
  await expect(canvas).toHaveAttribute('data-mode', 'running');
  await page.keyboard.press('KeyR');
  await expect(page.getByRole('heading', { name: 'Trať je připravená.' })).toBeVisible();
});

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

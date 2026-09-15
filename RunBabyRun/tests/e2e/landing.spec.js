import { expect, test } from '@playwright/test';

test('shows the stage-one status', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Startovní čára je připravená.' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveAttribute('width', '320');
  await expect(page.locator('canvas')).toHaveAttribute('height', '200');
});

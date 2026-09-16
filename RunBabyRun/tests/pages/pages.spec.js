import { expect, test } from '@playwright/test';

test('production game, gallery and audio work under the repository path', async ({ page }) => {
  const failures = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
  });
  await page.goto('./#/gallery');
  await expect(page.locator('.maze-card')).toHaveCount(42);
  await expect(page.locator('.atlas-wrap img')).toBeVisible();
  expect(await page.locator('.atlas-wrap img').evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
  await page.goto('./#/play');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-mode', 'ready');
  await page.keyboard.press('Enter');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-mode', 'running');
  const crashSound = await page.evaluate(async () => {
    const response = await fetch(new URL('audio/crash004.mp3', location.href));
    return { ok: response.ok, contentType: response.headers.get('content-type') };
  });
  expect(crashSound.ok).toBe(true);
  expect(crashSound.contentType).toContain('audio');
  const sources = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name));
  expect(sources.some((url) => /\/RunBabyRun\/generated\/mazes.json/.test(url))).toBe(true);
  expect(failures).toEqual([]);
});

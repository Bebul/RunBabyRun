import { expect, test } from '@playwright/test';

test('shows the stage-one status', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Run Baby Run' })).toBeVisible();
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

test('diagnostics animates the queue and releases the front car onto the recorded route', async ({ page }, testInfo) => {
  await page.goto('/#/diagnostics');
  await expect(page.locator('#diagnostic-state')).toContainText('"tick": 0');
  const advance = async (count) => {
    await page.evaluate((ticks) => {
      for (let i = 0; i < ticks; i += 1) document.querySelector('#step-once').click();
    }, count);
    return JSON.parse(await page.locator('#diagnostic-state').textContent());
  };
  let state = await advance(160);
  expect(state.enemies[7].renderPosition).toEqual({ x: 88, y: 184 });
  state = await advance(1);
  expect(state.enemies[7].renderPosition).toEqual({ x: 87, y: 184 });
  expect(state.enemies[6].renderPosition).toEqual({ x: 103, y: 184 });
  state = await advance(15 + 8 * 8 + 8);
  expect(state.enemies[7].head).toEqual({ x: 1, y: 22 });
  expect(state.enemies[7].routeCursor).toBe(326);
  expect(state.enemies[6].renderPosition).toEqual({ x: 88, y: 184 });
  state = await advance(8);
  expect(state.enemies[7].head).toEqual({ x: 1, y: 21 });
  await page.locator('#diagnostic-canvas').screenshot({ path: testInfo.outputPath('pursuit.png') });
});

test('campaign starts from the keyboard and returns to menu', async ({ page }) => {
  await page.goto('/#/play');
  const canvas = page.locator('#game-canvas');
  await expect(canvas).toHaveAttribute('data-mode', 'ready');
  await page.keyboard.press('Enter');
  await expect(canvas).toHaveAttribute('data-mode', 'running');
  await page.keyboard.press('KeyR');
  await expect(page.getByRole('heading', { name: 'Run Baby Run' })).toBeVisible();
});

test('practice exposes all zones and launches the selected one', async ({ page }) => {
  await page.goto('/#/practice');
  await expect(page.locator('[data-practice-zone]')).toHaveCount(42);
  await page.locator('[data-practice-zone="42"]').click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-zone', '42');
  await expect(page.getByRole('heading', { name: 'Zóna 42' })).toBeVisible();
});

test('a campaign crash advances to the next zone with one fewer life', async ({ page }) => {
  await page.clock.install();
  await page.goto('/#/play');
  const canvas = page.locator('#game-canvas');
  await expect(canvas).toHaveAttribute('data-mode', 'ready');
  await page.keyboard.press('Enter');
  await page.clock.runFor(20000);
  await expect(canvas).toHaveAttribute('data-mode', 'ready');
  await expect(canvas).toHaveAttribute('data-zone', '2');
  await expect(page.locator('#game-status')).toContainText('Životy6');
});

test('high scores survive a reload', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('runbabyrun.highScores.v1', JSON.stringify([{ name: 'ADA', score: 123 }])));
  await page.goto('/#/scores');
  await expect(page.getByText('ADA')).toBeVisible();
  await page.reload();
  await expect(page.getByText('123')).toBeVisible();
});

test('turns entered before a zone starts do not leak into its run', async ({ page, context }) => {
  const baseline = await context.newPage();
  const frame = async (target, staleInput) => {
    await target.clock.install();
    await target.goto('/#/play');
    await expect(target.locator('#game-canvas')).toHaveAttribute('data-mode', 'ready');
    await target.keyboard.press('s');
    for (let i = 0; i < 200; i += 1) {
      await target.clock.runFor(100);
      if (await target.locator('#game-canvas').getAttribute('data-mode') === 'crashed') break;
    }
    await expect(target.locator('#game-canvas')).toHaveAttribute('data-mode', 'crashed');
    if (staleInput) await target.keyboard.down('x');
    await target.clock.runFor(1000);
    await expect(target.locator('#game-canvas')).toHaveAttribute('data-zone', '2');
    if (staleInput) await target.keyboard.press('z');
    await target.keyboard.press('s');
    if (staleInput) await target.keyboard.down('x'); // Auto-repeat of the held key.
    await target.clock.runFor(500);
    return target.locator('#game-canvas').evaluate((canvas) => canvas.toDataURL());
  };
  expect(await frame(page, true)).toBe(await frame(baseline, false));
  await page.keyboard.up('x');
  await page.keyboard.press('x');
  await page.clock.runFor(500);
  await baseline.clock.runFor(500);
  expect(await page.locator('#game-canvas').evaluate((canvas) => canvas.toDataURL()))
    .not.toBe(await baseline.locator('#game-canvas').evaluate((canvas) => canvas.toDataURL()));
  await baseline.close();
});

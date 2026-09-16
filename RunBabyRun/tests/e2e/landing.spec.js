import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('a short tap in zone eight turns only once while a hold still repeats', async ({ page, context }) => {
  const baseline = await context.newPage();
  const advance = async (target, milliseconds) => {
    for (let elapsed = 0; elapsed < milliseconds; elapsed += 10) {
      await target.clock.runFor(10);
      await target.evaluate(() => window.testGameFrame(performance.now()));
    }
  };
  const start = async (target) => {
    await target.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await target.addInitScript(() => {
      window.requestAnimationFrame = (callback) => { window.testGameFrame = callback; return 1; };
      window.cancelAnimationFrame = () => {};
    });
    await target.goto('/#/practice/8');
    await expect(target.locator('#game-canvas')).toHaveAttribute('data-mode', 'ready');
    await target.clock.pauseAt(new Date('2026-01-01T00:00:10Z'));
    await target.keyboard.press('s');
    await advance(target, 200);
  };
  const pixels = (target) => target.locator('#game-canvas').evaluate((canvas) => canvas.toDataURL());
  await start(page);
  await start(baseline);
  await page.keyboard.down('x');
  await advance(page, 110);
  await page.keyboard.up('x');
  await baseline.keyboard.press('x');
  await advance(baseline, 110);
  await advance(page, 200);
  await advance(baseline, 200);
  expect(await pixels(page)).toBe(await pixels(baseline));
  await page.keyboard.down('x');
  await baseline.keyboard.press('x');
  await advance(page, 400);
  await advance(baseline, 400);
  expect(await pixels(page)).not.toBe(await pixels(baseline));
  await page.keyboard.up('x');
  await baseline.close();
});

test('wrecks preserve every opponent silhouette in all four directions', async ({ page }) => {
  for (const modulePath of ['data/load-game-data.js', 'render/game-renderer.js']) {
    const body = await readFile(new URL(`../../src/${modulePath}`, import.meta.url), 'utf8');
    await page.route(`**/src/${modulePath}`, (route) => route.fulfill({ contentType: 'text/javascript', body }));
  }
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { loadGameData } = await import('/src/data/load-game-data.js');
    const { drawGame, drawSprite } = await import('/src/render/game-renderer.js');
    const data = await loadGameData();
    const makeContext = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 200;
      return canvas.getContext('2d');
    };
    const actual = makeContext();
    const reference = makeContext();
    let checked = 0;
    for (const spriteId of new Set(data.zones.flatMap((zone) => zone.enemySpriteIds))) {
      for (const direction of ['up', 'down', 'left', 'right']) {
        const horizontal = ['left', 'right'].includes(direction);
        const width = horizontal ? 16 : 8;
        const height = horizontal ? 8 : 16;
        reference.clearRect(0, 0, 320, 200);
        drawSprite(reference, data, spriteId, 80, 80, direction);
        drawGame(actual, data, {
          mode: 'running', lives: 0, zoneNumber: 1,
          maze: { width: 0, height: 0, rows: [] }, zone: {},
          player: { renderPosition: { x: 0, y: 0 }, direction: 'up' },
          enemies: [{ spriteId, crashed: true, direction, renderPosition: { x: 80, y: 80 } }],
        });
        const source = reference.getImageData(80, 80, width, height).data;
        const wreck = actual.getImageData(80, 80, width, height).data;
        for (let i = 0; i < source.length; i += 4) {
          const color = source[i] || source[i + 1] || source[i + 2] ? data.palette[7] : [0, 0, 0];
          if (color.some((value, channel) => wreck[i + channel] !== value) || wreck[i + 3] !== source[i + 3]) {
            return { error: `${spriteId} ${direction} pixel ${i / 4}` };
          }
        }
        checked += 1;
      }
    }
    return { checked };
  });
  expect(result.error).toBeUndefined();
  expect(result.checked).toBeGreaterThanOrEqual(32);
});

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

test('music and game sounds have independent persistent switches', async ({ page }) => {
  await page.goto('/#/play');
  const toggle = page.getByRole('button', { name: /Hudba/ });
  const effects = page.getByRole('button', { name: /Zvuky hry/ });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(effects).toHaveAttribute('aria-pressed', 'true');
  await effects.click();
  await expect(effects).toHaveAttribute('aria-pressed', 'false');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(effects).toHaveAttribute('aria-pressed', 'false');
  await expect(toggle).toContainText('Zapnuta');
  await expect(page.locator('#current-music')).toHaveText('J. S. Bach — Preludium a moll');
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(effects).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Alt+p');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(effects).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('runbabyrun.settings.v1')).music)).toBe(false);
});

test('practice exposes all zones and launches the selected one', async ({ page }) => {
  await page.goto('/#/practice');
  await expect(page.locator('[data-practice-zone]')).toHaveCount(42);
  await page.locator('[data-practice-zone="42"]').click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-zone', '42');
  await expect(page.getByRole('heading', { name: 'Zóna 42' })).toBeVisible();
});

test('a campaign crash advances to the next zone with one fewer life', async ({ page }) => {
  await page.addInitScript(() => {
    window.playedCrashSounds = [];
    window.Audio = class {
      constructor(source) { this.source = source; this.currentTime = 0; }
      cloneNode() { return new window.Audio(this.source); }
      addEventListener() {}
      play() { window.playedCrashSounds.push(this.source); return Promise.resolve(); }
      pause() {}
    };
  });
  await page.clock.install();
  await page.goto('/#/play');
  const canvas = page.locator('#game-canvas');
  await expect(canvas).toHaveAttribute('data-mode', 'ready');
  await page.keyboard.press('Enter');
  await page.clock.runFor(20000);
  await expect(canvas).toHaveAttribute('data-mode', 'ready');
  await expect(canvas).toHaveAttribute('data-zone', '2');
  await expect(page.locator('#game-status')).toContainText('Životy6');
  await expect.poll(() => page.evaluate(() => window.playedCrashSounds)).toContain('/audio/crash004.mp3');
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

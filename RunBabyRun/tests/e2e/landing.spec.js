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
    const { loadGameData, hexToRgb } = await import('/src/data/load-game-data.js');
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
          const color = source[i] || source[i + 1] || source[i + 2] ? hexToRgb(data.palette[7]) : [0, 0, 0];
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
  await expect.poll(() => page.evaluate(() => window.playedCrashSounds.map((source) => new URL(source, location.href).pathname))).toContain('/audio/crash004.mp3');
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
  const advance = async (target, milliseconds) => {
    for (let elapsed = 0; elapsed < milliseconds; elapsed += 50) {
      await target.clock.runFor(50);
      await target.evaluate(() => window.testGameFrame(performance.now()));
    }
  };
  const frame = async (target, staleInput) => {
    await target.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await target.addInitScript(() => {
      window.requestAnimationFrame = (callback) => { window.testGameFrame = callback; return 1; };
      window.cancelAnimationFrame = () => {};
    });
    await target.goto('/#/play');
    await expect(target.locator('#game-canvas')).toHaveAttribute('data-mode', 'ready');
    // Compare the same simulation duration, excluding real time spent on keyboard/assertion calls.
    await target.clock.pauseAt(new Date('2026-01-01T00:00:10Z'));
    await target.keyboard.press('s');
    for (let i = 0; i < 200; i += 1) {
      await advance(target, 100);
      if (await target.locator('#game-canvas').getAttribute('data-mode') === 'crashed') break;
    }
    await expect(target.locator('#game-canvas')).toHaveAttribute('data-mode', 'crashed');
    if (staleInput) await target.keyboard.down('x');
    await advance(target, 1000);
    await expect(target.locator('#game-canvas')).toHaveAttribute('data-zone', '2');
    if (staleInput) await target.keyboard.press('z');
    await target.keyboard.press('s');
    if (staleInput) await target.keyboard.down('x'); // Auto-repeat of the held key.
    await advance(target, 500);
    return target.locator('#game-canvas').evaluate((canvas) => canvas.toDataURL());
  };
  expect(await frame(page, true)).toBe(await frame(baseline, false));
  await page.keyboard.up('x');
  await page.keyboard.press('x');
  await advance(page, 500);
  await advance(baseline, 500);
  expect(await page.locator('#game-canvas').evaluate((canvas) => canvas.toDataURL()))
    .not.toBe(await baseline.locator('#game-canvas').evaluate((canvas) => canvas.toDataURL()));
  await baseline.close();
});

test.describe('mobile solo controls', () => {
  const landscapeSizes = [{ width: 844, height: 390 }, { width: 667, height: 375 }];

  for (const viewport of landscapeSizes) {
    test(`fills a ${viewport.width}x${viewport.height} landscape viewport without scrolling`, async ({ browser }) => {
      const context = await browser.newContext({ viewport, hasTouch: true });
      const page = await context.newPage();
      await page.goto('/#/play');
      await expect(page.locator('#mobile-start')).toBeVisible();
      await expect(page.locator('#mobile-menu')).toBeVisible();
      const layout = await page.evaluate(() => {
        const canvas = document.querySelector('#game-canvas').getBoundingClientRect();
        return {
          body: [document.body.scrollWidth, document.body.scrollHeight],
          viewport: [innerWidth, innerHeight],
          canvas: {
            left: canvas.left, top: canvas.top, right: canvas.right, bottom: canvas.bottom,
            intrinsicRatio: document.querySelector('#game-canvas').width / document.querySelector('#game-canvas').height,
            objectFit: getComputedStyle(document.querySelector('#game-canvas')).objectFit,
          },
        };
      });
      expect(layout.body[0]).toBeLessThanOrEqual(layout.viewport[0]);
      expect(layout.body[1]).toBeLessThanOrEqual(layout.viewport[1]);
      expect(layout.canvas.left).toBeGreaterThanOrEqual(0);
      expect(layout.canvas.top).toBeGreaterThanOrEqual(0);
      expect(layout.canvas.right).toBeLessThanOrEqual(layout.viewport[0]);
      expect(layout.canvas.bottom).toBeLessThanOrEqual(layout.viewport[1]);
      expect(layout.canvas.intrinsicRatio).toBeCloseTo(1.6, 2);
      expect(layout.canvas.objectFit).toBe('contain');
      await context.close();
    });
  }

  test('starts without Fullscreen API and asks for fullscreen when available', async ({ browser }) => {
    const fallback = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
    const fallbackPage = await fallback.newPage();
    await fallbackPage.addInitScript(() => { Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value: undefined }); });
    await fallbackPage.goto('/#/play');
    await fallbackPage.locator('#mobile-start').tap();
    await expect(fallbackPage.locator('#game-canvas')).toHaveAttribute('data-mode', 'running');
    await fallback.close();

    const supported = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
    const supportedPage = await supported.newPage();
    await supportedPage.addInitScript(() => {
      window.fullscreenRequests = 0;
      Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value() { window.fullscreenRequests += 1; return Promise.resolve(); } });
    });
    await supportedPage.goto('/#/play');
    await supportedPage.locator('#mobile-start').tap();
    await expect(supportedPage.locator('#game-canvas')).toHaveAttribute('data-mode', 'running');
    await expect.poll(() => supportedPage.evaluate(() => window.fullscreenRequests)).toBe(1);
    await supported.close();
  });

  test('keeps zone three contained after fullscreen and viewport changes', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.fullscreenRequests = 0;
      window.fakeFullscreenElement = null;
      Object.defineProperty(Document.prototype, 'fullscreenElement', { configurable: true, get() { return window.fakeFullscreenElement; } });
      Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value() {
        window.fullscreenRequests += 1;
        window.fakeFullscreenElement = this;
        return Promise.resolve();
      } });
      Object.defineProperty(Document.prototype, 'exitFullscreen', { configurable: true, value() {
        window.fakeFullscreenElement = null;
        return Promise.resolve();
      } });
    });
    await page.goto('/#/practice/3');
    await page.locator('#mobile-start').tap();
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-zone', '3');
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-mode', 'running');
    await page.setViewportSize({ width: 780, height: 360 });
    const layout = await page.evaluate(() => {
      const canvas = document.querySelector('#game-canvas');
      const bounds = canvas.getBoundingClientRect();
      return {
        requests: window.fullscreenRequests,
        overflow: [document.body.scrollWidth - innerWidth, document.body.scrollHeight - innerHeight],
        bounds: [bounds.left, bounds.top, bounds.right, bounds.bottom],
        viewport: [innerWidth, innerHeight],
        objectFit: getComputedStyle(canvas).objectFit,
      };
    });
    expect(layout.requests).toBe(1);
    expect(layout.overflow).toEqual([0, 0]);
    expect(layout.bounds).toEqual([0, 0, layout.viewport[0], layout.viewport[1]]);
    expect(layout.objectFit).toBe('contain');
    await context.close();
  });

  test('shows an orientation prompt in portrait', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await context.newPage();
    await page.goto('/#/practice/1');
    await expect(page.getByText('Otočte telefon')).toBeVisible();
    await expect(page.getByText('Hra se ovládá na šířku.')).toBeVisible();
    await context.close();
  });

  test('touch halves match keyboard turns, repeat while held, and stop on cancel', async ({ browser }) => {
    const touchContext = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
    const keyboardContext = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
    const touch = await touchContext.newPage();
    const keyboard = await keyboardContext.newPage();
    const prepare = async (target) => {
      await target.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
      await target.addInitScript(() => {
        window.requestAnimationFrame = (callback) => { window.testGameFrame = callback; return 1; };
        window.cancelAnimationFrame = () => {};
        Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value: undefined });
      });
      await target.goto('/#/practice/8');
      await target.clock.pauseAt(new Date('2026-01-01T00:00:10Z'));
      await target.locator('#mobile-start').tap();
    };
    const advance = async (target, milliseconds) => {
      for (let elapsed = 0; elapsed < milliseconds; elapsed += 10) {
        await target.clock.runFor(10);
        await target.evaluate(() => window.testGameFrame(performance.now()));
      }
    };
    const pixels = (target) => target.locator('#game-canvas').evaluate((canvas) => canvas.toDataURL());
    await prepare(touch);
    await prepare(keyboard);
    await advance(touch, 200);
    await advance(keyboard, 200);

    await touch.locator('[data-touch-turn="left"]').tap({ position: { x: 60, y: 190 } });
    await keyboard.keyboard.press('z');
    await advance(touch, 250);
    await advance(keyboard, 250);
    expect(await pixels(touch)).toBe(await pixels(keyboard));

    await touch.locator('[data-touch-turn="right"]').tap({ position: { x: 300, y: 190 } });
    await keyboard.keyboard.press('x');
    await advance(touch, 250);
    await advance(keyboard, 250);
    expect(await pixels(touch)).toBe(await pixels(keyboard));

    await touch.locator('[data-touch-turn="left"]').dispatchEvent('pointerdown', { pointerId: 41, pointerType: 'touch' });
    await expect(touch.locator('.play-page')).toHaveAttribute('data-touch-held', '1');
    await keyboard.keyboard.press('z');
    await advance(touch, 400);
    await advance(keyboard, 400);
    expect(await pixels(touch)).not.toBe(await pixels(keyboard));
    await touch.locator('[data-touch-turn="left"]').dispatchEvent('pointercancel', { pointerId: 41, pointerType: 'touch' });
    await expect(touch.locator('.play-page')).toHaveAttribute('data-touch-held', '0');
    await touchContext.close();
    await keyboardContext.close();
  });

  test('ignores touch turns before start', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
    const page = await context.newPage();
    await page.addInitScript(() => { Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value: undefined }); });
    await page.goto('/#/practice/8');
    await page.locator('[data-touch-turn="left"]').dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch' });
    await expect(page.locator('.play-page')).toHaveAttribute('data-touch-held', '0');
    await page.locator('#mobile-start').tap();
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-mode', 'running');
    await expect(page.locator('.play-page')).toHaveAttribute('data-touch-held', '0');
    await context.close();
  });
});

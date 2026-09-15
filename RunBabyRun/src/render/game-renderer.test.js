import { describe, expect, it, vi } from 'vitest';
import { COLORS, drawGame, drawHud, drawPixelText } from './game-renderer.js';

describe('original game HUD', () => {
  it('draws both portraits, the current lives, and a three-digit zone number', () => {
    const sprites = [
      ['sprite-12-numlives', 53, 29],
      ['sprite-16-nozivot', 26, 7],
      ['sprite-17-zivutek', 2, 7],
      ['sprite-11-richzon', 54, 28],
    ].map(([id, width, height], index) => ({
      id, width, height, atlas: { x: index * 60, y: 0, width, height },
    }));
    const context = {
      save: vi.fn(),
      translate: vi.fn(),
      drawImage: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
    };

    drawHud(context, { sprites, atlas: {} }, { lives: 3, zoneNumber: 42 });

    expect(context.translate.mock.calls).toEqual([[2, 1], [27, 22], [27, 22], [31, 22], [35, 22], [265, 1]]);
    expect(context.drawImage).toHaveBeenCalledTimes(6);
    expect(context.fillRect).toHaveBeenCalled();
  });
});

describe('pixel overlay text', () => {
  it('draws accented text as whole-pixel bitmap glyphs', () => {
    const context = { fillRect: vi.fn() };

    drawPixelText(context, 'ZÓNA 1', 160, 82);

    expect(context.fillRect).toHaveBeenCalled();
    for (const [, , width, height] of context.fillRect.mock.calls) {
      expect(width).toBe(1);
      expect(height).toBe(1);
    }
  });
});

describe('ready screen', () => {
  it('uses black and draws the opponents in the original starting row', () => {
    const context = {
      save: vi.fn(), translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(), drawImage: vi.fn(), restore: vi.fn(),
      fillRect: vi.fn(), strokeRect: vi.fn(), fillStyle: '', imageSmoothingEnabled: true,
    };
    const sprites = ['wall', 'player', 'enemy-1', 'enemy-2', 'sprite-12-numlives', 'sprite-16-nozivot', 'sprite-17-zivutek', 'sprite-11-richzon']
      .map((id, index) => ({ id, width: 8, height: 16, atlas: { x: index * 8, y: 0, width: 8, height: 16 } }));
    const state = {
      mode: 'ready', microStep: 0, lives: 0, zoneNumber: 1,
      maze: { width: 40, height: 25, rows: Array.from({ length: 25 }, () => '.'.repeat(40)) },
      zone: { wallSpriteId: 'wall', playerSpriteId: 'player' },
      player: { head: { x: 1, y: 22 }, tail: { x: 1, y: 23 }, direction: 'up' },
      enemies: [
        { spriteId: 'enemy-1', head: { x: 11, y: 23 }, tail: { x: 12, y: 23 }, renderPosition: { x: 104, y: 184 }, direction: 'left', crashed: false },
        { spriteId: 'enemy-2', head: { x: 11, y: 23 }, tail: { x: 12, y: 23 }, renderPosition: { x: 88, y: 184 }, direction: 'left', crashed: false },
      ],
    };

    drawGame(context, { sprites, atlas: {} }, state);

    expect(COLORS.background).toBe('#000000');
    expect(context.translate.mock.calls).toEqual(expect.arrayContaining([[88, 184], [104, 184]]));
    expect(context.drawImage.mock.calls.slice(0, 2).map((call) => call[1])).toEqual([16, 24]);
    expect(context.rotate).toHaveBeenCalledWith(Math.PI / 2);
    expect(context.strokeRect).not.toHaveBeenCalled();
  });
});

describe('stopping at walls', () => {
  it('does not extrapolate a stopped sprite into a wall from the microtick counter', () => {
    const context = {
      save: vi.fn(), translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(), drawImage: vi.fn(), restore: vi.fn(),
      fillRect: vi.fn(), strokeRect: vi.fn(), fillStyle: '', imageSmoothingEnabled: true,
    };
    const rows = Array.from({ length: 25 }, (_, y) => (y === 0 || y === 24 ? '#'.repeat(40) : `#${'.'.repeat(38)}#`));
    const data = {
      atlas: {},
      sprites: [{ id: 'player', width: 8, height: 16, atlas: { x: 0, y: 0, width: 8, height: 16 } }],
    };
    const state = {
      mode: 'running', microStep: 7, lives: 0, zoneNumber: 1,
      maze: { width: 40, height: 25, rows },
      zone: { wallSpriteId: 'wall', playerSpriteId: 'player' },
      player: { head: { x: 1, y: 1 }, tail: { x: 1, y: 2 }, direction: 'up' },
      enemies: [],
    };

    drawGame(context, data, state);

    expect(context.translate.mock.calls).toContainEqual([8, 8]);
    expect(context.translate.mock.calls).not.toContainEqual([8, 1]);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { drawHud } from './game-renderer.js';

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

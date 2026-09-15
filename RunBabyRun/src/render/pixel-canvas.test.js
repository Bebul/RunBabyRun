import { describe, expect, it } from 'vitest';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from './pixel-canvas.js';

describe('pixel canvas contract', () => {
  it('keeps the original Mode 13h resolution', () => {
    expect([SCREEN_WIDTH, SCREEN_HEIGHT]).toEqual([320, 200]);
  });
});

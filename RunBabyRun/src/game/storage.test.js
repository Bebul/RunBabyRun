import { describe, expect, it } from 'vitest';
import { HIGH_SCORE_KEY, rankScores, sanitizeName, saveScore } from './storage.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

describe('high scores', () => {
  it('sanitizes names for the canvas score table', () => {
    expect(sanitizeName('  Žofka<script>  ')).toBe('Žofkascript');
    expect(sanitizeName('')).toBe('HRÁČ');
  });

  it('sorts descending and keeps ten entries', () => {
    const scores = Array.from({ length: 10 }, (_, score) => ({ name: `P${score}`, score }));
    const ranked = rankScores(scores, { name: 'Vítěz', score: 99 });
    expect(ranked).toHaveLength(10);
    expect(ranked[0]).toEqual({ name: 'Vítěz', score: 99 });
  });

  it('persists under the versioned key', () => {
    const storage = memoryStorage();
    saveScore({ name: 'Ada', score: 21 }, storage);
    expect(JSON.parse(storage.getItem(HIGH_SCORE_KEY))[0]).toEqual({ name: 'Ada', score: 21 });
  });
});

import { describe, expect, it } from 'vitest';
import { createGame, step } from './engine.js';
import { advanceSimulation } from './simulation-clock.js';

function fixture() {
  const rows = Array.from({ length: 25 }, (_, y) => (y === 0 || y === 24 ? '#'.repeat(40) : `#${'.'.repeat(38)}#`));
  return {
    mazes: [{ id: 'test-maze', width: 40, height: 25, rows }],
    zones: [{ number: 1, mazeId: 'test-maze', enemyCount: 0, enemyTrackOffsets: [], enemySpriteIds: [], speedTicks: 10 }],
  };
}

describe('simulation clock', () => {
  it('does not carry waiting time from the start line into the first run', () => {
    const ready = createGame(fixture(), {
      initial: { player: { head: { x: 5, y: 5 }, tail: { x: 5, y: 6 }, direction: 'up' }, enemies: [] },
    });
    const waited = advanceSimulation(ready, { accumulator: 0, elapsed: 5_000, interval: 10 }, step);

    expect(waited.accumulator).toBe(0);
    const started = step(waited.state, { start: true });
    const firstFrame = advanceSimulation(started, { accumulator: waited.accumulator, elapsed: 0, interval: 10 }, step);

    expect(firstFrame.state.player).toMatchObject({ head: { x: 5, y: 5 }, tail: { x: 5, y: 6 } });
    expect(firstFrame.state.microStep).toBe(1);
  });
});

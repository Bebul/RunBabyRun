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
  it('chains turns in place, but does not buffer a repeat before release', () => {
    const ready = createGame(fixture(), {
      initial: { player: { head: { x: 10, y: 10 }, tail: { x: 10, y: 11 }, direction: 'up' }, enemies: [] },
    });
    let current = { state: step(ready, { start: true }), accumulator: 0, pendingInput: {} };
    const advance = (ticks, heldInput = {}) => {
      current = advanceSimulation(current.state, { ...current, elapsed: ticks * 10, interval: 10, heldInput }, step);
    };
    advance(7, { turn: 'left' });
    expect(current.state.playerCommand).toBe(13);
    advance(8, { turn: 'left' });
    expect(current.state.playerCommand).toBe(12);
    advance(8, { turn: 'left' });
    expect(current.state.playerCommand).toBe(14);
    advance(8, { turn: 'left' });
    expect(current.state.playerCommand).toBe(11);
    advance(8, { turn: 'left' });
    expect(current.state.player.head).toEqual({ x: 10, y: 9 });
    expect(current.state.player.tail).toEqual({ x: 10, y: 10 });
    expect(current.state.playerRoute.slice(0, 5)).toEqual([1, 13, 12, 14, 11]);
    advance(4, { turn: 'left' });
    expect(current.state.pendingTurn).toBeNull();
    advance(4);
    expect(current.state.playerCommand).toBe(3);
    expect(current.state.pendingTurn).toBeNull();
  });

  it('reverses in a narrow corridor while the turn key is held', () => {
    const data = fixture();
    data.mazes[0].rows = Array.from({ length: 25 }, (_, y) => y === 0 || y === 24 ? '#'.repeat(40) : '#.' + '#'.repeat(38));
    let state = step(createGame(data, {
      initial: { player: { head: { x: 1, y: 2 }, tail: { x: 1, y: 3 }, direction: 'up' }, enemies: [] },
    }), { start: true });
    const position = { ...state.player.renderPosition, y: 8 };
    const advance = (ticks) => {
      ({ state } = advanceSimulation(state, { accumulator: 0, elapsed: ticks * 10, interval: 10, heldInput: { turn: 'left' } }, step));
    };
    advance(7);
    advance(8);
    advance(8);
    expect(state.player.direction).toBe('down');
    expect(state.player.renderPosition).toEqual(position);
    expect(state.lives).toBe(7);
  });

  it('does not carry waiting time from the start line into the first run', () => {
    const ready = createGame(fixture(), {
      initial: { player: { head: { x: 5, y: 5 }, tail: { x: 5, y: 6 }, direction: 'up' }, enemies: [] },
    });
    const waited = advanceSimulation(ready, { accumulator: 0, elapsed: 5_000, interval: 10 }, step);

    expect(waited.accumulator).toBe(0);
    const started = step(waited.state, { start: true });
    const firstFrame = advanceSimulation(started, { accumulator: waited.accumulator, elapsed: 0, interval: 10 }, step);

    expect(firstFrame.state.player).toMatchObject({ head: { x: 5, y: 4 }, tail: { x: 5, y: 5 }, renderPosition: { x: 40, y: 39 } });
    expect(firstFrame.state.microStep).toBe(1);
  });
});

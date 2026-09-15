import { describe, expect, it } from 'vitest';
import { createGame, routeAction, step } from './engine.js';

function fixture({ enemies = [] } = {}) {
  const rows = Array.from({ length: 25 }, (_, y) => (y === 0 || y === 24 ? '#'.repeat(40) : `#${'.'.repeat(38)}#`));
  return {
    mazes: [{ id: 'test-maze', width: 40, height: 25, rows }],
    zones: [{ number: 1, mazeId: 'test-maze', enemyCount: enemies.length, enemyTrackOffsets: [], enemySpriteIds: [], speedTicks: 10 }],
  };
}

function advanceCell(state, input = {}) {
  let next = state;
  for (let index = 0; index < 8; index += 1) next = step(next, index === 0 ? input : {});
  return next;
}

describe('game engine', () => {
  it('queues a turn and applies it at the next cell boundary', () => {
    let state = createGame(fixture(), { initial: { player: { head: { x: 5, y: 5 }, tail: { x: 5, y: 6 }, direction: 'up' }, enemies: [] } });
    state = step(state, { start: true, turn: 'right' });
    expect(state.pendingTurn).toBe('right');
    for (let index = 1; index < 8; index += 1) state = step(state);
    expect(state.player).toMatchObject({ head: { x: 6, y: 5 }, tail: { x: 5, y: 5 }, direction: 'right' });
  });

  it('sticks at a wall without losing a life and can turn away', () => {
    let state = createGame(fixture(), { initial: { player: { head: { x: 1, y: 1 }, tail: { x: 1, y: 2 }, direction: 'up' }, enemies: [] } });
    state = step(state, { start: true });
    for (let index = 1; index < 8; index += 1) state = step(state);
    expect(state.blocked).toBe(true);
    expect(state.lives).toBe(7);
    state = advanceCell(state, { turn: 'right' });
    expect(state.player.head).toEqual({ x: 2, y: 1 });
  });

  it('turns an enemy collision into a wreck and wins after the last wreck', () => {
    const enemy = { id: 'enemy-1', head: { x: 1, y: 1 }, tail: { x: 2, y: 1 }, direction: 'left', routeCursor: 315, crashed: false };
    let state = createGame(fixture({ enemies: [enemy] }), {
      initial: { player: { head: { x: 10, y: 10 }, tail: { x: 10, y: 11 }, direction: 'up' }, enemies: [enemy] },
    });
    state = advanceCell(step(state, { start: true }));
    expect(state.enemies[0].crashed).toBe(true);
    expect(state.mode).toBe('won');
  });

  it('loses a life when the player hits an enemy', () => {
    const enemy = { id: 'enemy-1', head: { x: 5, y: 4 }, tail: { x: 6, y: 4 }, direction: 'left', routeCursor: 0, crashed: false };
    let state = createGame(fixture({ enemies: [enemy] }), {
      initial: { player: { head: { x: 5, y: 5 }, tail: { x: 5, y: 6 }, direction: 'up' }, enemies: [enemy] },
    });
    state = advanceCell(step(state, { start: true }));
    expect(state.mode).toBe('crashed');
    expect(state.lives).toBe(6);
  });

  it('delays enemies before replaying the player route', () => {
    expect(routeAction(['right'], 314)).toBe('stop');
    expect(routeAction(['right'], 315)).toBe('left');
    expect(routeAction(['right'], 323)).toBe('up');
    expect(routeAction(['right'], 324)).toBe('right');
  });
});

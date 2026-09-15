import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createGame, HISTORY_SIZE, HISTORY_START, routeAction, step } from './engine.js';

function fixture(offsets = []) {
  return {
    mazes: [{ id: 'test', width: 40, height: 25, rows: Array.from({ length: 25 }, (_, y) => y === 0 || y === 24 ? '#'.repeat(40) : `#${'.'.repeat(38)}#`) }],
    zones: [{ number: 1, mazeId: 'test', enemyCount: offsets.length, enemyTrackOffsets: offsets, enemySpriteIds: offsets.map((_, i) => `enemy-${i}`), speedTicks: 10 }],
  };
}
function game(data = fixture(), initial = {}) {
  return { ...createGame(data, { initial }), mode: 'running' };
}
function batch(state, input = {}) {
  for (let i = 0; i < 8; i += 1) state = step(state, i === 0 ? input : {});
  return state;
}
function batches(state, n) {
  for (let i = 0; i < n; i += 1) state = batch(state);
  return state;
}
function enemy(x, y, cursor = HISTORY_START, direction = 'up') {
  const tail = { x: x + (direction === 'left' ? 1 : direction === 'right' ? -1 : 0), y: y + (direction === 'up' ? 1 : direction === 'down' ? -1 : 0) };
  return { id: `enemy-${x}-${y}`, head: { x, y }, tail, direction, routeCursor: cursor };
}
function assertClearSprite(state) {
  const { x, y } = state.player.renderPosition;
  const horizontal = ['left', 'right'].includes(state.player.displayDirection);
  for (let py = y; py < y + (horizontal ? 8 : 16); py += 1) {
    for (let px = x; px < x + (horizontal ? 16 : 8); px += 1) {
      expect(state.maze.rows[Math.floor(py / 8)]?.[Math.floor(px / 8)], `sprite at ${px},${py}`).toBe('.');
    }
  }
}

describe('eight-pixel batches', () => {
  it('updates logical cells before animation and records once after eight pixels', () => {
    let state = game();
    for (let i = 1; i <= 8; i += 1) {
      state = step(state);
      expect(state.player.head).toEqual({ x: 1, y: 21 });
      expect(state.player.renderPosition).toEqual({ x: 8, y: 176 - i });
      expect(state.recordedBatches).toBe(i === 8 ? 1 : 0);
    }
    expect(state.playerRoute[0]).toBe(1);
    expect(state.microStep).toBe(0);
  });

  it('finishes movement, turns for one whole batch, then drives in the new direction', () => {
    let state = game(fixture(), { player: { head: { x: 5, y: 5 }, tail: { x: 5, y: 6 }, direction: 'up' } });
    state = batch(state, { turn: 'right' });
    expect(state.player.head).toEqual({ x: 5, y: 4 });
    state = step(state);
    expect(state.player).toMatchObject({ head: { x: 6, y: 4 }, tail: { x: 5, y: 4 }, renderPosition: { x: 40, y: 32 }, direction: 'right' });
    for (let i = 0; i < 7; i += 1) {
      state = step(state);
      expect(state.player.renderPosition).toEqual({ x: 40, y: 32 });
    }
    state = batch(state);
    expect(state.player.renderPosition).toEqual({ x: 48, y: 32 });
    expect(state.playerRoute.slice(0, 3)).toEqual([1, 14, 4]);
  });

  it('keeps the full player sprite outside walls on every microtick', () => {
    const data = fixture();
    data.mazes[0].rows = Array.from({ length: 25 }, (_, y) => y === 0 || y === 24 ? '#'.repeat(40) : '#.' + '#'.repeat(38));
    let state = game(data, { player: { head: { x: 1, y: 2 }, tail: { x: 1, y: 3 }, direction: 'up' } });
    state = batch(state, { turn: 'left' });
    const position = { ...state.player.renderPosition };
    for (let i = 0; i < 24; i += 1) {
      state = step(state);
      expect(state.player.renderPosition).toEqual(position);
      expect(state.player.displayDirection).toBe('up');
      assertClearSprite(state);
    }
    expect(state.playerRoute.slice(0, 4)).toEqual([1, 11, 11, 11]);
    expect(state.lives).toBe(7);
    // Same blocked side again: swap head/tail without turning into the wall.
    state = batch(state, { turn: 'left' });
    state = batch(state);
    expect(state.player.direction).toBe('down');
    expect(state.player.head).toEqual({ x: 1, y: 2 });
    expect(state.player.renderPosition).toEqual(position);
    assertClearSprite(state);
    state = batch(state);
    expect(state.player.head.y).toBe(3);
    assertClearSprite(state);
  });

  it('cancels a blocked side turn with the other key and resumes the original heading', () => {
    const data = fixture();
    let state = game(data, { player: { head: { x: 1, y: 8 }, tail: { x: 1, y: 9 }, direction: 'up' } });
    state = batch(state, { turn: 'left' });
    state = batch(state, { turn: 'right' });
    expect(state.blocked).toBe(true);
    state = batch(state);
    expect(state.player).toMatchObject({ head: { x: 1, y: 6 }, direction: 'up' });
    expect(state.blockedTurn).toBeNull();
  });
});

describe('original start sequence', () => {
  it('keeps all logical starts shared but renders the reversed starting row', () => {
    const state = game(fixture([0, 65, 295]));
    expect(state.enemies.map((e) => e.head)).toEqual(Array(3).fill({ x: 11, y: 23 }));
    expect(state.enemies.map((e) => e.renderPosition)).toEqual([{ x: 120, y: 184 }, { x: 104, y: 184 }, { x: 88, y: 184 }]);
  });

  it('shifts the remaining row only during the two queue batches, then joins the player origin', () => {
    let state = game(fixture([0, 65, 125, 175, 215, 235, 275, 295]));
    state = batches(state, 20);
    expect(state.enemies[7].renderPosition.x).toBe(88);
    state = step(state);
    expect(state.enemies[7].command).toBe(7);
    expect(state.enemies[7].renderPosition.x).toBe(87);
    expect(state.enemies[6].renderPosition.x).toBe(103);
    for (let i = 0; i < 15; i += 1) state = step(state);
    expect(state.enemies[7].renderPosition.x).toBe(72);
    expect(state.enemies[6].renderPosition.x).toBe(88);
    state = batches(state, 8);
    expect(state.enemies[7].renderPosition).toEqual({ x: 8, y: 184 });
    expect(state.enemies[6].renderPosition.x).toBe(88);
    state = batch(state);
    expect(state.enemies[7]).toMatchObject({ head: { x: 1, y: 22 }, tail: { x: 1, y: 23 }, renderPosition: { x: 8, y: 176 }, routeCursor: 326 });
    state = batch(state);
    expect(state.enemies[7].head).toEqual({ x: 1, y: 21 });
    expect(state.enemies.every((e) => !e.crashed)).toBe(true);
  });

  it.each([[0, 315], [75, 240], [250, 65], [295, 20], [300, 15]])('starts offset %i after %i waiting batches', (offset, waiting) => {
    let state = game(fixture([offset]), { player: { head: { x: 30, y: 1 }, tail: { x: 30, y: 2 }, direction: 'up' } });
    state = batches(state, waiting);
    expect(state.enemies[0].renderPosition.x).toBe(88);
    state = step(state);
    expect(state.enemies[0]).toMatchObject({ command: 7, phase: 'queue', renderPosition: { x: 87, y: 184 } });
  });

  it('distinguishes waiting, row shift, entry, orientation and recorded commands', () => {
    expect([314, 315, 316, 317, 324, 325, 326].map((cursor) => routeAction([14], cursor))).toEqual([6, 7, 7, 3, 3, 11, 14]);
  });
});

describe('independent replay cursors', () => {
  it('reproduces the complete player footprint through a sequence of turns', () => {
    let leader = game(fixture(), { player: { head: { x: 5, y: 15 }, tail: { x: 5, y: 16 }, direction: 'up' } });
    const poses = [];
    for (let i = 0; i < 24; i += 1) {
      leader = batch(leader, [3, 8, 13, 18].includes(i) ? { turn: 'right' } : {});
      poses.push({ head: leader.player.head, tail: leader.player.tail, renderPosition: leader.player.renderPosition });
    }
    let follower = game(fixture(), {
      player: { head: { x: 30, y: 1 }, tail: { x: 30, y: 2 }, direction: 'up' },
      enemies: [enemy(5, 15)],
    });
    follower.playerRoute = [...leader.playerRoute];
    follower.routeWriteCursor = 100;
    for (const pose of poses) {
      follower = batch(follower);
      expect(follower.enemies[0]).toMatchObject(pose);
      expect(follower.mode).toBe('running');
    }
  });

  it('compresses repeated oriented stops but preserves turns and shared history', () => {
    let state = game(fixture(), { enemies: [enemy(10, 10), enemy(20, 10, 329)] });
    state.playerRoute.splice(0, 6, 11, 11, 11, 14, 14, 4);
    state.routeWriteCursor = 6;
    state = batch(state);
    expect(state.enemies[0]).toMatchObject({ routeCursor: 329, head: { x: 10, y: 10 } });
    expect(state.enemies[1]).toMatchObject({ routeCursor: 331, head: { x: 21, y: 10 }, renderPosition: { x: 160, y: 80 } });
    expect(state.playerRoute.slice(0, 6)).toEqual([11, 11, 11, 14, 14, 4]);
    state = batch(state);
    expect(state.enemies[0]).toMatchObject({ routeCursor: 331, head: { x: 11, y: 10 } });
    expect(state.enemies[1].head).toEqual({ x: 22, y: 10 });
  });

  it('writes before the last enemy microstep so a growing stop run can be skipped', () => {
    let state = game(fixture(), { player: { head: { x: 1, y: 1 }, tail: { x: 1, y: 2 }, direction: 'up' }, enemies: [enemy(10, 10)] });
    state.playerRoute[0] = 11;
    state.routeWriteCursor = 1;
    state = batch(state);
    expect(state.playerRoute.slice(0, 2)).toEqual([11, 11]);
    expect(state.enemies[0].routeCursor).toBe(328);
  });

  it('wraps both cursors into the 700-command history without replaying the prelude', () => {
    let state = game(fixture(), { player: { head: { x: 1, y: 1 }, tail: { x: 1, y: 2 }, direction: 'up' }, enemies: [enemy(10, 10, 1025)] });
    state.routeWriteCursor = 699;
    state.playerRoute[699] = 11;
    state.playerRoute[0] = 4;
    state = batch(state);
    expect(state.playerRoute).toHaveLength(HISTORY_SIZE);
    expect(state.routeWriteCursor).toBe(0);
    expect(state.enemies[0].routeCursor).toBe(HISTORY_START);
    state = batch(state);
    expect(state.enemies[0].command).toBe(4);
    expect(state.enemies[0].routeCursor).toBe(327);
  });

  it('pursues an idle player instead of crashing opponents into a wall', () => {
    let state = game(fixture([295]));
    for (let i = 0; i < 80 * 8 && state.mode === 'running'; i += 1) state = step(state);
    expect(state.mode).toBe('crashed');
    expect(state.lives).toBe(6);
    expect(state.enemies[0].crashed).toBe(false);
  });
});

describe('original maps', () => {
  it('never draws the player footprint across a wall while turning in any of the 42 zones', () => {
    const zones = JSON.parse(readFileSync(new URL('../../public/generated/zones.json', import.meta.url))).zones;
    const mazes = JSON.parse(readFileSync(new URL('../../public/generated/mazes.json', import.meta.url))).mazes;
    let seed = 12345;
    const failures = [];
    for (const zone of zones) {
      let state = { ...createGame({ zones, mazes }, { zoneNumber: zone.number, initial: { enemies: [] } }), mode: 'running' };
      for (let tick = 0; tick < 512; tick += 1) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        state = step(state, tick % 8 === 3 && seed % 3 !== 0 ? { turn: (seed >>> 8) & 1 ? 'left' : 'right' } : {});
        const { x, y } = state.player.renderPosition;
        const horizontal = ['left', 'right'].includes(state.player.displayDirection);
        for (let cy = Math.floor(y / 8); cy <= Math.floor((y + (horizontal ? 7 : 15)) / 8); cy += 1) {
          for (let cx = Math.floor(x / 8); cx <= Math.floor((x + (horizontal ? 15 : 7)) / 8); cx += 1) {
            if (state.maze.rows[cy]?.[cx] !== '.') failures.push({ zone: zone.number, tick, x, y, cx, cy });
          }
        }
      }
      expect(state.mode, `zone ${zone.number}`).toBe('running');
    }
    expect(failures).toEqual([]);
  }, 15000);
});

describe('ordered collisions', () => {
  it('only crashes the later car, finishes its animation and freezes it next batch', () => {
    let state = game(fixture(), { enemies: [enemy(10, 10), enemy(10, 10), enemy(25, 10)] });
    state.playerRoute[0] = 1;
    state.routeWriteCursor = 10;
    state = step(state);
    expect(state.enemies.map((e) => e.crashed)).toEqual([false, true, false]);
    expect(state.enemies[1].wreck).toBe(false);
    expect(state.enemies[1].renderPosition.y).toBe(79);
    for (let i = 0; i < 7; i += 1) state = step(state);
    state = step(state);
    expect(state.enemies[1].wreck).toBe(true);
    expect(state.enemies[1].renderPosition.y).toBe(72);
  });

  it('wins after N-1 wrecks, after finishing the batch', () => {
    let state = game(fixture(), { enemies: [enemy(10, 10), enemy(10, 10)] });
    state.playerRoute[0] = 1;
    state.routeWriteCursor = 10;
    state = step(state);
    expect(state.mode).toBe('running');
    for (let i = 0; i < 7; i += 1) state = step(state);
    expect(state.mode).toBe('won');
    expect(state.enemies.filter((e) => !e.crashed)).toHaveLength(1);
  });

  it('does not test waiting and shifting cars as collision victims', () => {
    let state = game(fixture(), { enemies: [enemy(10, 10, 0), enemy(10, 10, 0), enemy(11, 10, 315, 'left')] });
    state = batch(state);
    expect(state.enemies.every((e) => !e.crashed)).toBe(true);
  });

  it('detects a pursuer hitting the player tail before pixel animation', () => {
    let state = game(fixture(), { enemies: [enemy(1, 23)] });
    state.playerRoute[0] = 1;
    state.routeWriteCursor = 10;
    state = step(state);
    expect(state.mode).toBe('crashed');
    expect(state.lives).toBe(6);
    expect(state.player.renderPosition).toEqual({ x: 8, y: 176 });
  });
});

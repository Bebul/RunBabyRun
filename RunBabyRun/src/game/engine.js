export const DIRECTIONS = Object.freeze({
  up: { x: 0, y: -1 }, right: { x: 1, y: 0 },
  down: { x: 0, y: 1 }, left: { x: -1, y: 0 },
});
const ORDER = ['up', 'right', 'down', 'left'];
const CODES = { up: 1, down: 2, left: 3, right: 4 };
const HEADINGS = { 1: 'up', 2: 'down', 3: 'left', 4: 'right' };
export const HISTORY_START = 326;
export const HISTORY_SIZE = 700;

/** Serializable state; logical cells and animated pixel positions are distinct. */
export function createGame(data, { zoneNumber = 1, lives = 7, practice = false, initial = {} } = {}) {
  const zone = data.zones.find((item) => item.number === zoneNumber);
  if (!zone) throw new Error(`Neznámá zóna ${zoneNumber}.`);
  const maze = data.mazes.find((item) => item.id === zone.mazeId);
  if (!maze) throw new Error(`Zóně ${zoneNumber} chybí bludiště.`);
  const player = vehicle({ id: 'player', head: { x: 1, y: 22 }, tail: { x: 1, y: 23 }, direction: 'up', ...initial.player });
  const enemies = (initial.enemies ?? Array.from({ length: zone.enemyCount }, (_, i) => ({
    id: `enemy-${i + 1}`, head: { x: 11, y: 23 }, tail: { x: 12, y: 23 }, direction: 'left',
    spriteId: zone.enemySpriteIds[i], routeCursor: zone.enemyTrackOffsets[i] ?? 0,
    // putformule draws the highest-numbered car at the front of the queue.
    renderPosition: { x: 88 + (zone.enemyCount - 1 - i) * 16, y: 184 },
  }))).map((enemy, i) => vehicle({
    routeCursor: 0, crashed: false, wreck: false, type: i + 3, ...enemy,
    phase: (enemy.routeCursor ?? 0) < 315 ? 'waiting' : (enemy.routeCursor < 317 ? 'queue' : 'pursuit'),
  }));
  const state = {
    version: 2, mode: 'ready', zoneNumber, mazeId: zone.mazeId, lives, practice,
    tick: 0, cellTick: 0, microStep: 0, pendingTurn: null,
    playerCommand: CODES[player.direction], blockedTurn: null, blocked: false,
    lastEvent: 'ready', player, enemies,
    playerRoute: Array(HISTORY_SIZE).fill(0), routeWriteCursor: 0, recordedBatches: 0,
    zone, maze, occupancy: maze.rows.flatMap((row) => [...row].map((cell) => cell === '#' ? 255 : 0)),
  };
  // Initialize both cells explicitly, including diagnostic starts that first turn/stop.
  paint(state, player.head, 2);
  paint(state, player.tail, 2);
  for (const enemy of enemies) {
    paint(state, enemy.head, enemy.crashed || enemy.phase === 'waiting' ? 40 : enemy.type);
    paint(state, enemy.tail, enemy.crashed || enemy.phase === 'waiting' ? 40 : enemy.type);
  }
  return state;
}

function vehicle(value) {
  const entity = structuredClone(value);
  entity.displayDirection = entity.direction;
  entity.renderPosition ??= corner(entity);
  return entity;
}

export function step(previous, input = {}) {
  const state = structuredClone(previous);
  if (input.restart) return createGame({ zones: [state.zone], mazes: [state.maze] }, {
    zoneNumber: state.zoneNumber, lives: state.lives, practice: state.practice,
  });
  if (input.start && state.mode === 'ready') {
    state.mode = 'running';
    state.lastEvent = 'started';
  }
  if (input.turn === 'left' || input.turn === 'right') state.pendingTurn = input.turn;
  if (state.mode !== 'running') return state;
  state.tick += 1;

  // cyklus: predemnou, havarie, then eight calls to the pixel movement routines.
  if (state.microStep === 0) {
    beginBatch(state);
    if (state.mode !== 'running') return state;
  }
  animate(state.player, state.playerCommand);
  const lastMicro = state.microStep === 7;
  if (lastMicro) {
    state.playerRoute[state.routeWriteCursor] = state.playerCommand;
    state.routeWriteCursor = (state.routeWriteCursor + 1) % HISTORY_SIZE;
    state.recordedBatches += 1;
  }
  for (const enemy of state.enemies) {
    const command = routeAction(state.playerRoute, enemy.routeCursor);
    // autopal/preskok: retain ONE oriented stop; only move this car's cursor.
    if (command >= 11 && command <= 14) {
      while (enemy.routeCursor + 1 < HISTORY_START + HISTORY_SIZE
        && routeAction(state.playerRoute, enemy.routeCursor + 1) === command) enemy.routeCursor += 1;
    }
    const displayCommand = enemy.wreck ? CODES[enemy.displayDirection] + 10 : command;
    if (displayCommand === 7) {
      for (const waiting of state.enemies) {
        if (waiting !== enemy && waiting.phase === 'waiting') waiting.renderPosition.x -= 1;
      }
    }
    animate(enemy, displayCommand);
    if (lastMicro) {
      enemy.routeCursor += 1;
      if (enemy.routeCursor === HISTORY_START + HISTORY_SIZE) enemy.routeCursor = HISTORY_START;
    }
  }
  state.microStep = (state.microStep + 1) % 8;
  if (lastMicro) {
    state.cellTick += 1;
    // keymak acts after the complete batch, never during its animation.
    if (state.pendingTurn) {
      state.playerCommand = CODES[rotate(heading(state.playerCommand), state.pendingTurn)] + 10;
      state.pendingTurn = null;
    } else if (!state.blockedTurn && state.playerCommand >= 11) state.playerCommand -= 10;
    if (state.batchWon) {
      state.mode = 'won';
      state.lastEvent = 'zone-won';
    }
  }
  return state;
}

function beginBatch(state) {
  updatePlayer(state);
  if (state.mode !== 'running') return;
  // rozjezd runs in reverse order; the order of writes to dtpolasc matters.
  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = state.enemies[i];
    enemy.command = routeAction(state.playerRoute, enemy.routeCursor);
    if (enemy.crashed) {
      enemy.wreck = true;
      paint(state, enemy.head, 40);
      paint(state, enemy.tail, 40);
      continue;
    }
    enemy.phase = enemy.command === 6 ? 'waiting' : enemy.command === 7 ? 'queue'
      : enemy.routeCursor < HISTORY_START ? 'entry' : 'pursuit';
    if (enemy.command === 7 && enemy.routeCursor === 315) enemy.renderPosition = { x: 88, y: 184 };
    applyLogicalCommand(state, enemy, enemy.command, enemy.type, true);
  }
  if (read(state, state.player.head) !== 2 || read(state, state.player.tail) !== 2) {
    crashPlayer(state);
    return;
  }
  // baseprg: only the later record becomes a wreck, never both cars at once.
  for (let i = state.enemies.length - 1; i > 0; i -= 1) {
    const enemy = state.enemies[i];
    if (enemy.crashed || enemy.command === 6 || enemy.command === 7) continue;
    for (let j = i - 1; j >= 0; j -= 1) {
      const other = state.enemies[j];
      if (!other.crashed && overlaps(enemy, other)) {
        enemy.crashed = true;
        state.lastEvent = 'enemy-crashed';
        break;
      }
    }
  }
  state.batchWon = state.enemies.length > 1
    && state.enemies.filter((enemy) => enemy.crashed).length === state.enemies.length - 1;
}

function updatePlayer(state) {
  const player = state.player;
  const wanted = heading(state.playerCommand);
  state.blocked = false;
  if (state.playerCommand <= 4) {
    const target = add(player.head, DIRECTIONS[wanted]);
    if (isWall(state.maze, target)) return stopPlayer(state);
    if (read(state, target) >= 20) return crashPlayer(state);
    applyLogicalCommand(state, player, state.playerCommand, 2);
    state.lastEvent = 'moved';
    return;
  }
  if (wanted === player.direction) {
    state.blocked = Boolean(state.blockedTurn) || isWall(state.maze, add(player.head, DIRECTIONS[wanted]));
    return;
  }
  const target = add(player.head, DIRECTIONS[wanted]);
  // zpravic/autoboli: a failed side turn keeps the actual footprint. Repeating
  // that attempt reverses head/tail; the other turn resumes the old heading.
  if (state.blockedTurn) {
    if (state.blockedTurn === wanted && isWall(state.maze, target)) {
      [player.head, player.tail] = [player.tail, player.head];
      player.direction = opposite(player.direction);
      state.playerCommand = CODES[player.direction] + 10;
      state.blockedTurn = null;
      state.lastEvent = 'turned';
      return;
    }
    state.blockedTurn = null;
    state.playerCommand = CODES[player.direction];
    return updatePlayer(state);
  }
  if (isWall(state.maze, target)) {
    state.blockedTurn = wanted;
    return stopPlayer(state);
  }
  if (read(state, target) >= 20) return crashPlayer(state);
  applyLogicalCommand(state, player, state.playerCommand, 2);
  state.lastEvent = 'turned';
}

function stopPlayer(state) {
  state.playerCommand = CODES[state.player.direction] + 10;
  state.blocked = true;
  state.lastEvent = 'wall';
}

function applyLogicalCommand(state, entity, command, type, enemy = false) {
  const direction = command === 7 ? 'left' : heading(command);
  const moves = command >= 1 && command <= 4 || command === 7;
  if (moves || direction && direction !== entity.direction && direction !== opposite(entity.direction)) {
    const oldTail = entity.tail;
    entity.tail = { ...entity.head };
    entity.head = add(entity.head, DIRECTIONS[direction]);
    entity.direction = direction;
    paint(state, entity.head, enemy && !moves ? 40 : type);
    if (moves) paint(state, entity.tail, type);
    paint(state, oldTail, 0);
  } else {
    if (direction === opposite(entity.direction)) {
      [entity.head, entity.tail] = [entity.tail, entity.head];
      entity.direction = direction;
    }
    if (enemy) {
      paint(state, entity.head, 40);
      paint(state, entity.tail, 40);
    }
  }
}

// hniformli/strednice: movement is one pixel, a turn is an immediate change of
// the two-cell footprint followed by the rest of the stationary batch.
function animate(entity, command) {
  const direction = command === 7 ? 'left' : heading(command);
  if (!direction) return;
  if (command <= 4 || command === 7) {
    entity.renderPosition = add(entity.renderPosition, DIRECTIONS[direction]);
  } else if (direction !== entity.displayDirection && direction !== opposite(entity.displayDirection)) {
    const head = { ...entity.renderPosition };
    if (entity.displayDirection === 'right') head.x += 8;
    if (entity.displayDirection === 'down') head.y += 8;
    const next = add(head, scale(DIRECTIONS[direction], 8));
    entity.renderPosition = { x: Math.min(head.x, next.x), y: Math.min(head.y, next.y) };
  }
  entity.displayDirection = direction;
}

export function routeAction(playerRoute, cursor) {
  if (cursor < 315) return 6;
  if (cursor < 317) return 7;
  if (cursor < 325) return 3;
  if (cursor === 325) return 11;
  return playerRoute[(cursor - HISTORY_START) % HISTORY_SIZE] ?? 0;
}

function heading(command) { return HEADINGS[command > 10 ? command - 10 : command]; }
function rotate(direction, turn) { return ORDER[(ORDER.indexOf(direction) + (turn === 'left' ? 3 : 1)) % 4]; }
function opposite(direction) { return ORDER[(ORDER.indexOf(direction) + 2) % 4]; }
function corner(entity) { return { x: Math.min(entity.head.x, entity.tail.x) * 8, y: Math.min(entity.head.y, entity.tail.y) * 8 }; }
function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
function scale(a, n) { return { x: a.x * n, y: a.y * n }; }
function same(a, b) { return a.x === b.x && a.y === b.y; }
function overlaps(a, b) { return [a.head, a.tail].some((cell) => same(cell, b.head) || same(cell, b.tail)); }
function isWall(maze, p) { return p.y < 0 || p.y >= maze.height || p.x < 0 || p.x >= maze.width || maze.rows[p.y][p.x] === '#'; }
function read(state, p) { return state.occupancy[p.y * state.maze.width + p.x] ?? 255; }
function paint(state, p, code) { state.occupancy[p.y * state.maze.width + p.x] = code; }
function crashPlayer(state) {
  state.lives = Math.max(0, state.lives - 1);
  state.mode = state.lives === 0 ? 'game-over' : 'crashed';
  state.lastEvent = 'collision';
}

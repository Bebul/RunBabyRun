export const DIRECTIONS = Object.freeze({
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
});

const DIRECTION_ORDER = ['up', 'right', 'down', 'left'];
const PRELUDE_LENGTH = 315;
const EXIT_RUN = ['left', 'left', 'left', 'left', 'left', 'left', 'left', 'left', 'up'];

/**
 * Create a serializable game state. `initial` is intended for diagnostics and tests.
 */
export function createGame(data, { zoneNumber = 1, lives = 7, practice = false, initial = {} } = {}) {
  const zone = data.zones.find((candidate) => candidate.number === zoneNumber);
  if (!zone) throw new Error(`Neznámá zóna ${zoneNumber}.`);
  const maze = data.mazes.find((candidate) => candidate.id === zone.mazeId);
  if (!maze) throw new Error(`Zóně ${zoneNumber} chybí bludiště.`);

  const defaultPlayer = vehicle('player', 1, 22, 1, 23, 'up');
  const player = initial.player ? { ...defaultPlayer, ...clone(initial.player) } : defaultPlayer;
  const enemies = initial.enemies
    ? clone(initial.enemies)
    : Array.from({ length: zone.enemyCount }, (_, index) => ({
      ...vehicle(`enemy-${index + 1}`, 11, 23, 12, 23, 'left'),
      spriteId: zone.enemySpriteIds[index],
      routeCursor: zone.enemyTrackOffsets[index],
      crashed: false,
    }));

  return {
    version: 1,
    mode: 'ready',
    zoneNumber,
    mazeId: zone.mazeId,
    lives,
    practice,
    tick: 0,
    cellTick: 0,
    microStep: 0,
    pendingTurn: null,
    blocked: false,
    lastEvent: 'ready',
    player,
    enemies,
    playerRoute: [],
    zone,
    maze,
  };
}

function vehicle(id, headX, headY, tailX, tailY, direction) {
  return { id, head: { x: headX, y: headY }, tail: { x: tailX, y: tailY }, direction };
}

export function step(previous, input = {}) {
  const state = clone(previous);
  if (input.restart) return createGame({ zones: [state.zone], mazes: [state.maze] }, {
    zoneNumber: state.zoneNumber,
    lives: state.lives,
    practice: state.practice,
  });
  if (input.start && state.mode === 'ready') {
    state.mode = 'running';
    state.lastEvent = 'started';
  }
  if (input.turn === 'left' || input.turn === 'right') state.pendingTurn = input.turn;
  if (state.mode !== 'running') return state;

  state.tick += 1;
  state.microStep = (state.microStep + 1) % 8;
  if (state.microStep !== 0) return state;
  state.cellTick += 1;

  const wantedDirection = state.pendingTurn ? rotate(state.player.direction, state.pendingTurn) : state.player.direction;
  state.pendingTurn = null;
  const playerTarget = add(state.player.head, DIRECTIONS[wantedDirection]);
  if (isWall(state.maze, playerTarget)) {
    state.blocked = true;
    state.lastEvent = 'wall';
  } else if (occupiedByEnemy(state.enemies, playerTarget)) {
    crashPlayer(state, 'collision');
    return state;
  } else {
    moveVehicle(state.player, wantedDirection);
    state.playerRoute.push(wantedDirection);
    state.blocked = false;
    state.lastEvent = 'moved';
  }

  moveEnemies(state);
  if (state.mode === 'running' && occupiedByEnemy(state.enemies, state.player.head, true)) {
    crashPlayer(state, 'collision');
  } else if (state.enemies.length > 0 && state.enemies.every((enemy) => enemy.crashed)) {
    state.mode = 'won';
    state.lastEvent = 'zone-won';
  }
  return state;
}

function moveEnemies(state) {
  for (const enemy of state.enemies) {
    if (enemy.crashed) continue;
    const action = routeAction(state.playerRoute, enemy.routeCursor);
    enemy.routeCursor += 1;
    if (action === 'stop') continue;
    const target = add(enemy.head, DIRECTIONS[action]);
    const collision = isWall(state.maze, target)
      || sameCell(target, state.player.head)
      || sameCell(target, state.player.tail)
      || state.enemies.some((other) => other.id !== enemy.id && occupies(other, target));
    if (collision) {
      enemy.crashed = true;
      enemy.direction = action;
      state.lastEvent = 'enemy-crashed';
      continue;
    }
    moveVehicle(enemy, action);
  }
}

export function routeAction(playerRoute, cursor) {
  if (cursor < PRELUDE_LENGTH) return 'stop';
  const afterWait = cursor - PRELUDE_LENGTH;
  if (afterWait < EXIT_RUN.length) return EXIT_RUN[afterWait];
  return playerRoute[afterWait - EXIT_RUN.length] ?? 'stop';
}

function crashPlayer(state, event) {
  state.lives = Math.max(0, state.lives - 1);
  state.mode = state.lives === 0 ? 'game-over' : 'crashed';
  state.lastEvent = event;
}

function rotate(direction, turn) {
  const index = DIRECTION_ORDER.indexOf(direction);
  const delta = turn === 'left' ? -1 : 1;
  return DIRECTION_ORDER[(index + delta + DIRECTION_ORDER.length) % DIRECTION_ORDER.length];
}

function moveVehicle(entity, direction) {
  entity.tail = { ...entity.head };
  entity.head = add(entity.head, DIRECTIONS[direction]);
  entity.direction = direction;
}

function add(position, vector) {
  return { x: position.x + vector.x, y: position.y + vector.y };
}

function isWall(maze, position) {
  return position.y < 0 || position.y >= maze.height || position.x < 0 || position.x >= maze.width || maze.rows[position.y][position.x] === '#';
}

function occupies(entity, position) {
  return sameCell(entity.head, position) || sameCell(entity.tail, position);
}

function occupiedByEnemy(enemies, position, includeCrashed = true) {
  return enemies.some((enemy) => (includeCrashed || !enemy.crashed) && occupies(enemy, position));
}

function sameCell(left, right) {
  return left.x === right.x && left.y === right.y;
}

function clone(value) {
  return structuredClone(value);
}

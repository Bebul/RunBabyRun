export const COLORS = {
  background: '#0000aa',
  empty: '#0000aa',
  white: '#ffffff',
  yellow: '#ffff55',
  cyan: '#55ffff',
  red: '#ff5555',
  wreck: '#aaaaaa',
};

export function spriteById(data, id) {
  return data.sprites.find((sprite) => sprite.id === id);
}

export function mazeById(data, id) {
  return data.mazes.find((maze) => maze.id === id);
}

export function drawSprite(context, data, spriteId, x, y, transform = 'none') {
  const sprite = spriteById(data, spriteId);
  if (!sprite) return;
  const { atlas } = sprite;
  context.save();
  context.translate(x, y);
  if (transform === 'up') {
    context.translate(0, sprite.height);
    context.scale(1, -1);
  } else if (transform === 'right') {
    context.translate(sprite.height, 0);
    context.rotate(Math.PI / 2);
  } else if (transform === 'left') {
    context.translate(0, sprite.width);
    context.rotate(-Math.PI / 2);
  }
  context.drawImage(data.atlas, atlas.x, atlas.y, atlas.width, atlas.height, 0, 0, sprite.width, sprite.height);
  context.restore();
}

export function drawGame(context, data, state) {
  drawMaze(context, data, state.maze, state.zone.wallSpriteId);
  for (const enemy of state.enemies) drawVehicleSprite(context, data, enemy, enemy.spriteId, state.microStep, enemy.crashed);
  drawVehicleSprite(context, data, state.player, state.zone.playerSpriteId, state.microStep, false);
  drawHud(context, data, state);

  if (state.mode !== 'running') drawOverlay(context, state);
}

const HUD_SPRITES = {
  lives: 'sprite-12-numlives',
  emptyLives: 'sprite-16-nozivot',
  life: 'sprite-17-zivutek',
  zone: 'sprite-11-richzon',
};

const DIGITS = {
  0: [0x3c, 0x66, 0x6e, 0x76, 0x66, 0x66, 0x3c, 0x00],
  1: [0x18, 0x38, 0x18, 0x18, 0x18, 0x18, 0x7e, 0x00],
  2: [0x3c, 0x66, 0x06, 0x0c, 0x30, 0x60, 0x7e, 0x00],
  3: [0x3c, 0x66, 0x06, 0x1c, 0x06, 0x66, 0x3c, 0x00],
  4: [0x0c, 0x1c, 0x3c, 0x6c, 0x7e, 0x0c, 0x0c, 0x00],
  5: [0x7e, 0x60, 0x7c, 0x06, 0x06, 0x66, 0x3c, 0x00],
  6: [0x1c, 0x30, 0x60, 0x7c, 0x66, 0x66, 0x3c, 0x00],
  7: [0x7e, 0x66, 0x06, 0x0c, 0x18, 0x18, 0x18, 0x00],
  8: [0x3c, 0x66, 0x66, 0x3c, 0x66, 0x66, 0x3c, 0x00],
  9: [0x3c, 0x66, 0x66, 0x3e, 0x06, 0x0c, 0x38, 0x00],
};

export function drawHud(context, data, state) {
  // Original mode 13h framebuffer offsets from ATEST.ASM converted to x/y.
  drawSprite(context, data, HUD_SPRITES.lives, 2, 1);
  drawSprite(context, data, HUD_SPRITES.emptyLives, 27, 22);
  for (let index = 0; index < state.lives; index += 1) {
    drawSprite(context, data, HUD_SPRITES.life, 27 + index * 4, 22);
  }
  drawSprite(context, data, HUD_SPRITES.zone, 265, 1);
  drawBitmapNumber(context, state.zoneNumber, 294, 15);
}

function drawBitmapNumber(context, value, x, y) {
  context.fillStyle = COLORS.white;
  const text = String(value).padStart(3, '0').slice(-3);
  for (const [characterIndex, character] of [...text].entries()) {
    DIGITS[character].forEach((row, rowIndex) => {
      for (let bit = 0; bit < 8; bit += 1) {
        if (row & (0x80 >> bit)) context.fillRect(x + characterIndex * 8 + bit, y + rowIndex, 1, 1);
      }
    });
  }
}

function drawVehicleSprite(context, data, entity, spriteId, microStep, wreck) {
  const horizontal = entity.direction === 'left' || entity.direction === 'right';
  let x = Math.min(entity.head.x, entity.tail.x) * 8;
  let y = Math.min(entity.head.y, entity.tail.y) * 8;
  if (!wreck && microStep && !entity.crashed) {
    const direction = entity.direction;
    if (direction === 'left') x -= microStep;
    if (direction === 'right') x += microStep;
    if (direction === 'up') y -= microStep;
    if (direction === 'down') y += microStep;
  }
  if (wreck) {
    context.fillStyle = COLORS.wreck;
    context.fillRect(x + 1, y + 1, horizontal ? 14 : 6, horizontal ? 6 : 14);
    context.fillStyle = '#555555';
    context.fillRect(x + 4, y + 3, horizontal ? 8 : 2, horizontal ? 2 : 8);
  } else {
    drawSprite(context, data, spriteId, x, y, entity.direction);
  }
}

function drawOverlay(context, state) {
  context.fillStyle = '#000000cc';
  context.fillRect(54, 70, 212, 60);
  context.strokeStyle = COLORS.cyan;
  context.strokeRect(54.5, 70.5, 211, 59);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = 'bold 10px monospace';
  context.fillStyle = state.mode === 'crashed' || state.mode === 'game-over' ? COLORS.red : COLORS.yellow;
  const title = { ready: `ZÓNA ${state.zoneNumber}`, crashed: 'HAVÁRIE', won: 'ZÓNA HOTOVA', 'game-over': 'KONEC HRY', 'campaign-complete': 'VÍTĚZSTVÍ!' }[state.mode] ?? state.mode;
  context.fillText(title, 160, 91);
  context.font = '8px monospace';
  context.fillStyle = COLORS.white;
  const hint = state.mode === 'ready' ? 'S NEBO ENTER PRO START' : state.mode === 'crashed' ? 'PŘIPRAVUJI NOVÝ POKUS' : '';
  context.fillText(hint, 160, 111);
  context.textAlign = 'start';
}

export function drawMaze(context, data, maze, wallSpriteId) {
  context.imageSmoothingEnabled = false;
  context.fillStyle = COLORS.background;
  context.fillRect(0, 0, 320, 200);
  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      if (maze.rows[y][x] === '#') drawSprite(context, data, wallSpriteId, x * 8, y * 8);
    }
  }
}

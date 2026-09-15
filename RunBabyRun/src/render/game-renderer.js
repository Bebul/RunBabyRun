export const COLORS = {
  // The original mode 13h screen clears unused track cells to palette index 0.
  background: '#000000',
  empty: '#000000',
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
  for (const enemy of state.enemies) {
    drawVehicleSprite(context, data, enemy, enemy.spriteId, enemy.crashed);
  }
  drawVehicleSprite(context, data, state.player, state.zone.playerSpriteId, false);
  drawHud(context, data, state);

  if (state.mode !== 'running' && state.mode !== 'ready') drawOverlay(context, state);
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

function drawVehicleSprite(context, data, entity, spriteId, wreck) {
  const displayDirection = entity.displayDirection ?? entity.direction;
  const horizontal = displayDirection === 'left' || displayDirection === 'right';
  // Only the simulation knows whether this microtick moves, turns or waits.
  // Never extrapolate from microStep: that draws stopped cars inside walls.
  const x = entity.renderPosition?.x ?? Math.min(entity.head.x, entity.tail.x) * 8;
  const y = entity.renderPosition?.y ?? Math.min(entity.head.y, entity.tail.y) * 8;
  if (wreck) {
    context.fillStyle = COLORS.wreck;
    context.fillRect(x + 1, y + 1, horizontal ? 14 : 6, horizontal ? 6 : 14);
    context.fillStyle = '#555555';
    context.fillRect(x + 4, y + 3, horizontal ? 8 : 2, horizontal ? 2 : 8);
  } else {
    drawSprite(context, data, spriteId, x, y, displayDirection);
  }
}

const PIXEL_GLYPHS = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01110'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  6: ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  ' ': ['000', '000', '000', '000', '000', '000', '000'],
};

function pixelTextWidth(text, scale = 1) {
  return [...text].reduce((width, character) => width + ((PIXEL_GLYPHS[character] ?? PIXEL_GLYPHS[' '])[0].length + 1) * scale, -scale);
}

export function drawPixelText(context, text, centerX, y, scale = 1) {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let x = Math.round(centerX - pixelTextWidth(normalized, scale) / 2);
  for (const character of normalized) {
    const glyph = PIXEL_GLYPHS[character] ?? PIXEL_GLYPHS[' '];
    glyph.forEach((row, rowIndex) => {
      for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
        if (row[columnIndex] === '1') context.fillRect(x + columnIndex * scale, y + rowIndex * scale, scale, scale);
      }
    });
    x += (glyph[0].length + 1) * scale;
  }
}

function drawOverlay(context, state) {
  context.fillStyle = '#000000cc';
  context.fillRect(54, 70, 212, 60);
  context.strokeStyle = COLORS.cyan;
  context.strokeRect(54.5, 70.5, 211, 59);
  context.fillStyle = state.mode === 'crashed' || state.mode === 'game-over' ? COLORS.red : COLORS.yellow;
  const title = { ready: `ZÓNA ${state.zoneNumber}`, crashed: 'HAVÁRIE', won: 'ZÓNA HOTOVA', 'game-over': 'KONEC HRY', 'campaign-complete': 'VÍTĚZSTVÍ!' }[state.mode] ?? state.mode;
  drawPixelText(context, title, 160, 82);
  context.fillStyle = COLORS.white;
  const hint = state.mode === 'ready' ? 'S NEBO ENTER PRO START' : state.mode === 'crashed' ? (state.practice ? 'PŘIPRAVUJI NOVÝ POKUS' : 'PŘIPRAVUJI DALŠÍ ZÓNU') : '';
  drawPixelText(context, hint, 160, 107);
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

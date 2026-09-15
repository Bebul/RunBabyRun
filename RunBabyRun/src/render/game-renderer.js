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

  context.fillStyle = '#000000bb';
  context.fillRect(0, 0, 320, 15);
  context.font = 'bold 8px monospace';
  context.textBaseline = 'top';
  context.fillStyle = COLORS.white;
  context.fillText(`ZÓNA ${String(state.zoneNumber).padStart(3, '0')}`, 6, 4);
  context.fillStyle = COLORS.yellow;
  context.fillText(`ŽIVOTY ${'▮'.repeat(state.lives)}`, 214, 4);

  if (state.mode !== 'running') drawOverlay(context, state);
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
  const title = { ready: `ZÓNA ${state.zoneNumber}`, crashed: 'HAVÁRIE', won: 'ZÓNA HOTOVA', 'game-over': 'KONEC HRY' }[state.mode] ?? state.mode;
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

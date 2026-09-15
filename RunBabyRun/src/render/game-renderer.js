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
    context.translate(0, sprite.width);
    context.rotate(-Math.PI / 2);
  } else if (transform === 'down') {
    context.translate(sprite.height, 0);
    context.rotate(Math.PI / 2);
  } else if (transform === 'left') {
    context.translate(sprite.width, 0);
    context.scale(-1, 1);
  }
  context.drawImage(data.atlas, atlas.x, atlas.y, atlas.width, atlas.height, 0, 0, sprite.width, sprite.height);
  context.restore();
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

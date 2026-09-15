export const SCREEN_WIDTH = 320;
export const SCREEN_HEIGHT = 200;

export function createPixelCanvas(container) {
  const canvas = document.createElement('canvas');
  canvas.width = SCREEN_WIDTH;
  canvas.height = SCREEN_HEIGHT;
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Herní plocha Run Baby Run');
  container.replaceChildren(canvas);

  const context = canvas.getContext('2d', { alpha: false });
  context.imageSmoothingEnabled = false;
  return { canvas, context };
}

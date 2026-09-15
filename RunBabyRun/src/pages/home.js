import { createPixelCanvas } from '../render/pixel-canvas.js';

export function renderHome(app) {
  app.innerHTML = `
    <section class="landing">
      <div class="intro">
        <p class="eyebrow">Browserový port hry H_ESC_3</p>
        <h1>Trať je připravená.</h1>
        <p>Původní bludiště a formulky jsou převedené beze ztráty. Prohlédněte si je v galerii nebo pokračujte do diagnostiky.</p>
        <div class="actions"><a class="button primary" href="#/gallery">Otevřít galerii</a><a class="button" href="#/play">Hrát</a></div>
        <dl class="status-list">
          <div><dt>Bludiště</dt><dd class="ok">42 / 42</dd></div>
          <div><dt>Grafika</dt><dd class="ok">46 / 46</dd></div>
          <div><dt>Hudba</dt><dd>mimo tuto verzi</dd></div>
        </dl>
      </div>
      <div class="screen-shell" id="screen-shell" aria-label="Náhled herní obrazovky"></div>
    </section>`;
  const { context } = createPixelCanvas(app.querySelector('#screen-shell'));
  context.fillStyle = '#0000aa';
  context.fillRect(0, 0, 320, 200);
  context.fillStyle = '#ffff55';
  context.font = 'bold 16px monospace';
  context.textAlign = 'center';
  context.fillText('RUN BABY RUN', 160, 88);
  context.fillStyle = '#ffffff';
  context.font = '8px monospace';
  context.fillText('42 ZÓN PŘIPRAVENO', 160, 108);
}

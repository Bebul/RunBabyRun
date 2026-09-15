import './style.css';
import { createPixelCanvas } from './render/pixel-canvas.js';

const app = document.querySelector('#app');

app.innerHTML = `
  <header class="site-header">
    <a class="brand" href="#/">RUN BABY RUN</a>
    <nav aria-label="Hlavní navigace">
      <a href="#/play">Hrát</a>
      <a href="#/gallery">Galerie</a>
      <a href="#/diagnostics">Diagnostika</a>
    </nav>
  </header>
  <section class="landing">
    <div class="intro">
      <p class="eyebrow">Browserový port hry H_ESC_3</p>
      <h1>Startovní čára je připravená.</h1>
      <p>Canvas běží v původním rozlišení 320 × 200. Převod dat, galerie a samotná hra přibudou v dalších kontrolovatelných etapách.</p>
      <dl class="status-list">
        <div><dt>Canvas</dt><dd class="ok">připraven</dd></div>
        <div><dt>Zdrojová data</dt><dd>čekají na převod</dd></div>
        <div><dt>Hudba</dt><dd>mimo tuto verzi</dd></div>
      </dl>
    </div>
    <div class="screen-shell" id="screen-shell" aria-label="Náhled herní obrazovky"></div>
  </section>
`;

const { context } = createPixelCanvas(document.querySelector('#screen-shell'));
context.fillStyle = '#0000aa';
context.fillRect(0, 0, 320, 200);
context.fillStyle = '#ffff55';
context.font = 'bold 16px monospace';
context.textAlign = 'center';
context.fillText('RUN BABY RUN', 160, 88);
context.fillStyle = '#ffffff';
context.font = '8px monospace';
context.fillText('ETAPA 1 / CANVAS ONLINE', 160, 108);

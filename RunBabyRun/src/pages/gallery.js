import { loadGameData } from '../data/load-game-data.js';
import { drawMaze, mazeById, spriteById } from '../render/game-renderer.js';

export async function renderGallery(app) {
  app.innerHTML = '<section class="loading">Načítám původní tratě…</section>';
  const data = await loadGameData();
  app.innerHTML = `
    <section class="page gallery-page">
      <p class="eyebrow">Kontrolní výstup / etapa 3</p>
      <h1>Galerie 42 bludišť</h1>
      <p class="lede">Každý náhled používá skutečná data mapy. Vybraný detail je vykreslen konkrétním vzorem zdi přiřazeným dané zóně.</p>
      <div class="gallery-layout">
        <div class="maze-grid" data-testid="maze-grid"></div>
        <aside class="detail-panel">
          <div class="screen-shell detail-screen" id="maze-detail"></div>
          <div id="zone-meta"></div>
        </aside>
      </div>
      <section class="atlas-section">
        <h2>Atlas původní grafiky</h2>
        <div class="atlas-wrap"><img src="${import.meta.env.BASE_URL}generated/atlas.png" alt="Atlas 46 původních obrázků" /></div>
        <div class="sprite-list" id="sprite-list"></div>
      </section>
    </section>`;

  const grid = app.querySelector('.maze-grid');
  for (const zone of data.zones) {
    const maze = mazeById(data, zone.mazeId);
    const button = document.createElement('button');
    button.className = 'maze-card';
    button.dataset.zone = zone.number;
    button.innerHTML = `<canvas width="320" height="200" aria-label="Náhled zóny ${zone.number}"></canvas><span>ZÓNA ${String(zone.number).padStart(2, '0')}</span>`;
    drawMaze(button.querySelector('canvas').getContext('2d'), data, maze, zone.wallSpriteId);
    button.addEventListener('click', () => selectZone(zone));
    grid.append(button);
  }

  const spriteList = app.querySelector('#sprite-list');
  data.sprites.forEach((sprite, index) => {
    const item = document.createElement('div');
    item.className = 'sprite-item';
    item.innerHTML = `<span>${String(index + 1).padStart(2, '0')}</span><strong>${sprite.source}</strong><small>${sprite.width}×${sprite.height}</small>`;
    spriteList.append(item);
  });

  function selectZone(zone) {
    app.querySelectorAll('.maze-card').forEach((card) => card.classList.toggle('selected', Number(card.dataset.zone) === zone.number));
    const maze = mazeById(data, zone.mazeId);
    const detail = app.querySelector('#maze-detail');
    let canvas = detail.querySelector('canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 200;
      detail.append(canvas);
    }
    drawMaze(canvas.getContext('2d'), data, maze, zone.wallSpriteId);
    const wall = spriteById(data, zone.wallSpriteId);
    app.querySelector('#zone-meta').innerHTML = `
      <h2>Zóna ${zone.number}</h2>
      <dl class="metadata">
        <div><dt>Bludiště</dt><dd>${maze.source}</dd></div>
        <div><dt>Zeď</dt><dd>${wall.source}</dd></div>
        <div><dt>Soupeři</dt><dd>${zone.enemyCount}</dd></div>
        <div><dt>Rychlost</dt><dd>${zone.speedTicks} ticků</dd></div>
        <div><dt>Offsety</dt><dd>${zone.enemyTrackOffsets.join(', ')}</dd></div>
      </dl>`;
  }
  selectZone(data.zones[0]);
}

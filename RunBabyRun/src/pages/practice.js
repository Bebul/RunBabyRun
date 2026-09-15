import { loadGameData } from '../data/load-game-data.js';
import { drawMaze, mazeById } from '../render/game-renderer.js';

export async function renderPractice(app) {
  const data = await loadGameData();
  app.innerHTML = `
    <section class="page">
      <p class="eyebrow">Trénink bez ztráty skóre</p>
      <h1>Vyberte zónu</h1>
      <p class="lede">V tréninku máte vždy sedm životů a po dokončení se stejná trať připraví znovu.</p>
      <div class="practice-grid" data-testid="practice-grid"></div>
    </section>`;
  const grid = app.querySelector('.practice-grid');
  for (const zone of data.zones) {
    const link = document.createElement('a');
    link.href = `#/practice/${zone.number}`;
    link.dataset.practiceZone = zone.number;
    link.innerHTML = `<canvas width="320" height="200" aria-hidden="true"></canvas><strong>Zóna ${zone.number}</strong><small>${zone.enemyCount} soupeřů</small>`;
    drawMaze(link.querySelector('canvas').getContext('2d'), data, mazeById(data, zone.mazeId), zone.wallSpriteId);
    grid.append(link);
  }
}

import { loadScores } from '../game/storage.js';

export function renderScores(app) {
  const scores = loadScores();
  app.innerHTML = `
    <section class="page narrow-page">
      <p class="eyebrow">Uloženo v tomto prohlížeči</p>
      <h1>Nejlepší jezdci</h1>
      <ol class="score-table">${scores.map((entry) => `<li><span>${escapeHtml(entry.name)}</span><strong>${String(entry.score).padStart(3, '0')}</strong></li>`).join('')}</ol>
      <a class="button" href="#/">Zpět do menu</a>
    </section>`;
}

function escapeHtml(text) {
  const node = document.createElement('span');
  node.textContent = text;
  return node.innerHTML;
}

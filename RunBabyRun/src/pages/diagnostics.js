import { loadGameData } from '../data/load-game-data.js';
import { createGame, step } from '../game/engine.js';
import { drawMaze } from '../render/game-renderer.js';

export async function renderDiagnostics(app) {
  const data = await loadGameData();
  app.innerHTML = `
    <section class="page diagnostics-page">
      <p class="eyebrow">Kontrolní výstup / etapa 4</p>
      <h1>Diagnostika simulace</h1>
      <div class="diagnostic-controls">
        <label>Zóna <select id="diagnostic-zone">${data.zones.map((zone) => `<option>${zone.number}</option>`).join('')}</select></label>
        <button id="toggle-run">Spustit</button><button id="step-once">+ 1 mikrotick</button><button id="reset-game">Reset</button>
        <button data-turn="left">Zatočit vlevo</button><button data-turn="right">Zatočit vpravo</button>
      </div>
      <div class="diagnostic-layout">
        <div class="screen-shell"><canvas width="320" height="200" id="diagnostic-canvas"></canvas></div>
        <pre id="diagnostic-state"></pre>
      </div>
      <p class="legend"><span class="player-dot"></span> hráč <span class="enemy-dot"></span> soupeř <span class="wreck-dot"></span> vrak</p>
    </section>`;
  const canvas = app.querySelector('#diagnostic-canvas');
  const context = canvas.getContext('2d');
  let state = createGame(data);
  let running = false;
  let pendingInput = {};
  let timer;

  function reset() {
    state = createGame(data, { zoneNumber: Number(app.querySelector('#diagnostic-zone').value) });
    pendingInput = {};
    draw();
  }

  function tick(input = pendingInput) {
    if (state.mode === 'ready') input = { ...input, start: true };
    state = step(state, input);
    pendingInput = {};
    draw();
  }

  function draw() {
    drawMaze(context, data, state.maze, state.zone.wallSpriteId);
    drawVehicle(state.player, '#ffff55');
    state.enemies.forEach((enemy) => drawVehicle(enemy, enemy.crashed ? '#aaaaaa' : '#ff5555'));
    app.querySelector('#diagnostic-state').textContent = JSON.stringify({
      mode: state.mode,
      zone: state.zoneNumber,
      tick: state.tick,
      cellTick: state.cellTick,
      microStep: state.microStep,
      pendingTurn: state.pendingTurn,
      blocked: state.blocked,
      lastEvent: state.lastEvent,
      lives: state.lives,
      player: state.player,
      enemies: state.enemies.map(({ id, head, tail, direction, routeCursor, crashed }) => ({ id, head, tail, direction, routeCursor, crashed })),
      recordedRoute: state.playerRoute,
    }, null, 2);
  }

  function drawVehicle(entity, color) {
    context.fillStyle = color;
    for (const cell of [entity.head, entity.tail]) context.fillRect(cell.x * 8 + 1, cell.y * 8 + 1, 6, 6);
    context.strokeStyle = '#000';
    context.strokeRect(entity.head.x * 8 + 2, entity.head.y * 8 + 2, 3, 3);
  }

  app.querySelector('#toggle-run').addEventListener('click', (event) => {
    running = !running;
    event.currentTarget.textContent = running ? 'Pozastavit' : 'Spustit';
  });
  app.querySelector('#step-once').addEventListener('click', () => tick());
  app.querySelector('#reset-game').addEventListener('click', reset);
  app.querySelector('#diagnostic-zone').addEventListener('change', reset);
  app.querySelectorAll('[data-turn]').forEach((button) => button.addEventListener('click', () => { pendingInput.turn = button.dataset.turn; }));
  timer = window.setInterval(() => { if (running) tick(); }, 35);
  draw();
  return () => window.clearInterval(timer);
}

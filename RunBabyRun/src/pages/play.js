import { loadGameData } from '../data/load-game-data.js';
import { createGame, step } from '../game/engine.js';
import { drawGame } from '../render/game-renderer.js';

const PIT_HZ = 1193182 / 1300;
const SPEEDS = { slow: 30, normal: 18, fast: 7 };

export async function renderPlay(app, options = {}) {
  const data = await loadGameData();
  app.innerHTML = `
    <section class="page play-page">
      <div class="play-heading"><div><p class="eyebrow">Kampaň / 42 zón</p><h1>Na start!</h1></div><div class="speed-pills" aria-label="Rychlost hry"><button data-speed="slow">Pomalá</button><button data-speed="normal" class="active">Normální</button><button data-speed="fast">Rychlá</button></div></div>
      <div class="play-layout">
        <div class="screen-shell game-screen"><canvas width="320" height="200" id="game-canvas" data-mode="ready" tabindex="0" aria-label="Hra Run Baby Run"></canvas></div>
        <aside class="game-help">
          <h2>Ovládání</h2>
          <p><kbd>Z</kbd> / <kbd>A</kbd> / <kbd>←</kbd> zatočit vlevo</p>
          <p><kbd>X</kbd> / <kbd>D</kbd> / <kbd>→</kbd> zatočit vpravo</p>
          <p><kbd>S</kbd> / <kbd>Enter</kbd> start zóny</p>
          <p><kbd>R</kbd> / <kbd>Esc</kbd> návrat do menu</p>
          <p class="note">Volba rychlosti po vzoru originálu ovlivňuje prvních sedm zón.</p>
          <dl class="metadata" id="game-status"></dl>
        </aside>
      </div>
    </section>`;

  const canvas = app.querySelector('#game-canvas');
  const context = canvas.getContext('2d');
  let speed = options.speed ?? 'normal';
  let state = createGame(data, { zoneNumber: options.zoneNumber ?? 1, practice: options.practice ?? false });
  let pendingInput = {};
  let accumulator = 0;
  let previousTime = performance.now();
  let transitionAt = 0;
  let animationFrame;
  let disposed = false;

  function tick(now) {
    const elapsed = Math.min(100, now - previousTime);
    previousTime = now;
    if (!document.hidden && !transitionAt) {
      accumulator += elapsed;
      const interval = tickInterval(state);
      while (accumulator >= interval && state.mode === 'running') {
        state = step(state, pendingInput);
        pendingInput = {};
        accumulator -= interval;
      }
    }
    if ((state.mode === 'crashed' || state.mode === 'won') && !transitionAt) transitionAt = now + 850;
    if (transitionAt && now >= transitionAt) advanceAfterTransition();
    drawGame(context, data, state);
    updateStatus();
    if (!disposed) animationFrame = requestAnimationFrame(tick);
  }

  function tickInterval(current) {
    const ticks = current.zoneNumber <= 7 ? SPEEDS[speed] : current.zone.speedTicks;
    return ((ticks + 1) / PIT_HZ) * 1000;
  }

  function advanceAfterTransition() {
    transitionAt = 0;
    if (state.mode === 'crashed') {
      state = createGame(data, { zoneNumber: state.zoneNumber, lives: state.lives, practice: state.practice });
    } else if (state.mode === 'won') {
      if (state.practice) state = createGame(data, { zoneNumber: state.zoneNumber, lives: 7, practice: true });
      else if (state.zoneNumber < 42) state = createGame(data, { zoneNumber: state.zoneNumber + 1, lives: state.lives });
      else state = { ...state, mode: 'campaign-complete', lastEvent: 'campaign-complete' };
    }
  }

  function updateStatus() {
    canvas.dataset.mode = state.mode;
    canvas.dataset.zone = state.zoneNumber;
    app.querySelector('#game-status').innerHTML = `
      <div><dt>Stav</dt><dd>${state.mode}</dd></div>
      <div><dt>Zóna</dt><dd>${state.zoneNumber} / 42</dd></div>
      <div><dt>Životy</dt><dd>${state.lives}</dd></div>
      <div><dt>Soupeři</dt><dd>${state.enemies.filter((enemy) => !enemy.crashed).length}</dd></div>`;
  }

  function onKeydown(event) {
    const key = event.key.toLowerCase();
    if (['arrowleft', 'arrowright', ' ', 'enter'].includes(key)) event.preventDefault();
    if (['z', 'a', 'arrowleft'].includes(key)) pendingInput.turn = 'left';
    if (['x', 'd', 'arrowright'].includes(key)) pendingInput.turn = 'right';
    if (['s', 'enter'].includes(key) && state.mode === 'ready') state = step(state, { start: true });
    if (['r', 'escape'].includes(key)) location.hash = '/';
  }

  app.querySelectorAll('[data-speed]').forEach((button) => button.addEventListener('click', () => {
    speed = button.dataset.speed;
    app.querySelectorAll('[data-speed]').forEach((candidate) => candidate.classList.toggle('active', candidate === button));
  }));
  window.addEventListener('keydown', onKeydown);
  canvas.focus();
  drawGame(context, data, state);
  updateStatus();
  animationFrame = requestAnimationFrame(tick);
  return () => {
    disposed = true;
    cancelAnimationFrame(animationFrame);
    window.removeEventListener('keydown', onKeydown);
  };
}

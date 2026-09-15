import { loadGameData } from '../data/load-game-data.js';
import { createGame, step } from '../game/engine.js';
import { advanceSimulation } from '../game/simulation-clock.js';
import { drawGame } from '../render/game-renderer.js';
import { loadSettings, saveScore, saveSettings } from '../game/storage.js';

const PIT_HZ = 1193182 / 1300;
const SPEEDS = { slow: 30, normal: 18, fast: 7 };
const TURN_KEYS = { z: 'left', a: 'left', arrowleft: 'left', x: 'right', d: 'right', arrowright: 'right' };

export async function renderPlay(app, options = {}) {
  const data = await loadGameData();
  const settings = loadSettings();
  app.innerHTML = `
    <section class="page play-page">
      <div class="play-heading"><div><p class="eyebrow">${options.practice ? 'Trénink' : 'Kampaň / 42 zón'}</p><h1>${options.practice ? `Zóna ${options.zoneNumber}` : 'Na start!'}</h1></div><div class="speed-pills" aria-label="Rychlost hry"><button data-speed="slow">Pomalá</button><button data-speed="normal">Normální</button><button data-speed="fast">Rychlá</button></div></div>
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
      <section class="victory-panel" id="victory-panel" hidden><p class="eyebrow">Všech 42 zón dokončeno</p><h2>Vyhráli jste!</h2><p>Výsledek byl uložen. Můžete skončit, nebo pokračovat dalším kolem od první zóny.</p><button id="continue-campaign">Pokračovat</button> <a class="button" href="#/">Do menu</a></section>
      <section class="victory-panel game-over-panel" id="game-over-panel" hidden><p class="eyebrow">Jízda skončila</p><h2>Konec hry</h2><p>Výsledek je uložený v místní tabulce rekordů.</p><a class="button primary" href="#/play">Nová hra</a> <a class="button" href="#/scores">Rekordy</a> <a class="button" href="#/">Do menu</a></section>
    </section>`;

  const canvas = app.querySelector('#game-canvas');
  const context = canvas.getContext('2d');
  let speed = options.speed ?? settings.speed;
  let state = createGame(data, { zoneNumber: options.zoneNumber ?? 1, practice: options.practice ?? false });
  let completedZones = options.completedZones ?? 0;
  let scoreSaved = false;
  let pendingInput = {};
  const heldTurnKeys = new Set();
  const blockedTurnKeys = new Set();
  let accumulator = 0;
  let previousTime = performance.now();
  let transitionAt = 0;
  let animationFrame;
  let disposed = false;

  function tick(now) {
    const elapsed = Math.min(100, now - previousTime);
    previousTime = now;
    if (!document.hidden && !transitionAt) {
      const interval = tickInterval(state);
      const heldKey = [...heldTurnKeys].filter((key) => !blockedTurnKeys.has(key)).at(-1);
      ({ state, accumulator, pendingInput } = advanceSimulation(
        state,
        { accumulator, elapsed, interval, pendingInput, heldInput: heldKey ? { turn: TURN_KEYS[heldKey] } : {} },
        step,
      ));
    }
    if ((state.mode === 'crashed' || state.mode === 'won') && !transitionAt) transitionAt = now + 850;
    if (state.mode === 'game-over' && !scoreSaved && !state.practice) {
      persistScore();
      app.querySelector('#game-over-panel').hidden = false;
    }
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
    resetInput();
    if (state.mode === 'crashed' || state.mode === 'won') {
      if (state.practice) state = createGame(data, { zoneNumber: state.zoneNumber, lives: 7, practice: true });
      else {
        if (state.mode === 'won') completedZones += 1;
        if (state.zoneNumber < 42) state = createGame(data, { zoneNumber: state.zoneNumber + 1, lives: state.lives });
        else {
          state = { ...state, mode: 'campaign-complete', lastEvent: 'campaign-complete' };
          persistScore();
          app.querySelector('#victory-panel').hidden = false;
        }
      }
    }
  }

  function updateStatus() {
    canvas.dataset.mode = state.mode;
    canvas.dataset.zone = state.zoneNumber;
    app.querySelector('#game-status').innerHTML = `
      <div><dt>Stav</dt><dd>${state.mode}</dd></div>
      <div><dt>Zóna</dt><dd>${state.zoneNumber} / 42</dd></div>
      <div><dt>Životy</dt><dd>${state.lives}</dd></div>
      <div><dt>Soupeři</dt><dd>${state.enemies.filter((enemy) => !enemy.crashed).length}</dd></div>
      <div><dt>Skóre</dt><dd>${completedZones}</dd></div>`;
  }

  function persistScore() {
    saveScore({ name: settings.name, score: Math.max(completedZones, state.zoneNumber) });
    scoreSaved = true;
  }

  function onKeydown(event) {
    const key = event.key.toLowerCase();
    if (['arrowleft', 'arrowright', ' ', 'enter'].includes(key)) event.preventDefault();
    const turn = TURN_KEYS[key];
    if (turn && !event.repeat) {
      heldTurnKeys.add(key);
      if (state.mode !== 'running') blockedTurnKeys.add(key);
      else if (!blockedTurnKeys.has(key)) pendingInput.turn = turn;
    }
    if (['s', 'enter'].includes(key) && state.mode === 'ready') {
      resetInput();
      previousTime = performance.now();
      state = step(state, { start: true });
    }
    if (['r', 'escape'].includes(key)) location.hash = '/';
  }

  function resetInput() {
    pendingInput = {};
    accumulator = 0;
    heldTurnKeys.forEach((key) => blockedTurnKeys.add(key));
  }

  function onKeyup(event) {
    const key = event.key.toLowerCase();
    heldTurnKeys.delete(key);
    blockedTurnKeys.delete(key);
  }

  function onBlur() {
    resetInput();
    heldTurnKeys.clear();
    blockedTurnKeys.clear();
    state.pendingTurn = null;
  }

  function onVisibilityChange() {
    if (document.hidden) onBlur();
  }

  app.querySelectorAll('[data-speed]').forEach((button) => button.addEventListener('click', () => {
    speed = button.dataset.speed;
    saveSettings({ ...settings, speed });
    app.querySelectorAll('[data-speed]').forEach((candidate) => candidate.classList.toggle('active', candidate === button));
  }));
  app.querySelector(`[data-speed="${speed}"]`)?.classList.add('active');
  app.querySelector('#continue-campaign').addEventListener('click', () => {
    scoreSaved = false;
    app.querySelector('#victory-panel').hidden = true;
    resetInput();
    state = createGame(data, { zoneNumber: 1, lives: state.lives });
  });
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('keyup', onKeyup);
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVisibilityChange);
  canvas.focus();
  drawGame(context, data, state);
  updateStatus();
  animationFrame = requestAnimationFrame(tick);
  return () => {
    disposed = true;
    cancelAnimationFrame(animationFrame);
    window.removeEventListener('keydown', onKeydown);
    window.removeEventListener('keyup', onKeyup);
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}

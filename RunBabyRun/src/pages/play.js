import { loadGameData } from '../data/load-game-data.js';
import { createGame, step } from '../game/engine.js';
import { advanceSimulation } from '../game/simulation-clock.js';
import { drawGame } from '../render/game-renderer.js';
import { loadSettings, saveScore, saveSettings } from '../game/storage.js';
import { BachMusic } from '../audio/bach-music.js';
import { CrashSoundPlayer } from '../audio/crash-sounds.js';

const PIT_HZ = 1193182 / 1300;
const SPEEDS = { slow: 30, normal: 18, fast: 7 };
const TURN_KEYS = { z: 'left', a: 'left', arrowleft: 'left', x: 'right', d: 'right', arrowright: 'right' };
const TURN_HOLD_DELAY_MS = 140;

export async function renderPlay(app, options = {}) {
  const data = await loadGameData();
  let settings = loadSettings();
  app.innerHTML = `
    <section class="page play-page">
      <div class="play-heading"><div><p class="eyebrow">${options.practice ? 'Trénink' : 'Kampaň / 42 zón'}</p><h1>${options.practice ? `Zóna ${options.zoneNumber}` : 'Na start!'}</h1></div><div class="speed-pills" aria-label="Rychlost hry"><button data-speed="slow">Pomalá</button><button data-speed="normal">Normální</button><button data-speed="fast">Rychlá</button></div></div>
      <div class="play-layout">
        <div class="screen-column">
          <div class="screen-shell game-screen"><canvas width="320" height="200" id="game-canvas" data-mode="ready" tabindex="0" aria-label="Hra Run Baby Run"></canvas></div>
          <div class="display-controls" aria-label="Nastavení obrazu a zvuku">
            <button class="display-toggle" id="toggle-music" type="button" aria-pressed="false"><span>♫ Hudba na pozadí</span><strong>Vypnuta</strong></button>
            <button class="display-toggle" id="toggle-sound-effects" type="button" aria-pressed="true"><span>✹ Zvuky hry</span><strong>Zapnuty</strong></button>
            <small><span id="current-music">Hudba je vypnutá</span> · <kbd>Alt</kbd>+<kbd>P</kbd></small>
          </div>
        </div>
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
      <div class="mobile-game-controls" aria-label="Dotykové ovládání hry">
        <button class="touch-turn touch-turn-left" type="button" data-touch-turn="left" aria-label="Zatočit vlevo"><span aria-hidden="true">&#8592;</span></button>
        <button class="touch-turn touch-turn-right" type="button" data-touch-turn="right" aria-label="Zatočit vpravo"><span aria-hidden="true">&#8594;</span></button>
        <button class="mobile-start" id="mobile-start" type="button">START</button>
        <button class="mobile-menu" id="mobile-menu" type="button" aria-label="Ukončit hru a vrátit se do menu">Menu</button>
      </div>
      <div class="portrait-prompt" role="status"><strong>Otočte telefon</strong><span>Hra se ovládá na šířku.</span></div>
      <section class="victory-panel" id="victory-panel" hidden><p class="eyebrow">Všech 42 zón dokončeno</p><h2>Vyhráli jste!</h2><p>Výsledek byl uložen. Můžete skončit, nebo pokračovat dalším kolem od první zóny.</p><button id="continue-campaign">Pokračovat</button> <a class="button" href="#/">Do menu</a></section>
      <section class="victory-panel game-over-panel" id="game-over-panel" hidden><p class="eyebrow">Jízda skončila</p><h2>Konec hry</h2><p>Výsledek je uložený v místní tabulce rekordů.</p><a class="button primary" href="#/play">Nová hra</a> <a class="button" href="#/scores">Rekordy</a> <a class="button" href="#/">Do menu</a></section>
    </section>`;

  const canvas = app.querySelector('#game-canvas');
  const playPage = app.querySelector('.play-page');
  const context = canvas.getContext('2d');
  const mobileQuery = matchMedia('(any-pointer: coarse) and (max-width: 1366px) and (max-height: 1024px)');
  const music = new BachMusic(undefined, (track) => {
    const label = app.querySelector('#current-music');
    if (label) label.textContent = `J. S. Bach — ${track.title}`;
  });
  const crashSounds = new CrashSoundPlayer();
  let musicEnabled = settings.music;
  let soundEffectsEnabled = settings.soundEffects;
  crashSounds.setEnabled(soundEffectsEnabled);
  let speed = options.speed ?? settings.speed;
  let state = createGame(data, { zoneNumber: options.zoneNumber ?? 1, practice: options.practice ?? false });
  let completedZones = options.completedZones ?? 0;
  let scoreSaved = false;
  let pendingInput = {};
  const heldTurnKeys = new Map();
  const heldTouchTurns = new Map();
  const blockedTurnKeys = new Set();
  let accumulator = 0;
  let previousTime = performance.now();
  let transitionAt = 0;
  let animationFrame;
  let disposed = false;

  function updateMobileMode() {
    document.body.classList.toggle('mobile-game-active', mobileQuery.matches);
  }

  function tick(now) {
    const elapsed = Math.min(100, now - previousTime);
    previousTime = now;
    if (!document.hidden && !transitionAt) {
      const interval = tickInterval(state);
      const heldTurns = [
        ...[...heldTurnKeys].filter(([key]) => !blockedTurnKeys.has(key)).map(([key, startedAt]) => ({ turn: TURN_KEYS[key], startedAt })),
        ...heldTouchTurns.values(),
      ].filter(({ startedAt }) => now - startedAt >= TURN_HOLD_DELAY_MS).sort((a, b) => a.startedAt - b.startedAt);
      const repeatTurn = heldTurns.at(-1)?.turn;
      const previousState = state;
      ({ state, accumulator, pendingInput } = advanceSimulation(
        state,
        { accumulator, elapsed, interval, pendingInput, heldInput: repeatTurn ? { turn: repeatTurn } : {} },
        step,
      ));
      crashSounds.playTransition(previousState, state);
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
    playPage.dataset.mode = state.mode;
    const running = state.mode === 'running' && !transitionAt;
    app.querySelector('#mobile-start').hidden = state.mode !== 'ready';
    app.querySelectorAll('[data-touch-turn]').forEach((button) => { button.disabled = !running; });
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
    if (event.altKey && key === 'p') {
      event.preventDefault();
      toggleMusic();
      return;
    }
    if (musicEnabled) music.setEnabled(true).catch(() => {});
    if (['arrowleft', 'arrowright', ' ', 'enter'].includes(key)) event.preventDefault();
    const turn = TURN_KEYS[key];
    if (turn && !event.repeat) {
      heldTurnKeys.set(key, performance.now());
      if (state.mode !== 'running') blockedTurnKeys.add(key);
      else if (!blockedTurnKeys.has(key)) pendingInput.turn = turn;
    }
    if (['s', 'enter'].includes(key)) startGame();
    if (['r', 'escape'].includes(key)) location.hash = '/';
  }

  function resetInput() {
    pendingInput = {};
    accumulator = 0;
    heldTouchTurns.clear();
    playPage.dataset.touchHeld = '0';
    heldTurnKeys.forEach((_, key) => blockedTurnKeys.add(key));
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

  function requestMobileFullscreen() {
    if (!mobileQuery.matches) return;
    const lockLandscape = () => Promise.resolve(screen.orientation?.lock?.('landscape')).catch(() => {});
    if (document.fullscreenElement === playPage) {
      lockLandscape();
      return;
    }
    let fullscreenRequest;
    try {
      fullscreenRequest = playPage.requestFullscreen?.({ navigationUI: 'hide' });
    } catch {
      return;
    }
    Promise.resolve(fullscreenRequest).then(lockLandscape).catch(() => {});
  }

  function startGame() {
    if (state.mode !== 'ready') return;
    requestMobileFullscreen();
    resetInput();
    previousTime = performance.now();
    state = step(state, { start: true });
    if (musicEnabled) music.setEnabled(true).catch(() => {});
  }

  function onTouchTurnDown(event) {
    if (state.mode !== 'running' || transitionAt) return;
    event.preventDefault();
    const button = event.currentTarget;
    try { button.setPointerCapture?.(event.pointerId); } catch { /* Synthetic and interrupted pointers may not be capturable. */ }
    const turn = button.dataset.touchTurn;
    heldTouchTurns.set(event.pointerId, { turn, startedAt: performance.now() });
    playPage.dataset.touchHeld = String(heldTouchTurns.size);
    pendingInput.turn = turn;
  }

  function onTouchTurnUp(event) {
    heldTouchTurns.delete(event.pointerId);
    playPage.dataset.touchHeld = String(heldTouchTurns.size);
  }

  function onVisibilityChange() {
    if (document.hidden) onBlur();
  }

  function updateMusicButton() {
    const button = app.querySelector('#toggle-music');
    button.setAttribute('aria-pressed', String(musicEnabled));
    button.querySelector('strong').textContent = musicEnabled ? 'Zapnuta' : 'Vypnuta';
    if (!musicEnabled) app.querySelector('#current-music').textContent = 'Hudba je vypnutá';
  }

  function toggleMusic() {
    musicEnabled = !musicEnabled;
    settings = saveSettings({ ...settings, speed, music: musicEnabled });
    updateMusicButton();
    music.setEnabled(musicEnabled).catch(() => {});
  }

  function updateSoundEffectsButton() {
    const button = app.querySelector('#toggle-sound-effects');
    button.setAttribute('aria-pressed', String(soundEffectsEnabled));
    button.querySelector('strong').textContent = soundEffectsEnabled ? 'Zapnuty' : 'Vypnuty';
  }

  function toggleSoundEffects() {
    soundEffectsEnabled = !soundEffectsEnabled;
    settings = saveSettings({ ...settings, speed, soundEffects: soundEffectsEnabled });
    crashSounds.setEnabled(soundEffectsEnabled);
    updateSoundEffectsButton();
  }

  app.querySelectorAll('[data-speed]').forEach((button) => button.addEventListener('click', () => {
    speed = button.dataset.speed;
    settings = saveSettings({ ...settings, speed });
    app.querySelectorAll('[data-speed]').forEach((candidate) => candidate.classList.toggle('active', candidate === button));
  }));
  app.querySelector('#toggle-music').addEventListener('click', toggleMusic);
  app.querySelector('#toggle-sound-effects').addEventListener('click', toggleSoundEffects);
  app.querySelector('#mobile-start').addEventListener('click', startGame);
  app.querySelector('#mobile-menu').addEventListener('click', () => {
    if (document.fullscreenElement === playPage) document.exitFullscreen?.().catch(() => {});
    location.hash = '/';
  });
  app.querySelectorAll('[data-touch-turn]').forEach((button) => {
    button.addEventListener('pointerdown', onTouchTurnDown);
    button.addEventListener('pointerup', onTouchTurnUp);
    button.addEventListener('pointercancel', onTouchTurnUp);
    button.addEventListener('lostpointercapture', onTouchTurnUp);
  });
  mobileQuery.addEventListener?.('change', updateMobileMode);
  updateMobileMode();
  playPage.dataset.touchHeld = '0';
  updateMusicButton();
  updateSoundEffectsButton();
  if (musicEnabled) music.setEnabled(true).catch(() => {});
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
    mobileQuery.removeEventListener?.('change', updateMobileMode);
    document.body.classList.remove('mobile-game-active');
    if (document.fullscreenElement === playPage) document.exitFullscreen?.().catch(() => {});
    try { screen.orientation?.unlock?.(); } catch { /* Orientation locking is optional. */ }
    music.dispose();
    crashSounds.dispose();
  };
}

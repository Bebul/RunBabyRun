import { Peer } from 'peerjs';
import QRCode from 'qrcode';
import { createSession } from '../multiplayer/session.js';
import { loadGameData } from '../data/load-game-data.js';
import { createGame, step } from '../game/engine.js';
import { advanceSimulation } from '../game/simulation-clock.js';
import { drawGame } from '../render/game-renderer.js';
import { loadSettings } from '../game/storage.js';

export async function renderMultiplayer(app, room) {
  const data = await loadGameData();
  const host = !room, direction = host ? 'left' : 'right';
  const keys = host ? ['arrowleft', 'a', 'z'] : ['arrowright', 'd', 'x'];
  app.innerHTML = `<section class="page coop-page">
    <p class="eyebrow">Kooperativní kampaň / 42 zón / 2 hráči</p>
    <h1>Jedno auto. Dva řidiči.</h1>
    <p>Jste hráč ${host ? '1 — zatáčíte doleva' : '2 — zatáčíte doprava'}.</p>
    <p id="connection-status" role="status">Připojujeme se…</p>
    <section id="invitation" hidden><h2>Pozvěte hráče 2</h2>
      <canvas id="invite-qr" aria-label="QR kód pozvánky"></canvas>
      <label>Odkaz pro spoluhráče <input id="invite-url" readonly /></label>
      <button id="copy-invite">Kopírovat odkaz</button> <button id="share-invite">Poslat pozvánku</button>
      <p>QR kód naskenujte fotoaparátem telefonu. Tlačítko „Poslat pozvánku“ otevře na mobilu nabídku včetně WhatsAppu.</p>
    </section>
    <div class="play-layout"><div class="screen-column">
      <div class="screen-shell game-screen"><canvas id="coop-canvas" width="320" height="200" aria-label="Společná hra"></canvas></div>
      <p id="coop-status" role="status"></p>
      <div class="coop-indicators"><span id="left-indicator">Hráč 1 · ← · puštěno</span><span id="right-indicator">Hráč 2 · → · puštěno</span></div>
      <button id="coop-turn" class="coop-turn" disabled>${host ? '← Doleva' : 'Doprava →'}</button>
      <button id="coop-start" ${host ? 'disabled' : 'hidden'}>Spustit společně</button>
      <button id="coop-new">Nová dvojice</button>
    </div><aside class="game-help"><h2>Jak se hraje ve dvou</h2>
      <p>Společně ovládáte jednu formuli v původní kampani. Hráč 1 má pouze levou zatáčku (← / A / Z), hráč 2 pouze pravou (→ / D / X). Na telefonu držte velké tlačítko pod hrou.</p>
      <p>Auto jede samo. Zatáčky jsou relativní ke směru jízdy. Krátký stisk zatočí jednou, držení zatáčky opakuje. Rozsvícený ukazatel prozradí stisk spoluhráče. Při souběhu rozhoduje naposledy přijatý stisk.</p>
      <p>Soupeři kopírují vaši stopu. Naveďte je do vzájemných kolizí, dokud nezůstane jediný. Máte společných sedm životů; i po havárii postupujete do další zóny.</p>
      <p>Hráč 1 spustí společný odpočet, hráč 2 se připojí rovnou do hry. RTT měření sladí hodiny před startem. Hráč 1 spouští také každou další zónu.</p>
      <p>Hlas si zařiďte například hovorem přes WhatsApp. Hra mikrofon ani kameru nepoužívá. Při skrytí hry se jízda pozastaví; po návratu znovu potvrďte start.</p>
      <p>Potřebujete internet a odkaz dostupný oběma hráčům. Při blokování WebRTC může být nutná jiná síť. Kooperativní výsledky se nemíchají do sólo rekordů.</p>
    </aside></div></section>`;
  const $ = (selector) => app.querySelector(selector);
  const canvas = $('#coop-canvas'), context = canvas.getContext('2d');
  let state = createGame(data), ready = false, remoteReady = false, active = false, disposed = false;
  let offset = 0, rtt = 0, startAt = 0, transitionAt = 0, accumulator = 0, pendingInput = {};
  let previous = performance.now(), lastSnapshot = 0, frame, completed = 0;
  const held = { left: 0, right: 0 }, sources = new Set();
  const speedTicks = { slow: 30, normal: 18, fast: 7 }[loadSettings().speed] ?? 18;
  const status = (text) => { $('#connection-status').textContent = text; };
  function indicators() {
    for (const [index, turn] of ['left', 'right'].entries()) {
      const element = $(`#${turn}-indicator`);
      element.classList.toggle('pressed', Boolean(held[turn]));
      element.textContent = `Hráč ${index + 1} · ${turn === 'left' ? '←' : '→'} · ${held[turn] ? 'stisknuto' : 'puštěno'}`;
    }
  }
  function input(turn, down) {
    if (Boolean(held[turn]) === down) return;
    held[turn] = down ? performance.now() : 0;
    if (down && active && state.mode === 'running') pendingInput.turn = turn;
    indicators();
  }
  function localInput(source, down) {
    if (down && (!ready || !active)) return;
    if (down) sources.add(source); else sources.delete(source);
    const pressed = sources.size > 0;
    if (Boolean(held[direction]) === pressed) return;
    input(direction, pressed);
    session.send({ type: 'input', down: pressed });
  }
  function clearInput() {
    sources.clear(); held.left = held.right = 0; pendingInput = {}; accumulator = 0;
    state.pendingTurn = null; indicators();
  }
  function pause(broadcast = true) {
    active = false; startAt = 0; remoteReady = false; clearInput();
    if (ready) status(`Spojeno · RTT ${Math.round(rtt)} ms · Pozastaveno, hráč 1 může spustit společný start.`);
    $('#coop-start').disabled = !ready || !host;
    if (broadcast) session.send({ type: 'pause' });
  }
  const session = createSession({ Peer, room, peerOptions: JSON.parse(import.meta.env.VITE_PEER_OPTIONS || '{}'), onStatus: status,
    onInvite: async (id) => {
      const url = new URL(location.href); url.hash = `/multiplayer?room=${encodeURIComponent(id)}`;
      $('#invitation').hidden = false; $('#invite-url').value = url.href;
      try { await QRCode.toCanvas($('#invite-qr'), url.href, { width: 220, margin: 2 }); }
      catch { if (!disposed) status('QR se nepodařilo vytvořit. Použijte odkaz.'); }
    },
    onReady: (sample) => {
      ready = true; offset = sample.offset; rtt = sample.rtt;
      status(`Spojeno · RTT ${Math.round(rtt)} ms. ${host ? 'Hráč 1 může spustit společný start.' : 'Čekáme na start hráče 1.'}`);
      $('#coop-start').disabled = !host;
    },
    onClose: () => { ready = false; pause(false); },
    onMessage: (message) => {
      if (message.type === 'input' && typeof message.down === 'boolean') {
        input(host ? 'right' : 'left', message.down && active);
      } else if (!host && message.type === 'start' && Number.isFinite(message.at)) {
        if (document.hidden) { pause(); return; }
        clearInput(); startAt = message.at - offset; $('#coop-start').disabled = true;
        session.send({ type: 'start-ack', at: message.at });
      } else if (host && message.type === 'start-ack' && message.at === startAt) {
        remoteReady = true;
      } else if (message.type === 'pause') pause(false);
      else if (!host && message.type === 'snapshot' && message.state?.version === 2) {
        state = message.state; completed = message.completed;
        if (!startAt) active = message.active === true;
        held.left = message.left ? held.left || performance.now() : 0;
        indicators();
      }
    },
  });
  $('#coop-start').onclick = () => {
    if (!ready || document.hidden) return;
    if (!host) return;
    if (state.mode === 'campaign-complete' || state.mode === 'game-over') { state = createGame(data); completed = 0; }
    clearInput(); startAt = performance.now() + Math.max(3000, rtt * 4); remoteReady = false;
    status(`Spojeno · RTT ${Math.round(rtt)} ms · Společný odpočet.`);
    session.send({ type: 'start', at: startAt }); $('#coop-start').disabled = true;
  };
  $('#copy-invite').onclick = async () => {
    try { await navigator.clipboard.writeText($('#invite-url').value); status('Odkaz zkopírován.'); }
    catch { $('#invite-url').select(); status('Označený odkaz zkopírujte ručně.'); }
  };
  $('#coop-new').onclick = () => {
    if (location.hash === '#/multiplayer') location.reload();
    else location.hash = '/multiplayer';
  };
  $('#share-invite').hidden = !navigator.share;
  $('#share-invite').onclick = async () => {
    try { await navigator.share({ title: 'Run Baby Run ve dvou', url: $('#invite-url').value }); }
    catch { /* The user can cancel the platform share sheet. */ }
  };
  const button = $('#coop-turn');
  button.onpointerdown = (event) => { event.preventDefault(); button.setPointerCapture(event.pointerId); localInput(`pointer-${event.pointerId}`, true); };
  button.onpointerup = button.onpointercancel = button.onlostpointercapture = (event) => localInput(`pointer-${event.pointerId}`, false);
  const keydown = (event) => {
    if (event.target instanceof HTMLInputElement) return;
    if (keys.includes(event.key.toLowerCase())) { event.preventDefault(); if (!event.repeat) localInput(event.key.toLowerCase(), true); }
  };
  const keyup = (event) => localInput(event.key.toLowerCase(), false);
  const blur = () => { sources.clear(); input(direction, false); session.send({ type: 'input', down: false }); };
  const visibility = () => { if (document.hidden && ready) pause(); };
  window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur);
  document.addEventListener('visibilitychange', visibility);
  function tick(now) {
    let elapsed = Math.min(100, now - previous); previous = now;
    if (startAt && now >= startAt) {
      if (host && !remoteReady) { pause(); status('Potvrzení startu nedorazilo. Zkuste start znovu.'); }
      else {
        startAt = 0; active = true; elapsed = 0;
        status(`Spojeno · RTT ${Math.round(rtt)} ms · Hrajeme společně.`);
        if (host && state.mode === 'ready') state = step(state, { start: true });
      }
    }
    if (host && active && !document.hidden) {
      const turn = ['left', 'right'].filter((key) => held[key] && now - held[key] >= 140).sort((a, b) => held[a] - held[b]).at(-1);
      const interval = ((state.zoneNumber <= 7 ? speedTicks : state.zone.speedTicks) + 1) / (1193182 / 1300) * 1000;
      ({ state, accumulator, pendingInput } = advanceSimulation(state, { accumulator, elapsed, interval, pendingInput, heldInput: turn ? { turn } : {} }, step));
      if (['crashed', 'won'].includes(state.mode)) {
        transitionAt ||= now + 850;
        if (now >= transitionAt) {
          if (state.mode === 'won') completed++;
          state = state.zoneNumber < 42 ? createGame(data, { zoneNumber: state.zoneNumber + 1, lives: state.lives }) : { ...state, mode: 'campaign-complete' };
          transitionAt = 0; pause();
        }
      } else if (state.mode === 'game-over') pause();
    }
    if (host && ready && now - lastSnapshot >= 33) {
      session.send({ type: 'snapshot', state, active, completed, left: Boolean(held.left) }); lastSnapshot = now;
    }
    button.disabled = !ready || !active || state.mode !== 'running';
    canvas.dataset.mode = state.mode; canvas.dataset.tick = state.tick;
    drawGame(context, data, state);
    $('#coop-status').textContent = startAt ? `Start za ${Math.max(1, Math.ceil((startAt - now) / 1000))}…` :
      `Zóna ${state.zoneNumber}/42 · Životy ${state.lives} · Dokončeno ${completed} · ${state.mode === 'campaign-complete' ? 'Vyhráli jste! Můžete začít znovu.' : state.mode === 'game-over' ? 'Konec hry. Můžete začít znovu.' : active ? 'Společná jízda' : 'Čekáme na společný start'}`;
    if (!disposed) frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);
  return () => {
    disposed = true; cancelAnimationFrame(frame); session.dispose();
    window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur);
    document.removeEventListener('visibilitychange', visibility);
  };
}

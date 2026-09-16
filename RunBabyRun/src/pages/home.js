import { createPixelCanvas } from '../render/pixel-canvas.js';
import { loadSettings, saveSettings } from '../game/storage.js';

export function renderHome(app) {
  let settings = loadSettings();
  app.innerHTML = `
    <section class="landing">
      <div class="intro">
        <p class="eyebrow">Browserový port hry H_ESC_3</p>
        <h1>Run Baby Run</h1>
        <p>Projeďte 42 původních zón, veďte soupeře do kolizí a chraňte svých sedm životů.</p>
        <form class="menu-settings" id="menu-settings">
          <label>Jméno hráče <input name="name" maxlength="12" autocomplete="nickname" /></label>
          <label>Rychlost prvních sedmi zón <select name="speed"><option value="slow">Pomalá</option><option value="normal">Normální</option><option value="fast">Rychlá</option></select></label>
        </form>
        <div class="menu-actions">
          <a class="button primary" href="#/play">Spustit kampaň</a>
          <a class="button" href="#/multiplayer">Kampaň ve dvou</a>
          <a class="button" href="#/practice">Trénink</a>
          <a class="button" href="#/scores">Rekordy</a>
          <a class="button" href="#/help">Jak se hraje</a>
          <a class="button" href="#/gallery">Galerie dat</a>
        </div>
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
  context.fillText('1  START HRY', 160, 108);
  context.fillText('2  REKORDY', 160, 122);
  context.fillText('3  RYCHLOST', 160, 136);
  context.fillText('4  TRÉNINK', 160, 150);
  const form = app.querySelector('#menu-settings');
  form.elements.name.value = settings.name;
  form.elements.speed.value = settings.speed;
  form.addEventListener('input', () => {
    settings = saveSettings({ ...settings, name: form.elements.name.value, speed: form.elements.speed.value });
  });
}

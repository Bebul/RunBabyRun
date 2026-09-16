import './style.css';
import { renderGallery } from './pages/gallery.js';
import { renderHome } from './pages/home.js';
import { renderDiagnostics } from './pages/diagnostics.js';
import { renderPlay } from './pages/play.js';
import { renderPractice } from './pages/practice.js';
import { renderScores } from './pages/scores.js';
import { renderHelp } from './pages/help.js';
import { renderMultiplayer } from './pages/multiplayer.js';

const app = document.querySelector('#app');

app.innerHTML = `
  <header class="site-header">
    <a class="brand" href="#/">RUN BABY RUN</a>
    <nav aria-label="Hlavní navigace">
      <a href="#/play">Hrát</a>
      <a href="#/multiplayer">Ve dvou</a>
      <a href="#/gallery">Galerie</a>
      <a href="#/diagnostics">Diagnostika</a>
    </nav>
  </header>
  <div id="route"></div>
`;

const route = app.querySelector('#route');
let disposeRoute;
let routeGeneration = 0;

async function renderRoute() {
  const generation = ++routeGeneration;
  disposeRoute?.();
  disposeRoute = undefined;
  const mount = document.createElement('div');
  route.replaceChildren(mount);
  let dispose;
  const path = location.hash.slice(1) || '/';
  try {
    if (path === '/gallery') await renderGallery(mount);
    else if (path === '/diagnostics') dispose = await renderDiagnostics(mount);
    else if (path === '/play') dispose = await renderPlay(mount);
    else if (path.split('?')[0] === '/multiplayer') dispose = await renderMultiplayer(mount, new URLSearchParams(path.split('?')[1]).get('room'));
    else if (path === '/practice') await renderPractice(mount);
    else if (/^\/practice\/\d+$/.test(path)) dispose = await renderPlay(mount, { practice: true, zoneNumber: Number(path.split('/').at(-1)) });
    else if (path === '/scores') renderScores(mount);
    else if (path === '/help') renderHelp(mount);
    else renderHome(mount);
    if (generation === routeGeneration) disposeRoute = dispose;
    else dispose?.();
  } catch (error) {
    mount.innerHTML = '<section class="error"><h1>Data se nepodařilo načíst</h1><pre></pre></section>';
    mount.querySelector('pre').textContent = error.message;
  }
}

window.addEventListener('hashchange', renderRoute);
renderRoute();

import './style.css';
import { renderGallery } from './pages/gallery.js';
import { renderHome } from './pages/home.js';
import { renderDiagnostics } from './pages/diagnostics.js';

const app = document.querySelector('#app');

app.innerHTML = `
  <header class="site-header">
    <a class="brand" href="#/">RUN BABY RUN</a>
    <nav aria-label="Hlavní navigace">
      <a href="#/play">Hrát</a>
      <a href="#/gallery">Galerie</a>
      <a href="#/diagnostics">Diagnostika</a>
    </nav>
  </header>
  <div id="route"></div>
`;

const route = app.querySelector('#route');
let disposeRoute;

async function renderRoute() {
  disposeRoute?.();
  disposeRoute = undefined;
  const path = location.hash.slice(1) || '/';
  try {
    if (path === '/gallery') await renderGallery(route);
    else if (path === '/diagnostics') disposeRoute = await renderDiagnostics(route);
    else if (path === '/play') renderPlaceholder(path);
    else renderHome(route);
  } catch (error) {
    route.innerHTML = `<section class="error"><h1>Data se nepodařilo načíst</h1><pre>${error.message}</pre></section>`;
  }
}

function renderPlaceholder() {
  route.innerHTML = `<section class="page"><p class="eyebrow">Následující etapa</p><h1>Hra</h1><p class="lede">Tento režim bude připojen k hotovému hernímu jádru.</p></section>`;
}

window.addEventListener('hashchange', renderRoute);
renderRoute();

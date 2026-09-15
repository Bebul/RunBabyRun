export function renderHelp(app) {
  app.innerHTML = `
    <section class="page narrow-page">
      <p class="eyebrow">Jak se hraje</p>
      <h1>Zůstaňte na trati. Nechte soupeře havarovat.</h1>
      <div class="prose">
        <p>Vaše formulka jede nepřetržitě a zabírá dvě políčka. U stěny se zastaví, takže můžete bezpečně vybrat nový směr. Náraz do jiné formulky nebo vraku stojí jeden život.</p>
        <p>Soupeři vyjíždějí postupně a kopírují zaznamenanou stopu hráče. Zóna končí ve chvíli, kdy jsou všechny soupeřovy formulky vraky.</p>
        <p><kbd>Z</kbd>, <kbd>A</kbd> nebo <kbd>←</kbd> zatáčí vlevo; <kbd>X</kbd>, <kbd>D</kbd> nebo <kbd>→</kbd> vpravo. Klávesa <kbd>S</kbd> nebo Enter odstartuje zónu. <kbd>R</kbd> nebo Escape vrací do menu.</p>
      </div>
      <a class="button primary" href="#/play">Spustit hru</a> <a class="button" href="#/">Zpět</a>
    </section>`;
}

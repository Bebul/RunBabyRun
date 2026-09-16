# Run Baby Run

Browserový port původní DOS hry.

**Hrát:** https://bebul.github.io/RunBabyRun/

Webová aplikace a příkazy pro vývoj jsou v [RunBabyRun](RunBabyRun/README.md).
Repository obsahuje pouze webový port včetně převedených herních dat.
Původní DOS zdroje a data `H_ESC_3` se nezveřejňují. Volitelná lokální extrakce
a test proti původnímu assembleru vyžadují tuto složku vedle `RunBabyRun`;
build a ostatní testy ji nepotřebují.

## Automatický build a publikování

GitHub Actions po každém pushi a pull requestu nainstaluje závislosti z lockfile,
spustí jednotkové testy, produkční build, prohlížečové testy, kooperativní testy
a kontrolu buildu pod cestou `/RunBabyRun/`.

Úspěšný build větve `master` se automaticky publikuje na GitHub Pages.
V Settings → Pages musí být jako Source vybráno **GitHub Actions**.
Workflow lze spustit také ručně v záložce Actions.

Pro lokální ověření (Node.js 22):

```sh
cd RunBabyRun
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:coop
npm run test:pages
```

`dist` a `node_modules` se necommitují. Publikuje se pouze obsah `RunBabyRun/dist`.

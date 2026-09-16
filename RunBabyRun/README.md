# Run Baby Run

Browserový port DOS hry `H_ESC_3`. Hra používá Canvas v interním rozlišení 320×200 a data deterministicky převedená z původních souborů.

## Příkazy

- `npm run extract` – znovu vytvoří webová data z `../H_ESC_3`.
- `npm run dev` – spustí vývojový server.
- `npm run build` – vytvoří produkční build pouze z již vygenerovaných dat.
- `npm test` – spustí jednotkové testy.
- `npm run test:e2e` – spustí testy v prohlížeči.

Soubory v `public/generated` jsou generované. Neupravují se ručně.

## Režimy

- `#/play` – plná kampaň se 42 zónami.
- `#/practice` – výběr libovolné zóny pro trénink.
- `#/gallery` – vizuální kontrola převedených map a grafiky.
- `#/diagnostics` – krokování čisté simulace po mikroticích.
- `#/scores` – deset výsledků uložených v `localStorage`.

Ovládání zachovává původní klávesy Z/X/S/R a přidává A/D, šipky, Enter a Escape. Hudba a zvuky nejsou v této verzi implementované.

První stisk zatočí při nejbližším zpracování vstupu. Po 140 ms se stisk považuje za držení; tato hranice nezávisí na rychlosti zóny a chrání krátká klepnutí před dvojím zatočením. Držení se pak čte na konci každé osmimikrokrokové dávky, takže otočky mohou navazovat na místě, nezávisle na opakování klávesnice. Opakovaná otočka se neukládá předem do bufferu: puštění klávesy před koncem dávky ji zruší. Jde o záměrnou úpravu oproti prodlevě `korektkey` v DOS verzi. Při přechodu mezi zónami je nutné drženou klávesu pustit a znovu stisknout.

# Run Baby Run

Browserový port DOS hry `H_ESC_3`. Hra používá Canvas v interním rozlišení 320×200 a data deterministicky převedená z původních souborů.

## Příkazy

- `npm run extract` – znovu vytvoří webová data z `../H_ESC_3`.
- `npm run dev` – spustí vývojový server.
- `npm run build` – vytvoří produkční build pouze z již vygenerovaných dat.
- `npm test` – spustí jednotkové testy.
- `npm run test:e2e` – spustí testy v prohlížeči.
- `npm run test:coop` – dva prohlížeče se skutečným WebRTC a lokálním PeerJS serverem (porty 4174 a 9000); ověří pozvánku, RTT, start, role, shodu obrazu, pauzu a odpojení.

Soubory v `public/generated` jsou generované. Neupravují se ručně.

## Režimy

### Kampaň ve dvou

Hráč 1 otevře **Kampaň ve dvou**, pošle odkaz nebo ukáže QR kód. Hráč 2 odkaz jen otevře; hráč 1 spustí společný odpočet. Oba mohou používat klávesnici nebo dotykové tlačítko. Hráč 1 spouští i každou další zónu, hráč 2 nic nepotvrzuje. Při skrytí stránky se hra pozastaví, při odpojení je nutná nová dvojice. Sólo rekordy se nemění.

PeerJS používá ve výchozím stavu veřejný signalizační server. Osm RTT vzorků odhadne posun monotónních hodin; vzorek s nejnižším RTT určuje čas odpočtu. Host počítá původní simulaci a posílá úplné stavy nejvýše 30× za sekundu po spolehlivém WebRTC kanálu. Klient zobrazuje přijaté stavy (má tedy síťové zpoždění); neposouvá vlastní nezávislou simulaci. Klient start automaticky technicky potvrdí, spojení hlídá heartbeat. Zvukový hovor není součástí hry.

Pro dva různé přístroje nasaďte web na dostupné HTTPS adrese; odkaz s `localhost` na druhém telefonu nefunguje. Vlastní signaling a ICE/STUN/TURN servery lze nastavit při sestavení JSON proměnnou `VITE_PEER_OPTIONS` podle [PeerJS API](https://peerjs.com/client/api/peer). Například lokální signalizace pro vývoj: `{"host":"127.0.0.1","port":9000,"path":"/","secure":false}`. Pro sítě, kde přímé WebRTC spojení neprojde, je potřeba dostupný TURN server v `config.iceServers`. Nedávejte do veřejného buildu dlouhodobá tajná TURN hesla.

### Adresy

- `#/play` – plná kampaň se 42 zónami.
- `#/multiplayer` – stejná kampaň kooperativně: hráč 1 zatáčí vlevo, hráč 2 vpravo, pozvánka přes URL a QR.
- `#/practice` – výběr libovolné zóny pro trénink.
- `#/gallery` – vizuální kontrola převedených map a grafiky.
- `#/diagnostics` – krokování čisté simulace po mikroticích.
- `#/scores` – deset výsledků uložených v `localStorage`.

Ovládání zachovává původní klávesy Z/X/S/R a přidává A/D, šipky, Enter a Escape. Přepínač pod herní obrazovkou (nebo původní zkratka Alt+P) spouští tři Bachovy skladby dekódované přímo z notového proudu v `ATEST.ASM`. Zvukové efekty zatím implementované nejsou.

První stisk zatočí při nejbližším zpracování vstupu. Po 140 ms se stisk považuje za držení; tato hranice nezávisí na rychlosti zóny a chrání krátká klepnutí před dvojím zatočením. Držení se pak čte na konci každé osmimikrokrokové dávky, takže otočky mohou navazovat na místě, nezávisle na opakování klávesnice. Opakovaná otočka se neukládá předem do bufferu: puštění klávesy před koncem dávky ji zruší. Jde o záměrnou úpravu oproti prodlevě `korektkey` v DOS verzi. Při přechodu mezi zónami je nutné drženou klávesu pustit a znovu stisknout.

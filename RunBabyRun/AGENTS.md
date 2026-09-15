# Run Baby Run — závazný podklad pro věrnou konverzi

## Účel a pravidla práce

Tento projekt je rozpracovaný port DOS hry ze sousedního adresáře `../H_ESC_3`. Cílem je zachovat její herní mechaniku, nikoli napsat novou hru inspirovanou vzhledem. Před změnou simulace čti tento dokument a příslušné rutiny originálu. Současná implementace ani její testy nejsou samy o sobě důkazem správného chování.

- Primární zdroj je `../H_ESC_3/ATEST.ASM`; `ATEST.PAS` načítá grafiku, mapy a tabulku výsledků a spouští assembler. `CMARAT.PAS`/`CMARAT.ASM` patří k editoru, nejsou hlavním herním algoritmem.
- Zachovej význam příkazů, pořadí aktualizací, individuální čtecí pozice soupeřů, startovní frontu a kompresi stání. Nezaváděj hledání cesty, přímé řízení k hráči, nezávislé náhodné soupeře ani obecnou fyziku kolizí.
- Rozlišuj doložené chování zdrojáku, odvozené důsledky a dosud neověřené okrajové případy. Případnou opravu chyby originálu označ jako vědomou odchylku; neprováděj ji potichu.
- Používej `git -c safe.directory=C:/dev/RunBaby ...`. Respektuj cizí rozpracované změny.
- Tento port má npm příkazy v `README.md` a `package.json`. Generované soubory v `public/generated` neupravuj ručně. Pokud by práce vyžadovala sbt, nejprve vyhledej místní sandboxové instrukce; pro tento rozbor nebylo sbt potřeba.

Dokument vznikl statickým rozborem dostupného zdrojového kódu. DOS executable nebyl při tomto rozboru spuštěn. Čísla řádků níže jsou orientační; stabilním odkazem jsou názvy rutin a návěští.

## 1. Souřadnice, vůz a dvě časové úrovně

Obraz je 320 × 200 pixelů. Mapa má 40 × 25 polí po 8 × 8 pixelech; jedna mapa obsahuje 125 bajtů bitové masky (`makefield`, ř. 1315–1355). Logická obsazenost je v `dtpolasc`; alokováno je 2000 bajtů, viditelná mapa používá prvních 1000.

Formule zabírá dvě sousední logická políčka: hlavu a ocas. Svislý obrázek má 8 × 16, vodorovný 16 × 8 pixelů. Adresa obrázku je adresa jeho levého horního rohu ve framebufferu, nikoli index hlavy v mapě. Otočení musí správně upravit obě reprezentace.

Hlavní dávka obsahuje **osm mikrokroků**. Při jízdě každý mikrokrok posune obrázek o jeden pixel; celá dávka je tedy posun o jedno políčko. Otočení je zvláštní příkaz trvající celou dávku, nikoli jízda do nového směru v témže kroku.

Přesné pořadí jedné iterace (`cyklus`, ř. 434–444):

1. `predemnou`: hráčova logická pozice, kontrola prostoru před vozem / otočení / zeď.
2. `havarie`: logické pozice soupeřů a kolize (podrobnosti níže).
3. `hniformuli`: osm vizuálních mikrokroků; v každém nejprve hráč, potom soupeři od `for1data` dál, potom časové čekání.
4. `keymak`: zpracování vstupu pro další dávku.
5. Test `vyhra` a případný přechod do další zóny.

Kolize se tedy v originálu nepočítají z pixelových obdélníků při každém mikrokroku. Logický stav se mění před animací dávky. Nestačí osmkrát čekat a pak přeskočit obrázek o osm pixelů.

`zdrzto` čeká, dokud `_timerx > rychlik`, a čítač vynuluje. `_timerx` inkrementuje `Mint_08`; časovač má dělitel 1300. `rychlik` je práh čekání na každý mikrokrok: větší hodnota znamená pomalejší hru. Převod do času prohlížeče musí zachovat význam dávky a nezáviset na obnovovací frekvenci monitoru.

## 2. Význam příkazů

| Kód | Význam |
| --- | --- |
| 1, 2, 3, 4 | Jízda nahoru, dolů, doleva, doprava. |
| 11, 12, 13, 14 | Stání / orientace nahoru, dolů, doleva, doprava; zahrnuje otočení i stání u zdi. |
| 6 | Čekání ve startovní sekvenci. |
| 7 | Posun celého zbytku startovní fronty doleva, se změnou vlastní pozice právě zpracovávaného vozu. |
| 5 | Explicitní nečinnost ve vykreslovací rutině; startovní čekání používá 6. |
| 255 | Koncová značka, návrat čtecího či zapisovacího ukazatele na `mojeauto`. |

`hniformli` obsluhuje 1–5, 7 a 11–14; jiné kódy včetně 6 pouze vrátí řízení. Viz ř. 491–555 a tabulky `datahore` až `datprasta`, ř. 3016–3026.

## 3. Hráč: pohyb, zatáčení a zeď

Po startu je směr 1 (nahoru). Z/X znamenají relativní otočení vlevo/vpravo, nikoli absolutní směr. `leftrot` a `rightrot` nastaví 11–14. Následující dávka otočí vůz a stojí; `keymak` potom obvykle převede 11–14 zpět na 1–4. Klávesové události a opakování mají vlastní stav (`hrac1key`, `hrac2key`, `korektkey`, `buffer`, `volna`); vstup se nesmí libovolně aplikovat uprostřed dávky.

`predemnou` při jízdě zkontroluje nové políčko hlavy:

- 255 je zeď: jízdu nahradí orientovaným stáním podle posledního příkazu (`autobol`). Zeď sama hráče nezabije.
- Jiná hodnota >= 20 vede do smrti hráče.
- Při průjezdu zapíše novou hlavu, z původní hlavy udělá ocas a původní ocas vymaže.

Otočení aktualizuje hlavu i ocas podle tabulek `dthornas`, `dtdolnas`, `dtlevnas`, `dtpranas`. Grafická rutina `strednice` přepočítává levý horní roh podle předchozí orientace a maže starý obrázek. Není to prosté otočení obrázku kolem libovolně zvoleného středu.

Pro otočení u zdi existuje zvláštní logika `zpravic`, `zed_lep`, `colepi`, `autoboli`, `otocsmer`: pamatuje blokovaný pokus, umožňuje pokračování původním směrem při uvolnění a v příslušné větvi obrací směr a zamění hlavu s ocasem. Nenahrazuj ji automatickým odrazem od každé zdi. Při implementaci úzkých míst je nutné projít tyto větve i s konkrétním předchozím příkazem (ř. 810–1017).

## 4. Záznam hráčovy jízdy

`mojeauto` je kruhové pole **700 bajtů příkazů**, následované značkou 255. Není to seznam souřadnic, 700 pixelových kroků ani historie samotných stisků kláves.

Hráč má zapisovací ukazatel `mojedata+2`. `hniformuli` ukládá aktuální příkaz pouze při posledním mikrokroku (`drzsmer == 1`), tedy **jeden bajt na jednu osmimikrokrokovou dávku**. Ukládají se také otočení a opakované stání u zdi. Po zápisu se ukazatel posune; narazí-li na 255, vrací se na `mojeauto`.

Každý soupeř má nezávislý čtecí ukazatel na tutéž sekvenci. Čte příkaz během mikrokroků a standardně přejde na další bajt až na konci dávky. Při koncové značce se také vrací na `mojeauto`, nikoli na začátek startovního čekání. Soupeři reprodukují hráčovy příkazy se zpožděním; nesledují jeho současnou pozici výpočtem nové trasy.

Pořadí v posledním mikrokroku je důležité: hráč zapíše svůj příkaz ještě před voláním `autopal` pro soupeře.

Zdroj: `hniformuli` a `autopal`, ř. 690–796; `pohybdata`, ř. 2998–3013.

## 5. Jak soupeři odstraňují zdržení o zeď

V `autopal` je smyčka `preskok`. Když čtený příkaz má hodnotu >= 10, posouvá čtecí ukazatel přes souvislou řadu **stejných** bajtů, až najde jiný. Pak ukazatel vrátí o jeden bajt, tedy na poslední výskyt původního příkazu. Aktuální příkaz stále provede; na konci dávky normální inkrement přejde na následující odlišný příkaz.

Příklad: záznam `1, 11, 11, 11, 11, 4` soupeř přehraje jako `1, 11, 4`. Záznam `11, 13, 13, 1` přehraje jako `11, 13, 1`.

- **Paměť historie se nepřepisuje ani nemaže.** Zkrátí se pouze průchod konkrétního soupeře přes historii.
- Zůstává jedna dávka dané orientace. Nevynechat všechna stání: kódy 11–14 jsou také nezbytnými příkazy otočení.
- Odstraňují se shodná sousední orientovaná stání; ne všechny příkazy bez posunu a ne libovolné střídání 11/12/13/14.
- Kódy 6 a 7 se touto smyčkou nekomprimují.
- Přeskakování se volá při každém `autopal`, tedy v každém mikrokroku. Hráč může mezitím historii prodlužovat. Předběžné globální zkomprimování celé trasy nemusí být ekvivalentní.
- Důsledek: při dlouhém stání hráče se soupeři přibližují; rozdíly čtecích pozic už nemusí zůstat rovné počátečním rozestupům. To vytváří možnost jejich vzájemných kolizí.

Pozor na věrnost: `rozjezd` aktualizuje logické souřadnice před touto kompresí v animaci. Přesun komprese na začátek hlavní dávky může změnit hraniční chování. Smyčka `preskok` sama nemá obsluhu přetočení kruhového pole; značka 255 je řešena až běžným posunem ukazatele. Bez ověření netvrď, že zdroj bezpečně komprimuje jednu řadu přes hranici pole.

## 6. Start soupeřů: čekání, posun fronty, příjezd na stopu

Společná sekvence v paměti před `mojeauto` je přesně:

```text
315 × 6     # 65 + 60 + 50 + 40 + 20 + 40 + 20 + 20
  2 × 7     # dvě dávky posunu celé fronty, celkem 16 pixelů
  8 × 3     # osm dávek samostatné jízdy doleva, celkem 64 pixelů
  1 × 11    # otočení nahoru během jedné dávky
mojeauto    # následuje záznam hráče
```

Každý soupeř začíná s ukazatelem `prvniauto + offset[i]`. Offsety jsou slova z tabulky zóny, nikoli přímé počty čekacích snímků. Počet čekacích dávek je `315 - offset[i]`; **větší offset znamená dřívější výjezd**. První příkaz historie nastane po `326 - offset[i]` dokončených dávkách startovní sekvence (při číslování od nuly je to index první dávky přehrávání).

V první zóně jsou offsety `0,65,125,175,215,235,275,295`: vozy s identitami `for8` až `for1` tedy čekají postupně 20, 40, 80, 100, 140, 190, 250 a 315 dávek. Není správně vykládat seznam jako „první auto vyjede hned, druhé za 65“.

`putformule` kreslí řadu od `(88,184)` doprava po 16 pixelech. Zleva kreslí typ `N+2`, potom `N+1` až 3. Levý vůz tedy odpovídá poslednímu záznamu soupeře; to souhlasí s většími offsety a dřívějším výjezdem.

Zásadní rozdíl mezi obrazem a logikou:

- Všechny záznamy soupeřů jsou inicializovány na stejnou grafickou adresu `blokforma = 58968`, tedy `(88,184)`, a stejné logické indexy 931/932. Nemají každý svou skutečnou pozici v nakreslené řadě.
- Kód 6 čeká; nevykresluje znovu jednotlivý stojící vůz.
- Kód 7 v `hniblk` sníží vlastní grafickou adresu právě vyjíždějícího vozu o jeden pixel a zavolá `posuntyl`. Ta posune **celý pruh 128 × 8 pixelů** doleva o pixel. Ostatní obrázky v řadě se vezou v tomto posunu bez změny svých záznamů pozice.
- Dvě dávky kódu 7 posunou řadu o šířku jednoho auta. Potom příkazy 3 vykreslují už jen samostatně vyjíždějící vůz. Další čekající vůz je obrazově na startovní pozici a čeká na vlastní čtecí ukazatel.
- Po 16 + 64 pixelech doleva je vyjíždějící vůz na `(8,184)`. Příkaz 11 jej přetočí na `(8,176)`; hlava/ocas odpovídají 881/921. To je výchozí poloha hráče (`mojeforma = 56328`). Potom začne přehrávat hráčovu stopu.

Jednotlivé dříve vyjeté vozy už mohou pronásledovat hráče, zatímco další ještě vyjíždí. „Jen jeden se rozjíždí“ se týká přechodu z čekající fronty; neznamená to, že v celé hře smí jet jediný soupeř.

Zdroj: inicializace ř. 368–410; `hniblk`, `posuntyl` ř. 548–641; `putformule` ř. 1401–1418; tabulky zón a `pohybdata` ř. 2871–3013.

## 7. Kdy se soupeři účastní kolizí

`havarie` nejprve volá `rozjezd` pro všechny soupeře **od posledního k prvnímu**. `rozjezd` načte aktuální příkaz do `+10` a aktualizuje logickou hlavu/ocas. Kód 7 se zde posuzuje jako pohyb doleva; čekání zapisuje do obsazenosti hodnotu 40.

Potom:

1. `exitus` ověří hráčovu hlavu a ocas: v obou políčkách musí v `dtpolasc` zůstat hráčův kód. Přepsání soupeřem může hráče zabít.
2. `baseprg` prochází soupeře od posledního do druhého a porovnává jejich hlavu i ocas s hlavou i ocasem všech předchozích záznamů přes vazby `+13/+15`.
3. `setbour` spočítá havarované a vyhodnotí výhru.

`baseprg` okamžitě přeskočí vůz s typem >= 20 a vůz, jehož příkaz v `+10` je **6 nebo 7**. Čekání a posun startovní řady proto nejsou běžná aktivní jízda. Vůz začne být na této straně párového testu způsobilý ke srážce již při příkazech 3 v nájezdu, ne až po dosažení `mojeauto`. Neexistuje další samostatný časovač „zapni kolize po startu“.

Přesná asymetrie zdroje je důležitá: u porovnávaného předchozího vozu se testuje typ < 20, nikoli jeho příkaz 6/7. Nelze bez dalšího nahradit tuto logiku obecným pravidlem „čekající vůz ignoruj na obou stranách každé kolize“.

Shoda libovolné dvojice hlava/ocas znamená zásah. **Havarovaným se označí pouze aktuálně testovaný vůz `di`**, ne oba současně. Typ se opakovaně zvyšuje o 10, dokud není >= 21. Pořadí průchodu je tedy součástí pravidel. První záznam soupeře není sám testován jako oběť v `baseprg`, ale ostatní do něj mohou narazit.

Nehavarovaní soupeři v `rozjezd` netestují zeď jako hráč; následují zaznamenanou stopu. Nenahrazuj to stejnou univerzální kolizní rutinou pro hráče i soupeře.

## 8. Havárie, vrak a konec zóny

Typy < 20 jsou živé vozy. Po zásahu vzniká typ >= 21 (např. 3 → 23); kreslicí obálky od typu 20 používají šedou barvu 7 a původní obrázek z `+17`.

Tato změna ještě není totožná s definitivním zastavením: v následujícím `rozjezd` se přes `nepremaz` typ zvýší na >= 40, hlava a ocas dostanou v mapě 40. `autopal` zastavuje grafický pohyb až pro typ >= 40, kdy použije orientované stání podle posledního příkazu. Proto nezkracuj automaticky dvoufázovou havárii na okamžité odstranění vozu.

`setbour` počítá všechny typy >= 20. Výhra nastane při **přesně `počet_soupeřů - 1` havarovaných**, tedy když zůstává jeden soupeř. Cílem není odstranit všechny vozy. To souvisí s asymetrickým testem a prvním záznamem, který není testován jako oběť.

Hráč umírá při zjištění smrtelné obsazenosti nebo při neúspěšném `exitus`; odečte se život a řízení přejde do větve `nextzone`, při nule do menu. V běžné hře `nextzone → hranormalni` inkrementuje `realzone` i `numrzone`: i po smrti se tedy podle tohoto zdroje postupuje dál, nejde o běžný restart stejné zóny. V tréninku tato větev znovu vybere `prakdraha` a nastaví sedm životů (ř. 271–310). Případnou změnu tohoto překvapivého chování označ jako odchylku.

Zdroj: `havarie`, `baseprg`, `exitus`, `setbour`, `rozjezd`, ř. 1683–2009; kreslicí obálky ř. 2012–2074.

## 9. Význam struktury vozu

| Offset | Význam |
| --- | --- |
| +0, word | Adresa levého horního rohu obrázku ve framebufferu. |
| +2, word | Hráč: zápis historie; soupeř: čtení sekvence. |
| +4, byte | Typ obrázku a současně stav živý / havárie / vrak. |
| +5, byte | Poslední provedený příkaz/orientace. |
| +6, +8, word | Logický index hlavy a ocasu. |
| +10, byte | Soupeř: příkaz načtený před logickou aktualizací této dávky. |
| +13, +15, word | Vazba na předchozí vůz a pokračování párového testu. |
| +17, byte | Původní typ obrázku pro šedé vykreslení vraku. |

Záznam soupeře má 18 bajtů; hráčův základ 10. Poznámky ke +11/+12 jsou ve zdroji, ale v popsaném mechanismu jim nepřisuzuj novou funkci bez ověření použití.

## 10. Co musí budoucí implementace doložit

Při budoucí změně simulace použij konkrétní průběhy odvozené z originálu:

- Osm mikrokroků jízdy: pixelové pozice po 1 px, jediný zápis historie, logická aktualizace před animací.
- Otočení: celá dávka 11–14, správná hlava/ocas a grafický roh; jízda až další dávku.
- Dlouhé stání u zdi: hráč zapíše každou dávku; jednotlivý soupeř přeskočí opakování, zachová jeden orientovaný příkaz a nezmění společnou paměť.
- Dva soupeři se samostatnými čtecími pozicemi; zkracování časového odstupu po stání hráče.
- První zóna: 20 dávek do prvního posunu fronty, dvě dávky kódu 7, osm dávek kódu 3, jedna dávka 11, poté historie. Ověřit také další vůz a zónu s jinými offsety.
- Fronta se během kódu 7 vizuálně posune celá o 16 px; následně samostatně odjíždí příslušný vůz. Neanimovat všechny čekající vozy jako nezávislé pronásledovatele.
- Kolizní způsobilost při přechodu 6 → 7 → 3; párové pořadí a jednostranné označení oběti.
- Havárie → šedý vůz → zastavený vrak; hráč versus hodnota 40; výhra s jedním zbývajícím soupeřem.
- Přetočení 700bajtové historie bez nového startovního čekání; okraje komprese ověřit odděleně.

Pro obtížně odvoditelné případy (komprese při přetočení kruhu, otočení v úzké zdi, překryv logického a vykreslovacího stavu, zbytky paměti po restartu) pořiď trasování originálu nebo přesný překlad relevantních větví. Nevyplňuj mezery intuitivním chováním moderní hry.

## 11. Reprezentace v opraveném webovém jádře

`src/game/engine.js` používá číselné příkazy originálu, 700 položek `playerRoute`, zapisovací `routeWriteCursor` a samostatné `routeCursor` soupeřů. `head`/`tail` jsou logické buňky aktualizované před animací; `renderPosition` je skutečný pixelový roh obrázku a `displayDirection` jeho orientace. Renderer nesmí k této poloze znovu přičítat `microStep` ani odvozovat pohyb stojícího vozu jen z jeho směru. Čekající fronta má sdílené logické souřadnice a odlišné obrazové pozice.

Testy jádra ověřují jednotlivé mikrokroky, bezpečný obrat v úzké chodbě, startovní offsety, samostatné přehrávání a kompresi stání, přetočení historie a asymetrické srážky. Kontrola půdorysu hráče používá všech 42 skutečných map; prohlížečový test krokováním diagnostiky ověřuje výjezd a napojení na historii.

Bezpečnostní vymezení portu: komprese se zastaví na konci 700bajtové historie, nepokračuje do sousední paměti. Nová hra inicializuje historii a obsazenost deterministicky, nereprodukuje zbytky paměti DOS procesu. Tyto ochrany nejsou důkazem shody neověřených paměťových okrajů originálu. Přesné časování opakování držené klávesy z DOS přerušení zůstává samostatným tématem; ovládání webu zatím předává události klávesnice.

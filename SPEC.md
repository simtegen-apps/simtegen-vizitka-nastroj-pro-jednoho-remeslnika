# Specifikace — build 2

Vznikne generátor vizitek: nasazená stránka není vizitka řemeslníka, ale nástroj, ve kterém si ji řemeslník vyklikne — vyplní formulář, vidí živý náhled a stáhne si jediný soběstačný soubor `vizitka.html` s fotkami zapečenými jako `data:` URI, který si nahraje na libovolný hosting. Stažený soubor je zároveň projektový soubor (obsahuje vložený JSON se zadanými údaji), takže se do nástroje vrátí a jde v něm pokračovat — údržba bez jakéhokoli úložiště u nás. Součástí je QR kód na výslednou adresu, generovaný v prohlížeči jako inline SVG.

## Plán
1. **Datový kontrakt nejdřív.** V `data-manifest.json` vyplnit jen `produkt` na `"Vizitka-nastroj pro jednoho remeslnika"` (ASCII, jako zbytek manifestu). Ostatní pole zůstávají beze změny: `obsah_zakaznika: neuklada_se`, `zpracovani: v_prohlizeci`, `externi_pozadavky: zadne`, `uloziste_v_prohlizeci: []`, `cookies: zadne`. V `zasady.html` upravit pouze věty týkající se nástroje (fotky a údaje se zpracovávají v prohlížeči, výstupem je soubor ke stažení); zachovat pořadí odstavců-slotů i odstavec o Cloudflare Pages.

2. **Kostra a styl.** `web/index.html` přepsat na dvousloupcové rozvržení — vlevo formulář, vpravo lepivý náhled, pod 900 px pod sebou. `web/styl.css` vychází ze `system-ui` stacku šablony, ale bez omezení na 40 rem. Zavést jednoduchou konvenci tříd (`.pole`, `.sekce`, `.nahled`) — šablona zatím žádnou nemá. Klasické `<script src="…">`, nikdy `type="module"` (moduly z `file://` blokuje CORS).

3. **Model a formulář** (`web/nastroj.js`). Jeden objekt `stav` = celý obsah vizitky. Delegovaný `input` listener přepisuje `stav`, každá změna překresluje náhled (debounce ~150 ms). Pole: jméno, obor, město, slogan, popis, seznam služeb (přidat/odebrat/přesunout), telefon, e-mail, IČO, oblast působení, barevný akcent (3–4 předvolby), volitelná adresa vizitky pro QR.

4. **Generátor vizitky** (`web/sablona-vizitky.js`). Jediná funkce `sestavVizitku(stav) -> string` vrací kompletní HTML dokument jako řetězec: `<!doctype html>`, `lang="cs"`, inline `<style>`, minimální inline `<script>` (lightbox galerie + skládání zprávy) a na konci vložený `<script type="application/json">` se `stav`. **Náhled i export volají tutéž funkci** — náhled je `<iframe srcdoc>`, takže mezi viděným a staženým nemůže vzniknout rozdíl. Escapovat všechny vstupy (`&<>"'`) a zvlášť vložený JSON (`</` → `<\/`).

5. **Fotky.** `<input type="file" multiple accept="image/*">` → `FileReader` → `<canvas>` zmenšení na max 1400 px delší hrana → `toDataURL('image/jpeg', 0.72)`. Limit 10 fotek, u každé popisek, pořadí a smazání; jedna jde označit jako profilová do hlavičky. Viditelný ukazatel výsledné velikosti souboru s varováním nad 4 MB.

6. **Export a návrat.** „Stáhnout vizitku“ → `Blob` + `URL.createObjectURL` + `<a download="vizitka.html">`. „Načíst rozpracovanou vizitku“ → `<input type="file" accept=".html">` → `FileReader` přečte text, regulárním výrazem vytáhne vložený JSON a naplní `stav` i formulář. Soubor bez JSON bloku ošetřit srozumitelnou českou hláškou.

7. **QR kód** (`web/qr.js`). Vlastní minimální enkodér: byte mode, korekce úrovně M, verze 1–10 (~270 znaků, pokryje jakoukoli `pages.dev` adresu), Reed–Solomon nad GF(256), všech 8 masek s penalizačním skóre. Výstup jako inline SVG — externí generátor by byl `<img src="http` a shodil by CI. Tlačítka: stáhnout SVG, stáhnout PNG (přes canvas), vytisknout (`window.print()` s tiskovým stylem: kód + jméno + telefon na kartičku).

8. **Ukázka a doladění.** Tlačítko „Vyplnit ukázkou“ s daty fiktivního truhláře **inline v JS** (externí JSON nejde — `fetch` je zakázaný a z `file://` by neprošel), aby šlo demo předvést do 10 sekund od otevření. Projít mobilní šířky, kontrast, `alt` texty, varování `beforeunload`.

9. **Ověření a odevzdání.** Projít validaci, lokálně spustit `python3 kontrola_manifestu.py`, pushnout větev `build/vizitka-v1`, otevřít PR — merge do `main` je lidské rozhodnutí. Volitelně přidat `.gitignore` s `__pycache__/`; šablona ho nemá a `.pyc` je omylem verzovaný.

**Mimo rozsah v1 (vědomě, kvůli termínu):** platební brána a kredit — demo je zdarma; vlastní doména; nahrání souboru na hosting za zákazníka; e-mailový relay pro formulář. Poptávka bez backendu se řeší tak, že tlačítko složí `mailto:` / `sms:` / `tel:` odkaz — vizitka sama nesbírá žádné údaje.

## Soubory
- data-manifest.json — úprava: vyplnit pole `produkt`
- web/index.html — přepis: samotný nástroj (formulář + živý náhled)
- web/zasady.html — úprava: doplnit sloty podle manifestu
- web/styl.css — nový: styl nástroje
- web/nastroj.js — nový: stav, formulář, fotky, export, import, ukázková data
- web/sablona-vizitky.js — nový: sestavVizitku(stav) → HTML řetězec vizitky
- web/qr.js — nový: QR enkodér (byte mode, ECC M) → inline SVG
- README.md — dodatek: odstavec, jak nástroj ověřit lokálně
- .gitignore — nový, volitelný: __pycache__/

## Rizika
- **QR enkodér je největší riziko.** Reed–Solomon a maskování se snadno napíšou „skoro správně“ — kód se vykreslí a nenačte. Proto je až za hotovým zbytkem: kdyby to nevyšlo v termínu, demo jde předvést bez QR a doplnit ho v 1.1. Ověřovat výhradně skenováním skutečným telefonem, ne pohledem.
- **Velikost souboru.** 10 fotek v base64 snadno dá 8+ MB HTML. Zmenšování na canvasu a ukazatel velikosti to drží, ale je to strop produktu — patří ho v UI přiznat, ne skrývat.
- **HEIC z iPhonu.** Desktopové prohlížeče ho na canvasu nedekódují. Detekovat selhání a napsat česky, co s tím.
- **Ztráta rozdělané práce.** Bez úložiště v prohlížeči zavření karty smaže všechno. `beforeunload` varuje, ale nezachrání. Vědomý kompromis: autosave by znamenal změnu manifestu i zásad, což se pro demo nevyplatí.
- **`mailto:` má limity.** Dlouhé tělo některé klienty ořežou a na desktopu bez nastaveného poštovního klienta se nestane nic. Držet zprávu krátkou a vedle toho nabídnout `sms:`, `tel:` a zkopírování textu.
- **Stahování ze `file://` v Safari.** `download` u blob URL tam zlobí. Ověřit; fallback „otevřít v novém okně a uložit“.
- **CI grep chytá i komentáře.** `kontrola_manifestu.py` je prostý substring scan přes `web/` — zakázaná slova (`fetch(`, `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, `<img src="http`, …) tam nesmí být ani v české větě nebo komentáři. Nejpravděpodobnější příčina padlého buildu.
- **Výkon náhledu.** `srcdoc` s megabajty base64 při každém úhozu zamrzne — nutný debounce.
- **Poslední metr chybí.** Vizitka je soubor; dostat ji online je v1 ruční krok. Pro zákazníka nula stačí, ale pro placené zákazníky je to jediná věc, která rozhoduje, jestli produkt funguje bez nás — patří hned do v1.1.
- **GDPR řemeslníka.** Vizitka sama nic nesbírá, ale poptávky mu chodí e-mailem. Do patičky patří krátká věcná věta, že formulář nic neodesílá na server; víc za něj slibovat nemůžeme.

## Jak ověřit
Vše ručně, bez serveru:

1. Otevřít `web/index.html` dvojklikem z Průzkumníka (tedy z `file://`). Konzole prohlížeče musí být čistá.
2. Kliknout „Vyplnit ukázkou“ — náhled se okamžitě zaplní vizitkou truhláře.
3. Přepsat jméno a telefon, přidat dvě služby, nahrát 3 fotky z telefonu. Náhled se překreslí, ukazatel velikosti roste.
4. „Stáhnout vizitku“ → otevřít stažený `vizitka.html` dvojklikem. Musí vypadat **identicky** s náhledem a fotky se musí zobrazit i po odpojení od internetu.
5. Ve stažené vizitce vyplnit poptávku a odeslat → otevře se poštovní klient s předvyplněným předmětem a tělem. Kliknout na telefon → nabídne vytočení.
6. Vrátit stažený soubor přes „Načíst rozpracovanou vizitku“ → formulář i náhled se obnoví přesně do stavu před stažením.
7. Zadat adresu vizitky, vygenerovat QR a **naskenovat ho fotoaparátem telefonu** — musí otevřít zadanou adresu. Stáhnout PNG i SVG.
8. Zúžit okno na 380 px — formulář i vizitka zůstanou čitelné a ovladatelné.
9. Do pole jméno napsat `<script>alert(1)</script>` a `"uvozovky" & <ampersand>` — v náhledu i ve staženém souboru se to zobrazí jako text, nic se nespustí, dokument se nerozbije a round-trip import to přečte správně zpátky.
10. V kořeni spustit `python3 kontrola_manifestu.py` → musí vypsat `Manifest souhlasí s kódem.`

Hotovo znamená: zákazníkovi nula lze na notebooku **bez internetu** ukázat celou cestu od prázdného formuláře po naskenovaný QR kód.

_Schvaluje se přes ARGA (simtegen_approve_spec) nebo na mini PC._
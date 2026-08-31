# Produkt SimteGen

Repozitář vznikl ze šablony `simtegen-sablona`. Pravidla, která drží celý
podnik, platí i tady:

- **`web/` je jediné, co se nasazuje.** Statická stránka bez závislostí a
  bez build systému — musí jít otevřít lokálně ze souboru.
- **Neukládá se obsah zákazníka.** Ideálně neopustí jeho prohlížeč. Co se
  přesto sbírá, deklaruje `data-manifest.json` — a CI shodí build, když se
  kód s manifestem rozejde (`kontrola_manifestu.py`).
- **Nasazuje se výhradně merge do `main`.** Stavitel (SimteGen) pushuje jen
  větve `build/*` a otevírá pull requesty; merge je lidské rozhodnutí.
  Push větve zároveň vytvoří preview nasazení na Cloudflare Pages.
- **`.github/` patří člověku.** SimteGen na workflow soubory nesahá — jeho
  token na ně ani nemá právo, GitHub takový push odmítne celý.

Produkční URL: `https://<název-repa>.pages.dev` (projekt na Cloudflare Pages
se jmenuje po repozitáři). Preview větve: `https://<větev>.<název-repa>.pages.dev`.

## Vizitka-nástroj pro jednoho řemeslníka

Nasazená stránka není vizitka — je to **generátor vizitek**. Řemeslník
vyplní formulář, vpravo vidí živý náhled a stáhne si jediný soběstačný
soubor `vizitka.html` s fotkami zapečenými jako `data:` URI. Ten si nahraje
na libovolný hosting.

Stažený soubor je zároveň projektový soubor: nese si v sobě vyplněný stav
jako JSON, takže ho jde načíst zpátky do nástroje a pokračovat v úpravách.
Je to jediná paměť produktu a je celá u zákazníka — u nás se neukládá nic.

Soubory ve `web/`:

| Soubor | Co dělá |
|---|---|
| `index.html` | samotný nástroj — formulář vlevo, náhled vpravo |
| `styl.css` | vzhled nástroje (s vizitkou nemá nic společného) |
| `nastroj.js` | stav, formulář, fotky, QR, stažení a načtení zpět |
| `sablona-vizitky.js` | `sestavVizitku(stav)` → hotová vizitka jako řetězec |
| `qr.js` | vlastní QR enkodér (režim bajtů, korekce M, verze 1–10) |

### Jak to ověřit lokálně

1. Otevřít `web/index.html` dvojklikem — tedy z `file://`, bez serveru.
   Konzole prohlížeče musí zůstat čistá.
2. Kliknout **Vyplnit ukázkou**, přepsat pár polí, nahrát fotky.
3. **Stáhnout vizitku** → otevřít stažený soubor dvojklikem. Musí vypadat
   stejně jako náhled a fungovat i bez připojení k internetu.
4. Stažený soubor vrátit tlačítkem **Načíst rozpracovanou** — formulář se
   obnoví do stejného stavu.
5. Vyplnit adresu vizitky a vygenerovaný QR kód **naskenovat telefonem**.
   Na tohle se nedá spolehnout od pohledu, musí se to opravdu zkusit.
6. `node overeni-qr.js` → `VSE PROSLO`. Nezávisle dekóduje vlastní výstup
   enkodéru a kontroluje syndromy Reed-Solomonova kódu. Nenasazuje se,
   nic si neinstaluje a telefon nenahradí — jen chytí chybu dřív.
7. `python3 kontrola_manifestu.py` → `Manifest souhlasí s kódem.`

Pozor při úpravách `web/`: `kontrola_manifestu.py` hledá zakázané vzory
prostým porovnáním textu, tedy i v komentářích a v českých větách. Slova
jako `fetch(` nebo názvy úložišť v prohlížeči se do `web/` nesmí dostat
v žádné podobě, dokud je manifest nedeklaruje.

### Co první verze schválně neumí

Platební bránu, vlastní doménu ani nahrání vizitky na hosting za zákazníka
— výstupem je soubor a nahrání je zatím ruční krok. Poptávkový formulář
nemá backend: skládá `mailto:`, `sms:` a `tel:` odkaz, takže vizitka sama
o sobě nesbírá žádné údaje.

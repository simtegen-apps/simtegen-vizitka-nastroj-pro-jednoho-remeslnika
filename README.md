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

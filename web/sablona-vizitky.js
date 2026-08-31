/* Šablona hotové vizitky.
 *
 * sestavVizitku(stav) vrací kompletní HTML dokument jako jeden řetězec.
 * Tenhle řetězec se používá na dvě věci: nalije se do náhledu a stáhne se
 * jako soubor. Je to schválně jedna jediná funkce — kdyby náhled vznikal
 * jinou cestou než export, dřív nebo později by se rozešly a řemeslník by
 * stáhl něco jiného, než viděl.
 *
 * Na konec dokumentu se ukládá vyplněný stav jako JSON. Díky tomu je
 * stažený soubor zároveň projektový soubor a jde ho vrátit do nástroje
 * k další úpravě, aniž bychom si u sebe cokoli pamatovali.
 */

var PALETY = {
  drevo: { akcent: '#7a5230', tmava: '#3a2a1a', papir: '#faf7f2', linka: '#e6ded1' },
  voda:  { akcent: '#1d5675', tmava: '#16303d', papir: '#f3f8fb', linka: '#d7e5ed' },
  les:   { akcent: '#2f5d3a', tmava: '#1d3823', papir: '#f4f8f4', linka: '#dae7dc' },
  uhel:  { akcent: '#3d3d3d', tmava: '#1c1c1c', papir: '#f6f6f5', linka: '#e0e0de' }
};

function escHtml(hodnota) {
  return String(hodnota === null || hodnota === undefined ? '' : hodnota)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jeVyplneno(hodnota) {
  return typeof hodnota === 'string' && hodnota.trim() !== '';
}

/* Odstavce z prostého textu — prázdný řádek dělí odstavec. */
function naOdstavce(text) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map(function (kus) { return kus.trim(); })
    .filter(jeVyplneno)
    .map(function (kus) { return '<p>' + escHtml(kus).replace(/\n/g, '<br>') + '</p>'; })
    .join('\n      ');
}

function cisloProOdkaz(telefon) {
  return String(telefon || '').replace(/[^\d+]/g, '');
}

/* Stav tak, jak se ukládá do vizitky: bez obrázkových dat, protože ta
   ve stránce už jednou jsou. Popisky a pořadí zůstávají, takže se fotky
   dají při načtení zase spárovat. */
function stavProUlozeni(stav) {
  var kopie = {};
  Object.keys(stav).forEach(function (klic) { kopie[klic] = stav[klic]; });
  kopie.fotky = (Array.isArray(stav.fotky) ? stav.fotky : []).map(function (foto) {
    return { popis: foto.popis || '' };
  });
  return kopie;
}

var SKRIPT_VIZITKY = [
  '(function () {',
  '  "use strict";',
  '  function el(id) { return document.getElementById(id); }',
  '  function hod(id) { var e = el(id); return e ? e.value.trim() : ""; }',
  '',
  '  var galerie = el("galerie");',
  '  var lupa = el("lupa");',
  '  if (galerie && lupa) {',
  '    galerie.addEventListener("click", function (e) {',
  '      var snimek = e.target.closest(".snimek");',
  '      if (!snimek) return;',
  '      var obr = snimek.querySelector("img");',
  '      el("lupa-obr").src = obr.src;',
  '      el("lupa-obr").alt = obr.alt;',
  '      el("lupa-popis").textContent = snimek.getAttribute("data-popis") || "";',
  '      lupa.hidden = false;',
  '      el("lupa-zavrit").focus();',
  '    });',
  '    lupa.addEventListener("click", function (e) {',
  '      if (e.target === lupa || e.target.id === "lupa-zavrit") lupa.hidden = true;',
  '    });',
  '    document.addEventListener("keydown", function (e) {',
  '      if (e.key === "Escape" && !lupa.hidden) lupa.hidden = true;',
  '    });',
  '  }',
  '',
  '  var f = el("poptavka");',
  '  if (!f) return;',
  '  var telefon = f.getAttribute("data-telefon") || "";',
  '  var email = f.getAttribute("data-email") || "";',
  '',
  '  function telo() {',
  '    var r = ["Dobrý den,"];',
  '    r.push(hod("p-text") || "mám zájem o vaše služby.");',
  '    r.push("");',
  '    if (hod("p-jmeno")) r.push("Jméno: " + hod("p-jmeno"));',
  '    if (hod("p-telefon")) r.push("Telefon: " + hod("p-telefon"));',
  '    if (hod("p-email")) r.push("E-mail: " + hod("p-email"));',
  '    return r.join("\\n");',
  '  }',
  '  function predmet() {',
  '    var j = hod("p-jmeno");',
  '    return "Poptávka z webu" + (j ? " – " + j : "");',
  '  }',
  '  function ukazOpis() {',
  '    var n = el("p-nahrada");',
  '    if (!n) return;',
  '    el("p-opis").value = telo();',
  '    n.hidden = false;',
  '  }',
  '',
  '  f.addEventListener("submit", function (e) { e.preventDefault(); });',
  '',
  '  var tlacMail = el("p-mail");',
  '  if (tlacMail) tlacMail.addEventListener("click", function () {',
  '    ukazOpis();',
  '    window.location.href = "mailto:" + email',
  '      + "?subject=" + encodeURIComponent(predmet())',
  '      + "&body=" + encodeURIComponent(telo());',
  '  });',
  '',
  '  var tlacSms = el("p-sms");',
  '  if (tlacSms) tlacSms.addEventListener("click", function () {',
  '    ukazOpis();',
  '    window.location.href = "sms:" + telefon + "?body=" + encodeURIComponent(telo());',
  '  });',
  '',
  '  var tlacOpis = el("p-zkopirovat");',
  '  if (tlacOpis) tlacOpis.addEventListener("click", function () {',
  '    var pole = el("p-opis");',
  '    pole.select();',
  '    try { document.execCommand("copy"); } catch (chyba) { /* uživatel zkopíruje ručně */ }',
  '  });',
  '})();'
].join('\n');

function stylVizitky(p) {
  return [
    '*, *::before, *::after { box-sizing: border-box; }',
    'body { margin: 0; background: ' + p.papir + '; color: ' + p.tmava + ';',
    '  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;',
    '  line-height: 1.65; font-size: 17px; }',
    'h1, h2, h3 { line-height: 1.25; margin: 0 0 .4em; }',
    'p { margin: 0 0 1em; }',
    'a { color: ' + p.akcent + '; }',
    '.obal { max-width: 46rem; margin: 0 auto; padding: 0 1.25rem; }',
    '',
    '.hlava { background: ' + p.akcent + '; color: #fff; padding: 3rem 0 2.5rem; }',
    '.hlava a { color: #fff; }',
    '.hlava h1 { font-size: clamp(2rem, 6vw, 2.9rem); margin: 0 0 .25em; }',
    '.nadobor { text-transform: uppercase; letter-spacing: .09em; font-size: .8rem;',
    '  font-weight: 600; opacity: .85; margin: 0 0 .5em; }',
    '.slogan { font-size: 1.15rem; opacity: .93; max-width: 32rem; }',
    '.portret { width: 108px; height: 108px; border-radius: 50%; object-fit: cover;',
    '  border: 4px solid rgba(255,255,255,.35); margin-bottom: 1.25rem; display: block; }',
    '.akce { display: flex; flex-wrap: wrap; gap: .7rem; margin: 1.6rem 0 0; }',
    '.tlacitko { display: inline-block; background: #fff; color: ' + p.akcent + ';',
    '  padding: .7rem 1.3rem; border-radius: 999px; text-decoration: none;',
    '  font-weight: 600; border: 2px solid #fff; }',
    '.tlacitko-obrys { background: transparent; color: #fff; }',
    '',
    'main { padding: 2.75rem 0 1rem; }',
    'section { margin: 0 0 2.75rem; }',
    'section h2 { font-size: 1.4rem; color: ' + p.akcent + '; }',
    '',
    '.sluzby { list-style: none; padding: 0; margin: 0; display: grid;',
    '  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: .5rem 1.5rem; }',
    '.sluzby li { padding: .45rem 0 .45rem 1.6rem; position: relative;',
    '  border-bottom: 1px solid ' + p.linka + '; }',
    '.sluzby li::before { content: "✓"; position: absolute; left: 0;',
    '  color: ' + p.akcent + '; font-weight: 700; }',
    '',
    '.galerie { display: grid; grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));',
    '  gap: .75rem; }',
    '.snimek { padding: 0; border: 0; background: none; cursor: zoom-in; display: block;',
    '  text-align: left; font: inherit; color: inherit; }',
    '.snimek img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; display: block;',
    '  border-radius: 6px; background: ' + p.linka + '; }',
    '.snimek figcaption { font-size: .87rem; color: ' + p.tmava + '; opacity: .75;',
    '  padding: .35rem .1rem 0; }',
    '',
    '#lupa { position: fixed; inset: 0; background: rgba(0,0,0,.88); z-index: 50;',
    '  display: flex; flex-direction: column; align-items: center;',
    '  justify-content: center; padding: 1.5rem; }',
    '#lupa[hidden] { display: none; }',
    '#lupa img { max-width: 100%; max-height: 78vh; object-fit: contain; border-radius: 4px; }',
    '#lupa-popis { color: #fff; margin: .9rem 0 0; text-align: center; }',
    '#lupa-zavrit { position: absolute; top: 1rem; right: 1rem; background: #fff;',
    '  border: 0; border-radius: 999px; width: 2.6rem; height: 2.6rem;',
    '  font-size: 1.3rem; cursor: pointer; line-height: 1; }',
    '',
    '.poptavka { background: #fff; border: 1px solid ' + p.linka + '; border-radius: 10px;',
    '  padding: 1.5rem; }',
    '.poptavka label { display: block; font-weight: 600; font-size: .92rem;',
    '  margin: 0 0 .3rem; }',
    '.poptavka input, .poptavka textarea { width: 100%; padding: .6rem .7rem;',
    '  border: 1px solid ' + p.linka + '; border-radius: 6px; font: inherit;',
    '  margin: 0 0 1rem; background: ' + p.papir + '; color: inherit; }',
    '.poptavka textarea { min-height: 7rem; resize: vertical; }',
    '.poptavka button { background: ' + p.akcent + '; color: #fff; border: 0;',
    '  padding: .75rem 1.4rem; border-radius: 999px; font: inherit; font-weight: 600;',
    '  cursor: pointer; }',
    '.poptavka .druhotne { background: transparent; color: ' + p.akcent + ';',
    '  border: 2px solid ' + p.linka + '; }',
    '.dvojice { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));',
    '  gap: 0 1rem; }',
    '.jak-to-chodi { font-size: .9rem; opacity: .8; }',
    '#p-nahrada { margin-top: 1.2rem; border-top: 1px dashed ' + p.linka + ';',
    '  padding-top: 1rem; font-size: .92rem; }',
    '#p-nahrada[hidden] { display: none; }',
    '',
    '.kontakt-radky { margin: 0; }',
    '.kontakt-radky > div { display: flex; flex-wrap: wrap; gap: .3rem 1rem;',
    '  padding: .55rem 0; border-bottom: 1px solid ' + p.linka + '; }',
    '.kontakt-radky dt { font-weight: 600; min-width: 9rem; margin: 0; }',
    '.kontakt-radky dd { margin: 0; }',
    '',
    'footer { border-top: 1px solid ' + p.linka + '; margin-top: 1rem;',
    '  padding: 1.5rem 0 2.5rem; font-size: .87rem; opacity: .78; }',
    'footer p { margin: 0 0 .4em; }',
    '',
    '@media (max-width: 30rem) {',
    '  body { font-size: 16px; }',
    '  .hlava { padding: 2.25rem 0 2rem; }',
    '  .kontakt-radky dt { min-width: 100%; }',
    '}'
  ].join('\n');
}

function sestavVizitku(stav) {
  var p = PALETY[stav.akcent] || PALETY.drevo;

  var jmeno = jeVyplneno(stav.jmeno) ? stav.jmeno.trim() : 'Vaše jméno';
  var obor = (stav.obor || '').trim();
  var mesto = (stav.mesto || '').trim();
  var telefon = (stav.telefon || '').trim();
  var email = (stav.email || '').trim();
  var fotky = Array.isArray(stav.fotky) ? stav.fotky : [];
  var sluzby = (Array.isArray(stav.sluzby) ? stav.sluzby : []).filter(jeVyplneno);

  var nadobor = [obor, mesto].filter(jeVyplneno).join(' · ');
  var titulek = [jmeno, nadobor].filter(jeVyplneno).join(' — ');

  var portret = null;
  if (stav.profil !== null && stav.profil !== undefined && fotky[stav.profil]) {
    portret = fotky[stav.profil].src;
  }

  var d = [];
  d.push('<!doctype html>');
  d.push('<html lang="cs">');
  d.push('<head>');
  d.push('<meta charset="utf-8">');
  d.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
  d.push('<title>' + escHtml(titulek) + '</title>');
  if (jeVyplneno(stav.slogan)) {
    d.push('<meta name="description" content="' + escHtml(stav.slogan.trim()) + '">');
  }
  d.push('<style>');
  d.push(stylVizitky(p));
  d.push('</style>');
  d.push('</head>');
  d.push('<body>');

  /* Hlavička */
  d.push('<header class="hlava">');
  d.push('  <div class="obal">');
  if (portret) {
    d.push('    <img class="portret" src="' + escHtml(portret) + '" alt="' + escHtml(jmeno) + '">');
  }
  if (jeVyplneno(nadobor)) d.push('    <p class="nadobor">' + escHtml(nadobor) + '</p>');
  d.push('    <h1>' + escHtml(jmeno) + '</h1>');
  if (jeVyplneno(stav.slogan)) {
    d.push('    <p class="slogan">' + escHtml(stav.slogan.trim()) + '</p>');
  }
  var akce = [];
  akce.push('<a class="tlacitko" href="#poptavka-sekce">Nezávazná poptávka</a>');
  if (jeVyplneno(telefon)) {
    akce.push('<a class="tlacitko tlacitko-obrys" href="tel:' + escHtml(cisloProOdkaz(telefon))
      + '">Zavolat ' + escHtml(telefon) + '</a>');
  }
  d.push('    <p class="akce">' + akce.join(' ') + '</p>');
  d.push('  </div>');
  d.push('</header>');

  d.push('<main class="obal">');

  /* O mně */
  if (jeVyplneno(stav.popis)) {
    d.push('  <section>');
    d.push('    <h2>O mně</h2>');
    d.push('      ' + naOdstavce(stav.popis));
    d.push('  </section>');
  }

  /* Služby */
  if (sluzby.length) {
    d.push('  <section>');
    d.push('    <h2>Co dělám</h2>');
    d.push('    <ul class="sluzby">');
    sluzby.forEach(function (s) {
      d.push('      <li>' + escHtml(s.trim()) + '</li>');
    });
    d.push('    </ul>');
    d.push('  </section>');
  }

  /* Galerie */
  if (fotky.length) {
    d.push('  <section>');
    d.push('    <h2>Realizace</h2>');
    d.push('    <div class="galerie" id="galerie">');
    fotky.forEach(function (foto, i) {
      var popis = jeVyplneno(foto.popis) ? foto.popis.trim() : '';
      var alt = popis || ('Ukázka práce ' + (i + 1));
      d.push('      <figure style="margin:0">');
      d.push('        <button type="button" class="snimek" data-popis="' + escHtml(popis)
        + '" aria-label="Zvětšit: ' + escHtml(alt) + '">');
      d.push('          <img src="' + escHtml(foto.src) + '" alt="' + escHtml(alt)
        + '" loading="lazy">');
      d.push('        </button>');
      if (popis) d.push('        <figcaption>' + escHtml(popis) + '</figcaption>');
      d.push('      </figure>');
    });
    d.push('    </div>');
    d.push('  </section>');
  }

  /* Poptávka */
  d.push('  <section id="poptavka-sekce">');
  d.push('    <h2>Nezávazná poptávka</h2>');
  d.push('    <p class="jak-to-chodi">Napište mi, co potřebujete. Formulář nikam nic'
    + ' neodesílá — tlačítko jen otevře váš e-mail nebo SMS s předvyplněnou zprávou,'
    + ' kterou si před odesláním můžete upravit.</p>');
  d.push('    <form class="poptavka" id="poptavka" data-telefon="'
    + escHtml(cisloProOdkaz(telefon)) + '" data-email="' + escHtml(email) + '">');
  d.push('      <div class="dvojice">');
  d.push('        <div><label for="p-jmeno">Vaše jméno</label>'
    + '<input id="p-jmeno" name="jmeno" type="text" autocomplete="name"></div>');
  d.push('        <div><label for="p-telefon">Telefon</label>'
    + '<input id="p-telefon" name="telefon" type="tel" autocomplete="tel"></div>');
  d.push('      </div>');
  d.push('      <label for="p-email">Váš e-mail</label>'
    + '<input id="p-email" name="email" type="email" autocomplete="email">');
  d.push('      <label for="p-text">Co potřebujete udělat?</label>'
    + '<textarea id="p-text" name="text"></textarea>');
  var tlacitka = [];
  if (jeVyplneno(email)) {
    tlacitka.push('<button type="button" id="p-mail">Odeslat e-mailem</button>');
  }
  if (jeVyplneno(telefon)) {
    tlacitka.push('<button type="button" class="druhotne" id="p-sms">Poslat SMS</button>');
    tlacitka.push('<a class="tlacitko" style="background:transparent;border-color:'
      + p.linka + ';color:' + p.akcent + '" href="tel:' + escHtml(cisloProOdkaz(telefon))
      + '">Zavolat</a>');
  }
  if (!tlacitka.length) {
    tlacitka.push('<button type="button" class="druhotne" id="p-zkopirovat-prazdny" disabled>'
      + 'Doplňte telefon nebo e-mail</button>');
  }
  d.push('      <p class="akce">' + tlacitka.join(' ') + '</p>');
  d.push('      <div id="p-nahrada" hidden>');
  d.push('        <p>Neotevřel se vám e-mail ani zprávy? Zkopírujte si text'
    + ' a pošlete ho, jak jste zvyklí.</p>');
  d.push('        <textarea id="p-opis" readonly rows="6"></textarea>');
  d.push('        <button type="button" class="druhotne" id="p-zkopirovat">'
    + 'Zkopírovat text</button>');
  d.push('      </div>');
  d.push('    </form>');
  d.push('  </section>');

  /* Kontakt */
  var radky = [];
  if (jeVyplneno(telefon)) {
    radky.push(['Telefon', '<a href="tel:' + escHtml(cisloProOdkaz(telefon)) + '">'
      + escHtml(telefon) + '</a>']);
  }
  if (jeVyplneno(email)) {
    radky.push(['E-mail', '<a href="mailto:' + escHtml(email) + '">' + escHtml(email) + '</a>']);
  }
  if (jeVyplneno(stav.oblast)) radky.push(['Kde pracuji', escHtml(stav.oblast.trim())]);
  if (jeVyplneno(stav.hodiny)) radky.push(['Kdy mě zastihnete', escHtml(stav.hodiny.trim())]);
  if (jeVyplneno(stav.ico)) radky.push(['IČO', escHtml(stav.ico.trim())]);
  if (radky.length) {
    d.push('  <section>');
    d.push('    <h2>Kontakt</h2>');
    d.push('    <dl class="kontakt-radky">');
    radky.forEach(function (r) {
      d.push('      <div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>');
    });
    d.push('    </dl>');
    d.push('  </section>');
  }

  d.push('</main>');

  d.push('<footer class="obal">');
  d.push('  <p>' + escHtml(jmeno) + (jeVyplneno(stav.ico)
    ? ', IČO ' + escHtml(stav.ico.trim()) : '') + '</p>');
  d.push('  <p>Tato stránka neukládá žádné údaje a neodesílá je na server.'
    + ' Poptávkový formulář jen předvyplní zprávu ve vašem e-mailu nebo SMS.</p>');
  if (stav.podpis !== false) {
    d.push('  <p>Vizitku jsem si vyrobil nástrojem SimteGen.</p>');
  }
  d.push('</footer>');

  if (fotky.length) {
    d.push('<div id="lupa" hidden>');
    d.push('  <button type="button" id="lupa-zavrit" aria-label="Zavřít náhled">×</button>');
    d.push('  <img id="lupa-obr" src="" alt="">');
    d.push('  <p id="lupa-popis"></p>');
    d.push('</div>');
  }

  d.push('<script>');
  d.push(SKRIPT_VIZITKY);
  d.push('<\/script>');

  /* Uložený stav pro pozdější úpravy. Ostré závorky se escapují, aby text
     uživatele nemohl blok předčasně ukončit. Fotky se sem schválně
     nekopírují — už jsou v galerii výš a druhá kopie by soubor zbytečně
     zdvojnásobila; nástroj si je při načtení vytáhne odtamtud. */
  d.push('<script type="application/json" id="vizitka-data">'
    + JSON.stringify(stavProUlozeni(stav)).replace(/</g, '\\u003c')
    + '<\/script>');

  d.push('</body>');
  d.push('</html>');
  d.push('');

  return d.join('\n');
}

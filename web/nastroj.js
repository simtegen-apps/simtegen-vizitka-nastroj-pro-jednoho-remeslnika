/* Obsluha nástroje: formulář, fotky, náhled, stažení a načtení zpátky.
 *
 * Celý obsah vizitky drží jediný objekt `stav`. Náhled i stažený soubor
 * z něj vyrábí sestavVizitku() ze sablona-vizitky.js — jedna cesta, aby
 * se náhled nemohl rozejít s tím, co si řemeslník odnese.
 *
 * Nic se nikam neukládá. Stažený soubor si stav nese v sobě, takže se dá
 * vrátit sem a pokračovat v úpravách; to je jediná paměť, kterou produkt
 * má, a je celá v rukou zákazníka.
 */
(function () {
  'use strict';

  var MAX_FOTEK = 10;
  var MAX_HRANA = 1400;
  var KVALITA = 0.72;
  var VARUJ_NAD = 4 * 1024 * 1024;
  var PRODLEVA = 150;

  var NAZVY_BAREV = { drevo: 'Dřevo', voda: 'Voda', les: 'Les', uhel: 'Uhel' };

  function prazdnyStav() {
    return {
      jmeno: '', obor: '', mesto: '', slogan: '', popis: '',
      sluzby: ['', '', ''],
      fotky: [], profil: null,
      telefon: '', email: '', oblast: '', hodiny: '', ico: '',
      akcent: 'drevo', podpis: true, adresa: ''
    };
  }

  var stav = prazdnyStav();
  var zmeneno = false;
  var qrSvgText = null;
  var casovac = null;

  var formular = document.getElementById('formular');
  var nahled = document.getElementById('nahled');
  var velikostEl = document.getElementById('velikost');
  var hlaskaEl = document.getElementById('hlaska');
  var sluzbySeznam = document.getElementById('sluzby-seznam');
  var fotkySeznam = document.getElementById('fotky-seznam');
  var fotkyVstup = document.getElementById('fotky-vstup');
  var importVstup = document.getElementById('import-vstup');
  var barvyEl = document.getElementById('barvy');
  var qrRamecek = document.getElementById('qr-ramecek');
  var qrAkce = document.getElementById('qr-akce');
  var qrHlaska = document.getElementById('qr-hlaska');
  var tiskList = document.getElementById('tisk-list');

  /* --- drobnosti ---------------------------------------------------- */

  function hlaska(text, spatne) {
    hlaskaEl.textContent = text;
    hlaskaEl.classList.toggle('spatne', !!spatne);
    hlaskaEl.hidden = false;
  }

  function oznacZmenu() { zmeneno = true; }

  function formatBajtu(b) {
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return Math.round(b / 1024) + ' kB';
    return (b / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB';
  }

  function tlacitko(popisek, akce, index, titulek, vypnuto) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'drobne';
    b.textContent = popisek;
    b.setAttribute('data-akce', akce);
    b.setAttribute('data-index', String(index));
    b.title = titulek;
    b.setAttribute('aria-label', titulek);
    if (vypnuto) b.disabled = true;
    return b;
  }

  /* --- náhled ------------------------------------------------------- */

  function naplanuj() {
    if (casovac) clearTimeout(casovac);
    casovac = setTimeout(prekresli, PRODLEVA);
  }

  function prekresli() {
    casovac = null;
    var html = sestavVizitku(stav);
    nahled.srcdoc = html;
    var bajtu = new Blob([html]).size;
    var moc = bajtu > VARUJ_NAD;
    velikostEl.textContent = 'Výsledný soubor: ' + formatBajtu(bajtu)
      + (moc ? ' — to je hodně, uberte nebo zmenšete fotky' : '');
    velikostEl.classList.toggle('moc', moc);
  }

  /* --- formulář ----------------------------------------------------- */

  function vykresliBarvy() {
    barvyEl.textContent = '';
    Object.keys(PALETY).forEach(function (klic) {
      var obal = document.createElement('label');
      obal.className = 'barva';
      var vstup = document.createElement('input');
      vstup.type = 'radio';
      vstup.name = 'akcent';
      vstup.value = klic;
      vstup.setAttribute('data-pole', 'akcent');
      vstup.checked = stav.akcent === klic;
      var text = document.createElement('span');
      var puntik = document.createElement('i');
      puntik.style.background = PALETY[klic].akcent;
      text.appendChild(puntik);
      text.appendChild(document.createTextNode(NAZVY_BAREV[klic] || klic));
      obal.appendChild(vstup);
      obal.appendChild(text);
      barvyEl.appendChild(obal);
    });
  }

  function vykresliSluzby() {
    sluzbySeznam.textContent = '';
    stav.sluzby.forEach(function (sluzba, i) {
      var radek = document.createElement('div');
      radek.className = 'radek';
      var vstup = document.createElement('input');
      vstup.type = 'text';
      vstup.value = sluzba;
      vstup.placeholder = 'Například: kuchyně na míru';
      vstup.setAttribute('data-sluzba', String(i));
      vstup.setAttribute('aria-label', 'Služba ' + (i + 1));
      radek.appendChild(vstup);
      radek.appendChild(tlacitko('↑', 'sluzba-nahoru', i, 'Posunout výš', i === 0));
      radek.appendChild(tlacitko('↓', 'sluzba-dolu', i, 'Posunout níž',
        i === stav.sluzby.length - 1));
      radek.appendChild(tlacitko('×', 'sluzba-smazat', i, 'Odebrat službu'));
      sluzbySeznam.appendChild(radek);
    });
  }

  function vykresliFotky() {
    fotkySeznam.textContent = '';
    stav.fotky.forEach(function (foto, i) {
      var polozka = document.createElement('li');
      polozka.className = 'fotka';

      var obrazek = document.createElement('img');
      obrazek.src = foto.src;
      obrazek.alt = 'Náhled fotky ' + (i + 1);
      polozka.appendChild(obrazek);

      var vpravo = document.createElement('div');
      var popis = document.createElement('input');
      popis.type = 'text';
      popis.value = foto.popis || '';
      popis.placeholder = 'Popisek — co je na fotce';
      popis.setAttribute('data-foto-popis', String(i));
      popis.setAttribute('aria-label', 'Popisek fotky ' + (i + 1));
      vpravo.appendChild(popis);

      var akce = document.createElement('div');
      akce.className = 'fotka-akce';
      akce.appendChild(tlacitko('↑', 'foto-nahoru', i, 'Posunout výš', i === 0));
      akce.appendChild(tlacitko('↓', 'foto-dolu', i, 'Posunout níž',
        i === stav.fotky.length - 1));
      akce.appendChild(tlacitko('×', 'foto-smazat', i, 'Odebrat fotku'));

      var profil = document.createElement('button');
      profil.type = 'button';
      profil.className = 'tlac tlac-male';
      profil.setAttribute('data-akce', 'foto-profil');
      profil.setAttribute('data-index', String(i));
      profil.setAttribute('aria-pressed', stav.profil === i ? 'true' : 'false');
      profil.textContent = stav.profil === i ? 'V hlavičce ✓' : 'Dát do hlavičky';
      akce.appendChild(profil);

      vpravo.appendChild(akce);
      polozka.appendChild(vpravo);
      fotkySeznam.appendChild(polozka);
    });
  }

  function naplnFormular() {
    var pole = formular.querySelectorAll('[data-pole]');
    for (var i = 0; i < pole.length; i++) {
      var prvek = pole[i];
      var klic = prvek.getAttribute('data-pole');
      if (prvek.type === 'checkbox') prvek.checked = !!stav[klic];
      else if (prvek.type === 'radio') prvek.checked = stav[klic] === prvek.value;
      else prvek.value = stav[klic] === undefined ? '' : stav[klic];
    }
    vykresliSluzby();
    vykresliFotky();
    vykresliQr();
  }

  function vykresliVse() {
    vykresliBarvy();
    naplnFormular();
    prekresli();
  }

  /* --- přepínání pořadí --------------------------------------------- */

  function prohod(pole, i, j) {
    var pomocna = pole[i];
    pole[i] = pole[j];
    pole[j] = pomocna;
  }

  function presunFotku(i, j) {
    prohod(stav.fotky, i, j);
    if (stav.profil === i) stav.profil = j;
    else if (stav.profil === j) stav.profil = i;
  }

  function smazFotku(i) {
    stav.fotky.splice(i, 1);
    if (stav.profil === i) stav.profil = null;
    else if (stav.profil !== null && stav.profil > i) stav.profil -= 1;
  }

  /* --- fotky -------------------------------------------------------- */

  function zmensiFotku(soubor) {
    return new Promise(function (hotovo, selhalo) {
      var ctecka = new FileReader();
      ctecka.onerror = function () { selhalo(new Error('nelze precist')); };
      ctecka.onload = function () {
        var obrazek = new Image();
        obrazek.onerror = function () { selhalo(new Error('nelze dekodovat')); };
        obrazek.onload = function () {
          var w = obrazek.naturalWidth, h = obrazek.naturalHeight;
          if (!w || !h) { selhalo(new Error('prazdny obrazek')); return; }
          var pomer = Math.max(w, h) > MAX_HRANA ? MAX_HRANA / Math.max(w, h) : 1;
          var platno = document.createElement('canvas');
          platno.width = Math.max(1, Math.round(w * pomer));
          platno.height = Math.max(1, Math.round(h * pomer));
          var ctx = platno.getContext('2d');
          ctx.drawImage(obrazek, 0, 0, platno.width, platno.height);
          try {
            hotovo(platno.toDataURL('image/jpeg', KVALITA));
          } catch (chyba) {
            selhalo(chyba);
          }
        };
        obrazek.src = ctecka.result;
      };
      ctecka.readAsDataURL(soubor);
    });
  }

  fotkyVstup.addEventListener('change', function () {
    var soubory = Array.prototype.slice.call(fotkyVstup.files);
    fotkyVstup.value = '';
    if (!soubory.length) return;

    var volno = MAX_FOTEK - stav.fotky.length;
    var pres = 0;
    if (soubory.length > volno) {
      pres = soubory.length - volno;
      soubory = soubory.slice(0, Math.max(0, volno));
    }
    if (!soubory.length) {
      hlaska('Víc než ' + MAX_FOTEK + ' fotek vizitka nepobere. Nějakou nejdřív odeberte.', true);
      return;
    }

    hlaska('Zpracovávám fotky…');
    var nepovedene = [];
    Promise.all(soubory.map(function (soubor) {
      return zmensiFotku(soubor).then(
        function (src) { return { src: src, popis: '' }; },
        function () { nepovedene.push(soubor.name); return null; }
      );
    })).then(function (vysledky) {
      vysledky.forEach(function (f) { if (f) stav.fotky.push(f); });
      oznacZmenu();
      vykresliFotky();
      prekresli();

      var zpravy = [];
      var pridano = vysledky.filter(Boolean).length;
      if (pridano) zpravy.push('Přidáno fotek: ' + pridano + '.');
      if (pres) zpravy.push('Nad limit ' + MAX_FOTEK + ' fotek jsem jich ' + pres + ' vynechal.');
      if (nepovedene.length) {
        zpravy.push('Nepovedlo se načíst: ' + nepovedene.join(', ')
          + '. Bývá to formátem HEIC z iPhonu — uložte fotku jako JPEG a zkuste to znovu.');
      }
      hlaska(zpravy.join(' '), nepovedene.length > 0);
    });
  });

  /* --- QR ----------------------------------------------------------- */

  function vykresliQr() {
    var adresa = (stav.adresa || '').trim();
    qrHlaska.hidden = true;
    qrSvgText = null;
    if (!adresa) {
      qrRamecek.hidden = true;
      qrAkce.hidden = true;
      qrRamecek.textContent = '';
      return;
    }
    var svg = QR.svg(adresa, { okraj: 4 });
    if (!svg) {
      qrRamecek.hidden = true;
      qrAkce.hidden = true;
      qrRamecek.textContent = '';
      qrHlaska.hidden = false;
      qrHlaska.textContent = 'Tahle adresa je na QR kód moc dlouhá (vejde se nejvýš '
        + QR.maxBajtu + ' znaků). Zkuste kratší adresu.';
      return;
    }
    qrSvgText = svg;
    qrRamecek.innerHTML = svg;
    qrRamecek.hidden = false;
    qrAkce.hidden = false;
  }

  function stahniBlob(blob, nazev) {
    var url = URL.createObjectURL(blob);
    var odkaz = document.createElement('a');
    odkaz.href = url;
    odkaz.download = nazev;
    document.body.appendChild(odkaz);
    odkaz.click();
    document.body.removeChild(odkaz);
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  }

  function stahniText(obsah, nazev, typ) {
    stahniBlob(new Blob([obsah], { type: typ }), nazev);
  }

  document.getElementById('qr-svg').addEventListener('click', function () {
    if (qrSvgText) stahniText(qrSvgText, 'qr-vizitka.svg', 'image/svg+xml;charset=utf-8');
  });

  document.getElementById('qr-png').addEventListener('click', function () {
    var m = QR.matice((stav.adresa || '').trim());
    if (!m) return;
    var okraj = 4, modul = 12, n = m.length, s = (n + okraj * 2) * modul;
    var platno = document.createElement('canvas');
    platno.width = s;
    platno.height = s;
    var ctx = platno.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#000000';
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        if (m[y][x]) ctx.fillRect((x + okraj) * modul, (y + okraj) * modul, modul, modul);
      }
    }
    platno.toBlob(function (blob) {
      if (blob) stahniBlob(blob, 'qr-vizitka.png');
      else hlaska('PNG se nepodařilo vytvořit. Zkuste stáhnout SVG.', true);
    }, 'image/png');
  });

  document.getElementById('qr-tisk').addEventListener('click', function () {
    if (!qrSvgText) return;
    tiskList.textContent = '';
    var obal = document.createElement('div');
    obal.innerHTML = qrSvgText;
    if (obal.firstChild) tiskList.appendChild(obal.firstChild);
    if (stav.jmeno.trim()) {
      var nadpis = document.createElement('h2');
      nadpis.textContent = stav.jmeno.trim();
      tiskList.appendChild(nadpis);
    }
    [stav.obor, stav.telefon, stav.adresa].forEach(function (radek) {
      if (!radek || !radek.trim()) return;
      var p = document.createElement('p');
      p.textContent = radek.trim();
      tiskList.appendChild(p);
    });
    window.print();
  });

  /* --- stažení a načtení -------------------------------------------- */

  document.getElementById('stahnout').addEventListener('click', function () {
    if (casovac) { clearTimeout(casovac); prekresli(); }
    var nazev = 'vizitka.html';
    stahniText(sestavVizitku(stav), nazev, 'text/html;charset=utf-8');
    zmeneno = false;
    hlaska('Stáhl jsem ' + nazev + '. Otevřete si ho dvojklikem a zkontrolujte —'
      + ' vypadá přesně jako náhled. Tenhle soubor si schovejte: až budete chtít'
      + ' něco změnit, načtete ho sem zpátky tlačítkem „Načíst rozpracovanou“.'
      + ' Pokud se nic nestáhlo, zkontrolujte, jestli prohlížeč nezablokoval stahování.');
  });

  document.getElementById('nacist').addEventListener('click', function () {
    importVstup.click();
  });

  function slucStav(vstup) {
    var vysledek = prazdnyStav();
    Object.keys(vysledek).forEach(function (klic) {
      if (vstup[klic] !== undefined && vstup[klic] !== null) vysledek[klic] = vstup[klic];
    });
    if (!Array.isArray(vysledek.sluzby)) vysledek.sluzby = [];
    vysledek.sluzby = vysledek.sluzby.map(function (s) { return typeof s === 'string' ? s : ''; });
    if (!vysledek.sluzby.length) vysledek.sluzby = [''];
    if (!Array.isArray(vysledek.fotky)) vysledek.fotky = [];
    vysledek.fotky = vysledek.fotky
      .filter(function (f) { return f && typeof f.src === 'string'; })
      .slice(0, MAX_FOTEK)
      .map(function (f) { return { src: f.src, popis: typeof f.popis === 'string' ? f.popis : '' }; });
    if (typeof vysledek.profil !== 'number' || !vysledek.fotky[vysledek.profil]) {
      vysledek.profil = null;
    }
    if (!PALETY[vysledek.akcent]) vysledek.akcent = 'drevo';
    vysledek.podpis = vysledek.podpis !== false;
    ['jmeno', 'obor', 'mesto', 'slogan', 'popis', 'telefon', 'email',
     'oblast', 'hodiny', 'ico', 'adresa'].forEach(function (klic) {
      if (typeof vysledek[klic] !== 'string') vysledek[klic] = '';
    });
    return vysledek;
  }

  /* Obrázková data nejsou ve vloženém JSON, ale v galerii dokumentu.
     Vytáhneme je odtamtud a spárujeme s popisky podle pořadí. */
  function fotkyZDokumentu(html) {
    var galerie = /<div class="galerie" id="galerie">([\s\S]*?)<\/div>/.exec(html);
    if (!galerie) return [];
    var nalezene = [];
    var vzor = /<img src="(data:[^"]+)"/g;
    var shoda;
    while ((shoda = vzor.exec(galerie[1])) !== null) nalezene.push(shoda[1]);
    return nalezene;
  }

  importVstup.addEventListener('change', function () {
    var soubor = importVstup.files[0];
    importVstup.value = '';
    if (!soubor) return;
    var ctecka = new FileReader();
    ctecka.onerror = function () {
      hlaska('Soubor se nepodařilo přečíst.', true);
    };
    ctecka.onload = function () {
      var html = String(ctecka.result);
      var shoda = /<script type="application\/json" id="vizitka-data">([\s\S]*?)<\/script>/
        .exec(html);
      if (!shoda) {
        hlaska('V tomhle souboru nejsou uložená data vizitky. Načtěte prosím'
          + ' soubor vizitka.html, který jste si stáhli tímhle nástrojem.', true);
        return;
      }
      var nacteny;
      try {
        nacteny = JSON.parse(shoda[1]);
      } catch (chyba) {
        hlaska('Data ve vizitce jsou poškozená a nejde je načíst.', true);
        return;
      }

      var obrazky = fotkyZDokumentu(html);
      var popisky = Array.isArray(nacteny.fotky) ? nacteny.fotky : [];
      var chybejici = 0;
      nacteny.fotky = popisky.map(function (foto, i) {
        // Starší nebo ručně upravený soubor může mít obrázek i v JSON.
        var src = (foto && typeof foto.src === 'string') ? foto.src : obrazky[i];
        if (typeof src !== 'string') { chybejici += 1; return null; }
        return { src: src, popis: (foto && foto.popis) || '' };
      }).filter(Boolean);
      // Vypadlé fotky posunou pořadí, takže volba portrétu už nemusí sedět.
      if (chybejici) nacteny.profil = null;

      stav = slucStav(nacteny);
      zmeneno = false;
      vykresliVse();
      hlaska(chybejici
        ? 'Vizitka načtena, ale ' + chybejici + ' fotek se v souboru nepodařilo najít.'
          + ' Nahrajte je prosím znovu.'
        : 'Vizitka načtena. Můžete pokračovat v úpravách.', chybejici > 0);
    };
    ctecka.readAsText(soubor, 'utf-8');
  });

  /* --- ukázka a vyčištění ------------------------------------------- */

  function ukazkovaFotka(barva, popisek) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">'
      + '<rect width="800" height="600" fill="' + barva + '"/>'
      + '<text x="400" y="318" font-family="sans-serif" font-size="44"'
      + ' fill="#ffffff" text-anchor="middle">' + popisek + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function ukazkovyStav() {
    return {
      jmeno: 'Truhlářství Novák',
      obor: 'Truhlář',
      mesto: 'Zlín',
      slogan: 'Kuchyně, vestavěné skříně a schodiště na míru — od návrhu po montáž.',
      popis: 'Truhlařině se věnuju od vyučení, letos je to sedmnáct let. Dělám sám,'
        + ' takže se domluvíte přímo s tím, kdo vám zakázku i vyrobí a namontuje.\n\n'
        + 'Pracuju hlavně s masivem a kvalitními deskami. Na zaměření přijedu'
        + ' zdarma a návrh dostanete do týdne.',
      sluzby: ['Kuchyně na míru', 'Vestavěné skříně', 'Schodiště a zábradlí',
               'Dřevěné terasy a pergoly', 'Renovace starého nábytku'],
      fotky: [
        { src: ukazkovaFotka('#7a5230', 'Kuchyně, dub'), popis: 'Kuchyně z dubového masivu, Zlín' },
        { src: ukazkovaFotka('#8a6a45', 'Vestavěná skříň'), popis: 'Vestavěná skříň do podkroví' },
        { src: ukazkovaFotka('#5d3d22', 'Schodiště'), popis: 'Schodiště s ocelovým zábradlím' }
      ],
      profil: null,
      telefon: '+420 601 234 567',
      email: 'novak@example.cz',
      oblast: 'Zlín a okolí do 40 km',
      hodiny: 'Po–Pá 7:00–17:00, o víkendu po domluvě',
      ico: '12345678',
      akcent: 'drevo',
      podpis: true,
      adresa: 'https://truhlarstvi-novak.pages.dev'
    };
  }

  document.getElementById('ukazka').addEventListener('click', function () {
    stav = slucStav(ukazkovyStav());
    oznacZmenu();
    vykresliVse();
    hlaska('Vyplnil jsem ukázku. Přepište v ní cokoli svým — nic z toho'
      + ' se nikam neodesílá.');
  });

  document.getElementById('vycistit').addEventListener('click', function () {
    if (!window.confirm('Opravdu vymazat všechno, co je vyplněné? Vrátit to nepůjde.')) return;
    stav = prazdnyStav();
    zmeneno = false;
    vykresliVse();
    hlaska('Vymazáno.');
  });

  /* --- reakce na vstupy --------------------------------------------- */

  // Formulář nikam neodesílá — Enter v poli nesmí odnavigovat ze stránky.
  formular.addEventListener('submit', function (e) { e.preventDefault(); });

  formular.addEventListener('input', function (e) {
    var cil = e.target;

    var klic = cil.getAttribute('data-pole');
    if (klic) {
      stav[klic] = cil.type === 'checkbox' ? cil.checked : cil.value;
      oznacZmenu();
      if (klic === 'adresa') vykresliQr();
      naplanuj();
      return;
    }

    var iSluzba = cil.getAttribute('data-sluzba');
    if (iSluzba !== null) {
      stav.sluzby[Number(iSluzba)] = cil.value;
      oznacZmenu();
      naplanuj();
      return;
    }

    var iFoto = cil.getAttribute('data-foto-popis');
    if (iFoto !== null) {
      stav.fotky[Number(iFoto)].popis = cil.value;
      oznacZmenu();
      naplanuj();
    }
  });

  formular.addEventListener('click', function (e) {
    var tlac = e.target.closest('button[data-akce]');
    if (!tlac) return;
    var akce = tlac.getAttribute('data-akce');
    var i = Number(tlac.getAttribute('data-index'));

    if (akce === 'sluzba-nahoru') prohod(stav.sluzby, i, i - 1);
    else if (akce === 'sluzba-dolu') prohod(stav.sluzby, i, i + 1);
    else if (akce === 'sluzba-smazat') stav.sluzby.splice(i, 1);
    else if (akce === 'foto-nahoru') presunFotku(i, i - 1);
    else if (akce === 'foto-dolu') presunFotku(i, i + 1);
    else if (akce === 'foto-smazat') smazFotku(i);
    else if (akce === 'foto-profil') stav.profil = stav.profil === i ? null : i;
    else return;

    oznacZmenu();
    if (akce.indexOf('sluzba') === 0) vykresliSluzby();
    else vykresliFotky();
    prekresli();
  });

  document.getElementById('pridat-sluzbu').addEventListener('click', function () {
    stav.sluzby.push('');
    oznacZmenu();
    vykresliSluzby();
    var pole = sluzbySeznam.querySelectorAll('input[data-sluzba]');
    if (pole.length) pole[pole.length - 1].focus();
    naplanuj();
  });

  window.addEventListener('beforeunload', function (e) {
    if (!zmeneno) return;
    e.preventDefault();
    e.returnValue = '';
  });

  vykresliVse();
})();

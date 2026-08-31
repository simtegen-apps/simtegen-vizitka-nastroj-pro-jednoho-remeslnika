/* Generátor QR kódů.
 *
 * Vlastní implementace, protože stránka nesmí nic tahat zvenčí — hotový
 * generátor by znamenal obrázek z cizího serveru a rozešel by se
 * s data-manifest.json.
 *
 * Rozsah je schválně úzký, aby se to dalo přečíst a ověřit: režim bajtů
 * (text se kóduje jako UTF-8), korekce chyb úrovně M, verze 1 až 10, což
 * je 213 bajtů. Adresa vizitky se do toho vejde s velkou rezervou.
 *
 * Tabulky jsou jen dvě — počet opravných slov na blok a počet bloků.
 * Všechno ostatní (velikost, kapacita, pozice zarovnávacích značek)
 * se dopočítává, aby v tom nebylo co překlepnout.
 */
var QR = (function () {
  'use strict';

  var MAX_VERZE = 10;
  var EC_NA_BLOK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
  var BLOKU      = [0,  1,  1,  1,  2,  2,  4,  4,  4,  5,  5];

  /* --- rozměry a kapacity ------------------------------------------- */

  function datovychModulu(v) {
    var r = (16 * v + 128) * v + 64;
    if (v >= 2) {
      var n = Math.floor(v / 7) + 2;
      r -= (25 * n - 10) * n - 55;
      if (v >= 7) r -= 36;
    }
    return r;
  }

  function surovychSlov(v) {
    return Math.floor(datovychModulu(v) / 8);
  }

  function datovychSlov(v) {
    return surovychSlov(v) - EC_NA_BLOK[v] * BLOKU[v];
  }

  function poziceZarovnani(v) {
    if (v === 1) return [];
    var n = Math.floor(v / 7) + 2;
    var krok = Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
    var vysledek = [6];
    for (var p = v * 4 + 10; vysledek.length < n; p -= krok) vysledek.splice(1, 0, p);
    return vysledek;
  }

  /* --- aritmetika v Galoisově tělese GF(256) ------------------------ */

  function gfNasob(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }

  function generatorPolynom(stupen) {
    var vysledek = new Array(stupen).fill(0);
    vysledek[stupen - 1] = 1;
    var koren = 1;
    for (var i = 0; i < stupen; i++) {
      for (var j = 0; j < stupen; j++) {
        vysledek[j] = gfNasob(vysledek[j], koren);
        if (j + 1 < stupen) vysledek[j] ^= vysledek[j + 1];
      }
      koren = gfNasob(koren, 2);
    }
    return vysledek;
  }

  function zbytekPoDeleni(data, generator) {
    var vysledek = new Array(generator.length).fill(0);
    for (var i = 0; i < data.length; i++) {
      var cinitel = data[i] ^ vysledek.shift();
      vysledek.push(0);
      for (var j = 0; j < generator.length; j++) {
        vysledek[j] ^= gfNasob(generator[j], cinitel);
      }
    }
    return vysledek;
  }

  /* --- kódování vstupu ---------------------------------------------- */

  function naBajty(text) {
    var b = [];
    for (var i = 0; i < text.length; i++) {
      var c = text.codePointAt(i);
      if (c > 0xFFFF) i++;
      if (c < 0x80) {
        b.push(c);
      } else if (c < 0x800) {
        b.push(0xC0 | (c >> 6), 0x80 | (c & 63));
      } else if (c < 0x10000) {
        b.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      } else {
        b.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63),
               0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      }
    }
    return b;
  }

  function pridejBity(pole, hodnota, pocet) {
    for (var i = pocet - 1; i >= 0; i--) pole.push((hodnota >>> i) & 1);
  }

  function datovaSlova(bajty, verze) {
    var delkaPoctu = verze <= 9 ? 8 : 16;
    var bity = [];
    pridejBity(bity, 4, 4);                    // režim bajtů
    pridejBity(bity, bajty.length, delkaPoctu);
    for (var i = 0; i < bajty.length; i++) pridejBity(bity, bajty[i], 8);

    var kapacita = datovychSlov(verze) * 8;
    for (var t = 0; t < 4 && bity.length < kapacita; t++) bity.push(0);
    while (bity.length % 8 !== 0) bity.push(0);

    var slova = [];
    for (var k = 0; k < bity.length; k += 8) {
      var bajt = 0;
      for (var j = 0; j < 8; j++) bajt = (bajt << 1) | bity[k + j];
      slova.push(bajt);
    }
    var vypln = [0xEC, 0x11];
    for (var v = 0; slova.length < datovychSlov(verze); v++) slova.push(vypln[v % 2]);
    return slova;
  }

  /* Rozdělí data na bloky, ke každému dopočítá opravná slova a výsledek
     proplete tak, jak to norma vyžaduje. */
  function doplnOpravuAProplet(data, verze) {
    var bloku = BLOKU[verze];
    var ecDelka = EC_NA_BLOK[verze];
    var surovych = surovychSlov(verze);
    var kratkych = bloku - (surovych % bloku);
    var kratkaDelka = Math.floor(surovych / bloku);

    var generator = generatorPolynom(ecDelka);
    var bloky = [];
    for (var i = 0, k = 0; i < bloku; i++) {
      var delka = kratkaDelka - ecDelka + (i < kratkych ? 0 : 1);
      var blok = data.slice(k, k + delka);
      k += delka;
      var oprava = zbytekPoDeleni(blok, generator);
      if (i < kratkych) blok = blok.concat([0]);
      bloky.push(blok.concat(oprava));
    }

    var vysledek = [];
    for (var s = 0; s < bloky[0].length; s++) {
      for (var b = 0; b < bloky.length; b++) {
        if (s !== kratkaDelka - ecDelka || b >= kratkych) vysledek.push(bloky[b][s]);
      }
    }
    return vysledek;
  }

  /* --- kreslení matice ---------------------------------------------- */

  function vytvorMatici(verze, slova) {
    var velikost = verze * 4 + 17;
    var m = [], funkcni = [];
    for (var i = 0; i < velikost; i++) {
      m.push(new Array(velikost).fill(false));
      funkcni.push(new Array(velikost).fill(false));
    }

    function bit(hodnota, i) { return ((hodnota >>> i) & 1) !== 0; }

    function funkcniModul(x, y, tmavy) {
      m[y][x] = tmavy;
      funkcni[y][x] = true;
    }

    function hledacek(x, y) {
      for (var dy = -4; dy <= 4; dy++) {
        for (var dx = -4; dx <= 4; dx++) {
          var vzdalenost = Math.max(Math.abs(dx), Math.abs(dy));
          var xx = x + dx, yy = y + dy;
          if (xx >= 0 && xx < velikost && yy >= 0 && yy < velikost) {
            funkcniModul(xx, yy, vzdalenost !== 2 && vzdalenost !== 4);
          }
        }
      }
    }

    function zarovnavaci(x, y) {
      for (var dy = -2; dy <= 2; dy++) {
        for (var dx = -2; dx <= 2; dx++) {
          funkcniModul(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }

    function formatoveBity(maska) {
      var data = (0 << 3) | maska;              // úroveň korekce M má bity 00
      var zbytek = data;
      for (var i = 0; i < 10; i++) zbytek = (zbytek << 1) ^ ((zbytek >>> 9) * 0x537);
      var bity = ((data << 10) | zbytek) ^ 0x5412;

      for (var j = 0; j <= 5; j++) funkcniModul(8, j, bit(bity, j));
      funkcniModul(8, 7, bit(bity, 6));
      funkcniModul(8, 8, bit(bity, 7));
      funkcniModul(7, 8, bit(bity, 8));
      for (var k = 9; k < 15; k++) funkcniModul(14 - k, 8, bit(bity, k));

      for (var a = 0; a < 8; a++) funkcniModul(velikost - 1 - a, 8, bit(bity, a));
      for (var b = 8; b < 15; b++) funkcniModul(8, velikost - 15 + b, bit(bity, b));
      funkcniModul(8, velikost - 8, true);      // vždy tmavý modul
    }

    function verzoveBity() {
      if (verze < 7) return;
      var zbytek = verze;
      for (var i = 0; i < 12; i++) zbytek = (zbytek << 1) ^ ((zbytek >>> 11) * 0x1F25);
      var bity = (verze << 12) | zbytek;
      for (var j = 0; j < 18; j++) {
        var b = bit(bity, j);
        var a = velikost - 11 + (j % 3);
        var c = Math.floor(j / 3);
        funkcniModul(a, c, b);
        funkcniModul(c, a, b);
      }
    }

    // Časovací pruhy
    for (var i = 0; i < velikost; i++) {
      funkcniModul(6, i, i % 2 === 0);
      funkcniModul(i, 6, i % 2 === 0);
    }
    hledacek(3, 3);
    hledacek(velikost - 4, 3);
    hledacek(3, velikost - 4);

    var pozice = poziceZarovnani(verze);
    for (var a = 0; a < pozice.length; a++) {
      for (var b = 0; b < pozice.length; b++) {
        var rohovy = (a === 0 && b === 0)
          || (a === 0 && b === pozice.length - 1)
          || (a === pozice.length - 1 && b === 0);
        if (!rohovy) zarovnavaci(pozice[a], pozice[b]);
      }
    }

    formatoveBity(0);   // zatím jen zabírá místo, správná maska se dokreslí níž
    verzoveBity();

    // Data se sypou do matice v klikaté dráze zprava doleva
    var index = 0;
    for (var vpravo = velikost - 1; vpravo >= 1; vpravo -= 2) {
      if (vpravo === 6) vpravo = 5;
      for (var svisle = 0; svisle < velikost; svisle++) {
        for (var j = 0; j < 2; j++) {
          var x = vpravo - j;
          var nahoru = ((vpravo + 1) & 2) === 0;
          var y = nahoru ? velikost - 1 - svisle : svisle;
          if (!funkcni[y][x] && index < slova.length * 8) {
            m[y][x] = bit(slova[index >>> 3], 7 - (index & 7));
            index++;
          }
        }
      }
    }

    return { m: m, funkcni: funkcni, velikost: velikost, formatoveBity: formatoveBity };
  }

  function pouzijMasku(kod, maska) {
    for (var y = 0; y < kod.velikost; y++) {
      for (var x = 0; x < kod.velikost; x++) {
        if (kod.funkcni[y][x]) continue;
        var obrat;
        switch (maska) {
          case 0: obrat = (x + y) % 2 === 0; break;
          case 1: obrat = y % 2 === 0; break;
          case 2: obrat = x % 3 === 0; break;
          case 3: obrat = (x + y) % 3 === 0; break;
          case 4: obrat = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: obrat = (x * y) % 2 + (x * y) % 3 === 0; break;
          case 6: obrat = ((x * y) % 2 + (x * y) % 3) % 2 === 0; break;
          default: obrat = ((x + y) % 2 + (x * y) % 3) % 2 === 0; break;
        }
        if (obrat) kod.m[y][x] = !kod.m[y][x];
      }
    }
  }

  /* --- hodnocení masek ---------------------------------------------- */

  function penalizace(kod) {
    var N1 = 3, N2 = 3, N3 = 40, N4 = 10;
    var velikost = kod.velikost, m = kod.m, vysledek = 0;

    function pridejDoHistorie(delka, historie) {
      if (historie[0] === 0) delka += velikost;   // světlý okraj před prvním během
      historie.pop();
      historie.unshift(delka);
    }

    function spocitejVzory(historie) {
      var n = historie[1];
      var jadro = n > 0 && historie[2] === n && historie[3] === n * 3
        && historie[4] === n && historie[5] === n;
      return (jadro && historie[0] >= n * 4 && historie[6] >= n ? 1 : 0)
           + (jadro && historie[6] >= n * 4 && historie[0] >= n ? 1 : 0);
    }

    function ukonciAspocitej(barva, delka, historie) {
      if (barva) {
        pridejDoHistorie(delka, historie);
        delka = 0;
      }
      delka += velikost;                          // světlý okraj za posledním během
      pridejDoHistorie(delka, historie);
      return spocitejVzory(historie);
    }

    // Řádky
    for (var y = 0; y < velikost; y++) {
      var barva = false, beh = 0, historie = [0, 0, 0, 0, 0, 0, 0];
      for (var x = 0; x < velikost; x++) {
        if (m[y][x] === barva) {
          beh++;
          if (beh === 5) vysledek += N1;
          else if (beh > 5) vysledek++;
        } else {
          pridejDoHistorie(beh, historie);
          if (!barva) vysledek += spocitejVzory(historie) * N3;
          barva = m[y][x];
          beh = 1;
        }
      }
      vysledek += ukonciAspocitej(barva, beh, historie) * N3;
    }

    // Sloupce
    for (var sx = 0; sx < velikost; sx++) {
      var barvaS = false, behS = 0, historieS = [0, 0, 0, 0, 0, 0, 0];
      for (var sy = 0; sy < velikost; sy++) {
        if (m[sy][sx] === barvaS) {
          behS++;
          if (behS === 5) vysledek += N1;
          else if (behS > 5) vysledek++;
        } else {
          pridejDoHistorie(behS, historieS);
          if (!barvaS) vysledek += spocitejVzory(historieS) * N3;
          barvaS = m[sy][sx];
          behS = 1;
        }
      }
      vysledek += ukonciAspocitej(barvaS, behS, historieS) * N3;
    }

    // Bloky 2×2 stejné barvy
    for (var by = 0; by < velikost - 1; by++) {
      for (var bx = 0; bx < velikost - 1; bx++) {
        var c = m[by][bx];
        if (c === m[by][bx + 1] && c === m[by + 1][bx] && c === m[by + 1][bx + 1]) {
          vysledek += N2;
        }
      }
    }

    // Poměr tmavých a světlých modulů
    var tmavych = 0;
    for (var ty = 0; ty < velikost; ty++) {
      for (var tx = 0; tx < velikost; tx++) if (m[ty][tx]) tmavych++;
    }
    var celkem = velikost * velikost;
    var k = Math.ceil(Math.abs(tmavych * 20 - celkem * 10) / celkem) - 1;
    return vysledek + k * N4;
  }

  /* --- veřejné rozhraní --------------------------------------------- */

  /* Vrátí matici true/false, nebo null když se text do verze 10 nevejde. */
  function matice(text) {
    var bajty = naBajty(String(text));
    var verze = 0;
    for (var v = 1; v <= MAX_VERZE; v++) {
      var kapacita = datovychSlov(v) * 8 - 4 - (v <= 9 ? 8 : 16);
      if (bajty.length * 8 <= kapacita) { verze = v; break; }
    }
    if (verze === 0) return null;

    var slova = doplnOpravuAProplet(datovaSlova(bajty, verze), verze);
    var kod = vytvorMatici(verze, slova);

    var nejlepsi = 0, nejlepsiSkore = Infinity;
    for (var maska = 0; maska < 8; maska++) {
      pouzijMasku(kod, maska);
      kod.formatoveBity(maska);
      var skore = penalizace(kod);
      if (skore < nejlepsiSkore) { nejlepsiSkore = skore; nejlepsi = maska; }
      pouzijMasku(kod, maska);   // maska je sama sobě inverzní, tímhle se vrátí zpět
    }
    pouzijMasku(kod, nejlepsi);
    kod.formatoveBity(nejlepsi);
    return kod.m;
  }

  /* Poskládá matici do SVG. Okraj je povinný — bez klidové zóny čtečky
     kód nenajdou. */
  function svg(text, moznosti) {
    var m = matice(text);
    if (!m) return null;
    var nastaveni = moznosti || {};
    var okraj = nastaveni.okraj === undefined ? 4 : nastaveni.okraj;
    var tmava = nastaveni.tmava || '#000000';
    var svetla = nastaveni.svetla || '#ffffff';
    var n = m.length, s = n + okraj * 2;

    var cesta = [];
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        if (m[y][x]) cesta.push('M' + (x + okraj) + ',' + (y + okraj) + 'h1v1h-1z');
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + s + ' ' + s + '"'
      + ' shape-rendering="crispEdges" role="img"'
      + ' aria-label="QR kód s adresou vizitky">'
      + '<rect width="' + s + '" height="' + s + '" fill="' + svetla + '"/>'
      + '<path d="' + cesta.join('') + '" fill="' + tmava + '"/>'
      + '</svg>';
  }

  return { matice: matice, svg: svg, maxBajtu: 213 };
})();

/* Ověření web/qr.js. Spouští se ručně: node overeni-qr.js
 *
 * Nenasazuje se (nasazuje se jen web/) a nic nepotřebuje doinstalovat.
 * Existuje proto, že QR enkodér je jediný kus produktu, u kterého se chyba
 * pozná až tím, že kód nejde načíst — na oko vypadá špatný QR stejně dobře
 * jako správný.
 *
 * Nezávislý dekodér: znovu implementuje opačnou cestu (čtení formátových
 * bitů, odmaskování, čtení klikaté dráhy, rozplétání bloků) a navíc počítá
 * syndromy Reed-Solomonova kódu z vlastních logaritmických tabulek. Když
 * jsou všechny syndromy nulové, jsou opravná slova správně podle normy —
 * bez ohledu na to, jak je počítá qr.js.
 *
 * Ani tohle ale nenahradí zkoušku skutečným telefonem, viz README.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const zdroj = fs.readFileSync(path.join(__dirname, 'web', 'qr.js'), 'utf8');
const vnitrek = zdroj.replace(
  'return { matice: matice, svg: svg, maxBajtu: 213 };',
  'return { matice: matice, svg: svg, maxBajtu: 213, _vnitrek: { gfNasob: gfNasob,'
  + ' generatorPolynom: generatorPolynom, zbytekPoDeleni: zbytekPoDeleni,'
  + ' datovychSlov: datovychSlov, surovychSlov: surovychSlov,'
  + ' poziceZarovnani: poziceZarovnani } };'
);
if (vnitrek === zdroj) throw new Error('nepodarilo se zpristupnit vnitrek qr.js');
const QR = eval(vnitrek + '; QR;');
const V = QR._vnitrek;

let chyb = 0;
function ok(podminka, popis) {
  if (podminka) console.log('  ok   ' + popis);
  else { console.log('  CHYBA ' + popis); chyb++; }
}
function stejne(a, b, popis) {
  ok(JSON.stringify(a) === JSON.stringify(b),
     popis + (JSON.stringify(a) === JSON.stringify(b) ? '' : '\n        mam:  ' + JSON.stringify(a) + '\n        cekam:' + JSON.stringify(b)));
}

/* --- vlastni GF(256) tabulky, nezavisle na qr.js ------------------- */
const EXP = new Array(512), LOG = new Array(256);
(function () {
  let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const gmul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

const EC_NA_BLOK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const BLOKU = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];

console.log('\n[1] Nasobeni v GF(256) proti vlastnim tabulkam');
{
  let vsechno = true;
  for (let a = 0; a < 256; a++) for (let b = 0; b < 256; b++) {
    if (V.gfNasob(a, b) !== gmul(a, b)) { vsechno = false; }
  }
  ok(vsechno, 'vsech 65536 soucinu souhlasi');
}

console.log('\n[2] Opravna slova proti zname referenci (1-M, "HELLO WORLD")');
{
  const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
  const cekam = [196, 35, 39, 119, 235, 215, 231, 226, 93, 23];
  stejne(V.zbytekPoDeleni(data, V.generatorPolynom(10)), cekam, 'ECC souhlasi s referenci');
}

console.log('\n[3] Kapacity v rezimu bajtu, uroven M (norma)');
{
  const cekam = [14, 26, 42, 62, 84, 106, 122, 152, 180, 213];
  const mam = [];
  for (let v = 1; v <= 10; v++) {
    mam.push(Math.floor((V.datovychSlov(v) * 8 - 4 - (v <= 9 ? 8 : 16)) / 8));
  }
  stejne(mam, cekam, 'kapacity v1..v10');
}

console.log('\n[4] Pozice zarovnavacich znacek (norma)');
{
  const cekam = [[], [6,18], [6,22], [6,26], [6,30], [6,34],
                 [6,22,38], [6,24,42], [6,26,46], [6,28,50]];
  const mam = [];
  for (let v = 1; v <= 10; v++) mam.push(V.poziceZarovnani(v));
  stejne(mam, cekam, 'pozice v1..v10');
}

/* --- nezavisly dekoder -------------------------------------------- */

function funkcniMapa(size) {
  const ver = (size - 17) / 4;
  const f = Array.from({ length: size }, () => new Array(size).fill(false));
  const mark = (x0, y0, w, h) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++)
      if (x >= 0 && x < size && y >= 0 && y < size) f[y][x] = true;
  };
  mark(0, 0, 9, 9);
  mark(size - 8, 0, 8, 9);
  mark(0, size - 8, 9, 8);
  mark(6, 0, 1, size);
  mark(0, 6, size, 1);
  const pos = V.poziceZarovnani(ver);
  for (let a = 0; a < pos.length; a++) for (let b = 0; b < pos.length; b++) {
    const roh = (a === 0 && b === 0) || (a === 0 && b === pos.length - 1)
             || (a === pos.length - 1 && b === 0);
    if (!roh) mark(pos[a] - 2, pos[b] - 2, 5, 5);
  }
  if (ver >= 7) { mark(size - 11, 0, 3, 6); mark(0, size - 11, 6, 3); }
  return f;
}

function ctiFormat(m) {
  const size = m.length;
  let bits = 0;
  const dej = (x, y, i) => { if (m[y][x]) bits |= (1 << i); };
  for (let i = 0; i <= 5; i++) dej(8, i, i);
  dej(8, 7, 6); dej(8, 8, 7); dej(7, 8, 8);
  for (let i = 9; i < 15; i++) dej(14 - i, 8, i);
  bits ^= 0x5412;
  // kontrola BCH(15,5): zbytek po deleni musi vyjit nulovy
  let zb = bits;
  for (let i = 14; i >= 10; i--) if (zb & (1 << i)) zb ^= 0x537 << (i - 10);
  return { platny: (zb & 0x3FF) === 0 && (bits >> 15) === 0,
           uroven: (bits >>> 13) & 3, maska: (bits >>> 10) & 7 };
}

function maskaBit(maska, x, y) {
  switch (maska) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return (x * y) % 2 + (x * y) % 3 === 0;
    case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
    default: return ((x + y) % 2 + (x * y) % 3) % 2 === 0;
  }
}

function ctiSlova(m, maska, funkcni) {
  const size = m.length;
  const bity = [];
  for (let vpravo = size - 1; vpravo >= 1; vpravo -= 2) {
    if (vpravo === 6) vpravo = 5;
    for (let svisle = 0; svisle < size; svisle++) {
      for (let j = 0; j < 2; j++) {
        const x = vpravo - j;
        const nahoru = ((vpravo + 1) & 2) === 0;
        const y = nahoru ? size - 1 - svisle : svisle;
        if (!funkcni[y][x]) {
          bity.push((m[y][x] !== maskaBit(maska, x, y)) ? 1 : 0);
        }
      }
    }
  }
  const slova = [];
  for (let i = 0; i + 8 <= bity.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bity[i + j];
    slova.push(b);
  }
  return slova;
}

function rozpletBloky(slova, ver) {
  const bloku = BLOKU[ver], ecLen = EC_NA_BLOK[ver];
  const surovych = V.surovychSlov(ver);
  const kratkych = bloku - (surovych % bloku);
  const kratkaDelka = Math.floor(surovych / bloku);
  const datDelka = kratkaDelka - ecLen;

  const bloky = [];
  for (let i = 0; i < bloku; i++) {
    bloky.push(new Array(kratkaDelka + (i < kratkych ? 0 : 1)).fill(null));
  }
  let k = 0;
  const maxDelka = kratkaDelka + 1;
  for (let s = 0; s < maxDelka; s++) {
    for (let b = 0; b < bloku; b++) {
      if (s >= bloky[b].length) continue;
      if (s === datDelka && b < kratkych) continue;   // krátké bloky tu jedno slovo nemají
      bloky[b][s] = slova[k++];
    }
  }
  return { bloky, datDelka, kratkych, ecLen };
}

/* Syndromy: pro platny kod musi byt vsechny nulove. */
function syndromyNulove(blok, ecLen) {
  const n = blok.length;
  for (let k = 1; k <= ecLen; k++) {
    let s = 0;
    for (let j = 0; j < n; j++) s ^= gmul(blok[j], EXP[(k * (n - 1 - j)) % 255]);
    if (s !== 0) return false;
  }
  return true;
}

function dekoduj(m) {
  const size = m.length;
  const ver = (size - 17) / 4;
  const fmt = ctiFormat(m);
  if (!fmt.platny) return { chyba: 'neplatne formatove bity' };
  if (fmt.uroven !== 0) return { chyba: 'uroven korekce neni M (je ' + fmt.uroven + ')' };

  const slova = ctiSlova(m, fmt.maska, funkcniMapa(size));
  const { bloky, datDelka, kratkych, ecLen } = rozpletBloky(slova, ver);

  for (const b of bloky) {
    if (b.some(v => v === null || v === undefined)) return { chyba: 'blok nedoplneny' };
    if (!syndromyNulove(b, ecLen)) return { chyba: 'nenulovy syndrom RS' };
  }

  let data = [];
  bloky.forEach((b, i) => {
    data = data.concat(b.slice(0, datDelka + (i < kratkych ? 0 : 1)));
  });

  const bity = [];
  for (const b of data) for (let i = 7; i >= 0; i--) bity.push((b >>> i) & 1);
  let p = 0;
  const ber = n => { let v = 0; for (let i = 0; i < n; i++) v = (v << 1) | bity[p++]; return v; };
  const rezim = ber(4);
  if (rezim !== 4) return { chyba: 'rezim neni bajtovy (' + rezim + ')' };
  const pocet = ber(ver <= 9 ? 8 : 16);
  const bajty = [];
  for (let i = 0; i < pocet; i++) bajty.push(ber(8));
  return { text: Buffer.from(bajty).toString('utf8'), verze: ver, maska: fmt.maska };
}

console.log('\n[5] Round-trip: zakodovat -> nezavisle dekodovat');
{
  const vzorky = [
    'https://vizitka.pages.dev',
    'https://simtegen-vizitka-nastroj-pro-jednoho-remeslnika.pages.dev',
    'A',
    'Truhlarstvi Novak, Zlin',
    'Truhlářství Novák — Zlín, příčky a kuchyně na míru',
    'ČŘŽÝÁÍÉŤĎŇÓÚŮ příliš žluťoučký kůň úpěl ďábelské ódy',
    'https://example.com/?q=' + 'a'.repeat(100),
    'x'.repeat(213),
  ];
  for (const v of vzorky) {
    const m = QR.matice(v);
    if (!m) { ok(false, 'zakodovani "' + v.slice(0, 30) + '..."'); continue; }
    const d = dekoduj(m);
    const popis = 'v' + (d.verze || '?') + ' maska ' + (d.maska === undefined ? '?' : d.maska)
      + ' | ' + (v.length > 34 ? v.slice(0, 34) + '…' : v);
    ok(d.text === v, popis + (d.chyba ? ' -> ' + d.chyba : (d.text === v ? '' : ' -> text nesedi')));
  }
}

console.log('\n[6] Round-trip pres vsechny verze 1..10');
{
  const kapacity = [14, 26, 42, 62, 84, 106, 122, 152, 180, 213];
  for (let v = 1; v <= 10; v++) {
    const text = 'https://a.pages.dev/'.slice(0, Math.min(20, kapacity[v - 1]))
      + 'q'.repeat(Math.max(0, kapacity[v - 1] - 20));
    const m = QR.matice(text);
    const d = m ? dekoduj(m) : { chyba: 'nezakodovano' };
    ok(d.verze === v && d.text === text,
       'verze ' + v + ' na plnou kapacitu (' + kapacity[v - 1] + ' B)'
       + (d.chyba ? ' -> ' + d.chyba : (d.verze !== v ? ' -> vysla verze ' + d.verze : '')));
  }
}

console.log('\n[7] Vyber masky opravdu minimalizuje penalizaci');
{
  // Kdyz je vyber masky rozbity, casto vyjde porad stejna maska.
  const masky = new Set();
  for (let i = 0; i < 40; i++) {
    const d = dekoduj(QR.matice('https://vizitka-' + i + '.pages.dev/remeslnik'));
    masky.add(d.maska);
  }
  ok(masky.size >= 4, 'napric vstupy se vybiraji ruzne masky (' + masky.size + ' z 8)');
}

console.log('\n[8] Mez kapacity a tvar SVG');
{
  ok(QR.matice('x'.repeat(214)) === null, 'text nad 213 bajtu vrati null');
  ok(QR.svg('x'.repeat(214)) === null, 'svg nad 213 bajtu vrati null');
  const s = QR.svg('https://vizitka.pages.dev');
  ok(/^<svg [^>]*viewBox="0 0 29 29"/.test(s), 'v1 + okraj 4 => viewBox 29x29');
  ok(s.indexOf('<path d="M') !== -1 && s.trim().endsWith('</svg>'), 'SVG ma cestu a je uzavrene');
  const diakritika = QR.svg('Труд') !== null;
  ok(diakritika, 'vicebajtovy UTF-8 projde');
}

console.log('\n' + (chyb === 0 ? 'VSE PROSLO' : chyb + ' CHYB'));
process.exit(chyb === 0 ? 0 : 1);

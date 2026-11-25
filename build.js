const fs = require('fs'), path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, p), 'utf8');
const B64 = p => fs.readFileSync(path.join(__dirname, p)).toString('base64');
const V = 'node_modules/';
const VERSION = require('./package.json').version;
const face = (fam, w, file, range) => `@font-face{font-family:"${fam}";font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${B64(V + file)}) format("woff2")${range ? `;unicode-range:${range}` : ''}}`;
const LAT = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const EXT = 'U+0100-0130,U+0132-0151,U+0154-02BA,U+1E00-1EFF,U+2C60-2C7F,U+A720-A7FF';
const A = '@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-';
const fonts = [
  face('Atkinson Hyperlegible', 400, A + 'latin-400-normal.woff2', LAT),
  face('Atkinson Hyperlegible', 700, A + 'latin-700-normal.woff2', LAT),
  face('Atkinson Hyperlegible', 400, A + 'latin-ext-400-normal.woff2', EXT),
  face('Atkinson Hyperlegible', 700, A + 'latin-ext-700-normal.woff2', EXT),
  face('Barlow Condensed', 700, '@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2'),
  face('JetBrains Mono', 700, '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2')
].join('\n');
const safe = s => s.replace(/<\/script/gi, '<\\/script');

const student = `<!doctype html>
<html lang="de" translate="no">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="google" content="notranslate">
<title>@@SMU_TITLE@@</title>
<style>
${fonts}
${R('src/common.css')}
${R('src/student.css')}
</style>
</head>
<body>
<div id="app"></div>
<noscript>Dieser Test braucht JavaScript. Öffne ihn bitte in einem aktuellen Browser.</noscript>
<script type="application/json" id="smu-meta">@@SMU_META@@</script>
<script type="text/plain" id="smu-data">@@SMU_DATA@@</script>
<script>${safe(R(V + 'jspdf/dist/jspdf.umd.min.js'))}</script>
<script>window.__SMU_FONTS={r:"${B64('fonts/pdf.ttf')}",b:"${B64('fonts/pdf-Bold.ttf')}"};</script>
<script id="smu-core">${safe(R('src/core.js'))}</script>
<script id="smu-code">${safe(R('src/student.js'))}</script>
</body>
</html>
`;

const body = `
<header class="oben"><div class="oben-innen">
  <div class="marke" title="Version ${VERSION}">Smü-Programm</div>
  <button class="btn klein still" type="button" id="knopf-anleitung">Anleitung</button>
  <button class="btn klein still" type="button" id="knopf-pruefen">Abgaben prüfen</button>
  <button class="btn klein still" type="button" id="knopf-neu">Neu</button>
  <button class="btn klein still" type="button" id="knopf-laden">Entwurf laden</button>
  <button class="btn klein still" type="button" id="knopf-speichern">Entwurf speichern</button>
  <button class="btn klein" type="button" id="knopf-export">PDF exportieren</button>
  <button class="btn klein" type="button" id="knopf-vorschau">Vorschau</button>
  <button class="btn klein voll" type="button" id="knopf-erzeugen">Schüler-Datei erzeugen</button>
  <input type="file" id="datei-laden" accept=".json,application/json" hidden>
  <input type="file" id="datei-bild" accept="image/*" hidden>
</div></header>
<div class="werk">
  <aside class="seitenleiste" id="einstellungen" aria-label="Einstellungen"></aside>
  <main class="spalte">
    <div class="banner" id="beispiel" hidden>
      <span>Das ist ein Beispiel-Test zum Ausprobieren.</span>
      <button class="btn klein" type="button" id="knopf-beispiel-neu">Eigenen Test beginnen</button>
    </div>
    <div class="bilanz"><h1 id="bilanz-titel"></h1><span class="ziffern" id="bilanz-zahlen"></span></div>
    <div class="blatt" id="fragen"></div>
    <section class="blatt neu" aria-label="Frage hinzufügen">
      <h2>Frage hinzufügen</h2>
      <div class="neu-knoepfe" id="hinzufuegen"></div>
    </section>
  </main>
</div>
<div class="meldung" id="meldung" role="status" hidden></div>
${R('src/anleitung.html').replace('@@VERSION@@', VERSION)}
${R('src/pruefen.html')}
`;
const inner = `<title>Smü-Programm</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
${fonts}
${face('Caveat', 700, '@fontsource/caveat/files/caveat-latin-700-normal.woff2')}
${R('src/common.css')}
${R('src/master.css')}
</style>
${body}
<script type="text/plain" id="smu-vorlage">${Buffer.from(student, 'utf8').toString('base64')}</script>
<script>${safe(R('src/core.js'))}</script>
<script>${safe(R(V + 'jspdf/dist/jspdf.umd.min.js'))}</script>
<script>window.__SMU_FONTS={r:"${B64('fonts/pdf.ttf')}",b:"${B64('fonts/pdf-Bold.ttf')}"};</script>
<script>${safe(R('src/export.js'))}</script>
<script>${safe(R('src/hilfe.js'))}</script>
<script>${safe(R('src/master.js'))}</script>
`;
const full = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${inner.split('<script')[0]}
</head>
<body>
<script${inner.split('<script').slice(1).join('<script')}
</body>
</html>
`;
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist/Smue-Programm.html'), full);
fs.writeFileSync(path.join(__dirname, 'dist/artifact.html'), inner);
fs.writeFileSync(path.join(__dirname, 'dist/student-template.html'), student);
console.log('Master', (full.length / 1024 | 0) + ' KB, Schüler', (student.length / 1024 | 0) + ' KB');

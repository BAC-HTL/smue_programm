// Baut die Doku-Seite für GitHub Pages nach _site/
// Voraussetzung: npm run build (dist/Smue-Programm.html). Optional: tests/ergebnisse.json aus npm test.
const fs = require('fs'), path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, p), 'utf8');
const B64 = p => fs.readFileSync(path.join(__dirname, p)).toString('base64');
const pkg = require('./package.json');
const OUT = path.join(__dirname, '_site');
const REPO = 'https://github.com/BAC-HTL/smue_programm';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'app'), { recursive: true });

// Schriften einmal als eigene Datei, alle Seiten verweisen darauf
const F = 'node_modules/@fontsource/';
const face = (fam, w, file) => `@font-face{font-family:"${fam}";font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${B64(F + file)}) format("woff2")}`;
fs.writeFileSync(path.join(OUT, 'fonts.css'), [
  face('Atkinson Hyperlegible', 400, 'atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2'),
  face('Atkinson Hyperlegible', 700, 'atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff2'),
  face('Caveat', 700, 'caveat/files/caveat-latin-700-normal.woff2'),
  face('JetBrains Mono', 700, 'jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2')
].join('\n'));
fs.writeFileSync(path.join(OUT, 'site.css'), R('src/common.css') + '\n' + R('docs/site.css'));

const NAV = [['index.html', 'Start'], ['anleitung.html', 'Anleitung'], ['tests.html', 'Testbericht'], ['changelog.html', 'Änderungen']];
function page(file, title, body) {
  const nav = NAV.map(([f, t]) => `<a href="${f}"${f === file ? ' aria-current="page"' : ''}>${t}</a>`).join('');
  fs.writeFileSync(path.join(OUT, file), `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Smü-Programm</title>
<link rel="stylesheet" href="fonts.css">
<link rel="stylesheet" href="site.css">
</head>
<body>
<header class="kopfband"><div class="band-innen">
  <a class="marke" href="index.html">Smü-Programm</a>
  <nav aria-label="Doku">${nav}</nav>
</div></header>
<main class="doku">
${body}
</main>
<footer class="fuss"><div class="band-innen">Version ${pkg.version} · <a href="${REPO}">Quellcode auf GitHub</a> · <a href="${REPO}/blob/main/LICENSE">MIT-Lizenz</a> · <a href="${REPO}/releases">Alle Versionen</a></div></footer>
</body>
</html>
`);
}

// Start
page('index.html', 'Start', R('docs/index.html').replace(/@@VERSION@@/g, pkg.version).replace(/@@REPO@@/g, REPO));

// Anleitung: derselbe Text wie im Programm
const a = R('src/anleitung.html').replace('@@VERSION@@', pkg.version);
const inner = a.slice(a.indexOf('<div class="anleitung-text">') + '<div class="anleitung-text">'.length, a.lastIndexOf('</div>', a.lastIndexOf('</div>') - 1));
page('anleitung.html', 'Anleitung', '<h1>Anleitung</h1>\n' + inner);

// Testbericht aus den Ergebnissen des letzten Testlaufs
let tests = '<h1>Testbericht</h1>\n<p>Für diese Version liegt kein Testlauf vor.</p>';
const ef = path.join(__dirname, 'tests/ergebnisse.json');
if (fs.existsSync(ef)) {
  const d = JSON.parse(fs.readFileSync(ef, 'utf8'));
  const ok = d.gesamt - d.fehler, klassen = {};
  d.faelle.forEach(f => { (klassen[f.klasse] = klassen[f.klasse] || []).push(f); });
  const art = n => d.faelle.filter(f => f.art === n).length;
  tests = `<h1>Testbericht</h1>
<p class="lead"><b class="${d.fehler ? 'rot' : 'gruen'}">${ok} von ${d.gesamt} Tests bestanden.</b> Version ${pkg.version}, Lauf vom ${new Date(d.am).toLocaleString('de-AT', { timeZone: 'Europe/Vienna' })}, Dauer ${d.dauerSek} s.</p>
<p>${[['Äquivalenzklasse', 'Äquivalenzklassen-Tests'], ['Grenzwert', 'Grenzwert-Tests'], ['Ablauf', 'Ablauf-Tests']].filter(x => art(x[0])).map(x => art(x[0]) + ' ' + x[1]).join(', ')}. Geprüft wird in Chromium über Playwright, das PDF mit pdftotext und qpdf. Nicht automatisch geprüft werden Firefox, Safari, Edge und echte Schulgeräte.</p>
<div class="tabelle"><table><thead><tr><th>Testklasse</th><th>Tests</th><th>Bestanden</th><th>Fehlgeschlagen</th></tr></thead><tbody>
${Object.keys(klassen).map(k => { const l = klassen[k], f = l.filter(x => x.status !== 'bestanden').length; return `<tr><td>${esc(k)}</td><td>${l.length}</td><td>${l.length - f}</td><td class="${f ? 'rot' : ''}">${f}</td></tr>`; }).join('\n')}
</tbody></table></div>
<h2>Alle Testfälle</h2>
${Object.keys(klassen).map(k => `<details><summary>${esc(k)}</summary><div class="tabelle"><table><thead><tr><th>ID</th><th>Testfall</th><th>Erwartet</th><th>Ergebnis</th></tr></thead><tbody>
${klassen[k].map(f => `<tr><td class="ziffern">${esc(f.id)}</td><td>${esc(f.titel)}</td><td>${esc(f.erwartung).slice(0, 120)}</td><td class="${f.status === 'bestanden' ? 'gruen' : 'rot'}">${f.status === 'bestanden' ? 'bestanden' : 'FEHLER: ' + esc(f.ist).slice(0, 160)}</td></tr>`).join('\n')}
</tbody></table></div></details>`).join('\n')}`;
}
page('tests.html', 'Testbericht', tests);

// Änderungen aus CHANGELOG.md, einfache Umwandlung
const md = R('CHANGELOG.md').split('\n');
let html = '', list = false;
const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');
md.forEach(l => {
  const li = /^\s*- (.*)/.exec(l);
  if (li) { if (!list) { html += '<ul>\n'; list = true; } html += `<li>${inline(li[1])}</li>\n`; return; }
  if (list) { html += '</ul>\n'; list = false; }
  const hm = /^(#{1,3}) (.*)/.exec(l);
  if (hm) html += `<h${hm[1].length}>${inline(hm[2])}</h${hm[1].length}>\n`;
  else if (l.trim()) html += `<p>${inline(l)}</p>\n`;
});
if (list) html += '</ul>\n';
page('changelog.html', 'Änderungen', html);

// Das Lehrer-Programm selbst, online nutzbar
fs.copyFileSync(path.join(__dirname, 'dist/Smue-Programm.html'), path.join(OUT, 'app/Smue-Programm.html'));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
console.log('Seite gebaut:', fs.readdirSync(OUT).join(', '));

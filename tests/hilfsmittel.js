// Gemeinsame Werkzeuge für alle Testklassen
const fs = require('fs'), path = require('path'), os = require('os');
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const MASTER = 'file://' + path.resolve(__dirname, '../dist/Smue-Programm.html');
const TMP = fs.mkdtempSync(path.join(process.env.SMU_TMP || os.tmpdir(), 'smu-'));
const ergebnisse = [];
let aktuelleKlasse = '';
const stoppuhr = () => { const t = process.hrtime.bigint(); return () => Number((process.hrtime.bigint() - t) / 1000000n); };

// Führt einen Testfall aus und merkt sich Eingabe, Erwartung und tatsächliches Ergebnis
async function fall(id, titel, erwartung, fn, art) {
  const ende = stoppuhr(); let status = 'bestanden', ist = '';
  try {
    const r = await fn();
    ist = r === undefined ? String(erwartung) : String(r);
    if (r !== undefined && ist !== String(erwartung)) status = 'FEHLER';
  } catch (e) { status = 'FEHLER'; ist = 'Abbruch: ' + String(e.message).split('\n')[0].slice(0, 160); }
  ergebnisse.push({ id, klasse: aktuelleKlasse, art: art || (id.startsWith('GW') ? 'Grenzwert' : id.startsWith('ÄK') ? 'Äquivalenzklasse' : 'Ablauf'), titel, erwartung: String(erwartung), ist, status, ms: ende() });
  console.log(`${status === 'bestanden' ? '  ok ' : ' FEHL'} ${id} ${titel}${status === 'bestanden' ? '' : `  erwartet: ${erwartung}  ist: ${ist}`}`);
}
function klasse(name) { aktuelleKlasse = name; console.log('\n# ' + name); }

let browser;
async function start() { browser = await chromium.launch(); return browser; }
async function stop() { await browser.close(); }

// Seite mit verstellbarer Uhr; window.__uhr(ms) springt vor
async function kontext() {
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    const echt = Date.now.bind(Date); window.__off = 0;
    Date.now = () => echt() + window.__off;
    window.__uhr = ms => { window.__off += ms; };
  });
  return ctx;
}
function basis(mehr) {
  return Object.assign({ sample: false, title: 'Grenztest', subject: 'Test', cls: '1A', teacher: '', minutes: 10, startCode: '', pin: '4711',
    shuffleQ: false, shuffleO: false, showSolutions: true, logBlur: true, fullscreen: false, lock: false,
    grading: { on: false, thresholds: [88, 75, 63, 50] },
    questions: [{ id: 'q1', type: 'text', prompt: 'Frage eins', points: 1, accepted: ['Antwort'], distractors: [], caseSensitive: false, typo: false }] }, mehr || {});
}
async function master(ctx, entwurf) {
  const p = await ctx.newPage();
  await p.goto(MASTER);
  if (entwurf) { await p.evaluate(d => localStorage.setItem('smue-master-entwurf', JSON.stringify(d)), entwurf); await p.reload(); }
  return p;
}
// Erzeugt die Schüler-Datei; liefert Pfad oder wirft mit dem Prüfdialog-Text
async function erzeugen(p) {
  const dl = p.waitForEvent('download', { timeout: 4000 }).catch(() => null);
  await p.click('#knopf-erzeugen');
  const d = await Promise.race([dl, p.waitForSelector('#dialog', { timeout: 4000 }).then(() => null).catch(() => null)]);
  if (!d) { const t = await p.locator('#dialog').textContent().catch(() => ''); if (/fehlt/.test(t)) { const e = new Error('abgelehnt: ' + t); e.abgelehnt = true; throw e; } }
  const dd = d || await dl; if (!dd) throw new Error('kein Download');
  const f = path.join(TMP, Math.random().toString(36).slice(2) + '.html'); await dd.saveAs(f); return { datei: f, name: dd.suggestedFilename() };
}
async function datei(ctx, entwurf) { const m = await master(ctx, entwurf); const r = await erzeugen(m); await m.close(); return r.datei; }
async function akzeptiert(ctx, entwurf) {
  const m = await master(ctx, entwurf);
  try { await erzeugen(m); return 'angenommen'; } catch (e) { return e.abgelehnt ? 'abgelehnt' : 'Abbruch: ' + e.message.slice(0, 80); } finally { await m.close(); }
}
async function schueler(ctx, f, vor = 'Lena', nach = 'Huber', code) {
  const s = await ctx.newPage(); s.fehler = []; s.on('pageerror', e => s.fehler.push(e.message));
  await s.goto('file://' + f);
  await s.fill('#vorname', vor); await s.fill('#nachname', nach);
  if (code !== undefined) await s.fill('#startcode', code);
  await s.click('button[type=submit]');
  await s.waitForSelector('.uhr', { timeout: 4000 });
  return s;
}
async function abgeben(s) {
  const dl = s.waitForEvent('download', { timeout: 15000 });
  await s.locator('.leiste button').click(); await s.click('#jetzt-abgeben');
  const d = await dl; const f = path.join(TMP, Math.random().toString(36).slice(2) + '.pdf'); await d.saveAs(f);
  return { pdf: f, name: d.suggestedFilename() };
}
const pdfText = f => execFileSync('pdftotext', ['-layout', f, '-'], { maxBuffer: 1 << 26 }).toString();
const pdfSeiten = f => Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [f]).toString())[1]);
// Größte rechte Kante aller Wörter und Prüfung auf überlappende Wörter in pt
function pdfWoerter(f) {
  const x = execFileSync('pdftotext', ['-bbox', f, '-'], { maxBuffer: 1 << 26 }).toString();
  const seiten = x.split('<page ').slice(1);
  return seiten.map(s => [...s.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)<\/word>/g)].map(m => ({ x0: +m[1], y0: +m[2], x1: +m[3], y1: +m[4], t: m[5] })));
}
async function protokoll(s) {
  return s.evaluate(() => { const id = JSON.parse(document.getElementById('smu-meta').textContent).id; return JSON.parse(localStorage['smue:' + id]).log; });
}
const warte = ms => new Promise(r => setTimeout(r, ms));
module.exports = { fall, klasse, start, stop, kontext, basis, master, erzeugen, datei, akzeptiert, schueler, abgeben, pdfText, pdfSeiten, pdfWoerter, protokoll, warte, ergebnisse, TMP, MASTER };

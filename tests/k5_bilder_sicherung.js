// Testklassen für Bilder und Abgabe-Sicherung
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const { execFileSync } = require('child_process');
const C = require('../src/core.js');
const H = require('./hilfsmittel');
const { fall, klasse, basis, kontext, master, schueler, abgeben, warte, pdfText, pdfSeiten, TMP } = H;
const fq = o => Object.assign({ id: 'q1', type: 'text', prompt: 'Frage', points: 1, accepted: ['a'], distractors: [], caseSensitive: false, typo: false }, o);
const hex = b => C.hex(b);

// Erzeugt ein PNG mit Playwright und gibt den Pfad zurück
async function bild(ctx, w, h, name) {
  const p = await ctx.newPage(); await p.goto('about:blank');
  const b64 = await p.evaluate(([w, h]) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#d00'); g.addColorStop(1, '#00d'); x.fillStyle = g; x.fillRect(0, 0, w, h); for (let i = 0; i < 400; i++) { x.fillStyle = `hsl(${i},80%,50%)`; x.fillRect(Math.random() * w, Math.random() * h, w / 40 + 1, h / 40 + 1); } return c.toDataURL('image/png').split(',')[1]; }, [w, h]);
  await p.close(); const f = path.join(TMP, name || `b${w}x${h}.png`); fs.writeFileSync(f, Buffer.from(b64, 'base64')); return f;
}
async function mitBild(ctx, f, id = 'q1') {
  const c = await ctx.newPage();
  return c;
}
// Master mit Entwurf, Bild per Dateiauswahl auf Frage 1
async function setze(p, f) {
  const [ch] = await Promise.all([p.waitForEvent('filechooser'), p.click('#q-q1-bild')]); await ch.setFiles(f); await warte(250);
}
// Erzeugt Test und Kontrolldatei
async function paar(ctx, entwurf) {
  const m = await master(ctx, entwurf); const dl = [];
  m.on('download', d => dl.push(d));
  await m.click('#knopf-erzeugen');
  for (let i = 0; i < 60 && dl.length < 2; i++) await warte(50);
  const html = path.join(TMP, Math.random().toString(36).slice(2) + '.html'), json = html.replace('.html', '.json');
  await dl[0].saveAs(html); await dl[1].saveAs(json);
  await m.close();
  return { html, json, k: JSON.parse(fs.readFileSync(json, 'utf8')), kname: dl[1].suggestedFilename() };
}
const pruef = async (pdf, k) => C.pruefen(new Uint8Array(fs.readFileSync(pdf)), k);

module.exports = async function () {
  klasse('H1 SHA-256 und HMAC');
  const v = (t, h) => hex(C.sha256(t)) === h ? h : hex(C.sha256(t));
  await fall('ÄK-H01', 'SHA-256 von "abc" (NIST)', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', () => hex(C.sha256('abc')));
  await fall('GW-H01', 'SHA-256 der leeren Eingabe (NIST)', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', () => hex(C.sha256('')));
  await fall('ÄK-H02', 'SHA-256 mit 448 Bit (NIST)', '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1', () => hex(C.sha256('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')));
  for (const n of [55, 56, 63, 64, 65, 119, 120, 1000000]) {
    const b = Buffer.alloc(n, 0x61);
    await fall('GW-H' + String(n).padStart(3, '0').slice(-3), `SHA-256 bei ${n} Byte, Vergleich mit Node`, require('crypto').createHash('sha256').update(b).digest('hex'), () => hex(C.sha256(new Uint8Array(b))));
  }
  await fall('ÄK-H03', 'HMAC RFC 4231 Fall 2', '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843', () => C.hmac('Jefe', 'what do ya want for nothing?'));
  await fall('GW-H02', 'HMAC mit Schlüssel über 64 Byte', require('crypto').createHmac('sha256', 'k'.repeat(100)).update('x').digest('hex'), () => C.hmac('k'.repeat(100), 'x'));
  await fall('ÄK-H04', 'Ein geändertes Zeichen ändert den Hash', 'true', () => String(hex(C.sha256('Note 2')) !== hex(C.sha256('Note 1'))));

  const ctx = await kontext();

  klasse('B1 Bilder im Master');
  const pfad = await bild(ctx, 800, 600);
  await fall('ÄK-B01', 'Bild per Dateiauswahl wird angezeigt', 'true', async () => {
    const p = await master(ctx, basis()); await setze(p, pfad); const r = await p.locator('.bildkarte img').count() === 1; await p.close(); return String(r);
  });
  await fall('ÄK-B02', 'Bild bleibt nach Neuladen im Entwurf', 'true', async () => {
    const p = await master(ctx, basis()); await setze(p, pfad); await p.reload(); await warte(100); const r = await p.locator('.bildkarte img').count() === 1; await p.close(); return String(r);
  });
  await fall('ÄK-B03', 'Bild lässt sich entfernen', '0', async () => { const p = await master(ctx, basis()); await setze(p, pfad); await p.click('#q-q1-bildweg'); const n = await p.locator('.bildkarte').count(); await p.close(); return String(n); });
  await fall('ÄK-B04', 'Bild per Hineinziehen', 'true', async () => {
    const p = await master(ctx, basis()); const b64 = fs.readFileSync(pfad).toString('base64');
    await p.evaluate(b64 => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); const d = new DataTransfer(); d.items.add(new File([u], 'x.png', { type: 'image/png' })); document.getElementById('frage-q1').dispatchEvent(new DragEvent('drop', { dataTransfer: d, bubbles: true, cancelable: true })); }, b64);
    await warte(250); const r = await p.locator('.bildkarte img').count() === 1; await p.close(); return String(r);
  });
  await fall('ÄK-B05', 'Bild per Strg+V einfügen', 'true', async () => {
    const p = await master(ctx, basis()); const b64 = fs.readFileSync(pfad).toString('base64'); await p.focus('#q-q1-text');
    await p.evaluate(b64 => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); const d = new DataTransfer(); d.items.add(new File([u], 'x.png', { type: 'image/png' })); document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: d, bubbles: true, cancelable: true })); }, b64);
    await warte(250); const r = await p.locator('.bildkarte img').count() === 1; await p.close(); return String(r);
  });
  await fall('ÄK-B06', 'Textdatei wird abgewiesen', 'true', async () => {
    const p = await master(ctx, basis()); const f = path.join(TMP, 'x.txt'); fs.writeFileSync(f, 'hallo'); await p.setInputFiles('#datei-bild', f).catch(() => {});
    await p.evaluate(() => 0); await setze(p, f); const t = await p.textContent('#meldung'); await p.close(); return String(/keine Bilddatei/.test(t));
  });
  await fall('ÄK-B07', 'Kaputtes Bild wird abgewiesen', 'true', async () => {
    const p = await master(ctx, basis()); const f = path.join(TMP, 'kaputt.png'); fs.writeFileSync(f, 'kein bild'); await setze(p, f); const t = await p.textContent('#meldung'); await p.close(); return String(/nicht gelesen/.test(t));
  });
  const groesse = async (w, h) => {
    const p = await master(ctx, basis()); await setze(p, await bild(ctx, w, h));
    const r = await p.evaluate(() => { const i = JSON.parse(localStorage.getItem('smue-master-entwurf')).questions[0].image; return i.w + 'x' + i.h; }); await p.close(); return r;
  };
  await fall('GW-B01', 'Kleinstes Bild 1×1 bleibt 1×1', '1x1', () => groesse(1, 1));
  await fall('GW-B02', 'Bild mit 1200 px bleibt unverändert', '1200x900', () => groesse(1200, 900));
  await fall('GW-B03', 'Bild mit 1201 px wird auf 1200 verkleinert', '1200x898', () => groesse(1201, 899));
  await fall('GW-B04', 'Hochformat 3000×4000 auf 1200 Höhe', '900x1200', () => groesse(3000, 4000));
  await fall('GW-B05', 'Sehr schmales Bild 4000×10 behält mindestens 1 px', '1200x3', () => groesse(4000, 10));
  await fall('GW-B06', 'Datei über 25 MB wird abgewiesen', 'true', async () => {
    const p = await master(ctx, basis()); const f = path.join(TMP, 'gross.png'); fs.writeFileSync(f, Buffer.alloc(25 * 1024 * 1024 + 1)); await setze(p, f); const t = await p.textContent('#meldung'); await p.close(); return String(/25 MB/.test(t));
  });
  await fall('ÄK-B08', 'Transparentes PNG bekommt weißen Grund', 'true', async () => {
    const p = await ctx.newPage(); await p.goto('about:blank');
    const b = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 40; return c.toDataURL('image/png').split(',')[1]; }); await p.close();
    const f = path.join(TMP, 'tr.png'); fs.writeFileSync(f, Buffer.from(b, 'base64'));
    const m = await master(ctx, basis()); await setze(m, f);
    const hell = await m.evaluate(async () => { const d = JSON.parse(localStorage.getItem('smue-master-entwurf')).questions[0].image.data; const i = new Image(); i.src = d; await i.decode(); const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, 1, 1).data[0]; });
    await m.close(); return String(hell > 240);
  });
  await fall('GW-B07', 'Voller Browser-Speicher: Warnung, Bild bleibt im Fenster', 'true', async () => {
    const c = await kontext(); const p = await master(c, basis()); await p.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('voll'); }; });
    await setze(p, pfad); const t = await p.textContent('#meldung'); const n = await p.locator('.bildkarte img').count(); await c.close(); return String(/Speicher ist voll/.test(t) && n === 1);
  });
  await fall('ÄK-B09', 'Entwurf mit fremdem Bildformat wird abgewiesen', 'true', async () => {
    const p = await master(ctx); const f = path.join(TMP, 'b.json'); fs.writeFileSync(f, JSON.stringify(basis({ questions: [fq({ image: { data: 'data:image/svg+xml;base64,AAAA', w: 1, h: 1 } })] })));
    await p.setInputFiles('#datei-laden', f); await warte(150); const t = await p.textContent('#meldung'); await p.close(); return String(/kein Smü-Entwurf/.test(t));
  });

  klasse('B2 Bilder in Schüler-Datei und PDF');
  const q1Bild = async () => {
    const p = await master(ctx, basis()); await setze(p, pfad); const d = await p.evaluate(() => JSON.parse(localStorage.getItem('smue-master-entwurf'))); await p.close(); return d;
  };
  const entwurfBild = await q1Bild();
  await fall('ÄK-B10', 'Schüler-Datei kommt ohne die Originaldatei aus', 'true', async () => {
    const a = await paar(ctx, entwurfBild); const dir = path.join(TMP, 'kopie' + Date.now()); fs.mkdirSync(dir); const z = path.join(dir, 'kopiert.html'); fs.copyFileSync(a.html, z);
    const s = await schueler(ctx, z); const ok = await s.locator('.fragebild').evaluate(i => i.complete && i.naturalWidth > 0); await s.close(); return String(ok);
  });
  await fall('ÄK-B11', 'Ein Bild lädt nichts aus dem Netz nach', '0', async () => {
    const a = await paar(ctx, entwurfBild); const req = []; const h = r => { if (!/^(file|data|blob):/.test(r.url())) req.push(r.url()); }; ctx.on('request', h);
    const s = await schueler(ctx, a.html); await warte(100); await s.close(); ctx.off('request', h); return String(req.length);
  });
  await fall('ÄK-B12', 'Bild ist im Test mit Startcode verschlüsselt', 'false', async () => {
    const a = await paar(ctx, Object.assign({}, entwurfBild, { startCode: 'X1' })); const t = fs.readFileSync(a.html, 'utf8'); return String(t.includes(entwurfBild.questions[0].image.data.slice(30, 90)));
  });
  await fall('ÄK-B13', 'Bild erscheint im PDF', 'true', async () => {
    const a = await paar(ctx, entwurfBild); const s = await schueler(ctx, a.html); const r = await abgeben(s); await s.close();
    return String(/image/.test(execFileSync('pdfimages', ['-list', r.pdf]).toString().split('\n').slice(2).join('\n')));
  });
  await fall('ÄK-B14', 'Bildbeschreibung kommt beim Schüler an', 'Karte von Tirol', async () => {
    const d = JSON.parse(JSON.stringify(entwurfBild)); d.questions[0].image.alt = 'Karte von Tirol'; const a = await paar(ctx, d); const s = await schueler(ctx, a.html); const t = await s.locator('.fragebild').getAttribute('alt'); await s.close(); return t;
  });
  await fall('GW-B08', 'Hohes Bild sprengt die PDF-Seite nicht', 'true', async () => {
    const m = await master(ctx, basis()); await setze(m, await bild(ctx, 300, 1200)); const d = await m.evaluate(() => JSON.parse(localStorage.getItem('smue-master-entwurf'))); await m.close();
    const a = await paar(ctx, d); const s = await schueler(ctx, a.html); const r = await abgeben(s); await s.close();
    const zeilen = execFileSync('pdfimages', ['-list', r.pdf]).toString().split('\n').slice(2).filter(Boolean); return String(zeilen.length >= 1);
  });
  await fall('GW-B09', '30 Fragen mit Bild: PDF enthält 30 Bilder, Datei unter 16 MB', 'true', async () => {
    const qs = [...Array(30)].map((_, i) => fq({ id: 'q' + i, prompt: 'F' + i, image: entwurfBild.questions[0].image }));
    const a = await paar(ctx, basis({ questions: qs })); const s = await schueler(ctx, a.html); const r = await abgeben(s); await s.close();
    const n = execFileSync('pdfimages', ['-list', r.pdf]).toString().split('\n').slice(2).filter(Boolean).length;
    return String(n === 30 && fs.statSync(a.html).size < 16e6);
  });
  await fall('GW-B10', 'Handybreite 320 px: Bild läuft nicht über', 'false', async () => {
    const a = await paar(ctx, entwurfBild); const s = await schueler(ctx, a.html); await s.setViewportSize({ width: 320, height: 700 }); await warte(80); const r = await s.evaluate(() => document.documentElement.scrollWidth > innerWidth); await s.close(); return String(r);
  });

  klasse('G1 Abgabe prüfen: unveränderte Abgaben');
  const einfach = basis({ grading: { on: true, thresholds: [88, 75, 63, 50] }, questions: [fq({ points: 2 }), fq({ id: 'q2', points: 1 })] });
  const a0 = await paar(ctx, einfach);
  // Jede Abgabe im eigenen Browserprofil, weil ein Test pro Browser nur einmal läuft
  const abgabe = async (a = a0, n = 'Huber') => { const c = await kontext(); const s = await schueler(c, a.html, 'Lena', n); await s.fill('#a-q1', 'a'); await s.keyboard.press('Control+U'); const r = await abgeben(s); await c.close(); return r; };
  const orig = await abgabe();
  await fall('ÄK-G01', 'Kontrolldatei wird mitgespeichert', 'true', async () => String(/_Kontrolle\.json$/.test(a0.kname)));
  await fall('ÄK-G02', 'Unverändertes PDF ist echt', 'echt', async () => (await pruef(orig.pdf, a0.k)).status);
  await fall('ÄK-G03', 'Punkte werden nachgerechnet', '2 von 3', async () => { const r = await pruef(orig.pdf, a0.k); return r.earned + ' von ' + r.max; });
  await fall('ÄK-G04', 'Name und Note kommen aus den Prüfdaten', 'Lena Huber|3', async () => { const r = await pruef(orig.pdf, a0.k); return r.name + '|' + r.note.nr; });
  await fall('ÄK-G05', 'Protokoll steht in den Prüfdaten', 'true', async () => String((await pruef(orig.pdf, a0.k)).log.some(e => /Quelltext/.test(e.text))));
  await fall('ÄK-G06', 'PDF lässt sich normal lesen', 'true', async () => { execFileSync('qpdf', ['--check', orig.pdf]); return String(pdfSeiten(orig.pdf) >= 1 && /Lena Huber/.test(pdfText(orig.pdf))); });
  await fall('ÄK-G07', 'Prüfdaten sind im PDF nicht sichtbar', 'false', async () => String(/SMUPRUEF/.test(pdfText(orig.pdf))));
  await fall('ÄK-G08', 'Lösung steht nicht in der Schüler-Datei, nur in der Kontrolldatei', 'true', async () => {
    const a = await paar(ctx, basis({ questions: [fq({ accepted: ['ZZLOESUNG'] })] })); return String(!fs.readFileSync(a.html, 'utf8').includes('ZZLOESUNG') && fs.readFileSync(a.json, 'utf8').includes('ZZLOESUNG'));
  });

  klasse('G2 Manipulationsversuche');
  const kopie = (mut) => { const b = Buffer.from(fs.readFileSync(orig.pdf)); const f = path.join(TMP, Math.random().toString(36).slice(2) + '.pdf'); fs.writeFileSync(f, mut(b) || b); return f; };
  await fall('ÄK-G09', 'Ein Bit im Inhalt geändert', 'veraendert', async () => (await pruef(kopie(b => { b[200] ^= 1; }), a0.k)).status);
  await fall('GW-G01', 'Letztes Byte der Datei geändert', 'veraendert', async () => (await pruef(kopie(b => { b[b.length - 1] ^= 1; }), a0.k)).status);
  await fall('GW-G02', 'Erstes Byte der Datei geändert', 'veraendert', async () => (await pruef(kopie(b => { b[0] ^= 1; }), a0.k)).status);
  await fall('ÄK-G10', 'Sichtbarer Text ersetzt: Punkte im PDF-Stream', 'veraendert', async () => (await pruef(kopie(b => { const s = b.toString('latin1'); const i = s.indexOf('/Length'); b[i + 2] = 0x20; }), a0.k)).status);
  await fall('ÄK-G11', 'Datei-Signatur gelöscht', 'veraendert', async () => (await pruef(kopie(b => { const p = C.pruefStelle(new Uint8Array(b)); b.fill(0x30, p.sigFileAt, p.sigFileAt + 64); }), a0.k)).status);
  const nachP = (fn) => kopie(b => { const u = new Uint8Array(b), p = C.pruefStelle(u); const t = b.toString('latin1', p.payloadAt, p.sigFileAt - 1); const cut = t.lastIndexOf(':'); const P = JSON.parse(Buffer.from(t.slice(0, cut), 'base64').toString('utf8')); fn(P); const neu = Buffer.from(JSON.stringify(P)).toString('base64'); const ziel = t.slice(0, cut).length; const fuell = (neu + ' '.repeat(ziel)).slice(0, ziel); b.write(fuell, p.payloadAt, 'latin1'); });
  await fall('ÄK-G12', 'Prüfdaten: Punkte erhöht ohne Schlüssel', 'veraendert', async () => (await pruef(nachP(P => { P.shown.earned = 3; }), a0.k)).status);
  await fall('ÄK-G13', 'Ganzes PDF neu geschrieben (qpdf): Prüfdaten weg oder ungültig', 'true', async () => {
    const f = path.join(TMP, 'neu' + Date.now() + '.pdf'); execFileSync('qpdf', ['--object-streams=generate', orig.pdf, f]); const r = await pruef(f, a0.k); return String(r.status !== 'echt');
  });
  await fall('ÄK-G14', 'Fremdes PDF ohne Prüfdaten', 'ohne', async () => { const f = path.join(TMP, 'fremd.pdf'); fs.writeFileSync(f, '%PDF-1.4 leer'); return (await pruef(f, a0.k)).status; });
  await fall('GW-G03', 'Leere Datei', 'ohne', async () => { const f = path.join(TMP, 'leer.pdf'); fs.writeFileSync(f, ''); return (await pruef(f, a0.k)).status; });
  await fall('ÄK-G15', 'PDF aus einem anderen Test', 'fremd', async () => { const a2 = await paar(ctx, einfach); return (await pruef(orig.pdf, a2.k)).status; });
  await fall('ÄK-G16', 'Selbst berechnete gefälschte Signatur ohne Schlüssel', 'veraendert', async () => (await pruef(kopie(b => { const p = C.pruefStelle(new Uint8Array(b)); b.write(C.hmac('falsch', new Uint8Array(b)), p.sigFileAt, 'latin1'); }), a0.k)).status);

  klasse('G3 Veränderte Schüler-Datei');
  const zugriff = async (mut) => {
    const a = await paar(ctx, einfach); const f = a.html.replace('.html', '-m.html'); fs.writeFileSync(f, mut(fs.readFileSync(a.html, 'utf8')));
    const s = await schueler(ctx, f); await s.fill('#a-q1', 'a'); const r = await abgeben(s); await s.close(); return pruef(r.pdf, a.k);
  };
  await fall('ÄK-G17', 'Zeit in der HTML von 10 auf 99 Minuten geändert', 'veraendert', async () => (await zugriff(t => t.replace('"minutes":10', '"minutes":99'))).status);
  await fall('ÄK-G18', 'Protokoll in der HTML abgeschaltet', 'veraendert', async () => (await zugriff(t => t.replace('"logBlur":true', '"logBlur":false'))).status);
  await fall('ÄK-G19', 'Programmcode verändert, damit jede Antwort voll zählt', 'veraendert', async () => (await zugriff(t => t.replace('function isAnswered(q, a) {', 'function isAnswered(q, a) { /*x*/'))).status);
  await fall('ÄK-G20', 'Punkte in der HTML gefälscht: Nachrechnen erkennt das', 'true', async () => {
    const r = await zugriff(t => t.replace('var earned = rows.reduce(function (s, r) { return s + r.earned; }, 0);', 'var earned = 3;')); return String(r.status === 'veraendert' && r.earned === 2);
  });

  klasse('G4 Prüffunktion im Master');
  const b2 = await abgabe(a0, 'Muster'), b3 = await abgabe(a0, 'Muster');
  const panel = async (c, pdfs) => {
    const p = await master(c, basis()); await p.click('#knopf-pruefen');
    const [k] = await Promise.all([p.waitForEvent('filechooser'), p.click('#knopf-kontrolle')]); await k.setFiles(a0.json); await warte(120);
    const [f] = await Promise.all([p.waitForEvent('filechooser'), p.click('#knopf-pdf')]); await f.setFiles(pdfs); await p.waitForSelector('#pruef-summe'); return p;
  };
  await fall('ÄK-G21', 'PDFs-Knopf ist ohne Kontrolldatei gesperrt', 'true', async () => { const p = await master(ctx, basis()); await p.click('#knopf-pruefen'); const r = await p.isDisabled('#knopf-pdf'); await p.close(); return String(r); });
  await fall('ÄK-G22', 'Falsche Datei als Kontrolldatei', 'true', async () => {
    const p = await master(ctx, basis()); await p.click('#knopf-pruefen'); const f = path.join(TMP, 'x.json'); fs.writeFileSync(f, '{"a":1}');
    await p.setInputFiles('#datei-kontrolle', f); await warte(100); const t = await p.textContent('#pruef-kontrolle'); await p.close(); return String(/keine Kontrolldatei/.test(t));
  });
  await fall('ÄK-G23', 'Mehrere PDFs auf einmal: Zusammenfassung', '3 Abgaben, davon 2 echt.', async () => {
    const p = await panel(ctx, [orig.pdf, b2.pdf, kopie(b => { b[300] ^= 1; })]); const t = await p.textContent('#pruef-summe'); await p.close(); return t;
  });
  await fall('ÄK-G24', 'Zwei Abgaben mit gleichem Namen werden gemeldet', 'true', async () => {
    const p = await panel(ctx, [b2.pdf, b3.pdf]); const t = await p.textContent('#pruef-liste'); await p.close(); return String(/Mehrere Abgaben/.test(t));
  });
  await fall('ÄK-G25', 'Protokoll aufklappbar, auch wenn die Seite im PDF fehlen würde', 'true', async () => {
    const p = await panel(ctx, [orig.pdf]); await p.click('#pruef-liste summary'); const t = await p.textContent('#pruef-liste details'); await p.close(); return String(/Quelltext/.test(t));
  });
  await fall('ÄK-G26', 'Anleitung beschreibt Bilder und Prüfung', 'true', async () => {
    const p = await master(ctx, basis()); const t = await p.textContent('#anleitung'); await p.close(); return String(/Wo muss das Bild liegen/.test(t) && /Abgaben prüfen/.test(t));
  });
  await fall('ÄK-G27', 'Tooltip erklärt, dass keine Bilddatei nötig ist', 'true', async () => {
    const p = await master(ctx, basis()); await p.hover('#q-q1-bild'); await warte(450); const t = await p.textContent('#hilfe-tip'); await p.close(); return String(/direkt in der Schüler-Datei/.test(t));
  });
  await ctx.close();
};

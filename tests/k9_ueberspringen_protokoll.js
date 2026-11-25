// Testklassen für Überspringen, Protokoll (Versuch oder wirklich verlassen), Kontrolldatei und Anleitung
const fs = require('fs'), path = require('path');
const C = require('../src/core.js');
const H = require('./hilfsmittel');
const { fall, klasse, basis, kontext, master, datei, akzeptiert, schueler, abgeben, warte, protokoll, pdfText, TMP } = H;
const fq = (i, o) => Object.assign({ id: 'q' + i, type: 'text', prompt: 'Frage ' + i, points: 1, accepted: ['ja'], distractors: [], caseSensitive: false, typo: false }, o);
const drei = [fq(1), fq(2), fq(3)];
const einzeln = (n, mehr) => basis(Object.assign({ single: true, skipZahl: n, questions: drei }, mehr || {}));
const test = async (ctx, d) => schueler(ctx, await datei(ctx, d));
const nr = async s => (/Frage (\d)/.exec(await s.textContent('section.posten')) || [])[1];
const knoepfe = s => s.locator('.abgabe button').evaluateAll(bs => bs.map(b => b.textContent + (b.disabled ? ' [gesperrt]' : '')).join('|'));
const ueberspringen = s => s.click('#ueberspringen');
const einreichen = async s => { await s.click('#weiter'); await s.click('#weiter'); };
const eintraege = async (s, kind) => (await protokoll(s)).filter(e => !kind || e.kind === kind);
// Beide Dateien beim Erzeugen abfangen: Schüler-Datei und Kontrolldatei
async function beide(ctx, d) {
  const m = await master(ctx, d); const dl = []; m.on('download', x => dl.push(x)); await m.click('#knopf-erzeugen');
  for (let i = 0; i < 60 && dl.length < 2; i++) await warte(50);
  const f = path.join(TMP, Math.random().toString(36).slice(2) + '.html'), j = f + '.json'; await dl[0].saveAs(f); await dl[1].saveAs(j); await m.close();
  return { f, j };
}

module.exports = async function () {
  const ctx = await kontext();
  const A = d => akzeptiert(ctx, d);

  klasse('U1 Überspringen: Einstellung im Master');
  await fall('ÄK-UE01', 'Feld nur sichtbar mit „Eine Frage pro Seite“', 'false|true', async () => {
    const p = await master(ctx, basis()); const a = await p.locator('#ueberspringen').count() > 0; await p.check('#einzeln'); const b = await p.locator('#ueberspringen').isVisible(); await p.close(); return a + '|' + b;
  });
  await fall('ÄK-UE02', 'Standardwert 2', '2', async () => { const p = await master(ctx, basis()); await p.check('#einzeln'); const v = await p.inputValue('#ueberspringen'); await p.close(); return v; });
  await fall('ÄK-UE03', 'Wert bleibt im Entwurf', '5', async () => {
    const p = await master(ctx, basis({ single: true })); await p.fill('#ueberspringen', '5'); await p.reload(); await warte(100); const v = await p.inputValue('#ueberspringen'); await p.close(); return v;
  });
  await fall('GW-UE01', 'Anzahl 0', 'angenommen', () => A(einzeln(0)));
  await fall('GW-UE02', 'Anzahl 99', 'angenommen', () => A(einzeln(99)));
  await fall('GW-UE03', 'Anzahl 100', 'abgelehnt', () => A(einzeln(100)));
  await fall('GW-UE04', 'Anzahl -1', 'abgelehnt', () => A(einzeln(-1)));
  await fall('GW-UE05', 'Anzahl 1,5', 'abgelehnt', () => A(einzeln(1.5)));
  await fall('ÄK-UE04', 'Anzahl ist egal, solange „Eine Frage pro Seite“ aus ist', 'angenommen', () => A(basis({ single: false, skipZahl: -1 })));

  klasse('U2 Überspringen im Test');
  await fall('GW-UE06', 'Beim Start: Zähler 2 und „Frage einreichen“', '(2) Frage überspringen|Frage einreichen', async () => { const s = await test(ctx, einzeln(2)); const r = await knoepfe(s); await s.close(); return r; });
  await fall('GW-UE07', 'Nach einmal Überspringen: Zähler 1, nächste Frage', '(1) Frage überspringen|Frage einreichen|2', async () => {
    const s = await test(ctx, einzeln(2)); await ueberspringen(s); const r = await knoepfe(s) + '|' + await nr(s); await s.close(); return r;
  });
  await fall('GW-UE08', 'Nach zweimal: Knopf gesperrt', '(0) Frage überspringen [gesperrt]|Frage einreichen', async () => {
    const s = await test(ctx, einzeln(2)); await ueberspringen(s); await ueberspringen(s); const r = await knoepfe(s); await s.close(); return r;
  });
  await fall('ÄK-UE05', 'Gesperrter Knopf ist auch per Skript-Klick wirkungslos', '2|1', async () => {
    const s = await test(ctx, einzeln(1)); await ueberspringen(s);
    await s.evaluate(() => { const b = document.getElementById('ueberspringen'); b.disabled = false; b.click(); }); await warte(50);
    const r = await nr(s) + '|' + (await eintraege(s, 'skip')).length; await s.close(); return r;
  });
  await fall('ÄK-UE06', 'Übersprungene Frage kommt ans Ende', '2,3,1', async () => {
    const s = await test(ctx, einzeln(2)); const folge = []; await ueberspringen(s);
    for (let i = 0; i < 3; i++) { folge.push(await nr(s)); if (i < 2) await einreichen(s); } await s.close(); return folge.join(',');
  });
  await fall('ÄK-UE07', 'Eingetragene Antwort bleibt nach dem Überspringen', 'ja', async () => {
    const s = await test(ctx, einzeln(2)); await s.fill('#a-q1', 'ja'); await ueberspringen(s); await einreichen(s); await einreichen(s); const v = await s.inputValue('#a-q1'); await s.close(); return v;
  });
  await fall('ÄK-UE08', 'Neuladen behält Reihenfolge und Zähler', '2|(1) Frage überspringen|Frage einreichen', async () => {
    const s = await test(ctx, einzeln(2)); await ueberspringen(s); await s.reload(); await s.waitForSelector('.uhr'); const r = await nr(s) + '|' + await knoepfe(s); await s.close(); return r;
  });
  await fall('GW-UE09', 'Letzte Frage: kein Überspringen, nur „Test abgeben“', 'Test abgeben', async () => {
    const s = await test(ctx, einzeln(2)); await einreichen(s); await einreichen(s); const r = await knoepfe(s); await s.close(); return r;
  });
  await fall('GW-UE10', 'Anzahl 0: kein Überspringen, Knopf heißt „Weiter“', 'Weiter zur nächsten Frage', async () => { const s = await test(ctx, einzeln(0)); const r = await knoepfe(s); await s.close(); return r; });
  await fall('ÄK-UE09', 'Jedes Überspringen steht im Protokoll', '2|true', async () => {
    const s = await test(ctx, einzeln(2)); await ueberspringen(s); await ueberspringen(s); const e = await eintraege(s, 'skip'); await s.close();
    return e.length + '|' + (e[0].text !== e[1].text && /ans Ende gestellt/.test(e[0].text));
  });
  await fall('ÄK-UE10', 'Übersprungene Frage wird gewertet, Abgabe bleibt echt', '1 von 3 Punkten|echt', async () => {
    const { f, j } = await beide(ctx, einzeln(2)); const c = await kontext(); const s = await schueler(c, f);
    await s.fill('#a-q1', 'ja'); await ueberspringen(s); await einreichen(s); await einreichen(s); const r = await abgeben(s); await c.close();
    return (/\d+ von \d+ Punkten/.exec(pdfText(r.pdf)) || [''])[0] + '|' + C.pruefen(new Uint8Array(fs.readFileSync(r.pdf)), JSON.parse(fs.readFileSync(j, 'utf8'))).status;
  });

  klasse('P1 Protokoll: Versuch oder wirklich verlassen');
  const vb = mehr => basis(Object.assign({ fullscreen: true }, mehr || {}));
  const imVollbild = async () => { const s = await test(ctx, vb()); await s.waitForFunction(() => !!document.fullscreenElement); await warte(300); return s; };
  await fall('ÄK-PR01', 'Win+D mit Tastatursperre: nur Versuch, kein „Vollbild verlassen“', 'tried|0', async () => {
    const s = await imVollbild(); await s.keyboard.press('Meta+d'); await warte(50);
    const e = await eintraege(s); const t = e.find(x => /Win\+D/.test(x.text)); const n = e.filter(x => x.kind === 'screen').length; await s.close();
    return (t ? t.kind + (/versucht, gesperrt/.test(t.text) ? '' : ' ohne Hinweis') : 'fehlt') + '|' + n;
  });
  await fall('ÄK-PR02', 'Windows-Taste allein mit Tastatursperre: Versuch', 'tried', async () => {
    const s = await imVollbild(); await s.keyboard.press('Meta'); await warte(50); const t = (await eintraege(s)).find(x => /Windows-Taste/.test(x.text)); await s.close(); return t ? t.kind : 'fehlt';
  });
  await fall('ÄK-PR03', 'Ohne Vollbild: Win+D ist ein normales Tastenkürzel', 'key|false', async () => {
    const s = await test(ctx, basis()); await s.keyboard.press('Meta+d'); await warte(50); const t = (await eintraege(s)).find(x => /Win\+D/.test(x.text)); await s.close();
    return t ? t.kind + '|' + /versucht/.test(t.text) : 'fehlt';
  });
  await fall('ÄK-PR04', 'Echtes Verlassen: Eintrag mit Rückkehr und Dauer', '1|true', async () => {
    const s = await imVollbild(); await s.evaluate(() => document.exitFullscreen()); await warte(300); await s.evaluate(() => window.__uhr(5000));
    await s.click('#zurueck-vollbild'); await s.waitForFunction(() => !!document.fullscreenElement); await warte(200);
    const e = await eintraege(s, 'screen'); await s.close(); return e.length + '|' + (!!e[0].fs && e[0].back - e[0].at >= 5000);
  });
  await fall('ÄK-PR05', 'PDF: Dauer, Gesamtzeit und offenes Verlassen bis zur Abgabe', 'true|true|true', async () => {
    const s = await imVollbild(); await s.evaluate(() => document.exitFullscreen()); await warte(300); await s.evaluate(() => window.__uhr(5000));
    await s.click('#zurueck-vollbild'); await s.waitForFunction(() => !!document.fullscreenElement); await warte(200);
    await s.evaluate(() => document.exitFullscreen()); await warte(300);
    const r = await abgeben(s); await s.close(); const t = pdfText(r.pdf);
    return [/Vollbild verlassen bis \d\d:\d\d:\d\d \(00:0[56] min\)/.test(t), /Vollbild verlassen\s+2 \(zusammen 00:0[56] min\)/.test(t), /Vollbild verlassen bis zur Abgabe/.test(t)].join('|');
  });
  await fall('ÄK-PR06', 'Versuch zählt im PDF unter eigener Überschrift', 'true|false', async () => {
    const s = await imVollbild(); await s.keyboard.press('Alt+Tab'); await warte(50); const r = await abgeben(s); await s.close(); const t = pdfText(r.pdf);
    return /Tastenkürzel versucht \(gesperrt\)\s+1/.test(t) + '|' + /Vollbild verlassen\s+\d/.test(t);
  });

  klasse('P2 Protokoll: Strg+Alt+Entf und Win+L');
  // Diese Tasten erreichen die Seite nie. Gemessen wird, welche Zusatztasten beim Fokusverlust gedrückt waren.
  const wegMit = async (s, tasten, vorher) => {
    await s.evaluate(() => window.__uhr(2000));   // Schonfrist nach dem Start vorbei
    for (const k of tasten) await s.keyboard.down(k);
    if (vorher) await s.evaluate(ms => window.__uhr(ms), vorher);
    await s.evaluate(() => window.dispatchEvent(new Event('blur'))); await s.evaluate(() => window.__uhr(3000));
    await s.evaluate(() => window.dispatchEvent(new Event('focus')));
    for (const k of tasten.slice().reverse()) await s.keyboard.up(k);
    return (await eintraege(s)).filter(e => e.type === 'switch');
  };
  await fall('ÄK-PR07', 'Strg+Alt gedrückt beim Verlassen: vermutlich Strg+Alt+Entf', 'Strg+Alt+Entf', async () => { const s = await test(ctx, basis()); const e = await wegMit(s, ['Control', 'Alt']); await s.close(); return e.length ? e[0].via : 'kein Eintrag'; });
  await fall('ÄK-PR08', 'Windows-Taste gedrückt beim Verlassen: vermutlich Win+L', 'true', async () => { const s = await test(ctx, basis()); const e = await wegMit(s, ['Meta']); await s.close(); return String(e.length > 0 && /^Win\+L/.test(e[0].via)); });
  await fall('ÄK-PR09', 'Ohne Zusatztaste: normaler Fensterwechsel', 'undefined', async () => { const s = await test(ctx, basis()); const e = await wegMit(s, []); await s.close(); return String(e.length ? e[0].via : 'kein Eintrag'); });
  await fall('GW-PR01', 'Nur Strg gedrückt: kein Strg+Alt+Entf', 'undefined', async () => { const s = await test(ctx, basis()); const e = await wegMit(s, ['Control']); await s.close(); return String(e.length ? e[0].via : 'kein Eintrag'); });
  await fall('GW-PR02', 'Strg+Alt vor 6 s gedrückt: zu alt, kein Hinweis', 'undefined', async () => { const s = await test(ctx, basis()); const e = await wegMit(s, ['Control', 'Alt'], 6000); await s.close(); return String(e.length ? e[0].via : 'kein Eintrag'); });
  await fall('ÄK-PR10', 'PDF nennt den Hinweis beim Fensterwechsel', 'true', async () => {
    const s = await test(ctx, basis()); await wegMit(s, ['Control', 'Alt']); const r = await abgeben(s); await s.close(); return String(/Testfenster verlassen \(vermutlich Strg\+Alt\+Entf\) bis/.test(pdfText(r.pdf)));
  });

  klasse('D1 Kontrolldatei, Auswahlfelder, Anleitung');
  await fall('ÄK-DO01', 'Kontrolldatei ist eingerückt', 'true', async () => { const { j } = await beide(ctx, basis()); return String(/^\{\n  "art": "smue-kontrolle"/.test(fs.readFileSync(j, 'utf8'))); });
  await fall('ÄK-DO02', 'Eingerückte Kontrolldatei lädt im Prüf-Tool', 'true', async () => {
    const { j } = await beide(ctx, basis()); const p = await master(ctx, basis()); await p.click('#knopf-pruefen'); await p.setInputFiles('#datei-kontrolle', j); await warte(300);
    const t = await p.textContent('#pruef-kontrolle'); await p.close(); return String(/^Geladen: Grenztest/.test(t));
  });
  await fall('GW-DO01', 'Auswahlfeld in Tabelle so breit wie der längste Eintrag', 'true', async () => {
    const lang = 'Richtung des Pins festlegen';
    const q = { id: 'q1', type: 'table', prompt: 'T', points: 1, table: { head: ['A', 'B'], rows: [[{ t: 'x' }, { t: lang, fill: true }]] }, choices: lang + ', kurz', caseSensitive: false, typo: false };
    const s = await test(ctx, basis({ questions: [q] })); await s.selectOption('.aufgabe-tabelle select', lang);
    const r = await s.evaluate(t => { const el = document.querySelector('.aufgabe-tabelle select'), c = document.createElement('canvas').getContext('2d'); c.font = getComputedStyle(el).font; return el.clientWidth >= c.measureText(t).width; }, lang);
    await s.close(); return String(r);
  });
  const anleitung = async () => { const p = await master(ctx, basis()); const t = await p.textContent('#anleitung'); await p.close(); return t; };
  await fall('ÄK-DO03', 'Anleitung: nur die HTML-Datei für Schüler, Kontrolldatei erklärt', 'true', async () => { const t = await anleitung(); return String(/Wer bekommt sie\?/.test(t) && /nur die HTML-Datei/.test(t) && /Was steckt in der Kontrolldatei\?/.test(t)); });
  await fall('ÄK-DO04', 'Anleitung beschreibt Überspringen, Abgabe-Stufen, Unterlagen und Protokolleinträge', 'true', async () => {
    const t = await anleitung(); return String(['Eine Frage pro Seite und Überspringen', 'Was Schüler nach der Abgabe sehen', 'Unterlagen (PDF) im Test', 'versucht, gesperrt', 'vermutlich Strg+Alt+Entf'].every(w => t.includes(w)));
  });
  await ctx.close();
};

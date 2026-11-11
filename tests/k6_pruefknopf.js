// Testklassen für den Prüfknopf
const fs = require('fs'), path = require('path');
const C = require('../src/core.js');
const H = require('./hilfsmittel');
const { fall, klasse, basis, kontext, master, datei, akzeptiert, schueler, abgeben, warte, protokoll, pdfText, TMP } = H;
const fq = (i, o) => Object.assign({ id: 'q' + i, type: 'text', prompt: 'Frage ' + i, points: 1, accepted: ['ja'], distractors: [], caseSensitive: false, typo: false }, o);
const drei = [fq(1), fq(2), fq(3)];
const opt = (art, n, mehr) => basis(Object.assign({ pruefAn: true, pruefArt: art, pruefZahl: n, questions: drei }, mehr || {}));
const test = async (ctx, d) => schueler(ctx, await datei(ctx, d));
const knopf = (s, i) => s.locator('#pruef-q' + i);
const tippe = async (s, i, t) => { await s.fill('#a-q' + i, t); };
const stand = async (s, i) => (await knopf(s, i).isDisabled() ? 'gesperrt' : 'frei') + ': ' + await knopf(s, i).textContent();

module.exports = async function () {
  const ctx = await kontext();
  klasse('K1 Einstellung im Master');
  const A = d => akzeptiert(ctx, d);
  await fall('ÄK-K01', 'Standard: Prüfknopf aus', '0', async () => { const s = await schueler(ctx, await datei(ctx, basis())); const n = await s.locator('.pruefzeile').count(); await s.close(); return String(n); });
  await fall('ÄK-K02', 'Einschalten zeigt Art und Anzahl', 'true', async () => {
    const p = await master(ctx, basis()); await p.check('#pruef-an'); const r = await p.locator('#pruef-art-gesamt').isVisible() && await p.locator('#pruef-anzahl').isVisible(); await p.close(); return String(r);
  });
  await fall('ÄK-K03', 'Einstellung bleibt im Entwurf', 'frage|3', async () => {
    const p = await master(ctx, basis()); await p.check('#pruef-an'); await p.check('#pruef-art-frage'); await p.fill('#pruef-anzahl', '3'); await p.reload(); await warte(100);
    const r = (await p.isChecked('#pruef-art-frage') ? 'frage' : 'gesamt') + '|' + await p.inputValue('#pruef-anzahl'); await p.close(); return r;
  });
  await fall('ÄK-K04', 'Alter Entwurf ohne Einstellung: Knopf bleibt aus', 'false', async () => { const p = await master(ctx, basis()); const r = await p.isChecked('#pruef-an'); await p.close(); return String(r); });
  await fall('GW-K01', 'Anzahl 0', 'abgelehnt', () => A(opt('gesamt', 0)));
  await fall('GW-K02', 'Anzahl 1', 'angenommen', () => A(opt('gesamt', 1)));
  await fall('GW-K03', 'Anzahl 99', 'angenommen', () => A(opt('frage', 99)));
  await fall('GW-K04', 'Anzahl 100', 'abgelehnt', () => A(opt('gesamt', 100)));
  await fall('GW-K05', 'Anzahl -1', 'abgelehnt', () => A(opt('gesamt', -1)));
  await fall('GW-K06', 'Anzahl 1,5', 'abgelehnt', () => A(opt('frage', 1.5)));
  await fall('ÄK-K05', 'Anzahl ist egal, solange der Knopf aus ist', 'angenommen', () => A(basis({ pruefAn: false, pruefZahl: 0 })));
  await fall('ÄK-K06', 'Tooltips erklären beide Arten', 'true', async () => {
    const p = await master(ctx, basis()); await p.check('#pruef-an'); await p.locator('label:has(#pruef-art-frage)').hover(); await warte(200); await p.locator('label:has(#pruef-art-frage)').hover({ position: { x: 8, y: 8 } }); await warte(450); const t = await p.textContent('#hilfe-tip'); await p.close(); return String(/eigene Anzahl/.test(t));
  });
  await fall('ÄK-K07', 'Anleitung beschreibt den Prüfknopf', 'true', async () => { const p = await master(ctx, basis()); const t = await p.textContent('#anleitung'); await p.close(); return String(/Prüfknopf für Schüler/.test(t)); });

  klasse('K2 Anzahl für alle Fragen zusammen');
  await fall('GW-K07', 'Anzeige beim Start', 'frei: Prüfen (noch 2)', async () => { const s = await test(ctx, opt('gesamt', 2)); const r = await stand(s, 3); await s.close(); return r; });
  await fall('GW-K08', '1 von 2 benutzt: alle Knöpfe zeigen noch 1', 'frei: Prüfen (noch 1)', async () => {
    const s = await test(ctx, opt('gesamt', 2)); await tippe(s, 1, 'ja'); await knopf(s, 1).click(); const r = await stand(s, 3); await s.close(); return r;
  });
  await fall('GW-K09', '2 von 2 benutzt: alle Knöpfe gesperrt', 'gesperrt: Prüfen (aufgebraucht)|gesperrt: Prüfen (aufgebraucht)|gesperrt: Prüfen (aufgebraucht)', async () => {
    const s = await test(ctx, opt('gesamt', 2)); await tippe(s, 1, 'ja'); await knopf(s, 1).click(); await tippe(s, 2, 'x'); await knopf(s, 2).click();
    const r = [await stand(s, 1), await stand(s, 2), await stand(s, 3)].join('|'); await s.close(); return r;
  });
  await fall('GW-K10', 'Anzahl 1: nach einer Prüfung alles gesperrt', 'gesperrt: Prüfen (aufgebraucht)', async () => { const s = await test(ctx, opt('gesamt', 1)); await tippe(s, 2, 'x'); await knopf(s, 2).click(); const r = await stand(s, 1); await s.close(); return r; });
  await fall('ÄK-K08', 'Gesperrter Knopf ist auch per Skript-Klick wirkungslos', '1', async () => {
    const s = await test(ctx, opt('gesamt', 1)); await tippe(s, 1, 'ja'); await knopf(s, 1).click(); await tippe(s, 2, 'ja');
    await s.evaluate(() => { const b = document.getElementById('pruef-q2'); b.disabled = false; b.click(); }); await warte(50);
    const n = (await protokoll(s)).filter(e => e.kind === 'check').length; await s.close(); return String(n);
  });
  await fall('GW-K11', 'Anzahl 99 lässt sich nicht überziehen', 'frei: Prüfen (noch 98)', async () => { const s = await test(ctx, opt('gesamt', 99)); await tippe(s, 1, 'x'); await knopf(s, 1).click(); const r = await stand(s, 1); await s.close(); return r; });

  klasse('K3 Anzahl je Frage');
  await fall('GW-K12', 'Einmal je Frage: geprüfte Frage gesperrt, andere frei', 'gesperrt: Prüfen (aufgebraucht)|frei: Prüfen (noch 1)', async () => {
    const s = await test(ctx, opt('frage', 1)); await tippe(s, 1, 'x'); await knopf(s, 1).click(); const r = await stand(s, 1) + '|' + await stand(s, 2); await s.close(); return r;
  });
  await fall('GW-K13', 'Zweimal je Frage: nach zwei Prüfungen gesperrt', 'gesperrt: Prüfen (aufgebraucht)', async () => {
    const s = await test(ctx, opt('frage', 2)); await tippe(s, 1, 'x'); await knopf(s, 1).click(); await tippe(s, 1, 'y'); await knopf(s, 1).click(); const r = await stand(s, 1); await s.close(); return r;
  });
  await fall('ÄK-K09', 'Alle Fragen je einmal prüfbar', '3', async () => {
    const s = await test(ctx, opt('frage', 1)); for (const i of [1, 2, 3]) { await tippe(s, i, 'x'); await knopf(s, i).click(); } const n = (await protokoll(s)).filter(e => e.kind === 'check').length; await s.close(); return String(n);
  });

  klasse('K4 Rückmeldung');
  const rueck = async (d, id, tun) => { const s = await test(ctx, d); await tun(s); await knopf(s, id).click(); const t = await s.textContent('#pruef-msg-q' + id); await s.close(); return t; };
  await fall('ÄK-K10', 'Richtige Antwort', 'Richtig', () => rueck(opt('gesamt', 2), 1, s => tippe(s, 1, 'ja')));
  await fall('ÄK-K11', 'Falsche Antwort', 'Nicht richtig', () => rueck(opt('gesamt', 2), 1, s => tippe(s, 1, 'nein')));
  const multi = { id: 'q1', type: 'multi', prompt: 'F', points: 2, options: [{ text: 'A', correct: true }, { text: 'B', correct: true }, { text: 'C', correct: false }] };
  await fall('ÄK-K12', 'Teilweise richtige Mehrfachauswahl', 'Teilweise richtig', () => rueck(opt('gesamt', 2, { questions: [multi] }), 1, s => s.check('#a-q1-0')));
  const typen = [['Zahl', { id: 'q1', type: 'number', prompt: 'F', points: 1, value: '9', tol: '', unit: '' }, s => s.fill('#a-q1', '9')],
    ['Einfachauswahl', { id: 'q1', type: 'single', prompt: 'F', points: 1, options: [{ text: 'A', correct: true }, { text: 'B', correct: false }] }, s => s.check('#a-q1-0')],
    ['Richtig/Falsch', { id: 'q1', type: 'tf', prompt: 'F', points: 1, answer: true }, s => s.check('#a-q1-0')],
    ['Lückentext', { id: 'q1', type: 'cloze', prompt: 'A {b}', points: 1, caseSensitive: false, typo: false }, s => s.fill('#a-q1-0', 'b')]];
  for (const [i, [n, q, f]] of typen.entries()) await fall('ÄK-K1' + (3 + i), 'Fragenart ' + n, 'Richtig', () => rueck(opt('gesamt', 1, { questions: [q] }), 1, f));
  await fall('ÄK-K17', 'Die Lösung wird nicht verraten', 'false', async () => {
    const s = await test(ctx, opt('gesamt', 2, { questions: [fq(1, { accepted: ['ZZLOES'] })] })); await tippe(s, 1, 'x'); await knopf(s, 1).click(); const b = (await s.textContent('body')).includes('ZZLOES'); await s.close(); return String(b);
  });
  await fall('ÄK-K18', 'Leere Antwort kostet nichts', 'Trag zuerst eine Antwort ein.|frei: Prüfen (noch 1)', async () => {
    const s = await test(ctx, opt('gesamt', 1)); await knopf(s, 1).click(); const r = await s.textContent('#pruef-msg-q1') + '|' + await stand(s, 1); await s.close(); return r;
  });
  await fall('ÄK-K19', 'Dieselbe Antwort erneut prüfen kostet nichts', 'frei: Prüfen (noch 1)', async () => {
    const s = await test(ctx, opt('gesamt', 2)); await tippe(s, 1, 'x'); await knopf(s, 1).click(); await knopf(s, 1).click(); const r = await stand(s, 1); await s.close(); return r;
  });
  await fall('ÄK-K20', 'Geänderte Antwort löscht die alte Rückmeldung', '', async () => {
    const s = await test(ctx, opt('gesamt', 2)); await tippe(s, 1, 'ja'); await knopf(s, 1).click(); await tippe(s, 1, 'jaa'); const t = await s.textContent('#pruef-msg-q1'); await s.close(); return t;
  });
  await fall('ÄK-K21', 'Zurück zur geprüften Antwort zeigt die Rückmeldung wieder', 'Richtig', async () => {
    const s = await test(ctx, opt('gesamt', 2)); await tippe(s, 1, 'ja'); await knopf(s, 1).click(); await tippe(s, 1, 'jaa'); await tippe(s, 1, 'ja'); const t = await s.textContent('#pruef-msg-q1'); await s.close(); return t;
  });

  klasse('K5 Neuladen, Wertung, Abgabe');
  await fall('ÄK-K22', 'Neuladen gibt keine Prüfung zurück', 'gesperrt: Prüfen (aufgebraucht)', async () => {
    const s = await test(ctx, opt('gesamt', 1)); await tippe(s, 1, 'ja'); await knopf(s, 1).click(); await s.reload(); await s.waitForSelector('.uhr'); const r = await stand(s, 2); await s.close(); return r;
  });
  await fall('ÄK-K23', 'Rückmeldung bleibt nach Neuladen sichtbar', 'Richtig', async () => {
    const s = await test(ctx, opt('gesamt', 2)); await tippe(s, 1, 'ja'); await knopf(s, 1).click(); await s.reload(); await s.waitForSelector('.uhr'); const t = await s.textContent('#pruef-msg-q1'); await s.close(); return t;
  });
  await fall('ÄK-K24', 'Prüfen ändert die Punkte nicht', '1 von 3 Punkten', async () => {
    const s = await test(ctx, opt('frage', 1)); await tippe(s, 1, 'ja'); await knopf(s, 1).click(); await tippe(s, 2, 'x'); await knopf(s, 2).click(); const r = await abgeben(s); await s.close(); return (/\d+ von \d+ Punkten/.exec(pdfText(r.pdf)) || [''])[0];
  });
  await fall('ÄK-K25', 'Nach falscher Prüfung korrigierte Antwort zählt', '1 von 3 Punkten', async () => {
    const s = await test(ctx, opt('gesamt', 1)); await tippe(s, 1, 'x'); await knopf(s, 1).click(); await tippe(s, 1, 'ja'); const r = await abgeben(s); await s.close(); return (/\d+ von \d+ Punkten/.exec(pdfText(r.pdf)) || [''])[0];
  });
  await fall('ÄK-K26', 'PDF nennt die Anzahl und das Protokoll die Prüfung', 'true', async () => {
    const s = await test(ctx, opt('gesamt', 2)); await tippe(s, 1, 'x'); await knopf(s, 1).click(); const r = await abgeben(s); await s.close(); const t = pdfText(r.pdf); return String(/Prüfknopf benutzt\s+1 Mal/.test(t) && /Antwort geprüft: Nicht richtig/.test(t));
  });
  await fall('ÄK-K27', 'Nach der Abgabe gibt es keinen Prüfknopf', '0', async () => { const s = await test(ctx, opt('gesamt', 2)); await abgeben(s); const n = await s.locator('.pruefzeile').count(); await s.close(); return String(n); });
  await fall('ÄK-K28', 'Abgabe mit Prüfknopf bleibt bei der Prüfung echt', 'echt', async () => {
    const m = await master(ctx, opt('frage', 1)); const dl = []; m.on('download', d => dl.push(d)); await m.click('#knopf-erzeugen'); for (let i = 0; i < 60 && dl.length < 2; i++) await warte(50);
    const f = path.join(TMP, Math.random().toString(36).slice(2) + '.html'), j = f + '.json'; await dl[0].saveAs(f); await dl[1].saveAs(j); await m.close();
    const c = await kontext(); const s = await schueler(c, f); await tippe(s, 1, 'ja'); await knopf(s, 1).click(); const r = await abgeben(s); await c.close();
    return C.pruefen(new Uint8Array(fs.readFileSync(r.pdf)), JSON.parse(fs.readFileSync(j, 'utf8'))).status;
  });
  await fall('ÄK-K29', 'Mit Protokoll aus: Prüfknopf läuft, Zähler im PDF stimmt', 'true', async () => {
    const s = await test(ctx, opt('gesamt', 2, { logBlur: false })); await tippe(s, 1, 'x'); await knopf(s, 1).click(); const r = await abgeben(s); await s.close(); return String(/Prüfknopf benutzt\s+1 Mal/.test(pdfText(r.pdf)));
  });
  await fall('GW-K14', 'Handybreite 320 px: Prüfzeile läuft nicht über', 'false', async () => {
    const s = await test(ctx, opt('gesamt', 99)); await s.setViewportSize({ width: 320, height: 700 }); await warte(80); const r = await s.evaluate(() => document.documentElement.scrollWidth > innerWidth); await s.close(); return String(r);
  });
  await ctx.close();
};

// Testklassen für den PDF-Export aus dem Lehrer-Programm
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const H = require('./hilfsmittel');
const { fall, klasse, basis, kontext, master, warte, pdfText, pdfSeiten, pdfWoerter, TMP } = H;

const TEXT = o => Object.assign({ id: 'q1', type: 'text', prompt: 'Landeshauptstadt von Tirol?', points: 1, accepted: ['ZZINNSBRUCK'], distractors: [], caseSensitive: false, typo: false }, o);
const alle = () => [
  TEXT(),
  { id: 'q2', type: 'number', prompt: 'Wie viele Bundesländer?', points: 1, value: '9', tol: '0,5', unit: 'Stück' },
  { id: 'q3', type: 'single', prompt: 'Fluss durch Wien?', points: 1, options: [{ text: 'ZZDONAU', correct: true }, { text: 'Inn', correct: false }] },
  { id: 'q4', type: 'multi', prompt: 'Nachbarstaaten?', points: 2, options: [{ text: 'Italien', correct: true }, { text: 'Polen', correct: false }] },
  { id: 'q5', type: 'tf', prompt: 'Der Großglockner ist der höchste Berg.', points: 1, answer: true },
  { id: 'q6', type: 'cloze', prompt: 'Graz liegt in der {ZZSTEIERMARK|~Tirol|~Salzburg}.', points: 1, caseSensitive: false, typo: false },
  { id: 'q7', type: 'table', prompt: 'Vervollständige A ∧ B.', points: 2, choices: '0, 1', caseSensitive: false, typo: false,
    table: { head: ['A', 'B', 'A ∧ B'], rows: [['0', '0', '0'], ['1', '1', '1']].map(r => [{ t: r[0] }, { t: r[1] }, { t: r[2], fill: true }]) } }
];
async function exportiere(ctx, d, art) {
  const p = await master(ctx, d); const dl = p.waitForEvent('download', { timeout: 5000 });
  await p.click('#knopf-export'); await p.click(art === 'loesung' ? '#export-loesung' : '#export-angabe');
  const x = await dl; const f = path.join(TMP, Math.random().toString(36).slice(2) + '.pdf'); await x.saveAs(f); await p.close();
  return { pdf: f, name: x.suggestedFilename() };
}
const imSeite = f => pdfWoerter(f).flat().every(w => w.x1 <= 595.3 && w.y1 <= 841.9 && w.x0 >= 0);

module.exports = async function () {
  const ctx = await kontext();
  klasse('X1 Angabe');
  const a = await exportiere(ctx, basis({ questions: alle(), grading: { on: true, thresholds: [88, 75, 63, 50] } }), 'angabe');
  const ta = pdfText(a.pdf);
  await fall('ÄK-X01', 'Angabe ist ein gültiges PDF', 'true', async () => { execFileSync('qpdf', ['--check', a.pdf]); return 'true'; });
  await fall('ÄK-X02', 'Dateiname nennt Titel, Klasse und Angabe', 'Smue_Grenztest_1A_Angabe.pdf', async () => a.name);
  await fall('ÄK-X03', 'Alle 7 Fragen stehen in der Angabe', 'true', async () => String(['Tirol', 'Bundesländer', 'Fluss', 'Nachbarstaaten', 'Großglockner', 'Graz liegt', 'Vervollständige'].every(t => ta.includes(t))));
  await fall('ÄK-X04', 'Keine Lösung in der Angabe', 'false', async () => String(/ZZINNSBRUCK|±|\[ZZSTEIERMARK\]/.test(ta)));
  await fall('ÄK-X05', 'Antwortmöglichkeiten stehen da, ohne Markierung', 'true', async () => String(ta.includes('ZZDONAU') && !/[●■]/.test(ta)));
  await fall('ÄK-X06', 'Felder für Name, Klasse, Datum und Note', 'true', async () => String(/Name:/.test(ta) && /Klasse:/.test(ta) && /Datum:/.test(ta) && /Note:/.test(ta)));
  await fall('ÄK-X07', 'Lückentext mit Strich und Auswahl in Klammern', 'true', async () => String(/__________ \(Salzburg \/ Tirol \/ ZZSTEIERMARK\)/.test(ta.replace(/\s+/g, ' '))));
  await fall('ÄK-X08', 'Tabelle mit Überschrift und Auswahlhinweis, Ergebniszellen leer', 'true', async () => String(/A ?∧ ?B/.test(ta) && /0, 1/.test(ta)));
  await fall('ÄK-X09', 'Punkte je Frage und Summe', 'true', async () => String(/Punkte: 9/.test(ta) && /2 Punkte/.test(ta) && /1 Punkt\b/.test(ta)));
  await fall('ÄK-X10', 'Einheit steht neben der Antwortlinie', 'true', async () => String(/Stück/.test(ta)));
  await fall('GW-X01', 'Alle Wörter liegen innerhalb der Seite', 'true', async () => String(imSeite(a.pdf)));

  klasse('X2 Lösungsblatt');
  const l = await exportiere(ctx, basis({ questions: alle(), grading: { on: true, thresholds: [88, 75, 63, 50] } }), 'loesung');
  const tl = pdfText(l.pdf), tl1 = tl.replace(/\s+/g, ' ');
  await fall('ÄK-X11', 'Dateiname endet auf _Loesung.pdf', 'true', async () => String(/_Loesung\.pdf$/.test(l.name)));
  await fall('ÄK-X12', 'Lösungen aller Fragenarten stehen drin', 'true', async () => String(['ZZINNSBRUCK', '9 Stück (± 0,5)', '[ZZSTEIERMARK]', 'Lösungsblatt'].every(t => tl1.includes(t))));
  await fall('ÄK-X13', 'Richtige Auswahl ist markiert', 'true', async () => String(/● ?ZZDONAU/.test(tl1) && /■ ?Italien/.test(tl1) && /□ ?Polen/.test(tl1) && /● ?Richtig/.test(tl1)));
  await fall('ÄK-X14', 'Tabelle mit eingetragenen Lösungen', 'true', async () => { const z = tl.split('\n').filter(x => /^\s*1\s+1\s+1\s*$/.test(x)); return String(z.length === 1); });
  await fall('ÄK-X15', 'Notenschlüssel mit Punktegrenzen', 'true', async () => String(/Notenschlüssel/.test(tl) && /1 Sehr gut ab 88 % 8 bis 9 Punkte/.test(tl1) && /5 Nicht genügend unter 50 % 0 bis 4 Punkte/.test(tl1)));
  await fall('GW-X02', 'Notenschlüssel: Grenzen lückenlos bei 25 Punkten', 'true', async () => {
    const q = [TEXT({ points: 25 })]; const r = await exportiere(ctx, basis({ questions: q, grading: { on: true, thresholds: [88, 75, 63, 50] } }), 'loesung'); const t = pdfText(r.pdf).replace(/\s+/g, ' ');
    return String(['22 bis 25', '19 bis 21,5', '16 bis 18,5', '12,5 bis 15,5', '0 bis 12'].every(x => t.includes(x)));
  });
  await fall('ÄK-X16', 'Ohne Notenschlüssel kein Notenschlüssel und kein Notenfeld', 'false', async () => {
    const r = await exportiere(ctx, basis({ questions: alle() }), 'loesung'); const r2 = await exportiere(ctx, basis({ questions: alle() }), 'angabe');
    return String(/Notenschlüssel/.test(pdfText(r.pdf)) || /Note:/.test(pdfText(r2.pdf)));
  });
  await fall('ÄK-X17', 'Kurzantwort mit Auswahl: richtige markiert', 'true', async () => {
    const r = await exportiere(ctx, basis({ questions: [TEXT({ distractors: ['Graz', 'Linz'] })] }), 'loesung'); return String(/● ?ZZINNSBRUCK/.test(pdfText(r.pdf).replace(/\s+/g, ' ')));
  });

  klasse('X3 Grenzen und Prüfung');
  await fall('ÄK-X18', 'Unvollständiger Test wird nicht exportiert', 'true', async () => {
    const p = await master(ctx, basis({ questions: [TEXT({ accepted: [] })] })); await p.click('#knopf-export'); await warte(100);
    const t = await p.textContent('#dialog'); await p.close(); return String(/fehlt/.test(t));
  });
  await fall('GW-X03', '1 Frage ergibt 1 Seite', '1', async () => String(pdfSeiten((await exportiere(ctx, basis(), 'angabe')).pdf)));
  await fall('GW-X04', '200 Fragen: alle drin, Seitenzahlen stimmen', 'true', async () => {
    const q = [...Array(200)].map((_, i) => TEXT({ id: 'q' + i, prompt: 'Frage Nummer ' + (i + 1) })); const r = await exportiere(ctx, basis({ questions: q }), 'angabe'); const t = pdfText(r.pdf), n = pdfSeiten(r.pdf);
    return String(/Frage Nummer 200/.test(t) && t.includes('Seite ' + n + ' von ' + n) && imSeite(r.pdf));
  });
  await fall('GW-X05', 'Sehr lange Frage und Antwort bleiben in der Seite', 'true', async () => {
    const r = await exportiere(ctx, basis({ questions: [TEXT({ prompt: 'Wort '.repeat(1200), accepted: ['x'.repeat(500)] })] }), 'loesung'); return String(imSeite(r.pdf));
  });
  await fall('GW-X06', 'Tabelle 8 × 32 mit langen Texten bleibt in der Seite', 'true', async () => {
    const q = { id: 'q1', type: 'table', prompt: 'T', points: 1, choices: '', caseSensitive: false, typo: false, table: { head: Array(8).fill('Überschrift lang'), rows: Array(32).fill(0).map(() => Array(8).fill(0).map((_, c) => ({ t: c === 7 ? 'lösung sehr lang' : 'inhalt sehr lang', fill: c === 7 }))) } };
    const r = await exportiere(ctx, basis({ questions: [q] }), 'loesung'); return String(imSeite(r.pdf) && pdfSeiten(r.pdf) >= 2);
  });
  await fall('ÄK-X19', 'Bild der Frage steht in Angabe und Lösung', 'true', async () => {
    const p = await ctx.newPage(); const d = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 300; const x = c.getContext('2d'); x.fillStyle = '#c33'; x.fillRect(0, 0, 400, 300); return c.toDataURL('image/jpeg', 0.8); }); await p.close();
    const q = [TEXT({ image: { data: d, w: 400, h: 300, alt: '' } })];
    const n = f => execFileSync('pdfimages', ['-list', f]).toString().split('\n').slice(2).filter(Boolean).length;
    return String(n((await exportiere(ctx, basis({ questions: q }), 'angabe')).pdf) === 1 && n((await exportiere(ctx, basis({ questions: q }), 'loesung')).pdf) === 1);
  });
  await fall('ÄK-X20', 'Gemischter Test: Export in Entwurfsreihenfolge', 'true', async () => {
    const q = [...Array(6)].map((_, i) => TEXT({ id: 'q' + i, prompt: 'Reihenfolge ' + i })); const t = pdfText((await exportiere(ctx, basis({ shuffleQ: true, questions: q }), 'angabe')).pdf);
    const pos = q.map((_, i) => t.indexOf('Reihenfolge ' + i)); return String(pos.every((p, i) => p >= 0 && (i === 0 || p > pos[i - 1])));
  });
  await fall('ÄK-X21', 'Umlaute und Sonderzeichen im Titel', 'true', async () => {
    const r = await exportiere(ctx, basis({ title: 'Prüfung: √ π ≤ Ж', questions: [TEXT()] }), 'angabe'); return String(pdfText(r.pdf).includes('Prüfung: √ π ≤ Ж') && /^Smue_Pruefung/.test(r.name));
  });
  await fall('ÄK-X22', 'Tooltip und Anleitung beschreiben den Export', 'true', async () => {
    const p = await master(ctx, basis()); await p.hover('#knopf-export'); await warte(450); const t = await p.textContent('#hilfe-tip'); const a = await p.textContent('#anleitung'); await p.close();
    return String(/Lösungsblatt/.test(t) && /Test als PDF exportieren/.test(a));
  });
  await ctx.close();
};

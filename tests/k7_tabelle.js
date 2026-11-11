// Testklassen für die Fragenart Tabelle ausfüllen
const fs = require('fs'), path = require('path');
const C = require('../src/core.js');
const H = require('./hilfsmittel');
const { fall, klasse, basis, kontext, master, datei, akzeptiert, schueler, abgeben, warte, pdfText, pdfWoerter, TMP } = H;

// UND-Wahrheitstabelle: Ergebnis-Spalte ausfüllen
const und = (o) => Object.assign({ id: 'q1', type: 'table', prompt: 'Vervollständige die Tabelle für A ∧ B.', points: 2, caseSensitive: false, typo: false, choices: '0, 1',
  table: { head: ['A', 'B', 'A ∧ B'], rows: [['0', '0', '0'], ['0', '1', '0'], ['1', '0', '0'], ['1', '1', '1']].map(r => [{ t: r[0] }, { t: r[1] }, { t: r[2], fill: true }]) } }, o || {});
const frei = (o) => und(Object.assign({ choices: '' }, o || {}));
const e = (q, a) => C.grade(q, a).earned;
const ok4 = ['0', '0', '0', '1'];

module.exports = async function () {
  klasse('TB1 Bewertung');
  await fall('ÄK-TB01', 'Alle Zellen richtig', 2, () => e(und(), ok4));
  await fall('ÄK-TB02', 'Keine Zelle richtig', 0, () => e(und(), ['1', '1', '1', '0']));
  await fall('ÄK-TB03', 'Leere Tabelle gilt als unbeantwortet', 'empty', () => C.grade(und(), ['', '', '', '']).status);
  await fall('ÄK-TB04', 'Zwei von vier richtig', 1, () => e(und(), ['0', '0', '1', '0']));
  await fall('GW-TB01', 'Drei von vier richtig bei 2 Punkten: 1,5, nie voll', 1.5, () => e(und(), ['0', '0', '0', '0']));
  await fall('GW-TB02', 'Drei von vier richtig bei 1 Punkt: 0,5', 0.5, () => e(und({ points: 1 }), ['0', '0', '0', '0']));
  await fall('ÄK-TB05', 'Alternative Lösung mit |', 2, () => e(frei({ table: { head: ['x'], rows: [[{ t: '1|W', fill: true }], [{ t: 'F|0', fill: true }]] } }), ['w', '0']));
  await fall('ÄK-TB06', 'Leerzeichen um die Antwort stören nicht', 2, () => e(und(), [' 0', '0 ', '0', ' 1 ']));
  await fall('ÄK-TB07', 'Groß- und Kleinschreibung mit Option', 0, () => e(frei({ caseSensitive: true, points: 1, table: { head: ['x'], rows: [[{ t: 'W', fill: true }]] } }), ['w']));
  await fall('ÄK-TB08', 'Vorgegebene Zellen zählen nicht als Lücken', 4, () => C.tableGaps(und()).length);
  await fall('GW-TB03', 'Größte Tabelle 8 × 32 = 256 Zellen', 256, () => C.tableGaps({ table: { head: Array(8).fill(''), rows: Array(32).fill(0).map(() => Array(8).fill(0).map(() => ({ t: 'x', fill: true }))) } }).length);
  await fall('ÄK-TB09', 'Auswahlliste aus Komma oder Strichpunkt', '0|1|2', () => C.tableChoices({ choices: '0, 1; 2' }).join('|'));

  const ctx = await kontext();
  klasse('TB2 Master');
  const A = q => akzeptiert(ctx, basis({ questions: [q] }));
  await fall('ÄK-TB10', 'Neue Tabellenfrage ist eine Wahrheitstabelle mit 2 Variablen', 'A|B|Ergebnis|4', async () => {
    const p = await master(ctx, basis({ questions: [] })); await p.click('#neu-table');
    const d = await p.evaluate(() => JSON.parse(localStorage.getItem('smue-master-entwurf')).questions[0]); await p.close(); return d.table.head.join('|') + '|' + d.table.rows.length;
  });
  const wt = async (n) => {
    const p = await master(ctx, basis({ questions: [] })); await p.click('#neu-table'); const id = await p.evaluate(() => JSON.parse(localStorage.getItem('smue-master-entwurf')).questions[0].id);
    await p.selectOption(`#q-${id}-wt-n`, String(n)); await p.click(`#q-${id}-wt`);
    const d = await p.evaluate(() => JSON.parse(localStorage.getItem('smue-master-entwurf')).questions[0]); await p.close();
    return d.table.rows.length + ' Zeilen, ' + d.table.head.length + ' Spalten, letzte Zeile ' + d.table.rows[d.table.rows.length - 1].map(c => c.t || '_').join('');
  };
  await fall('GW-TB04', 'Wahrheitstabelle mit 1 Variable', '2 Zeilen, 2 Spalten, letzte Zeile 1_', () => wt(1));
  await fall('GW-TB05', 'Wahrheitstabelle mit 4 Variablen', '16 Zeilen, 5 Spalten, letzte Zeile 1111_', () => wt(4));
  await fall('ÄK-TB11', 'Zelle umschalten auf ausfüllen und zurück', 'true|false', async () => {
    const p = await master(ctx, basis({ questions: [und()] })); await p.click('#q-q1-z0-s0-art'); const a = await p.evaluate(() => !!JSON.parse(localStorage.getItem('smue-master-entwurf')).questions[0].table.rows[0][0].fill);
    await p.click('#q-q1-z0-s0-art'); const b = await p.evaluate(() => !!JSON.parse(localStorage.getItem('smue-master-entwurf')).questions[0].table.rows[0][0].fill); await p.close(); return a + '|' + b;
  });
  const groesse = async (sp, ze) => {
    const p = await master(ctx, basis({ questions: [und()] })); await p.fill('#q-q1-spalten', String(sp)); await p.press('#q-q1-spalten', 'Tab'); await warte(50);
    await p.fill('#q-q1-zeilen', String(ze)); await p.press('#q-q1-zeilen', 'Tab'); await warte(50);
    const t = await p.evaluate(() => JSON.parse(localStorage.getItem('smue-master-entwurf')).questions[0].table); await p.close(); return t.head.length + '×' + t.rows.length;
  };
  await fall('GW-TB06', 'Spalten 0 und Zeilen 0 werden zu 1 × 1', '1×1', () => groesse(0, 0));
  await fall('GW-TB07', 'Spalten 8 und Zeilen 32', '8×32', () => groesse(8, 32));
  await fall('GW-TB08', 'Spalten 9 und Zeilen 33 werden auf 8 × 32 begrenzt', '8×32', () => groesse(9, 33));
  await fall('ÄK-TB12', 'Vergrößern behält vorhandene Inhalte', 'A ∧ B|1', async () => {
    const p = await master(ctx, basis({ questions: [und()] })); await p.fill('#q-q1-spalten', '5'); await p.press('#q-q1-spalten', 'Tab'); await warte(50);
    const t = await p.evaluate(() => JSON.parse(localStorage.getItem('smue-master-entwurf')).questions[0].table); await p.close(); return t.head[2] + '|' + t.rows[3][2].t;
  });
  await fall('ÄK-TB13', 'Gültige Tabelle wird angenommen', 'angenommen', () => A(und()));
  await fall('ÄK-TB14', 'Ohne Zelle zum Ausfüllen', 'abgelehnt', () => A(und({ table: { head: ['A'], rows: [[{ t: '1' }]] } })));
  await fall('ÄK-TB15', 'Gelbe Zelle ohne Lösung', 'abgelehnt', () => A(und({ table: { head: ['A'], rows: [[{ t: '', fill: true }]] } })));
  await fall('ÄK-TB16', 'Lösung fehlt in der Auswahl', 'abgelehnt', () => A(und({ choices: 'W, F' })));
  await fall('ÄK-TB17', 'Lösung steht in der Auswahl in anderer Schreibung', 'angenommen', () => A(und({ choices: 'w, f', table: { head: ['A'], rows: [[{ t: 'W', fill: true }]] } })));
  await fall('ÄK-TB18', 'Entwurf mit kaputter Tabelle wird abgewiesen', 'true', async () => {
    const p = await master(ctx); const f = path.join(TMP, 't.json'); fs.writeFileSync(f, JSON.stringify(basis({ questions: [und({ table: { head: ['A', 'B'], rows: [[{ t: '1' }]] } })] })));
    await p.setInputFiles('#datei-laden', f); await warte(150); const t = await p.textContent('#meldung'); await p.close(); return String(/kein Smü-Entwurf/.test(t));
  });
  await fall('ÄK-TB19', 'Anleitung und Tooltip beschreiben die Tabelle', 'true', async () => {
    const p = await master(ctx, basis({ questions: [und()] })); const a = await p.textContent('#anleitung'); await p.hover('#q-q1-wt'); await warte(450); const t = await p.textContent('#hilfe-tip'); await p.close();
    return String(/Wahrheitstabelle/.test(a) && /Wahrheitstabelle/.test(t));
  });

  klasse('TB3 Schüler, Auswertung, PDF');
  await fall('ÄK-TB20', 'Mit Auswahl: 4 Auswahllisten mit 0 und 1', '4|Bitte wählen,0,1', async () => {
    const s = await schueler(ctx, await datei(ctx, basis({ questions: [und()] }))); const n = await s.locator('.aufgabe-tabelle select').count(); const o = (await s.locator('#a-q1-0 option').allTextContents()).join(','); await s.close(); return n + '|' + o;
  });
  await fall('ÄK-TB21', 'Ohne Auswahl: Eingabefelder', '4', async () => { const s = await schueler(ctx, await datei(ctx, basis({ questions: [frei()] }))); const n = await s.locator('.aufgabe-tabelle input').count(); await s.close(); return String(n); });
  await fall('ÄK-TB22', 'Volle Lösung ergibt volle Punkte', '2', async () => {
    const s = await schueler(ctx, await datei(ctx, basis({ questions: [und()] }))); for (let i = 0; i < 4; i++) await s.selectOption('#a-q1-' + i, ok4[i]); await abgeben(s); const t = (await s.textContent('.note-hand')).split(' ')[0]; await s.close(); return t;
  });
  await fall('ÄK-TB23', 'Antworten bleiben nach Neuladen', '0,0,1,1', async () => {
    const s = await schueler(ctx, await datei(ctx, basis({ questions: [und()] }))); for (const [i, v] of ['0', '0', '1', '1'].entries()) await s.selectOption('#a-q1-' + i, v);
    await s.reload(); await s.waitForSelector('.uhr'); const r = []; for (let i = 0; i < 4; i++) r.push(await s.inputValue('#a-q1-' + i)); await s.close(); return r.join(',');
  });
  await fall('ÄK-TB24', 'Auswertung markiert richtige und falsche Zellen mit Lösung', '3|1|true', async () => {
    const s = await schueler(ctx, await datei(ctx, basis({ questions: [und()] }))); for (let i = 0; i < 4; i++) await s.selectOption('#a-q1-' + i, '0'); await abgeben(s);
    const r = await s.locator('td.gut').count() + '|' + await s.locator('td.schlecht').count() + '|' + /1/.test(await s.locator('td.schlecht .loesung').textContent()); await s.close(); return r;
  });
  await fall('ÄK-TB25', 'Ohne Lösungen: keine Lösung in der Tabelle', '0', async () => {
    const s = await schueler(ctx, await datei(ctx, basis({ showSolutions: false, questions: [und()] }))); await abgeben(s); const n = await s.locator('td .loesung').count(); await s.close(); return String(n);
  });
  await fall('ÄK-TB26', 'PDF zeigt Tabelle, Überschrift und Punkte', 'true', async () => {
    const s = await schueler(ctx, await datei(ctx, basis({ questions: [und()] }))); for (let i = 0; i < 4; i++) await s.selectOption('#a-q1-' + i, ok4[i]); const r = await abgeben(s); await s.close();
    const t = pdfText(r.pdf); return String(/A ?∧ ?B/.test(t) && /2 von 2 Punkten/.test(t) && /✓ ?1/.test(t));
  });
  await fall('GW-TB09', 'PDF: 8 Spalten mit langen Texten bleiben in der Seite', 'true', async () => {
    const q = und({ choices: '', table: { head: Array(8).fill('Überschrift lang'), rows: Array(3).fill(0).map(() => Array(8).fill(0).map((_, c) => c === 7 ? { t: 'x', fill: true } : { t: 'sehr langer Zelleninhalt' })) } });
    const s = await schueler(ctx, await datei(ctx, basis({ questions: [q] }))); await s.fill('#a-q1-0', 'y'.repeat(60)); const r = await abgeben(s); await s.close();
    return String(pdfWoerter(r.pdf).flat().every(w => w.x1 <= 595.3));
  });
  await fall('GW-TB10', 'PDF: 32 Zeilen gehen sauber über den Seitenumbruch', 'true', async () => {
    const q = und({ choices: '', points: 32, table: { head: ['n', 'n²'], rows: Array(32).fill(0).map((_, i) => [{ t: String(i) }, { t: String(i * i), fill: true }]) } });
    const s = await schueler(ctx, await datei(ctx, basis({ questions: [q, { id: 'q0', type: 'text', prompt: 'Lange Vorfrage '.repeat(60), points: 1, accepted: ['a'], distractors: [], caseSensitive: false, typo: false }] }))); const r = await abgeben(s); await s.close();
    return String(pdfWoerter(r.pdf).flat().every(w => w.y1 <= 841.9) && /961/.test(pdfText(r.pdf)));
  });
  await fall('GW-TB11', 'Handybreite 320 px: breite Tabelle scrollt nur in sich', 'false', async () => {
    const q = und({ choices: '', table: { head: Array(8).fill('Spalte'), rows: [Array(8).fill(0).map(() => ({ t: 'x', fill: true }))] } });
    const s = await schueler(ctx, await datei(ctx, basis({ questions: [q] }))); await s.setViewportSize({ width: 320, height: 700 }); await warte(80); const r = await s.evaluate(() => document.documentElement.scrollWidth > innerWidth); await s.close(); return String(r);
  });
  await fall('ÄK-TB27', 'Prüfknopf funktioniert bei Tabellen', 'Teilweise richtig', async () => {
    const s = await schueler(ctx, await datei(ctx, basis({ pruefAn: true, pruefArt: 'gesamt', pruefZahl: 1, questions: [und()] }))); await s.selectOption('#a-q1-0', '0'); await s.selectOption('#a-q1-3', '1'); await s.click('#pruef-q1');
    const t = await s.textContent('#pruef-msg-q1'); await s.close(); return t;
  });
  await fall('ÄK-TB28', 'Abgabe-Prüfung rechnet Tabellenpunkte nach', 'echt|2', async () => {
    const m = await master(ctx, basis({ questions: [und()] })); const dl = []; m.on('download', d => dl.push(d)); await m.click('#knopf-erzeugen'); for (let i = 0; i < 60 && dl.length < 2; i++) await warte(50);
    const f = path.join(TMP, Math.random().toString(36).slice(2) + '.html'), j = f + '.json'; await dl[0].saveAs(f); await dl[1].saveAs(j); await m.close();
    const c = await kontext(); const s = await schueler(c, f); for (let i = 0; i < 4; i++) await s.selectOption('#a-q1-' + i, ok4[i]); const r = await abgeben(s); await c.close();
    const p = C.pruefen(new Uint8Array(fs.readFileSync(r.pdf)), JSON.parse(fs.readFileSync(j, 'utf8'))); return p.status + '|' + p.earned;
  });
  await ctx.close();
};

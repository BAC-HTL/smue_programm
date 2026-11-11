// Regressionstests zu den behobenen Fehlern F1 bis F9
const fs = require('fs');
const C = require('../src/core.js');
const H = require('./hilfsmittel');
const { fall, klasse, basis, kontext, master, erzeugen, datei, akzeptiert, schueler, abgeben, warte, pdfWoerter, pdfText } = H;
const multi = (pts, r, f) => ({ type: 'multi', points: pts, options: [...Array(r).fill(0).map((_, i) => ({ text: 'R' + i, correct: true })), ...Array(f).fill(0).map((_, i) => ({ text: 'F' + i, correct: false }))] });
const e = (q, a) => C.grade(q, a).earned;
const zahl = (v, o) => Object.assign({ type: 'number', points: 1, value: v, tol: '', unit: '' }, o);
const fq = o => Object.assign({ id: 'q1', type: 'text', prompt: 'Frage', points: 1, accepted: ['a'], distractors: [], caseSensitive: false, typo: false }, o);

module.exports = async function () {
  klasse('R1 Teilpunkte (F1)');
  await fall('GW-R01', 'Alle 5 richtig bei 1 Punkt: volle Punktzahl', 1, () => e(multi(1, 5, 0), [0, 1, 2, 3, 4]));
  await fall('GW-R02', 'Alle richtig plus eine falsche ist nicht voll: 5 richtig, 1 falsch', 0.5, () => e(multi(1, 5, 1), [0, 1, 2, 3, 4, 5]));
  await fall('GW-R03', 'Höchstpunktzahl 0,5: unvollständig ergibt 0', 0, () => e(multi(0.5, 5, 0), [0, 1, 2, 3]));
  await fall('GW-R04', 'Höchstpunktzahl 0,5: vollständig ergibt 0,5', 0.5, () => e(multi(0.5, 2, 0), [0, 1]));
  await fall('GW-R05', '9 von 10 bei 5 Punkten: 4,5', 4.5, () => e(multi(5, 10, 0), [0, 1, 2, 3, 4, 5, 6, 7, 8]));
  await fall('GW-R06', '19 von 20 bei 2 Punkten: höchstens 1,5', 1.5, () => e(multi(2, 20, 0), [...Array(19).keys()]));
  await fall('GW-R07', 'Lückentext vollständig bei 1 Punkt und 5 Lücken', 1, () => e({ type: 'cloze', points: 1, prompt: '{a} {b} {c} {d} {e}' }, ['a', 'b', 'c', 'd', 'e']));
  await fall('ÄK-R01', 'Status teilweise bleibt bei gerundeten Teilpunkten', 'partial', () => C.grade({ type: 'cloze', points: 1, prompt: '{a} {b} {c} {d} {e}' }, ['a', 'b', 'c', 'd', 'x']).status);

  klasse('R2 Zahlen (F4, F5)');
  await fall('ÄK-R02', 'Lösung 1.234 mit Punkt, Schüler schreibt 1,234', 1, () => e(zahl('1.234'), '1,234'));
  await fall('ÄK-R03', 'Lösung 1234, Schüler schreibt 1.234', 1, () => e(zahl('1234'), '1.234'));
  await fall('ÄK-R04', 'Zwei Tausenderpunkte bleiben eindeutig', 1, () => e(zahl('1234567'), '1.234.567'));
  await fall('ÄK-R05', 'Lösung 1,234: falsche Zahl bleibt falsch', 0, () => e(zahl('1,234'), '1.235'));
  await fall('GW-R08', 'Punkt mit 2 Stellen ist immer Dezimalzahl', 0, () => e(zahl('1234'), '1.23'));
  await fall('GW-R09', 'Punkt mit 4 Stellen ist immer Dezimalzahl', 1, () => e(zahl('1,2345'), '1.2345'));

  const ctx = await kontext();
  klasse('R3 Entwürfe und Eingabegrenzen (F2, F6)');
  await fall('ÄK-R06', 'Kaputter gespeicherter Entwurf: Programm startet trotzdem', 'true', async () => {
    const c = await kontext(); const p = await c.newPage(); const f = []; p.on('pageerror', x => f.push(x.message));
    await p.goto(H.MASTER); await p.evaluate(() => localStorage.setItem('smue-master-entwurf', JSON.stringify({ questions: [{ id: 'x', type: 'single', prompt: 'F', points: 1 }] }))); await p.reload(); await warte(150);
    const ok = await p.locator('#fragen .posten').count() > 0 && !f.length; await c.close(); return String(ok);
  });
  await fall('ÄK-R07', 'Unsinn im gespeicherten Entwurf statt JSON', 'true', async () => {
    const c = await kontext(); const p = await c.newPage(); const f = []; p.on('pageerror', x => f.push(x.message));
    await p.goto(H.MASTER); await p.evaluate(() => localStorage.setItem('smue-master-entwurf', 'null')); await p.reload(); await warte(100);
    const ok = await p.locator('#titel').count() === 1 && !f.length; await c.close(); return String(ok);
  });
  await fall('ÄK-R08', 'Falscher Datentyp im Titel', 'true', async () => {
    const c = await kontext(); const p = await c.newPage(); const f = []; p.on('pageerror', x => f.push(x.message));
    await p.goto(H.MASTER); await p.evaluate(d => localStorage.setItem('smue-master-entwurf', JSON.stringify(d)), Object.assign(basis(), { title: 7, grading: null })); await p.reload(); await warte(100);
    await p.click('#knopf-vorschau').catch(() => {}); await warte(100);
    const ok = !f.length; await c.close(); return String(ok);
  });
  await fall('GW-R10', 'Notengrenze genau 100 %', 'angenommen', () => akzeptiert(ctx, basis({ grading: { on: true, thresholds: [100, 75, 63, 50] } })));
  await fall('GW-R11', 'Notengrenze genau 0 %', 'angenommen', () => akzeptiert(ctx, basis({ grading: { on: true, thresholds: [88, 75, 63, 0] } })));
  await fall('GW-R12', 'Punkte 1,5', 'angenommen', () => akzeptiert(ctx, basis({ questions: [fq({ points: 1.5 })] })));
  await fall('GW-R13', 'Abweichung 0', 'angenommen', () => akzeptiert(ctx, basis({ questions: [{ id: 'q1', type: 'number', prompt: 'F', points: 1, value: '1', tol: '0', unit: '' }] })));

  klasse('R4 Note und Prozent (F3)');
  const note = async (a, b) => {
    const s = await schueler(ctx, await datei(ctx, basis({ grading: { on: true, thresholds: [88, 75, 63, 50] }, questions: [fq({ points: a }), fq({ id: 'q2', points: b })] })));
    await s.fill('#a-q1', 'a'); await abgeben(s); const t = await s.textContent('.ergebnis'); await s.close(); return t;
  };
  await fall('GW-R14', 'Genau 88 % (22 von 25) bleibt Note 1', 'true', async () => String(/88 %.*Note 1/.test(await note(22, 3))));
  await fall('GW-R15', '87,96 % zeigt 87,9 % und Note 2', 'true', async () => String(/87,9 %.*Note 2/.test(await note(2199, 301))));
  await fall('GW-R16', 'Knapp unter 50 %: Note 5', 'true', async () => String(/Note 5/.test(await note(4999, 5001))));

  klasse('R5 Vorlage, lange Namen, schmale Bildschirme (F7, F8, F9)');
  for (const [id, t] of [['ÄK-R09', '@@SMU_TITLE@@'], ['ÄK-R10', '@@SMU_DATA@@'], ['ÄK-R11', '$& $1 $`']]) {
    await fall(id, 'Titel mit Sonderfolge ' + t + ' bleibt lesbar', t, async () => {
      const s = await schueler(ctx, await datei(ctx, basis({ title: t }))); const v = await s.textContent('h1'); await s.close(); return v;
    });
  }
  await fall('ÄK-R12', 'Frage mit Vorlagenzeichen läuft durch', 'true', async () => {
    const s = await schueler(ctx, await datei(ctx, basis({ questions: [fq({ prompt: '@@SMU_META@@ @@SMU_DATA@@' })] }))); const t = await s.textContent('.frage'); await s.close(); return String(/@@SMU_META@@/.test(t));
  });
  await fall('GW-R17', 'Titel mit 120 Zeichen: Dateiname der Schüler-Datei unter 255', 'true', async () => {
    const m = await master(ctx, basis({ title: 'T'.repeat(120), cls: 'K'.repeat(200) })); const r = await erzeugen(m); await m.close(); return String(r.name.length <= 255);
  });
  await fall('GW-R18', 'Langer Titel und Name im Fuß des PDFs ohne Überlappung', 'true', async () => {
    const s = await schueler(ctx, await datei(ctx, basis({ title: 'Wort '.repeat(24) })), 'Name '.repeat(30), 'X'); const r = await abgeben(s); await s.close();
    const fuss = pdfWoerter(r.pdf)[0].filter(w => w.y0 > 800), seite = fuss.find(w => w.t === 'Seite');
    return String(fuss.filter(w => w.x0 < seite.x0).every(w => w.x1 <= seite.x0));
  });
  await fall('GW-R19', 'Lange Lückenauswahl in voller Länge in der Auswertung', 'true', async () => {
    const lang = 'r' + 'z'.repeat(40);
    const s = await schueler(ctx, await datei(ctx, basis({ questions: [{ id: 'q1', type: 'cloze', prompt: 'A {' + lang + '|~b}', points: 1, caseSensitive: false, typo: false }] })));
    await s.selectOption('#a-q1-0', lang); const r = await abgeben(s); await s.close(); return String(/1 von 1 Punkten/.test(pdfText(r.pdf)));
  });
  await ctx.close();
};

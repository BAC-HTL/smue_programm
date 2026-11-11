// Testklassen für das Master-Programm: Eingabeprüfung, Entwürfe, Anleitung, Hilfetexte
const fs = require('fs'), path = require('path');
const H = require('./hilfsmittel');
const { fall, klasse, basis, akzeptiert, master, erzeugen, warte, kontext, TMP } = H;
const fq = o => Object.assign({ id: 'q1', type: 'text', prompt: 'Frage', points: 1, accepted: ['a'], distractors: [], caseSensitive: false, typo: false }, o);

module.exports = async function () {
  const ctx = await kontext();
  klasse('M1 Pflichtangaben und Grenzen im Master');
  const A = (mehr) => akzeptiert(ctx, basis(mehr));
  await fall('GW-MA01', 'Zeit 0 Minuten', 'abgelehnt', () => A({ minutes: 0 }));
  await fall('GW-MA02', 'Zeit 1 Minute', 'angenommen', () => A({ minutes: 1 }));
  await fall('GW-MA03', 'Zeit -1 Minuten', 'abgelehnt', () => A({ minutes: -1 }));
  await fall('GW-MA04', 'Zeit 0,5 Minuten', 'abgelehnt', () => A({ minutes: 0.5 }));
  await fall('GW-MA05', 'Zeit 600 Minuten (Obergrenze des Felds)', 'angenommen', () => A({ minutes: 600 }));
  await fall('GW-MA06', 'Zeit 601 Minuten liegt über der Obergrenze', 'abgelehnt', () => A({ minutes: 601 }));
  await fall('GW-MA07', 'Punkte 0', 'abgelehnt', () => A({ questions: [fq({ points: 0 })] }));
  await fall('GW-MA08', 'Punkte 0,5', 'angenommen', () => A({ questions: [fq({ points: 0.5 })] }));
  await fall('GW-MA09', 'Punkte negativ', 'abgelehnt', () => A({ questions: [fq({ points: -1 })] }));
  await fall('GW-MA10', 'Punkte 0,25 passen nicht zur Schrittweite 0,5', 'abgelehnt', () => A({ questions: [fq({ points: 0.25 })] }));
  await fall('GW-MA11', '0 Fragen', 'abgelehnt', () => A({ questions: [] }));
  await fall('GW-MA12', '1 Frage', 'angenommen', () => A({}));
  await fall('ÄK-MA01', 'Titel leer', 'abgelehnt', () => A({ title: '' }));
  await fall('ÄK-MA02', 'Titel nur Leerzeichen', 'abgelehnt', () => A({ title: '   ' }));
  await fall('GW-MA13', 'Titel mit 1 Zeichen', 'angenommen', () => A({ title: 'X' }));
  await fall('ÄK-MA03', 'Lehrer-PIN leer', 'abgelehnt', () => A({ pin: '' }));
  await fall('ÄK-MA04', 'Lehrer-PIN nur Leerzeichen', 'abgelehnt', () => A({ pin: '  ' }));
  await fall('ÄK-MA05', 'Fragetext leer', 'abgelehnt', () => A({ questions: [fq({ prompt: ' ' })] }));
  await fall('ÄK-MA06', 'Kurzantwort ohne richtige Antwort', 'abgelehnt', () => A({ questions: [fq({ accepted: [] })] }));
  const num = o => Object.assign({ id: 'q1', type: 'number', prompt: 'F', points: 1, value: '1', tol: '', unit: '' }, o);
  await fall('ÄK-MA07', 'Zahl: Wert ist keine Zahl', 'abgelehnt', () => A({ questions: [num({ value: 'abc' })] }));
  await fall('ÄK-MA08', 'Zahl: Wert leer', 'abgelehnt', () => A({ questions: [num({ value: '' })] }));
  await fall('ÄK-MA09', 'Zahl: Abweichung ist keine Zahl', 'abgelehnt', () => A({ questions: [num({ tol: 'x' })] }));
  await fall('GW-MA14', 'Zahl: negative Abweichung macht die Frage unlösbar', 'abgelehnt', () => A({ questions: [num({ tol: '-1' })] }));
  const opt = (type, n, r) => ({ id: 'q1', type, prompt: 'F', points: 1, options: Array(n).fill(0).map((_, i) => ({ text: 'O' + i, correct: i < r })) });
  await fall('GW-MA15', 'Auswahl: 1 Antwortmöglichkeit', 'abgelehnt', () => A({ questions: [opt('single', 1, 1)] }));
  await fall('GW-MA16', 'Auswahl: 2 Antwortmöglichkeiten', 'angenommen', () => A({ questions: [opt('single', 2, 1)] }));
  await fall('GW-MA17', 'Auswahl: keine richtige markiert', 'abgelehnt', () => A({ questions: [opt('multi', 3, 0)] }));
  await fall('GW-MA18', 'Auswahl: alle richtig markiert', 'angenommen', () => A({ questions: [opt('multi', 3, 3)] }));
  await fall('GW-MA19', 'Auswahl: 100 Antwortmöglichkeiten', 'angenommen', () => A({ questions: [opt('multi', 100, 1)] }));
  const cl = p => ({ id: 'q1', type: 'cloze', prompt: p, points: 1, caseSensitive: false, typo: false });
  await fall('ÄK-MA10', 'Lückentext ohne Lücke', 'abgelehnt', () => A({ questions: [cl('kein Platz')] }));
  await fall('ÄK-MA11', 'Lücke nur mit falschen Antworten', 'abgelehnt', () => A({ questions: [cl('{~a|~b}')] }));
  await fall('GW-MA20', 'Lücke mit leerer Klammer', 'abgelehnt', () => A({ questions: [cl('{ }')] }));
  const g = t => ({ grading: { on: true, thresholds: t } });
  await fall('ÄK-MA12', 'Notengrenzen absteigend', 'angenommen', () => A(g([88, 75, 63, 50])));
  await fall('GW-MA21', 'Notengrenzen gleich', 'abgelehnt', () => A(g([88, 88, 63, 50])));
  await fall('GW-MA22', 'Notengrenzen aufsteigend', 'abgelehnt', () => A(g([50, 63, 75, 88])));
  await fall('GW-MA23', 'Notengrenze über 100 %: Note 1 wäre unerreichbar', 'abgelehnt', () => A(g([101, 75, 63, 50])));
  await fall('GW-MA24', 'Notengrenze unter 0 %: Note 5 wäre unerreichbar', 'abgelehnt', () => A(g([88, 75, 63, -1])));

  klasse('M2 Sonderzeichen im Test');
  await fall('ÄK-MS01', 'Titel enthält eine Zeichenfolge der Vorlage', 'true', async () => {
    const f = await H.datei(ctx, basis({ title: 'A @@SMU_META@@ B' }));
    const s = await ctx.newPage(); const e = []; s.on('pageerror', x => e.push(x.message)); await s.goto('file://' + f); await warte(200);
    const ok = await s.locator('#vorname').count() === 1 && !e.length; await s.close(); return String(ok);
  });
  await fall('ÄK-MS02', 'HTML im Titel wird nicht ausgeführt', 'false', async () => {
    const f = await H.datei(ctx, basis({ title: '</title><script>window.__boese=1</script>' }));
    const s = await ctx.newPage(); await s.goto('file://' + f); await warte(100);
    const b = await s.evaluate(() => !!window.__boese); await s.close(); return String(b);
  });
  await fall('ÄK-MS03', 'HTML im Fragetext wird nicht ausgeführt', 'false', async () => {
    const f = await H.datei(ctx, basis({ questions: [fq({ prompt: '<img src=x onerror="window.__boese=1"></script>' })] }));
    const s = await H.schueler(ctx, f); await warte(100);
    const b = await s.evaluate(() => !!window.__boese); await s.close(); return String(b);
  });
  await fall('ÄK-MS04', 'Klartext-Lösung steht nicht in der Schüler-Datei', 'false', async () => {
    const f = await H.datei(ctx, basis({ questions: [fq({ accepted: ['ZZGEHEIMZZ'] })] }));
    return String(fs.readFileSync(f, 'utf8').includes('ZZGEHEIMZZ'));
  });

  klasse('M3 Entwürfe');
  await fall('ÄK-ME01', 'Entwurf bleibt nach Neuladen erhalten', 'Mein Test', async () => {
    const c = await kontext(); const p = await master(c); await p.fill('#titel', 'Mein Test'); await p.reload();
    const v = await p.inputValue('#titel'); await c.close(); return v;
  });
  const lade = async (inhalt) => {
    const c = await kontext(); const p = await master(c); const e = []; p.on('pageerror', x => e.push(x.message));
    const f = path.join(TMP, 'e' + Math.random().toString(36).slice(2) + '.json'); fs.writeFileSync(f, inhalt);
    await p.setInputFiles('#datei-laden', f); await warte(250);
    const r = { titel: await p.inputValue('#titel').catch(() => ''), meldung: await p.textContent('#meldung').catch(() => ''), fehler: e.length, fragen: await p.locator('#fragen .posten').count() };
    await p.reload(); await warte(150);
    r.nachLaden = await p.locator('#titel').count(); r.fragenDanach = await p.locator('#fragen .posten').count(); await c.close(); return r;
  };
  await fall('ÄK-ME02', 'Gespeicherter Entwurf lässt sich laden', 'Geladen', async () => (await lade(JSON.stringify(basis({ title: 'Geladen' })))).titel);
  await fall('ÄK-ME03', 'Kaputte Datei wird abgewiesen', 'Diese Datei ist kein Smü-Entwurf.', async () => (await lade('{kein json')).meldung);
  await fall('ÄK-ME04', 'JSON ohne Fragen wird abgewiesen', 'Diese Datei ist kein Smü-Entwurf.', async () => (await lade('{"a":1}')).meldung);
  await fall('ÄK-ME05', 'Beschädigte Frage bringt das Programm nicht zum Absturz', '0 Fehler, Programm bedienbar', async () => {
    const r = await lade(JSON.stringify(basis({ questions: [{ id: 'x', type: 'single', prompt: 'F', points: 1 }] })));
    return `${r.fehler} Fehler, Programm ${r.nachLaden && r.fragenDanach ? 'bedienbar' : 'kaputt'}`;
  });
  await fall('ÄK-ME06', 'Unbekannte Fragenart bringt das Programm nicht zum Absturz', '0 Fehler', async () => {
    const r = await lade(JSON.stringify(basis({ questions: [{ id: 'x', type: 'bild', prompt: 'F', points: 1 }] })));
    return `${r.fehler} Fehler`;
  });
  await fall('ÄK-ME07', 'Entwurf einer alten Version wird übernommen', 'true', async () => {
    const alt = basis(); delete alt.fullscreen; delete alt.lock; alt.shots = true;
    const c = await kontext(); const p = await master(c, alt); const v = await p.isChecked('#vollbild'); await c.close(); return String(v);
  });
  await fall('ÄK-ME08', 'Neu: fragt zuerst und leert erst nach Bestätigung', '0', async () => {
    const c = await kontext(); const p = await master(c, basis());
    await p.click('#knopf-neu'); await p.click('#wirklich-neu'); await warte(100);
    const n = await p.locator('#fragen .posten').count(); await c.close(); return String(n);
  });
  await fall('ÄK-ME09', 'Gelöschte Frage lässt sich zurückholen', '1', async () => {
    const c = await kontext(); const p = await master(c, basis());
    await p.click('[aria-label="Frage 1 löschen"]'); await p.click('#meldung button');
    const n = await p.locator('#fragen .posten').count(); await c.close(); return String(n);
  });
  await fall('ÄK-ME10', 'Fragenart wechseln behält Text und Punkte', 'Frage eins|1', async () => {
    const c = await kontext(); const p = await master(c, basis());
    await p.selectOption('#q-q1-typ', 'multi');
    const r = await p.inputValue('#q-q1-text') + '|' + await p.inputValue('#q-q1-pkt'); await c.close(); return r;
  });

  klasse('M4 Anleitung und Hilfetexte');
  const c2 = await kontext();
  const p = await master(c2, basis());
  await fall('ÄK-HI01', 'Anleitung öffnet sich', 'true', async () => { await p.click('#knopf-anleitung'); return String(await p.locator('#anleitung').isVisible()); });
  await fall('ÄK-HI02', 'Anleitung schließt mit Esc, Fokus kehrt zurück', 'false|knopf-anleitung', async () => {
    await p.keyboard.press('Escape'); await warte(50);
    return (await p.locator('#anleitung').isVisible()) + '|' + await p.evaluate(() => document.activeElement.id);
  });
  await fall('ÄK-HI03', 'Mouse-over zeigt die Hilfe zu Vorschau', 'true', async () => {
    await p.hover('#knopf-vorschau'); await warte(450); return String(/Vorschau|Schüler/.test(await p.textContent('#hilfe-tip')) && await p.locator('#hilfe-tip').isVisible());
  });
  await fall('ÄK-HI04', 'Hilfe verschwindet beim Verlassen', 'false', async () => { await p.mouse.move(600, 500); await p.hover('.bilanz'); await warte(150); return String(await p.locator('#hilfe-tip').isVisible()); });
  await fall('ÄK-HI05', 'Hilfe erscheint auch per Tastatur', 'true', async () => { await p.focus('#knopf-erzeugen'); await warte(250); return String(await p.locator('#hilfe-tip').isVisible()); });
  await fall('ÄK-HI06', 'Esc schließt die Hilfe', 'false', async () => { await p.keyboard.press('Escape'); await warte(50); return String(await p.locator('#hilfe-tip').isVisible()); });
  await fall('ÄK-HI07', 'Jede Einstellung hat einen Hilfetext', '0 ohne Hilfe', async () => {
    const ids = ['titel', 'fach', 'klasse', 'lehrkraft', 'minuten', 'misch-fragen', 'misch-optionen', 'loesungen', 'fenster', 'vollbild', 'sperre', 'startcode', 'pin', 'noten'];
    let n = 0; for (const i of ids) if (!await p.evaluate(x => !!document.getElementById(x).closest('[data-hilfe]'), i)) n++;
    return n + ' ohne Hilfe';
  });
  await fall('ÄK-HI08', 'Jeder Knopf oben hat einen Hilfetext', '0 ohne Hilfe', async () => `${await p.locator('.oben button:not([data-hilfe])').count()} ohne Hilfe`);
  await fall('ÄK-HI09', 'Klick auf das Fragezeichen schaltet den Haken nicht um', 'false', async () => {
    const v = await p.isChecked('#misch-fragen'); await p.locator('label:has(#misch-fragen) .hilfe-zeichen').click(); await warte(50);
    return String(await p.isChecked('#misch-fragen') !== v);
  });
  await fall('GW-HI01', 'Hilfe bleibt am rechten Rand im Bild', 'true', async () => {
    await p.hover('#knopf-erzeugen'); await warte(450); const b = await p.locator('#hilfe-tip').boundingBox();
    return String(b.x >= 0 && b.x + b.width <= 1280);
  });
  await fall('GW-HI02', 'Hilfe bleibt am unteren Rand im Bild', 'true', async () => {
    await p.evaluate(() => { document.querySelector('.seitenleiste').scrollTop = 99999; }); await warte(50);
    await p.locator('label:has(#noten)').hover(); await warte(450); const b = await p.locator('#hilfe-tip').boundingBox();
    return String(!!b && b.y >= 0 && b.y + b.height <= 800);
  });
  await fall('GW-HI03', 'Handybreite 390 px: Anleitung ohne seitliches Scrollen', 'false', async () => {
    await p.setViewportSize({ width: 390, height: 800 }); await p.click('#knopf-anleitung'); await warte(100);
    const r = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth); await p.keyboard.press('Escape'); return String(r);
  });
  await c2.close(); await ctx.close();
};

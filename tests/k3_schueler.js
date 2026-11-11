// Testklassen für die Schüler-Datei: Start, Timer, Protokoll, PDF, Robustheit
const fs = require('fs');
const H = require('./hilfsmittel');
const { fall, klasse, basis, datei, schueler, abgeben, pdfText, pdfSeiten, pdfWoerter, protokoll, warte, kontext } = H;
const fq = (i, o) => Object.assign({ id: 'q' + i, type: 'text', prompt: 'Frage ' + i, points: 1, accepted: ['a'], distractors: [], caseSensitive: false, typo: false }, o);
const start = async (ctx, mehr, v, n, c) => schueler(ctx, await datei(ctx, basis(mehr)), v, n, c);
const hat = (log, re) => log.some(e => re.test(e.text || (e.type === 'switch' ? 'Testfenster verlassen' : '')));
const textLog = l => l.map(e => e.text || 'switch').join(' | ');

module.exports = async function () {
  const ctx = await kontext();

  klasse('S1 Anmeldung');
  const startMit = async (v, n) => {
    const f = await datei(ctx, basis()); const s = await ctx.newPage(); await s.goto('file://' + f);
    await s.fill('#vorname', v); await s.fill('#nachname', n); await s.click('button[type=submit]'); await warte(120);
    const r = await s.locator('.uhr').count() ? 'gestartet' : 'abgelehnt'; await s.close(); return r;
  };
  await fall('ÄK-S01', 'Vor- und Nachname vorhanden', 'gestartet', () => startMit('Lena', 'Huber'));
  await fall('ÄK-S02', 'Vorname fehlt', 'abgelehnt', () => startMit('', 'Huber'));
  await fall('ÄK-S03', 'Nachname fehlt', 'abgelehnt', () => startMit('Lena', ''));
  await fall('ÄK-S04', 'Name nur aus Leerzeichen', 'abgelehnt', () => startMit('   ', '   '));
  await fall('GW-S01', 'Name mit je 1 Zeichen', 'gestartet', () => startMit('A', 'B'));
  await fall('GW-S02', 'Name mit je 300 Zeichen', 'gestartet', () => startMit('A'.repeat(300), 'B'.repeat(300)));
  await fall('ÄK-S05', 'HTML im Namen wird nicht ausgeführt', 'false', async () => {
    const s = await start(ctx, {}, '<img src=x onerror="window.__boese=1">', 'X'); await warte(100);
    const b = await s.evaluate(() => !!window.__boese); await s.close(); return String(b);
  });
  const code = async (ein) => {
    const f = await datei(ctx, basis({ startCode: 'Ab12' })); const s = await ctx.newPage(); await s.goto('file://' + f);
    await s.fill('#vorname', 'L'); await s.fill('#nachname', 'H'); await s.fill('#startcode', ein); await s.click('button[type=submit]'); await warte(120);
    const r = await s.locator('.uhr').count() ? 'gestartet' : 'abgelehnt'; await s.close(); return r;
  };
  await fall('ÄK-S06', 'Startcode richtig', 'gestartet', () => code('Ab12'));
  await fall('ÄK-S07', 'Startcode in anderer Schreibung', 'gestartet', () => code(' aB12 '));
  await fall('ÄK-S08', 'Startcode falsch', 'abgelehnt', () => code('Ab13'));
  await fall('GW-S03', 'Startcode leer', 'abgelehnt', () => code(''));

  klasse('S2 Timer');
  const uhr = s => s.locator('.uhr');
  await fall('GW-U01', 'Timer startet bei voller Zeit (1 Minute)', '01:00', async () => { const s = await start(ctx, { minutes: 1 }); const t = await uhr(s).textContent(); await s.close(); return t; });
  const stand = async (min, vor) => {
    const s = await start(ctx, { minutes: min }); await s.evaluate(v => window.__uhr(v), vor); await warte(350);
    const c = (await uhr(s).getAttribute('class')).replace('uhr', '').trim() || 'normal'; await s.close(); return c;
  };
  await fall('GW-U02', 'Noch 301 s: keine Warnfarbe', 'normal', () => stand(10, 299000));
  await fall('GW-U03', 'Noch 299 s: gelb', 'bald', () => stand(10, 301000));
  await fall('GW-U04', 'Noch 61 s: gelb', 'bald', () => stand(10, 539000));
  await fall('GW-U05', 'Noch 59 s: rot', 'knapp', () => stand(10, 541000));
  await fall('GW-U06', 'Test mit genau 5 Minuten beginnt nicht gelb', 'normal', () => stand(5, 0));
  await fall('GW-U07', 'Noch 1 s: Test läuft noch', 'false', async () => {
    const s = await start(ctx, { minutes: 1 }); await s.evaluate(() => window.__uhr(58000)); await warte(300);
    const r = await s.locator('.note-hand').count() > 0; await s.close(); return String(r);
  });
  await fall('GW-U08', 'Zeit abgelaufen: automatische Abgabe', 'true', async () => {
    const s = await start(ctx, { minutes: 1 }); await s.evaluate(() => window.__uhr(60100)); await s.waitForSelector('.note-hand');
    const r = /automatisch/.test(await s.textContent('.ergebnis')); await s.close(); return String(r);
  });
  await fall('ÄK-U01', 'Automatische Abgabe wertet bereits gegebene Antworten', '1', async () => {
    const s = await start(ctx, { minutes: 1 }); await s.fill('#a-q1', 'antwort'); await s.evaluate(() => window.__uhr(61000)); await s.waitForSelector('.note-hand');
    const r = (await s.textContent('.note-hand')).split(' ')[0]; await s.close(); return r;
  });
  await fall('ÄK-U02', 'Neuladen setzt den Timer nicht zurück', 'true', async () => {
    const s = await start(ctx, { minutes: 10 }); await s.evaluate(() => { window.__uhr(120000); const k = 'smue:' + JSON.parse(document.getElementById('smu-meta').textContent).id; const o = JSON.parse(localStorage[k]); o.endsAt -= 120000; o.startedAt -= 120000; localStorage[k] = JSON.stringify(o); });
    await warte(100); await s.reload(); await s.waitForSelector('.uhr'); const t = await uhr(s).textContent(); await s.close(); return String(/^0[78]:/.test(t));
  });

  klasse('S3 Abgabe und Wiederholung');
  await fall('ÄK-A01', 'Abgabe zeigt die Punkte sofort', '0', async () => { const s = await start(ctx); await abgeben(s); const r = (await s.textContent('.note-hand')).split(' ')[0]; await s.close(); return r; });
  await fall('ÄK-A02', 'Doppelklick auf Jetzt abgeben erzeugt keine doppelte Abgabe', '1', async () => {
    const s = await start(ctx); let n = 0; s.on('download', () => n++); await s.locator('.leiste button').click();
    await s.dblclick('#jetzt-abgeben'); await warte(900); await s.close(); return String(n);
  });
  await fall('ÄK-A03', 'Nach der Abgabe bleibt der Test beim Neuladen gesperrt', 'true', async () => {
    const s = await start(ctx); await abgeben(s); await s.reload(); await s.waitForSelector('.note-hand'); const r = await s.locator('.uhr').count() === 0; await s.close(); return String(r);
  });
  const pin = async (ein) => {
    const s = await start(ctx); await abgeben(s); await s.click('text=Für die nächste Person'); await s.fill('#lehrer-pin', ein); await s.click('.pin button'); await warte(120);
    const r = await s.locator('#vorname').count() ? 'freigegeben' : 'abgelehnt'; await s.close(); return r;
  };
  await fall('ÄK-A04', 'Richtige PIN gibt frei', 'freigegeben', () => pin('4711'));
  await fall('ÄK-A05', 'Falsche PIN gibt nicht frei', 'abgelehnt', () => pin('4712'));
  await fall('GW-A01', 'Leere PIN gibt nicht frei', 'abgelehnt', () => pin(''));
  await fall('ÄK-A06', 'Ohne Lösungen: keine Lösung sichtbar und im PDF', 'false', async () => {
    const s = await start(ctx, { showSolutions: false, questions: [fq(1, { accepted: ['ZZLOES'] })] }); const r = await abgeben(s);
    const b = (await s.textContent('body')).includes('ZZLOES') || pdfText(r.pdf).includes('ZZLOES'); await s.close(); return String(b);
  });
  await fall('ÄK-A07', 'Mischen zeigt jede Frage genau einmal', '8', async () => {
    const qs = [...Array(8)].map((_, i) => fq(i + 1)); const s = await start(ctx, { shuffleQ: true, questions: qs });
    const t = await s.locator('.frage').allTextContents(); await s.close(); return String(new Set(t).size);
  });
  await fall('ÄK-A08', 'Ohne Speicher im Browser läuft der Test trotzdem', 'true', async () => {
    const c = await kontext(); await c.addInitScript(() => { const b = () => { throw new Error('gesperrt'); }; Storage.prototype.setItem = b; Storage.prototype.getItem = b; });
    const f = await datei(ctx, basis()); const s = await schueler(c, f); await s.fill('#a-q1', 'antwort'); const r = await abgeben(s);
    const ok = !s.fehler.length && pdfSeiten(r.pdf) >= 1; await c.close(); return String(ok);
  });

  klasse('S4 Protokoll');
  const c4 = {};
  await fall('ÄK-P01', 'Einfügen wird mit Text vermerkt', 'true', async () => {
    const s = await start(ctx); await s.focus('#a-q1');
    await s.evaluate(() => { const d = new DataTransfer(); d.setData('text', 'Aus dem Netz'); document.getElementById('a-q1').dispatchEvent(new ClipboardEvent('paste', { clipboardData: d, bubbles: true, cancelable: true })); });
    const l = await protokoll(s); await s.close(); return String(hat(l, /eingefügt: „Aus dem Netz“/));
  });
  await fall('ÄK-P02', 'Sperre blockiert Einfügen', 'true', async () => {
    const s = await start(ctx, { lock: true }); const r = await s.evaluate(() => { const d = new DataTransfer(); d.setData('text', 'x'); const ev = new ClipboardEvent('paste', { clipboardData: d, bubbles: true, cancelable: true }); document.getElementById('a-q1').dispatchEvent(ev); return ev.defaultPrevented; });
    await s.close(); return String(r);
  });
  await fall('ÄK-P03', 'Ohne Sperre bleibt Einfügen erlaubt', 'false', async () => {
    const s = await start(ctx, { lock: false }); const r = await s.evaluate(() => { const ev = new ClipboardEvent('paste', { bubbles: true, cancelable: true }); document.getElementById('a-q1').dispatchEvent(ev); return ev.defaultPrevented; });
    await s.close(); return String(r);
  });
  await fall('ÄK-P04', 'Tastenkürzel Strg+U wird vermerkt', 'true', async () => { const s = await start(ctx); await s.keyboard.press('Control+U'); const l = await protokoll(s); await s.close(); return String(hat(l, /Quelltext/)); });
  await fall('ÄK-P05', 'Rechtsklick wird vermerkt', 'true', async () => { const s = await start(ctx); await s.click('#a-q1', { button: 'right' }); const l = await protokoll(s); await s.close(); return String(hat(l, /Rechtsklick/)); });
  await fall('ÄK-P06', 'Fremdes Element einer Erweiterung wird vermerkt', 'true', async () => {
    const s = await start(ctx); await s.evaluate(() => document.body.appendChild(document.createElement('ki-helfer'))); await warte(80); const l = await protokoll(s); await s.close(); return String(hat(l, /ki-helfer/));
  });
  await fall('ÄK-P07', 'Automatische Übersetzung wird vermerkt', 'true', async () => {
    const s = await start(ctx); await s.evaluate(() => document.documentElement.classList.add('translated-ltr')); await warte(80); const l = await protokoll(s); await s.close(); return String(hat(l, /übersetzt/));
  });
  await fall('ÄK-P08', 'Normales Tippen erzeugt keinen Eintrag', '0', async () => {
    const s = await start(ctx); await s.click('#a-q1'); await s.keyboard.type('eine ganz normale antwort', { delay: 3 }); const l = await protokoll(s); await s.close(); return String(l.length);
  });
  await fall('ÄK-P09', 'Ohne Protokoll-Option kein Eintrag', '0', async () => { const s = await start(ctx, { logBlur: false }); await s.keyboard.press('Control+U'); const l = await protokoll(s); await s.close(); return String(l.length); });
  await fall('ÄK-P10', 'Neuladen wird vermerkt', 'true', async () => { const s = await start(ctx); await s.reload(); await s.waitForSelector('.uhr'); const l = await protokoll(s); await s.close(); return String(hat(l, /neu geladen/)); });
  await fall('ÄK-P11', 'Neuladen gilt nicht als Fensterwechsel', '0', async () => { const s = await start(ctx); await s.reload(); await s.waitForSelector('.uhr'); const l = await protokoll(s); await s.close(); return String(l.filter(e => e.type === 'switch').length); });

  const tippen = async (n) => {
    const s = await start(ctx); await s.focus('#a-q1'); await s.evaluate((n) => {
      const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      const el = document.getElementById('a-q1'); d.set.call(el, 'x'.repeat(n));
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    }, n);
    const l = await protokoll(s); await s.close(); return l;
  };
  await fall('GW-P01', 'Text per Programm, 1 Zeichen, wird erkannt', 'true', async () => String(hat(await tippen(1), /Programm/)));

  const ab = async (ms) => { // Rückkehr nach ms Abwesenheit, danach Antwort
    const s = await start(ctx); await s.click('#a-q1');
    await s.evaluate(() => window.dispatchEvent(new Event('blur'))); await s.evaluate(m => window.__uhr(m), ms);
    await s.evaluate(() => window.dispatchEvent(new Event('focus'))); return s;
  };
  await fall('GW-P02', 'Abwesenheit 2,9 s: kein Eintrag Antwort nach Rückkehr', 'false', async () => {
    const s = await ab(2900); await s.keyboard.type('a'); const l = await protokoll(s); await s.close(); return String(hat(l, /nach der Rückkehr/));
  });
  await fall('GW-P03', 'Abwesenheit 3,0 s: Eintrag Antwort nach Rückkehr', 'true', async () => {
    const s = await ab(3000); await s.keyboard.type('a'); const l = await protokoll(s); await s.close(); return String(hat(l, /nach der Rückkehr/));
  });
  await fall('GW-P04', 'Antwort 29 s nach der Rückkehr: Eintrag', 'true', async () => {
    const s = await ab(5000); await s.evaluate(() => window.__uhr(29000)); await s.keyboard.type('a'); const l = await protokoll(s); await s.close(); return String(hat(l, /nach der Rückkehr/));
  });
  await fall('GW-P05', 'Antwort 31 s nach der Rückkehr: kein Eintrag', 'false', async () => {
    const s = await ab(5000); await s.evaluate(() => window.__uhr(31000)); await s.keyboard.type('a'); const l = await protokoll(s); await s.close(); return String(hat(l, /nach der Rückkehr/));
  });
  await fall('ÄK-P12', 'Fensterwechsel speichert Verlassen und Zurück', '4', async () => {
    const s = await ab(4000); const l = (await protokoll(s)).filter(e => e.type === 'switch'); await s.close(); return String(Math.round((l[0].back - l[0].at) / 1000));
  });
  const leer = async (ms) => {
    const s = await start(ctx); await s.evaluate(m => window.__uhr(m), ms); await warte(1250); await s.mouse.move(200, 200); await s.mouse.move(210, 210); await warte(50);
    const l = await protokoll(s); await s.close(); return String(hat(l, /Keine Eingabe/));
  };
  await fall('GW-P06', 'Inaktivität 110 s: kein Eintrag', 'false', () => leer(110000));
  await fall('GW-P07', 'Inaktivität 125 s: Eintrag', 'true', () => leer(125000));
  const paste = (s) => s.evaluate(() => document.getElementById('a-q1').dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true })));
  await fall('GW-P08', 'Gleiches Ereignis nach 1,4 s wird zusammengefasst', '1', async () => {
    const s = await start(ctx); await paste(s); await s.evaluate(() => window.__uhr(1400)); await paste(s); const l = await protokoll(s); await s.close(); return String(l.length);
  });
  await fall('GW-P09', 'Gleiches Ereignis nach 1,6 s zählt doppelt', '2', async () => {
    const s = await start(ctx); await paste(s); await s.evaluate(() => window.__uhr(1600)); await paste(s); const l = await protokoll(s); await s.close(); return String(l.length);
  });
  const log400 = async (n) => {
    const s = await start(ctx, { minutes: 600 }); await s.evaluate((n) => { for (let i = 0; i < n; i++) { window.__uhr(2000); document.getElementById('a-q1').dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true })); } }, n);
    const l = await protokoll(s); return { s, n: l.length };
  };
  await fall('GW-P10', '399 Einträge werden gespeichert', '399', async () => { const r = await log400(399); await r.s.close(); return String(r.n); });
  await fall('GW-P11', '401 Ereignisse werden auf 400 begrenzt', '400', async () => { const r = await log400(401); await r.s.close(); return String(r.n); });
  await fall('GW-P12', 'Protokoll mit 400 Einträgen passt ins PDF', 'true', async () => {
    const r = await log400(400); const a = await abgeben(r.s); await r.s.close(); return String(pdfText(a.pdf).includes('Protokoll') && pdfSeiten(a.pdf) >= 8);
  });
  const fenster = async (o, i) => {
    const s = await start(ctx); await warte(800);
    await s.evaluate(([o, i]) => { Object.defineProperty(window, 'outerWidth', { get: () => innerWidth + o, configurable: true }); }, [o, i]); await warte(1150);
    const l = await protokoll(s); await s.close(); return String(hat(l, /Seitenleiste/));
  };
  await fall('GW-P13', 'Seitenleiste 119 px breiter: kein Eintrag', 'false', () => fenster(119));
  await fall('GW-P14', 'Seitenleiste 120 px breiter: Eintrag', 'true', () => fenster(120));

  klasse('S5 Vollbild');
  await fall('ÄK-F01', 'Vollbild aus: Fragen ohne Vollbild sichtbar', 'true', async () => { const s = await start(ctx); const r = await s.locator('.posten').first().isVisible(); await s.close(); return String(r); });
  await fall('ÄK-F02', 'Vollbild an: Test startet im Vollbild', 'true', async () => { const s = await start(ctx, { fullscreen: true }); await warte(200); const r = await s.evaluate(() => !!document.fullscreenElement); await s.close(); return String(r); });
  await fall('ÄK-F03', 'Vollbild verlassen versteckt die Fragen und schreibt ins Protokoll', 'false|true', async () => {
    const s = await start(ctx, { fullscreen: true }); await warte(200); await s.evaluate(() => document.exitFullscreen()); await warte(200);
    const v = await s.locator('.posten').first().isVisible(); const l = await protokoll(s); await s.close(); return v + '|' + hat(l, /Vollbild verlassen/);
  });
  await fall('ÄK-F04', 'Zurück zum Vollbild zeigt die Fragen wieder', 'true', async () => {
    const s = await start(ctx, { fullscreen: true }); await warte(200); await s.evaluate(() => document.exitFullscreen()); await warte(200); await s.click('#zurueck-vollbild'); await warte(250);
    const v = await s.locator('.posten').first().isVisible(); await s.close(); return String(v);
  });
  await fall('ÄK-F05', 'Abgabe beendet das Vollbild', 'false', async () => {
    const s = await start(ctx, { fullscreen: true }); await warte(200); await abgeben(s); await warte(150); const r = await s.evaluate(() => !!document.fullscreenElement); await s.close(); return String(r);
  });

  klasse('S6 PDF');
  await fall('ÄK-D01', 'PDF enthält Name, Punkte und Antwort', 'true', async () => {
    const s = await start(ctx, {}, 'Lena', 'Huber'); await s.fill('#a-q1', 'meine antwort'); const r = await abgeben(s); await s.close(); const t = pdfText(r.pdf);
    return String(/Lena Huber/.test(t) && /0 von 1 Punkten/.test(t) && /meine antwort/.test(t));
  });
  await fall('ÄK-D02', 'Umlaute, Griechisch, Kyrillisch und Mathe im PDF', 'true', async () => {
    const s = await start(ctx, { questions: [fq(1, { prompt: 'Ä ß √16 π ≤ Жук' })] }, 'Đorđe', 'Şahin'); await s.fill('#a-q1', 'π≈3'); const r = await abgeben(s); await s.close(); const t = pdfText(r.pdf);
    return String(['Ä ß √16 π ≤ Жук', 'Đorđe', 'Şahin', 'π≈3'].every(x => t.includes(x)));
  });
  await fall('GW-D01', '1 Frage ergibt 1 Seite', '1', async () => { const s = await start(ctx, { logBlur: false }); const r = await abgeben(s); await s.close(); return String(pdfSeiten(r.pdf)); });
  await fall('GW-D02', '200 Fragen: Test, Auswertung und PDF funktionieren', 'true', async () => {
    const s = await start(ctx, { questions: [...Array(200)].map((_, i) => fq(i + 1)) }); const r = await abgeben(s); await s.close();
    const t = pdfText(r.pdf); return String(/200\./.test(t) && /0 von 200 Punkten/.test(t));
  });
  await fall('GW-D03', 'Antwort aus 5.000 Zeichen ohne Leerzeichen läuft nicht aus der Seite', 'true', async () => {
    const s = await start(ctx); await s.fill('#a-q1', 'x'.repeat(5000)); const r = await abgeben(s); await s.close();
    return String(pdfWoerter(r.pdf).flat().every(w => w.x1 <= 595.3));
  });
  await fall('GW-D04', 'Sehr lange Frage über mehrere Seiten: keine Überläufe am Seitenende', 'true', async () => {
    const s = await start(ctx, { questions: [fq(1, { prompt: 'Wort '.repeat(1500) })] }); const r = await abgeben(s); await s.close();
    return String(pdfWoerter(r.pdf).flat().every(w => w.y1 <= 841.9));
  });
  await fall('GW-D05', 'Name mit 300 Zeichen überdeckt die Seitenzahl nicht', 'true', async () => {
    const s = await start(ctx, {}, 'A'.repeat(300), 'B'.repeat(300)); const r = await abgeben(s); await s.close();
    const fuss = pdfWoerter(r.pdf)[0].filter(w => w.y0 > 800); const seite = fuss.find(w => w.t === 'Seite');
    return String(!!seite && fuss.filter(w => w !== seite).every(w => w.x1 <= seite.x0 || w.t === 'von' || /^\d+$/.test(w.t)));
  });
  await fall('GW-D06', 'Name mit 300 Zeichen: Dateiname bleibt unter 255 Zeichen', 'true', async () => {
    const s = await start(ctx, {}, 'A'.repeat(300), 'B'.repeat(300)); const r = await abgeben(s); await s.close(); return String(r.name.length <= 255);
  });
  await fall('GW-D07', 'Zeichen außerhalb der Schrift (Emoji, Arabisch) bringen das PDF nicht zum Absturz', 'true', async () => {
    const s = await start(ctx); await s.fill('#a-q1', 'مرحبا 😀'); const r = await abgeben(s); await s.close(); return String(pdfSeiten(r.pdf) >= 1);
  });
  await fall('ÄK-D03', 'PDF lässt sich nach Neuladen erneut speichern', 'true', async () => {
    const s = await start(ctx); await abgeben(s); await s.reload(); await s.waitForSelector('#pdf-holen');
    const [d] = await Promise.all([s.waitForEvent('download'), s.click('#pdf-holen')]); await s.close(); return String(/\.pdf$/.test(d.suggestedFilename()));
  });
  await fall('GW-D08', 'Prozentrundung hebt niemanden über die Notengrenze: 87,96 % bleibt Note 2', 'true', async () => {
    const q = [...Array(1)].map((_, i) => fq(i + 1, { points: 2199 })).concat([fq(2, { points: 301 })]);
    const s = await start(ctx, { grading: { on: true, thresholds: [88, 75, 63, 50] }, questions: q });
    await s.evaluate(() => 0); await s.fill('#a-q1', 'a'); await s.fill('#a-q2', 'x');
    await s.locator('.leiste button').click(); await s.click('#jetzt-abgeben'); await s.waitForSelector('.ergebnis');
    const t = await s.textContent('.ergebnis'); await s.close(); return String(/Note 2/.test(t));
  });

  klasse('S7 Darstellung');
  await fall('GW-O01', 'Breite 320 px: kein seitliches Scrollen im Test', 'false', async () => {
    const s = await start(ctx, { questions: [fq(1, { prompt: 'x'.repeat(300) })] }); await s.setViewportSize({ width: 320, height: 700 }); await warte(80);
    const r = await s.evaluate(() => document.documentElement.scrollWidth > innerWidth); await s.close(); return String(r);
  });
  await fall('GW-O02', 'Lange Antwortoption passt auf 320 px', 'false', async () => {
    const s = await start(ctx, { questions: [{ id: 'q1', type: 'single', prompt: 'F', points: 1, options: [{ text: 'y'.repeat(300), correct: true }, { text: 'B', correct: false }] }] });
    await s.setViewportSize({ width: 320, height: 700 }); await warte(80); const r = await s.evaluate(() => document.documentElement.scrollWidth > innerWidth); await s.close(); return String(r);
  });
  await fall('GW-O03', 'Lückentext mit langer Auswahl passt auf 320 px', 'false', async () => {
    const s = await start(ctx, { questions: [{ id: 'q1', type: 'cloze', prompt: 'A {r' + 'z'.repeat(120) + '|~b}', points: 1, caseSensitive: false, typo: false }] });
    await s.setViewportSize({ width: 320, height: 700 }); await warte(80); const r = await s.evaluate(() => document.documentElement.scrollWidth > innerWidth); await s.close(); return String(r);
  });
  await ctx.close();
};

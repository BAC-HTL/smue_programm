/* PDF-Export des Tests aus dem Lehrer-Programm: Angabe zum Ausdrucken oder Lösungsblatt */
(function () {
  'use strict';
  var C = window.SMU;
  var INK = [31, 53, 168], RED = [207, 32, 39], GREEN = [18, 112, 58], GREY = [86, 96, 121], TEXT = [27, 34, 54], LINE = [150, 160, 180];
  var NOTEN = ['Sehr gut', 'Gut', 'Befriedigend', 'Genügend'];

  function make(D, mode) {
    var sol = mode === 'loesung';
    var J = window.jspdf.jsPDF, doc = new J({ unit: 'mm', format: 'a4' });
    doc.addFileToVFS('r.ttf', window.__SMU_FONTS.r); doc.addFont('r.ttf', 'S', 'normal');
    doc.addFileToVFS('b.ttf', window.__SMU_FONTS.b); doc.addFont('b.ttf', 'S', 'bold');
    var L = 20, R = 190, W = R - L, X = L + 12, WX = R - X, BOTTOM = 280, y = 20;
    var qs = D.questions, total = qs.reduce(function (s, q) { return s + (Number(q.points) || 0); }, 0);

    function font(style, size, col) { doc.setFont('S', style); doc.setFontSize(size); doc.setTextColor.apply(doc, col || TEXT); }
    function lh(size) { return size * 0.4583; }
    function page() { doc.addPage(); y = 20; }
    function need(h) { if (y + h > BOTTOM) page(); }
    function lines(txt, width, x, size) {
      doc.splitTextToSize(String(txt), width).forEach(function (l) { need(lh(size)); doc.text(l, x, y); y += lh(size); });
    }
    function draw(c) { doc.setDrawColor.apply(doc, c || LINE); doc.setLineWidth(0.25); }
    function writeLine(x, w) { need(9); y += 6; draw(); doc.line(x, y, x + w, y); y += 3; }
    function answerText(t) { font('bold', 10.5, GREEN); lines(t, WX, X, 10.5); }

    /* Kopf */
    var fach = [D.subject, D.cls].map(function (s) { return String(s || '').trim(); }).filter(Boolean).join(' · ');
    if (fach) { font('normal', 10, GREY); doc.text(fach, L, y); y += 8; }
    y += 3; font('bold', 18, INK); lines(D.title || 'Test', W, L, 18); y += 1;
    font('normal', 10, GREY);
    doc.text([sol ? 'Lösungsblatt' : 'Schriftliche Mitarbeitsüberprüfung', String(D.teacher || '').trim()].filter(Boolean).join(' · '), L, y); y += 3;
    draw(RED); doc.setLineWidth(0.5); doc.line(L, y, R, y); y += 7;
    font('normal', 10.5, TEXT);
    doc.text('Zeit: ' + D.minutes + ' Minuten', L, y);
    doc.text('Punkte: ' + C.fmt(total), L + 55, y);
    doc.text(qs.length + (qs.length === 1 ? ' Frage' : ' Fragen'), L + 100, y);
    y += 8;
    if (!sol) {
      font('normal', 10.5, TEXT);
      [['Name', L, 85], ['Klasse', L + 95, 30], ['Datum', L + 135, 35]].forEach(function (f) {
        doc.text(f[0] + ':', f[1], y); draw(); doc.line(f[1] + doc.getTextWidth(f[0] + ': ') + 1, y + 1, f[1] + f[2], y + 1);
      });
      y += 8;
      font('normal', 10, TEXT);
      doc.text('Erreicht: ______ von ' + C.fmt(total) + ' Punkten', L, y);
      if (D.grading && D.grading.on) doc.text('Note: ______', L + 95, y);
      y += 9;
    }

    /* Fragen */
    qs.forEach(function (q, i) {
      need(22);
      var max = Number(q.points) || 0;
      font('bold', 11, INK); doc.text((i + 1) + '.', L, y);
      font('normal', 9.5, GREY); doc.text(C.fmt(max) + (max === 1 ? ' Punkt' : ' Punkte'), R, y, { align: 'right' });
      var prompt = q.type === 'cloze' ? clozeText(q, sol) : q.prompt;
      font('bold', 10.5, TEXT); lines(prompt, WX - 18, X, 10.5);
      if (q.image && q.image.data) {
        var iw = WX, ih = iw * q.image.h / q.image.w;
        if (ih > 70) { ih = 70; iw = ih * q.image.w / q.image.h; }
        y += 1; need(ih + 3); doc.addImage(q.image.data, 'JPEG', X, y, iw, ih); y += ih + 3;
      }
      y += 1;
      body(q, sol);
      y += 4;
      need(4); draw([200, 211, 228]); doc.line(L, y, R, y); y += 7;
    });

    function body(q, sol) {
      switch (q.type) {
        case 'text':
          if ((q.distractors || []).length) { choices(C.choiceList(q.accepted, q.distractors), function (t) { return sol && C.textMatches(t, q.accepted, q); }, '○', '●'); return; }
          if (sol) answerText(q.accepted.join(' / ')); else writeLine(X, WX);
          return;
        case 'number':
          if (sol) answerText(C.fmt(q.value) + (q.unit ? ' ' + q.unit : '') + (String(q.tol || '').trim() ? ' (± ' + C.fmt(q.tol) + ')' : ''));
          else { writeLine(X, 60); if (q.unit) { font('normal', 10.5, TEXT); doc.text(q.unit, X + 62, y - 3); } }
          return;
        case 'single':
        case 'multi':
          if (q.type === 'multi') { font('normal', 9.5, GREY); lines('Mehrere Antworten können richtig sein.', WX, X, 9.5); y += 1; }
          var list = q.options.filter(function (o) { return String(o.text).trim(); });
          choices(list.map(function (o) { return o.text; }), function (t, k) { return sol && list[k].correct; }, q.type === 'multi' ? '□' : '○', q.type === 'multi' ? '■' : '●');
          return;
        case 'tf':
          choices(['Richtig', 'Falsch'], function (t, k) { return sol && (k === 0) === !!q.answer; }, '○', '●');
          return;
        case 'cloze':
          if (!sol && C.gapsOf(q).some(function (g) { return g.wrong.length; })) { font('normal', 9.5, GREY); lines('Wähle für jede Lücke eine der Angaben in Klammern.', WX, X, 9.5); }
          return;
        case 'table': table(q, sol); return;
      }
    }

    function choices(list, marked, empty, full) {
      list.forEach(function (t, k) {
        var on = marked(t, k), ls = doc.splitTextToSize(String(t), WX - 8);
        need(ls.length * lh(10.5) + 1.5);
        font(on ? 'bold' : 'normal', 11, on ? GREEN : TEXT); doc.text(on ? full : empty, X, y);
        font(on ? 'bold' : 'normal', 10.5, on ? GREEN : TEXT);
        ls.forEach(function (l) { doc.text(l, X + 7, y); y += lh(10.5); });
        y += 1.5;
      });
    }

    /* Lücken: Angabe mit Strich und Auswahl in Klammern, Lösung mit eingesetzter Antwort in eckigen Klammern */
    function clozeText(q, sol) {
      return C.parseCloze(q.prompt).map(function (p) {
        if (!p.gap) return p.t;
        if (sol) return '[' + p.gap.join(' / ') + ']';
        return '__________' + (p.wrong.length ? ' (' + C.choiceList(p.gap, p.wrong).join(' / ') + ')' : '');
      }).join('');
    }

    function table(q, sol) {
      var t = q.table, cols = t.head.length, cw = Math.min(34, WX / cols);
      var withHead = t.head.some(function (x) { return String(x).trim(); });
      var fit = function (s) { return doc.splitTextToSize(String(s), cw - 2)[0] || ''; };
      var ch = C.tableChoices(q);
      if (!sol && ch.length) { font('normal', 9.5, GREY); lines('Trag in jede leere Zelle eine dieser Angaben ein: ' + ch.join(', '), WX, X, 9.5); y += 1; }
      var row = function (cells, head) {
        var rh = 7.5;
        need(rh);
        if (head) { doc.setFillColor(238, 242, 248); doc.rect(X, y, cw * cols, rh, 'F'); }
        draw(); doc.rect(X, y, cw * cols, rh);
        cells.forEach(function (c, k) {
          if (k) doc.line(X + k * cw, y, X + k * cw, y + rh);
          if (c.fill && !sol) return;
          var txt = c.fill ? String(c.t).split('|')[0].trim() : c.t;
          font(head || c.fill ? 'bold' : 'normal', 10, c.fill ? GREEN : TEXT);
          doc.text(fit(txt), X + k * cw + cw / 2, y + 5, { align: 'center' });
        });
        y += rh;
      };
      var whole = (t.rows.length + (withHead ? 1 : 0)) * 7.5;
      if (whole <= BOTTOM - 20) need(whole); /* kleine Tabellen nicht über zwei Seiten teilen */
      if (withHead) row(t.head.map(function (x) { return { t: x }; }), true);
      t.rows.forEach(function (r) { row(r, false); });
      y += 1;
    }

    /* Notenschlüssel im Lösungsblatt */
    if (sol && D.grading && D.grading.on) {
      need(40);
      font('bold', 12, INK); doc.text('Notenschlüssel', L, y); y += 7;
      var th = D.grading.thresholds;
      NOTEN.concat(['Nicht genügend']).forEach(function (n, k) {
        var von = k < 4 ? Math.ceil(total * th[k] / 100 * 2 - 1e-9) / 2 : 0;
        var bis = k === 0 ? total : Math.ceil(total * th[k - 1] / 100 * 2 - 1e-9) / 2 - 0.5;
        font('normal', 10.5, TEXT);
        doc.text((k + 1) + '  ' + n, L, y);
        doc.text(k < 4 ? 'ab ' + th[k] + ' %' : 'unter ' + th[3] + ' %', L + 60, y);
        doc.text(bis < von ? '–' : C.fmt(von) + ' bis ' + C.fmt(bis) + ' Punkte', L + 95, y);
        y += 6;
      });
    }

    var n = doc.getNumberOfPages();
    for (var p = 1; p <= n; p++) {
      doc.setPage(p);
      font('normal', 8.5, GREY);
      doc.text(doc.splitTextToSize((D.title || 'Test') + ' · ' + (sol ? 'Lösung' : 'Angabe'), W - 34)[0], L, 289);
      doc.text('Seite ' + p + ' von ' + n, R, 289, { align: 'right' });
    }
    doc.setProperties({ title: (D.title || 'Test') + (sol ? ' – Lösung' : ' – Angabe'), author: D.teacher || '' });
    return new Uint8Array(doc.output('arraybuffer'));
  }
  window.SMU_EXPORT = { make: make };
})();

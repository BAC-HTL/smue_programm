(function () {
  'use strict';
  var C = window.SMU;
  var STORE = 'smue-master-entwurf';
  var TYPES = {
    text: 'Kurzantwort', number: 'Zahl', single: 'Eine richtige Antwort',
    multi: 'Mehrere richtige Antworten', tf: 'Richtig oder falsch', cloze: 'Lückentext', table: 'Tabelle ausfüllen'
  };
  var seq = Date.now() % 100000;
  function uid() { return 'q' + (++seq).toString(36); }
  function pin() { return String(1000 + Math.floor(Math.random() * 9000)); }

  function newQuestion(type) {
    var q = { id: uid(), type: type, prompt: '', points: type === 'multi' || type === 'cloze' ? 2 : 1 };
    if (type === 'text') { q.accepted = []; q.distractors = []; q.caseSensitive = false; q.typo = false; }
    if (type === 'number') { q.value = ''; q.tol = ''; q.unit = ''; }
    if (type === 'single' || type === 'multi') q.options = [{ text: '', correct: false }, { text: '', correct: false }, { text: '', correct: false }];
    if (type === 'tf') q.answer = true;
    if (type === 'cloze') { q.caseSensitive = false; q.typo = false; }
    if (type === 'table') { q.points = 2; q.caseSensitive = false; q.typo = false; var t = truthTable(2); q.table = t.table; q.choices = t.choices; }
    return q;
  }
  /* Wahrheitstabelle für n Variablen: Eingänge vorgegeben, Ergebnis-Spalte füllen Schüler aus */
  var VARS = ['A', 'B', 'C', 'D'];
  function truthTable(n) {
    var rows = [];
    for (var i = 0; i < Math.pow(2, n); i++) {
      var row = [];
      for (var v = 0; v < n; v++) row.push({ t: String((i >> (n - 1 - v)) & 1) });
      row.push({ t: '', fill: true });
      rows.push(row);
    }
    return { table: { head: VARS.slice(0, n).concat(['Ergebnis']), rows: rows }, choices: '0, 1' };
  }
  var MAX_COLS = 8, MAX_ROWS = 32;
  function resizeTable(q, cols, rows) {
    var t = q.table;
    cols = Math.max(1, Math.min(MAX_COLS, cols | 0)); rows = Math.max(1, Math.min(MAX_ROWS, rows | 0));
    while (t.head.length < cols) t.head.push('');
    t.head.length = cols;
    while (t.rows.length < rows) t.rows.push([]);
    t.rows.length = rows;
    t.rows.forEach(function (r) { while (r.length < cols) r.push({ t: '' }); r.length = cols; });
  }

  function emptyDraft() {
    return { sample: false, title: '', subject: '', cls: '', teacher: '', minutes: 20, startCode: '', pin: pin(),
      shuffleQ: false, shuffleO: true, showSolutions: true, logBlur: true, fullscreen: true, lock: true, pruefAn: false, pruefArt: 'gesamt', pruefZahl: 2,
      grading: { on: false, thresholds: [88, 75, 63, 50] }, questions: [] };
  }
  function sampleDraft() {
    var d = emptyDraft();
    d.sample = true; d.title = 'Beispiel: Österreich-Kunde'; d.subject = 'Geografie'; d.cls = '2B'; d.teacher = ''; d.minutes = 15;
    d.questions = [
      { id: uid(), type: 'text', prompt: 'Wie heißt die Landeshauptstadt von Tirol?', points: 1, accepted: ['Innsbruck'], caseSensitive: false, typo: true },
      { id: uid(), type: 'number', prompt: 'Aus wie vielen Bundesländern besteht Österreich?', points: 1, value: '9', tol: '', unit: '' },
      { id: uid(), type: 'single', prompt: 'Welcher Fluss fließt durch Wien?', points: 1, options: [{ text: 'Donau', correct: true }, { text: 'Inn', correct: false }, { text: 'Mur', correct: false }, { text: 'Salzach', correct: false }] },
      { id: uid(), type: 'multi', prompt: 'Welche dieser Staaten grenzen an Österreich?', points: 3, options: [{ text: 'Deutschland', correct: true }, { text: 'Italien', correct: true }, { text: 'Slowenien', correct: true }, { text: 'Frankreich', correct: false }, { text: 'Polen', correct: false }] },
      { id: uid(), type: 'tf', prompt: 'Der Großglockner ist der höchste Berg Österreichs.', points: 1, answer: true },
      { id: uid(), type: 'cloze', prompt: 'Die Landeshauptstadt der Steiermark heißt {Graz}, die Landeshauptstadt von Kärnten heißt {Klagenfurt|~Linz|~Eisenstadt}.', points: 2, caseSensitive: false, typo: true }
    ];
    return d;
  }

  /* Prüft einen Entwurf vollständig, bevor er übernommen wird. Liefert den bereinigten Entwurf oder null. */
  function strings(a) { return Array.isArray(a) && a.every(function (x) { return typeof x === 'string'; }); }
  function usable(q) {
    if (!q || typeof q !== 'object' || !TYPES[q.type] || typeof q.prompt !== 'string' || typeof q.points !== 'number') return false;
    if (typeof q.id !== 'string' || !q.id) return false;
    if (q.image !== undefined && !(q.image && /^data:image\/jpeg;base64,/.test(q.image.data) && q.image.w > 0 && q.image.h > 0)) return false;
    if (q.type === 'text') return strings(q.accepted) && (q.distractors === undefined || strings(q.distractors));
    if (q.type === 'number') return typeof q.value === 'string';
    if (q.type === 'single' || q.type === 'multi') return Array.isArray(q.options) && q.options.every(function (o) { return o && typeof o.text === 'string'; });
    if (q.type === 'tf') return typeof q.answer === 'boolean';
    if (q.type === 'table') {
      var t = q.table;
      return !!t && strings(t.head) && t.head.length >= 1 && t.head.length <= MAX_COLS && Array.isArray(t.rows) && t.rows.length >= 1 && t.rows.length <= MAX_ROWS &&
        t.rows.every(function (r) { return Array.isArray(r) && r.length === t.head.length && r.every(function (c) { return c && typeof c.t === 'string'; }); }) &&
        (q.choices === undefined || typeof q.choices === 'string');
    }
    return true;
  }
  function cleanDraft(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.questions) || !raw.questions.every(usable)) return null;
    var d = emptyDraft();
    Object.keys(d).forEach(function (k) {
      if (k === 'questions' || k === 'grading' || raw[k] === undefined || raw[k] === null) return;
      d[k] = typeof d[k] === 'string' ? String(raw[k]) : typeof d[k] === 'number' ? (Number(raw[k]) || 0) : !!raw[k];
    });
    d.questions = raw.questions;
    var g = raw.grading;
    if (g && Array.isArray(g.thresholds) && g.thresholds.length === 4) d.grading = { on: !!g.on, thresholds: g.thresholds.map(Number) };
    return d;
  }

  var D = null, problems = {};
  try { D = cleanDraft(JSON.parse(localStorage.getItem(STORE))); } catch (e) { D = null; }
  if (!D) D = sampleDraft();

  var storeFull = false;
  function persist() {
    try { localStorage.setItem(STORE, JSON.stringify(D)); storeFull = false; } catch (e) {
      if (!storeFull) toast('Der Browser-Speicher ist voll. Sichere den Test mit „Entwurf speichern“.');
      storeFull = true;
    }
    summary();
  }

  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'text') el.textContent = attrs[k];
      else if (k === 'value') el.value = attrs[k];
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] === true) el.setAttribute(k, '');
      else if (attrs[k] !== false && attrs[k] != null) el.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  var toastT = 0;
  function toast(t) {
    var el = document.getElementById('meldung');
    el.textContent = t; el.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { el.hidden = true; }, 3500);
  }

  function field(id, label, control, hint) {
    return h('div', { class: 'feld' }, [h('label', { for: id, text: label }), control, hint ? h('span', { class: 'hinweis', text: hint }) : null]);
  }
  function bindText(id, obj, key, attrs) {
    var a = { type: 'text', id: id, value: obj[key] == null ? '' : obj[key], oninput: function (e) { obj[key] = e.target.value; persist(); } };
    Object.keys(attrs || {}).forEach(function (k) { a[k] = attrs[k]; });
    return h('input', a);
  }
  function bindCheck(id, obj, key, label, after) {
    return h('label', { class: 'haken' }, [
      h('input', { type: 'checkbox', id: id, checked: !!obj[key], onchange: function (e) { obj[key] = e.target.checked; persist(); if (after) after(); } }),
      h('span', { text: label })]);
  }

  /* ---------- Einstellungen ---------- */
  function renderSettings() {
    var box = document.getElementById('einstellungen');
    box.textContent = '';
    var g = D.grading;
    var keyRow = !g.on ? null : h('div', { class: 'schluessel' }, ['Note 1 ab', 'Note 2 ab', 'Note 3 ab', 'Note 4 ab'].map(function (t, i) {
      return h('div', { class: 'feld' }, [h('label', { for: 'grenze-' + i, text: t }), h('input', { type: 'number', id: 'grenze-' + i, min: 0, max: 100, value: g.thresholds[i], 'aria-label': t + ' Prozent', oninput: function (e) { g.thresholds[i] = Number(e.target.value); persist(); } })]);
    }));
    box.append(
      h('section', { class: 'blatt tafel' }, [h('h2', { text: 'Test' }),
        field('titel', 'Titel', bindText('titel', D, 'title', { placeholder: 'z. B. Bruchrechnen', maxlength: 120 })),
        h('div', { class: 'paar' }, [
          field('fach', 'Fach', bindText('fach', D, 'subject')),
          field('klasse', 'Klasse', bindText('klasse', D, 'cls'))]),
        field('lehrkraft', 'Lehrkraft', bindText('lehrkraft', D, 'teacher')),
        field('minuten', 'Zeit in Minuten', h('input', { type: 'number', id: 'minuten', min: 1, max: 600, value: D.minutes, oninput: function (e) { D.minutes = Number(e.target.value); persist(); } }))]),
      h('section', { class: 'blatt tafel' }, [h('h2', { text: 'Ablauf' }),
        bindCheck('misch-fragen', D, 'shuffleQ', 'Fragen mischen'),
        bindCheck('misch-optionen', D, 'shuffleO', 'Antwortmöglichkeiten mischen'),
        bindCheck('loesungen', D, 'showSolutions', 'Richtige Lösungen nach der Abgabe zeigen'),
        bindCheck('pruef-an', D, 'pruefAn', 'Prüfknopf bei jeder Frage anbieten', renderSettings),
        D.pruefAn ? h('div', { class: 'schalter', role: 'radiogroup', 'aria-label': 'Wie oft geprüft werden darf' }, [['gesamt', 'Anzahl gilt für alle Fragen zusammen', 'pruef-art-gesamt'], ['frage', 'Anzahl gilt für jede Frage', 'pruef-art-frage']].map(function (o) {
          return h('label', { class: 'haken' }, [h('input', { type: 'radio', name: 'pruef-art', id: o[2], checked: D.pruefArt === o[0], onchange: function () { D.pruefArt = o[0]; persist(); } }), h('span', { text: o[1] })]);
        })) : null,
        D.pruefAn ? field('pruef-anzahl', 'Anzahl der Prüfungen', h('input', { type: 'number', id: 'pruef-anzahl', min: 1, max: 99, step: 1, value: D.pruefZahl, oninput: function (e) { D.pruefZahl = Number(e.target.value); persist(); } })) : null,
        bindCheck('fenster', D, 'logBlur', 'Auffälliges Verhalten mit Uhrzeit protokollieren'),
        bindCheck('vollbild', D, 'fullscreen', 'Test im Vollbild erzwingen'),
        bindCheck('sperre', D, 'lock', 'Kopieren, Einfügen und Rechtsklick sperren'),
        h('p', { class: 'hinweis', text: 'Protokolliert wird, was im Testfenster passiert. Welche Seiten oder Programme außerhalb offen sind, kann ein Browser nicht sehen.' }),
        field('startcode', 'Startcode (optional)', bindText('startcode', D, 'startCode', { autocomplete: 'off' }), 'Ohne diesen Code sehen Schüler die Fragen nicht. Du sagst ihn zu Beginn an.'),
        field('pin', 'Lehrer-PIN', bindText('pin', D, 'pin', { autocomplete: 'off' }), 'Gibt einen Computer für die nächste Person frei.')]),
      h('section', { class: 'blatt tafel' }, [h('h2', { text: 'Bewertung' }),
        bindCheck('noten', g, 'on', 'Note nach Notenschlüssel anzeigen', renderSettings),
        g.on ? h('p', { class: 'hinweis', text: 'Grenzen in Prozent der Gesamtpunkte, darunter Note 5.' }) : null,
        keyRow]));
  }

  /* ---------- Fragen ---------- */
  function move(i, d) {
    var j = i + d;
    if (j < 0 || j >= D.questions.length) return;
    var t = D.questions[i]; D.questions[i] = D.questions[j]; D.questions[j] = t;
    persist(); renderQuestions();
  }
  function changeType(q, type) {
    var next = newQuestion(type);
    next.id = q.id; next.prompt = q.prompt; next.points = q.points;
    if (q.options && next.options) next.options = q.options.map(function (o) { return { text: o.text, correct: o.correct }; });
    if (type === 'single' && next.options) {
      var seen = false;
      next.options.forEach(function (o) { if (o.correct && seen) o.correct = false; if (o.correct) seen = true; });
    }
    D.questions[D.questions.indexOf(q)] = next;
    persist(); renderQuestions();
  }

  function optionsEditor(q) {
    var radio = q.type === 'single';
    var rows = q.options.map(function (o, i) {
      var id = 'o-' + q.id + '-' + i;
      return h('div', { class: 'optionszeile' }, [
        h('input', { type: radio ? 'radio' : 'checkbox', name: 'korrekt-' + q.id, id: id + '-k', checked: !!o.correct, 'aria-label': 'Antwort ' + (i + 1) + ' ist richtig', title: 'Richtige Antwort markieren', onchange: function (e) {
          if (radio) q.options.forEach(function (x) { x.correct = false; });
          o.correct = e.target.checked; persist();
        } }),
        h('input', { type: 'text', id: id, value: o.text, 'aria-label': 'Antwort ' + (i + 1), placeholder: 'Antwort ' + (i + 1), oninput: function (e) { o.text = e.target.value; persist(); } }),
        h('button', { class: 'btn still icon rot', type: 'button', title: 'Antwort entfernen', 'aria-label': 'Antwort ' + (i + 1) + ' entfernen', text: '×', onclick: function () {
          q.options.splice(i, 1); persist(); renderQuestions();
        } })]);
    });
    return h('div', { class: 'optionen' }, [
      h('span', { class: 'hinweis', text: radio ? 'Markiere die richtige Antwort.' : 'Markiere alle richtigen Antworten. Falsch angekreuzte ziehen anteilig Punkte ab, mindestens bleiben 0 Punkte.' })
    ].concat(rows, [h('div', {}, [h('button', { class: 'btn klein', type: 'button', text: '+ Antwort', onclick: function () {
      q.options.push({ text: '', correct: false }); persist(); renderQuestions();
      var el = document.getElementById('o-' + q.id + '-' + (q.options.length - 1)); if (el) el.focus();
    } })])]));
  }

  /* ---------- Bilder: werden verkleinert und direkt in Entwurf und Schüler-Datei gespeichert ---------- */
  var imageFor = null;
  function fit(img, edge, quality) {
    var sw = img.naturalWidth, sh = img.naturalHeight, f = Math.min(1, edge / Math.max(sw, sh));
    var c = h('canvas', { width: Math.max(1, Math.round(sw * f)), height: Math.max(1, Math.round(sh * f)) }), x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(img, 0, 0, c.width, c.height);
    return { data: c.toDataURL('image/jpeg', quality), w: c.width, h: c.height };
  }
  function addImage(q, file) {
    if (!file || !/^image\//.test(file.type)) { toast('Das ist keine Bilddatei. Verwende JPG, PNG, GIF oder WebP.'); return; }
    if (file.size > 25 * 1024 * 1024) { toast('Das Bild ist größer als 25 MB. Verkleinere es zuerst.'); return; }
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      var r = fit(img, 1200, 0.8);
      if (r.data.length > 700000) r = fit(img, 900, 0.7);
      r.alt = q.image ? q.image.alt : '';
      q.image = r; persist(); renderQuestions();
    };
    img.onerror = function () { URL.revokeObjectURL(url); toast('Dieses Bild kann nicht gelesen werden. Verwende JPG, PNG, GIF oder WebP.'); };
    img.src = url;
  }
  function imageEditor(q) {
    var p = 'q-' + q.id, pickFile = function () { imageFor = q; document.getElementById('datei-bild').click(); };
    if (!q.image) return h('div', { class: 'bildzeile' }, [
      h('button', { class: 'btn klein', type: 'button', id: p + '-bild', text: 'Bild hinzufügen', onclick: pickFile }),
      h('span', { class: 'hinweis', text: 'oder hineinziehen oder mit Strg+V einfügen' })]);
    return h('div', { class: 'bildkarte' }, [
      h('img', { src: q.image.data, alt: q.image.alt || 'Bild zur Frage' }),
      h('div', { class: 'bildangaben' }, [
        field(p + '-alt', 'Bildbeschreibung (optional)', bindText(p + '-alt', q.image, 'alt')),
        h('div', { class: 'zeile' }, [
          h('button', { class: 'btn klein', type: 'button', id: p + '-bild', text: 'Bild ersetzen', onclick: pickFile }),
          h('button', { class: 'btn klein rot', type: 'button', id: p + '-bildweg', text: 'Bild entfernen', onclick: function () { delete q.image; persist(); renderQuestions(); } })])])]);
  }

  function tableEditor(q) {
    var p = 'q-' + q.id, t = q.table, cols = t.head.length;
    var num = function (id, label, val, max, on) {
      return field(id, label, h('input', { type: 'number', id: id, min: 1, max: max, step: 1, value: val, onchange: function (e) { on(Number(e.target.value)); persist(); renderQuestions(); } }));
    };
    var vars = h('select', { id: p + '-wt-n', 'aria-label': 'Anzahl der Variablen' }, [1, 2, 3, 4].map(function (n) { return h('option', { value: n, selected: n === 2, text: n + (n === 1 ? ' Variable' : ' Variablen') }); }));
    var grid = h('table', { class: 'editor-tabelle' }, [
      h('thead', {}, [h('tr', {}, t.head.map(function (x, c) {
        return h('th', {}, [h('input', { type: 'text', id: p + '-k' + c, value: x, 'aria-label': 'Überschrift Spalte ' + (c + 1), placeholder: 'Spalte ' + (c + 1), oninput: function (e) { t.head[c] = e.target.value; persist(); } })]);
      }))]),
      h('tbody', {}, t.rows.map(function (row, r) {
        return h('tr', {}, row.map(function (cell, c) {
          var id = p + '-z' + r + '-s' + c;
          return h('td', { class: cell.fill ? 'leer' : '' }, [
            h('input', { type: 'text', id: id, value: cell.t, 'aria-label': (cell.fill ? 'Lösung' : 'Vorgabe') + ' Zeile ' + (r + 1) + ', Spalte ' + (c + 1), placeholder: cell.fill ? 'Lösung' : '', oninput: function (e) { cell.t = e.target.value; persist(); } }),
            h('button', { class: 'zelle-art', type: 'button', id: id + '-art', 'aria-pressed': cell.fill ? 'true' : 'false', title: cell.fill ? 'Schüler füllen diese Zelle aus. Klicken macht sie zur Vorgabe.' : 'Vorgegebene Zelle. Klicken lässt sie von Schülern ausfüllen.', text: cell.fill ? 'ausfüllen' : 'vorgegeben', onclick: function () {
              if (cell.fill) delete cell.fill; else cell.fill = true;
              persist(); renderQuestions(); var b = document.getElementById(id + '-art'); if (b) b.focus();
            } })]);
        }));
      }))]);
    return [
      h('div', { class: 'tabellen-werkzeug' }, [
        num(p + '-spalten', 'Spalten', cols, MAX_COLS, function (v) { resizeTable(q, v, t.rows.length); }),
        num(p + '-zeilen', 'Zeilen', t.rows.length, MAX_ROWS, function (v) { resizeTable(q, cols, v); }),
        h('div', { class: 'feld' }, [h('span', { class: 'etikett', text: 'Wahrheitstabelle' }), h('div', { class: 'zeile' }, [vars,
          h('button', { class: 'btn klein', type: 'button', id: p + '-wt', text: 'Erzeugen', onclick: function () {
            var w = truthTable(Number(vars.value)); q.table = w.table; q.choices = w.choices; persist(); renderQuestions();
          } })])])]),
      h('p', { class: 'hinweis', text: 'Gelbe Zellen füllen Schüler aus. Trag dort die Lösung ein, weitere richtige Lösungen trennst du mit |. Mit dem Knopf unter jeder Zelle wechselst du zwischen vorgegeben und ausfüllen.' }),
      h('div', { class: 'tabelle' }, [grid]),
      field(p + '-auswahl', 'Auswahl für Schüler (optional)', bindText(p + '-auswahl', q, 'choices', { placeholder: 'z. B. 0, 1' }), 'Mit Komma getrennt. Dann wählen Schüler in jeder Zelle aus dieser Liste. Leer lassen für freie Eingabe.'),
      h('div', { class: 'schalter' }, [bindCheck(p + '-gk', q, 'caseSensitive', 'Groß- und Kleinschreibung beachten'), bindCheck(p + '-typo', q, 'typo', 'Einen Tippfehler dulden')])];
  }

  function typeEditor(q) {
    var p = 'q-' + q.id;
    switch (q.type) {
      case 'text':
        return [field(p + '-richtig', 'Richtige Antworten, eine pro Zeile', h('textarea', { id: p + '-richtig', rows: 2, value: (q.accepted || []).join('\n'), oninput: function (e) {
          q.accepted = e.target.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean); persist();
        } })),
        field(p + '-falsch', 'Falsche Antworten zur Auswahl (optional), eine pro Zeile', h('textarea', { id: p + '-falsch', rows: 2, value: (q.distractors || []).join('\n'), oninput: function (e) {
          q.distractors = e.target.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean); persist();
        } }), 'Leer lassen für freie Eingabe. Sonst wählen Schüler aus einer Liste, die aus deiner ersten richtigen Antwort und diesen falschen besteht.'),
        h('div', { class: 'schalter' }, [bindCheck(p + '-gk', q, 'caseSensitive', 'Groß- und Kleinschreibung beachten'), bindCheck(p + '-typo', q, 'typo', 'Einen Tippfehler dulden')])];
      case 'number':
        return [h('div', { class: 'paar', style: 'grid-template-columns:repeat(auto-fit,minmax(120px,1fr))' }, [
          field(p + '-wert', 'Richtiger Wert', bindText(p + '-wert', q, 'value', { placeholder: 'z. B. 3,5' })),
          field(p + '-tol', 'Abweichung ±', bindText(p + '-tol', q, 'tol', { placeholder: '0' })),
          field(p + '-einheit', 'Einheit', bindText(p + '-einheit', q, 'unit', { placeholder: 'z. B. km' }))])];
      case 'single': case 'multi': return [optionsEditor(q)];
      case 'tf':
        return [h('div', { class: 'schalter', role: 'radiogroup', 'aria-label': 'Richtige Lösung' }, [true, false].map(function (v) {
          return h('label', { class: 'haken' }, [h('input', { type: 'radio', name: p + '-wf', id: p + '-wf-' + v, checked: q.answer === v, onchange: function () { q.answer = v; persist(); } }), h('span', { text: v ? 'Die Aussage ist richtig' : 'Die Aussage ist falsch' })]);
        }))];
      case 'table': return tableEditor(q);
      case 'cloze':
        return [h('div', { class: 'schalter' }, [bindCheck(p + '-gk', q, 'caseSensitive', 'Groß- und Kleinschreibung beachten'), bindCheck(p + '-typo', q, 'typo', 'Einen Tippfehler dulden')])];
    }
    return [];
  }

  function renderQuestions() {
    var box = document.getElementById('fragen');
    box.textContent = '';
    summary();
    if (!D.questions.length) {
      box.append(h('div', { class: 'tafel' }, [h('h2', { text: 'Noch keine Fragen' }), h('p', { class: 'hinweis', text: 'Wähle unten eine Fragenart aus, um die erste Frage anzulegen.' })]));
      return;
    }
    D.questions.forEach(function (q, i) {
      var p = 'q-' + q.id, list = problems[q.id];
      var isCloze = q.type === 'cloze';
      box.append(h('section', { class: 'posten' + (list ? ' fehlerhaft' : ''), id: 'frage-' + q.id, 'aria-label': 'Frage ' + (i + 1) }, [
        h('div', { class: 'rand' }, [h('span', { class: 'nr', text: (i + 1) + '.' }), h('span', { class: 'pkt', text: C.fmt(Number(q.points) || 0) + ' P.' })]),
        h('div', { class: 'inhalt' }, [
          h('div', { class: 'frage-kopf' }, [
            h('div', { class: 'feld typ' }, [h('label', { for: p + '-typ', text: 'Fragenart' }),
              h('select', { id: p + '-typ', onchange: function (e) { changeType(q, e.target.value); } }, Object.keys(TYPES).map(function (k) {
                return h('option', { value: k, selected: k === q.type, text: TYPES[k] });
              }))]),
            h('div', { class: 'feld punkte' }, [h('label', { for: p + '-pkt', text: 'Punkte' }),
              h('input', { type: 'number', id: p + '-pkt', min: 0.5, step: 0.5, value: q.points, oninput: function (e) { q.points = Number(e.target.value); persist(); e.target.closest('.posten').querySelector('.pkt').textContent = C.fmt(q.points || 0) + ' P.'; } })]),
            h('div', { class: 'werkzeuge' }, [
              h('button', { class: 'btn still icon', type: 'button', title: 'Nach oben', 'aria-label': 'Frage ' + (i + 1) + ' nach oben', text: '↑', disabled: i === 0, onclick: function () { move(i, -1); } }),
              h('button', { class: 'btn still icon', type: 'button', title: 'Nach unten', 'aria-label': 'Frage ' + (i + 1) + ' nach unten', text: '↓', disabled: i === D.questions.length - 1, onclick: function () { move(i, 1); } }),
              h('button', { class: 'btn still icon', type: 'button', title: 'Kopieren', 'aria-label': 'Frage ' + (i + 1) + ' kopieren', text: '⧉', onclick: function () {
                var c = JSON.parse(JSON.stringify(q)); c.id = uid(); D.questions.splice(i + 1, 0, c); persist(); renderQuestions();
              } }),
              h('button', { class: 'btn still icon rot', type: 'button', title: 'Löschen', 'aria-label': 'Frage ' + (i + 1) + ' löschen', text: '×', onclick: function () {
                var removed = D.questions.splice(i, 1)[0]; delete problems[q.id]; persist(); renderQuestions();
                offerUndo(removed, i);
              } })])]),
          field(p + '-text', isCloze ? 'Text mit Lücken' : 'Frage', h('textarea', { id: p + '-text', rows: isCloze ? 3 : 2, value: q.prompt, oninput: function (e) { q.prompt = e.target.value; persist(); } }),
            isCloze ? 'Setze die Lösung in geschwungene Klammern: Wien liegt an der {Donau}. Mit | trennst du weitere richtige Lösungen: {Fahrrad|Rad}. Für eine Auswahlliste schreibst du falsche Antworten mit ~ dazu: {Donau|~Inn|~Mur}.' : null)
        ].concat([imageEditor(q)], typeEditor(q), list ? list.map(function (t) { return h('p', { class: 'problem', text: t }); }) : []))]));
    });
  }

  function offerUndo(q, i) {
    var el = document.getElementById('meldung');
    el.textContent = '';
    el.append('Frage gelöscht. ', h('button', { class: 'btn klein', type: 'button', text: 'Rückgängig', onclick: function () {
      D.questions.splice(i, 0, q); persist(); renderQuestions(); el.hidden = true;
    } }));
    el.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { el.hidden = true; }, 6000);
  }

  function summary() {
    var t = D.questions.reduce(function (s, q) { return s + (Number(q.points) || 0); }, 0), n = D.questions.length;
    document.getElementById('bilanz-titel').textContent = D.title || 'Neuer Test';
    document.getElementById('bilanz-zahlen').textContent = n + (n === 1 ? ' Frage · ' : ' Fragen · ') + C.fmt(t) + ' Punkte · ' + (D.minutes || 0) + ' Minuten';
    document.getElementById('beispiel').hidden = !D.sample;
  }

  function renderAdd() {
    var box = document.getElementById('hinzufuegen');
    Object.keys(TYPES).forEach(function (k) {
      box.append(h('button', { class: 'btn', type: 'button', id: 'neu-' + k, text: '+ ' + TYPES[k], onclick: function () {
        var q = newQuestion(k); D.questions.push(q); persist(); renderQuestions();
        var el = document.getElementById('q-' + q.id + '-text');
        if (el) { el.focus(); el.closest('.posten').scrollIntoView({ block: 'center' }); }
      } }));
    });
  }

  /* ---------- Prüfen und Erzeugen ---------- */
  function validate() {
    var g = [], per = {};
    if (!D.title.trim()) g.push('Gib dem Test einen Titel.');
    if (!(D.minutes >= 1 && D.minutes <= 600)) g.push('Die Zeit muss zwischen 1 und 600 Minuten liegen.');
    if (!String(D.pin || '').trim()) g.push('Lege eine Lehrer-PIN fest.');
    if (D.pruefAn && !(Number.isInteger(D.pruefZahl) && D.pruefZahl >= 1 && D.pruefZahl <= 99)) g.push('Die Anzahl der Prüfungen muss eine ganze Zahl von 1 bis 99 sein.');
    if (!D.questions.length) g.push('Lege mindestens eine Frage an.');
    if (D.grading.on) {
      var t = D.grading.thresholds;
      if (!(t[0] > t[1] && t[1] > t[2] && t[2] > t[3])) g.push('Die Notengrenzen müssen von Note 1 bis Note 4 kleiner werden.');
      if (!(t[0] <= 100 && t[3] >= 0)) g.push('Die Notengrenzen müssen zwischen 0 und 100 Prozent liegen.');
    }
    D.questions.forEach(function (q) {
      var e = [];
      if (!q.prompt.trim()) e.push(q.type === 'cloze' ? 'Der Lückentext fehlt.' : 'Der Fragetext fehlt.');
      if (!(q.points > 0)) e.push('Die Punkte müssen größer als 0 sein.');
      else if (Math.round(q.points * 2) !== q.points * 2) e.push('Punkte gehen nur in halben Schritten, zum Beispiel 1 oder 1,5.');
      if (q.type === 'text' && !(q.accepted || []).length) e.push('Trag mindestens eine richtige Antwort ein.');
      if (q.type === 'number') {
        if (isNaN(C.parseNum(q.value))) e.push('Trag als richtigen Wert eine Zahl ein.');
        if (String(q.tol || '').trim() && isNaN(C.parseNum(q.tol))) e.push('Die Abweichung muss eine Zahl sein.');
        else if (C.parseNum(q.tol) < 0) e.push('Die Abweichung darf nicht negativ sein.');
      }
      if (q.type === 'single' || q.type === 'multi') {
        var filled = q.options.filter(function (o) { return o.text.trim(); });
        if (filled.length < 2) e.push('Trag mindestens zwei Antworten ein.');
        if (!q.options.some(function (o) { return o.correct && o.text.trim(); })) e.push('Markiere die richtige Antwort.');
      }
      if (q.type === 'table') {
        var cells = C.tableGaps(q), ch = C.tableChoices(q);
        if (!cells.length) e.push('Markiere mindestens eine Zelle zum Ausfüllen.');
        if (cells.some(function (g) { return !g.acc.length; })) e.push('Trag in jede gelbe Zelle die Lösung ein.');
        else if (ch.length && cells.some(function (g) { return !g.acc.some(function (x) { return C.textMatches(x, ch, q); }); })) e.push('Jede Lösung muss in der Auswahl für Schüler vorkommen.');
      }
      if (q.type === 'cloze' && q.prompt.trim() && !C.gapsOf(q).length) e.push('Setze mindestens eine Lücke in {geschwungene Klammern}.');
      if (q.type === 'cloze' && C.gapsOf(q).some(function (x) { return !x.gap.length; })) e.push('Jede Lücke braucht eine richtige Antwort ohne ~.');
      if (e.length) per[q.id] = e;
    });
    problems = per;
    return { general: g, count: Object.keys(per).length };
  }

  function cleanQuestion(q) {
    var c = JSON.parse(JSON.stringify(q));
    if (c.options) c.options = c.options.filter(function (o) { return o.text.trim(); });
    return c;
  }

  function decodeTemplate() {
    var b = atob(document.getElementById('smu-vorlage').textContent.trim());
    var u = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return new TextDecoder().decode(u);
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function buildStudent(preview) {
    var id = 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    var code = preview ? '' : String(D.startCode || '').trim();
    var questions = D.questions.map(cleanQuestion);
    var secret = Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(16)), function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('');
    var meta = {
      id: id, title: D.title.trim(), subject: D.subject.trim(), cls: D.cls.trim(), teacher: D.teacher.trim(),
      minutes: D.minutes, count: questions.length, total: questions.reduce(function (s, q) { return s + Number(q.points); }, 0),
      needCode: !!code, pinHash: C.hash(id + ':' + String(D.pin).trim()), preview: !!preview,
      shuffleQ: D.shuffleQ, shuffleO: D.shuffleO, showSolutions: D.showSolutions, logBlur: D.logBlur,
      fullscreen: !preview && !!D.fullscreen, lock: !!D.lock,
      checks: D.pruefAn ? { mode: D.pruefArt === 'frage' ? 'frage' : 'gesamt', n: D.pruefZahl } : null,
      grading: D.grading.on ? D.grading : null
    };
    var html = decodeTemplate();
    var jsonMeta = JSON.stringify(meta).replace(/</g, '\\u003c');
    /* Ein einziger Durchlauf: Eingesetzter Text wird nicht noch einmal nach Platzhaltern durchsucht */
    var fill = { TITLE: esc(meta.title), META: jsonMeta, DATA: C.seal({ questions: questions, secret: secret }, id, code) };
    html = html.replace(/@@SMU_(TITLE|META|DATA)@@/g, function (m, k) { return fill[k]; });
    var parsed = new DOMParser().parseFromString(html, 'text/html');
    var fp = C.fingerprint(['smu-meta', 'smu-data', 'smu-core', 'smu-code'].map(function (i) { return parsed.getElementById(i).textContent; }));
    return { html: html, kontrolle: { art: 'smue-kontrolle', v: 1, id: id, secret: secret, fp: fp, title: meta.title, cls: meta.cls, minutes: meta.minutes, grading: meta.grading,
      questions: questions.map(function (q) { var c = JSON.parse(JSON.stringify(q)); delete c.image; return c; }) } };
  }

  var dlCap;
  function capability() {
    if (dlCap !== undefined) return Promise.resolve(dlCap);
    if (!window.claude || !window.claude.use) { dlCap = null; return Promise.resolve(null); }
    return window.claude.use('downloads').then(function (d) { dlCap = d; return d; }, function () { dlCap = null; return null; });
  }
  function saveFile(name, text, mime) {
    return capability().then(function (d) {
      if (d) return d.save({ filename: name, data: text }).then(function () { return true; }, function () { return false; });
      var url = URL.createObjectURL(new Blob([text], { type: mime }));
      var a = h('a', { href: url, download: name });
      document.body.append(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
      return true;
    });
  }
  function slug(s) { return String(s).slice(0, 80).replace(/[äÄöÖüÜß]/g, function (c) { return { ä: 'ae', Ä: 'Ae', ö: 'oe', Ö: 'Oe', ü: 'ue', Ü: 'Ue', ß: 'ss' }[c]; }).normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'Test'; }

  function dialog(title, body, actions) {
    closeDialog();
    var box = h('div', { class: 'abdeckung', id: 'dialog' }, [h('div', { class: 'blatt dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [h('h2', { text: title })].concat(body, [h('div', { class: 'zeile' }, actions)]))]);
    document.body.append(box);
    var b = box.querySelector('button'); if (b) b.focus();
  }
  function closeDialog() { var d = document.getElementById('dialog'); if (d) d.remove(); }

  function check() {
    var r = validate();
    renderQuestions();
    if (!r.general.length && !r.count) return true;
    var first = Object.keys(problems)[0];
    var items = r.general.slice();
    if (r.count) items.push(r.count === 1 ? 'Bei einer Frage fehlt noch etwas. Sie ist rot markiert.' : 'Bei ' + r.count + ' Fragen fehlt noch etwas. Sie sind rot markiert.');
    dialog('Das fehlt noch', [h('ul', {}, items.map(function (t) { return h('li', { text: t }); }))], [
      h('button', { class: 'btn voll', type: 'button', text: 'Zur Bearbeitung', onclick: function () {
        closeDialog();
        var el = first && document.getElementById('frage-' + first);
        if (el) el.scrollIntoView({ block: 'center' });
      } })]);
    return false;
  }

  function generate() {
    if (!check()) return;
    var name = 'Smue_' + slug(D.title) + (D.cls.trim() ? '_' + slug(D.cls) : '') + '.html';
    var built = buildStudent(false), kname = name.replace(/\.html$/, '_Kontrolle.json');
    saveFile(name, built.html, 'text/html').then(function (ok) {
      if (!ok) { toast('Die Schüler-Datei wurde nicht gespeichert.'); return false; }
      return new Promise(function (res) { setTimeout(res, 500); }).then(function () { return saveFile(kname, JSON.stringify(built.kontrolle), 'application/json'); }).then(function (k) { return k ? 'ok' : 'ohne'; });
    }).then(function (ok) {
      if (!ok) return;
      var code = String(D.startCode || '').trim();
      dialog('Schüler-Datei gespeichert', [
        h('p', { text: name }),
        h('div', { class: 'codes' }, [
          h('span', { text: 'Startcode' }), h('b', { text: code || 'keiner' }),
          h('span', { text: 'Lehrer-PIN' }), h('b', { text: String(D.pin).trim() })]),
        h('p', { class: ok === 'ok' ? 'hinweis' : 'problem', text: ok === 'ok' ? 'Die Kontrolldatei ' + kname + ' ist ebenfalls gespeichert. Gib sie nie weiter: Sie enthält die Lösungen und den Schlüssel zum Prüfen der Abgaben.' : 'Die Kontrolldatei wurde nicht gespeichert. Ohne sie kannst du die Abgaben nicht prüfen. Erzeuge die Schüler-Datei noch einmal.' }),
        h('p', { class: 'hinweis', text: 'Notiere dir Startcode und PIN. Schüler brauchen nur die Schüler-Datei und einen Browser, auch ohne Internet.' })
      ], [h('button', { class: 'btn voll', type: 'button', text: 'Fertig', onclick: closeDialog })]);
    });
  }

  function preview() {
    if (!check()) return;
    var f = h('iframe', { title: 'Vorschau der Schüler-Ansicht' });
    f.srcdoc = buildStudent(true).html;
    var box = h('div', { class: 'vorschau', id: 'vorschau' }, [
      h('div', { class: 'vorschau-kopf' }, [h('span', { text: 'Vorschau wie bei Schülern' }), h('button', { class: 'btn klein', type: 'button', id: 'vorschau-zu', text: 'Vorschau schließen', onclick: function () { box.remove(); } })]), f]);
    document.body.append(box);
  }

  function exportDraft() {
    saveFile('Smue-Entwurf_' + slug(D.title) + '.json', JSON.stringify(D, null, 2), 'application/json').then(function (ok) {
      if (ok) toast('Entwurf gespeichert.');
    });
  }
  function importDraft(file) {
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var d = cleanDraft(JSON.parse(rd.result));
        if (!d) throw new Error('form');
        d.sample = false; D = d; problems = {}; persist(); renderSettings(); renderQuestions();
        toast('Entwurf geladen.');
      } catch (e) { toast('Diese Datei ist kein Smü-Entwurf.'); }
    };
    rd.readAsText(file);
  }
  function startNew() {
    dialog('Neuen Test beginnen?', [h('p', { text: D.sample ? 'Der Beispiel-Test wird geleert.' : 'Der aktuelle Entwurf wird geleert. Speichere ihn vorher, wenn du ihn noch brauchst.' })], [
      h('button', { class: 'btn', type: 'button', text: 'Abbrechen', onclick: closeDialog }),
      h('button', { class: 'btn voll', type: 'button', id: 'wirklich-neu', text: 'Leeren', onclick: function () {
        D = emptyDraft(); problems = {}; persist(); renderSettings(); renderQuestions(); closeDialog();
        var t = document.getElementById('titel'); if (t) t.focus();
      } })]);
  }

  /* ---------- Bilder: Datei wählen, ziehen, einfügen ---------- */
  var bildInput = document.getElementById('datei-bild');
  bildInput.addEventListener('change', function () { if (bildInput.files[0] && imageFor) addImage(imageFor, bildInput.files[0]); bildInput.value = ''; });
  function questionAt(el) {
    var sec = el && el.closest ? el.closest('section[id^="frage-"]') : null;
    return sec ? D.questions.filter(function (q) { return 'frage-' + q.id === sec.id; })[0] : null;
  }
  document.getElementById('fragen').addEventListener('dragover', function (e) { if (questionAt(e.target)) e.preventDefault(); });
  document.getElementById('fragen').addEventListener('drop', function (e) {
    var q = questionAt(e.target), f = e.dataTransfer && e.dataTransfer.files[0];
    if (q && f) { e.preventDefault(); addImage(q, f); }
  });
  document.addEventListener('paste', function (e) {
    var q = questionAt(document.activeElement), items = e.clipboardData ? e.clipboardData.files : [];
    if (q && items[0] && /^image\//.test(items[0].type)) { e.preventDefault(); addImage(q, items[0]); }
  });

  /* ---------- Abgaben prüfen ---------- */
  var K = null, rows = [];
  var LABEL = { echt: 'echt', auffaellig: 'auffällig', veraendert: 'verändert', ohne: 'nicht prüfbar', fremd: 'anderer Test' };
  function zeit(ms) { return new Date(ms).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  function logText(e) {
    if (e.type === 'switch') return zeit(e.at) + (e.q ? ' Frage ' + e.q + ': ' : ': ') + 'Testfenster verlassen' + (e.back ? ' bis ' + zeit(e.back) : '');
    return zeit(e.at) + (e.q ? ' Frage ' + e.q + ': ' : ': ') + e.text;
  }
  function renderCheck() {
    document.getElementById('pruef-kontrolle').textContent = K ? 'Geladen: ' + K.title + (K.cls ? ', Klasse ' + K.cls : '') : 'Noch keine Kontrolldatei geladen.';
    document.getElementById('knopf-pdf').disabled = !K;
    var box = document.getElementById('pruef-liste');
    box.textContent = '';
    if (!rows.length) return;
    var names = {};
    rows.forEach(function (r) { var k = r.name.trim().toLowerCase(); if (k) names[k] = (names[k] || 0) + 1; });
    var ok = rows.filter(function (r) { return r.status === 'echt'; }).length;
    box.append(h('p', { class: 'hinweis', id: 'pruef-summe', text: rows.length + (rows.length === 1 ? ' Abgabe' : ' Abgaben') + ', davon ' + ok + ' echt.' }));
    box.append(h('div', { class: 'tabelle' }, [h('table', {}, [
      h('thead', {}, [h('tr', {}, ['Datei', 'Name', 'Punkte', 'Note', 'Status', 'Protokoll'].map(function (t) { return h('th', { text: t }); }))]),
      h('tbody', {}, rows.map(function (r) {
        var notes = r.hinweise.slice();
        if (names[r.name.trim().toLowerCase()] > 1) notes.push('Mehrere Abgaben mit diesem Namen.');
        return h('tr', { 'data-status': r.status }, [
          h('td', { class: 'umbruch', text: r.datei }), h('td', { class: 'umbruch', text: r.name || '–' }),
          h('td', { text: r.earned === null ? '–' : C.fmt(r.earned) + ' von ' + C.fmt(r.max) }),
          h('td', { text: r.note ? String(r.note.nr) : '–' }),
          h('td', {}, [h('b', { class: 'status ' + r.status, text: LABEL[r.status] })].concat(notes.map(function (t) { return h('div', { class: 'hinweis', text: t }); }))),
          h('td', {}, r.log.length ? [h('details', {}, [h('summary', { text: r.log.length + (r.log.length === 1 ? ' Eintrag' : ' Einträge') }),
            h('ul', {}, r.log.map(function (e) { return h('li', { text: logText(e) }); }))])] : [h('span', { text: 'keine' })])]);
      }))])]));
  }
  function readAll(files) {
    return Promise.all(Array.prototype.map.call(files, function (f) {
      return new Promise(function (res) {
        var rd = new FileReader();
        rd.onload = function () { var r = C.pruefen(new Uint8Array(rd.result), K); r.datei = f.name; res(r); };
        rd.onerror = function () { res({ datei: f.name, status: 'ohne', hinweise: ['Die Datei konnte nicht gelesen werden.'], name: '', earned: null, note: null, log: [] }); };
        rd.readAsArrayBuffer(f);
      });
    }));
  }
  var pruefPanel = document.getElementById('pruefen');
  document.getElementById('knopf-pruefen').addEventListener('click', function () { pruefPanel.hidden = false; renderCheck(); document.getElementById('pruefen-zu').focus(); });
  document.getElementById('pruefen-zu').addEventListener('click', function () { pruefPanel.hidden = true; document.getElementById('knopf-pruefen').focus(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pruefPanel.hidden) pruefPanel.hidden = true; });
  var kInput = document.getElementById('datei-kontrolle'), pInput = document.getElementById('datei-abgaben');
  document.getElementById('knopf-kontrolle').addEventListener('click', function () { kInput.click(); });
  document.getElementById('knopf-pdf').addEventListener('click', function () { pInput.click(); });
  kInput.addEventListener('change', function () {
    var f = kInput.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var k = JSON.parse(rd.result);
        if (k.art !== 'smue-kontrolle' || !Array.isArray(k.questions) || !k.secret) throw new Error('art');
        K = k; rows = []; renderCheck();
      } catch (e) { document.getElementById('pruef-kontrolle').textContent = 'Das ist keine Kontrolldatei. Sie endet auf _Kontrolle.json.'; }
    };
    rd.readAsText(f); kInput.value = '';
  });
  pInput.addEventListener('change', function () {
    if (!K || !pInput.files.length) return;
    readAll(pInput.files).then(function (neu) { rows = rows.concat(neu); renderCheck(); });
    pInput.value = '';
  });

  document.getElementById('knopf-erzeugen').addEventListener('click', generate);
  document.getElementById('knopf-vorschau').addEventListener('click', preview);
  document.getElementById('knopf-speichern').addEventListener('click', exportDraft);
  document.getElementById('knopf-neu').addEventListener('click', startNew);
  document.getElementById('knopf-beispiel-neu').addEventListener('click', startNew);
  var fileInput = document.getElementById('datei-laden');
  document.getElementById('knopf-laden').addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', function () { if (fileInput.files[0]) importDraft(fileInput.files[0]); fileInput.value = ''; });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeDialog(); var v = document.getElementById('vorschau'); if (v) v.remove(); } });

  renderSettings(); renderAdd(); renderQuestions();
  window.SMU_HILFE.init();
  var guide = document.getElementById('anleitung'), guideBack = null;
  function closeGuide() { guide.hidden = true; if (guideBack) guideBack.focus(); }
  document.getElementById('knopf-anleitung').addEventListener('click', function (e) {
    guideBack = e.currentTarget; guide.hidden = false; document.getElementById('anleitung-zu').focus();
  });
  document.getElementById('anleitung-zu').addEventListener('click', closeGuide);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !guide.hidden) closeGuide(); });
})();

(function () {
  'use strict';
  var C = window.SMU;
  var M = JSON.parse(document.getElementById('smu-meta').textContent);
  var SEALED = document.getElementById('smu-data').textContent.trim();
  var KEY = 'smue:' + M.id;
  var app = document.getElementById('app');
  var Q = null, S = null, SECRET = '', timerId = 0, warned = {};
  var openLeave = null, currentQ = null, guardBar = null, testMain = null, ignoreBlurUntil = 0, lastReturn = null;
  var watcher = 0, B = null, panelOpen = false, small = false, lastActive = 0, idleFrom = 0;

  function load() {
    if (M.preview) return null;
    try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
  }
  function save() {
    if (M.preview) return;
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ohne Speicher läuft der Test weiter */ }
  }
  function wipe() { try { localStorage.removeItem(KEY); } catch (e) { /* nichts zu tun */ } }

  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'text') el.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] === true) el.setAttribute(k, '');
      else if (attrs[k] !== false && attrs[k] != null) el.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  function clear() { clearInterval(timerId); app.textContent = ''; }
  function shuffled(n) {
    var a = [], i, j, t;
    for (i = 0; i < n; i++) a[i] = i;
    for (i = n - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function plain(n) { return shuffled(n).sort(function (x, y) { return x - y; }); }
  function pts(n) { return C.fmt(n) + (n === 1 ? ' Punkt' : ' Punkte'); }
  function fullName() { return S.first + ' ' + S.last; }
  function dt(ms) {
    return new Date(ms).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function mmss(sec) {
    sec = Math.max(0, Math.ceil(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function kopf() {
    var fach = [M.subject, M.cls].filter(Boolean).join(' · ');
    return h('header', { class: 'blatt kopf' }, [
      fach ? h('div', { class: 'fach', text: fach }) : null,
      h('h1', { text: M.title }),
      M.teacher ? h('div', { class: 'hinweis', text: M.teacher }) : null
    ]);
  }

  function after(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }

  /* ---------- Protokoll ---------- */
  var KINDS = {
    check: 'Prüfknopf benutzt', paste: 'Einfügen', copy: 'Kopieren', menu: 'Rechtsklick', key: 'Tastenkürzel', tried: 'Tastenkürzel versucht (gesperrt)', screen: 'Vollbild verlassen',
    panel: 'Seitenleiste oder Entwicklertools', size: 'Fenstergröße', ext: 'Fremde Inhalte auf der Seite', burst: 'Text auf einmal eingetragen',
    back: 'Antwort kurz nach der Rückkehr', idle: 'Keine Aktivität', reload: 'Seite neu geladen', monitor: 'Zweiter Bildschirm',
    reveal: 'Frage aufgelöst', skip: 'Frage übersprungen', nofs: 'Kein Vollbild möglich'
  };
  var lastLog = {}, seenOnce = {};
  function logging() { return M.logBlur && S && S.phase === 'test'; }
  function logE(kind, text, q) {
    if (!logging() || S.log.length >= 400) return;
    var now = Date.now(), key = kind + text + '|' + (q || currentQ || '');
    if (lastLog[key] && now - lastLog[key] < 1500) return;
    lastLog[key] = now;
    S.log.push({ type: 'event', kind: kind, at: now, text: text, q: q || currentQ || null });
    save();
  }
  function once(key, kind, text) { if (!seenOnce[key]) { seenOnce[key] = 1; logE(kind, text); } }
  function cut(t) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > 80 ? t.slice(0, 80) + ' …' : t; }
  function qnr(el) {
    var sec = el && el.closest ? el.closest('section[data-nr]') : null;
    return sec ? Number(sec.getAttribute('data-nr')) : null;
  }
  function clock(ms) { return new Date(ms).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  /* Einheitliche Liste für Ergebnisseite und PDF */
  function protocol() {
    return (S.log || []).filter(function (e) { return e.type === 'switch' || e.type === 'event'; }).map(function (e) {
      if (e.type === 'event' && e.fs) {   // echtes Verlassen des Vollbilds, mit Dauer
        var ms = e.back ? e.back - e.at : 0;
        return { at: e.at, q: e.q, kind: e.kind, fsAway: ms,
          text: 'Vollbild verlassen' + (e.back ? ' bis ' + clock(e.back) + ' (' + mmss(ms / 1000) + ' min)' : ' bis zur Abgabe') };
      }
      if (e.type === 'event') return { at: e.at, q: e.q, kind: e.kind, text: e.text };
      var away = e.back ? ' bis ' + clock(e.back) + ' (' + mmss((e.back - e.at) / 1000) + ' min)' : ' bis zur Abgabe';
      return { at: e.at, q: e.q, kind: 'switch', text: 'Testfenster verlassen' + (e.via ? ' (vermutlich ' + e.via + ')' : '') + away, away: e.back ? e.back - e.at : 0 };
    });
  }

  var keysLocked = false;   // Tastatursperre aktiv: Systemtasten erreichen nur die Seite
  function isFs() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function enterFs() {
    var d = document.documentElement, f = d.requestFullscreen || d.webkitRequestFullscreen;
    if (!f) return Promise.resolve(false);
    ignoreBlurUntil = Date.now() + 1200;
    try {
      var r = f.call(d);
      return (r && r.then ? r.then(function () { return true; }, function () { return false; }) : after(250).then(isFs))
        .then(function (ok) { if (ok) lockKeys(); return ok; });
    } catch (e) { return Promise.resolve(false); }
  }
  /* Tastatursperre (Chrome, Edge): Esc beendet das Vollbild erst nach langem Drücken,
     Windows-Taste, Alt+Tab und Strg+W gehen an die Seite statt ans System. */
  function lockKeys() {
    try {
      if (navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock().then(function () { keysLocked = true; }, function () { keysLocked = false; });
    } catch (e) { /* nicht verfügbar */ }
  }
  function unlockKeys() {
    keysLocked = false;
    try { if (navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock(); } catch (e) { /* nicht verfügbar */ }
  }
  function leaveFs() {
    unlockKeys();
    try {
      if (document.exitFullscreen && document.fullscreenElement) document.exitFullscreen();
      else if (document.webkitExitFullscreen && document.webkitFullscreenElement) document.webkitExitFullscreen();
    } catch (e) { /* bleibt im Vollbild */ }
  }
  function guard() {
    if (!guardBar || !S || S.phase !== 'test' || !M.fullscreen || !S.fsOk) return;
    var off = !isFs();
    guardBar.hidden = !off;
    if (testMain) testMain.hidden = off;
  }
  function onFs() {
    if (!S || S.phase !== 'test') return;
    if (M.fullscreen && S.fsOk && !isFs()) {
      keysLocked = false;   // die Sperre gilt nur im Vollbild
      if (logging() && !openFs() && S.log.length < 400) { S.log.push({ type: 'event', kind: 'screen', at: Date.now(), text: 'Vollbild verlassen', q: currentQ || null, fs: true }); save(); }
    } else if (isFs()) {
      var o = openFs();
      if (o) { o.back = Date.now(); save(); }
    }
    guard();
    setTimeout(baseline, 700);
  }
  /* noch offenes Verlassen des Vollbilds (auch über ein Neuladen hinweg) */
  function openFs() {
    for (var i = (S.log || []).length - 1; i >= 0; i--) { var e = S.log[i]; if (e.fs) return e.back ? null : e; }
    return null;
  }
  function baseline() {
    B = { dw: window.outerWidth - window.innerWidth, dh: window.outerHeight - window.innerHeight, w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio };
    panelOpen = false; small = false;
  }
  function touch() {
    var now = Date.now();
    if (idleFrom) { logE('idle', 'Keine Eingabe von ' + clock(idleFrom) + ' bis ' + clock(now) + ' (' + mmss((now - idleFrom) / 1000) + ' min)'); idleFrom = 0; }
    lastActive = now;
  }
  function scanForeign(nodes) {
    Array.prototype.forEach.call(nodes, function (n) {
      if (n.nodeType !== 1 || n === app || /^(HEAD|BODY|SCRIPT|STYLE|LINK|NOSCRIPT|META)$/.test(n.tagName)) return;
      var name = n.tagName.toLowerCase() + (n.id ? '#' + n.id : '');
      once('el:' + name, 'ext', 'Fremdes Element auf der Seite, meist eine Browser-Erweiterung: ' + name.slice(0, 60));
    });
  }
  function watchTick() {
    if (!logging() || !B) return;
    var now = Date.now(), dpr = window.devicePixelRatio === B.dpr;
    var wider = window.outerWidth - window.innerWidth - B.dw >= 120, higher = window.outerHeight - window.innerHeight - B.dh >= 120;
    var open = dpr && (wider || higher);
    if (open !== panelOpen) {
      panelOpen = open;
      logE('panel', open ? 'Seitenleiste oder Entwicklertools geöffnet' : 'Seitenleiste oder Entwicklertools geschlossen');
    }
    if (!isFs() && dpr) {
      var tiny = window.innerWidth < B.w * 0.8 && !open;
      if (tiny !== small) { small = tiny; logE('size', tiny ? 'Fenster verkleinert auf ' + window.innerWidth + ' × ' + window.innerHeight + ' Pixel' : 'Fenster wieder vergrößert'); }
    }
    if (!idleFrom && !openLeave && now - lastActive >= 120000) idleFrom = lastActive;
  }
  function startWatch() {
    if (watcher) return;
    lastActive = Date.now();
    setTimeout(function () {
      baseline();
      if (!isFs() && window.screen && window.screen.availWidth && window.outerWidth < window.screen.availWidth * 0.7) {
        once('klein', 'size', 'Fenster nutzt nur ' + Math.round(window.outerWidth / window.screen.availWidth * 100) + ' % der Bildschirmbreite');
      }
    }, 700);
    if (window.screen && window.screen.isExtended) once('schirm', 'monitor', 'Zweiter Bildschirm angeschlossen');
    scanForeign(document.documentElement.children);
    scanForeign(document.body.children);
    var mo = new MutationObserver(function (list) {
      list.forEach(function (m) {
        if (m.type === 'childList') { scanForeign(m.addedNodes); return; }
        var d = document.documentElement;
        if (/translated/.test(d.className) || d.lang !== 'de') once('uebersetzt', 'ext', 'Seite wurde automatisch übersetzt');
      });
    });
    mo.observe(document.documentElement, { childList: true, attributes: true, attributeFilter: ['class', 'lang'] });
    mo.observe(document.body, { childList: true });
    watcher = setInterval(watchTick, 1000);
  }
  function stopWatch() { clearInterval(watcher); watcher = 0; }

  /* ---------- Browser: Tastatursperre und Unterlagen gibt es nur in Chrome und Edge ----------
     Erkennung über die Markennamen (navigator.userAgentData), sonst über den User-Agent.
     Der Safe Exam Browser (Chromium) ist erlaubt. Eine gefälschte Kennung überlistet die Prüfung, sie ist eine Hürde, kein Beweis. */
  var BROWSER_NAME = { chrome: 'Google Chrome', edge: 'Microsoft Edge', seb: 'Safe Exam Browser', chromium: 'Chromium', firefox: 'Firefox', safari: 'Safari', andere: 'ein anderer Browser' };
  function browser() {
    var ua = navigator.userAgent || '', d = navigator.userAgentData;
    if (/SEB\//.test(ua)) return 'seb';
    if (d && Array.isArray(d.brands) && d.brands.length) {
      var b = d.brands.map(function (x) { return String(x.brand); });
      if (b.indexOf('Microsoft Edge') >= 0) return 'edge';
      if (b.indexOf('Google Chrome') >= 0) return 'chrome';
      var eigen = b.filter(function (x) { return !/not.?a.?brand/i.test(x) && x !== 'Chromium' && x !== 'HeadlessChrome'; });   // Headless = Chromium ohne Fenster (automatische Tests)
      return !eigen.length && b.indexOf('Chromium') >= 0 ? 'chromium' : 'andere';
    }
    if (/HeadlessChrome\//.test(ua)) return 'chromium';
    if (/Firefox\//.test(ua)) return 'firefox';
    if (/Safari\//.test(ua) && !/Chrome\/|Chromium\//.test(ua)) return 'safari';
    return 'andere';
  }
  function browserOk() { return !M.browserCheck || M.preview || /^(chrome|edge|seb|chromium)$/.test(browser()); }
  function viewBrowser() {
    var name = BROWSER_NAME[browser()];
    app.append(h('main', { class: 'seite' }, [kopf(),
      h('section', { class: 'blatt formular', role: 'alert', id: 'falscher-browser' }, [
        h('h2', { text: 'Bitte öffne den Test in Chrome oder Edge' }),
        h('p', { text: 'Du hast den Test in ' + name + ' geöffnet. Dieser Test läuft nur in Google Chrome oder Microsoft Edge, weil nur dort Vollbild und Tastatursperre richtig funktionieren.' }),
        h('ol', { class: 'regeln' }, [
          h('li', { text: 'Schließ dieses Fenster.' }),
          h('li', { text: 'Klick mit der rechten Maustaste auf die Test-Datei und wähle „Öffnen mit“.' }),
          h('li', { text: 'Wähle Google Chrome oder Microsoft Edge.' })]),
        h('p', { class: 'hinweis', text: 'Wenn beides fehlt, sag deiner Lehrkraft Bescheid.' })])]));
  }

  /* ---------- Start ---------- */
  function viewStart() {
    clear();
    if (!browserOk()) { viewBrowser(); return; }
    var err = h('p', { class: 'fehler', role: 'alert', hidden: true });
    var first = h('input', { type: 'text', id: 'vorname', autocomplete: 'off', required: true });
    var last = h('input', { type: 'text', id: 'nachname', autocomplete: 'off', required: true });
    var cls = M.cls ? null : h('input', { type: 'text', id: 'klasse', autocomplete: 'off' });
    var code = M.needCode ? h('input', { type: 'text', id: 'startcode', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'characters' }) : null;

    var form = h('form', { class: 'blatt formular', novalidate: true, onsubmit: function (ev) {
      ev.preventDefault();
      err.hidden = true;
      var f = first.value.trim(), l = last.value.trim();
      if (!f || !l) { err.textContent = 'Trag bitte deinen Vor- und Nachnamen ein.'; err.hidden = false; (f ? last : first).focus(); return; }
      var c = code ? code.value : '';
      var data = C.unseal(SEALED, M.id, c);
      if (!data) { err.textContent = 'Dieser Startcode stimmt nicht. Frag deine Lehrkraft.'; err.hidden = false; code && code.focus(); return; }
      var go = function (fsOk) { begin(data, f, l, cls ? cls.value.trim() : M.cls, c, fsOk); };
      if (M.fullscreen) enterFs().then(go); else go(false);
    } }, [
      h('div', { class: 'fakten' }, [
        h('span', {}, [h('b', { text: String(M.minutes) }), ' Minuten']),
        h('span', {}, [h('b', { text: String(M.count) }), M.count === 1 ? ' Frage' : ' Fragen']),
        h('span', {}, [h('b', { text: C.fmt(M.total) }), ' Punkte'])
      ]),
      h('div', { class: 'paar' }, [
        h('div', { class: 'feld' }, [h('label', { for: 'vorname', text: 'Vorname' }), first]),
        h('div', { class: 'feld' }, [h('label', { for: 'nachname', text: 'Nachname' }), last]),
        cls ? h('div', { class: 'feld' }, [h('label', { for: 'klasse', text: 'Klasse' }), cls]) : null,
        code ? h('div', { class: 'feld' }, [h('label', { for: 'startcode', text: 'Startcode' }), code]) : null
      ]),
      h('ul', { class: 'regeln' }, [
        h('li', { text: 'Die Zeit läuft ab dem Klick auf „Test starten“.' }),
        h('li', { text: 'Wenn die Zeit abläuft, wird dein Test automatisch abgegeben.' }),
        h('li', { text: 'Du kannst die Seite neu laden: Antworten und Zeit bleiben erhalten.' }),
        M.checks ? h('li', { text: M.checks.mode === 'frage' ? 'Bei jeder Frage kannst du deine Antwort ' + M.checks.n + ' Mal prüfen.' : 'Du kannst deine Antworten insgesamt ' + M.checks.n + ' Mal prüfen. Teil dir das gut ein.' }) : null,
        M.reveal ? h('li', { text: 'Mit „Auflösen“ siehst du die richtige Antwort einer Frage. Diese Frage bringt dann 0 Punkte.' }) : null,
        M.fullscreen ? h('li', { text: 'Der Test läuft im Vollbild. Wenn du es verlässt, verschwinden die Fragen, bis du zurückkehrst. Die Zeit läuft weiter.' }) : null,
        M.lock ? h('li', { text: 'Kopieren, Einfügen und Rechtsklick sind gesperrt.' }) : null,
        M.logBlur ? h('li', { text: 'Fensterwechsel, Einfügen, Kopieren, Tastenkürzel und Erweiterungen werden mit Uhrzeit im Protokoll vermerkt. Das Protokoll steht im PDF.' }) : null
      ]),
      err,
      folderRow(),
      h('div', {}, [h('button', { class: 'btn voll', type: 'submit', text: 'Test starten' })])
    ]);
    app.append(h('main', { class: 'seite' }, [kopf(), form,
      M.preview ? h('p', { class: 'hinweis', text: 'Vorschau: Eingaben werden nicht gespeichert.' }) : null]));
    first.focus();
  }

  function begin(data, f, l, cls, code, fsOk) {
    Q = data.questions; SECRET = data.secret || '';
    var order = M.shuffleQ ? shuffled(Q.length) : plain(Q.length);
    var opts = {};
    Q.forEach(function (q) {
      if (q.type === 'single' || q.type === 'multi') opts[q.id] = M.shuffleO ? shuffled(q.options.length) : plain(q.options.length);
    });
    var now = Date.now();
    S = { phase: 'test', first: f, last: l, cls: cls || '', code: code, startedAt: now, endsAt: now + M.minutes * 60000,
      order: order, opts: opts, answers: {}, blurs: 0, log: [], fsOk: !!fsOk, checks: {}, checked: {}, revealed: {}, browser: BROWSER_NAME[browser()] };
    if (M.fullscreen && !fsOk) logE('nofs', 'Vollbild war auf diesem Gerät nicht möglich');
    save();
    viewTest();
  }

  /* ---------- Test ---------- */
  function byOrder() { return S.order.map(function (i) { return Q[i]; }); }
  function setAnswer(q, v) {
    if (S.revealed && S.revealed[q.id]) return; /* aufgelöste Fragen bleiben, wie sie sind */
    S.answers[q.id] = v; save(); updateCount(); showCheck(q);
    if (lastReturn && !lastReturn.done[q.id] && Date.now() - lastReturn.at <= 30000) {
      lastReturn.done[q.id] = 1;
      var nr = S.order.indexOf(Q.indexOf(q)) + 1;
      logE('back', 'Antwort ' + Math.max(1, Math.round((Date.now() - lastReturn.at) / 1000)) + ' s nach der Rückkehr, vorher ' + Math.round(lastReturn.away / 1000) + ' s weg', nr);
    }
  }
  var countEl = null;
  function updateCount() {
    if (!countEl) return;
    var done = Q.filter(function (q) { return C.isAnswered(q, S.answers[q.id]); }).length;
    countEl.textContent = M.single ? 'Frage ' + (Math.min(S.pos || 0, Q.length - 1) + 1) + ' von ' + Q.length
      : done + ' von ' + Q.length + ' beantwortet';
  }
  var INPUT = { type: 'text', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false' };
  function inp(extra) { var a = {}, k; for (k in INPUT) a[k] = INPUT[k]; for (k in extra) a[k] = extra[k]; return h('input', a); }

  /* ---------- Prüfknopf: Kontingent gesamt oder je Frage, verbrauchte Prüfungen bleiben auch nach dem Neuladen verbraucht ---------- */
  var CHECK_TEXT = { full: 'Richtig', partial: 'Teilweise richtig', wrong: 'Nicht richtig' };
  function checksUsed(q) {
    if (M.checks.mode === 'frage') return S.checks[q.id] || 0;
    return Object.keys(S.checks).reduce(function (n, k) { return n + S.checks[k]; }, 0);
  }
  function checksLeft(q) { return Math.max(0, M.checks.n - checksUsed(q)); }
  function answerKey(q) { return JSON.stringify(S.answers[q.id] === undefined ? null : S.answers[q.id]); }
  function showCheck(q) {
    if (!M.checks) return;
    var msg = document.getElementById('pruef-msg-' + q.id), c = S.checked[q.id];
    if (!msg) return;
    var valid = c && c.a === answerKey(q);
    msg.textContent = valid ? CHECK_TEXT[c.st] : '';
    msg.className = 'pruef-ergebnis ' + (valid ? c.st : '');
  }
  function refreshChecks() {
    if (!M.checks) return;
    Q.forEach(function (q) {
      var b = document.getElementById('pruef-' + q.id);
      if (!b) return;
      var left = checksLeft(q);
      if (isRevealed(q)) { b.disabled = true; b.textContent = 'Prüfen (aufgelöst)'; return; }
      b.disabled = left === 0;
      b.textContent = left ? 'Prüfen (noch ' + left + ')' : 'Prüfen (aufgebraucht)';
    });
  }
  function runCheck(q, n) {
    var msg = document.getElementById('pruef-msg-' + q.id);
    if (S.phase !== 'test' || checksLeft(q) === 0 || isRevealed(q)) return;
    if (!C.isAnswered(q, S.answers[q.id])) { msg.textContent = 'Trag zuerst eine Antwort ein.'; msg.className = 'pruef-ergebnis'; return; }
    var key = answerKey(q), c = S.checked[q.id];
    if (c && c.a === key) { showCheck(q); return; } /* dieselbe Antwort kostet nichts */
    var st = C.grade(q, S.answers[q.id]).status;
    S.checks[q.id] = (S.checks[q.id] || 0) + 1;
    S.checked[q.id] = { a: key, st: st };
    save();
    logE('check', 'Antwort geprüft: ' + CHECK_TEXT[st], n);
    showCheck(q); refreshChecks();
  }
  function checkRow(q, n) {
    if (!M.checks && !M.reveal) return [];
    return [h('div', { class: 'pruefzeile' }, [
      M.checks ? h('button', { class: 'btn klein', type: 'button', id: 'pruef-' + q.id, title: M.checks.mode === 'frage' ? 'Prüft deine Antwort. Diese Prüfungen gelten nur für diese Frage.' : 'Prüft deine Antwort. Alle Fragen teilen sich diese Prüfungen.', onclick: function () { runCheck(q, n); } }) : null,
      M.checks ? h('span', { class: 'pruef-ergebnis', id: 'pruef-msg-' + q.id, role: 'status' }) : null,
      M.reveal ? h('button', { class: 'btn klein still', type: 'button', id: 'aufloesen-' + q.id, text: 'Auflösen', title: 'Zeigt die richtige Antwort. Diese Frage bringt dann 0 Punkte.', onclick: function () { askReveal(q, n); } }) : null]),
      M.reveal ? h('div', { class: 'antwort richtig aufgeloest', id: 'loesung-' + q.id, hidden: true }) : null];
  }

  /* ---------- Auflösen: zeigt die Lösung einer Frage, die Frage bringt danach 0 Punkte ---------- */
  function isRevealed(q) { return !!(S && S.revealed && S.revealed[q.id]); }
  function askReveal(q, n) {
    if (S.phase !== 'test' || isRevealed(q)) return;
    var b = document.getElementById('aufloesen-' + q.id);
    if (b.getAttribute('data-sicher')) { reveal(q, n); return; }
    b.setAttribute('data-sicher', '1');
    b.textContent = 'Wirklich auflösen? 0 Punkte';
    setTimeout(function () { if (!isRevealed(q) && b.isConnected) { b.removeAttribute('data-sicher'); b.textContent = 'Auflösen'; } }, 4000);
  }
  function reveal(q, n) {
    S.revealed = S.revealed || {};
    S.revealed[q.id] = true;
    save();
    logE('reveal', 'Frage aufgelöst', n);
    showReveal(q); refreshChecks(); updateCount();
  }
  function showReveal(q) {
    if (!isRevealed(q)) return;
    var box = document.getElementById('loesung-' + q.id), b = document.getElementById('aufloesen-' + q.id);
    if (!box) return;
    var sec = box.closest('section');
    if (sec) {
      sec.classList.add('ist-aufgeloest');
      Array.prototype.forEach.call(sec.querySelectorAll('.inhalt input, .inhalt select'), function (el) { el.disabled = true; });
    }
    if (b) { b.disabled = true; b.textContent = 'Aufgelöst · 0 Punkte'; }
    box.textContent = '';
    if (q.type === 'table') {
      box.append(h('span', { class: 'k', text: 'Lösung' }), resultTable(q, null, true));
    } else {
      box.append(h('span', { class: 'k', text: 'Lösung' }), h('span', { text: C.grade(q, undefined).solution }));
    }
    box.hidden = false;
  }

  function imageOf(q, n) {
    return q.image ? h('img', { class: 'fragebild', src: q.image.data, alt: q.image.alt || 'Bild zu Frage ' + n, draggable: 'false' }) : null;
  }
  function withImage(q, parts, n) {
    var img = imageOf(q, n);
    if (img) parts.splice(q.type === 'cloze' ? 0 : 1, 0, img);
    return parts;
  }

  function pick(id, label, list, value, on) {
    return h('select', { id: id, class: 'auswahl', 'aria-label': label, onchange: function (e) { on(e.target.value); } },
      [h('option', { value: '', text: 'Bitte wählen' })].concat(list.map(function (t) {
        return h('option', { value: t, selected: t === value, text: t });
      })));
  }

  function questionBody(q, n) {
    var a = S.answers[q.id], label = 'Antwort zu Frage ' + n;
    switch (q.type) {
      case 'text':
        var list = (q.distractors || []).length ? C.choiceList(q.accepted, q.distractors) : null;
        return [h('p', { class: 'frage', text: q.prompt }),
          list ? pick('a-' + q.id, label, list, a, function (v) { setAnswer(q, v); })
            : inp({ id: 'a-' + q.id, 'aria-label': label, value: a || '', oninput: function (e) { setAnswer(q, e.target.value); } })];
      case 'number':
        return [h('p', { class: 'frage', text: q.prompt }), h('div', { class: 'mit-einheit' }, [
          inp({ id: 'a-' + q.id, inputmode: 'text', 'aria-label': label, value: a || '', oninput: function (e) { setAnswer(q, e.target.value); } }),
          q.unit ? h('span', { text: q.unit }) : null])];
      case 'single':
      case 'tf':
        var rows = q.type === 'tf' ? [{ v: true, t: 'Richtig' }, { v: false, t: 'Falsch' }]
          : S.opts[q.id].map(function (i) { return { v: i, t: q.options[i].text }; });
        return [h('p', { class: 'frage', text: q.prompt }), h('div', { class: 'wahl', role: 'radiogroup', 'aria-label': label }, rows.map(function (r, idx) {
          return h('label', { class: 'option' }, [
            h('input', { type: 'radio', id: 'a-' + q.id + '-' + idx, name: 'a-' + q.id, checked: a === r.v, onchange: function () { setAnswer(q, r.v); } }),
            h('span', { text: r.t })]);
        }))];
      case 'multi':
        return [h('p', { class: 'frage', text: q.prompt }), h('p', { class: 'hinweis', text: 'Mehrere Antworten können richtig sein.' }),
          h('div', { class: 'wahl' }, S.opts[q.id].map(function (i) {
            return h('label', { class: 'option' }, [
              h('input', { type: 'checkbox', id: 'a-' + q.id + '-' + i, checked: (a || []).indexOf(i) >= 0, onchange: function (e) {
                var cur = (S.answers[q.id] || []).filter(function (x) { return x !== i; });
                if (e.target.checked) cur.push(i);
                setAnswer(q, cur);
              } }),
              h('span', { text: q.options[i].text })]);
          }))];
      case 'table':
        var tAns = a || [], k = 0, opts = C.tableChoices(q);
        return [h('p', { class: 'frage', text: q.prompt }), h('div', { class: 'tabelle-wrap' }, [h('table', { class: 'aufgabe-tabelle' }, [
          q.table.head.some(function (x) { return String(x).trim(); }) ? h('thead', {}, [h('tr', {}, q.table.head.map(function (t) { return h('th', { text: t }); }))]) : null,
          h('tbody', {}, q.table.rows.map(function (row, r) {
            return h('tr', {}, row.map(function (cell, c) {
              if (!cell.fill) return h('td', { text: cell.t });
              var i = k++, label = 'Zeile ' + (r + 1) + ', Spalte ' + (c + 1) + ' in Frage ' + n;
              var set = function (v) { var cur = (S.answers[q.id] || []).slice(); cur[i] = v; setAnswer(q, cur); };
              return h('td', { class: 'leer' }, [opts.length ? pick('a-' + q.id + '-' + i, label, opts, tAns[i], set)
                : inp({ id: 'a-' + q.id + '-' + i, 'aria-label': label, value: tAns[i] || '', oninput: function (e) { set(e.target.value); } })]);
            }));
          }))])])];
      case 'cloze':
        var gap = 0, arr = a || [];
        return [h('p', { class: 'hinweis', text: 'Füll die Lücken aus.' }), h('p', { class: 'luecken' }, C.parseCloze(q.prompt).map(function (p) {
          if (!p.gap) return p.t;
          var i = gap++;
          if (p.wrong.length) return pick('a-' + q.id + '-' + i, 'Lücke ' + (i + 1) + ' in Frage ' + n, C.choiceList(p.gap, p.wrong), arr[i], function (v) {
            var cur = (S.answers[q.id] || []).slice(); cur[i] = v; setAnswer(q, cur);
          });
          return inp({ id: 'a-' + q.id + '-' + i, 'aria-label': 'Lücke ' + (i + 1) + ' in Frage ' + n, value: arr[i] || '', oninput: function (e) {
            var cur = (S.answers[q.id] || []).slice(); cur[i] = e.target.value; setAnswer(q, cur);
          } });
        }))];
    }
    return [];
  }

  function viewTest() {
    clear();
    var uhr = h('div', { class: 'uhr', role: 'timer', 'aria-label': 'Verbleibende Zeit', title: 'Verbleibende Zeit. Bei 0 wird automatisch abgegeben.' });
    var balken = h('i', {});
    var bar = h('div', { class: 'zeitbalken' }, [balken]);
    var live = h('div', { 'aria-live': 'assertive', style: 'position:absolute;left:-9999px' });
    countEl = h('span', {});
    if (hasDocs() && !U) U = unterlagen();
    var uKnopf = U ? h('button', { class: 'btn klein', type: 'button', id: 'knopf-unterlagen', text: 'Unterlagen', 'aria-expanded': 'false', 'aria-controls': 'unterlagen',
      title: 'Zeigt die erlaubten Unterlagen (z. B. Datenblatt, Schaltplan) neben dem Test.', onclick: function () {
        if (U.offen()) U.schliessen(uKnopf); else U.oeffnen(uKnopf, leiste);
      } }) : null;
    var leiste = h('div', { class: 'leiste' }, [
      h('div', { class: 'leiste-innen' }, [
        h('div', { class: 'wer' }, [h('b', { text: fullName() }), countEl]),
        uhr, uKnopf,
        h('button', { class: 'btn klein', type: 'button', text: 'Abgeben', title: 'Beendet den Test. Du wirst vorher noch einmal gefragt.', onclick: askSubmit })
      ]), bar]);
    var alle = byOrder();
    function skipsLeft() { return Math.max(0, (M.skips || 0) - (S.skipped || 0)); }
    function posten(q, i) {
      return h('section', { class: 'posten', 'data-nr': i + 1, 'aria-label': 'Frage ' + (i + 1) }, [
        h('div', { class: 'rand' }, [h('span', { class: 'nr', text: (i + 1) + '.' }),
          h('span', { class: 'pkt', text: C.fmt(C.maxPoints(q)) + ' P.' })]),
        h('div', { class: 'inhalt' }, withImage(q, questionBody(q, i + 1), i + 1).concat(checkRow(q, i + 1)))]);
    }
    /* Eine Frage pro Seite: nur die aktuelle Frage steht im Dokument, zurück geht es nicht */
    if (M.single && typeof S.pos !== 'number') { S.pos = 0; save(); }
    var blatt = h('div', { class: 'blatt' }, M.single ? [] : alle.map(posten));
    var fuss = h('div', { class: 'blatt abgabe' });
    function zeigeFrage() {
      blatt.textContent = ''; fuss.textContent = '';
      var i = Math.min(S.pos, alle.length - 1), letzte = i === alle.length - 1;
      blatt.append(posten(alle[i], i));
      currentQ = i + 1;
      var mitSkip = (M.skips || 0) > 0, weiterText = mitSkip ? 'Frage einreichen' : 'Weiter zur nächsten Frage';
      var weiter = h('button', { class: 'btn voll', type: 'button', id: 'weiter', text: letzte ? 'Test abgeben' : weiterText, onclick: function () {
        if (letzte) { askSubmit(); return; }
        if (!weiter.getAttribute('data-sicher')) {
          weiter.setAttribute('data-sicher', '1');
          weiter.textContent = C.isAnswered(alle[i], S.answers[alle[i].id]) ? 'Sicher? Zurück geht nicht mehr' : 'Frage noch offen – trotzdem weiter?';
          setTimeout(function () { if (weiter.isConnected) { weiter.removeAttribute('data-sicher'); weiter.textContent = weiterText; } }, 4000);
          return;
        }
        S.pos = i + 1; save();
        naechste();
      } });
      /* Überspringen: die Frage wandert ans Ende der Reihenfolge, die Antwort bleibt erhalten */
      var rest = skipsLeft();
      var skip = mitSkip && !letzte ? h('button', { class: 'btn', type: 'button', id: 'ueberspringen', disabled: rest < 1,
        text: '(' + rest + ') Frage überspringen',
        title: rest ? 'Stellt die Frage ans Ende. Du kannst noch ' + rest + '-mal überspringen.' : 'Du hast alle Überspringen verbraucht.',
        onclick: function () {
          if (skipsLeft() < 1) return;
          var idx = S.order.splice(i, 1)[0];
          S.order.push(idx);
          S.skipped = (S.skipped || 0) + 1;
          logE('skip', 'Frage ' + (i + 1) + ' ans Ende gestellt (jetzt Frage ' + S.order.length + '): ' + cut(Q[idx].prompt).slice(0, 50), i + 1);
          save();
          alle = byOrder();
          naechste();
        } }) : null;
      fuss.append(h('span', { class: 'hinweis', text: letzte ? 'Letzte Frage. Danach gibst du ab.'
        : 'Frage ' + (i + 1) + ' von ' + alle.length + '. Mit „' + weiterText + '“ kommst du nicht mehr zurück.'
          + (mitSkip ? ' „Überspringen“ stellt die Frage ans Ende, deine Antwort bleibt.' : '') }),
        h('div', { class: 'knoepfe' }, [skip, weiter]));
    }
    function naechste() {
      zeigeFrage(); updateCount(); refreshChecks(); Q.forEach(showCheck); Q.forEach(showReveal);
      window.scrollTo(0, 0);
    }
    if (M.single) zeigeFrage();
    else fuss.append(
      h('span', { class: 'hinweis', text: 'Fertig? Kontrolliere deine Antworten und gib dann ab.' }),
      h('button', { class: 'btn voll', type: 'button', text: 'Test abgeben', onclick: askSubmit }));
    guardBar = h('div', { class: 'freigabe', hidden: true }, [
      h('span', { text: 'Der Test läuft im Vollbild. Die Zeit läuft weiter.' }),
      h('button', { class: 'btn klein', type: 'button', id: 'zurueck-vollbild', text: 'Zurück zum Vollbild', onclick: function () {
        enterFs().then(guard);
      } })]);
    testMain = h('main', { class: 'seite' }, [
      kopf(), blatt, fuss, U ? U.el : null]);
    app.append(leiste, guardBar, live, testMain);
    document.body.classList.toggle('gesperrt', !!M.lock);
    document.body.classList.toggle('einzeln', !!M.single);
    updateCount();
    refreshChecks();
    Q.forEach(showCheck);
    Q.forEach(showReveal);
    guard();
    startWatch();

    function tick() {
      var left = (S.endsAt - Date.now()) / 1000, total = M.minutes * 60;
      if (left <= 0) { submit(true); return; }
      uhr.textContent = mmss(left);
      balken.style.width = Math.max(0, left / total * 100) + '%';
      var state = left <= 60 ? 'knapp' : left <= 300 && total > 300 ? 'bald' : '';
      uhr.className = 'uhr ' + state; bar.className = 'zeitbalken ' + state;
      if (left <= 300 && total > 300 && !warned.five) { warned.five = 1; live.textContent = 'Noch 5 Minuten.'; }
      if (left <= 60 && !warned.one) { warned.one = 1; live.textContent = 'Noch 1 Minute.'; }
    }
    tick();
    timerId = setInterval(tick, 250);
  }

  function askSubmit() {
    if (document.getElementById('frage-abgabe')) return;
    var open = Q.filter(function (q) { return !C.isAnswered(q, S.answers[q.id]); }).length;
    var box, cancel = h('button', { class: 'btn', type: 'button', text: 'Weiterarbeiten', onclick: function () { box.remove(); } });
    box = h('div', { class: 'abdeckung', id: 'frage-abgabe' }, [
      h('div', { class: 'blatt dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'abgabe-t' }, [
        h('h2', { id: 'abgabe-t', text: 'Test wirklich abgeben?' }),
        h('p', { text: open ? (open === 1 ? 'Eine Frage ist noch offen.' : open + ' Fragen sind noch offen.') + ' Danach kannst du nichts mehr ändern.' : 'Du hast alle Fragen beantwortet. Danach kannst du nichts mehr ändern.' }),
        h('div', { class: 'zeile' }, [cancel, h('button', { class: 'btn voll', type: 'button', id: 'jetzt-abgeben', text: 'Jetzt abgeben', onclick: function () { submit(false); } })])])]);
    app.append(box);
    cancel.focus();
  }

  function submit(auto) {
    if (S.phase === 'done') return;
    S.phase = 'done'; S.auto = !!auto; S.submittedAt = auto ? Math.min(Date.now(), S.endsAt) : Date.now();
    openLeave = null;
    stopWatch(); leaveFs();
    document.body.classList.remove('gesperrt');
    document.body.classList.remove('einzeln');
    if (U) U.schliessen(null);
    save();
    viewDone();
    /* Das PDF wird sofort angeboten; der Knopf bleibt für den Fall, dass der Browser es blockiert. */
    setTimeout(function () { pdfNow(); }, 300);
  }

  function results() {
    var rows = byOrder().map(function (q) { var g = C.gradeRevealed(q, S.answers[q.id], S.revealed); g.q = q; return g; });
    var earned = rows.reduce(function (s, r) { return s + r.earned; }, 0);
    var max = rows.reduce(function (s, r) { return s + r.max; }, 0);
    var pct = max ? Math.floor(earned / max * 1000 + 1e-6) / 10 : 0; /* nie aufrunden, sonst kippt die Note an der Grenze */
    return { rows: rows, earned: earned, max: max, pct: pct, note: C.gradeLabel(pct, M.grading) };
  }
  var MARK = { full: '✓', partial: '±', wrong: '✗', empty: '✗', revealed: '–' };
  var MARK_LABEL = { full: 'richtig', partial: 'teilweise richtig', wrong: 'falsch', empty: 'falsch', revealed: 'aufgelöst' };
  /* Wie viel das Schüler-PDF (und die Ergebnisseite) zeigt:
     voll     = Antworten mit ✓/✗, Punkten je Frage und (falls eingestellt) Lösungen
     ohne     = nur die eigenen Antworten, ohne Bewertung je Frage: Raten und früh Abgeben verrät nichts
     quittung = nur Name, Zeiten, Gesamtpunkte und Protokoll. Die Antworten stecken unsichtbar in den Prüfdaten,
                die Lehrkraft sieht die Einzelauswertung unter „Abgaben prüfen“. */
  function stufe() { return M.pdfMode === 'ohne' || M.pdfMode === 'quittung' ? M.pdfMode : 'voll'; }
  function bewertet() { return stufe() === 'voll'; }

  function viewDone() {
    clear();
    var r = results();
    var msg = h('p', { class: 'hinweis', role: 'status' });
    var side = [
      h('div', { class: 'wer-groß', text: fullName() }),
      h('div', { text: C.fmt(r.pct) + ' % der Punkte' + (r.note ? ' · Note ' + r.note.nr + ' (' + r.note.name + ')' : '') }),
      S.auto ? h('div', { class: 'hinweis', text: 'Die Zeit ist abgelaufen, der Test wurde automatisch abgegeben.' }) : null
    ];
    var mit = bewertet();
    var rows = r.rows.map(function (x, i) {
      var q = x.q;
      return h('section', { class: 'posten', 'aria-label': 'Frage ' + (i + 1) }, [
        h('div', { class: 'rand' }, [h('span', { class: 'nr', text: (i + 1) + '.' }),
          mit ? h('span', { class: 'erreicht', text: C.fmt(x.earned) }) : null,
          h('span', { class: 'pkt', text: mit ? 'von ' + C.fmt(x.max) : C.fmt(x.max) + ' P.' })]),
        h('div', { class: 'inhalt' }, [
          h('div', { class: 'zeile', style: 'flex-wrap:nowrap;align-items:flex-start' }, [
            mit ? h('span', { class: 'mark ' + x.status, 'aria-label': MARK_LABEL[x.status], text: MARK[x.status] }) : null,
            h('p', { class: 'frage', style: 'min-width:0', text: q.type === 'cloze' ? q.prompt.replace(/\{[^{}]*\}/g, '_____') : q.prompt })]),
          mit && x.status === 'revealed' ? h('p', { class: 'hinweis', text: 'Aufgelöst, daher 0 Punkte.' }) : null,
          q.type === 'table' ? resultTable(q, S.answers[q.id], x.status === 'revealed', !mit) : h('div', { class: 'antwort' }, [h('span', { class: 'k', text: 'Deine Antwort' }), h('span', { text: x.given || 'keine Antwort' })]),
          mit && (M.showSolutions || x.status === 'revealed') && x.status !== 'full' && q.type !== 'table' ? h('div', { class: 'antwort richtig' }, [h('span', { class: 'k', text: 'Richtig wäre' }), h('span', { text: x.solution })]) : null
        ])]);
    });
    msg.id = 'pdf-meldung';
    var foot = h('div', { class: 'fusszeile' }, [
      M.selfRestart ? h('button', { class: 'btn klein', type: 'button', id: 'neu-starten', text: 'Test neu starten', title: 'Löscht dieses Ergebnis und beginnt den Test von vorne. Speichere vorher das PDF, wenn du es behalten willst.', onclick: function (e) { askRestart(e.currentTarget); } }) : null,
      h('button', { class: 'btn still klein', type: 'button', text: 'Für die nächste Person freigeben (Lehrkraft)', onclick: function () { askPin(foot); } })]);
    app.append(h('main', { class: 'seite' }, [kopf(),
      h('div', { class: 'blatt' }, [
        h('div', { class: 'ergebnis' }, [
          h('div', { class: 'note-hand' }, [C.fmt(r.earned), h('span', { class: 'von', text: ' von ' + C.fmt(r.max) })]),
          h('div', { class: 'ergebnis-info' }, side)]),
        h('div', { class: 'ergebnis-aktion' }, [
          h('button', { class: 'btn voll', type: 'button', id: 'pdf-holen', title: 'Speichert deine Auswertung als PDF im gewählten Speicherordner, sonst im Download-Ordner.', text: stufe() === 'quittung' ? 'Abgabebestätigung als PDF speichern' : 'PDF mit Auswertung speichern', onclick: function () { pdfNow(); } }),
          folderRow(), msg])]),
      M.scoreOnly || stufe() === 'quittung' ? null : h('div', { class: 'blatt' }, rows), protocolBox(), foot]));
  }

  /* PDF erstellen und Ergebnis melden */
  function pdfNow() {
    var msg = document.getElementById('pdf-meldung');
    var p;
    try { p = makePdf(); } catch (e) { p = Promise.reject(e); }
    return p.then(function (folder) {
      if (msg) msg.textContent = folder ? 'Das PDF liegt im Ordner „' + folder + '“.' : 'Das PDF liegt in deinem Download-Ordner.';
    }, function () {
      if (msg) msg.textContent = 'Das PDF konnte nicht erstellt werden. Sag deiner Lehrkraft Bescheid und zeig ihr diese Seite.';
    });
  }

  /* Neustart ohne PIN: zweiter Klick bestätigt */
  function askRestart(b) {
    if (b.getAttribute('data-sicher')) { wipe(); S = null; Q = null; viewStart(); return; }
    b.setAttribute('data-sicher', '1');
    b.textContent = 'Wirklich neu starten? Ergebnis wird gelöscht';
    setTimeout(function () { if (b.isConnected) { b.removeAttribute('data-sicher'); b.textContent = 'Test neu starten'; } }, 4000);
  }

  /* ---------- Speicherordner: einmal wählen, der Browser merkt ihn sich ---------- */
  function canFolder() { return !!(window.showDirectoryPicker && window.indexedDB); }
  function idb(mode, fn) {
    return new Promise(function (ok, no) {
      var r = indexedDB.open('smue-ordner', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('h'); };
      r.onerror = function () { no(r.error); };
      r.onsuccess = function () {
        var tx = r.result.transaction('h', mode), q = fn(tx.objectStore('h'));
        tx.oncomplete = function () { ok(q && q.result); r.result.close(); };
        tx.onerror = function () { no(tx.error); };
      };
    });
  }
  function getDir() { return canFolder() ? idb('readonly', function (s) { return s.get('dir'); }).catch(function () { return null; }) : Promise.resolve(null); }
  function pickDir() {
    return window.showDirectoryPicker({ id: 'smue-pdf', mode: 'readwrite', startIn: 'downloads' }).then(function (d) {
      return idb('readwrite', function (s) { s.put(d, 'dir'); }).then(function () { return d; });
    });
  }
  function allowed(d) {
    var o = { mode: 'readwrite' };
    return d.queryPermission(o).then(function (p) { return p === 'granted' || d.requestPermission(o).then(function (p2) { return p2 === 'granted'; }); });
  }
  function saveBlob(blob, name) {
    return getDir().then(function (d) {
      if (!d) return null;
      return allowed(d).then(function (ok) {
        if (!ok) return null;
        return d.getFileHandle(name, { create: true })
          .then(function (fh) { return fh.createWritable(); })
          .then(function (w) { return w.write(blob).then(function () { return w.close(); }); })
          .then(function () { return d.name; });
      });
    }).catch(function () { return null; }).then(function (folder) {
      if (folder) return folder;
      var url = URL.createObjectURL(blob), a = h('a', { href: url, download: name });
      document.body.append(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
      return null;
    });
  }
  function folderRow() {
    if (!canFolder()) return null;
    var label = h('span', { class: 'hinweis', text: 'Speicherort: Download-Ordner' });
    var show = function (d) { label.textContent = 'Speicherort: ' + (d ? 'Ordner „' + d.name + '“' : 'Download-Ordner'); };
    getDir().then(show);
    return h('div', { class: 'ordnerzeile' }, [label,
      h('button', { class: 'btn klein still', type: 'button', text: 'Ordner wählen', title: 'Wähle den Ordner, in dem die PDFs landen sollen, zum Beispiel den Ordner mit dieser Testdatei. Der Browser merkt sich die Wahl.', onclick: function () {
        pickDir().then(show, function () { /* abgebrochen */ });
      } })]);
  }

  /* Tabelle mit Antworten; falsche Zellen rot, mit Lösung, wenn Lösungen gezeigt werden */
  function tableCellsFor(q, a) {
    var ans = Array.isArray(a) ? a : [], k = 0;
    return q.table.rows.map(function (row) {
      return row.map(function (cell) {
        if (!cell.fill) return { t: cell.t };
        var i = k++, acc = String(cell.t || '').split('|').map(function (x) { return x.trim(); }).filter(Boolean);
        var given = String(ans[i] || '').trim(), ok = C.textMatches(given, acc, q);
        return { t: given || '–', ok: ok, fill: true, sol: ok ? '' : acc.join(' / ') };
      });
    });
  }
  function resultTable(q, a, solutions, ohneBewertung) {
    var showSol = M.showSolutions || !!solutions;
    if (ohneBewertung) {   // nur die eigenen Einträge, ohne ✓/✗ und Lösung
      return h('div', { class: 'tabelle-wrap' }, [h('table', { class: 'aufgabe-tabelle' }, [
        q.table.head.some(function (x) { return String(x).trim(); }) ? h('thead', {}, [h('tr', {}, q.table.head.map(function (t) { return h('th', { text: t }); }))]) : null,
        h('tbody', {}, tableCellsFor(q, a).map(function (row) {
          return h('tr', {}, row.map(function (c) { return h('td', { class: c.fill ? 'leer' : null, text: c.t }); }));
        }))])]);
    }
    return h('div', { class: 'tabelle-wrap' }, [h('table', { class: 'aufgabe-tabelle' }, [
      q.table.head.some(function (x) { return String(x).trim(); }) ? h('thead', {}, [h('tr', {}, q.table.head.map(function (t) { return h('th', { text: t }); }))]) : null,
      h('tbody', {}, tableCellsFor(q, a).map(function (row) {
        return h('tr', {}, row.map(function (c) {
          if (!c.fill) return h('td', { text: c.t });
          return h('td', { class: 'leer ' + (c.ok ? 'gut' : 'schlecht'), 'aria-label': c.ok ? 'richtig' : 'falsch' }, [
            h('span', { text: (c.ok ? '✓ ' : '✗ ') + c.t }),
            !c.ok && showSol ? h('span', { class: 'loesung', text: c.sol }) : null]);
        }));
      }))])]);
  }

  function protocolBox() {
    if (!M.logBlur) return null;
    var list = protocol();
    if (!list.length) return h('p', { class: 'hinweis', text: 'Protokoll: keine Einträge.' });
    return h('details', { class: 'blatt protokoll' }, [
      h('summary', { text: 'Protokoll: ' + list.length + (list.length === 1 ? ' Eintrag' : ' Einträge') }),
      h('ul', {}, list.map(function (e) {
        return h('li', {}, [h('span', { class: 'ziffern', text: clock(e.at) }), h('span', { text: (e.q ? 'Frage ' + e.q + ': ' : '') + e.text })]);
      }))]);
  }

  function askPin(foot) {
    foot.textContent = '';
    var input = h('input', { type: 'password', id: 'lehrer-pin', 'aria-label': 'Lehrer-PIN', placeholder: 'Lehrer-PIN', autocomplete: 'off' });
    var err = h('span', { class: 'fehler', role: 'alert' });
    foot.append(h('form', { class: 'pin', onsubmit: function (e) {
      e.preventDefault();
      if (C.hash(M.id + ':' + input.value.trim()) === M.pinHash) { wipe(); S = null; Q = null; viewStart(); }
      else { err.textContent = 'Diese PIN stimmt nicht.'; input.select(); }
    } }, [input, h('button', { class: 'btn klein', type: 'submit', text: 'Freigeben' }), err]));
    input.focus();
  }

  function selfPrint() {
    return C.fingerprint(['smu-meta', 'smu-data', 'smu-core', 'smu-code'].map(function (id) { return document.getElementById(id).textContent; }));
  }

  /* ---------- PDF ---------- */
  function makePdf() {
    var r = results();
    var J = window.jspdf.jsPDF, doc = new J({ unit: 'mm', format: 'a4' });
    doc.addFileToVFS('r.ttf', window.__SMU_FONTS.r); doc.addFont('r.ttf', 'S', 'normal');
    doc.addFileToVFS('b.ttf', window.__SMU_FONTS.b); doc.addFont('b.ttf', 'S', 'bold');
    var L = 20, R = 190, W = R - L, BOTTOM = 280, y = 20;
    var INK = [31, 53, 168], RED = [207, 32, 39], GREEN = [18, 112, 58], AMBER = [148, 86, 10], GREY = [86, 96, 121], TEXT = [27, 34, 54];
    function font(style, size, col) { doc.setFont('S', style); doc.setFontSize(size); doc.setTextColor.apply(doc, col || TEXT); }
    function lh(size) { return size * 0.4583; }
    function page() { doc.addPage(); y = 20; }
    function lines(txt, width, x, size) {
      var ls = doc.splitTextToSize(String(txt), width), h2 = lh(size);
      ls.forEach(function (l) { if (y + h2 > BOTTOM) page(); doc.text(l, x, y); y += h2; });
    }

    var fach = [M.subject, S.cls].filter(Boolean).join(' · ');
    if (fach) { font('normal', 10, GREY); doc.text(fach, L, y); y += 8; }
    y += 3; font('bold', 18, INK); lines(M.title, W, L, 18); y += 1;
    font('normal', 10, GREY); doc.text('Auswertung der schriftlichen Mitarbeitsüberprüfung', L, y); y += 3;
    doc.setDrawColor.apply(doc, RED); doc.setLineWidth(0.5); doc.line(L, y, R, y); y += 7;

    var mins = Math.max(0, (S.submittedAt - S.startedAt) / 1000);
    var facts = [['Name', fullName()], ['Klasse', S.cls || '–'], ['Beginn', dt(S.startedAt) + ' Uhr'], ['Abgabe', dt(S.submittedAt) + ' Uhr'], ['Bearbeitungszeit', mmss(mins) + ' min (von ' + M.minutes + ' min)']];
    if (M.teacher) facts.push(['Lehrkraft', M.teacher]);
    if (S.browser) facts.push(['Browser', S.browser]);
    var plog = protocol();
    if (M.checks) facts.push(['Prüfknopf benutzt', Object.keys(S.checks || {}).reduce(function (n, k) { return n + S.checks[k]; }, 0) + ' Mal']);
    if (M.reveal) facts.push(['Aufgelöst', Object.keys(S.revealed || {}).length + (Object.keys(S.revealed || {}).length === 1 ? ' Frage' : ' Fragen') + ' (je 0 Punkte)']);
    if (M.logBlur) facts.push(['Protokoll', plog.length ? plog.length + (plog.length === 1 ? ' Eintrag' : ' Einträge') + ', siehe Ende' : 'keine Einträge']);
    facts.forEach(function (f) {
      font('bold', 10); doc.text(f[0], L, y);
      font('normal', 10); lines(f[1], W - 38, L + 38, 10); y += 1;
    });
    if (S.auto) { font('bold', 10, AMBER); doc.text('Automatisch abgegeben, weil die Zeit abgelaufen ist.', L, y); y += 6; }
    y += 2;

    var scoreH = r.note ? 21 : 15;
    doc.setDrawColor.apply(doc, INK); doc.setLineWidth(0.4); doc.rect(L, y, W, scoreH);
    font('bold', 15, RED); doc.text(C.fmt(r.earned) + ' von ' + C.fmt(r.max) + ' Punkten', L + 5, y + 7);
    font('normal', 11); doc.text(C.fmt(r.pct) + ' %', R - 5, y + 7, { align: 'right' });
    if (r.note) { font('bold', 11, TEXT); doc.text('Note ' + r.note.nr + ': ' + r.note.name, L + 5, y + 14); }
    y += scoreH + 9;

    function pdfTable(q) {
      var cols = q.table.head.length, cw = Math.min(32, (W - 14) / cols), x0 = L + 14;
      var withHead = q.table.head.some(function (t) { return String(t).trim(); });
      var cells = tableCellsFor(q, S.answers[q.id]);
      var fit = function (t) { return doc.splitTextToSize(String(t), cw - 2)[0] || ''; };
      var line = function () { doc.setDrawColor.apply(doc, [150, 160, 180]); doc.setLineWidth(0.2); };
      if (withHead) {
        if (y + 7 > BOTTOM) page();
        doc.setFillColor(238, 242, 248); doc.rect(x0, y - 4.5, cw * cols, 6.5, 'F'); line(); doc.rect(x0, y - 4.5, cw * cols, 6.5);
        font('bold', 9, TEXT);
        q.table.head.forEach(function (t, c) { doc.text(fit(t), x0 + c * cw + 1, y); if (c) doc.line(x0 + c * cw, y - 4.5, x0 + c * cw, y + 2); });
        y += 6.5;
      }
      cells.forEach(function (row) {
        var tall = mit && M.showSolutions && row.some(function (c) { return c.fill && !c.ok; }), rh = tall ? 10 : 6.5;
        if (y + rh > BOTTOM) page();
        line(); doc.rect(x0, y - 4.5, cw * cols, rh);
        row.forEach(function (c, ci) {
          if (ci) doc.line(x0 + ci * cw, y - 4.5, x0 + ci * cw, y - 4.5 + rh);
          if (!c.fill) { font('normal', 9, TEXT); doc.text(fit(c.t), x0 + ci * cw + 1, y); return; }
          if (!mit) { font('bold', 9, TEXT); doc.text(fit(c.t), x0 + ci * cw + 1, y); return; }
          font('bold', 9, c.ok ? GREEN : RED); doc.text(fit((c.ok ? '✓ ' : '✗ ') + c.t), x0 + ci * cw + 1, y);
          if (!c.ok && M.showSolutions) { font('normal', 8, GREEN); doc.text(fit(c.sol), x0 + ci * cw + 1, y + 4); }
        });
        y += rh;
      });
    }

    var mit = bewertet();
    if (stufe() === 'quittung') {
      font('bold', 12, INK); doc.text('Abgabebestätigung', L, y); y += 6;
      font('normal', 10, TEXT);
      lines('Deine Antworten sind in diesem PDF gespeichert und signiert. Die Auswertung der einzelnen Fragen bekommst du von deiner Lehrkraft.', W, L, 10);
      y += 6;
    } else { font('bold', 12, INK); doc.text(mit ? 'Fragen im Einzelnen' : 'Deine Antworten', L, y); y += 7; }
    var marks = { full: ['✓', GREEN], partial: ['±', AMBER], wrong: ['✗', RED], empty: ['✗', RED], revealed: ['–', GREY] };
    (stufe() === 'quittung' ? [] : r.rows).forEach(function (x, i) {
      if (y + 24 > BOTTOM) page();
      var m = marks[x.status], prompt = x.q.type === 'cloze' ? x.q.prompt.replace(/\{[^{}]*\}/g, '_____') : x.q.prompt;
      font('bold', 10.5, INK); doc.text((i + 1) + '.', L, y);
      if (mit) { font('bold', 10.5, m[1]); doc.text(m[0], L + 8, y); }
      if (mit) { font('bold', 10.5, RED); doc.text(C.fmt(x.earned) + ' / ' + C.fmt(x.max) + ' P.', R, y, { align: 'right' }); }
      else { font('normal', 10.5, GREY); doc.text(C.fmt(x.max) + ' P.', R, y, { align: 'right' }); }
      font('bold', 10.5); lines(prompt, W - 36, L + 14, 10.5);
      if (x.q.image) {
        var iw = W - 14, ih = iw * x.q.image.h / x.q.image.w;
        if (ih > 55) { ih = 55; iw = ih * x.q.image.w / x.q.image.h; }
        y += 0.5;
        if (y + ih + 4 > BOTTOM) page();
        doc.addImage(x.q.image.data, 'JPEG', L + 14, y, iw, ih);
        y += ih + 4;
      }
      y += 0.5;
      if (x.q.type === 'table') { pdfTable(x.q); y += 1; if (y < BOTTOM) { doc.setDrawColor.apply(doc, [200, 211, 228]); doc.setLineWidth(0.2); doc.line(L, y, R, y); } y += 6; return; }
      if (mit && x.status === 'revealed') { font('bold', 9, GREY); doc.text('Aufgelöst, daher 0 Punkte', L + 14, y); y += 5; }
      font('bold', 9, GREY); doc.text('Deine Antwort', L + 14, y); y += 4;
      font('normal', 10); lines(x.given || 'keine Antwort', W - 14, L + 14, 10);
      if (mit && (M.showSolutions || x.status === 'revealed') && x.status !== 'full') {
        y += 0.5;
        font('bold', 9, GREEN); doc.text('Richtig wäre', L + 14, y); y += 4;
        font('normal', 10, GREEN); lines(x.solution, W - 14, L + 14, 10);
      }
      y += 1;
      if (y < BOTTOM) { doc.setDrawColor.apply(doc, [200, 211, 228]); doc.setLineWidth(0.2); doc.line(L, y, R, y); }
      y += 6;
    });

    if (M.logBlur && plog.length) {
      if (y + 40 > BOTTOM) page();
      y += 2; font('bold', 12, INK); doc.text('Protokoll', L, y); y += 6;
      font('normal', 9, GREY); lines('Diese Einträge sind Hinweise und kein Beweis. Sie zeigen, was im Testfenster passiert ist. Was außerhalb geöffnet war, kann der Browser nicht sehen.', W, L, 9);
      y += 3;
      var away = plog.reduce(function (t, e) { return t + (e.away || 0); }, 0), nSw = plog.filter(function (e) { return e.kind === 'switch'; }).length;
      var counts = {};
      plog.forEach(function (e) { if (e.kind !== 'switch') counts[e.kind] = (counts[e.kind] || 0) + 1; });
      var sum = [];
      if (nSw) sum.push(['Fensterwechsel', nSw + ' (zusammen ' + mmss(away / 1000) + ' min außerhalb)']);
      var fsAway = plog.reduce(function (t, e) { return t + (e.fsAway || 0); }, 0);
      Object.keys(counts).forEach(function (k) { sum.push([KINDS[k] || k, String(counts[k]) + (k === 'screen' && fsAway ? ' (zusammen ' + mmss(fsAway / 1000) + ' min)' : '')]); });
      sum.forEach(function (r) {
        if (y + 5 > BOTTOM) page();
        font('bold', 9.5); doc.text(r[0], L, y); font('normal', 9.5); doc.text(r[1], L + 70, y); y += 4.8;
      });
      y += 4;
      var head = function () {
        font('bold', 9, GREY);
        doc.text('Uhrzeit', L, y); doc.text('Frage', L + 20, y); doc.text('Ereignis', L + 34, y);
        y += 5;
      };
      if (y + 14 > BOTTOM) page();
      head();
      plog.forEach(function (e) {
        font('normal', 9.5, TEXT);
        var ls = doc.splitTextToSize(e.text, W - 34);
        if (y + ls.length * 4.4 + 1 > BOTTOM) { page(); head(); font('normal', 9.5, TEXT); }
        doc.text(clock(e.at), L, y); doc.text(e.q ? String(e.q) : '–', L + 20, y);
        ls.forEach(function (t) { doc.text(t, L + 34, y); y += 4.4; });
        y += 0.8;
      });
    }

    var n = doc.getNumberOfPages();
    for (var p = 1; p <= n; p++) {
      doc.setPage(p);
      font('normal', 8.5, GREY);
      doc.text(doc.splitTextToSize(fullName() + ' · ' + M.title, W - 34)[0], L, 289);
      doc.text('Seite ' + p + ' von ' + n, R, 289, { align: 'right' });
    }
    doc.setProperties({ title: M.title + ' – ' + fullName(), subject: 'Auswertung', author: M.teacher || '' });
    var clean = function (s) { return String(s).replace(/[äÄöÖüÜß]/g, function (c) { return { ä: 'ae', Ä: 'Ae', ö: 'oe', Ö: 'Oe', ü: 'ue', Ü: 'Ue', ß: 'ss' }[c]; }).normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, ''); };
    var name = 'Auswertung_' + clean(M.title).slice(0, 60) + '_' + clean(S.last).slice(0, 50) + '_' + clean(S.first).slice(0, 50) + '.pdf';
    if (!SECRET) { doc.save(name); return Promise.resolve(null); }
    /* Prüfdaten: alle Rohdaten und zwei Signaturen. Sie liegen in einem eigenen PDF-Objekt und bleiben beim Lesen unsichtbar. */
    var pruef = C.b64Text(JSON.stringify({ v: 1, test: M.id, fp: selfPrint(), first: S.first, last: S.last, cls: S.cls, startedAt: S.startedAt,
      submittedAt: S.submittedAt, auto: !!S.auto, answers: S.answers, revealed: S.revealed || {}, log: S.log || [], shown: { earned: r.earned, max: r.max, pct: r.pct } }));
    var block = C.pruefBlock(pruef, C.hmac(SECRET, pruef));
    doc.internal.events.subscribe('postPutResources', function () {
      doc.internal.newObject();
      doc.internal.out('<</Length ' + block.length + '>>');
      doc.internal.out('stream');
      doc.internal.out(block);
      doc.internal.out('endstream');
      doc.internal.out('endobj');
    });
    var bytes = C.siegeln(new Uint8Array(doc.output('arraybuffer')), SECRET);
    return saveBlob(new Blob([bytes], { type: 'application/pdf' }), name);
  }

  /* ---------- Fensterwechsel ---------- */
  function noteLeave() {
    if (!logging() || leaving || openLeave || Date.now() < ignoreBlurUntil) return;
    var entry = { type: 'switch', at: Date.now(), q: currentQ }, via = vermutlich();
    if (via) entry.via = via;
    S.blurs = (S.blurs || 0) + 1; S.log.push(entry); openLeave = entry; save();
  }
  function noteBack() {
    if (!openLeave || !S || document.hidden) return;
    var now = Date.now();
    openLeave.back = now;
    lastReturn = { at: now, away: now - openLeave.at, done: {} };
    if (lastReturn.away < 3000) lastReturn = null;
    openLeave = null; lastActive = now; save();
  }
  /* Strg+Alt+Entf und Win+L erreichen die Seite nie, das System fängt sie vorher ab. Zu sehen ist nur,
     welche Zusatztasten noch gedrückt waren, als das Fenster den Fokus verlor. */
  var gehalten = {};
  function haltTaste(e, an) {
    var k = e.key === 'OS' ? 'Meta' : e.key;
    if (k === 'Control' || k === 'Alt' || k === 'Meta') { if (an) gehalten[k] = Date.now(); else delete gehalten[k]; }
  }
  document.addEventListener('keydown', function (e) { haltTaste(e, true); }, true);
  document.addEventListener('keyup', function (e) { haltTaste(e, false); }, true);
  function vermutlich() {
    var jetzt = Date.now(), frisch = function (k) { return gehalten[k] && jetzt - gehalten[k] < 5000; };
    var v = frisch('Control') && frisch('Alt') ? 'Strg+Alt+Entf' : frisch('Meta') ? 'Win+L oder eine andere Windows-Tastenkombination' : '';
    gehalten = {};
    return v;
  }

  /* Neu laden ist kein Fensterwechsel */
  var leaving = false;
  window.addEventListener('beforeunload', function () {
    leaving = true;
    if (S && S.phase === 'test') { S.closedAt = Date.now(); save(); }   // fuer das Protokoll beim Wiederoeffnen
  });
  window.addEventListener('blur', noteLeave);
  window.addEventListener('focus', noteBack);
  document.addEventListener('visibilitychange', function () { if (document.hidden) noteLeave(); else if (document.hasFocus()) noteBack(); });
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('webkitfullscreenchange', onFs);
  window.addEventListener('beforeprint', function () { logE('key', 'Drucken gestartet'); });
  ['mousemove', 'keydown', 'pointerdown', 'wheel', 'touchstart'].forEach(function (t) {
    document.addEventListener(t, function () { if (S && S.phase === 'test') touch(); }, { passive: true, capture: true });
  });
  document.addEventListener('focusin', function (e) { var n = qnr(e.target); if (n) currentQ = n; });

  function locked() { return M.lock && S && S.phase === 'test'; }
  function clipboard(e, verb) {
    if (!S || S.phase !== 'test') return;
    var t = '';
    try { t = verb === 'eingefügt' ? e.clipboardData.getData('text') : String(window.getSelection()); } catch (x) { t = ''; }
    var n = qnr(e.target);
    if (locked()) e.preventDefault();
    logE(verb === 'eingefügt' ? 'paste' : 'copy', (locked() ? 'Versuch gesperrt, Text ' : 'Text ') + verb + (t ? ': „' + cut(t) + '“' : ''), n);
  }
  document.addEventListener('paste', function (e) { clipboard(e, 'eingefügt'); }, true);
  document.addEventListener('copy', function (e) { clipboard(e, 'kopiert'); }, true);
  document.addEventListener('cut', function (e) { clipboard(e, 'ausgeschnitten'); }, true);
  document.addEventListener('contextmenu', function (e) {
    if (!S || S.phase !== 'test') return;
    if (locked()) e.preventDefault();
    logE('menu', locked() ? 'Rechtsklick gesperrt' : 'Rechtsklick', qnr(e.target));
  }, true);
  document.addEventListener('dragover', function (e) { if (locked()) e.preventDefault(); }, true);
  document.addEventListener('drop', function (e) {
    if (!S || S.phase !== 'test') return;
    var t = ''; try { t = e.dataTransfer.getData('text'); } catch (x) { t = ''; }
    if (locked()) e.preventDefault();
    logE('paste', (locked() ? 'Versuch gesperrt, Text hereingezogen' : 'Text hereingezogen') + (t ? ': „' + cut(t) + '“' : ''), qnr(e.target));
  }, true);

  var prevLen = new WeakMap();
  document.addEventListener('input', function (e) {
    if (!S || S.phase !== 'test' || !e.target.matches || !e.target.matches('input[type="text"]')) return;
    var el = e.target, before = prevLen.has(el) ? prevLen.get(el) : el.defaultValue.length, jump = el.value.length - before;
    prevLen.set(el, el.value.length);
    if (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop') return;
    if (!e.isTrusted) logE('burst', 'Text von einem Programm eingetragen: „' + cut(el.value) + '“', qnr(el));
    else if (jump >= 12) logE('burst', jump + ' Zeichen auf einmal eingetragen: „' + cut(el.value) + '“', qnr(el));
  }, true);

  var winAllein = false;   // Windows-Taste ohne weitere Taste gedrückt
  document.addEventListener('keydown', function (e) {
    if (!S || S.phase !== 'test') return;
    var k = String(e.key || '').toLowerCase(), mod = e.ctrlKey || e.metaKey, name = '';
    if (k !== 'meta' && k !== 'os') winAllein = false;
    var P = e.metaKey ? 'Cmd' : 'Strg';
    if (mod && k === 'f' && U && U.offen()) { e.preventDefault(); U.suche(); return; }   // Suche in den Unterlagen
    if (k === 'f12') name = 'F12 (Entwicklertools)';
    else if (mod && e.shiftKey && (k === 'i' || k === 'j' || k === 'c')) name = P + '+Umschalt+' + k.toUpperCase() + ' (Entwicklertools)';
    else if (mod && e.altKey && (k === 'i' || k === 'j' || k === 'c')) name = P + '+Alt+' + k.toUpperCase() + ' (Entwicklertools)';
    else if (e.metaKey && e.shiftKey && k === 's') name = 'Win+Umschalt+S (Bildschirmfoto)';
    else if (k === 'escape') { if (!e.repeat && isFs()) name = 'Esc (Vollbild verlassen)'; }
    else if (k === 'meta' || k === 'os') { winAllein = true; e.preventDefault(); return; }   // erst beim Loslassen protokollieren
    else if (e.metaKey && e.ctrlKey && (k === 'arrowleft' || k === 'arrowright' || k === 'd')) name = 'Win+Strg+' + (k === 'd' ? 'D (neuer Desktop)' : (k === 'arrowleft' ? 'Links' : 'Rechts') + ' (Desktop wechseln)');
    else if (e.metaKey && k === 'tab') name = 'Win+Tab (Taskansicht)';
    else if (e.metaKey && (k === 'd' || k === 'm')) name = 'Win+' + k.toUpperCase() + ' (Desktop anzeigen)';
    else if (e.altKey && k === 'tab') name = 'Alt+Tab (Fenster wechseln)';
    else if (e.altKey && k === 'f4') name = 'Alt+F4 (Fenster schließen)';
    else if (e.ctrlKey && k === 'tab') name = 'Strg+Tab (Tab wechseln)';
    else if (mod && k === 'w') name = P + '+W (Tab schließen)';
    else if (mod && k === 't') name = P + '+T (neuer Tab)';
    else if (mod && k === 'n') name = P + '+N (neues Fenster)';
    else if (mod && k === 'u') name = P + '+U (Quelltext)';
    else if (mod && k === 'f') name = P + '+F (Suche)';
    else if (mod && k === 'p') name = P + '+P (Drucken)';
    else if (mod && k === 's') name = P + '+S (Speichern)';
    if (!name) return;
    var weg = /Esc|Windows-Taste|Desktop|Taskansicht|Alt\+|Tab|Fenster/.test(name);   // Tasten, die aus dem Test führen
    if (locked() || (weg && M.fullscreen && isFs())) e.preventDefault();
    /* Mit Tastatursperre bleibt die Seite im Vollbild: nur ein Versuch. Ob das Vollbild oder Fenster
       wirklich verlassen wurde, halten Vollbild- und Fensterwechsel-Einträge mit Uhrzeit und Dauer fest. */
    var gesperrt = weg && keysLocked && isFs();
    logE(gesperrt ? 'tried' : 'key', name + (gesperrt ? ' – versucht, gesperrt' : ''), qnr(e.target));
  }, true);
  document.addEventListener('keyup', function (e) {
    if (e.key === 'PrintScreen') logE('key', 'Druck-Taste (Bildschirmfoto)');
    if ((e.key === 'Meta' || e.key === 'OS') && winAllein && S && S.phase === 'test') {
      winAllein = false;
      if (M.fullscreen && isFs()) e.preventDefault();
      var gesperrt = keysLocked && isFs();
      logE(gesperrt ? 'tried' : 'key', 'Windows-Taste (Startmenü)' + (gesperrt ? ' – versucht, gesperrt' : ''));
    }
  }, true);

  /* ---------- Unterlagen: eingebaute PDFs, mit pdf.js auf der Testseite gezeichnet ----------
     Kein eigenes Fenster und kein Rahmen: Fokus, Vollbild, Sperren und Protokoll bleiben wie im Test.
     Es gibt keine Textebene (nichts zum Kopieren) und keine Links. */
  var DOCS = Array.prototype.map.call(document.querySelectorAll('script.smu-doc'), function (s) {
    return { name: s.getAttribute('data-name') || 'Unterlage', el: s, pdf: null, page: 1, scale: 0, text: [], q: '', hits: [], hit: -1 };
  });
  var U = null;
  function hasDocs() { return DOCS.length > 0 && !!window.pdfjsLib; }
  function pdfLib() {
    var L = window.pdfjsLib;
    if (!L.GlobalWorkerOptions.workerSrc) {
      var w = document.getElementById('smu-pdfworker');
      L.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([w ? w.textContent : ''], { type: 'text/javascript' }));
    }
    return L;
  }
  function openDoc(d) {
    if (!d.pdf) {
      var b = atob(d.el.textContent.replace(/\s+/g, '')), u = new Uint8Array(b.length);
      for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
      d.pdf = pdfLib().getDocument({ data: u, isEvalSupported: false, enableXfa: false }).promise;
    }
    return d.pdf;
  }
  function unterlagen() {
    var cur = null, pages = [], io = null, token = 0, ready = Promise.resolve();
    var tabs = h('div', { class: 'u-tabs', role: 'tablist' });
    var inhalt = h('select', { class: 'u-inhalt', 'aria-label': 'Inhaltsverzeichnis', onchange: function () {
      var v = inhalt.value; inhalt.selectedIndex = 0;
      if (v) goto(Number(v));
    } });
    var seite = h('input', { class: 'u-seite', type: 'text', inputmode: 'numeric', autocomplete: 'off', 'aria-label': 'Seite', onkeydown: function (e) {
      if (e.key === 'Enter') { e.preventDefault(); goto(parseInt(seite.value, 10) || 1); }
    } });
    var von = h('span', { class: 'hinweis' });
    var such = h('input', { class: 'u-such', type: 'search', placeholder: 'Suchen …', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Im Dokument suchen', onkeydown: function (e) {
      if (e.key === 'Enter') { e.preventDefault(); suchen(such.value, e.shiftKey ? -1 : 1); }
    } });
    var info = h('span', { class: 'hinweis u-info', 'aria-live': 'polite' });
    var flaeche = h('div', { class: 'u-flaeche', tabindex: '0', 'aria-label': 'Dokument' });
    var kopfU = h('div', { class: 'u-kopf' }, [tabs,
      h('div', { class: 'u-gruppe' }, [
        h('button', { class: 'btn klein', type: 'button', title: 'Vorige Seite', 'aria-label': 'Vorige Seite', text: '◀', onclick: function () { goto(cur.page - 1); } }),
        seite, von,
        h('button', { class: 'btn klein', type: 'button', title: 'Nächste Seite', 'aria-label': 'Nächste Seite', text: '▶', onclick: function () { goto(cur.page + 1); } })]),
      h('div', { class: 'u-gruppe' }, [
        h('button', { class: 'btn klein', type: 'button', title: 'Verkleinern', 'aria-label': 'Verkleinern', text: '−', onclick: function () { zoom(cur.scale / 1.2); } }),
        h('button', { class: 'btn klein', type: 'button', title: 'Vergrößern', 'aria-label': 'Vergrößern', text: '+', onclick: function () { zoom(cur.scale * 1.2); } }),
        h('button', { class: 'btn klein', type: 'button', title: 'Auf Fensterbreite', text: 'Breite', onclick: function () { zoom(0); } })]),
      inhalt,
      h('div', { class: 'u-gruppe' }, [such,
        h('button', { class: 'btn klein', type: 'button', title: 'Voriger Treffer', 'aria-label': 'Voriger Treffer', text: '↑', onclick: function () { suchen(such.value, -1); } }),
        h('button', { class: 'btn klein', type: 'button', title: 'Nächster Treffer', 'aria-label': 'Nächster Treffer', text: '↓', onclick: function () { suchen(such.value, 1); } }),
        info])]);
    var teiler = h('div', { class: 'u-teiler', role: 'separator', 'aria-orientation': 'vertical', 'aria-label': 'Breite der Unterlagen', tabindex: '0',
      title: 'Ziehen, um die Unterlagen breiter oder schmäler zu machen' });
    var panel = h('div', { class: 'unterlagen', id: 'unterlagen', role: 'region', 'aria-label': 'Unterlagen', hidden: true }, [teiler, kopfU, flaeche]);

    /* Trennleiste zwischen Test und Unterlagen: Breite als Anteil des Fensters, pro Gerät gemerkt */
    var ANTEIL = 'smue:unterlagen-breite';
    function breiteSetzen(px) {
      var w = window.innerWidth, min = Math.min(360, w * 0.3);
      px = Math.max(min, Math.min(w - min, px));
      document.documentElement.style.setProperty('--u-breite', Math.round(px) + 'px');
      teiler.setAttribute('aria-valuenow', String(Math.round(px / w * 100)));
      return px / w;
    }
    function breiteLaden() {
      var a = 0;
      try { a = Number(localStorage.getItem(ANTEIL)) || 0; } catch (e) { /* ohne Speicher: Standardbreite */ }
      if (a > 0.15 && a < 0.85) breiteSetzen(a * window.innerWidth);
    }
    function breiteFertig(a) {
      try { localStorage.setItem(ANTEIL, String(a)); } catch (e) { /* nur für diese Sitzung */ }
      if (cur && cur.fit) zoom(0);
    }
    var ziehT = null;
    teiler.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      ziehT = { a: 0 };
      try { teiler.setPointerCapture(e.pointerId); } catch (x) { /* geht auch so */ }
      document.body.classList.add('u-zieht'); e.preventDefault();
    });
    teiler.addEventListener('pointermove', function (e) { if (ziehT) ziehT.a = breiteSetzen(window.innerWidth - e.clientX); });
    function teilerLos() { if (!ziehT) return; var a = ziehT.a; ziehT = null; document.body.classList.remove('u-zieht'); if (a) breiteFertig(a); }
    teiler.addEventListener('pointerup', teilerLos); teiler.addEventListener('lostpointercapture', teilerLos);
    teiler.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      breiteFertig(breiteSetzen(panel.getBoundingClientRect().width + (e.key === 'ArrowLeft' ? 40 : -40)));
    });
    DOCS.forEach(function (d, i) {
      d.tab = h('button', { class: 'btn klein', type: 'button', role: 'tab', text: d.name, onclick: function () { show(d); } });
      tabs.append(d.tab);
    });

    function fit(vp1) { return Math.max(0.3, (flaeche.clientWidth - 44) / vp1.width); }
    function show(d) {
      if (cur === d) return ready;
      if (cur) cur.page = curPage();
      cur = d; token++;
      DOCS.forEach(function (x) { x.tab.setAttribute('aria-selected', x === d ? 'true' : 'false'); });
      flaeche.textContent = ''; pages = []; inhalt.textContent = ''; info.textContent = 'Lädt …';
      such.value = d.q;
      var my = token;
      ready = openDoc(d).then(function (pdf) {
        if (my !== token) return;
        return pdf.getPage(1).then(function (p1) {
          if (my !== token) return;
          d.vp1 = p1.getViewport({ scale: 1 });
          if (!d.scale) { d.scale = fit(d.vp1); d.fit = true; }
          von.textContent = 'von ' + pdf.numPages;
          info.textContent = '';
          aufbauen(pdf);
          goto(d.page, true);
          return pdf.getOutline().then(function (o) { if (my === token) liste(pdf, o || []); }, function () {});
        });
      }, function () { info.textContent = 'Das Dokument konnte nicht geöffnet werden.'; });
      return ready;
    }
    function aufbauen(pdf) {
      if (io) io.disconnect();
      flaeche.textContent = ''; pages = [];
      io = new IntersectionObserver(function (list) {
        list.forEach(function (en) {
          var p = pages[Number(en.target.getAttribute('data-p')) - 1];
          if (en.isIntersecting) zeichnen(pdf, p); else freigeben(p);
        });
      }, { root: flaeche, rootMargin: '1200px 600px' });
      for (var i = 1; i <= pdf.numPages; i++) {
        var div = h('div', { class: 'u-blatt', 'data-p': i });
        /* Größe bei Maßstab 1; bis die Seite gezeichnet ist, gilt die Größe der ersten Seite */
        pages.push({ nr: i, div: div, canvas: null, task: null, vp: null, scale: 0, w1: cur.vp1.width, h1: cur.vp1.height });
        flaeche.append(div);
      }
      groesse();
      pages.forEach(function (p) { io.observe(p.div); });
    }
    function groesse() {
      pages.forEach(function (p) { p.div.style.width = p.w1 * cur.scale + 'px'; p.div.style.height = p.h1 * cur.scale + 'px'; });
    }
    function zeichnen(pdf, p) {
      if (p.task || (p.canvas && p.scale === cur.scale)) return;
      var my = token, scale = cur.scale;
      p.task = pdf.getPage(p.nr).then(function (page) {
        if (my !== token || !p.task) return;
        var vp = page.getViewport({ scale: scale }), dpr = window.devicePixelRatio || 1, v1 = page.getViewport({ scale: 1 });
        if (v1.width !== p.w1 || v1.height !== p.h1) {
          p.w1 = v1.width; p.h1 = v1.height;
          p.div.style.width = p.w1 * cur.scale + 'px'; p.div.style.height = p.h1 * cur.scale + 'px';
        }
        var c = document.createElement('canvas');
        c.width = Math.floor(vp.width * dpr); c.height = Math.floor(vp.height * dpr);
        var r = page.render({ canvasContext: c.getContext('2d'), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null });
        p.render = r;
        return r.promise.then(function () {
          if (my !== token || !p.task) return;
          /* neue Zeichnung erst einsetzen, wenn sie fertig ist: kein Flackern beim Zoomen */
          if (p.canvas) { p.canvas.width = 0; p.canvas.remove(); }
          p.div.prepend(c); p.canvas = c; p.vp = vp; p.scale = scale; p.task = null; p.render = null;
          marken(p);
          if (scale !== cur.scale) zeichnen(pdf, p);
        });
      }).catch(function () { p.task = null; p.render = null; });
    }
    function freigeben(p) {
      if (p.render) { try { p.render.cancel(); } catch (e) { /* schon fertig */ } }
      p.task = null; p.render = null;
      if (p.canvas) { p.canvas.width = 0; p.canvas.remove(); p.canvas = null; }
      p.scale = 0;
      ohneMarken(p);
    }
    function ohneMarken(p) { Array.prototype.slice.call(p.div.querySelectorAll('.u-treffer')).forEach(function (m) { m.remove(); }); }

    /* Zoomen um einen Punkt (Mauszeiger oder Mitte): der Punkt unter dem Zeiger bleibt stehen.
       Zuerst werden nur die Seitengrößen geändert (die alte Zeichnung wird gestreckt), kurz danach scharf neu gezeichnet. */
    var nachZoom = 0;
    function zoomAt(s, cx, cy) {
      if (!cur || !cur.vp1 || !pages.length) return;
      s = Math.max(0.25, Math.min(6, s));
      if (Math.abs(s - cur.scale) < 1e-4) return;
      var r = flaeche.getBoundingClientRect();
      if (cx == null) { cx = r.left + flaeche.clientWidth / 2; cy = r.top + flaeche.clientHeight / 2; }
      var ox = cx - r.left, oy = cy - r.top, y = flaeche.scrollTop + oy, p = pages[pages.length - 1];
      for (var i = 0; i < pages.length; i++) if (pages[i].div.offsetTop + pages[i].div.offsetHeight > y) { p = pages[i]; break; }
      var fx = (flaeche.scrollLeft + ox - p.div.offsetLeft) / p.div.offsetWidth, fy = (y - p.div.offsetTop) / p.div.offsetHeight;
      cur.scale = s;
      groesse();
      flaeche.scrollLeft = p.div.offsetLeft + fx * p.div.offsetWidth - ox;
      flaeche.scrollTop = p.div.offsetTop + fy * p.div.offsetHeight - oy;
      pages.forEach(ohneMarken);
      clearTimeout(nachZoom);
      nachZoom = setTimeout(function () {
        openDoc(cur).then(function (pdf) { pages.forEach(function (x) { if (x.canvas) zeichnen(pdf, x); }); });
      }, 180);
    }
    flaeche.addEventListener('wheel', function (e) {
      if (!e.ctrlKey || !cur) return;   // Strg + Mausrad (auch Zwei-Finger-Zoom am Touchpad) zoomt, sonst wird geblättert
      e.preventDefault();
      cur.fit = false;
      zoomAt(cur.scale * Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * 0.003), e.clientX, e.clientY);
    }, { passive: false });
    /* Mit gedrückter Maustaste verschieben */
    var zug = null;
    flaeche.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || e.pointerType === 'touch') return;
      var r = flaeche.getBoundingClientRect();
      if (e.clientX - r.left >= flaeche.clientWidth || e.clientY - r.top >= flaeche.clientHeight) return;   // Bildlaufleiste
      zug = { x: e.clientX, y: e.clientY, l: flaeche.scrollLeft, t: flaeche.scrollTop };
      try { flaeche.setPointerCapture(e.pointerId); } catch (x) { /* ohne Capture geht es auch */ }
      flaeche.classList.add('zieht'); flaeche.focus({ preventScroll: true }); e.preventDefault();
    });
    flaeche.addEventListener('pointermove', function (e) {
      if (!zug) return;
      flaeche.scrollLeft = zug.l - (e.clientX - zug.x); flaeche.scrollTop = zug.t - (e.clientY - zug.y);
    });
    function los() { if (zug) { zug = null; flaeche.classList.remove('zieht'); } }
    flaeche.addEventListener('pointerup', los); flaeche.addEventListener('pointercancel', los); flaeche.addEventListener('lostpointercapture', los);
    function curPage() {
      var y = flaeche.scrollTop + flaeche.clientHeight / 3;
      for (var i = 0; i < pages.length; i++) if (pages[i].div.offsetTop + pages[i].div.offsetHeight > y) return i + 1;
      return pages.length || 1;
    }
    function goto(n, sofort) {
      if (!pages.length) return;
      n = Math.max(1, Math.min(pages.length, n));
      cur.page = n; seite.value = String(n);
      flaeche.scrollTop = pages[n - 1].div.offsetTop - 12;
    }
    flaeche.addEventListener('scroll', function () {
      if (!cur || !pages.length) return;
      var n = curPage();
      if (String(n) !== seite.value && document.activeElement !== seite) seite.value = String(n);
      cur.page = n;
    });
    function zoom(s) {
      if (!cur || !cur.vp1) return;
      cur.fit = !s;
      zoomAt(s || fit(cur.vp1));
    }
    function liste(pdf, outline) {
      var flat = [];
      (function walk(items, depth) {
        items.forEach(function (it) { if (flat.length < 800) { flat.push({ t: it.title, dest: it.dest, d: depth }); walk(it.items || [], depth + 1); } });
      })(outline, 0);
      inhalt.hidden = !flat.length;
      if (!flat.length) return;
      inhalt.append(h('option', { value: '', text: 'Inhalt …' }));
      var my = token;
      /* Ziele auflösen: benanntes Ziel -> Seite */
      Promise.all(flat.map(function (f) {
        var dest = typeof f.dest === 'string' ? pdf.getDestination(f.dest) : Promise.resolve(f.dest);
        return dest.then(function (d) { return d && d[0] ? (typeof d[0] === 'number' ? d[0] : pdf.getPageIndex(d[0])) : null; })
          .then(function (ix) { return ix == null ? null : ix + 1; }, function () { return null; });
      })).then(function (nrs) {
        if (my !== token) return;
        flat.forEach(function (f, i) {
          if (!nrs[i]) return;
          inhalt.append(h('option', { value: String(nrs[i]), text: new Array(f.d + 1).join(' ') + f.t + '  (S. ' + nrs[i] + ')' }));
        });
      });
    }
    function textOf(pdf, n) {
      if (cur.text[n]) return Promise.resolve(cur.text[n]);
      var d = cur;
      return pdf.getPage(n).then(function (p) { return p.getTextContent(); }).then(function (tc) {
        d.text[n] = tc.items.map(function (it) { return { s: it.str || '', t: it.transform, w: it.width, h: it.height }; });
        return d.text[n];
      });
    }
    function suchen(q, dir) {
      if (!cur) return;
      q = String(q || '').trim().toLowerCase();
      if (!q) { cur.q = ''; cur.hits = []; cur.hit = -1; info.textContent = ''; pages.forEach(marken); return; }
      if (q === cur.q && cur.hits.length) {
        cur.hit = (cur.hit + dir + cur.hits.length) % cur.hits.length;
        zumTreffer(); return;
      }
      var d = cur;
      d.q = q; d.hits = []; d.hit = -1;
      openDoc(d).then(function (pdf) {
        var n = pdf.numPages, i = 1;
        function weiter() {
          if (cur !== d || d.q !== q) return;
          if (i > n) {
            if (!d.hits.length) { info.textContent = 'Nichts gefunden.'; pages.forEach(marken); return; }
            var start = d.page; d.hit = 0;
            for (var k = 0; k < d.hits.length; k++) if (d.hits[k].p >= start) { d.hit = k; break; }
            zumTreffer(); return;
          }
          if (i % 20 === 1) info.textContent = 'Suche … Seite ' + i + ' von ' + n;
          textOf(pdf, i).then(function (items) {
            items.forEach(function (it, ix) {
              var s = it.s.toLowerCase(), at = s.indexOf(q);
              while (at >= 0) { d.hits.push({ p: i, ix: ix, at: at, len: q.length }); at = s.indexOf(q, at + 1); }
            });
            i++; weiter();
          }, function () { i++; weiter(); });
        }
        weiter();
      });
    }
    var messer = document.createElement('canvas').getContext('2d');
    messer.font = '10px Arial, Helvetica, sans-serif';
    function breite(s) { return messer.measureText(s).width; }
    function rechteck(p, hit) {
      var it = cur.text[p.nr][hit.ix], t = it.t, ganz = breite(it.s) || 1;
      var hoch = it.h || Math.hypot(t[2], t[3]);
      /* Lage im Textstück über die Schriftbreite schätzen (genauer als nach Buchstabenzahl) */
      var x0 = t[4] + it.w * breite(it.s.slice(0, hit.at)) / ganz, x1 = t[4] + it.w * breite(it.s.slice(0, hit.at + hit.len)) / ganz;
      var r = p.vp.convertToViewportRectangle([x0, t[5] - hoch * 0.25, x1, t[5] + hoch * 0.95]);
      return { x: Math.min(r[0], r[2]), y: Math.min(r[1], r[3]), w: Math.abs(r[2] - r[0]), h: Math.abs(r[3] - r[1]) };
    }
    function marken(p) {
      Array.prototype.slice.call(p.div.querySelectorAll('.u-treffer')).forEach(function (m) { m.remove(); });
      if (!p.canvas || !p.vp || p.scale !== cur.scale || !cur.q || !cur.text[p.nr]) return;
      cur.hits.forEach(function (hit, k) {
        if (hit.p !== p.nr) return;
        var r = rechteck(p, hit);
        p.div.append(h('div', { class: 'u-treffer' + (k === cur.hit ? ' aktiv' : ''), style: 'left:' + r.x + 'px;top:' + r.y + 'px;width:' + r.w + 'px;height:' + r.h + 'px' }));
      });
    }
    function zumTreffer() {
      var hit = cur.hits[cur.hit];
      info.textContent = 'Treffer ' + (cur.hit + 1) + ' von ' + cur.hits.length;
      var p = pages[hit.p - 1];
      goto(hit.p);
      pages.forEach(function (x) { if (x.canvas) marken(x); });
      /* nach dem Zeichnen genau zum Treffer scrollen */
      var tries = 0;
      (function warte() {
        if (p.canvas && p.vp && p.scale === cur.scale) { var r = rechteck(p, hit); flaeche.scrollTop = p.div.offsetTop + r.y - flaeche.clientHeight / 3; return; }
        if (tries++ < 40) setTimeout(warte, 50);
      })();
    }
    function offen() { return !panel.hidden; }
    function oeffnen(knopf, leisteEl) {
      panel.style.top = Math.round(leisteEl.getBoundingClientRect().bottom) + 'px';
      breiteLaden();
      panel.hidden = false;
      document.body.classList.add('u-offen');
      knopf.textContent = 'Unterlagen schließen'; knopf.setAttribute('aria-expanded', 'true');
      show(cur || DOCS[0]);
    }
    function schliessen(knopf) {
      if (cur) cur.page = curPage();
      panel.hidden = true;
      document.body.classList.remove('u-offen');
      if (knopf) { knopf.textContent = 'Unterlagen'; knopf.setAttribute('aria-expanded', 'false'); }
    }
    return { el: panel, offen: offen, oeffnen: oeffnen, schliessen: schliessen, suche: function () { such.focus(); such.select(); } };
  }

  /* ---------- Start: laufenden oder fertigen Test wiederherstellen ---------- */
  (function boot() {
    var saved = load();
    if (saved && saved.phase) {
      var data = C.unseal(SEALED, M.id, saved.code);
      if (data) {
        S = saved; Q = data.questions; SECRET = data.secret || ''; S.log = S.log || []; S.checks = S.checks || {}; S.checked = S.checked || {}; S.revealed = S.revealed || {};
        if (S.phase === 'test') {
          S.log.forEach(function (e) { if (e.type === 'switch' && !e.back) e.back = Date.now(); });
          var weg = S.closedAt ? Date.now() - S.closedAt : 0;
          delete S.closedAt;
          logE('reload', weg > 3000 ? 'Fenster geschlossen oder Seite verlassen, nach ' + mmss(weg / 1000) + ' min wieder geöffnet'
            : 'Seite neu geladen');
        }
        if (S.phase === 'done') viewDone();
        else if (Date.now() >= S.endsAt) { submit(true); }
        else viewTest();
        return;
      }
    }
    viewStart();
  })();
})();

/* Gemeinsame Logik: Kontrolle der Antworten, Verschleierung der Fragen. */
(function (root) {
  'use strict';

  function roundHalf(x) { return Math.round(x * 2 + 1e-9) / 2; }
  function fmt(n) { return String(n).replace('.', ','); }
  /* Teilpunkte: Die volle Punktzahl gibt es nur, wenn alles stimmt. Sonst bleibt mindestens ein halber Punkt Abstand. */
  function partialPoints(ratio, max, complete) {
    if (complete) return max;
    return Math.min(roundHalf(Math.max(0, ratio) * max), Math.max(0, max - 0.5));
  }

  function norm(s, cs) {
    var t = String(s == null ? '' : s).normalize('NFC')
      .replace(/[‘’ʼ]/g, "'")
      .replace(/[‐-―−]/g, '-')
      .trim().replace(/\s+/g, ' ');
    return cs ? t : t.toLocaleLowerCase('de');
  }

  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 1) return 2;
    var prev = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      var cur = [i];
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function textMatches(given, accepted, opt) {
    var g = norm(given, opt.caseSensitive);
    if (!g) return false;
    return accepted.some(function (a) {
      var x = norm(a, opt.caseSensitive);
      if (!x) return false;
      if (x === g) return true;
      return !!opt.typo && x.length >= 5 && lev(x, g) <= 1;
    });
  }

  function parseNum(raw, unit) {
    var s = String(raw == null ? '' : raw).trim().replace(/−/g, '-');
    if (unit) {
      var u = String(unit).trim();
      if (u && s.toLowerCase().slice(-u.length) === u.toLowerCase()) s = s.slice(0, -u.length);
    }
    s = s.replace(/[\s'  ]/g, '').replace(/^\+/, '');
    var fr = s.match(/^(-?\d+)\/(\d+)$/);
    if (fr) return +fr[2] === 0 ? NaN : +fr[1] / +fr[2];
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
    return Number(s);
  }

  /* 1.234 kann 1234 oder 1,234 heißen; beide Lesarten gelten */
  function numReadings(raw, unit) {
    var first = parseNum(raw, unit), out = isNaN(first) ? [] : [first];
    var s = String(raw == null ? '' : raw).trim().replace(/\u2212/g, '-');
    if (unit) {
      var u = String(unit).trim();
      if (u && s.toLowerCase().slice(-u.length) === u.toLowerCase()) s = s.slice(0, -u.length).trim();
    }
    if (/^[+-]?\d{1,3}\.\d{3}$/.test(s)) out.push(Number(s));
    return out;
  }

  /* Lückentext zerlegen: "Die {Antwort|Alternative} ist" -> Text und Lücken im Wechsel */
  function parseCloze(text) {
    var parts = [], re = /\{([^{}]+)\}/g, last = 0, m;
    text = String(text || '');
    while ((m = re.exec(text))) {
      if (m.index > last) parts.push({ t: text.slice(last, m.index) });
      var all = m[1].split('|').map(function (x) { return x.trim(); }).filter(Boolean);
      var isWrong = function (x) { return x.charAt(0) === '~'; };
      parts.push({
        gap: all.filter(function (x) { return !isWrong(x); }),
        wrong: all.filter(isWrong).map(function (x) { return x.slice(1).trim(); }).filter(Boolean)
      });
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push({ t: text.slice(last) });
    return parts;
  }
  function gapsOf(q) { return parseCloze(q.prompt).filter(function (p) { return p.gap; }); }

  /* Tabelle: Zellen mit fill:true füllen Schüler aus; t enthält dort die Lösungen, getrennt mit | */
  function tableGaps(q) {
    var out = [];
    ((q.table && q.table.rows) || []).forEach(function (row, r) {
      row.forEach(function (cell, c) {
        if (cell && cell.fill) out.push({ r: r, c: c, acc: String(cell.t || '').split('|').map(function (x) { return x.trim(); }).filter(Boolean) });
      });
    });
    return out;
  }
  function tableChoices(q) {
    return String(q.choices || '').split(/[,;]/).map(function (x) { return x.trim(); }).filter(Boolean);
  }

  /* Auswahlliste: erste richtige Antwort plus falsche, alphabetisch, damit die Reihenfolge nichts verrät */
  function choiceList(correct, wrong) {
    var seen = {}, out = [];
    (correct.length ? [correct[0]] : []).concat(wrong).forEach(function (x) {
      var k = norm(x, true);
      if (k && !seen[k]) { seen[k] = 1; out.push(x); }
    });
    return out.sort(function (a, b) { return a.localeCompare(b, 'de'); });
  }

  function maxPoints(q) { return Number(q.points) || 0; }

  function isAnswered(q, a) {
    if (a === undefined || a === null) return false;
    switch (q.type) {
      case 'multi': return Array.isArray(a) && a.length > 0;
      case 'cloze': case 'table': return Array.isArray(a) && a.some(function (x) { return String(x || '').trim(); });
      case 'single': return typeof a === 'number';
      case 'tf': return typeof a === 'boolean';
      default: return String(a).trim() !== '';
    }
  }

  /* Bewertet eine Frage. status: full | partial | wrong | empty */
  function grade(q, a) {
    var max = maxPoints(q), earned = 0, given = '', solution = '', answered = isAnswered(q, a);
    switch (q.type) {
      case 'text':
        given = answered ? String(a).trim() : '';
        solution = q.accepted.join(' / ');
        if (textMatches(a, q.accepted, q)) earned = max;
        break;
      case 'number':
        given = answered ? String(a).trim() : '';
        var vs = numReadings(q.value), gs = numReadings(a, q.unit), tol = parseNum(q.tol || '0') || 0;
        solution = fmt(q.value) + (q.unit ? ' ' + q.unit : '') + (tol ? ' (± ' + fmt(q.tol) + ')' : '');
        if (answered && gs.some(function (g) { return vs.some(function (v) { return Math.abs(g - v) <= tol + 1e-9; }); })) earned = max;
        break;
      case 'single':
        given = answered && q.options[a] ? q.options[a].text : '';
        solution = q.options.filter(function (o) { return o.correct; }).map(function (o) { return o.text; }).join(' / ');
        if (answered && q.options[a] && q.options[a].correct) earned = max;
        break;
      case 'tf':
        given = answered ? (a ? 'Richtig' : 'Falsch') : '';
        solution = q.answer ? 'Richtig' : 'Falsch';
        if (answered && a === !!q.answer) earned = max;
        break;
      case 'multi':
        var picked = answered ? a : [];
        var nCorrect = q.options.filter(function (o) { return o.correct; }).length;
        var hit = 0, miss = 0;
        picked.forEach(function (i) { if (q.options[i]) { if (q.options[i].correct) hit++; else miss++; } });
        given = picked.slice().sort(function (x, y) { return x - y; })
          .map(function (i) { return q.options[i] ? q.options[i].text : ''; }).join(', ');
        solution = q.options.filter(function (o) { return o.correct; }).map(function (o) { return o.text; }).join(', ');
        earned = nCorrect ? partialPoints((hit - miss) / nCorrect, max, hit === nCorrect && miss === 0) : 0;
        break;
      case 'cloze':
        var gaps = gapsOf(q), arr = Array.isArray(a) ? a : [], ok = 0;
        gaps.forEach(function (g, i) { if (textMatches(arr[i], g.gap, q)) ok++; });
        given = answered ? gaps.map(function (g, i) { return String(arr[i] || '').trim() || '–'; }).join(' | ') : '';
        solution = gaps.map(function (g) { return g.gap.join(' / '); }).join(' | ');
        earned = gaps.length ? partialPoints(ok / gaps.length, max, ok === gaps.length) : 0;
        break;
      case 'table':
        var cells = tableGaps(q), ta = Array.isArray(a) ? a : [], hit = 0;
        cells.forEach(function (g, i) { if (textMatches(ta[i], g.acc, q)) hit++; });
        given = answered ? cells.map(function (g, i) { return String(ta[i] || '').trim() || '–'; }).join(' | ') : '';
        solution = cells.map(function (g) { return g.acc.join(' / '); }).join(' | ');
        earned = cells.length ? partialPoints(hit / cells.length, max, hit === cells.length) : 0;
        break;
    }
    earned = Math.min(earned, max);
    return {
      earned: earned, max: max, given: given, solution: solution,
      status: !answered ? 'empty' : earned >= max ? 'full' : earned > 0 ? 'partial' : 'wrong'
    };
  }

  function gradeLabel(pct, grading) {
    if (!grading || !grading.on) return null;
    var names = ['Sehr gut', 'Gut', 'Befriedigend', 'Genügend'], t = grading.thresholds;
    for (var i = 0; i < 4; i++) if (pct >= Number(t[i])) return { nr: i + 1, name: names[i] };
    return { nr: 5, name: 'Nicht genügend' };
  }

  function hash(str) {
    var h = 0x811c9dc5, s = String(str);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }

  function stream(key) {
    var s = parseInt(hash(key), 36) | 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) & 255;
    };
  }

  function b64FromBytes(b) {
    var out = '';
    for (var i = 0; i < b.length; i += 0x6000) out += String.fromCharCode.apply(null, b.subarray(i, i + 0x6000));
    return btoa(out);
  }
  function bytesFromB64(s) {
    var bin = atob(s), b = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return b;
  }

  function codeKey(id, code) { return id + ':' + String(code || '').trim().toUpperCase(); }

  function seal(obj, id, code) {
    var body = new TextEncoder().encode('SMU1' + JSON.stringify(obj));
    var next = stream(codeKey(id, code)), out = new Uint8Array(body.length);
    for (var i = 0; i < body.length; i++) out[i] = body[i] ^ next();
    return b64FromBytes(out);
  }
  function unseal(b64, id, code) {
    try {
      var data = bytesFromB64(b64), next = stream(codeKey(id, code));
      var out = new Uint8Array(data.length);
      for (var i = 0; i < data.length; i++) out[i] = data[i] ^ next();
      var txt = new TextDecoder('utf-8', { fatal: true }).decode(out);
      return txt.slice(0, 4) === 'SMU1' ? JSON.parse(txt.slice(4)) : null;
    } catch (e) { return null; }
  }

  /* ---------- SHA-256 und HMAC, ohne Browser-Schnittstellen, damit sie auch in lokalen Dateien laufen ---------- */
  var K256 = (function () {
    var k = [], n = 0, c = 2;
    function frac(x) { return ((x - Math.floor(x)) * 4294967296) | 0; }
    for (; n < 64; c++) {
      var prime = true;
      for (var i = 2; i * i <= c; i++) if (c % i === 0) { prime = false; break; }
      if (prime) k[n++] = frac(Math.pow(c, 1 / 3));
    }
    return k;
  })();
  function utf8(s) { return new TextEncoder().encode(s); }
  function sha256(bytes) {
    if (typeof bytes === 'string') bytes = utf8(bytes);
    var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var len = bytes.length, total = ((len + 9 + 63) >> 6) << 6;
    var m = new Uint8Array(total);
    m.set(bytes); m[len] = 0x80;
    var dv = new DataView(m.buffer);
    dv.setUint32(total - 8, Math.floor(len / 536870912), false);
    dv.setUint32(total - 4, (len * 8) >>> 0, false);
    var w = new Int32Array(64);
    for (var o = 0; o < total; o += 64) {
      for (var t = 0; t < 16; t++) w[t] = dv.getInt32(o + t * 4, false);
      for (t = 16; t < 64; t++) {
        var a0 = w[t - 15], a1 = w[t - 2];
        var s0 = ((a0 >>> 7) | (a0 << 25)) ^ ((a0 >>> 18) | (a0 << 14)) ^ (a0 >>> 3);
        var s1 = ((a1 >>> 17) | (a1 << 15)) ^ ((a1 >>> 19) | (a1 << 13)) ^ (a1 >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      var A = h[0], B = h[1], C = h[2], D = h[3], E = h[4], F = h[5], G = h[6], H = h[7];
      for (t = 0; t < 64; t++) {
        var S1 = ((E >>> 6) | (E << 26)) ^ ((E >>> 11) | (E << 21)) ^ ((E >>> 25) | (E << 7));
        var ch = (E & F) ^ (~E & G);
        var T1 = (H + S1 + ch + K256[t] + w[t]) | 0;
        var S0 = ((A >>> 2) | (A << 30)) ^ ((A >>> 13) | (A << 19)) ^ ((A >>> 22) | (A << 10));
        var maj = (A & B) ^ (A & C) ^ (B & C);
        var T2 = (S0 + maj) | 0;
        H = G; G = F; F = E; E = (D + T1) | 0; D = C; C = B; B = A; A = (T1 + T2) | 0;
      }
      h[0] = (h[0] + A) | 0; h[1] = (h[1] + B) | 0; h[2] = (h[2] + C) | 0; h[3] = (h[3] + D) | 0;
      h[4] = (h[4] + E) | 0; h[5] = (h[5] + F) | 0; h[6] = (h[6] + G) | 0; h[7] = (h[7] + H) | 0;
    }
    var out = new Uint8Array(32), odv = new DataView(out.buffer);
    h.forEach(function (x, i) { odv.setInt32(i * 4, x, false); });
    return out;
  }
  function hex(b) { var s = ''; for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16); return s; }
  function hmac(key, msg) {
    if (typeof key === 'string') key = utf8(key);
    if (typeof msg === 'string') msg = utf8(msg);
    if (key.length > 64) key = sha256(key);
    var ik = new Uint8Array(64 + msg.length), ok = new Uint8Array(96);
    for (var i = 0; i < 64; i++) { var b = i < key.length ? key[i] : 0; ik[i] = b ^ 0x36; ok[i] = b ^ 0x5c; }
    ik.set(msg, 64); ok.set(sha256(ik), 64);
    return hex(sha256(ok));
  }
  function b64Text(s) { return b64FromBytes(utf8(s)); }
  function textB64(b) { return new TextDecoder().decode(bytesFromB64(b)); }

  /* Fingerabdruck einer Schüler-Datei: Einstellungen, Fragen und Programmcode */
  function fingerprint(parts) { return hex(sha256(parts.join('\n--\n'))); }

  /* ---------- Prüfdaten im PDF ---------- */
  var MARK_A = 'SMUPRUEF1:', MARK_B = ':SMUENDE', ZERO = new Array(65).join('0');
  function pruefBlock(payloadB64, sig) { return MARK_A + payloadB64 + ':' + sig + ':' + ZERO + MARK_B; }
  function find(bytes, text, from) {
    var n = text.charCodeAt(0), len = text.length;
    outer: for (var i = from || 0; i <= bytes.length - len; i++) {
      if (bytes[i] !== n) continue;
      for (var j = 1; j < len; j++) if (bytes[i + j] !== text.charCodeAt(j)) continue outer;
      return i;
    }
    return -1;
  }
  /* Liegt die 64-stellige Datei-Signatur in den Bytes, liefert das ihre Position */
  function pruefStelle(bytes) {
    var a = find(bytes, MARK_A);
    if (a < 0) return null;
    var b = find(bytes, MARK_B, a);
    if (b < 0) return null;
    return { payloadAt: a + MARK_A.length, sigFileAt: b - 64, end: b };
  }
  function siegeln(bytes, secret) {
    var p = pruefStelle(bytes), sig = utf8(hmac(secret, bytes));
    bytes.set(sig, p.sigFileAt);
    return bytes;
  }
  function pruefen(bytes, K) {
    var r = { status: 'ohne', hinweise: [], name: '', cls: '', earned: null, max: null, pct: null, note: null, log: [], dauer: null };
    var p = pruefStelle(bytes);
    if (!p) { r.hinweise.push('Keine Prüfdaten im PDF. Es wurde neu gespeichert, gedruckt oder nicht mit dem Test erstellt.'); return r; }
    var teile = '';
    for (var i = p.payloadAt; i < p.sigFileAt - 1; i++) teile += String.fromCharCode(bytes[i]);
    var cut = teile.lastIndexOf(':'), b64 = teile.slice(0, cut), sigPayload = teile.slice(cut + 1), P;
    try { P = JSON.parse(textB64(b64)); } catch (e) { r.status = 'veraendert'; r.hinweise.push('Die Prüfdaten sind beschädigt.'); return r; }
    r.name = String(P.first || '') + ' ' + String(P.last || ''); r.cls = P.cls || ''; r.log = Array.isArray(P.log) ? P.log : [];
    r.startedAt = P.startedAt; r.submittedAt = P.submittedAt;
    if (P.test !== K.id) { r.status = 'fremd'; r.hinweise.push('Dieses PDF gehört zu einem anderen Test.'); return r; }
    var filesig = '';
    for (i = p.sigFileAt; i < p.end; i++) filesig += String.fromCharCode(bytes[i]);
    var kopie = bytes.slice();
    kopie.set(utf8(ZERO), p.sigFileAt);
    var okPayload = hmac(K.secret, b64) === sigPayload, okDatei = hmac(K.secret, kopie) === filesig;
    r.status = 'echt';
    if (!okPayload) { r.status = 'veraendert'; r.hinweise.push('Die Prüfdaten wurden verändert.'); }
    if (!okDatei) { r.status = 'veraendert'; r.hinweise.push('Das PDF wurde nach der Abgabe verändert.'); }
    if (P.fp !== K.fp) { r.status = 'veraendert'; r.hinweise.push('Die Schüler-Datei wurde vor oder während des Tests verändert.'); }
    var e = 0, m = 0, antworten = P.answers || {};
    K.questions.forEach(function (q) { var g = grade(q, antworten[q.id]); e += g.earned; m += g.max; });
    r.earned = e; r.max = m; r.pct = m ? Math.floor(e / m * 1000 + 1e-6) / 10 : 0; r.note = gradeLabel(r.pct, K.grading);
    if (!P.shown || P.shown.earned !== e || P.shown.max !== m) { r.status = 'veraendert'; r.hinweise.push('Die angezeigten Punkte (' + fmt(P.shown ? P.shown.earned : 0) + ') stimmen nicht mit den nachgerechneten überein.'); }
    r.dauer = P.submittedAt - P.startedAt;
    if (!(r.dauer <= K.minutes * 60000 + 5000)) { r.hinweise.push('Die Bearbeitungszeit liegt über der erlaubten Zeit.'); if (r.status === 'echt') r.status = 'auffaellig'; }
    if (!(r.dauer >= 0)) { r.status = 'veraendert'; r.hinweise.push('Die Zeitangaben sind unmöglich.'); }
    return r;
  }

  var api = {
    roundHalf: roundHalf, partialPoints: partialPoints, numReadings: numReadings, fmt: fmt, norm: norm, textMatches: textMatches, parseNum: parseNum,
    parseCloze: parseCloze, gapsOf: gapsOf, tableGaps: tableGaps, tableChoices: tableChoices, choiceList: choiceList, maxPoints: maxPoints, isAnswered: isAnswered,
    grade: grade, gradeLabel: gradeLabel, hash: hash, seal: seal, unseal: unseal,
    sha256: sha256, hex: hex, hmac: hmac, b64Text: b64Text, textB64: textB64, fingerprint: fingerprint, pruefBlock: pruefBlock, pruefStelle: pruefStelle, siegeln: siegeln, pruefen: pruefen, utf8: utf8
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SMU = api;
})(typeof window !== 'undefined' ? window : globalThis);

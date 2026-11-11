/* Hilfetexte per Mouse-over: gelten für Maus, Tastatur (Fokus) und Touch (Tippen auf das Fragezeichen). */
(function () {
  'use strict';
  var FIX = {
    'knopf-anleitung': 'Öffnet die Anleitung mit allen Schritten vom ersten Test bis zur Auswertung.',
    'knopf-pruefen': 'Prüft eingesammelte PDFs mit der Kontrolldatei: Wurde etwas verändert? Die Punkte werden dabei selbst nachgerechnet.',
    'knopf-kontrolle': 'Die Datei, die beim Erzeugen automatisch mitgespeichert wurde. Sie endet auf _Kontrolle.json.',
    'knopf-pdf': 'Wähle eine oder mehrere PDFs der Schüler aus. Du kannst auch alle auf einmal markieren.',
    'knopf-neu': 'Leert den aktuellen Entwurf. Vorher wirst du noch einmal gefragt.',
    'knopf-laden': 'Lädt einen Entwurf, den du früher als Datei gespeichert hast.',
    'knopf-speichern': 'Speichert alle Fragen und Einstellungen als Datei. So kannst du den Test später wiederverwenden oder an Kollegen weitergeben.',
    'knopf-vorschau': 'Zeigt den Test so, wie Schüler ihn sehen. Vollbild und Startcode sind in der Vorschau aus, nichts wird gespeichert.',
    'knopf-erzeugen': 'Erstellt die fertige Datei für die Schüler. Sie enthält alles und läuft ohne Internet.',
    'knopf-beispiel-neu': 'Leert den Beispiel-Test, damit du mit deinen eigenen Fragen beginnen kannst.',
    titel: 'Steht groß auf dem Test und im PDF. Pflichtfeld.',
    fach: 'Erscheint über dem Titel und im PDF.',
    klasse: 'Ist die Klasse hier eingetragen, müssen Schüler sie nicht selbst angeben. Leer lassen, wenn der Test für mehrere Klassen gilt.',
    lehrkraft: 'Dein Name für die Kopfzeile und das PDF.',
    minuten: 'Die Zeit läuft ab dem Klick auf „Test starten“. Ist sie um, wird automatisch abgegeben.',
    'misch-fragen': 'Jeder Schüler bekommt die Fragen in anderer Reihenfolge. Das erschwert das Abschauen.',
    'misch-optionen': 'Mischt die Antworten bei Fragen mit einer oder mehreren richtigen Antworten.',
    loesungen: 'Zeigt nach der Abgabe und im PDF die richtige Antwort. Schalte das aus, wenn der Test noch in anderen Klassen läuft.',
    'pruef-an': 'Schüler bekommen bei jeder Frage einen Knopf, der zeigt, ob die Antwort stimmt. Die Lösung wird dabei nicht verraten, und die Punkte ändern sich nicht.',
    'pruef-art-gesamt': 'Alle Fragen teilen sich die Anzahl. Bei 2 dürfen Schüler im ganzen Test zweimal prüfen.',
    'pruef-art-frage': 'Jede Frage hat ihre eigene Anzahl. Bei 1 darf jede Frage einmal geprüft werden.',
    'pruef-anzahl': 'Eine ganze Zahl von 1 bis 99. Ist sie aufgebraucht, lässt sich der Knopf nicht mehr klicken. Neu laden ändert daran nichts.',
    fenster: 'Vermerkt Fensterwechsel, Einfügen, Kopieren, Tastenkürzel, Erweiterungen und lange Pausen mit Uhrzeit. Die Schüler werden vor dem Start darüber informiert.',
    vollbild: 'Der Test füllt den ganzen Bildschirm. Verlässt ein Schüler das Vollbild, verschwinden die Fragen, bis er zurückkehrt.',
    sperre: 'Fragen lassen sich nicht kopieren, Antworten nicht einfügen. Versuche stehen trotzdem im Protokoll.',
    startcode: 'Die Fragen sind verschlüsselt, bis der Code eingegeben wird. Du sagst ihn zu Beginn an. Groß- und Kleinschreibung ist egal.',
    pin: 'Nach der Abgabe ist der Test in diesem Browser gesperrt. Mit der PIN gibst du ihn für die nächste Person frei.',
    noten: 'Zeigt zusätzlich zu den Punkten eine Note von 1 bis 5. Ohne Haken sehen Schüler nur Punkte und Prozent.'
  };
  var SUFFIX = [
    [/-typ$/, 'Bestimmt, wie Schüler antworten und wie kontrolliert wird. Beim Wechsel bleiben Fragetext und Punkte erhalten.'],
    [/-pkt$/, 'Punkte für die ganze Frage, in Schritten von 0,5. Teilpunkte werden auf halbe Punkte gerundet. Volle Punkte gibt es nur, wenn alles stimmt.'],
    [/-text$/, 'Der Text, den Schüler sehen. Zeilenumbrüche bleiben erhalten.'],
    [/-richtig$/, 'Jede Zeile zählt als richtig. Trag hier verschiedene Schreibweisen ein, zum Beispiel „Rad“ und „Fahrrad“.'],
    [/-bild$/, 'Wähle ein JPG, PNG, GIF oder WebP aus. Es wird verkleinert und direkt in der Schüler-Datei gespeichert. Eine eigene Bilddatei neben der HTML ist nicht nötig, auch nicht beim Kopieren. Pro Frage geht ein Bild.'],
    [/-alt$/, 'Beschreibt das Bild für Schüler mit Sehschwäche. Wird angezeigt, wenn das Bild nicht geladen wird.'],
    [/-bildweg$/, 'Entfernt das Bild aus dieser Frage.'],
    [/-falsch$/, 'Macht aus dem Eingabefeld eine Auswahlliste. Leer lassen, wenn Schüler frei tippen sollen.'],
    [/-gk$/, 'Mit Haken ist „wien“ falsch, wenn „Wien“ erwartet wird.'],
    [/-typo$/, 'Bei Antworten ab 5 Buchstaben zählt ein falscher, fehlender oder zusätzlicher Buchstabe trotzdem als richtig. Bei Rechtschreibtests ausschalten.'],
    [/-wert$/, 'Die richtige Zahl. Komma und Punkt sind beide möglich, Brüche wie 3/4 erkennt die Kontrolle auch bei Schülern. 1.234 zählt als 1234 und als 1,234.'],
    [/-tol$/, 'So weit darf die Antwort abweichen. Bei 0,1 zählt für 5 alles von 4,9 bis 5,1. Leer heißt exakt.'],
    [/-einheit$/, 'Steht neben dem Eingabefeld. Tippt ein Schüler sie mit, stört das die Kontrolle nicht.'],
    [/-spalten$/, 'Anzahl der Spalten, 1 bis 8. Beim Verkleinern gehen die Inhalte der entfernten Spalten verloren.'],
    [/-zeilen$/, 'Anzahl der Zeilen ohne Überschrift, 1 bis 32. Beim Verkleinern gehen die Inhalte der entfernten Zeilen verloren.'],
    [/-wt-n$/, 'Erzeugt eine vollständige Wahrheitstabelle mit allen Kombinationen aus 0 und 1. Die Ergebnis-Spalte füllen Schüler aus. Die bisherige Tabelle wird ersetzt.'],
    [/-wt$/, 'Ersetzt die Tabelle durch eine Wahrheitstabelle. Danach trägst du in der gelben Spalte die Lösungen ein.'],
    [/-auswahl$/, 'Zum Beispiel 0, 1 oder W, F. Schüler wählen dann in jeder Zelle aus dieser Liste, statt zu tippen. Jede Lösung muss darin vorkommen.'],
    [/^neu-/, 'Fügt am Ende eine neue Frage dieser Art hinzu.']
  ];
  var tip, showT = 0, shownFor = null;

  function textFor(id) {
    if (FIX[id]) return FIX[id];
    for (var i = 0; i < SUFFIX.length; i++) if (SUFFIX[i][0].test(id)) return SUFFIX[i][1];
    return '';
  }
  function hide() { clearTimeout(showT); tip.hidden = true; shownFor = null; }
  function show(el) {
    shownFor = el;
    tip.textContent = el.getAttribute('data-hilfe');
    tip.hidden = false;
    var r = el.getBoundingClientRect(), t = tip.getBoundingClientRect();
    var x = Math.max(8, Math.min(r.left, window.innerWidth - t.width - 8));
    var y = r.bottom + 8;
    if (y + t.height > window.innerHeight - 8) y = Math.max(8, r.top - t.height - 8);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function later(el, ms) { clearTimeout(showT); showT = setTimeout(function () { show(el); }, ms); }
  function target(e) { return e.target && e.target.closest ? e.target.closest('[data-hilfe]') : null; }

  /* Hängt die Hilfe an alle bekannten Eingaben und Knöpfe; wird nach jedem Neuaufbau aufgerufen */
  function apply(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll('[id]'), function (el) {
      var text = textFor(el.id);
      if (!text) return;
      var box = el.closest('.feld, .haken');
      if (el.tagName === 'BUTTON' || !box) { el.setAttribute('data-hilfe', text); return; }
      var host = box.classList.contains('haken') ? box : box.querySelector('label, .etikett');
      if (!host || host.querySelector('.hilfe-zeichen')) return;
      var mark = document.createElement('span');
      mark.className = 'hilfe-zeichen'; mark.textContent = '?'; mark.tabIndex = 0;
      mark.setAttribute('role', 'button'); mark.setAttribute('aria-label', 'Hilfe: ' + text);
      mark.setAttribute('data-hilfe', text);
      host.appendChild(mark);
      box.setAttribute('data-hilfe', text);
    });
  }

  function init() {
    tip = document.createElement('div');
    tip.id = 'hilfe-tip'; tip.className = 'hilfe-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
    document.body.appendChild(tip);
    document.addEventListener('mouseover', function (e) { var t = target(e); if (t) { if (t !== shownFor) later(t, 300); } else hide(); });
    document.addEventListener('focusin', function (e) { var t = target(e); if (t) later(t, 100); });
    document.addEventListener('focusout', hide);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
    window.addEventListener('scroll', hide, true);
    document.addEventListener('click', function (e) {
      if (e.target.classList && e.target.classList.contains('hilfe-zeichen')) { e.preventDefault(); e.stopPropagation(); show(e.target); }
      else hide();
    }, true);
    apply(document);
    new MutationObserver(function () { apply(document); }).observe(document.body, { childList: true, subtree: true });
  }
  window.SMU_HILFE = { init: init, keys: Object.keys(FIX), textFor: textFor };
})();

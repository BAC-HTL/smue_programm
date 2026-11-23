# Änderungen

## Unveröffentlicht

- **Auflösen-Knopf:** Neue Einstellung unter „Ablauf“. Schüler können sich bei jeder Frage die richtige Antwort anzeigen lassen, die Frage bringt dann 0 Punkte. Aufgelöste Fragen stehen in Auswertung, PDF und Protokoll und werden beim Prüfen der Abgaben mit 0 Punkten nachgerechnet.
- **Neustart ohne PIN:** Neue Einstellung unter „Ablauf“. Nach der Abgabe startet „Test neu starten“ den Test von vorne, ohne Lehrer-PIN.
- **Speicherordner:** In Chrome und Edge lässt sich ein Ordner für das PDF wählen. Der Browser merkt sich die Wahl, sonst bleibt es beim Download-Ordner.
- **Tastatursperre im Vollbild:** In Chrome und Edge beendet ein kurzer Druck auf Esc das Vollbild nicht mehr, man muss Esc gedrückt halten. Windows-Taste, Alt+Tab, Win+Strg+Pfeil (Desktop wechseln), Win+Tab, Win+D, Alt+F4 und Strg+W/T/N gehen an die Seite statt ans System und werden protokolliert. Schließen und Wiederöffnen steht mit der Dauer im Protokoll.
- **Eine Frage pro Seite:** Neue Einstellung unter „Ablauf“. Schüler sehen immer nur eine Frage, Bilder werden in voller Blattbreite gezeigt. „Weiter“ fragt einmal nach und führt zur nächsten Frage, zurück geht es nicht. Die Position bleibt beim Neuladen erhalten.
- **Frage überspringen:** Bei „Eine Frage pro Seite“ lässt sich einstellen, wie oft ein Schüler eine Frage ans Ende stellen darf (Standard 2, 0 = nie). Im Test stehen dann „(2) Frage überspringen“ und „Frage einreichen“ nebeneinander, die Zahl zählt herunter. Eine schon eingetragene Antwort bleibt erhalten. Jedes Überspringen steht im Protokoll.
- **Protokoll: Versuch oder wirklich verlassen:** Fängt die Tastatursperre eine Taste ab (Win+D, Alt+Tab, Windows-Taste, Esc …), steht sie als „… – versucht, gesperrt“ unter „Tastenkürzel versucht (gesperrt)“ und zählt nicht mehr als „Vollbild verlassen“. „Vollbild verlassen“ zählt nur, wenn das Vollbild wirklich verlassen wurde, mit Uhrzeit der Rückkehr und Dauer („bis 13:22:45 (00:12 min)“), in der Übersicht mit der Gesamtzeit.
- **Strg+Alt+Entf und Win+L im Protokoll:** Diese Tasten fängt das System ab, die Seite sieht sie nie. Waren beim Verlassen des Fensters noch Strg+Alt bzw. die Windows-Taste gedrückt, steht beim Fensterwechsel „(vermutlich Strg+Alt+Entf)“ bzw. „(vermutlich Win+L …)“.
- **Kontrolldatei lesbar:** Die _Kontrolle.json wird eingerückt gespeichert, wie schon der Entwurf.
- **Anleitung und Doku-Seite aktualisiert:** Neue Abschnitte zu „Eine Frage pro Seite und Überspringen“, „Was Schüler nach der Abgabe sehen“, „Unterlagen (PDF) im Test“ und zu den Protokolleinträgen. Eine Tabelle zeigt, dass Schüler nur die HTML-Datei bekommen und die _Kontrolle.json bei der Lehrkraft bleibt.
- **Browser-Prüfung:** Headless-Chromium (automatische Tests) zählt als Chromium und wird nicht mehr blockiert.
- **package-lock.json:** pdfjs-dist nachgetragen, damit `npm ci` wieder läuft.
- **Tests:** Neue Testklasse `k8_ueberspringen_protokoll.js` (37 Fälle) für Überspringen, Protokoll, Kontrolldatei, Auswahlfelder und Anleitung.
- **Tests angepasst:** ÄK-U02 (Timer nach Neuladen) berücksichtigt das Speichern beim Neuladen, ÄK-G25 öffnet im Prüf-Tool gezielt das Protokoll (Antworten und Protokoll haben jetzt eigene Klassen).
- **Tabellen mit Auswahlfeldern:** Die Felder werden so breit wie ihr längster Eintrag, lange Antworten werden nicht mehr abgeschnitten.
- **Nur Punkte zeigen:** Neue Einstellung unter „Ablauf“. Nach der Abgabe sieht der Schüler nur Punkte, Prozent und Note, keine Übersicht der Fragen. Das PDF bleibt vollständig.
- **PDF für Schüler:** Neue Einstellung unter „Ablauf“ mit drei Stufen: vollständig (wie bisher), ohne Bewertung (nur die eigenen Antworten, ohne ✓/✗, Punkte je Frage und Lösungen) und nur Abgabebestätigung (Gesamtpunkte, keine Antworten). So kann niemand früh abgeben und mit dem PDF zeigen, welche Antworten stimmen. Die Ergebnisseite zeigt nie mehr als das PDF. Die Antworten stecken weiterhin signiert im PDF.
- **Einzelauswertung im Prüf-Tool:** „Abgaben prüfen“ zeigt je Abgabe alle Fragen mit Antwort, Lösung und Punkten und druckt sie auf Wunsch, je Schüler eine Seite.
- **Nur Chrome oder Edge:** Neue Einstellung unter „Ablauf“, standardmäßig an. In anderen Browsern startet der Test nicht, Schüler sehen eine Anleitung zum Öffnen in Chrome oder Edge. Der Safe Exam Browser ist erlaubt. Das PDF nennt den Browser.
- **Unterlagen (PDF):** Neuer Abschnitt im Lehrer-Programm. PDFs wie Datenblatt oder Schaltplan werden in die Schüler-Datei eingebaut. Schüler öffnen sie im Test über „Unterlagen“ neben den Fragen, mit Seitenwahl, Inhaltsverzeichnis und Suche (auch Strg+F). Die Trennleiste zwischen Test und Unterlagen lässt sich ziehen, Strg+Mausrad zoomt am Mauszeiger, mit gedrückter Maustaste wird das Blatt verschoben. Die Seiten zeichnet PDF.js direkt auf der Testseite: kein Fensterwechsel, keine Links, kein Kopieren, Vollbild und Protokoll gelten weiter. Ohne Unterlagen bleibt PDF.js aus der Datei draußen.

## 1.1.0 – 13. November 2026

- **PDF-Export:** Im Lehrer-Programm lässt sich der Test als PDF speichern, als Angabe zum Ausdrucken oder als Lösungsblatt. Die Angabe enthält alle Fragen mit Bildern, Antwortlinien, Kästchen und leeren Tabellen sowie Felder für Name, Klasse, Datum, Punkte und Note. Das Lösungsblatt zeigt die richtigen Antworten in Grün und den Notenschlüssel mit Punktegrenzen.
- **Lizenz:** MIT.
- **Behoben:** Wenn die Kopfleiste des Lehrer-Programms in zwei Zeilen umbricht, war das untere Ende der Einstellungen nicht mehr erreichbar.
- **Tests:** 448 automatische Tests, 28 davon neu für den Export.

## 1.0.0 – 11. November 2026

Erste Version im Repository. Sie enthält alle bisher entwickelten Funktionen.

- **Fragenarten:** Kurzantwort mit optionaler Auswahlliste, Zahl mit Toleranz und Einheit, eine oder mehrere richtige Antworten, Richtig/Falsch, Lückentext mit optionaler Auswahlliste, Tabelle ausfüllen mit Generator für Wahrheitstabellen.
- **Bilder:** Jede Frage kann ein Bild haben. Es wird in die Schüler-Datei eingebaut.
- **Ablauf:** Timer mit automatischer Abgabe, Startcode, Mischen von Fragen und Antworten, Prüfknopf mit Anzahl gesamt oder je Frage, Vollbild, Sperre für Kopieren und Einfügen.
- **Auswertung:** Punkte, Prozent und optionale Note sofort nach der Abgabe, PDF mit Antworten, Lösungen, Bildern und Protokoll.
- **Protokoll:** Fensterwechsel, Einfügen, Kopieren, Tastenkürzel, Erweiterungen, Übersetzung, Inaktivität und Neuladen mit Uhrzeit.
- **Abgabe-Sicherung:** Kontrolldatei, SHA-256-Signatur im PDF, Prüfung der Schüler-Datei, Nachrechnen der Punkte, Prüffunktion für viele PDFs auf einmal.
- **Lehrer-Programm:** Anleitung, Hilfetexte per Mouse-over, Entwürfe speichern und laden, Vorschau.
- **Tests:** 420 automatische Tests mit Äquivalenzklassen und Grenzwerten.

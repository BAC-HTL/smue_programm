# Änderungen

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

# Smü-Programm

Schriftliche Mitarbeitsüberprüfungen im Browser. Das Lehrer-Programm erzeugt eine einzige HTML-Datei für die Schüler. Sie läuft ohne Internet, hat einen Timer, kontrolliert automatisch und speichert ein PDF mit der Auswertung.

- **Doku und Online-Version:** https://bac-htl.github.io/smue_programm/
- **Download:** [Neueste Version](https://github.com/BAC-HTL/smue_programm/releases/latest), dort die Datei `Smue-Programm.html`

## Entwickeln

Voraussetzungen: Node.js 20 oder neuer. Für die Tests zusätzlich `pdftotext`, `pdfinfo`, `pdfimages` (poppler-utils) und `qpdf`.

```
npm ci
npx playwright install --with-deps chromium
npm run build    # erzeugt dist/Smue-Programm.html
npm test         # führt alle Tests aus, Ergebnis in tests/ergebnisse.json
npm run site     # baut die Doku-Seite nach _site/
```

| Ordner oder Datei | Inhalt |
| --- | --- |
| `src/` | Quellcode: Bewertung (`core.js`), Lehrer-Programm (`master.*`), Schüler-Datei (`student.*`), Anleitung, Hilfetexte |
| `tests/` | Testklassen mit Äquivalenzklassen und Grenzwerten, Einstieg `alle.js` |
| `fonts/` | Teilmengen von DejaVu Sans Condensed für das PDF |
| `docs/` | Inhalte der Doku-Seite |
| `build.js`, `site.js` | Bauen das Programm und die Doku-Seite |

## Veröffentlichen

1. Version in `package.json` erhöhen und `CHANGELOG.md` ergänzen.
2. Änderungen auf `main` bringen. Die Doku-Seite wird automatisch neu gebaut.
3. Sobald die neue Version auf `main` ist, baut und testet der Workflow „Release“ das Programm. Er legt das Tag `vX.Y.Z` und ein Release mit `Smue-Programm.html` und den Testergebnissen an. Schlägt ein Test fehl, entsteht kein Release.

## Lizenz

MIT, Copyright (c) 2026 Christoph Bauer. Siehe [LICENSE](LICENSE). Bestandteile von Dritten und ihre Lizenzen stehen in [THIRD_PARTY.md](THIRD_PARTY.md).

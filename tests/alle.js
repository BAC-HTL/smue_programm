// Führt alle Testklassen aus und schreibt ergebnisse.json
const fs = require('fs'), path = require('path');
const H = require('./hilfsmittel');
(async () => {
  const t0 = Date.now();
  await require('./k1_bewertung')();
  await H.start();
  await require('./k2_master')();
  await require('./k3_schueler')();
  await require('./k4_regression')();
  await require('./k5_bilder_sicherung')();
  await require('./k6_pruefknopf')();
  await require('./k7_tabelle')();
  await H.stop();
  const r = H.ergebnisse, f = r.filter(x => x.status !== 'bestanden');
  fs.writeFileSync(path.join(__dirname, 'ergebnisse.json'), JSON.stringify({ am: new Date().toISOString(), dauerSek: Math.round((Date.now() - t0) / 1000), gesamt: r.length, fehler: f.length, faelle: r }, null, 1));
  console.log(`\n${r.length} Tests, ${r.length - f.length} bestanden, ${f.length} fehlgeschlagen, ${Math.round((Date.now() - t0) / 1000)} s`);
  process.exit(f.length ? 1 : 0);
})().catch(e => { console.error('ABBRUCH', e); process.exit(2); });

/* Sortie forcée du Multivision : une page encadrée qui navigue la fenêtre entière.

   « J'ai voulu ajouter un stream dans un match et là, la page me redirect non stop vers
   le stream sur le site externe » (7 septembre 2026). Sans attribut `sandbox` (retiré à
   la demande de l'utilisateur), rien n'empêche une page de faire `top.location = …` ;
   le Multivision restauré au chargement reposait la tuile, et la boucle repartait.

   On reconnaît la sortie après coup : `pagehide` moins de 15 s après la pose d'une
   tuile → ses adresses sont notées ; au retour, ces tuiles sont marquées et ne sont pas
   rechargées (avertissement dans la tuile, avec « Charger quand même » et « ↗ Site »). */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://exemple.test/' });
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement'])
    Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
  const mv = await import('../js/multiview.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };
  const now = 1_800_000_000_000;

  // ── 1. Suspects : seules les tuiles posées à l'instant ─────────────────────────
  const flux = [
    { url: 'https://site-a.test/p', _posedAt: now - 3000 },      // posée il y a 3 s
    { url: 'https://site-b.test/p', _posedAt: now - 60000 },     // depuis une minute : joue tranquillement
    { url: 'https://site-c.test/p' },                            // jamais posée (restaurée, pas encore chargée)
    { url: 'https://site-d.test/p', _posedAt: now + 5000 },      // horloge incohérente : ignorée
    null
  ];
  assert.deepStrictEqual(mv.suspectsDeSortie(flux, now), ['https://site-a.test/p']);
  assert.deepStrictEqual(mv.suspectsDeSortie([], now), []);
  assert.deepStrictEqual(mv.suspectsDeSortie(null, now), []);
  ok('seule une tuile posée dans les 15 dernières secondes est suspecte');

  // ── 2. Au retour : marquage des tuiles concernées, enregistrement périmé ignoré ──
  const restaure = [
    { url: 'https://site-a.test/p', name: 'A' },
    { url: 'https://site-b.test/p', name: 'B' }
  ];
  assert.strictEqual(mv.marquerSortiesForcees(restaure, { urls: ['https://site-a.test/p'], at: now - 2000 }, now), 1);
  assert.strictEqual(restaure[0]._sortieForcee, true, 'la tuile fautive est marquée');
  assert.ok(!restaure[1]._sortieForcee, 'l\'autre tuile ne l\'est pas');

  const vieux = [{ url: 'https://site-a.test/p' }];
  assert.strictEqual(mv.marquerSortiesForcees(vieux, { urls: ['https://site-a.test/p'], at: now - 11 * 60 * 1000 }, now), 0, 'plus de dix minutes : oublié');
  assert.ok(!vieux[0]._sortieForcee);
  assert.strictEqual(mv.marquerSortiesForcees(vieux, null, now), 0);
  assert.strictEqual(mv.marquerSortiesForcees(vieux, { urls: 'pas une liste', at: now }, now), 0);
  ok('au retour, seules les tuiles notées sont marquées, et un enregistrement périmé ne compte plus');

  // ── 3. La tuile marquée n'est pas rechargée ; « Charger quand même » lève la marque ──
  mv.mvFlux.length = 0;
  mv.mvFlux.push({ url: 'https://site-a.test/p', name: 'A', mid: 'x', _sortieForcee: true });
  const cell = document.createElement('div'); cell.dataset.index = '0';
  const container = document.createElement('div'); cell.appendChild(container);
  document.body.appendChild(cell);
  /* fallbackToIframe est interne : on passe par la restauration de la mise en page,
     qui reconstruit les cellules ; on vérifie seulement la marque et le bouton. */
  mv.chargerQuandMeme(0);
  assert.strictEqual(mv.mvFlux[0]._sortieForcee, false, '« Charger quand même » lève la marque');
  ok('« Charger quand même » lève la marque et repose la tuile par le chemin normal');

  console.log(`unit_sortieforcee: ${n} groupes de tests OK`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

/* Tests de la promotion des miroirs (js/config.js).

   Les domaines de ces sources changent plusieurs fois par saison : c'est la principale
   cause de panne silencieuse. `fetchWithMirrors` basculait déjà sur un miroir vivant,
   mais seulement pour l'exécution en cours — rien n'était écrit, si bien que le
   lancement suivant réessayait le domaine mort en premier et repayait son délai
   d'attente, et que le navigateur, qui lit domains.json au démarrage, continuait de
   partir sur la mauvaise adresse.

   `reorderCandidates` décide du nouvel ordre. Fonction pure, donc vérifiable sans
   réseau ni système de fichiers. Domaines inventés : rien ici ne dépend d'un site réel. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/' });
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement']) {
    Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
  }
  const C = await import('../js/config.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  const A = 'https://a.exemple.test/', B = 'https://b.exemple.test/', D = 'https://c.exemple.test/';

  {
    // Le gagnant passe en tête, les morts en queue, les non testés au milieu.
    assert.deepStrictEqual(C.reorderCandidates(B, [A, B, D], [A]), [B, D, A]);
    ok('le gagnant passe devant, le domaine mort en queue');
  }
  {
    // Rien à changer quand le premier candidat répond déjà.
    assert.deepStrictEqual(C.reorderCandidates(A, [A, B, D], []), [A, B, D]);
    ok('un ordre déjà correct est laissé tel quel');
  }
  {
    /* Un domaine mort est RELÉGUÉ, jamais supprimé : ces adresses reviennent après une
       coupure, et les perdre priverait la source de son dernier repli le jour où
       l'adresse en service tombe à son tour. */
    const out = C.reorderCandidates(D, [A, B, D], [A, B]);
    assert.deepStrictEqual(out, [D, A, B]);
    assert.strictEqual(out.length, 3, 'aucun candidat n\'est perdu');
    ok('les domaines morts sont relégués, pas supprimés');
  }
  {
    // La sortie est une permutation de l'entrée : aucune adresse n'est inventée.
    const entree = [A, B, D];
    const sortie = C.reorderCandidates(B, entree, [D]);
    assert.deepStrictEqual(sortie.slice().sort(), entree.slice().sort(),
      'la sortie doit contenir exactement les mêmes adresses');
    ok('aucune adresse n\'est inventée ni perdue');
  }
  {
    // Le gagnant peut ne pas figurer dans la liste (URL courante hors miroirs déclarés).
    assert.deepStrictEqual(C.reorderCandidates(D, [A, B], [A]), [D, B, A]);
    ok('un gagnant absent de la liste est ajouté en tête');
  }
  {
    // Doublons et entrées vides : pas d'exception, pas de doublon en sortie.
    assert.deepStrictEqual(C.reorderCandidates(A, [A, A, B, '', null], []), [A, B]);
    assert.deepStrictEqual(C.reorderCandidates(null, [A, B], [A]), [A, B],
      'sans gagnant, on ne réordonne rien : aucune information à écrire');
    assert.deepStrictEqual(C.reorderCandidates(A, [], []), [A]);
    assert.deepStrictEqual(C.reorderCandidates(null, null, null), []);
    ok('reorderCandidates tolère doublons, vides et absence de gagnant');
  }

  // ── Faut-il promouvoir ? ───────────────────────────────────────────────────
  {
    const rep = (o) => Object.assign({ id: 'x', ok: true, matches: 12 }, o);
    const trouve = { winner: A, dead: [], candidates: [A] };

    assert.strictEqual(C.shouldPromoteSource(rep(), trouve), true, 'source saine : on promeut');

    /* Le cas qui compte : un domaine expiré puis racheté répond 200 avec une page de
       parking. Le promouvoir remplacerait une source vivante par une source morte et
       reléguerait le miroir qui marchait — l'inverse exact du but recherché. */
    assert.strictEqual(C.shouldPromoteSource(rep({ matches: 0 }), trouve), false,
      'une adresse qui répond sans livrer de match ne doit pas être promue');

    assert.strictEqual(C.shouldPromoteSource(rep({ ok: false }), trouve), false);
    assert.strictEqual(C.shouldPromoteSource(rep(), { winner: null, dead: [A], candidates: [A] }), false,
      'aucune adresse n\'a répondu : rien à écrire');
    assert.strictEqual(C.shouldPromoteSource(null, trouve), false);
    assert.strictEqual(C.shouldPromoteSource(rep(), null), false);
    ok('shouldPromoteSource exige des matchs livrés, pas seulement un code 200');
  }

  console.log('unit_mirrors: ' + n + ' groupes de tests OK');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

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

  // ── Le gagnant après lecture ─────────────────────────────────────────────
  /* Relevé le 9 septembre 2026 : le script serveur ne posait le gagnant que s'il était
     ABSENT, or fetchWithMirrors le pose toujours après un succès ; le cas sain tombait
     dans le `else` et remettait le gagnant à null. shouldPromoteSource refusait alors
     tout, et domains.json n'a jamais été réécrit par le bot. C'est CE cas qui compte. */
  {
    const trouve = { winner: A, dead: [], candidates: [A, B] };
    assert.strictEqual(C.gagnantApresLecture(trouve, 12, A), A,
      'source saine, gagnant déjà posé et matchs livrés : le gagnant reste');
    assert.strictEqual(C.gagnantApresLecture({ winner: null, dead: [], candidates: [A] }, 12, B), B,
      'sans gagnant posé, l\'adresse lue en tient lieu');
    assert.strictEqual(C.gagnantApresLecture(trouve, 0, A), null,
      'aucun match livré : pas de gagnant, quel que soit le code HTTP');
    assert.strictEqual(C.gagnantApresLecture(null, 12, A), null);
    assert.strictEqual(C.gagnantApresLecture(trouve, undefined, A), null);
    // Enchaîné avec la promotion : le cas sain doit finir par une écriture.
    const apres = Object.assign({}, trouve, { winner: C.gagnantApresLecture(trouve, 12, A) });
    assert.strictEqual(C.shouldPromoteSource({ id: 'x', ok: true, matches: 12 }, apres), true,
      'une source saine est promue au bout de la chaîne');
    ok('gagnantApresLecture garde le gagnant d\'une source qui a livré des matchs');
  }

  // ── Origine canonique : un site qui a déménagé le dit lui-même ──────────
  /* Relevé le 6 septembre 2026 : footybite.bid redirige vers footybite.im et ses pages de
     match répondent 403 ; la page d'accueil, elle, livre ses matchs, donc aucun miroir
     n'était promu et aucune page de match n'était lue. */
  assert.strictEqual(C.canonicalOrigin('<html><head><link rel="canonical" href="https://footybite.im"></head></html>'), 'https://footybite.im');
  assert.strictEqual(C.canonicalOrigin('<html><head><link href="https://footybite.im/x" rel="canonical"></head></html>'), 'https://footybite.im', 'attributs dans l\'autre ordre');
  assert.strictEqual(C.canonicalOrigin('<meta property="og:url" content="https://footybite.im/game/a">'), 'https://footybite.im', 'og:url en repli');
  assert.strictEqual(C.canonicalOrigin('<html><body>rien</body></html>'), '', 'sans déclaration : rien');
  assert.strictEqual(C.canonicalOrigin('<link rel="canonical" href="javascript:alert(1)">'), '', 'seul http(s) compte');
  assert.strictEqual(C.canonicalOrigin(null), '');
  ok('canonicalOrigin : lit canonical puis og:url, ne rend qu\'une origine http(s)');

  console.log('unit_mirrors: ' + n + ' groupes de tests OK');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

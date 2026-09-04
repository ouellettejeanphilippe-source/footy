/* Lecteur préparé côté serveur (scripts/scrape_streams.mjs → data/streams.json).

   Constat du 4 septembre 2026, signalé par l'utilisateur : « l'extraction ne marche
   jamais ». L'extracteur n'était pas en cause — vérifié sur les pages réelles, il
   remonte bien le lecteur imbriqué. C'est le TRANSPORT qui manquait : pour lire une page
   que X-Frame-Options refuse d'encadrer, le navigateur doit passer par le script
   utilisateur ou par un proxy CORS public. Sondés le même jour DEPUIS UN SERVEUR, donc
   sans CORS en cause :

     allorigins (raw)   HTTP 400
     allorigins (json)  HTTP 522
     codetabs           HTTP 522
     proxy.cors.sh      HTTP 200

   Trois sur quatre morts. Sans le script installé, il ne restait qu'un canal — d'où le
   « jamais ». L'extraction est donc faite par le scraper horaire, où la politique
   d'origine croisée n'existe pas, et l'adresse du lecteur est écrite dans le fichier.

   Ces cas verrouillent les deux bouts : ce que l'extracteur doit refuser, et le contrat
   du champ que le scraper écrit. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://exemple.test/' });
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement'])
    Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
  const ex = await import('../js/extractors.js');
  const eb = await import('../js/embed-bridge.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  // ── 1. La chaîne réelle relevée le 4 septembre ────────────────────────────────
  /* tnt-sports.shop → flyembed.click → epiembeds.online : deux niveaux d'iframe.
     L'extracteur doit remonter le premier saut ; c'est le scraper qui refait le
     deuxième au tour suivant. */
  const pageHote = '<!doctype html><html><body><h1>TNT-USA</h1>'
    + '<iframe src="https://flyembed.click/embed/15.php" width="100%" allowfullscreen></iframe>'
    + '</body></html>';
  const trouve = ex.extractPlayers(pageHote, 'https://tnt-sports.shop/sportsurge-012/15.php');
  assert.ok(trouve.length >= 1, 'un lecteur devrait être trouvé');
  assert.strictEqual(trouve[0].url, 'https://flyembed.click/embed/15.php');
  assert.strictEqual(trouve[0].kind, 'embed');
  ok('le lecteur imbriqué est extrait de la page hôte');

  // ── 2. about:blank n'est pas un lecteur ───────────────────────────────────────
  /* Défaut relevé en sondant les liens du cache : givemereddit.lat rendait
     « about:blank » comme meilleur candidat. C'est une adresse valide pour `new URL`,
     sans hôte donc sans hôte suspect, et la trouver dans une <iframe> lui donnait 45
     points — au-dessus du seuil d'intégration. Résultat : une tuile noire. */
  for (const mauvais of ['about:blank', 'javascript:void(0)', 'data:text/html,<b>x</b>', 'blob:https://a.test/1']) {
    const r = ex.scoreCandidate({ url: mauvais, via: 'iframe' }, { pageUrl: 'https://exemple.test/p' });
    assert.strictEqual(r.kind, 'reject', mauvais + ' devrait être rejeté, pas ' + r.kind);
  }
  const pageVide = '<html><body><iframe src="about:blank"></iframe></body></html>';
  assert.strictEqual(eb.pickEmbeddablePlayer(pageVide, 'https://givemereddit.lat/x', null), null,
    'une page dont la seule iframe est about:blank ne doit livrer aucun lecteur');
  ok('les schémas non http (about:, javascript:, data:, blob:) sont rejetés');

  // ── 3. http et https restent acceptés ─────────────────────────────────────────
  /* Le rejet ci-dessus ne doit pas emporter les lecteurs légitimes. */
  const bon = ex.scoreCandidate({ url: 'https://embed.exemple.test/live/embed.php?ch=es50', via: 'iframe' },
                                { pageUrl: 'https://autre.test/p' });
  assert.strictEqual(bon.kind, 'embed');
  assert.ok(bon.score > ex.EMBED_THRESHOLD);
  ok('un vrai lecteur http(s) garde son score et reste intégrable');

  // ── 4. Le lecteur ne doit pas être la page elle-même ──────────────────────────
  /* Même exigence des deux côtés : le scraper et pickEmbeddablePlayer refusent un
     candidat du même hôte que la page — sinon on réécrit l'adresse qu'on avait déjà. */
  const memeHote = '<html><body><iframe src="https://memehote.test/embed/9.php"></iframe></body></html>';
  assert.strictEqual(eb.pickEmbeddablePlayer(memeHote, 'https://memehote.test/match/9', null), null);
  ok('un candidat du même hôte que la page n\'est pas retenu comme lecteur');

  // ── 5. Contrat du champ écrit dans data/streams.json ──────────────────────────
  /* Le client n'accepte `playerUrl` que si c'est une adresse http(s) : le fichier est
     produit par une machine, mais il est lu par le navigateur, et une valeur inattendue
     ne doit pas devenir la source d'une iframe. */
  const accepte = (v) => typeof v === 'string' && /^https?:/i.test(v);
  assert.strictEqual(accepte('https://embed.exemple.test/x'), true);
  assert.strictEqual(accepte('http://embed.exemple.test/x'), true);
  for (const v of ['about:blank', 'javascript:alert(1)', '', null, undefined, 42, {}])
    assert.strictEqual(accepte(v), false, String(v) + ' ne doit pas être accepté comme playerUrl');
  ok('playerUrl n\'est honoré que s\'il est une adresse http(s)');

  console.log('\n' + n + ' groupes OK — lecteur préparé côté serveur');
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });

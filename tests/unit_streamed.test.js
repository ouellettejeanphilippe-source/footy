/* Tests de la source streamed.pk (js/scrapers.js) et de ce qu'il a fallu apprendre au
   moteur d'extraction pour la lire (js/extractors.js).

   Pourquoi cette source : le relevé du 3 septembre 2026 ne contenait AUCUN match de catch
   — les pages AEW/WWE de Methstreams sont des calendriers vides qui annoncent « les liens
   sont ajoutés 1 h avant l'événement » — 6 matchs de boxe et 43 de football universitaire.
   streamed.pk annonce à elle seule une centaine de matchs de football américain et porte
   AEW, WWE, TNA, la boxe et l'UFC.

   Elle est la seule à exposer une API JSON plutôt que des pages HTML à deviner, ce qui a
   demandé deux corrections dans le moteur : lire un corps entièrement JSON, et reconnaître
   les clés suffixées (`embedUrl`) que les API utilisent couramment.

   Aucun appel réseau : les fixtures reproduisent la forme réelle des réponses. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/' });
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement']) {
    Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
  }
  const sc = await import('../js/scrapers.js');
  const ex = await import('../js/extractors.js');
  const cf = await import('../js/config.js');

  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };
  const API = 'https://streamed.pk/api/matches/fight';

  // ── 1. Ligue d'un événement ───────────────────────────────────────────────
  {
    // L'ordre compte : la catégorie de l'API pour AEW est « fight ». Classer d'abord par
    // catégorie rangerait « AEW Saturday Night Collision » sous Boxing.
    const l = (title, cat, hint) => sc.leagueOfStreamedEvent({ title, category: cat }, hint || '');
    assert.strictEqual(l('AEW Saturday Night Collision', 'fight'), 'AEW');
    assert.strictEqual(l('WWE Friday Night Smackdown', 'fight'), 'WWE');
    assert.strictEqual(l('TNA Impact', 'fight'), 'TNA');
    assert.strictEqual(l('UFC Fight Night 287 Hooker vs Parnasse', 'fight'), 'UFC');
    assert.strictEqual(l('Andy Ruiz Jr. vs Damian Knyba', 'fight'), 'Boxing');
    ok('leagueOfStreamedEvent sépare catch, UFC et boxe d\'une catégorie « fight » commune');
  }
  {
    // Football américain : universitaire et professionnel sont mêlés dans une seule
    // catégorie. L'identifiant du flux tranche quand il le peut.
    assert.strictEqual(sc.leagueOfStreamedEvent({ title: 'Illinois vs UAB', category: 'american-football' },
      'live_cfb_illinois-uab-live-streaming-587641824'), 'CFB');
    assert.strictEqual(sc.leagueOfStreamedEvent({ title: 'A vs B', category: 'american-football' },
      'live_nfl_a-b'), 'NFL');
    ok('leagueOfStreamedEvent lit la ligue dans l\'identifiant du flux');
  }
  {
    /* Sans indice, on interroge la base d'équipes : elle recense les 32 clubs de la NFL,
       pas les centaines d'équipes universitaires. Ranger un match de NFL sous CFB
       fausserait la catégorie la plus consultée. */
    assert.strictEqual(sc.leagueOfStreamedEvent(
      { title: 'Kansas City Chiefs vs Buffalo Bills', category: 'american-football' }, 'ppv-kc-buf'), 'NFL');
    assert.strictEqual(sc.leagueOfStreamedEvent(
      { title: 'Millsaps Majors vs Belhaven Blazers', category: 'american-football' }, 'ppv-mil-bel'), 'CFB');
    ok('leagueOfStreamedEvent distingue NFL et universitaire par la base d\'équipes');
  }

  // ── 2. Parseur ────────────────────────────────────────────────────────────
  const fixture = JSON.stringify([
    { id: 'aew-collision', title: 'AEW Saturday Night Collision', category: 'fight',
      date: Date.UTC(2026, 8, 6, 0, 0), sources: [{ source: 'admin', id: 'ppv-aew-saturday-night-collision' },
        { source: 'delta', id: 'live-event_aew' }] },
    { id: 'sans-source', title: 'Combat sans diffuseur', category: 'fight', date: Date.UTC(2026, 8, 6, 0, 0), sources: [] },
    { id: 'vide', category: 'fight', date: 0, sources: [{ source: 'admin', id: 'x' }] }
  ]);

  {
    const out = sc.parseStreamed(fixture, API);
    assert.strictEqual(out.length, 1, 'un événement sans source ou sans titre est écarté');
    const m = out[0];
    assert.strictEqual(m.league, 'AEW');
    assert.strictEqual(m.source, 'streamed');
    assert.strictEqual(m.homeTeam, 'AEW Saturday Night Collision', 'un événement sans adversaires garde son titre');
    assert.strictEqual(m.awayTeam, '');
    // Les flux vivent derrière un second appel ; on ne fabrique pas ces adresses.
    assert.strictEqual(m.matchUrl, 'https://streamed.pk/api/stream/admin/ppv-aew-saturday-night-collision');
    assert.deepStrictEqual(m.altUrls, ['https://streamed.pk/api/stream/delta/live-event_aew']);
    assert.deepStrictEqual(m.streamLinks, [], 'aucun lien n\'est inventé à ce stade');
    ok('parseStreamed produit un match par événement diffusé, flux à aller chercher');
  }
  {
    // Entrées inexploitables : jamais d'exception.
    ['', 'pas du json', '{}', '[]', 'null'].forEach((bad) => {
      assert.deepStrictEqual(sc.parseStreamed(bad, API), [], JSON.stringify(bad));
    });
    ok('parseStreamed tolère une réponse vide ou illisible');
  }

  // ── 3. Ce que le moteur a dû apprendre ────────────────────────────────────
  {
    /* Un corps entièrement JSON ne donnait aucun candidat : on ne lisait le JSON que dans
       les <script> d'une page, et `sliceJsonLiterals` n'isole que ce qui SUIT un « = » ou
       un « : » — or un corps qui est lui-même un tableau n'a rien devant lui. */
    const flux = JSON.stringify([
      { id: 'x', streamNo: 1, language: 'English - TNT', hd: true, source: 'admin',
        embedUrl: 'https://embed.st/embed/admin/ppv-aew-saturday-night-collision/1' },
      { id: 'x', streamNo: 2, language: 'English - TNT', hd: false, source: 'admin',
        embedUrl: 'https://embed.st/embed/admin/ppv-aew-saturday-night-collision/2' }
    ]);
    const players = ex.extractPlayers(flux, 'https://streamed.pk/api/stream/admin/ppv-aew');
    assert.strictEqual(players.length, 2, 'les deux flux sont trouvés dans un corps JSON brut');
    players.forEach((p) => assert.strictEqual(p.kind, 'embed', 'et classés comme intégrables'));
    assert.ok(players[0].label.indexOf('English') >= 0, 'la langue sert d\'étiquette');
    ok('extractPlayers lit un corps entièrement JSON');
  }
  {
    /* `URL_KEYS` était comparée à l'identique : `embedUrl`, `streamUrl`, `videoSrc` — la
       façon dont les API nomment leurs adresses — n'étaient jamais reconnues. */
    ['embedUrl', 'streamUrl', 'videoSrc', 'playerLink', 'url', 'src'].forEach((k) => {
      assert.ok(ex.isUrlKey(k), k + ' doit être reconnue comme une clé d\'adresse');
    });
    ['title', 'language', 'viewers', 'id', 'name'].forEach((k) => {
      assert.ok(!ex.isUrlKey(k), k + ' ne doit pas l\'être');
    });
    ok('isUrlKey reconnaît les clés suffixées sans avaler les autres');
  }
  {
    // Les images ramassées par la même règle (`badgeUrl`) sont écartées par le pointage.
    const blob = JSON.stringify([{ badgeUrl: 'https://img.example.test/logo.png',
      posterUrl: 'https://img.example.test/p.jpg' }]);
    assert.deepStrictEqual(ex.extractPlayers(blob, 'https://streamed.pk/api/x'), [],
      'une image n\'est pas un lecteur');
    ok('les adresses d\'images ne deviennent pas des flux');
  }

  // ── 4. Pas de lien mort vers un point d'API ───────────────────────────────
  {
    /* streamed.pk liste des matchs pour lesquels elle n'a aucun flux : sur un relevé,
       31 matchs de football universitaire recevaient en repli l'adresse de l'API
       elle-même, qui n'affiche que « [] ». Un lien mort présenté comme jouable. */
    assert.ok(cf.isApiEndpoint('https://streamed.pk/api/stream/delta/live_cfb_x'));
    assert.ok(!cf.isApiEndpoint('https://exemple.test/game/alpha-vs-beta'));
    assert.deepStrictEqual(sc.matchPageFallbackLink('https://streamed.pk/api/stream/delta/x', []), [],
      'aucun repli vers un point d\'API');
    assert.strictEqual(sc.matchPageFallbackLink('https://exemple.test/game/7', []).length, 1,
      'mais le repli reste pour une vraie page de match');
    ok('aucun lien de repli ne pointe vers un point d\'API');
  }

  console.log('unit_streamed: ' + n + ' groupes de tests OK');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

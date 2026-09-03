/* Tests unitaires de mergeFluxToApi (jsdom, sans réseau).

   Deux comportements y sont vérifiés :
   1. Fusion normale : un flux qui correspond à un match de la grille officielle
      lui apporte ses liens, sans créer de carte supplémentaire (principe API-First,
      « pas de doublons »).
   2. Classement des flux non appariés. Ils étaient tous forcés dans « Autres Flux »,
      une section repliée absente de la grille temporelle du Guide. Quand ESPN ne
      répond pas — ou ne couvre pas la ligue — la grille entière (NFL, MLB, NBA…)
      disparaissait donc du Guide alors que data/streams.json portait le bon nom de
      ligue. Le nom est désormais conservé, mais seulement si l'API ne renvoie rien
      pour cette ligue : sinon un échec de fusion produirait un doublon visible. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://x.test/' });
    const w = dom.window;
    w.__NO_AUTOSTART__ = true;
    for (const k of ['window', 'document', 'DOMParser', 'localStorage', 'navigator', 'HTMLElement', 'Event', 'CustomEvent', 'location', 'history', 'getComputedStyle']) {
        Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
    }
    globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

    const api = await import('../js/api.js');
    const db = await import('../js/db.js');

    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    const today = (await import('../js/config.js')).getEstDateStrFromDate(new Date());
    const apiMatch = (over) => Object.assign({
        id: 'api1', league: 'MLB', homeTeam: 'New York Yankees', awayTeam: 'Boston Red Sox',
        startTime: '19:05', matchDate: today, status: 'upcoming', streamLinks: []
    }, over || {});
    const scraped = (over) => Object.assign({
        source: 'buffstreams', league: 'MLB', homeTeam: 'New York Yankees', awayTeam: 'Boston Red Sox',
        startTime: '19:05', matchDate: today, status: 'upcoming',
        streamLinks: [{ name: 'Flux 1', url: 'https://exemple.test/flux1' }]
    }, over || {});

    // ── 1. Fusion sur un match existant : aucun match ajouté ────────────────
    let grid = [apiMatch()];
    api.mergeFluxToApi(grid, [scraped()], true);
    assert.strictEqual(grid.length, 1, 'un flux apparié ne crée pas de carte supplémentaire');
    assert.strictEqual(grid[0].streamLinks.length, 1, 'le lien est rattaché au match officiel');
    ok('flux apparié : liens fusionnés, pas de doublon');

    // ── 2. Ligue déjà couverte par l'API : « Autres Flux » (doublon possible) ──
    grid = [apiMatch()];
    api.mergeFluxToApi(grid, [scraped({ homeTeam: 'Equipe Inconnue A', awayTeam: 'Equipe Inconnue B' })], true);
    assert.strictEqual(grid.length, 2, 'le flux non apparié est ajouté');
    assert.strictEqual(grid[1].league, 'Autres Flux',
        'MLB est déjà dans la grille : un flux MLB non apparié reste isolé');
    assert.strictEqual(grid[1].scrapedLeagueName, 'MLB', 'le nom d\'origine reste consultable');
    ok('ligue couverte par l\'API : le flux non apparié reste dans « Autres Flux »');

    // ── 3. Ligue absente de l'API : le vrai nom de ligue est conservé ───────
    grid = [apiMatch({ league: 'NHL', homeTeam: 'Montreal Canadiens', awayTeam: 'Toronto Maple Leafs' })];
    api.mergeFluxToApi(grid, [scraped({ homeTeam: 'Equipe Inconnue A', awayTeam: 'Equipe Inconnue B' })], true);
    assert.strictEqual(grid.length, 2);
    assert.strictEqual(grid[1].league, 'MLB', 'aucun match MLB dans la grille : pas de doublon possible');
    assert.strictEqual(db.leagueTier(grid[1].league), 'main', 'la ligue retrouve son niveau, donc sa place dans le Guide');
    ok('ligue absente de l\'API : le vrai nom de ligue est conservé');

    // ── 4. Grille vide (ESPN injoignable) : rien ne tombe dans « Autres Flux » ──
    grid = [];
    api.mergeFluxToApi(grid, [
        scraped({ league: 'NFL', homeTeam: 'Dallas Cowboys', awayTeam: 'New York Giants' }),
        scraped({ league: 'NBA', homeTeam: 'Boston Celtics', awayTeam: 'Miami Heat' })
    ], true);
    assert.deepStrictEqual(grid.map((m) => m.league), ['NFL', 'NBA'],
        'ESPN muet : la grille garde les ligues réelles au lieu de tout replier dans « Autres Flux »');
    ok('API muette : les ligues réelles sont préservées');

    // ── 5. Ligue inconnue : toujours « Autres Flux » ────────────────────────
    grid = [];
    api.mergeFluxToApi(grid, [scraped({ league: 'Coupe Machin Inconnue', homeTeam: 'A', awayTeam: 'B' })], true);
    assert.strictEqual(grid.length, 1);
    assert.strictEqual(grid[0].league, 'Autres Flux', 'une ligue non reconnue reste non reconnue');
    ok('ligue inconnue : « Autres Flux » comme avant');

    // ── 6. Matchs sans équipe exploitable : toujours écartés ────────────────
    grid = [];
    api.mergeFluxToApi(grid, [
        scraped({ league: 'NFL', homeTeam: 'TBD', awayTeam: 'TBD' }),
        scraped({ league: 'NFL', homeTeam: '', awayTeam: '' }),
        scraped({ league: 'NFL', homeTeam: 'A', awayTeam: 'B', status: 'finished' })
    ], true);
    assert.strictEqual(grid.length, 0, 'TBD, équipes vides et matchs terminés restent filtrés');
    ok('filtres existants préservés (TBD, équipes vides, matchs terminés)');

    console.log(`unit_merge: ${n} groupes de tests OK`);
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

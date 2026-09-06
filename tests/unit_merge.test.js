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

    // ── 2. Flux sans match dans la grille : aucune carte, quelle que soit la ligue ──
    /* La grille, c'est ESPN et les sources de calendrier acceptées ; un scraper n'y
       attache que des liens. Relevé le 6 septembre 2026 : « Money In The Bank » en
       DIRECT, « NFL Schedule Release 2021 », « Toronto Raptors vs Denver Nuggets » un
       samedi de septembre — tous des flux sans calendrier derrière eux. */
    const { S } = await import('../js/state.js');
    grid = [apiMatch()];
    api.mergeFluxToApi(grid, [scraped({ homeTeam: 'Equipe Inconnue A', awayTeam: 'Equipe Inconnue B' })], true);
    assert.strictEqual(grid.length, 1, 'ligue présente dans la grille : le flux non apparié ne crée pas de carte');
    grid = [apiMatch({ league: 'NHL', homeTeam: 'Montreal Canadiens', awayTeam: 'Toronto Maple Leafs' })];
    api.mergeFluxToApi(grid, [scraped({ homeTeam: 'Equipe Inconnue A', awayTeam: 'Equipe Inconnue B' })], true);
    assert.strictEqual(grid.length, 1, 'ligue absente de la grille : pas de carte non plus');
    grid = [];
    api.mergeFluxToApi(grid, [
        scraped({ league: 'NFL', homeTeam: 'NFL Schedule Release 2021', awayTeam: 'NFL Total Access' }),
        scraped({ league: 'NBA', homeTeam: 'Toronto Raptors', awayTeam: 'Denver Nuggets', startTime: '18:30' }),
        scraped({ league: 'WWE', homeTeam: 'Money In The Bank', awayTeam: '', status: 'live' }),
        scraped({ league: 'Coupe Machin Inconnue', homeTeam: 'A', awayTeam: 'B' })
    ], true);
    assert.strictEqual(grid.length, 0, 'grille vide (ESPN muet) : les scrapers ne la remplissent pas à sa place');
    ok('un flux sans match dans la grille ne crée jamais de carte');

    // ── 3. Ces flux restent consultables pour le diagnostic ─────────────────
    assert.strictEqual(S.unmatchedStreams.length, 4, 'les quatre flux écartés sont gardés de côté');
    assert.ok(S.unmatchedStreams.some((m) => m.homeTeam === 'Money In The Bank'));
    grid = [apiMatch()];
    api.mergeFluxToApi(grid, [scraped()], true);
    assert.strictEqual(S.unmatchedStreams.length, 0, 'la liste repart de zéro à chaque fusion');
    ok('les flux écartés sont exposés dans S.unmatchedStreams, remis à zéro à chaque passe');

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

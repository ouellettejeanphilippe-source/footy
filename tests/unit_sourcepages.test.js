/* Toutes les pages par sport d'une source, pas seulement celles qu'on connaissait.

   « Sportsurge trouve plein de liens pour la MLB, ça devrait pour les autres sports aussi,
   genre tous. TOUS les domaines, sauf OnHockey, couvrent tous les sports. Si tu trouves pas
   de liens pour un match, y'en a juste pas, mais tu les checks tous. » (6 septembre 2026)

   Mesuré ce jour-là : Sportsurge n'avait AUCUNE page soccer, F1, tennis ou golf dans sa
   liste (13 pages, 23 matchs, tous de baseball dans le cache) ; Streamed ne lisait 6 de
   ses 15 catégories ; VIPLeague répondait 404 sur ses trois miroirs (le site a déménagé
   sur vipleague.me, la grille sur /watch-now, les liens sous /now-playing/). */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://ouellettejeanphilippe-source.github.io/footy/' });
    const w = dom.window;
    w.__NO_AUTOSTART__ = true;
    for (const k of ['window', 'document', 'DOMParser', 'localStorage', 'navigator', 'HTMLElement', 'Event', 'CustomEvent', 'location', 'history', 'getComputedStyle']) {
        Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
    }
    globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    const cfg = await import('../js/config.js');
    const scrapers = await import('../js/scrapers.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };
    const sportsurge = cfg.SCRAPERS_CONFIG.find((s) => s.id === 'sportsurge');
    const streamed = cfg.SCRAPERS_CONFIG.find((s) => s.id === 'streamed');

    // ── 1. Les pages annoncées par l'accueil s'ajoutent à la liste connue ────
    const accueil = `<html><head><base href="https://v2.sportsurge.net/"></head><body><nav>
        <a href="watch-nfl-streams/">NFL</a> <a href="watch-soccer-streams/">Soccer</a>
        <a href='https://v2.sportsurge.net/watch-f1-streams/'>F1</a> <a href="watch-tennis-streams">Tennis</a>
        <a href="watch-golf-streams/">Golf</a> <a href="watch-cricket-streams/">Cricket</a>
        <a href="watch-63656-baseball-washington-nationals-los-angeles-dodgers-10/">un match, pas une page</a>
        </nav></body></html>`;
    const toutes = cfg.getSourcePages(sportsurge, null, accueil);
    const urls = toutes.map((p) => p.url);
    assert.ok(urls.includes('https://v2.sportsurge.net/watch-soccer-streams/'), 'la page soccer, absente de la liste connue, vient du menu');
    assert.ok(urls.includes('https://v2.sportsurge.net/watch-f1-streams/'), 'adresse absolue acceptée');
    assert.ok(urls.includes('https://v2.sportsurge.net/watch-tennis-streams'), 'sans barre finale aussi');
    assert.ok(urls.includes('https://v2.sportsurge.net/watch-golf-streams/'));
    assert.ok(urls.includes('https://v2.sportsurge.net/watch-cricket-streams/'));
    assert.strictEqual(urls.filter((u) => u === 'https://v2.sportsurge.net/watch-nfl-streams/').length, 1, 'une page connue ET annoncée ne se lit qu\'une fois');
    assert.ok(!urls.some((u) => /watch-63656/.test(u)), 'une page de match n\'est pas une page par sport');
    assert.strictEqual(toutes.find((p) => /soccer/.test(p.url)).sport, 'soccer', 'le sport se lit dans le nom de la page');
    assert.strictEqual(toutes.find((p) => /f1-streams/.test(p.url)).sport, 'f1');
    ok('Sportsurge : le menu de l\'accueil complète la liste des pages par sport');

    // ── 2. Sans accueil, ou sans `discoverPages`, rien ne change ─────────────
    assert.deepStrictEqual(cfg.getSourcePages(sportsurge, null).map((p) => p.url), cfg.getSourcePages(sportsurge, null, undefined).map((p) => p.url));
    assert.strictEqual(cfg.getSourcePages(streamed, null, accueil).length, cfg.getSourcePages(streamed, null).length, 'Streamed ne découvre rien : ses pages sont une API');
    ok('sans accueil ni découverte : liste connue seulement');

    // ── 3. Le filtre par sports du jour épargne les pages sans sport connu ───
    const jourMlb = cfg.getSourcePages(sportsurge, ['mlb'], accueil + '<a href="watch-xyzzy-streams/">?</a>').map((p) => p.url);
    assert.ok(jourMlb.includes('https://v2.sportsurge.net/watch-baseball-streams/'));
    assert.ok(!jourMlb.includes('https://v2.sportsurge.net/watch-soccer-streams/'), 'pas de soccer au programme : page sautée');
    assert.ok(jourMlb.includes('https://v2.sportsurge.net/watch-xyzzy-streams/'), 'sport inconnu : on lit quand même (« tu les checks tous »)');
    const streamedMlb = cfg.getSourcePages(streamed, ['mlb']).map((p) => p.url);
    assert.ok(streamedMlb.some((u) => /api\/matches\/darts/.test(u)), 'une page marquée other se lit quel que soit le programme');
    assert.ok(!streamedMlb.some((u) => /api\/matches\/tennis/.test(u)), 'tennis absent du programme : page sautée');
    ok('filtre par sports du jour : les pages sans sport connu se lisent toujours');

    // ── 4. Streamed : tout le catalogue (`api/sports`, relevé le 6 septembre 2026) ──
    const cat = ['basketball', 'football', 'american-football', 'hockey', 'baseball', 'motor-sports', 'fight', 'tennis', 'rugby', 'golf', 'billiards', 'afl', 'darts', 'cricket', 'other'];
    const pagesStreamed = cfg.getSourcePages(streamed, null).map((p) => p.url);
    cat.forEach((c) => assert.ok(pagesStreamed.some((u) => u.endsWith('api/matches/' + c)), 'catégorie Streamed manquante : ' + c));
    ok('Streamed : les 15 catégories du catalogue sont lues');

    // ── 5. VIPLeague : nouveau domaine, nouveau chemin, nouveaux liens ───────
    assert.ok(/^https:\/\/vipleague\.me\/watch-now$/.test(cfg.VIPLEAGUE_URL), 'VIPLEAGUE_URL : ' + cfg.VIPLEAGUE_URL);
    assert.ok(!cfg.SOURCE_MIRRORS.vipleague.some((u) => /live-now-streaming/.test(u)), '/live-now-streaming répond 404 partout');
    const vip = `<html><body><div>
      <a class="mb-1 btn" href="/now-playing/football/hamburg-sv-vs-mainz" title="Hamburg SV - Mainz"><span class="vipleague football"></span> <span content="2026-09-06T14:30" class="me-2">14:30</span> Hamburg SV - Mainz</a>
      <a class="mb-1 btn" href="/now-playing/ice-hockey/davos-vs-eisbaren-berlin" title="Davos - Eisbaren Berlin"><span content="2026-09-06T14:45">14:45</span> Davos - Eisbaren Berlin</a>
      <a href="/watch/basketball/a-vs-b" title="A - B"><span content="2026-09-06T15:00">15:00</span> A - B</a>
      <a href="/sport/tennis">Tennis</a> <a href="/watch-now">Now</a>
    </div></body></html>`;
    const vm = scrapers.parseVipleague(vip);
    assert.strictEqual(vm.length, 3, 'deux liens /now-playing/ et un ancien /watch/ : ' + vm.length);
    assert.ok(vm.some((m) => /hamburg-sv-vs-mainz/.test(m.matchUrl) && /Hamburg/i.test(m.homeTeam) && /Mainz/i.test(m.awayTeam)));
    assert.ok(vm.every((m) => /^https:\/\/vipleague\.me\//.test(m.matchUrl)), 'les adresses de match se résolvent sur le domaine courant : ' + vm.map((m) => m.matchUrl).join(' '));
    ok('VIPLeague : la grille de vipleague.me/watch-now se lit');

    console.log(`unit_sourcepages: ${n} groupes de tests OK`);
    process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

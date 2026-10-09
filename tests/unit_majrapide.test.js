/* Mise à jour plus rapide, et possible sans GitHub Actions (9 octobre 2026) :
   - reporterLiensNonRelus (js/config.js) : un match dont la page n'a pas été relue garde
     les liens du passage précédent, sauf quand son adresse est partagée (grille, API) ;
   - scrape_streams.mjs lit les sources en parallèle, a un mode --horizon ;
   - scripts/maj_liens.mjs (npm run liens) enchaîne les étapes sans GitHub.
   Sans réseau ni horloge. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

async function main() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/' });
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement']) {
    Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
  }
  dom.window.__NO_AUTOSTART__ = true;
  await import('../js/scrapers.js');
  const C = await import('../js/config.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  const publies = { matches: [
    { matchUrl: 'https://a.test/m/1', streamLinks: [{ url: 'https://p.test/1' }, { url: 'https://p.test/2' }] },
    { matchUrl: 'https://a.test/m/2', streamLinks: [{ url: 'https://p.test/3' }] },
    { matchUrl: 'https://grille.test/', streamLinks: [{ url: 'https://ch.test/1' }] },
    { matchUrl: 'https://grille.test/', streamLinks: [{ url: 'https://ch.test/2' }] },
  ] };
  const frais = [
    { matchUrl: 'https://a.test/m/1', streamLinks: [{ url: 'https://p.test/2' }] },
    { matchUrl: 'https://a.test/m/2', streamLinks: [] },
    { matchUrl: 'https://grille.test/', streamLinks: [{ url: 'https://ch.test/9' }] },
    { matchUrl: 'https://a.test/m/nouveau', streamLinks: [] },
  ];
  const n1 = C.reporterLiensNonRelus(frais, publies, { 'https://a.test/m/2': true });
  assert.deepStrictEqual(frais[0].streamLinks.map((l) => l.url), ['https://p.test/2', 'https://p.test/1'], 'non relu : les anciens liens reviennent, sans doublon');
  assert.deepStrictEqual(frais[1].streamLinks, [], 'relu : la page fait foi, rien n\'est reporté');
  assert.deepStrictEqual(frais[2].streamLinks.map((l) => l.url), ['https://ch.test/9'], 'adresse partagée : jamais de report');
  assert.strictEqual(n1, 1);
  assert.strictEqual(C.reporterLiensNonRelus(frais, null, {}), 0);
  assert.strictEqual(C.reporterLiensNonRelus(null, publies, {}), 0);
  ok('reporterLiensNonRelus : les pages non relues gardent leurs liens, les grilles partagées jamais');

  {
    const M = await import('../js/match.js');
    const mk = (o) => Object.assign({ league: 'Premier League', matchDate: '2026-10-09', startTime: '15:00', streamLinks: [] }, o);
    // Beaucoup de matchs portant « Live » : ils ne doivent plus être tous comparés.
    let all = [];
    for (let i = 0; i < 50; i++) all.push(mk({ homeTeam: 'Equipe' + i + ' Live', awayTeam: 'Rival' + i + ' Live' }));
    all = M.mergeMatches(all, [mk({ homeTeam: 'Manchester United', awayTeam: 'Liverpool', streamLinks: [{ url: 'https://a.test/1' }] })]);
    all = M.mergeMatches(all, [mk({ homeTeam: 'Manchester United', awayTeam: 'Liverpool', streamLinks: [{ url: 'https://b.test/2' }] })]);
    const mu = all.filter((m) => /manchester/i.test(m.homeTeam));
    assert.strictEqual(mu.length, 1, 'le même match venu de deux sources est fusionné');
    assert.deepStrictEqual(mu[0].streamLinks.map((l) => l.url), ['https://a.test/1', 'https://b.test/2']);
    ok('mergeMatches indexé : fusion intacte, mots sans équipe hors de l\'index');
  }

  const scrape = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'scrape_streams.mjs'), 'utf8');
  assert.ok(/Promise\.all\(sourcesActives\(\)\.map\(lireUneSource\)\)/.test(scrape), 'les sources sont lues en parallèle');
  assert.ok(/--horizon/.test(scrape) && /reporterLiensNonRelus\(out\.matches, precedent, pagesRelues\)/.test(scrape), 'mode rapide branché');
  assert.ok(/const CONCURRENCY = (\d+)/.exec(scrape)[1] >= 12, 'plus de six pages de match en vol');
  assert.ok(/parHote: 2/.test(scrape), 'la politesse par hôte reste en place');
  ok('scrape_streams : sources en parallèle, mode --horizon, régulation par hôte intacte');

  {
    /* jsdom 27 à 29 RETIENT chaque document analysé (~6 Mo pour une page de 700 Ko, même
       après ramasse-miettes) ; mesuré le 9 octobre 2026 : 377 Mo pour 60 pages en 29.1.1,
       3 Mo en 26.1.0. Le passage serveur lit ~900 pages : il saturait son tas de 8 Go et
       se figeait. Ne pas monter de version sans refaire la mesure. */
    const p = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    const majeure = parseInt(String(p.devDependencies.jsdom).replace(/^[^0-9]*/, ''), 10);
    assert.ok(majeure <= 26, 'jsdom ' + p.devDependencies.jsdom + ' : les versions 27 à 29 fuient (voir le commentaire)');
    ok('jsdom reste sur une version qui libère ses documents');
  }

  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.strictEqual(pkg.scripts.liens, 'node scripts/maj_liens.mjs');
  const maj = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'maj_liens.mjs'), 'utf8');
  for (const etape of ['scrape_schedule.mjs', 'scrape_streams.mjs', 'verify_players.mjs', '--rapide', '--publier', '--max-old-space-size=8192']) {
    assert.ok(maj.includes(etape), 'maj_liens.mjs : ' + etape);
  }
  ok('npm run liens enchaîne calendrier, liens, vérification, publication facultative');

  console.log(`unit_majrapide : ${n} groupes OK`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

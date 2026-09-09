/* Passe PARTIELLE des liens (scripts/scrape_streams.mjs, règles dans js/config.js).

   Relevé le 9 septembre 2026 : le script serveur écrivait data/streams.json sans aucun
   garde-fou. Trois sources sur onze étaient déjà en échec (403 Cloudflare selon
   l'adresse du runner) ; si les onze tombaient ensemble, un fichier VIDE était commité
   et servi à tous les appareils, à la place de 1,1 Mo de liens encore bons. Et une
   source muette perdait tous ses liens publiés, alors qu'ils valent des heures.

   Le calendrier (scripts/scrape_schedule.mjs) avait déjà les deux règles ; les liens
   les reçoivent ici :
     - aucune source vivante → le fichier n'est pas touché (décidé dans le script, sur
       `sourcesReport.some(s => s.ok)`) ;
     - `conserverSourcesMuettes` : les matchs des sources muettes sont repris du
       fichier publié, sans doublon, à partir de la veille ; les sources qui ont
       répondu font foi. */
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

  const rap = (id, okFlag) => ({ id, ok: okFlag, matches: okFlag ? 3 : 0 });
  const m = (source, url, extra) => Object.assign({ source, matchUrl: url, homeTeam: 'A', awayTeam: 'B', matchDate: '2026-09-09', streamLinks: [{ url: url + '#1' }] }, extra || {});

  // ── 1. Toutes les sources ont répondu : rien n'est repris du fichier publié ──
  {
    const frais = [m('footybite', 'https://f.test/1')];
    const publies = { matches: [m('footybite', 'https://f.test/vieux'), m('streameast', 'https://s.test/vieux')] };
    const r = C.conserverSourcesMuettes(frais, publies, [rap('footybite', true), rap('streameast', true)], '2026-09-08');
    assert.deepStrictEqual(r.matches, frais);
    assert.strictEqual(r.conserves, 0);
    ok('une passe complète élague : les sources qui ont répondu font foi');
  }

  // ── 2. Une source muette garde ses liens publiés ─────────────────────────
  {
    const frais = [m('footybite', 'https://f.test/1')];
    const publies = { matches: [m('footybite', 'https://f.test/vieux'), m('streameast', 'https://s.test/1'), m('streameast', 'https://s.test/2')] };
    const r = C.conserverSourcesMuettes(frais, publies, [rap('footybite', true), rap('streameast', false)], '2026-09-08');
    assert.strictEqual(r.conserves, 2);
    assert.strictEqual(r.matches.length, 3);
    assert.ok(!r.matches.some((x) => x.matchUrl === 'https://f.test/vieux'), 'la source qui a répondu a élagué son vieux match');
    assert.ok(r.matches.some((x) => x.matchUrl === 'https://s.test/2'), 'la source muette a gardé ses matchs');
    assert.deepStrictEqual(r.matches[1].streamLinks, [{ url: 'https://s.test/1#1' }], 'avec leurs liens');
    ok('une source muette conserve ses matchs publiés, liens compris');
  }

  // ── 3. Sans doublon : un match déjà frais n'est pas repris ───────────────
  {
    const frais = [m('streameast', 'https://s.test/1')];
    const publies = { matches: [m('streameast', 'https://s.test/1')] };
    const r = C.conserverSourcesMuettes(frais, publies, [rap('streameast', false)], '2026-09-08');
    assert.strictEqual(r.conserves, 0);
    assert.strictEqual(r.matches.length, 1);
    ok('un match déjà présent n\'est pas doublé');
  }

  // ── 4. La veille compte, avant non ──────────────────────────────────────
  {
    const publies = { matches: [
      m('streameast', 'https://s.test/hier', { matchDate: '2026-09-08' }),
      m('streameast', 'https://s.test/vieux', { matchDate: '2026-09-01' }),
      m('streameast', 'https://s.test/aberrant', { matchDate: '2016-12-01' }),
      m('streameast', 'https://s.test/sansdate', { matchDate: '' })
    ] };
    const r = C.conserverSourcesMuettes([], publies, [rap('streameast', false)], '2026-09-08');
    assert.deepStrictEqual(r.matches.map((x) => x.matchUrl), ['https://s.test/hier', 'https://s.test/sansdate']);
    ok('la nuit appartient à la journée : la veille est reprise, pas ce qui précède');
  }

  // ── 5. Entrées absentes ou malformées : pas d'exception ──────────────────
  {
    const frais = [m('footybite', 'https://f.test/1')];
    assert.deepStrictEqual(C.conserverSourcesMuettes(frais, null, [rap('streameast', false)], '2026-09-08').matches, frais);
    assert.deepStrictEqual(C.conserverSourcesMuettes(frais, {}, [rap('streameast', false)], '2026-09-08').matches, frais);
    assert.deepStrictEqual(C.conserverSourcesMuettes(frais, { matches: [null, {}] }, [rap('streameast', false)], '2026-09-08').matches, frais);
    assert.deepStrictEqual(C.conserverSourcesMuettes(frais, { matches: [m('streameast', 'x')] }, null, '2026-09-08').matches, frais);
    ok('fichier publié absent, vide ou malformé : les liens frais passent tels quels');
  }

  console.log(`unit_passepartielleliens: ${n} groupes de tests OK`);
  process.exit(0);   // config.js arme des minuteries sous jsdom : sans cela, le processus ne rend pas la main
}

main().catch((e) => { console.error(e); process.exit(1); });

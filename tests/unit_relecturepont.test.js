/* La relecture des pages annexes d'un match depuis le navigateur (js/scrapers.js,
   pagesAnnexesARelire), 26 octobre 2026 : « ya pas moyen que l'application en direct du
   browser humain trouve les liens ? » Elle le fait ; mesuré en réseau réel, elle ramenait
   surtout du bruit (le point d'API de bintv lu comme une page de match : 243 chaînes) et
   refusait d'office les pages Streameast, que la page principale tente pourtant déjà par
   le pont. Rien ici ne dépend du réseau. */
const assert = require('assert');
const { JSDOM, VirtualConsole } = require('jsdom');

async function main() {
  const dom = new JSDOM('<!doctype html><html><body><div id="toast"><span id="toasttxt"></span></div></body></html>', { url: 'https://exemple.test/app/', virtualConsole: new VirtualConsole() });
  dom.window.__NO_AUTOSTART__ = true;
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement', 'Event', 'CustomEvent', 'location', 'history', 'getComputedStyle'])
    Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
  globalThis.fetch = () => Promise.reject(new Error('réseau coupé'));
  const sc = await import('../js/scrapers.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  const m = { altUrls: [
    'https://footybite.im/game/barcelona-vs-real-madrid-1',
    'https://bintvjson.lovable.app/api/public/bintvjson',
    'https://www.streameast.fi/nfl/nfl-redzone-29/',
    'https://methstreams.st/event/barcelona-vs-real-madrid',
    'https://api.ppv.tj/api/streams',
    'https://vipleague.vg/now-playing/football/atlas-vs-puebla',
    'https://olympiclive.me/live-atlas-vs-puebla-stream',
    'https://fbstream.st/match/1',
  ] };
  assert.deepStrictEqual(sc.pagesAnnexesARelire(m, false), [
    'https://footybite.im/game/barcelona-vs-real-madrid-1',
    'https://methstreams.st/event/barcelona-vs-real-madrid',
    'https://vipleague.vg/now-playing/football/atlas-vs-puebla',
    'https://olympiclive.me/live-atlas-vs-puebla-stream',
  ], 'sans le pont : ni point d\'API, ni page bloquée, quatre au plus');
  assert.deepStrictEqual(sc.pagesAnnexesARelire(m, true), [
    'https://footybite.im/game/barcelona-vs-real-madrid-1',
    'https://www.streameast.fi/nfl/nfl-redzone-29/',
    'https://methstreams.st/event/barcelona-vs-real-madrid',
    'https://vipleague.vg/now-playing/football/atlas-vs-puebla',
  ], 'avec le pont : la page Streameast est relue depuis l\'adresse de l\'utilisateur');
  assert.deepStrictEqual(sc.pagesAnnexesARelire({}, true), []);
  assert.deepStrictEqual(sc.pagesAnnexesARelire({ altUrls: [null, 'https://api.x.test/api/v1'] }, true), []);
  ok('pagesAnnexesARelire : points d\'API ignorés, pages bloquées seulement par le pont, quatre au plus');

  console.log('\n' + n + ' cas passés.');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

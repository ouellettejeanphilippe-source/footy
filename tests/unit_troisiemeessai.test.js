/* Lecture de data/streams.json : deux essais frais, puis le cache du navigateur.

   « Je reload les streams sont là. Je reload, c'est vide. » (7 septembre 2026) Le
   symptôme change d'un rechargement à l'autre SUR LE MÊME APPAREIL : ce n'est donc pas
   le réseau de l'appareil en général, c'est qu'un démarrage à froid n'avait AUCUN repli.

   Les deux premiers essais demandent exprès une copie fraîche (`?t=` unique et
   `cache: 'no-cache'`), ce qui interdit au cache HTTP comme au service worker de
   répondre ; et la copie gardée en mémoire est vide au démarrage, puisque c'est une
   variable de module. Deux téléchargements ratés d'affilée donnaient donc zéro lien, là
   où le navigateur avait une copie sous la main.

   Le troisième essai demande la même adresse SANS paramètre et sans rien interdire : le
   service worker (réseau d'abord, cache en repli) ou le cache HTTP répond. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

const CACHE = {
  generatedAt: new Date().toISOString(),
  matches: [
    { id: 'a', homeTeam: 'A', awayTeam: 'B', league: 'MLB', matchUrl: 'https://s.test/a',
      streamLinks: [{ url: 'https://lecteur.test/1', name: 'Flux 1' }] },
    { id: 'b', homeTeam: 'C', awayTeam: 'D', league: 'NHL', matchUrl: 'https://s.test/b',
      streamLinks: [{ url: 'https://lecteur.test/2', name: 'Flux 2' }] }
  ],
  sources: [], hostPolicy: {}, hostPlay: {}
};

async function main() {
  const dom = new JSDOM('<!doctype html><html><body><div id="marea"></div></body></html>',
                        { url: 'https://exemple.test/' });
  const w = dom.window;
  w.__NO_AUTOSTART__ = true;
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement', 'Event', 'CustomEvent', 'location', 'history', 'getComputedStyle'])
    Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

  const main = await import('../js/main.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  // ── 1. Deux téléchargements ratés, puis le cache du navigateur ─────────────
  const appels = [];
  globalThis.fetch = (url, options) => {
    appels.push({ url: String(url), noCache: !!(options && options.cache === 'no-cache') });
    if (appels.length <= 2) return Promise.reject(new Error('réseau coupé'));
    return Promise.resolve({ ok: true, json: () => Promise.resolve(CACHE) });
  };

  const liste = await main.loadPrefetchedStreams(true);
  assert.strictEqual(appels.length, 3, 'trois essais, pas deux : ' + appels.map((a) => a.url).join(' | '));
  assert.ok(/\?t=/.test(appels[0].url) && appels[0].noCache, 'essai 1 : copie fraîche imposée');
  assert.ok(/\?t=/.test(appels[1].url) && appels[1].noCache, 'essai 2 : copie fraîche imposée');
  assert.strictEqual(appels[2].url, 'data/streams.json',
    'essai 3 : la même adresse SANS paramètre, pour que le service worker ou le cache HTTP puisse répondre');
  assert.strictEqual(appels[2].noCache, false, 'essai 3 : on n\'interdit plus le cache — c\'est tout l\'intérêt');
  assert.strictEqual(liste.length, 2, 'les liens sont là malgré deux téléchargements ratés');
  assert.strictEqual(w.prefetchedStreamsError, null, 'ce n\'est pas un échec : les cartes ne portent pas ⚠');
  ok('deux téléchargements ratés d\'affilée ne donnent plus zéro lien : le cache du navigateur répond');

  // ── 2. Le premier essai qui réussit ne coûte rien de plus ──────────────────
  appels.length = 0;
  globalThis.fetch = (url, options) => {
    appels.push({ url: String(url), noCache: !!(options && options.cache === 'no-cache') });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(CACHE) });
  };
  const liste2 = await main.loadPrefetchedStreams(true);
  assert.strictEqual(appels.length, 1, 'un seul aller-retour quand il aboutit');
  assert.strictEqual(liste2.length, 2);
  ok('le chemin normal reste à un seul aller-retour');

  // ── 3. Les trois essais en échec : on le DIT, plutôt que de faire semblant ─
  appels.length = 0;
  globalThis.fetch = (url) => { appels.push(String(url)); return Promise.reject(new Error('réseau coupé')); };
  await main.loadPrefetchedStreams(true);
  assert.strictEqual(appels.length, 3, 'les trois essais sont tentés');
  assert.ok(w.prefetchedStreamsError, 'l\'échec est retenu : les cartes portent ⚠ et la page Logs le dit');
  ok('quand même le cache du navigateur est muet, l\'échec est signalé');

  console.log(`unit_troisiemeessai: ${n} groupes de tests OK`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

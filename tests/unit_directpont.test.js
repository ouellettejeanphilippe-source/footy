/* Le mode direct passe par le pont du script utilisateur (js/directmedia.js,
   js/embed-bridge.js).

   « Le bouton direct, ça marche avec AUCUN SITE » (18 octobre 2026). Mesuré le jour même :
   les CDN de ces flux ne répondent `Access-Control-Allow-Origin` qu'à l'origine de leur
   propre lecteur, et plusieurs refusent un `Referer` qui n'est pas le leur. hls.js, lancé
   depuis l'application, se voyait refuser le manifeste par le navigateur
   (`manifestLoadError`, code 0) sur chaque site. Le chargeur `chargeurParPont` fait passer
   manifestes et segments par GM_xmlhttpRequest, avec le `Referer` du lecteur.

   Ce que ces cas verrouillent :
   1. Le `Referer` : celui relevé par le serveur, sinon l'origine du cadre du lecteur.
   2. Le chargeur suit le contrat de hls.js : texte pour un manifeste, octets pour un
      segment, plage d'octets, erreur avec son code, délai, abandon, réponse périmée.
   3. Le pont de l'application : lecture binaire demandée au script, refusée sans lui. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://exemple.test/app/' });
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement', 'CustomEvent'])
    Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });

  const dm = await import('../js/directmedia.js');
  const pont = await import('../js/embed-bridge.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };
  const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

  // ── 1. Le Referer du lecteur ───────────────────────────────────────────────
  assert.strictEqual(dm.refererPourDirect({ referer: 'https://dembed.st/', pageUrl: 'https://dlive.sx/watch.php?id=19' }), 'https://dembed.st/',
    'le Referer relevé par la vérification du serveur, sur la requête même, l\'emporte');
  assert.strictEqual(dm.refererPourDirect({ pageUrl: 'https://streame.center/embed/hls2.php?stream=abc' }), 'https://streame.center/',
    'sinon le cadre du lecteur, réduit à son origine comme le fait le navigateur');
  assert.strictEqual(dm.refererPourDirect({ pageUrl: 'about:blank' }), '');
  assert.strictEqual(dm.refererPourDirect({}), '');
  assert.strictEqual(dm.refererPourDirect(null), '');
  assert.strictEqual(dm.origineDe('https://streame.center/'), 'https://streame.center');
  ok('le Referer est celui du lecteur');

  // ── 2. Le chargeur, au contrat de hls.js ───────────────────────────────────
  const appels = [];
  let reponse = null;
  const lire = (url, o) => { appels.push({ url, o }); return reponse(url, o); };
  const Chargeur = dm.chargeurParPont(lire, { referer: 'https://streame.center/' });
  const charger = (context, config) => new Promise((resolve) => {
    const c = new Chargeur({});
    c.load(context, config || { timeout: 1000 }, {
      onSuccess: (r, stats, ctx) => resolve({ quoi: 'ok', r, stats, ctx, c }),
      onError: (e, ctx, nd, stats) => resolve({ quoi: 'erreur', e, stats, c }),
      onTimeout: (stats) => resolve({ quoi: 'delai', stats, c })
    });
    if (context.abandon) { c.abort(); setTimeout(() => resolve({ quoi: 'rien', c }), 50); }
  });
  const texte = '#EXTM3U\n#EXT-X-TARGETDURATION:4\nseg-1.ts\n';

  reponse = () => Promise.resolve({ octets: new TextEncoder().encode(texte).buffer, status: 200, finalUrl: 'https://cdn.test/hls/index.m3u8' });
  let r = await charger({ url: 'https://cdn.test/hls/index.m3u8', responseType: '' });
  assert.strictEqual(r.quoi, 'ok');
  assert.strictEqual(r.r.data, texte, 'un manifeste est rendu en texte');
  assert.strictEqual(r.r.url, 'https://cdn.test/hls/index.m3u8', 'avec l\'adresse finale, base des adresses relatives');
  assert.strictEqual(appels[0].o.referer, 'https://streame.center/');
  assert.strictEqual(appels[0].o.origine, 'https://streame.center', 'et l\'Origin du lecteur, déduite du Referer');
  assert.strictEqual(appels[0].o.plage, '');
  assert.ok(r.stats.loading.start > 0 && r.stats.loading.end >= r.stats.loading.start, 'les temps de chargement sont posés (estimation du débit)');
  assert.strictEqual(r.stats.loaded, texte.length);

  reponse = () => Promise.resolve({ octets: new Uint8Array([0x47, 1, 2, 3]).buffer, status: 206 });
  r = await charger({ url: 'https://cdn.test/hls/seg-1.ts', responseType: 'arraybuffer', rangeStart: 100, rangeEnd: 200 });
  assert.ok(r.r.data instanceof ArrayBuffer, 'un segment est rendu en octets');
  assert.deepStrictEqual(Array.from(new Uint8Array(r.r.data)), [0x47, 1, 2, 3]);
  assert.strictEqual(appels[1].o.plage, 'bytes=100-199', 'la plage d\'octets demandée par hls.js (fin exclue)');
  ok('manifeste en texte, segment en octets, plage, Referer et Origin');

  reponse = () => Promise.reject(Object.assign(new Error('HTTP 403'), { status: 403 }));
  r = await charger({ url: 'https://cdn.test/hls/index.m3u8', responseType: '' });
  assert.strictEqual(r.quoi, 'erreur');
  assert.strictEqual(r.e.code, 403, 'le code HTTP remonte à hls.js, qui décide de réessayer ou non');

  reponse = () => Promise.reject(Object.assign(new Error('delai depasse'), { delai: true }));
  r = await charger({ url: 'https://cdn.test/hls/index.m3u8', responseType: '' });
  assert.strictEqual(r.quoi, 'delai', 'un délai du script est un délai pour hls.js');

  reponse = () => new Promise(() => {});
  r = await charger({ url: 'https://cdn.test/hls/index.m3u8', responseType: '' }, { loadPolicy: { maxLoadTimeMs: 30 } });
  assert.strictEqual(r.quoi, 'delai', 'un script muet ne bloque pas le chargeur : son propre délai joue');
  ok('erreur, délai du script et script muet');

  let tardive = null;
  reponse = () => new Promise((res) => { tardive = res; });
  r = await charger({ url: 'https://cdn.test/hls/seg-2.ts', responseType: 'arraybuffer', abandon: true });
  assert.strictEqual(r.quoi, 'rien');
  assert.strictEqual(r.c.stats.aborted, true);
  tardive({ octets: new ArrayBuffer(4), status: 200 });
  await attendre(10);
  ok('un chargement abandonné ne rappelle plus hls.js');

  /* Un chargeur relancé : la réponse du premier essai, arrivée après, ne clôt pas le second. */
  const promesses = [];
  reponse = () => new Promise((res) => promesses.push(res));
  const c = new Chargeur({});
  const vus = [];
  const rappels = { onSuccess: (rep) => vus.push(rep.data), onError: () => vus.push('erreur'), onTimeout: () => vus.push('delai') };
  c.load({ url: 'https://cdn.test/a.m3u8', responseType: '' }, { timeout: 1000 }, rappels);
  c.abort();
  c.load({ url: 'https://cdn.test/a.m3u8', responseType: '' }, { timeout: 1000 }, rappels);
  promesses[0]({ octets: new TextEncoder().encode('vieux').buffer, status: 200 });
  await attendre(5);
  assert.deepStrictEqual(vus, [], 'la réponse périmée est ignorée');
  promesses[1]({ octets: new TextEncoder().encode('neuf').buffer, status: 200 });
  await attendre(5);
  assert.deepStrictEqual(vus, ['neuf']);
  c.destroy();
  ok('une réponse périmée ne clôt pas un chargement relancé');

  // ── 3. Le pont de l'application ────────────────────────────────────────────
  /* jsdom ne remplit pas `source` : le faux script répond à tout message du pont. */
  const demandes = [];
  let binaireAnnonce = false;
  dom.window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || !d.__mvBridge) return;
    if (d.__mvBridge === 'mv_bridge_hello') dom.window.postMessage({ __mvBridge: 'mv_bridge_ready', version: '1.14', binaire: binaireAnnonce }, '*');
    if (d.__mvBridge === 'mv_bridge_fetch' && d.binaire) {
      demandes.push(d);
      if (/refus/.test(d.url)) dom.window.postMessage({ __mvBridge: 'mv_bridge_page', id: d.id, ok: false, binaire: true, status: 403, error: 'HTTP 403' }, '*');
      else dom.window.postMessage({ __mvBridge: 'mv_bridge_page', id: d.id, ok: true, binaire: true, octets: new Uint8Array([9, 8]).buffer, status: 200, finalUrl: d.url }, '*');
    }
  });
  pont.initEmbedBridge();
  await pont.waitForBridge(2000);
  assert.strictEqual(pont.getBridgeStatus().binaire, false, 'un script qui ne l\'annonce pas ne lit pas en binaire');
  await assert.rejects(pont.lireOctetsViaPont('https://cdn.test/a.ts', {}), /binaire/, 'et on ne le lui demande pas');
  assert.strictEqual(demandes.length, 0);

  binaireAnnonce = true;
  dom.window.postMessage({ __mvBridge: 'mv_bridge_hello' }, '*');
  await attendre(20);
  assert.strictEqual(pont.getBridgeStatus().binaire, true);
  const lu = await pont.lireOctetsViaPont('https://cdn.test/a.ts', { referer: 'https://streame.center/', origine: 'https://streame.center', plage: 'bytes=0-9', timeoutMs: 5000 });
  assert.deepStrictEqual(Array.from(new Uint8Array(lu.octets)), [9, 8]);
  assert.strictEqual(lu.status, 200);
  assert.strictEqual(demandes[0].referer, 'https://streame.center/');
  assert.strictEqual(demandes[0].origine, 'https://streame.center');
  assert.strictEqual(demandes[0].plage, 'bytes=0-9');
  await assert.rejects(pont.lireOctetsViaPont('https://cdn.test/refus.ts', {}), (e) => e.status === 403);
  ok('le pont demande la lecture binaire au script, avec le Referer, et seulement s\'il la sait faire');

  console.log(`unit_directpont: ${n} groupes de tests OK`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

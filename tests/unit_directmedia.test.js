/* Lecture directe des flux vidéo bruts (js/multiview.js).

   Signalé à l'usage : « le flux brut charge jamais quand je les prends ». La cause est
   nette une fois cherchée : `js/extractors.js` reconnaît une adresse `.m3u8` comme un
   candidat PLUS FORT qu'un simple lien d'iframe (60 points contre 45 — voir
   js/extractors.js), donc l'extraction la remonte volontiers. Mais rien, ensuite, ne la
   traitait différemment de n'importe quelle page : le code la posait en `iframe.src`, et
   un navigateur ne joue pas du HLS ou du MP4 brut dans un cadre. La tuile restait noire,
   sans erreur ni bandeau — un flux qui EXISTE et ne s'affiche jamais.

   C'est aussi une réponse au « sandbox toujours cassé » signalé en parallèle : un
   `<video>` natif n'encadre rien, il n'y a donc ni X-Frame-Options à respecter ni bac à
   sable à poser — pour ces adresses-là, le problème du bac à sable ne se pose plus. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://exemple.test/' });
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement'])
    Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
  const mv = await import('../js/multiview.js');
  const dm = await import('../js/directmedia.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  // ── 1. Les formats vidéo bruts sont reconnus ──────────────────────────────────
  for (const u of [
    'https://cdn.exemple.test/live/chunk.m3u8',
    'https://cdn.exemple.test/live/chunk.m3u8?token=abc123',
    'https://cdn.exemple.test/video.mp4',
    'https://cdn.exemple.test/video.webm#t=10',
    'https://cdn.exemple.test/clip.mov',
    'https://cdn.exemple.test/clip.m4v?x=1',
  ]) {
    assert.strictEqual(mv.estMediaDirecte(u), true, u + ' devrait être reconnu comme média direct');
  }
  ok('.m3u8, .mp4, .webm, .mov, .m4v sont reconnus, avec ou sans requête/ancre');

  // ── 2. Une page ordinaire, ou une adresse d'iframe, n'est pas confondue ───────
  for (const u of [
    'https://embed.exemple.test/live/embed.php?ch=es50',
    'https://exemple.test/match/equipe-a-vs-equipe-b',
    'https://exemple.test/player.html?src=video.m3u8ish', // ne se termine pas par l'extension
    '', null, undefined,
  ]) {
    assert.strictEqual(mv.estMediaDirecte(u), false, String(u) + ' ne doit pas être pris pour un média direct');
  }
  ok('une page d\'intégration ordinaire n\'est jamais prise pour un flux direct');

  // ── 3. La détection est insensible à la casse ─────────────────────────────────
  assert.strictEqual(mv.estMediaDirecte('https://cdn.exemple.test/live/CHUNK.M3U8'), true);
  ok('la détection ignore la casse de l\'extension');

  // ── Mode direct : le manifeste vu par le script, retenu par lien ─────────────
  /* « Une deuxième façon d'utiliser un lien, qu'on pourrait aussi avoir en mode normal,
     pour avoir les deux options » (6 septembre 2026). */
  assert.strictEqual(dm.estManifeste('https://cdn.exemple.test/live/master.m3u8?token=x'), true);
  assert.strictEqual(dm.estManifeste('https://cdn.exemple.test/live/index.mpd'), true);
  assert.strictEqual(dm.estManifeste('https://cdn.exemple.test/live/seg-12.ts'), false, 'un segment n\'est pas un manifeste');
  assert.strictEqual(dm.estManifeste('https://cdn.jsdelivr.net/npm/@swarmcloud/hls@latest/p2p-engine.min.js'), false);
  assert.strictEqual(dm.estManifeste('https://pub.exemple.test/ads/preroll.m3u8'), false, 'un manifeste publicitaire n\'est pas le flux');
  assert.strictEqual(dm.estManifeste('blob:https://x.test/abc'), false);
  ok('estManifeste : .m3u8/.mpd sur le chemin, ni segment, ni script, ni publicité');

  const T = 1800000000000;
  let reg = dm.retenirMediaDirect({}, 'https://site.test/game/a', { url: 'https://cdn.test/a/master.m3u8', pageUrl: 'https://site.test/game/a' }, T);
  assert.deepStrictEqual(Object.keys(reg), ['https://site.test/game/a']);
  assert.strictEqual(dm.mediaDirectPour(reg, 'https://site.test/game/a', T + 60000).url, 'https://cdn.test/a/master.m3u8');
  assert.strictEqual(dm.mediaDirectPour(reg, 'https://site.test/game/b', T), null, 'lien inconnu : rien');
  assert.strictEqual(dm.mediaDirectPour(reg, 'https://site.test/game/a', T + dm.MEDIA_DIRECT_TTL_MS + 1), null, 'périmé après le TTL');
  reg = dm.retenirMediaDirect(reg, 'https://site.test/game/b', { url: 'https://cdn.test/b.m3u8' }, T + dm.MEDIA_DIRECT_TTL_MS + 1);
  assert.deepStrictEqual(Object.keys(reg), ['https://site.test/game/b'], 'retenir un nouveau lien purge les périmés');
  reg = dm.retenirMediaDirect(reg, 'https://site.test/game/c', { url: 'https://cdn.test/c/seg.ts' }, T);
  assert.strictEqual(reg['https://site.test/game/c'], undefined, 'un non-manifeste n\'est pas retenu');
  ok('registre par lien : retenu, retrouvé, périmé après 3 h');

  const T2 = T + dm.MEDIA_DIRECT_TTL_MS + 2;
  assert.strictEqual(dm.aProposer(dm.mediaDirectPour(reg, 'https://site.test/game/b', T2)), true);
  dm.noterEchecDirect(reg, 'https://site.test/game/b');
  assert.strictEqual(dm.aProposer(dm.mediaDirectPour(reg, 'https://site.test/game/b', T2)), true, 'un échec : on propose encore');
  dm.noterEchecDirect(reg, 'https://site.test/game/b');
  assert.strictEqual(dm.aProposer(dm.mediaDirectPour(reg, 'https://site.test/game/b', T2)), false, 'deux échecs : plus proposé d\'office');
  reg = dm.retenirMediaDirect(reg, 'https://site.test/game/b', { url: 'https://cdn.test/b2.m3u8' }, T2);
  assert.strictEqual(reg['https://site.test/game/b'].echecs, 0, 'un nouveau manifeste repart à zéro');
  ok('échecs comptés par lien ; un nouveau manifeste remet le compteur à zéro');

  console.log('\n' + n + ' groupes OK — détection des flux vidéo directs');
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });

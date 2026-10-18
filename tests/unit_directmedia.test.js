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
  /* L'adresse de ce registre n'a AUCUN jeton : rien ne la fait expirer côté serveur,
     et elle tient donc le temps de l'événement (MEDIA_DIRECT_TTL_LONG_MS). Ce test
     affirmait l'inverse -- trois heures pour tout le monde -- alors que sur 36 adresses
     réellement observées le 26 septembre 2026, 29 n'avaient aucun jeton. Les oublier
     aussi vite n'obéissait à aucune contrainte : c'était nous qui les jetions, et ça se
     payait surtout sur téléphone, où le mode direct est la seule voie propre. */
  assert.strictEqual(dm.mediaDirectPour(reg, 'https://site.test/game/a', T + dm.MEDIA_DIRECT_TTL_MS + 1).url,
    'https://cdn.test/a/master.m3u8', 'une adresse SANS jeton survit aux trois heures');
  assert.strictEqual(dm.mediaDirectPour(reg, 'https://site.test/game/a', T + dm.MEDIA_DIRECT_TTL_LONG_MS + 1), null,
    "mais pas au-dela du temps d'un evenement");

  /* Une adresse SIGNÉE, elle, porte sa propre péremption : on ne la garde pas plus
     longtemps que le serveur ne l'honore. `?st=…&e=…` est la forme observée chez
     embedme.st et streame.center, `?s=…&e=…` chez dlive.sx. */
  const signee = 'https://cdn.test/a/master.m3u8?st=jeton&e=1790465398';
  assert.strictEqual(dm.adresseSignee(signee), true);
  assert.strictEqual(dm.adresseSignee('https://cdn.test/a/master.m3u8'), false);
  assert.strictEqual(dm.dureeDeVie(signee), dm.MEDIA_DIRECT_TTL_MS);
  assert.strictEqual(dm.dureeDeVie('https://cdn.test/a/master.m3u8'), dm.MEDIA_DIRECT_TTL_LONG_MS);
  let regS = dm.retenirMediaDirect({}, 'https://site.test/game/s', { url: signee, pageUrl: 'https://site.test/game/s' }, T);
  assert.ok(dm.mediaDirectPour(regS, 'https://site.test/game/s', T + 60000), 'fraîche : gardée');
  assert.strictEqual(dm.mediaDirectPour(regS, 'https://site.test/game/s', T + dm.MEDIA_DIRECT_TTL_MS + 1), null,
    'signée : périmée après trois heures');
  // La purge se juge sur la duree de CHAQUE entree : 'a' est une adresse nue, donc
  // il faut depasser la duree longue pour qu'elle tombe.
  reg = dm.retenirMediaDirect(reg, 'https://site.test/game/b', { url: 'https://cdn.test/b.m3u8' }, T + dm.MEDIA_DIRECT_TTL_LONG_MS + 1);
  assert.deepStrictEqual(Object.keys(reg), ['https://site.test/game/b'], 'retenir un nouveau lien purge les périmés');
  reg = dm.retenirMediaDirect(reg, 'https://site.test/game/c', { url: 'https://cdn.test/c/seg.ts' }, T);
  assert.strictEqual(reg['https://site.test/game/c'], undefined, 'un non-manifeste n\'est pas retenu');
  ok("registre par lien : retenu, retrouvé, périmé selon que l'adresse est signée ou non");

  const T2 = T + dm.MEDIA_DIRECT_TTL_LONG_MS + 2;
  assert.strictEqual(dm.aProposer(dm.mediaDirectPour(reg, 'https://site.test/game/b', T2)), true);
  dm.noterEchecDirect(reg, 'https://site.test/game/b');
  assert.strictEqual(dm.aProposer(dm.mediaDirectPour(reg, 'https://site.test/game/b', T2)), true, 'un échec : on propose encore');
  dm.noterEchecDirect(reg, 'https://site.test/game/b');
  assert.strictEqual(dm.aProposer(dm.mediaDirectPour(reg, 'https://site.test/game/b', T2)), false, 'deux échecs : plus proposé d\'office');
  reg = dm.retenirMediaDirect(reg, 'https://site.test/game/b', { url: 'https://cdn.test/b2.m3u8' }, T2);
  assert.strictEqual(reg['https://site.test/game/b'].echecs, 0, 'un nouveau manifeste repart à zéro');
  ok('échecs comptés par lien ; un nouveau manifeste remet le compteur à zéro');

  /* « Le direct marche jamais » (18 octobre 2026) : un jeton dans le CHEMIN, expiré à
     l'heure qu'il porte, restait proposé douze heures. */
  const signe = 'https://judiaslevels.embeds.gay/main/secure/8ae2123fc337aeff654a938be8173e35804c14a558e37b830bb0fb4977ccdbb8/1792358790/willow-usa.m3u8';
  const avant = 1792358790 * 1000 - 60000, apres = 1792358790 * 1000 + 60000;
  assert.strictEqual(dm.expirationDe(signe, avant), 1792358790 * 1000, 'l\'heure d\'expiration du chemin est lue');
  assert.strictEqual(dm.adresseSignee(signe), true, 'un jeton dans le chemin est une signature');
  assert.strictEqual(dm.dureeDeVie(signe), dm.MEDIA_DIRECT_TTL_MS);
  const regJeton = dm.retenirMediaDirect({}, 'https://bintv.test/?id=1', { url: signe }, avant - 3600000);
  assert.ok(dm.mediaDirectPour(regJeton, 'https://bintv.test/?id=1', avant), 'avant l\'heure : proposé');
  assert.strictEqual(dm.mediaDirectPour(regJeton, 'https://bintv.test/?id=1', apres), null, 'après : plus proposé');
  assert.strictEqual(dm.expirationDe('https://cdn.test/live/1234567890/index.m3u8', avant), null, 'un identifiant loin de l\'heure présente n\'est pas une heure');
  assert.strictEqual(dm.expirationDe('https://cdn.test/a.m3u8?st=x&e=' + Math.floor(avant / 1000 + 600), avant), avant + 600000 - (avant % 1000), 'ni dans un paramètre e=');
  ok('une adresse qui porte son heure d\'expiration n\'est plus proposée après');

  assert.deepStrictEqual(dm.verdictSonde(200, '#EXTM3U\n#EXT-X-VERSION:3'), { ok: true, raison: '' });
  assert.deepStrictEqual(dm.verdictSonde(200, '\uFEFF #EXTM3U'), { ok: true, raison: '' }, 'avec une marque d\'ordre');
  assert.deepStrictEqual(dm.verdictSonde(200, '<?xml version="1.0"?><MPD'), { ok: true, raison: '' }, 'DASH');
  assert.deepStrictEqual(dm.verdictSonde(404, 'Not Found'), { ok: false, raison: 'HTTP 404' });
  assert.deepStrictEqual(dm.verdictSonde(410, 'Gone - Token expired'), { ok: false, raison: 'HTTP 410' });
  assert.deepStrictEqual(dm.verdictSonde(200, '<html>'), { ok: false, raison: 'pas un manifeste' }, 'une page d\'erreur servie en 200');
  ok('la sonde ne valide qu\'un vrai manifeste');

  console.log('\n' + n + ' groupes OK — détection des flux vidéo directs');
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });

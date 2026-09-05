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

  console.log('\n' + n + ' groupes OK — détection des flux vidéo directs');
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });

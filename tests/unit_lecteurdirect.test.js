/* Le lecteur direct : qualité et compatibilité pour tous les types de flux
   (js/lecteurdirect.js, et `creerLecteurVideo` de js/multiview.js).

   « Revoir le chargement des streams et l'app pour assurer qualité maximale et
   compatibilité maximale pour tous les types de streams » (25 octobre 2026). Ce que ces
   cas verrouillent :

   1. Le type d'un média se lit d'abord dans ses premiers octets, puis dans l'extension ;
      un `.mpd` est un média direct et joue par dash.js, pas dans un `<video>` nu.
   2. Une erreur fatale de hls.js est reprise avant d'être abandonnée : décodeur, puis
      codec audio ; un réseau qui lâche APRÈS la lecture est relancé, un manifeste refusé
      AVANT la lecture ne l'est pas (la tuile revient vite à la page).
   3. Un flux qui s'arrête après avoir joué est relancé, la même source, un nombre borné
      de fois ; le compte s'oublie quand la vidéo a tenu.
   4. Chaque bibliothèque a deux miroirs, à la même version épinglée ; le second est
      essayé quand le premier ne répond pas.
   5. Détruire un lecteur arrête son moteur et ses minuteurs. */
const assert = require('assert');
const { JSDOM, VirtualConsole } = require('jsdom');

async function main() {
  const dom = new JSDOM('<!doctype html><html><body><div id="toast"><span id="toasttxt"></span></div></body></html>', { url: 'https://exemple.test/', virtualConsole: new VirtualConsole().sendTo(console, { omitJSDOMErrors: true }) }); // jsdom n'implémente pas load() ni pause()
  dom.window.__NO_AUTOSTART__ = true;
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement', 'Event'])
    Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
  const ld = await import('../js/lecteurdirect.js');
  const mv = await import('../js/multiview.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };
  const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

  // ── 1. Le type d'un média ──────────────────────────────────────────────────────
  assert.strictEqual(ld.typeDeMedia('https://cdn.test/live/index.m3u8?e=1'), 'hls');
  assert.strictEqual(ld.typeDeMedia('https://cdn.test/live/manifest.mpd'), 'dash');
  assert.strictEqual(ld.typeDeMedia('https://cdn.test/clip.mp4#t=3'), 'fichier');
  assert.strictEqual(ld.typeDeMedia('https://cdn.test/clip.webm'), 'fichier');
  assert.strictEqual(ld.typeDeMedia('https://site.test/watch/123'), '');
  assert.strictEqual(ld.typeDeMedia('https://cdn.test/playlist?token=x', '﻿#EXTM3U\n#EXT-X-VERSION:3'), 'hls', 'les octets priment : un manifeste sans extension');
  assert.strictEqual(ld.typeDeMedia('https://cdn.test/live/stream', '<?xml version="1.0"?><MPD'), 'dash');
  assert.strictEqual(ld.typeDeMedia('https://cdn.test/live/stream', '<MPD xmlns='), 'dash');
  assert.strictEqual(ld.typeDeMedia('https://cdn.test/live/index.m3u8', '<html>'), 'hls', 'des octets qui ne disent rien laissent parler l\'extension');
  assert.strictEqual(mv.estMediaDirecte('https://cdn.test/live/manifest.mpd?x=1'), true, 'un .mpd est un média direct');
  ok('typeDeMedia : octets d\'abord (#EXTM3U, <MPD), extension ensuite ; .mpd est un média direct');

  // ── 2. Une erreur fatale de hls.js ─────────────────────────────────────────────
  let etat = { media: 0, reseau: 0, aJoue: false };
  assert.strictEqual(ld.decisionErreurHls({ fatal: false, type: 'networkError' }, etat).action, 'ignorer', 'non fatale : hls.js se débrouille');
  let r = ld.decisionErreurHls({ fatal: true, type: 'mediaError', details: 'bufferAppendError' }, etat);
  assert.strictEqual(r.action, 'recoverMedia');
  r = ld.decisionErreurHls({ fatal: true, type: 'mediaError' }, r.etat);
  assert.strictEqual(r.action, 'swapCodec');
  r = ld.decisionErreurHls({ fatal: true, type: 'mediaError' }, r.etat);
  assert.strictEqual(r.action, 'abandon', 'la troisième erreur média abandonne');
  r = ld.decisionErreurHls({ fatal: true, type: 'networkError', details: 'manifestLoadError' }, { media: 0, reseau: 0, aJoue: false });
  assert.strictEqual(r.action, 'abandon', 'un manifeste refusé AVANT la lecture : retour à la page, sans insister');
  r = ld.decisionErreurHls({ fatal: true, type: 'networkError', details: 'fragLoadError' }, { media: 0, reseau: 0, aJoue: true });
  assert.strictEqual(r.action, 'startLoad', 'le réseau lâche APRÈS la lecture : on relance');
  r = ld.decisionErreurHls({ fatal: true, type: 'networkError' }, r.etat);
  assert.strictEqual(r.action, 'startLoad');
  r = ld.decisionErreurHls({ fatal: true, type: 'networkError' }, r.etat);
  assert.strictEqual(r.action, 'abandon', 'au plus RELANCES_MAX relances réseau');
  assert.strictEqual(ld.decisionErreurHls({ fatal: true, type: 'otherError' }, etat).action, 'abandon');
  assert.strictEqual(ld.decisionErreurHls({ fatal: true, details: 'manifestLoadError', response: { code: 403 } }, etat).action, 'abandon', 'sans type : abandon, comme avant');
  ok('decisionErreurHls : recoverMedia → swapCodec → abandon ; réseau relancé seulement après la lecture, ' + ld.RELANCES_MAX + ' fois');

  // ── 3. Le budget de relance ────────────────────────────────────────────────────
  let t0 = 1000000;
  r = ld.relanceAutorisee({ relances: 0, depuis: t0 }, t0 + 30000);
  assert.strictEqual(r.autorisee, true);
  r = ld.relanceAutorisee(r.etat, t0 + 60000);
  assert.strictEqual(r.autorisee, true);
  r = ld.relanceAutorisee(r.etat, t0 + 90000);
  assert.strictEqual(r.autorisee, false, 'la troisième relance en deux minutes est refusée');
  r = ld.relanceAutorisee(r.etat, t0 + 90000 + ld.OUBLI_RELANCE_MS);
  assert.strictEqual(r.autorisee, true, 'une vidéo qui a tenu deux minutes repart avec un budget neuf');
  ok('relanceAutorisee : ' + ld.RELANCES_MAX + ' relances, oubliées après ' + (ld.OUBLI_RELANCE_MS / 60000) + ' min de lecture');

  // ── 4. Les bibliothèques ───────────────────────────────────────────────────────
  for (const nom of ['hls', 'dash']) {
    const b = ld.BIBLIOTHEQUES[nom];
    assert.strictEqual(b.adresses.length, 2, nom + ' : deux miroirs');
    const versions = b.adresses.map((a) => (a.match(/(\d+\.\d+\.\d+)/) || [])[1]);
    assert.ok(versions[0] && versions[0] === versions[1], nom + ' : la même version épinglée sur les deux miroirs');
    assert.ok(b.adresses.every((a) => /^https:\/\//.test(a)), nom + ' : en https');
    assert.strictEqual(new Set(b.adresses.map((a) => new URL(a).host)).size, 2, nom + ' : deux hôtes différents');
  }
  const c = ld.configHls({ tele: true, loader: function L() {} });
  assert.ok(c.backBufferLength > 0 && c.backBufferLength < 60, 'sur la télé, peu de tampon arrière');
  assert.ok(c.maxMaxBufferLength <= 120 && typeof c.loader === 'function' && !('xhrSetup' in c));
  assert.ok(ld.configHls({}).backBufferLength >= c.backBufferLength, 'un ordinateur peut garder davantage');
  assert.ok(/encrypted-media/.test(ld.PERMISSIONS_CADRE) && /autoplay/.test(ld.PERMISSIONS_CADRE) && !/sandbox/.test(ld.PERMISSIONS_CADRE));
  ok('BIBLIOTHEQUES : deux miroirs https par bibliothèque, même version ; configHls borne le tampon ; permissions du cadre sans sandbox');

  // ── 5. Le lecteur dans la tuile, avec un double de hls.js ──────────────────────
  const instances = [];
  window.Hls = class {
    static isSupported() { return true; }
    static get Events() { return { ERROR: 'hlsError' }; }
    constructor(config) { this.config = config; this.ecouteurs = []; this.appels = []; instances.push(this); }
    on(ev, f) { this.ecouteurs.push(f); }
    emettre(d) { this.ecouteurs.forEach((f) => f('hlsError', d)); }
    loadSource(u) { this.u = u; }
    attachMedia(v) { this.video = v; }
    recoverMediaError() { this.appels.push('recoverMediaError'); }
    swapAudioCodec() { this.appels.push('swapAudioCodec'); }
    startLoad() { this.appels.push('startLoad'); }
    stopLoad() { this.appels.push('stopLoad'); }
    destroy() { this.appels.push('destroy'); }
  };
  const echecs = [];
  const video = mv.creerLecteurVideo('https://cdn.test/live/index.m3u8', (r) => echecs.push(r), null, { 'X-Footy-Referer': 'https://cadre.test/' }, 'hls', { delaiStagnationMs: 30 });
  document.body.appendChild(video);
  await attendre(10);
  assert.strictEqual(instances.length, 1, 'hls.js est pris (window.Hls déjà là : aucun script chargé)');
  const hls = instances[0];
  assert.strictEqual(hls.u, 'https://cdn.test/live/index.m3u8');
  assert.ok(hls.config.backBufferLength > 0 && typeof hls.config.xhrSetup === 'function', 'la configuration bornée, avec les en-têtes du relais');
  const xhr = { entetes: {}, setRequestHeader(k, v) { this.entetes[k] = v; } };
  hls.config.xhrSetup(xhr);
  assert.deepStrictEqual(xhr.entetes, { 'X-Footy-Referer': 'https://cadre.test/' });

  hls.emettre({ fatal: false, type: 'networkError' });
  assert.deepStrictEqual(hls.appels, [], 'une erreur non fatale ne fait rien');
  hls.emettre({ fatal: true, type: 'mediaError', details: 'bufferAppendError' });
  assert.deepStrictEqual(hls.appels, ['recoverMediaError']);
  hls.emettre({ fatal: true, type: 'mediaError' });
  assert.deepStrictEqual(hls.appels, ['recoverMediaError', 'swapAudioCodec', 'recoverMediaError']);
  assert.deepStrictEqual(echecs, [], 'rien n\'est remonté tant qu\'une reprise reste');
  // Le flux joue ; le réseau lâche : relancé, pas abandonné.
  Object.defineProperty(video, 'paused', { value: false, configurable: true }); // jsdom : « en pause » tant qu'on ne le dit pas
  video.dispatchEvent(new Event('playing'));
  hls.emettre({ fatal: true, type: 'networkError', details: 'fragLoadError', response: { code: 503 } });
  assert.strictEqual(hls.appels[hls.appels.length - 1], 'startLoad');
  assert.deepStrictEqual(echecs, []);
  ok('creerLecteurVideo (hls) : reprise du décodeur, puis du codec, puis relance réseau après la lecture — sans retour à la page');

  // Un arrêt après la lecture : relancé après le délai, la même source ; une pause volontaire, non.
  video.dispatchEvent(new Event('waiting'));
  await attendre(60);
  assert.deepStrictEqual(hls.appels.slice(-2), ['stopLoad', 'startLoad'], 'un ré-tampon qui dure est relancé');
  video.dispatchEvent(new Event('waiting'));
  video.dispatchEvent(new Event('timeupdate'));
  await attendre(60);
  assert.deepStrictEqual(hls.appels.slice(-2), ['stopLoad', 'startLoad'], 'la vidéo qui avance annule la veille : pas de relance de plus');
  const avant = hls.appels.length;
  Object.defineProperty(video, 'paused', { value: true, configurable: true });
  video.dispatchEvent(new Event('waiting'));
  await attendre(60);
  assert.strictEqual(hls.appels.length, avant, 'une vidéo en pause n\'est pas relancée');
  Object.defineProperty(video, 'paused', { value: false, configurable: true });
  ok('un flux qui s\'arrête après avoir joué est relancé après ' + ld.DELAI_STAGNATION_MS / 1000 + ' s (ici raccourci), pas une pause volontaire');

  // Le budget épuisé : l'appelant est prévenu, une seule fois.
  video.dispatchEvent(new Event('stalled'));
  await attendre(60);
  video.dispatchEvent(new Event('ended'));
  await attendre(60);
  assert.strictEqual(echecs.length, 1, 'au-delà du budget, l\'appelant décide (retour à la page)');
  assert.ok(/relances/.test(echecs[0]), echecs[0]);
  hls.emettre({ fatal: true, type: 'otherError' });
  assert.strictEqual(echecs.length, 1, 'un lecteur fini ne remonte plus rien');
  ok('le budget épuisé remonte un seul échec');

  // Détruire : moteur arrêté, veille coupée.
  const video2 = mv.creerLecteurVideo('https://cdn.test/b/index.m3u8', (r) => echecs.push('b:' + r), null, null, 'hls', { delaiStagnationMs: 30 });
  document.body.appendChild(video2);
  await attendre(10);
  const hls2 = instances[1];
  Object.defineProperty(video2, 'paused', { value: false, configurable: true }); // jsdom : « en pause » tant qu'on ne le dit pas
  video2.dispatchEvent(new Event('playing'));
  video2.dispatchEvent(new Event('waiting'));
  mv.detruireLecteursDe(document.body);
  await attendre(60);
  assert.ok(hls2.appels.includes('destroy') && !hls2.appels.includes('startLoad'), 'détruit : le moteur est arrêté et la veille ne relance plus');
  assert.ok(hls.appels.includes('destroy'), 'tous les lecteurs du conteneur sont détruits');
  assert.strictEqual(video2._hls, null);
  ok('detruireLecteursDe : moteur hls.js détruit, veille coupée');

  // ── 6. DASH par dash.js (double), avec les en-têtes du relais ──────────────────
  const dashInstances = [];
  window.dashjs = {
    MediaPlayer: Object.assign(function () {
      return { create() {
        const p = { appels: [], ecouteurs: {}, extensions: {},
          extend(nom, fab, override) { this.extensions[nom] = fab(); },
          on(ev, f) { this.ecouteurs[ev] = f; },
          initialize(v, u, auto) { this.appels.push(['initialize', u, auto]); this.video = v; },
          attachSource(u) { this.appels.push(['attachSource', u]); },
          destroy() { this.appels.push(['destroy']); } };
        dashInstances.push(p); return p;
      } };
    }, { events: { ERROR: 'error' } })
  };
  const echecsDash = [];
  const video3 = mv.creerLecteurVideo('https://cdn.test/live/manifest.mpd', (r) => echecsDash.push(r), null, { 'X-Footy-Referer': 'https://cadre.test/' }, 'dash', { delaiStagnationMs: 30 });
  document.body.appendChild(video3);
  await attendre(10);
  assert.strictEqual(dashInstances.length, 1, 'dash.js est pris pour un .mpd');
  const dash = dashInstances[0];
  assert.deepStrictEqual(dash.appels[0], ['initialize', 'https://cdn.test/live/manifest.mpd', true]);
  const xhr2 = { entetes: {}, setRequestHeader(k, v) { this.entetes[k] = v; } };
  dash.extensions.RequestModifier.modifyRequestHeader(xhr2);
  assert.deepStrictEqual(xhr2.entetes, { 'X-Footy-Referer': 'https://cadre.test/' }, 'les en-têtes du relais passent par RequestModifier');
  Object.defineProperty(video3, 'paused', { value: false, configurable: true }); // jsdom : « en pause » tant qu'on ne le dit pas
  video3.dispatchEvent(new Event('playing'));
  video3.dispatchEvent(new Event('ended'));
  await attendre(60);
  assert.deepStrictEqual(dash.appels[dash.appels.length - 1], ['attachSource', 'https://cdn.test/live/manifest.mpd'], 'un direct qui « finit » est relancé');
  dash.ecouteurs.error({ error: { code: 27, message: 'manifest' } });
  assert.deepStrictEqual(echecsDash, ['dash 27']);
  mv.detruireLecteur(video3);
  assert.ok(dash.appels.some((a) => a[0] === 'destroy') && video3._dash === null);
  ok('creerLecteurVideo (dash) : dash.js, en-têtes du relais, relance, erreur remontée, destruction');

  // ── 7. Le second miroir quand le premier ne répond pas ─────────────────────────
  delete window.dashjs;
  const scripts = [];
  const origCreate = document.createElement.bind(document);
  document.createElement = function (tag) {
    const el = origCreate(tag);
    if (String(tag).toLowerCase() === 'script') {
      scripts.push(el);
      Object.defineProperty(el, 'src', { set(v) { el.setAttribute('src', v); setTimeout(() => {
        if (/cdnjs/.test(v)) el.onerror && el.onerror();
        else { window.dashjs = { MediaPlayer: Object.assign(function () { return { create() { return { extend() {}, on() {}, initialize() {}, destroy() {} }; } }; }, { events: { ERROR: 'error' } }) }; el.onload && el.onload(); }
      }, 5); }, get() { return el.getAttribute('src'); } });
    }
    return el;
  };
  const video4 = mv.creerLecteurVideo('https://cdn.test/live/manifest.mpd', () => {}, null, null, 'dash');
  await attendre(40);
  document.createElement = origCreate;
  assert.deepStrictEqual(scripts.map((s) => new URL(s.getAttribute('src')).host), ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net'], 'cdnjs muet : jsdelivr prend le relais');
  assert.ok(window.dashjs, 'et la bibliothèque est là');
  mv.detruireLecteur(video4);
  ok('chargerBibliotheque : le second miroir est essayé quand le premier échoue');

  console.log('\n' + n + ' cas passés.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

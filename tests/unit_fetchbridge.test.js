/* Le pont du script utilisateur est le premier transport de fetchPage.

   Pourquoi : les quatre transports de `fetchPage` sont tombés en même temps le
   4 septembre 2026 — allorigins rend 500/522 (y compris sur example.com, donc le service
   lui-même est mort), codetabs 522, et proxy.cors.sh est passé derrière un challenge
   Cloudflare qui rend 403 dès qu'un en-tête Origin est présent, c'est-à-dire pour toute
   requête venue d'un navigateur. Plus aucune extraction ne fonctionnait : la recherche
   de flux d'un match, la résolution d'un lien d'agrégateur et le tour de passe-passe
   partagent tous `fetchPage`.

   Le pont (`GM_xmlhttpRequest` via postMessage) n'est pas soumis à la politique d'origine
   croisée : il ne dépend d'aucun service tiers. Il existait déjà et était éprouvé, mais
   n'était câblé que dans le tour de passe-passe.

   On teste ici la logique de bascule, pas le réseau : le pont est simulé. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://exemple.test/' });
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement', 'Event', 'CustomEvent', 'location', 'history', 'getComputedStyle']) {
    Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
  }
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  dom.window.__NO_AUTOSTART__ = true;

  await import('../js/scrapers.js');          // fixe l'ordre d'évaluation des modules
  const B = await import('../js/embed-bridge.js');
  const U = await import('../js/utils.js');

  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };
  const PAGE = '<html><body>' + 'x'.repeat(400) + '</body></html>';

  /* Le pont répond à `postMessage` : on rejoue le protocole du script utilisateur
     plutôt que de remplacer la fonction, pour éprouver le câblage réel. */
  function installerPont(reponse) {
    dom.window.addEventListener('message', function (e) {
      const d = e.data;
      if (!d || typeof d !== 'object') return;
      if (d.__mvBridge === 'mv_bridge_hello') {
        dom.window.postMessage({ __mvBridge: 'mv_bridge_ready', version: '1.2' }, '*');
      } else if (d.__mvBridge === 'mv_bridge_fetch') {
        dom.window.postMessage(Object.assign({ __mvBridge: 'mv_bridge_page', id: d.id }, reponse), '*');
      }
    });
    B.initEmbedBridge();
    dom.window.postMessage({ __mvBridge: 'mv_bridge_ready', version: '1.2' }, '*');
    return new Promise((r) => setTimeout(r, 60));
  }

  {
    assert.strictEqual(B.getBridgeStatus().available, false, 'sans script, le pont est absent');
    ok('le pont s\'annonce absent tant que le script ne répond pas');
  }

  await installerPont({ ok: true, html: PAGE, finalUrl: 'https://cible.test/x' });
  assert.strictEqual(B.getBridgeStatus().available, true, 'le pont doit être détecté');

  {
    /* Aucun proxy n'est joignable dans ce test (pas de réseau) : si la page revient
       quand même, c'est nécessairement le pont qui l'a fournie. */
    const html = await U.fetchPage('https://cible.test/x', { force: true });
    assert.strictEqual(html, PAGE, 'la page vient du pont');
    ok('fetchPage passe par le pont avant les proxys');
  }
  {
    // Le cache mémoire ne doit pas masquer l'origine du contenu au coup suivant.
    const html = await U.fetchPage('https://cible.test/x');
    assert.strictEqual(html, PAGE);
    ok('le résultat du pont alimente le cache comme celui d\'un proxy');
  }

  /* ── resolveStreamUrl ne double plus le moteur d'extraction ────────────────
     Elle contenait un second extracteur écrit à la main (première <iframe> sans « ads »
     dans le src, puis regex sur les charges Next.js), déclenché par une liste figée de
     douze domaines. Ces sources changent d'adresse plusieurs fois par saison : la liste
     cessait alors silencieusement de correspondre. Et quand elle correspondait, ce
     moteur passait AVANT le moteur générique de js/extractors.js et le court-circuitait.

     Elle ne garde donc que les conversions qu'aucun extracteur ne peut deviner, parce
     qu'elles tiennent à la forme d'URL d'un service. */
  {
    // Une page d'agrégateur est rendue TELLE QUELLE : l'extraction revient au moteur
    // générique, que les deux appelants enchaînent (resolveBlockedEmbed, scrapeMatchFlux).
    for (const u of ['https://footybite.bid/game/alpha-vs-beta',
                     'https://v2.sportsurge.net/watch-63166-cfb-a-b/',
                     'https://methstreams.gs/league/nflstreams']) {
      assert.strictEqual(await U.resolveStreamUrl(u), u, 'rendue telle quelle : ' + u);
    }
    ok('resolveStreamUrl ne tente plus d\'extraire elle-même sur les agrégateurs');
  }
  {
    // Ce qu'elle garde : les formes d'URL propres à un service.
    assert.strictEqual(await U.resolveStreamUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
      'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1');
    const twitch = await U.resolveStreamUrl('https://www.twitch.tv/unechaine');
    assert.ok(twitch.indexOf('player.twitch.tv/?channel=unechaine') > -1, 'Twitch : ' + twitch);
    assert.ok(twitch.indexOf('parent=') > -1, 'Twitch exige le paramètre parent');
    ok('resolveStreamUrl garde les conversions YouTube et Twitch');
  }
  {
    // Entrées inexploitables : rendues telles quelles, sans exception.
    for (const bad of ['', null, undefined, 42]) {
      assert.strictEqual(await U.resolveStreamUrl(bad), bad);
    }
    ok('resolveStreamUrl tolère une entrée vide ou illisible');
  }

  console.log('unit_fetchbridge: ' + n + ' groupes de tests OK');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

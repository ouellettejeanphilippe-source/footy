/* Tests de la fenêtre « Live » (js/config.js).

   L'onglet Live doit contenir ce qui est en cours ou commence dans l'heure, et rien
   d'autre. Le calcul est plus subtil qu'il n'y paraît parce que `startTime` est une
   heure du jour sans date : c'est ce qui a fait déborder l'onglet jusqu'ici. Un soir à
   19:34, l'ancien prédicat (`diff <= 15 && diff > -1440`, « commencé dans les 24
   dernières heures ») laissait passer 128 matchs, dont un de 01:00 le matin même, plus
   50 au statut `live` périmé — plus de 200 matchs affichés pour 2 réellement en cours.

   Ces tests fixent l'heure de référence, donc ne dépendent ni de la machine ni du
   moment où ils tournent. Les dates sont celles du fuseau America/New_York, puisque
   c'est celui dans lequel `startTime` et `matchDate` sont exprimés. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
  // js/config.js tire js/db.js, qui touche `window` au chargement.
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/' });
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement']) {
    Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
  }

  const C = await import('../js/config.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  // 3 septembre 2026, 19:34 heure de New York (23:34 UTC, heure d'été en vigueur).
  const SOIR = new Date('2026-09-03T23:34:00Z');
  const j = (startTime, extra) => Object.assign({ startTime, matchDate: '2026-09-03', status: 'upcoming' }, extra || {});

  // ── 1. Écart signé jusqu'au coup d'envoi ─────────────────────────────────
  {
    assert.strictEqual(C.minutesUntilStart(j('20:00'), SOIR), 26, 'dans 26 minutes');
    assert.strictEqual(C.minutesUntilStart(j('19:34'), SOIR), 0, 'maintenant');
    assert.strictEqual(C.minutesUntilStart(j('19:00'), SOIR), -34, 'commencé il y a 34 minutes');
    // Le cas qui cassait tout : 01:00 le matin même, ce n'est pas « dans 5 h ».
    assert.strictEqual(C.minutesUntilStart(j('01:00'), SOIR), -1114, 'ce matin, pas cette nuit');
    ok('minutesUntilStart rend un écart signé à partir de matchDate');
  }
  {
    // Passage de minuit, dans les deux sens, grâce à matchDate.
    const NUIT = new Date('2026-09-04T03:30:00Z');   // 23:30 le 3 septembre à New York
    assert.strictEqual(C.minutesUntilStart(j('00:15', { matchDate: '2026-09-04' }), NUIT), 45,
      'un match de 00:15 le lendemain est dans 45 minutes');
    assert.strictEqual(C.minutesUntilStart(j('23:00', { matchDate: '2026-09-03' }), NUIT), -30,
      'un match de 23:00 le même soir a commencé il y a 30 minutes');
    ok('minutesUntilStart traverse minuit dans les deux sens');
  }
  {
    // Sans matchDate, on retient l'occurrence la plus proche.
    const NUIT = new Date('2026-09-04T03:30:00Z');   // 23:30 à New York
    assert.strictEqual(C.minutesUntilStart({ startTime: '00:15' }, NUIT), 45,
      'à 23:30, « 00:15 » est le lendemain');
    ok('minutesUntilStart retient l\'occurrence la plus proche sans date');
  }
  {
    // Entrées inexploitables : null, jamais 0 — 0 signifierait « commence maintenant ».
    [undefined, null, {}, { startTime: '' }, { startTime: 'bientôt' }, { startTime: '25:00' }]
      .forEach((bad) => assert.strictEqual(C.minutesUntilStart(bad, SOIR), null, JSON.stringify(bad)));
    ok('minutesUntilStart rend null plutôt que zéro sur une entrée illisible');
  }

  // ── 2. En cours maintenant ───────────────────────────────────────────────
  {
    assert.strictEqual(C.isLiveNow(j('19:00', { status: 'live' }), SOIR), true, 'annoncé en cours, commencé il y a 34 min');
    assert.strictEqual(C.isLiveNow(j('19:00'), SOIR), true, 'commencé, statut pas encore basculé');
    assert.strictEqual(C.isLiveNow(j('19:45'), SOIR), true, 'commence dans 11 min : le direct a déjà commencé');
    assert.strictEqual(C.isLiveNow(j('20:00'), SOIR), false, 'dans 26 min : à venir, pas en cours');
    ok('isLiveNow couvre le match commencé et celui qui est imminent');
  }
  {
    // La borne de durée : c'est elle qui vide l'onglet des statuts périmés.
    assert.strictEqual(C.isLiveNow(j('17:00', { status: 'live' }), SOIR), true, '2 h 34 : encore plausible');
    assert.strictEqual(C.isLiveNow(j('15:00', { status: 'live' }), SOIR), false, '4 h 34 : terminé, quoi qu\'en dise la source');
    assert.strictEqual(C.isLiveNow(j('00:00', { status: 'live' }), SOIR), false, 'commencé 19 h plus tôt');
    assert.strictEqual(C.isLiveNow(j('01:00'), SOIR), false, 'le match de 01:00 qui polluait l\'onglet');
    ok('isLiveNow écarte un statut « live » périmé au-delà de la durée plausible');
  }
  {
    assert.strictEqual(C.isLiveNow(j('19:00', { status: 'finished' }), SOIR), false, 'terminé reste terminé');
    // Sans heure lisible, on s'en remet au statut annoncé : c'est tout ce qu'on a.
    assert.strictEqual(C.isLiveNow({ status: 'live' }, SOIR), true);
    assert.strictEqual(C.isLiveNow({ status: 'upcoming' }, SOIR), false);
    ok('isLiveNow se replie sur le statut quand l\'heure manque');
  }

  // ── 3. À venir dans la fenêtre ───────────────────────────────────────────
  {
    assert.strictEqual(C.startsWithin(j('20:00'), 60, SOIR), true, 'dans 26 min');
    assert.strictEqual(C.startsWithin(j('20:34'), 60, SOIR), true, 'dans 60 min : la borne est incluse');
    assert.strictEqual(C.startsWithin(j('20:35'), 60, SOIR), false, 'dans 61 min : dehors');
    assert.strictEqual(C.startsWithin(j('21:00'), 60, SOIR), false, 'dans 1 h 26 : c\'est le « à venir » qu\'on enlève');
    ok('startsWithin borne la fenêtre à l\'heure demandée');
  }
  {
    // Aucun chevauchement avec isLiveNow : un match ne doit jamais tomber dans les deux
    // paniers, sans quoi il apparaîtrait deux fois dans l'onglet.
    ['15:00', '19:00', '19:45', '20:00', '21:00', '01:00'].forEach((t) => {
      ['upcoming', 'live', 'finished'].forEach((status) => {
        const m = j(t, { status });
        assert.ok(!(C.isLiveNow(m, SOIR) && C.startsWithin(m, 60, SOIR)),
          'chevauchement sur ' + t + ' / ' + status);
      });
    });
    ok('isLiveNow et startsWithin s\'excluent : pas de match affiché deux fois');
  }
  {
    assert.strictEqual(C.startsWithin(j('19:00', { status: 'live' }), 60, SOIR), false, 'déjà en cours');
    assert.strictEqual(C.startsWithin(j('20:00', { status: 'finished' }), 60, SOIR), false, 'terminé');
    assert.strictEqual(C.startsWithin({ status: 'upcoming' }, 60, SOIR), false, 'sans heure, rien à promettre');
    ok('startsWithin écarte ce qui est en cours, terminé ou sans heure');
  }

  console.log('unit_livewindow: ' + n + ' groupes de tests OK');
}

/* jsdom et les minuteries chargées par js/config.js gardent la boucle d'événements
   ouverte : sans sortie explicite, le test réussit mais ne rend jamais la main, et
   `npm test` resterait suspendu sur ce fichier. */
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

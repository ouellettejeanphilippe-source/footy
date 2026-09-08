/* Scores en direct (js/api.js).

   « Est-ce que les scores peuvent se rafraîchir au rafraîchissement ? Ça devrait être
   pas mal en direct, les scores. »

   La passe complète reconstruit toute la journée — 47 chemins ESPN plus les calendriers
   annexes — d'où sa cadence de cinq minutes. À l'ouverture, la grille vient souvent du
   calendrier rangé en local, qui peut avoir dix minutes : les scores affichés avaient
   donc jusqu'à quinze minutes de retard avant de bouger.

   Un score ne demande pourtant que les ligues qui ont un match EN COURS : une à cinq
   adresses. C'est ce que cette passe fait, chaque minute et dès l'ouverture. Elle ne
   touche pas au calendrier, mais elle corrige les scores qui y sont rangés — sinon la
   passe complète suivante, qui relit ce calendrier, ramènerait les scores d'avant. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
  const dom = new JSDOM('<!doctype html><html><body><div id="marea"></div></body></html>',
                        { url: 'https://exemple.test/' });
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement'])
    Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
  globalThis.fetch = () => Promise.reject(new Error('réseau coupé'));

  const api = await import('../js/api.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  // 8 septembre 2026, 19:00 à New York.
  const NOW = new Date('2026-09-08T23:00:00Z');
  const enCours = (extra) => Object.assign(
    { id: 'espn_1', league: 'MLB', matchDate: '2026-09-08', startTime: '19:00', status: 'live', _scoreAt: +NOW }, extra || {});

  // ── 1. On ne redemande que les ligues qui ont un match en cours ───────────
  {
    const matchs = [
      enCours({ id: 'espn_1', espnPath: 'baseball/mlb' }),
      enCours({ id: 'espn_2', espnPath: 'baseball/mlb' }),          // même ligue : une seule fois
      enCours({ id: 'espn_3', espnPath: 'basketball/nba' }),
      enCours({ id: 'espn_4', espnPath: 'hockey/nhl', status: 'upcoming', startTime: '23:00' }),  // pas commencé
      enCours({ id: 'espn_5', espnPath: 'soccer/eng.1', status: 'finished' })                      // terminé
    ];
    const taches = api.tachesEnDirect(matchs, NOW);
    assert.deepStrictEqual(taches.map((t) => t.path).sort(), ['baseball/mlb', 'basketball/nba'],
      'deux ligues interrogées, pas quarante-sept');
    assert.ok(taches.every((t) => t.jour === '20260908'), 'sous la date du match');
    ok('seules les ligues qui ont un match en cours sont redemandées, une fois chacune');
  }
  {
    /* Un match d'hier soir qui joue encore après minuit est rangé chez ESPN sous la date
       d'hier : c'est celle-là qu'il faut demander (voir js/nuit.js). */
    const NUIT = new Date('2026-09-09T04:30:00Z');   // 00:30 à New York, le 9
    const taches = api.tachesEnDirect([
      enCours({ id: 'espn_nuit', espnPath: 'baseball/mlb', matchDate: '2026-09-08', startTime: '22:05', _scoreAt: +NUIT })
    ], NUIT);
    assert.deepStrictEqual(taches, [{ path: 'baseball/mlb', jour: '20260908' }], 'la veille, pas le jour courant');
    ok('un match d\'hier soir encore en cours est redemandé sous SA date');
  }
  {
    /* Un calendrier rangé avant que le chemin ne soit mémorisé n'a pas d'`espnPath` :
       le nom de la ligue le rattrape, sans quoi rien ne serait rafraîchi. */
    const taches = api.tachesEnDirect([enCours({ league: 'NBA', espnPath: undefined })], NOW);
    assert.deepStrictEqual(taches, [{ path: 'basketball/nba', jour: '20260908' }]);
    assert.deepStrictEqual(api.tachesEnDirect([enCours({ league: 'Ligue inconnue', espnPath: undefined })], NOW), [],
      'une ligue qu\'ESPN ne sert pas n\'est pas demandée');
    assert.deepStrictEqual(api.tachesEnDirect([], NOW), []);
    assert.deepStrictEqual(api.tachesEnDirect(null, NOW), []);
    ok('sans chemin mémorisé, le nom de la ligue prend le relais');
  }

  // ── 2. Ce qu'ESPN dit, réduit à ce que les cartes affichent ───────────────
  {
    const data = { leagues: [{ name: 'MLB' }], events: [{
      id: '401', date: '2026-09-08T23:00Z',
      status: { type: { state: 'in', shortDetail: 'Top 7th' }, displayClock: '0:00', period: 7 },
      competitions: [{ id: 'c1', date: '2026-09-08T23:00Z', competitors: [
        { homeAway: 'home', score: '4' }, { homeAway: 'away', score: '2' }] }]
    }] };
    const [e] = api.etatsDepuisEspn(data, 'baseball/mlb');
    assert.strictEqual(e.id, 'espn_401', 'même identifiant que la passe complète');
    assert.strictEqual(e.status, 'live');
    assert.deepStrictEqual(e.score, [4, 2]);
    assert.strictEqual(e.minute, '0:00');
    assert.strictEqual(e.period, 7);
    assert.strictEqual(e.detail, 'Top 7th', 'le libellé sert à reconnaître une prolongation');
    assert.strictEqual(e.startTime, '19:00', 'et l\'heure, si le match a été décalé');
    ok('un événement en cours devient statut, score, minute, période et libellé');
  }
  {
    const fini = { leagues: [{ name: 'MLB' }], events: [{
      id: '402', date: '2026-09-08T23:00Z',
      status: { type: { state: 'post', shortDetail: 'Final' }, period: 9 },
      competitions: [{ id: 'c', date: '2026-09-08T23:00Z', competitors: [
        { homeAway: 'home', score: '5' }, { homeAway: 'away', score: '3' }] }]
    }] };
    assert.strictEqual(api.etatsDepuisEspn(fini, 'baseball/mlb')[0].status, 'finished');
    assert.deepStrictEqual(api.etatsDepuisEspn(fini, 'baseball/mlb')[0].score, [5, 3]);

    const avenir = { leagues: [{ name: 'MLB' }], events: [{
      id: '403', date: '2026-09-08T23:00Z',
      status: { type: { state: 'pre' } },
      competitions: [{ id: 'c', date: '2026-09-08T23:00Z', competitors: [
        { homeAway: 'home', score: '0' }, { homeAway: 'away', score: '0' }] }]
    }] };
    const a = api.etatsDepuisEspn(avenir, 'baseball/mlb')[0];
    assert.strictEqual(a.status, 'upcoming');
    assert.strictEqual(a.score, null, 'un match à venir n\'a pas de score, pas même 0-0');

    assert.deepStrictEqual(api.etatsDepuisEspn(null, 'x'), []);
    assert.deepStrictEqual(api.etatsDepuisEspn({ events: [] }, 'x'), []);
    assert.deepStrictEqual(api.etatsDepuisEspn({ events: [{ id: '1' }] }, 'x'), [], 'un événement sans état est ignoré');
    ok('terminé, à venir, réponse vide ou illisible : rien n\'est inventé, rien ne lève');
  }
  {
    /* Une épreuve : chaque séance est une compétition avec son propre état. */
    const course = { leagues: [{ name: 'F1' }], events: [{
      id: '900', date: '2026-09-08T23:00Z',
      status: { type: { state: 'post' } },
      competitions: [
        { id: 'fp1', date: '2026-09-08T23:00Z', status: { type: { state: 'post', shortDetail: 'Final' } } },
        { id: 'race', date: '2026-09-08T23:00Z', status: { type: { state: 'in', shortDetail: 'Tour 30/58' } } }
      ]
    }] };
    const etats = api.etatsDepuisEspn(course, 'racing/f1');
    assert.strictEqual(etats.length, 2, 'une entrée par séance');
    assert.strictEqual(etats[0].id, 'espn_900_fp1');
    assert.strictEqual(etats[1].id, 'espn_900_race');
    assert.strictEqual(etats[1].status, 'live', 'la course tourne, même si le week-end est « terminé »');
    assert.strictEqual(etats[1].score, null, 'une épreuve n\'a pas de score à deux nombres');
    ok('pour une épreuve, c\'est l\'état de la séance qui compte, pas celui du week-end');
  }

  // ── 3. Le calendrier rangé en local suit, sinon la passe suivante annule ──
  {
    const JOUR = '20260908';
    localStorage.setItem('api_calendar_cache_' + JOUR, JSON.stringify({
      fetchDate: JOUR, savedAt: Date.now(),
      matches: [
        { id: 'espn_401', status: 'live', score: [3, 2], minute: '1:00' },
        { id: 'espn_999', status: 'live', score: [1, 1], minute: '2:00' }
      ]
    }));
    const touches = api.majScoresDansCache(JOUR, [
      { id: 'espn_401', status: 'live', score: [4, 2], minute: '0:00', period: 7, detail: 'Top 7th', startTime: '19:00' }
    ]);
    assert.strictEqual(touches, 1, 'un seul match connu était concerné');
    const relu = JSON.parse(localStorage.getItem('api_calendar_cache_' + JOUR)).matches;
    assert.deepStrictEqual(relu[0].score, [4, 2], 'le score frais est rangé');
    assert.strictEqual(relu[0].detail, 'Top 7th');
    assert.deepStrictEqual(relu[1].score, [1, 1], 'les autres matchs ne sont pas touchés');

    assert.strictEqual(api.majScoresDansCache(JOUR, []), 0);
    assert.strictEqual(api.majScoresDansCache('20260907', [{ id: 'espn_401', status: 'live' }]), 0,
      'un calendrier d\'un autre jour n\'est pas touché');
    ok('les scores frais sont rangés dans le calendrier local, sans toucher au reste');
  }

  // ── 4. Cadences ──────────────────────────────────────────────────────────
  {
    assert.strictEqual(api.SCORE_LIVE_REFRESH_MS, 60 * 1000, 'les scores en direct, chaque minute');
    assert.strictEqual(api.SCORE_REFRESH_MS, 5 * 60 * 1000, 'la passe complète reste à cinq minutes');
    assert.ok(api.SCORE_LIVE_MIN_GAP_MS < api.SCORE_LIVE_REFRESH_MS,
      'l\'écart minimal ne doit pas empêcher la cadence choisie');
    ok('une minute pour les scores, cinq pour le programme complet');
  }

  console.log('unit_scoresdirects: ' + n + ' groupes de tests OK');
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

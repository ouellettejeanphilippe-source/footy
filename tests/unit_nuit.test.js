/* La nuit appartient à la veille (js/nuit.js).

   « Ya des matchs qui finissent dans la nuit. » À 00:30, le match de base-ball commencé
   à 22:05 est en septième manche, mais « aujourd'hui » vient de changer et tout était
   filtré sur `matchDate === aujourd'hui` : il n'était plus ni dans la grille, ni dans
   le Live, ni suivi par les scores, ni pourvu de liens. La règle : un match d'hier qui
   déborde sur cette nuit fait partie de la journée d'aujourd'hui. */
const assert = require('assert');

async function main() {
  const N = await import('../js/nuit.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  const HIER = '2026-09-07', AUJ = '2026-09-08', DEMAIN = '2026-09-09';
  const mlb = (startTime, extra) => Object.assign({ startTime, matchDate: HIER, durationMinutes: 180, status: 'live' }, extra || {});

  // ── 1. Veille et lendemain en jours civils, sans heure d'été ──────────────
  assert.strictEqual(N.veille(AUJ), HIER);
  assert.strictEqual(N.lendemain(HIER), AUJ);
  assert.strictEqual(N.veille('2026-03-09'), '2026-03-08', 'le jour du passage à l\'heure d\'été');
  assert.strictEqual(N.veille('2026-01-01'), '2025-12-31', 'changement d\'année');
  assert.strictEqual(N.veille('hier'), null);
  assert.strictEqual(N.veille(undefined), null);
  ok('veille et lendemain se calculent en jours civils');

  // ── 2. Déborde sur la nuit : coup d'envoi plus durée au-delà de minuit ───
  assert.strictEqual(N.debordeSurLaNuit(mlb('22:05')), true, '22:05 + 3 h : 01:05');
  assert.strictEqual(N.debordeSurLaNuit(mlb('20:00')), false, '20:00 + 3 h : 23:00, fini avant minuit');
  assert.strictEqual(N.debordeSurLaNuit(mlb('21:00')), false, '21:00 + 3 h : minuit pile, ne déborde pas');
  ok('un match déborde quand coup d\'envoi plus durée dépassent minuit');
  assert.strictEqual(N.debordeSurLaNuit({ startTime: '22:30' }), true, 'sans durée : 2 h par défaut, 00:30');
  assert.strictEqual(N.debordeSurLaNuit({ startTime: '21:30' }), false, 'sans durée : 2 h par défaut, 23:30');
  assert.strictEqual(N.debordeSurLaNuit({ startTime: '20:30' }, N.DUREE_LARGE_MIN), true, 'durée large (liens) : 4 h, 00:30');
  assert.strictEqual(N.debordeSurLaNuit({ startTime: 'LIVE' }), false, 'heure illisible : on ne sait pas, donc non');
  assert.strictEqual(N.debordeSurLaNuit(null), false);
  ok('la durée par défaut, et la durée large pour les liens sans durée');

  // ── 3. Appartenance au jour : le sien, ou la veille en débordant ─────────
  assert.strictEqual(N.appartientAuJour(mlb('22:05', { matchDate: AUJ }), AUJ), true, 'daté du jour');
  assert.strictEqual(N.appartientAuJour(mlb('22:05'), AUJ), true, 'd\'hier, déborde sur cette nuit');
  assert.strictEqual(N.appartientAuJour(mlb('22:05', { status: 'finished' }), AUJ), true, 'terminé à 01:05 : il a bien fait partie de cette nuit');
  assert.strictEqual(N.appartientAuJour(mlb('19:00'), AUJ), false, 'd\'hier, fini avant minuit');
  assert.strictEqual(N.appartientAuJour(mlb('22:05', { matchDate: '2026-09-06' }), AUJ), false, 'd\'avant-hier : non');
  assert.strictEqual(N.appartientAuJour(mlb('22:05', { matchDate: DEMAIN }), AUJ), false, 'de demain : non');
  assert.strictEqual(N.appartientAuJour(mlb('22:05'), HIER), true, 'sur la grille d\'hier, il reste à sa date');
  assert.strictEqual(N.appartientAuJour({ startTime: '22:05' }, AUJ), false, 'sans date : impossible à rattacher');
  assert.strictEqual(N.appartientAuJour(null, AUJ), false);
  assert.strictEqual(N.appartientAuJour(mlb('22:05'), ''), false);
  ok('appartientAuJour remplace « matchDate === aujourd\'hui » sans perdre la nuit');

  // ── 4. La nuit : jusqu'à 06:00 ──────────────────────────────────────────
  assert.strictEqual(N.nuitEnCours(0), true, 'minuit');
  assert.strictEqual(N.nuitEnCours(5 * 60 + 59), true, '05:59');
  assert.strictEqual(N.nuitEnCours(6 * 60), false, '06:00 : la veille n\'est plus relue');
  assert.strictEqual(N.nuitEnCours(23 * 60), false, '23:00 : pas encore la nuit du lendemain');
  assert.strictEqual(N.nuitEnCours(NaN), false);
  assert.strictEqual(N.nuitEnCours(undefined), false);
  ok('nuitEnCours borne la relecture de la veille à 06:00');

  // ── 5. Position et tri par rapport au minuit du jour affiché ─────────────
  assert.strictEqual(N.minutesDansLaJournee(mlb('22:05'), AUJ), -115, 'hier 22:05 : 115 min avant le minuit d\'aujourd\'hui');
  assert.strictEqual(N.minutesDansLaJournee(mlb('00:30', { matchDate: AUJ }), AUJ), 30);
  assert.strictEqual(N.minutesDansLaJournee(mlb('01:00', { matchDate: DEMAIN }), AUJ), 1500, 'demain 01:00 : au-delà de la grille');
  assert.strictEqual(N.minutesDansLaJournee(mlb('22:05'), HIER), 1325, 'sur sa propre grille, à sa place');
  assert.strictEqual(N.minutesDansLaJournee({ startTime: '22:05' }, AUJ), 1325, 'sans date : l\'heure telle quelle');
  assert.strictEqual(N.minutesDansLaJournee({ startTime: 'LIVE' }, AUJ), null);
  const liste = [mlb('00:30', { matchDate: AUJ }), { startTime: '', matchDate: AUJ }, mlb('22:05'), mlb('00:10', { matchDate: AUJ })];
  liste.sort((a, b) => N.comparerHeures(a, b, AUJ));
  assert.deepStrictEqual(liste.map((m) => m.startTime), ['22:05', '00:10', '00:30', ''], 'hier soir d\'abord, puis la nuit, puis sans heure');
  ok('le match d\'hier soir passe avant 00:00 dans la grille et les listes');

  // ── 6. Le flux relu après minuit, daté du jour par le serveur ────────────
  const flux = (startTime, extra) => Object.assign({ startTime, matchDate: AUJ }, extra || {});
  assert.strictEqual(N.memeMatchATraversLaNuit(mlb('22:05'), flux('22:05')), true, 'même heure, jours consécutifs, déborde');
  assert.strictEqual(N.memeMatchATraversLaNuit(flux('22:05'), mlb('22:05')), true, 'dans l\'autre sens aussi');
  assert.strictEqual(N.memeMatchATraversLaNuit(mlb('22:05'), flux('00:00')), true, '« 00:00 » : le parseur n\'a pas trouvé l\'heure');
  assert.strictEqual(N.memeMatchATraversLaNuit(mlb('22:05'), flux('LIVE')), true, 'heure illisible : on laisse les équipes décider');
  assert.strictEqual(N.memeMatchATraversLaNuit(mlb('22:05'), flux('19:00')), false, 'une autre heure : un autre match');
  assert.strictEqual(N.memeMatchATraversLaNuit(mlb('14:00', { durationMinutes: null }), flux('14:00')), false, '14:00 hier ne déborde pas, même largement');
  assert.strictEqual(N.memeMatchATraversLaNuit(mlb('22:05'), flux('22:05', { matchDate: DEMAIN })), false, 'deux jours d\'écart');
  assert.strictEqual(N.memeMatchATraversLaNuit(mlb('22:05'), mlb('22:05')), false, 'même jour : rien à traverser');
  assert.strictEqual(N.memeMatchATraversLaNuit(mlb('22:05'), { startTime: '22:05' }), false, 'sans date : rien à traverser');
  ok('memeMatchATraversLaNuit laisse l\'appariement passer d\'un jour à l\'autre, à la même heure');

  console.log('unit_nuit: ' + n + ' groupes de tests OK');
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

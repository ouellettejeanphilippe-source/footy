/* Appariement d'un nom d'équipe avec la base (js/db.js).

   Deux défauts relevés le 4 septembre 2026, tous deux de la même famille : l'appariement
   se fait sur le nom seul, sans tenir compte du contexte ni de la qualité des données.

   1. **Sport ignoré.** OnHockey annonce « Pelicans » pour un match de Liiga. L'alias
      « pelicans » — que seuls les New Orleans Pelicans revendiquent dans la base — le
      résolvait en équipe NBA : la carte affichait « New Orleans Pelicans vs Vaasan Sport »
      dans un championnat de hockey finlandais. Ce n'est pas une ambiguïté entre deux
      entrées : le club de Lahti n'est pas dans la base, et l'alias d'un autre sport a
      comblé le vide.

   2. **Doublons masquants.** La base contient des entrées nées de noms mal analysés puis
      enregistrés comme de nouvelles équipes — « parissaintgermain » à côté de
      « paris saint-germain ». Le doublon ne porte qu'une vignette fabriquée à partir du
      nom, et il MASQUAIT le vrai blason du club, l'index normalisé gardant la dernière
      clé rencontrée. Quatre clubs concernés. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://exemple.test/' });
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement']) {
    Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
  }
  const db = await import('../js/db.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  // ── 1. La résolution ne traverse plus les sports ──────────────────────────
  {
    assert.strictEqual(db.getOfficialTeamName('Pelicans'), 'New Orleans Pelicans',
      'sans contexte, l\'alias NBA gagne — c\'est le comportement d\'origine');
    assert.strictEqual(db.getOfficialTeamName('Pelicans', false, 'hockey'), 'Pelicans',
      'en hockey, on rend le nom d\'origine : non résolu, mais jamais faux');
    assert.strictEqual(db.getOfficialTeamName('Pelicans', false, 'basket'), 'New Orleans Pelicans',
      'et en basket, la résolution reste acquise');
    ok('un nom n\'est plus résolu vers une équipe d\'un autre sport');
  }
  {
    // Une résolution DANS le bon sport ne doit pas être empêchée.
    assert.strictEqual(db.getOfficialTeamName('Sharks', false, 'hockey'), 'San Jose Sharks',
      'les Sharks sont bien une équipe de hockey');
    ok('une résolution dans le bon sport passe toujours');
  }
  {
    // Sport inconnu de la base ou absent : on ne bloque rien.
    assert.strictEqual(db.getOfficialTeamName('Sharks', false, null), db.getOfficialTeamName('Sharks'));
    assert.strictEqual(db.getOfficialTeamName('', false, 'hockey'), '');
    assert.strictEqual(db.getOfficialTeamName(null, false, 'hockey'), null);
    ok('getOfficialTeamName tolère un sport absent ou une entrée vide');
  }

  // ── 2. Un doublon ne masque plus le vrai blason ───────────────────────────
  {
    /* Ces quatre clubs ont deux entrées dans la base : la forme correcte, avec son
       blason, et une forme mal analysée qui ne porte qu'une vignette générée. */
    const paires = [
      ['Parissaintgermain', 'Paris Saint-Germain'],
      ['Rennes', 'Stade Rennais'],
      ['Auxerre', 'AJ Auxerre'],
      ['Blue Jays', 'Toronto Blue Jays']
    ];
    for (const [mal, correct] of paires) {
      assert.ok(db.isRealCrest(db.getLogo(mal)),
        mal + ' devrait retrouver le blason de ' + correct + ', pas une vignette');
      assert.strictEqual(db.getLogo(mal), db.getLogo(correct),
        mal + ' et ' + correct + ' désignent le même club, donc le même blason');
    }
    ok('une entrée mal analysée ne masque plus le blason du club');
  }
  {
    // Les clubs sans doublon ne doivent pas être affectés.
    assert.ok(db.isRealCrest(db.getLogo('Liverpool')));
    assert.ok(db.isRealCrest(db.getLogo('Real Betis')));
    ok('les clubs sans doublon gardent leur blason');
  }
  {
    assert.strictEqual(db.isRealCrest('https://a.espncdn.com/i/teamlogos/soccer/500/160.png'), true);
    assert.strictEqual(db.isRealCrest('https://ui-avatars.com/api/?name=X'), false,
      'une vignette fabriquée à partir du nom n\'est pas un blason');
    assert.strictEqual(db.isRealCrest(''), false);
    assert.strictEqual(db.isRealCrest(null), false);
    ok('isRealCrest distingue un blason d\'une vignette générée');
  }
  {
    // Toute équipe obtient une image et des couleurs : il y a toujours un repli.
    for (const t of ['Équipe Inconnue Du Test', 'Zzz FC']) {
      assert.ok(db.getLogo(t), t + ' doit obtenir une image, même de repli');
      const c = db.getTeamColors(t);
      assert.ok(Array.isArray(c) && c.length >= 2, t + ' doit obtenir des couleurs');
    }
    ok('une équipe inconnue reçoit tout de même image et couleurs');
  }

  // ── 3. Un libellé générique est une invitation à déduire, pas une ligue ───────
  assert.strictEqual(db.isGenericLeagueLabel('Baseball'), true);
  assert.strictEqual(db.isGenericLeagueLabel('Soccer'), true);
  assert.strictEqual(db.isGenericLeagueLabel('MLB'), false);
  assert.strictEqual(db.isGenericLeagueLabel('Ligue 1'), false);
  ok('les noms de sport sont reconnus comme libellés génériques, pas les compétitions');

  // ── 4. Les deux équipes désignent la ligue ────────────────────────────────────
  /* Relevé du 4 septembre 2026 : 209 matchs portaient un libellé générique, dont les 29
     de « Baseball » — tous de la MLB, affichés dans une section séparée de « MLB ». */
  assert.strictEqual(db.leagueFromPairing('Baseball', 'Cleveland Guardians', 'Detroit Tigers'), 'mlb');
  assert.strictEqual(db.leagueFromPairing('Soccer', 'Real Madrid', 'Real Betis'), 'la liga');
  ok('deux équipes de la même ligue font remonter la ligue');

  // ── 5. Une seule équipe connue ne suffit pas ──────────────────────────────────
  assert.strictEqual(db.leagueFromPairing('Baseball', 'Detroit Tigers', 'Équipe Inconnue'), 'Baseball');
  assert.strictEqual(db.leagueFromPairing('Soccer', 'Inconnu A', 'Inconnu B'), 'Soccer');
  ok('une seule équipe connue, ou aucune, laisse le libellé intact');

  // ── 6. La déduction ne traverse pas les sports ────────────────────────────────
  /* Même famille de défaut que le point 1 : sans garde-fou, « Baseball » avec deux clubs
     de football se verrait attribuer une ligue de football. */
  assert.strictEqual(db.leagueFromPairing('Baseball', 'Real Madrid', 'Real Betis'), 'Baseball');
  ok('le sport annoncé par le libellé est vérifié avant d\'accepter la ligue déduite');

  // ── 7. Une ligue déjà nommée n'est jamais réécrite ────────────────────────────
  assert.strictEqual(db.leagueFromPairing('Ligue 1', 'Real Madrid', 'Real Betis'), 'Ligue 1');
  assert.strictEqual(db.leagueFromPairing('NHL', 'Detroit Tigers', 'Cleveland Guardians'), 'NHL');
  ok('un libellé non générique passe tel quel, quoi que disent les équipes');

  // ── 8. La ligue lève l'ambiguïté d'une ville seule ────────────────────────────
  /* L'autre sens de l'appariement : « Houston » ne désigne rien à lui seul — Texans,
     Astros, Rockets, Dynamo. Avec la ligue il ne reste qu'un candidat, ou aucun. */
  assert.strictEqual(db.teamFromCityAndLeague('Houston', 'nfl'), 'Houston Texans');
  assert.strictEqual(db.teamFromCityAndLeague('Houston', 'mlb'), 'Houston Astros');
  assert.strictEqual(db.teamFromCityAndLeague('Houston', ''), '');
  ok('une ville seule se résout par la ligue, et jamais sans elle');

  // ── 9. Une ville ambiguë DANS la ligue reste non résolue ──────────────────────
  /* « New York » compte deux équipes en MLB (Mets, Yankees) et trois en NFL : on
     n'invente pas, le nom d'origine est conservé. */
  assert.strictEqual(db.teamFromCityAndLeague('New York', 'mlb'), '');
  assert.strictEqual(db.teamFromCityAndLeague('New York', 'nfl'), '');
  ok('une ville que plusieurs équipes de la même ligue revendiquent n\'est pas tranchée');

  // ── 10. Les trois axes appliqués ensemble ─────────────────────────────────────
  var r = db.resolvePairing({ league: 'Baseball', homeTeam: 'Houston', awayTeam: 'Detroit Tigers' });
  assert.strictEqual(r.league, 'mlb');
  assert.strictEqual(r.homeTeam, 'Houston Astros');
  assert.strictEqual(r.awayTeam, 'Detroit Tigers');
  /* Rien à déduire : le triplet ressort intact, jamais vidé. */
  var r2 = db.resolvePairing({ league: 'Soccer', homeTeam: 'Inconnu A', awayTeam: 'Inconnu B' });
  assert.deepStrictEqual(r2, { league: 'Soccer', homeTeam: 'Inconnu A', awayTeam: 'Inconnu B' });
  ok('resolvePairing enchaîne les deux sens et ne vide jamais un champ');

  // ── 11. Un même championnat, un seul libellé ──────────────────────────────────
  /* Relevé du 4 septembre 2026 : « Cfb » (66 matchs), « Ncaaf » (55) et « Ncaa Division 1
     Football » (3) créaient TROIS sections pour un seul championnat, toutes classées au
     niveau « other » faute d'alias, donc reléguées dans « Autres streams ». */
  ['Cfb', 'CFB', 'Ncaaf', 'NCAAF', 'College Football', 'Ncaa Division 1 Football']
    .forEach(function(v) {
      assert.strictEqual(db.formatLeagueName(v), 'NCAA Football', v + ' devrait donner NCAA Football');
    });
  assert.strictEqual(db.leagueTier('NCAA Football'), 'secondary');
  /* Idempotence : le libellé déjà normalisé doit repasser sans bouger, sinon le cache
     déjà écrit dériverait à chaque chargement. */
  assert.strictEqual(db.formatLeagueName(db.formatLeagueName('Cfb')), 'NCAA Football');
  ok('les sigles du football universitaire se rejoignent sur une seule section, reconnue');

  console.log('unit_pairing: ' + n + ' groupes de tests OK');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

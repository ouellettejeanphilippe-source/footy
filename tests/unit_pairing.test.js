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

  console.log('unit_pairing: ' + n + ' groupes de tests OK');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

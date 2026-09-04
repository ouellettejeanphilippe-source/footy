/* Classement d'une ligue par sport (js/config.js).

   Ce fichier existe à cause d'une panne que la relecture ne pouvait pas voir. Les
   ancres `\b` des expressions de `sportOfLeague` avaient été remplacées, dans le
   fichier source, par 36 caractères de contrôle « retour arrière » (U+0008) — le
   résultat d'un outil ayant interprété l'échappement au lieu de l'écrire. Les
   expressions cherchaient alors ce caractère de contrôle, qu'aucun nom de ligue ne
   contient : toutes les alternatives ainsi encadrées étaient mortes.

   Ce qui rendait le défaut retors :
   - la moitié de la fonction marchait — les mots entiers (baseball, hockey, soccer)
     n'étaient pas encadrés, seuls les SIGLES l'étaient ;
   - afficher la source avec console.log ne le montrait pas, le terminal interprétant
     le retour arrière comme un effacement : le code semblait juste.

   Relevé sur le cache du 4 septembre 2026 : 224 matchs sur 503 classés « other », dont
   les 124 de football universitaire, 29 de MLB et 17 de NFL — donc rangés dans
   « Autres streams » au lieu de leur sport. Après correction : 79.

   Ces tests couvrent chaque sigle, précisément parce que ce sont eux qui étaient morts. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://exemple.test/' });
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement']) {
    Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
  }
  const C = await import('../js/config.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  {
    /* Aucune expression de la fonction ne doit contenir de caractère de contrôle.
       C'est le test qui aurait attrapé la panne d'origine, et le seul qui la
       rattraperait si un outil réintroduisait la même substitution. */
    const src = C.sportOfLeague.toString();
    const controles = [...src].filter((c) => c.charCodeAt(0) < 32 && c !== '\n' && c !== '\r' && c !== '\t');
    assert.deepStrictEqual(controles, [],
      'sportOfLeague contient ' + controles.length + ' caractère(s) de contrôle : les ancres \\b ont été mangées');
    ok('aucune ancre \\b n\'a été remplacée par un caractère de contrôle');
  }

  // ── Les sigles : c'est exactement ce qui était mort ────────────────────────
  {
    const attendu = {
      'MLB': 'mlb', 'NFL': 'nfl', 'NBA': 'nba', 'NHL': 'nhl', 'WNBA': 'wnba',
      'CFL': 'cfl', 'CFB': 'cfb', 'NCAAF': 'cfb', 'NCAAB': 'ncaab',
      'UFC': 'mma', 'MMA': 'mma', 'PFL': 'mma', 'WWE': 'wwe', 'AEW': 'wwe', 'TNA': 'wwe',
      'F1': 'f1', 'MLS': 'soccer', 'KHL': 'nhl', 'AHL': 'nhl', 'SHL': 'nhl', 'Liiga': 'nhl'
    };
    for (const [ligue, sport] of Object.entries(attendu)) {
      assert.strictEqual(C.sportOfLeague(ligue), sport, `${ligue} devrait être ${sport}`);
    }
    ok('chaque sigle de ligue est classé dans son sport');
  }
  {
    // La casse ne doit rien changer : les sources écrivent « Cfb », « MLB », « mlb ».
    for (const v of ['cfb', 'Cfb', 'CFB']) assert.strictEqual(C.sportOfLeague(v), 'cfb', v);
    for (const v of ['ncaaf', 'Ncaaf', 'NCAAF']) assert.strictEqual(C.sportOfLeague(v), 'cfb', v);
    ok('le classement ne dépend pas de la casse');
  }
  {
    // Les mots entiers, qui eux n'avaient jamais cessé de marcher.
    const attendu = {
      'Baseball': 'mlb', 'Ice Hockey': 'nhl', 'Basketball': 'nba', 'Boxing': 'boxing',
      'Cricket': 'cricket', 'Tennis': 'tennis', 'Rugby Union': 'rugby', 'Motorsport': 'motor',
      'Premier League': 'soccer', 'Ligue 1': 'soccer', 'Club Friendly': 'soccer',
      'Peruvian Primera Division': 'soccer'
    };
    for (const [ligue, sport] of Object.entries(attendu)) {
      assert.strictEqual(C.sportOfLeague(ligue), sport, `${ligue} devrait être ${sport}`);
    }
    ok('les noms écrits en toutes lettres restent bien classés');
  }
  {
    /* Les ancres servent à quelque chose : sans elles, « mlb » attraperait des mots qui
       le contiennent. C'est pour cela qu'on les rétablit plutôt que de les supprimer. */
    assert.notStrictEqual(C.sportOfLeague('Gimlbourg United'), 'mlb', 'un mot contenant « mlb » n\'est pas la MLB');
    assert.notStrictEqual(C.sportOfLeague('Anfltown FC'), 'nfl', 'un mot contenant « nfl » n\'est pas la NFL');
    ok('les ancres empêchent un sigle d\'attraper un mot qui le contient');
  }
  {
    assert.strictEqual(C.sportOfLeague(''), 'other');
    assert.strictEqual(C.sportOfLeague(null), 'other');
    assert.strictEqual(C.sportOfLeague(undefined), 'other');
    assert.strictEqual(C.sportOfLeague('Curling'), 'other', 'un sport non couvert reste « other », sans erreur');
    ok('sportOfLeague tolère une entrée vide ou inconnue');
  }

  console.log('unit_sports: ' + n + ' groupes de tests OK');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

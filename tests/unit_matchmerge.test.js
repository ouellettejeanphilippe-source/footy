/* Tests unitaires de mergeMatches / isMatch (js/match.js), sans réseau.

   Corrige une régression trouvée le 5 septembre 2026 sur les données réelles de
   footybite : mergeMatches() fusionnait silencieusement des matchs totalement
   différents dès que l'un des deux avait une équipe visiteuse vide/TBD, à cause
   de trois raccourcis d'isMatch() trop permissifs pour ce cas :
     1. la fenêtre glissante ("rest" tiré de "nottinghamforest" ~ 80% proche de
        "brest" — Nottingham Forest absorbait Le Havre vs Brest) ;
     2. la simple inclusion de sous-chaîne ("rangers" contenu dans
        "queensparkrangers", "austin" dans "austinfc", etc.) ;
     3. la même inclusion, nichée dans le raccourci « même ville » de TEAM_DATA
        ("diego" — nom d'équipe mal découpé de San Diego FC — contenu dans
        "diego padres").
   Sur la page d'accueil de footybite (180 matchs), ces trois raccourcis
   détruisaient à eux seuls 24 matchs le même jour, dont Le Havre vs Brest,
   Lens vs Lorient, Nice vs Le Mans et Roma vs Atalanta. Aucune erreur ne
   signalait la perte : mergeMatches() garde toujours l'entrée existante et
   jette silencieusement la nouvelle quand isMatchPair() les juge identiques.

   Le correctif ajoute un paramètre `strict` à isMatch(), utilisé uniquement
   quand une des deux équipes comparées est TBD/vide (et dans le raccourci
   Racing/Event) : dans ce cas précis, on compare un nom à TOUT le reste de la
   base plutôt que deux mentions du même nom, donc les trois raccourcis par
   fragment deviennent un risque plutôt qu'un filet de sécurité, et sont
   sautés. Les usages où les deux équipes des deux matchs sont déjà connues
   restent inchangés (aucune régression sur les vrais doublons/coquilles). */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://x.test/' });
    const w = dom.window;
    for (const k of ['window', 'document', 'DOMParser', 'localStorage', 'navigator', 'HTMLElement']) {
        Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
    }

    const match = await import('../js/match.js');

    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    const today = '2026-09-05';
    const m = (over) => Object.assign({
        league: 'Ligue 1', homeTeam: 'A', awayTeam: 'B', matchDate: today, status: 'live'
    }, over);

    // ── 1. Fenêtre glissante : un match TBD ne doit pas avaler un match sans rapport ──
    let all = [];
    all = match.mergeMatches(all, [m({ homeTeam: 'Nottingham Forest', awayTeam: '' })]);
    all = match.mergeMatches(all, [m({ homeTeam: 'Le Havre', awayTeam: 'Brest' })]);
    assert.ok(all.some(x => x.homeTeam === 'Le Havre' && x.awayTeam === 'Brest'),
        '"rest" (dans nottinghamforest) ~80% proche de "brest" ne doit plus fusionner les deux matchs');
    assert.strictEqual(all.length, 2, 'les deux matchs restent deux entrées distinctes');
    ok('fenêtre glissante : Le Havre vs Brest survit face à Nottingham Forest vs (TBD)');

    // ── 2. Inclusion de sous-chaîne : équipes homonymes partielles ──────────
    all = [];
    all = match.mergeMatches(all, [m({ league: 'Efl Championship', homeTeam: 'Queens Park Rangers', awayTeam: '' })]);
    all = match.mergeMatches(all, [m({ league: 'Scottish Premiership', homeTeam: 'Rangers', awayTeam: '' })]);
    assert.strictEqual(all.length, 2,
        '"rangers" est une sous-chaîne de "queensparkrangers", mais ce sont deux clubs distincts');
    ok('inclusion directe : Rangers (Écosse) survit face à Queens Park Rangers (TBD)');

    // ── 3. Inclusion nichée dans le raccourci « même ville » de TEAM_DATA ───
    all = [];
    all = match.mergeMatches(all, [m({ league: 'MLS', homeTeam: 'San Diego FC', awayTeam: '' })]);
    all = match.mergeMatches(all, [m({ league: 'MLB', homeTeam: 'San Diego Padres', awayTeam: '' })]);
    assert.strictEqual(all.length, 2,
        '"diego" (teamName mal découpé de San Diego FC) est une sous-chaîne de "diego padres"');
    ok('inclusion « même ville » : San Diego Padres survit face à San Diego FC (TBD)');

    // ── 4. Racing/Event : un Grand Prix ne doit pas avaler un match de foot ──
    all = [];
    all = match.mergeMatches(all, [m({ league: 'Serie A', homeTeam: 'Roma', awayTeam: 'Atalanta' })]);
    all = match.mergeMatches(all, [m({ league: 'F1', homeTeam: 'Italian Grand Prix Qualifying', awayTeam: '' })]);
    assert.ok(all.some(x => x.homeTeam === 'Roma' && x.awayTeam === 'Atalanta'),
        '"italian" ne doit plus être jugé proche de "romaatalanta" via la fenêtre glissante');
    assert.strictEqual(all.length, 2, 'le Grand Prix et le match de Serie A restent deux entrées distinctes');
    ok('Racing/Event : Roma vs Atalanta survit face à Italian Grand Prix Qualifying');

    // ── 5. Non-régression : deux mentions du même nom, l'une tronquée, doivent toujours fusionner ──
    all = [];
    all = match.mergeMatches(all, [m({ homeTeam: 'Tampa Bay Lightning', awayTeam: 'Boston Bruins', league: 'NHL' })]);
    all = match.mergeMatches(all, [m({ homeTeam: 'Tanpa', awayTeam: 'Boston Bruins', league: 'NHL' })]);
    assert.strictEqual(all.length, 1,
        'la fenêtre glissante doit toujours rattraper une coquille du MÊME nom quand les deux équipes sont connues');
    ok('non-régression : coquille du même nom (Tanpa/Tampa) toujours fusionnée quand les deux équipes sont connues');

    // ── 6. Racing/Event : un résidu trop court n'apparie rien ──────────────
    /* Relevé sur le cache du 6 septembre 2026 : « F1 Main Race », une fois les termes
       génériques retirés, ne laisse que « main » — que « Sunday Nights Main Event »
       contient. Le gala de la WWE portait donc les liens de la F1, et par ricochet ceux
       du MotoGP fusionnés dans la même entrée. */
    all = [];
    all = match.mergeMatches(all, [m({ league: 'WWE', homeTeam: 'Sunday Nights Main Event', awayTeam: '' })]);
    all = match.mergeMatches(all, [m({ league: 'F1', homeTeam: 'F1 Main Race', awayTeam: '' })]);
    all = match.mergeMatches(all, [m({ league: 'Motorsport', homeTeam: 'MotoGP Main Race', awayTeam: '' })]);
    assert.strictEqual(all.length, 3, '« main » ne suffit pas à apparier un gala WWE et une course de F1');
    assert.strictEqual(match.isMatchPair(
        m({ league: 'F1', homeTeam: 'Italian Grand Prix', awayTeam: '' }),
        m({ league: 'F1', homeTeam: 'F1 Italian Grand Prix Race', awayTeam: '' })), true,
        'un vrai nom d\'épreuve (« italian ») continue d\'apparier ses séances');
    ok('Racing/Event : Sunday Nights Main Event ne reçoit plus les liens de la F1');

    // ── 7. Deux sports différents ne s'apparient jamais ─────────────────────
    /* Relevé sur les pages réelles du 6 septembre 2026 : « Miami FC vs Pittsburgh
       Riverhounds » (USL) recevait les liens de « Miami vs Pitt » (football
       universitaire) — « pitt » est contenu dans « pittsburghriverhounds ». */
    assert.strictEqual(match.isMatchPair(
        m({ league: 'American Usl Championship', homeTeam: 'Miami FC', awayTeam: 'Pittsburgh Riverhounds' }),
        m({ league: 'NCAA Football', homeTeam: 'Miami', awayTeam: 'Pitt' })), false,
        'football (soccer) et football universitaire ne se mélangent pas');
    assert.strictEqual(match.isMatchPair(
        m({ league: 'F1', homeTeam: 'Italian Grand Prix', awayTeam: '' }),
        m({ league: 'Motorsport', homeTeam: 'Italian Grand Prix Race', awayTeam: '' })), true,
        '« F1 » et « Motorsport » sont deux étiquettes d\'une même famille');
    assert.strictEqual(match.isMatchPair(
        m({ league: 'NCAAF', homeTeam: 'Texas Longhorns', awayTeam: 'Texas State Bobcats' }),
        m({ league: 'American Football', homeTeam: 'Texas', awayTeam: 'Texas State' })), true,
        '« American Football » (source) et NCAAF (API) restent compatibles');
    assert.strictEqual(match.isMatchPair(
        m({ league: 'Top 14', homeTeam: 'Toulouse', awayTeam: 'La Rochelle' }),
        m({ league: 'Sports', homeTeam: 'Toulouse', awayTeam: 'La Rochelle' })), true,
        'une ligue inconnue (« other ») n\'exclut rien');
    assert.strictEqual(match.sportFamily('cfb'), match.sportFamily('nfl'));
    assert.strictEqual(match.sportFamily('ncaab'), match.sportFamily('nba'));
    assert.notStrictEqual(match.sportFamily('soccer'), match.sportFamily('cfb'));
    ok('sports différents : refus ; étiquettes d\'une même famille : compatibles');

    // ── 8. Les mots génériques ne valident rien ────────────────────────────
    /* « Kent State vs South Carolina » obtenait 3 mots sur 4 (south, carolina, state)
       face à « Florida A&M vs South Carolina State » ; « Fordham vs North Dakota State »
       3 sur 4 face à « Northwestern vs South Dakota State ». */
    assert.strictEqual(match.isMatchPair(
        m({ league: 'NCAA Football', homeTeam: 'Florida A and M', awayTeam: 'South Carolina State' }),
        m({ league: 'NCAA Football', homeTeam: 'Kent State', awayTeam: 'South Carolina' })), false,
        '« south », « state » ne prouvent pas que Kent State joue contre Florida A&M');
    assert.strictEqual(match.isMatchPair(
        m({ league: 'NCAA Football', homeTeam: 'Northwestern', awayTeam: 'South Dakota State' }),
        m({ league: 'NCAA Football', homeTeam: 'Fordham', awayTeam: 'North Dakota State' })), false,
        '« north » (dans Northwestern), « dakota », « state » ne font pas un match');
    assert.strictEqual(match.isMatchPair(
        m({ league: 'NCAA Football', homeTeam: 'North Dakota State', awayTeam: 'Fordham' }),
        m({ league: 'NCAA Football', homeTeam: 'Fordham Rams', awayTeam: 'North Dakota State Bison' })), true,
        'le vrai match, avec surnoms d\'un côté, s\'apparie toujours');
    assert.strictEqual(match.isMatchPair(
        m({ league: 'MLB', homeTeam: 'Detroit Tigers', awayTeam: 'Cleveland Guardians' }),
        m({ league: 'MLB', homeTeam: 'Detroit', awayTeam: 'Cleveland' })), true,
        'deux villes significatives suffisent encore');
    assert.strictEqual(match.isMatchPair(
        m({ league: 'MLB', homeTeam: 'New York Mets', awayTeam: 'San Francisco Giants' }),
        m({ league: 'MLB', homeTeam: 'San Diego Padres', awayTeam: 'New York Yankees' })), false,
        '« york » et « san » ne font pas un match : tous les mots désignants doivent s\'aligner');
    assert.strictEqual(match.isMatchPair(
        m({ league: 'NCAA Football', homeTeam: 'Florida', awayTeam: 'Florida Atlantic' }),
        m({ league: 'NCAA Football', homeTeam: 'South Florida Bulls', awayTeam: 'Florida International Panthers' })), false,
        '« Florida Atlantic » n\'est pas « Florida International »');
    assert.strictEqual(match.isMatchPair(
        m({ league: 'NCAA Football', homeTeam: 'Texas', awayTeam: 'Texas State' }),
        m({ league: 'NCAA Football', homeTeam: 'Texas Longhorns', awayTeam: 'Texas State Bobcats' })), true,
        'le nom complet ESPN (surnom compris) s\'apparie au nom court de la source');
    ok('validation croisée : seuls les mots qui désignent une équipe comptent');

    console.log(`unit_matchmerge: ${n} groupes de tests OK`);
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

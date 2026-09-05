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

    console.log(`unit_matchmerge: ${n} groupes de tests OK`);
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

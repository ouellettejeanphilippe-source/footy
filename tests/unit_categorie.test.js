/* Coquilles tolérées, catégories jamais confondues (js/match.js).

   « Le système avec noms d'équipes, ville et compagnie doit inclure qu'il y a généralement
   des typos, mais que c'est reconnaissable quand même. » (6 septembre 2026)

   Mesuré avant d'écrire, sur le cache réel du jour (748 noms d'équipes distincts, 29
   paires à un ou deux caractères d'écart) : la similarité NE PEUT PAS séparer une coquille
   d'une équipe distincte, parce que les deux vivent dans les mêmes chiffres.

       arsenal    / arsenl      coquille    similarité 0,857
       newyorkjets/ newyorkmets DEUX ÉQUIPES similarité 0,909
       nflnetwork / nhlnetwork  DEUX CHAÎNES similarité 0,900

   Tout seuil qui accepte la première accepte les deux autres. Ce qui les sépare est le
   contexte — l'adversaire, la ligue, l'heure — et il fait déjà son travail : « Arkansas
   State vs Iowa State » ne s'apparie pas à « Kansas State vs Army ».

   Restait le cas où tout concorde sauf une lettre : l'équipe féminine et l'équipe
   masculine du même club, au même moment. Là, l'appariement réussissait et `mergeMatches`
   ne gardant qu'une entrée, un des deux matchs disparaissait de la grille avec ses liens.
   Sur le cache du jour : Atlanta Dream W, Bayern Munich W, Connecticut Sun W, Dallas
   Wings W, Los Angeles Sparks W, Portland Fire W, Seattle Storm W. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://x.test/' });
    const w = dom.window;
    w.__NO_AUTOSTART__ = true;
    for (const k of ['window', 'document', 'DOMParser', 'localStorage', 'navigator', 'HTMLElement', 'Event', 'CustomEvent', 'location', 'history', 'getComputedStyle']) {
        Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
    }
    const M = await import('../js/match.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    // ── 1. Les coquilles restent reconnues, d'un côté comme des deux ─────────
    const paire = (a, b) => M.debugMatchPair(a, b);
    assert.strictEqual(paire(
        { league: 'Premier League', homeTeam: 'Manchester United', awayTeam: 'Everton', startTime: '11:30' },
        { league: 'Premier League', homeTeam: 'Manchestr United', awayTeam: 'Everton', startTime: '11:30' }).isMatch, true,
        'une lettre manquante ne doit pas casser l\'appariement');
    assert.strictEqual(paire(
        { league: 'NHL', homeTeam: 'Tampa Bay Lightning', awayTeam: 'Florida Panthers' },
        { league: 'NHL', homeTeam: 'Tanpa Bay Lightning', awayTeam: 'Florida Panthrs' }).isMatch, true,
        'une coquille de chaque côté reste le même match');
    assert.strictEqual(paire(
        { league: 'Extraliga', homeTeam: 'Slavutich', awayTeam: 'Donbass' },
        { league: 'Extraliga', homeTeam: 'Slavutych', awayTeam: 'Donbass' }).isMatch, true,
        'translittération variable (i/y) : même équipe');
    ok('les coquilles restent reconnues, d\'un côté comme des deux');

    // ── 2. Le contexte sépare les équipes proches mais distinctes ────────────
    assert.strictEqual(paire(
        { league: 'NCAAF', homeTeam: 'Arkansas State', awayTeam: 'Iowa State', startTime: '12:00' },
        { league: 'NCAAF', homeTeam: 'Kansas State', awayTeam: 'Army', startTime: '15:30' }).isMatch, false,
        'Arkansas State et Kansas State : l\'adversaire tranche');
    assert.strictEqual(paire(
        { league: 'Serie A', homeTeam: 'Internazionale', awayTeam: 'Torino' },
        { league: 'Brasileirao', homeTeam: 'Internacional', awayTeam: 'Fluminense' }).isMatch, false,
        'Inter de Milan et Internacional de Porto Alegre');
    ok('deux équipes proches mais distinctes restent séparées par leur contexte');

    // ── 3. Marqueurs de catégorie : lus, et jamais franchis ──────────────────
    assert.strictEqual(M.marqueurCategorie('Atlanta Dream W'), 'F');
    assert.strictEqual(M.marqueurCategorie('Arsenal Women'), 'F');
    assert.strictEqual(M.marqueurCategorie('Bayern Munich Frauen'), 'F');
    assert.strictEqual(M.marqueurCategorie('Chelsea U21'), 'U21');
    assert.strictEqual(M.marqueurCategorie('Real Madrid II'), 'R');
    assert.strictEqual(M.marqueurCategorie('Atlanta Dream'), '', 'aucun marqueur : catégorie senior');
    assert.strictEqual(M.marqueurCategorie('Wolverhampton Wanderers'), '', 'un nom ordinaire n\'est pas un marqueur');
    assert.strictEqual(M.marqueurCategorie('Barcelona'), '', 'un nom d\'un seul mot n\'est jamais « club + marqueur »');
    ok('marqueurs lus : féminin, âge, réserve — et rien d\'autre');

    // ── 4. Le match féminin n'absorbe plus le match masculin ─────────────────
    /* Révisé le 7 septembre 2026 : sous une ligue féminine connue (WNBA), l'entrée
       sans marqueur EST l'équipe féminine — il n'existe pas d'Atlanta Dream masculin —
       et c'est le match ESPN que les entrées « W » des sources doivent rejoindre. La
       séparation vaut quand la ligue ne dit rien (groupe 6) ou dit le contraire. */
    assert.strictEqual(paire(
        { league: 'WNBA', homeTeam: 'Atlanta Dream W', awayTeam: 'Minnesota Lynx W' },
        { league: 'WNBA', homeTeam: 'Atlanta Dream', awayTeam: 'Minnesota Lynx' }).isMatch, true,
        'sous la WNBA, « Atlanta Dream » est déjà l\'équipe féminine');
    assert.strictEqual(paire(
        { league: 'Frauen-Bundesliga', homeTeam: 'Bayern Munich W', awayTeam: 'Wolfsburg W' },
        { league: 'Bundesliga', homeTeam: 'Bayern Munich', awayTeam: 'Wolfsburg' }).isMatch, false);
    assert.strictEqual(paire(
        { league: 'Youth League', homeTeam: 'Chelsea U21', awayTeam: 'Arsenal U21' },
        { league: 'Premier League', homeTeam: 'Chelsea', awayTeam: 'Arsenal' }).isMatch, false,
        'les équipes de jeunes ne sont pas l\'équipe première');
    ok('féminin, jeunes et réserve n\'absorbent plus l\'équipe première');

    // ── 5. Deux libellés de la MÊME catégorie se rejoignent ──────────────────
    assert.strictEqual(paire(
        { league: 'WSL', homeTeam: 'Arsenal W', awayTeam: 'Chelsea W' },
        { league: 'WSL', homeTeam: 'Arsenal Women', awayTeam: 'Chelsea Women' }).isMatch, true,
        '« W » et « Women » désignent la même équipe');
    assert.strictEqual(paire(
        { league: 'WNBA', homeTeam: 'Atlanta Dream W', awayTeam: 'Minnesota Lynx W' },
        { league: 'WNBA', homeTeam: 'Atlanta Dream W', awayTeam: 'Minnesota Lynx' }).isMatch, true,
        'une source ne marque parfois qu\'une des deux équipes');
    ok('deux façons d\'écrire la même catégorie s\'apparient');

    // ── 6. ESPN n'écrit jamais le marqueur : la ligue le porte ────────────────
    /* Relevé le 7 septembre 2026 sur le cache publié : « Atlanta Dream W vs Minnesota
       Lynx W » (Buffstreams, étiquette « NCAA Men's Basketball » fausse) et « Italy W vs
       China W » (VIPLeague, « Basketball ») ne rejoignaient plus jamais le match ESPN —
       « senior vs F » — et les cartes WNBA et FIBA féminine restaient sans lien. */
    assert.strictEqual(paire(
        { league: 'WNBA', homeTeam: 'Atlanta Dream', awayTeam: 'Minnesota Lynx' },
        { league: "NCAA Men's Basketball", homeTeam: 'Atlanta Dream W', awayTeam: 'Minnesota Lynx W' }).isMatch, true,
        'la WNBA d\'ESPN rejoint les entrées « W » des sources');
    assert.strictEqual(paire(
        { league: 'FIBA WORLD CUP', homeTeam: 'China', awayTeam: 'Italy' },
        { league: 'Basketball', homeTeam: 'Italy W', awayTeam: 'China W' }).isMatch, true,
        'la Coupe du monde FIBA (édition féminine en 2026) aussi, même inversée');
    assert.strictEqual(paire(
        { league: 'Basketball', homeTeam: 'Atlanta Dream', awayTeam: 'Minnesota Lynx' },
        { league: 'Basketball', homeTeam: 'Atlanta Dream W', awayTeam: 'Minnesota Lynx W' }).isMatch, false,
        'sans ligue féminine connue, un côté sans marqueur reste ambigu : pas d\'appariement (doublons d\'une même grille)');
    assert.strictEqual(paire(
        { league: 'NCAA Women\'s Basketball', homeTeam: 'Iowa Hawkeyes', awayTeam: 'LSU Tigers' },
        { league: 'Basketball', homeTeam: 'Iowa Hawkeyes', awayTeam: 'LSU Tigers' }).isMatch, true,
        'deux côtés sans marqueur s\'apparient comme avant, ligue féminine ou non');
    assert.strictEqual(M.ligueFeminine('WNBA'), true);
    assert.strictEqual(M.ligueFeminine('FIFA Women\'s World Cup'), true);
    assert.strictEqual(M.ligueFeminine('PWHL'), true);
    assert.strictEqual(M.ligueFeminine('NBA'), false);
    assert.strictEqual(M.ligueFeminine(''), false);
    ok('une ligue féminine connue vaut marqueur pour le côté qui n\'en écrit pas');

    console.log(`unit_categorie: ${n} groupes de tests OK`);
    process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

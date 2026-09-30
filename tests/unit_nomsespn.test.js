/* Les noms d'équipes venus d'ESPN ne sont pas « corrigés » vers une équipe d'une autre
   ligue (js/db.js : nomOfficielDansLigue ; js/api.js : construction des matchs ESPN).

   Capture du 29 septembre 2026, onglet Live, section WNBA : « Indiana Pacers vs Las
   Vegas Raiders », « New York City FC vs Minnesota Twins ». ESPN avait pourtant donné
   « Indiana Fever », « Las Vegas Aces », « New York Liberty », « Minnesota Lynx ». Les
   clubs de la WNBA ne sont pas dans la base d'équipes, et l'appariement approximatif de
   getOfficialTeamName prenait l'équipe la plus proche : celle de la même ville, dans un
   autre championnat. Le filtre par sport ne suffisait pas : Fever et Pacers sont tous
   deux du basket. Sans réseau. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function main() {
    globalThis.window = globalThis;
    await import('../js/match.js');   // pose isMatch et stringSimilarity, dont dépend l'appariement approximatif
    const db = await import('../js/db.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    // ── 1. Le défaut, tel qu'il était ────────────────────────────────────────
    /* Garde-fou du test lui-même : si l'appariement approximatif cessait de confondre
       ces noms, le groupe 2 passerait sans rien prouver. */
    assert.strictEqual(db.getOfficialTeamName('Indiana Fever'), 'Indiana Pacers',
        'la résolution aveugle confond toujours les deux clubs d\'Indianapolis');
    ok('la résolution aveugle se trompe bien de ligue (le cas à corriger existe)');

    // ── 2. Un match WNBA garde les noms d'ESPN ───────────────────────────────
    const wnba = ['Indiana Fever', 'Las Vegas Aces', 'New York Liberty', 'Minnesota Lynx',
        'Atlanta Dream', 'Washington Mystics', 'Dallas Wings', 'Golden State Valkyries',
        'Seattle Storm', 'Chicago Sky', 'Connecticut Sun', 'Phoenix Mercury', 'Los Angeles Sparks'];
    wnba.forEach((nom) => {
        assert.strictEqual(db.nomOfficielDansLigue(nom, 'WNBA'), nom, nom + ' reste ' + nom);
    });
    ok('les treize clubs de la WNBA gardent leur nom');

    // ── 3. Ce qui se résolvait bien se résout toujours ───────────────────────
    assert.strictEqual(db.nomOfficielDansLigue('Internazionale', 'Italian Serie A'), db.getOfficialTeamName('Internazionale'),
        'une résolution dans la même famille (soccer) est gardée');
    assert.strictEqual(db.nomOfficielDansLigue('Toronto Maple Leafs', 'NHL'), 'Toronto Maple Leafs');
    assert.strictEqual(db.nomOfficielDansLigue('Indiana Pacers', 'NBA'), 'Indiana Pacers', 'les Pacers restent les Pacers en NBA');
    assert.strictEqual(db.nomOfficielDansLigue('', 'NBA'), '', 'un nom vide ne lève rien');
    assert.strictEqual(db.nomOfficielDansLigue('Michigan Wolverines', 'NCAA Football'), 'Michigan Wolverines',
        'l\'approximation n\'intervient plus : « Iran » était la réponse');
    assert.strictEqual(db.nomOfficielDansLigue('Pau', 'TOP 14'), 'Pau', 'Pau (rugby) n\'est pas St. Pauli');
    ok('les résolutions justes ne changent pas');

    // ── 4. Le câblage : les matchs ESPN passent par la résolution par ligue ──
    const api = fs.readFileSync(path.join(__dirname, '..', 'js', 'api.js'), 'utf8');
    assert.ok(/homeTeam: nomOfficielDansLigue\(homeName, leagueName\)/.test(api)
        && /awayTeam: nomOfficielDansLigue\(awayName, leagueName\)/.test(api),
        'les deux équipes d\'un match ESPN sont résolues avec la ligue du match');
    assert.ok(/existingMatch\.homeTeam = matchObj\.homeTeam/.test(api),
        'un calendrier déjà en cache reprend les noms d\'ESPN au passage suivant');
    ok('js/api.js résout les noms ESPN dans leur ligue, et répare le cache');

    console.log(`unit_nomsespn: ${n} groupes de tests OK`);
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

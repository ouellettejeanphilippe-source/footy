/* La page Favoris (js/favoris.js) et la remise à jour des équipes (scripts/maj_equipes.mjs).

   14 novembre 2026, « faire page favori pour meilleure navigation et en profiter pour mettre
   à jour ligues et équipes ». Ce test verrouille le modèle de la page (sports → ligues →
   équipes), la recherche, la règle d'ouverture, la fusion des listes ESPN dans la base, et
   l'état de la base elle-même : un club est sous son championnat, pas sous une coupe. Sans
   réseau. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function main() {
    const F = await import('../js/favoris.js');
    const M = await import('../scripts/maj_equipes.mjs');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };
    const lire = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

    // 1. Le modèle : sports dans l'ordre donné, ligues dans l'ordre donné, équipes triées.
    const sportDe = (l) => (/NHL|PWHL/.test(l) ? 'Hockey' : 'Soccer');
    const mod = F.modeleFavoris({
        ligues: ['PREMIER LEAGUE', 'NHL', 'PWHL', 'LIGUE 1'],
        equipes: [{ name: 'Chelsea', league: 'premier league' }, { name: 'Arsenal', league: 'premier league' }, { name: 'Arsenal', league: 'premier league' },
            { name: 'Montreal Canadiens', league: 'nhl' }, { name: 'Montréal Victoire', league: 'pwhl' }, { name: 'Club Inconnu', league: 'coupe locale' }, { name: 'Sans Ligue' }],
        favoris: { 'Montreal Canadiens': 1, Arsenal: 1, 'Ancien Favori': 0 },
        sportDe: sportDe, niveauDe: (l) => (l === 'PWHL' ? 'secondary' : 'main'), sports: ['Hockey', 'Soccer']
    });
    assert.deepStrictEqual(mod.sports.map((s) => s.nom), ['Hockey', 'Soccer']);
    assert.deepStrictEqual(mod.sports[0].ligues.map((l) => l.cle), ['NHL', 'PWHL']);
    assert.deepStrictEqual(mod.sports[1].ligues.map((l) => l.cle), ['PREMIER LEAGUE', 'LIGUE 1', 'COUPE LOCALE', 'AUTRES'], 'une ligue hors liste est gardée, à la fin de son sport');
    assert.deepStrictEqual(mod.sports[1].ligues[0].equipes, ['Arsenal', 'Chelsea'], 'triées, sans doublon');
    assert.strictEqual(mod.sports[1].ligues[1].equipes.length, 0, 'une ligue sans équipe reste réglable');
    assert.strictEqual(mod.sports[0].favoris, 1);
    assert.strictEqual(mod.sports[1].ligues[0].favoris, 1);
    assert.strictEqual(mod.sports[0].ligues[1].niveau, 'secondary');
    assert.deepStrictEqual(mod.favoris, ['Arsenal', 'Montreal Canadiens'], 'seuls les favoris à 1');
    assert.deepStrictEqual(F.modeleFavoris().sports, []);
    ok('le modèle : sports, ligues et équipes dans l\'ordre, compteurs de favoris');

    // 2. La recherche : nom ou alias, une fois par équipe, vide = rien.
    const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    assert.deepStrictEqual(F.chercherEquipes(mod, '', norm), []);
    assert.deepStrictEqual(F.chercherEquipes(mod, 'montre', norm).map((e) => [e.nom, e.ligue, e.sport]),
        [['Montreal Canadiens', 'NHL', 'Hockey'], ['Montréal Victoire', 'PWHL', 'Hockey']], 'sans accent');
    assert.deepStrictEqual(F.chercherEquipes(mod, 'gunners', norm, (nom) => (nom === 'Arsenal' ? 'gunners afc' : '')).map((e) => e.nom), ['Arsenal'], 'par alias');
    assert.strictEqual(F.chercherEquipes(mod, 'e', norm, null, 2).length, 2, 'bornée');
    ok('la recherche trouve par nom ou alias, sans accent');

    // 3. L'ouverture : les équipes d'une ligue principale, pas trop longue ; le choix l'emporte.
    const lg = (niveau, k) => ({ niveau: niveau, equipes: new Array(k).fill('x') });
    assert.strictEqual(F.liguesOuverte(lg('main', 20)), true);
    assert.strictEqual(F.liguesOuverte(lg('secondary', 20)), false);
    assert.strictEqual(F.liguesOuverte(lg('main', F.EQUIPES_MAX_OUVERTES + 1)), false);
    assert.strictEqual(F.liguesOuverte(lg('main', 0)), false);
    assert.strictEqual(F.liguesOuverte(lg('main', 20), true), false, 'repliée par l\'utilisateur');
    assert.strictEqual(F.liguesOuverte(lg('secondary', 90), false), true, 'dépliée par l\'utilisateur');
    ok('les équipes d\'une ligue principale sont montrées d\'office, le choix de l\'utilisateur l\'emporte');

    // 4. La fusion des listes ESPN : par nom, par logo confirmé, ajout, et retrait d'une ligue périmée.
    const base = {
        arsenal: { name: 'Arsenal', league: 'league cup', colors: ['#f00'], logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/359.png', aliases: ['gunners'] },
        wolves: { name: 'Wolves', league: 'fa cup', colors: ['#fa0'], logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/380.png', aliases: ['wolverhampton'] },
        panama: { name: 'Panama', league: 'fifa world cup', colors: ['#d00'], logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/4059.png', aliases: ['panama'] },
        'luton town': { name: 'Luton Town', league: 'premier league', colors: ['#f60'], logo: '', aliases: [] },
        'ottawa redblacks': { name: 'Ottawa Redblacks', league: 'cfl', colors: ['#d11'], logo: '', aliases: [] },
        'sd huesca': { name: 'SD Huesca', league: ['la liga', 'copa del rey'], colors: ['#00f'], logo: '', aliases: [] }
    };
    const copie = JSON.stringify(base);
    const q = (nom, id, court) => ({ nom: nom, court: court || nom, surnom: nom, logo: id ? 'https://a.espncdn.com/i/teamlogos/soccer/500/' + id + '.png' : '', couleurs: ['#123456'] });
    const r = M.fusionner(base, [
        { ligue: 'premier league', chemin: 'soccer/eng.1', equipes: [q('Arsenal', 359), q('Wolverhampton Wanderers', 380, 'Wolverhampton'), q('Sunderland', 366), q('TBD Home', 1)] },
        { ligue: 'la liga', chemin: 'soccer/esp.1', equipes: [q('Real Madrid', 86)] },
        { ligue: 'serie b', chemin: 'soccer/ita.2', equipes: [q('Benevento', 4059)] },
        { ligue: 'cfl', chemin: 'football/cfl', equipes: [q('Ottawa Red Blacks', 0)] }
    ]);
    assert.strictEqual(JSON.stringify(base), copie, 'la base n\'est pas touchée');
    assert.strictEqual(r.modifiees.arsenal.league, 'premier league');
    assert.deepStrictEqual(r.modifiees.arsenal.aliases, ['gunners'], 'alias et couleurs gardés');
    assert.strictEqual(r.modifiees.wolves.league, 'premier league', 'retrouvé par son logo, confirmé par un alias');
    assert.ok(!r.modifiees.panama, 'un logo partagé sans nom en commun ne suffit pas');
    assert.strictEqual(r.ajoutees.benevento.league, 'serie b');
    assert.strictEqual(r.ajoutees.sunderland.name, 'Sunderland');
    assert.ok(!r.ajoutees['tbd home'], 'une case d\'attente d\'ESPN n\'est pas une équipe');
    assert.ok(!r.modifiees['ottawa redblacks'] && !r.ajoutees['ottawa red blacks'], '« Red Blacks » est « Redblacks » : ni changée, ni doublée');
    assert.strictEqual(r.modifiees['luton town'].league, 'Autres', 'plus dans la ligue relue : elle lui est retirée');
    assert.strictEqual(r.modifiees['sd huesca'].league, 'copa del rey', 'il lui reste son autre étiquette');
    ok('fusionner : ligue du moment, promus ajoutés, ligue périmée retirée, sans faux rapprochement');

    // 5. La réécriture : seules les lignes changées bougent, les nouvelles avant l'accolade.
    const texte = "export const TEAM_DATA = {\n  'arsenal': {\"name\":\"Arsenal\",\"league\":\"league cup\"},\n  'o\\'higgins': {\"name\":\"O'Higgins\",   \"league\":\"x\"},\n\n};\n";
    const sortie = M.reecrire(texte, { arsenal: { name: 'Arsenal', league: 'premier league' } }, { sunderland: { name: 'Sunderland', league: 'premier league' } });
    assert.ok(sortie.includes("  'arsenal': {\"name\":\"Arsenal\",\"league\":\"premier league\"},"));
    assert.ok(sortie.includes("  'o\\'higgins': {\"name\":\"O'Higgins\",   \"league\":\"x\"},"), 'une ligne non touchée reste identique');
    assert.ok(/'sunderland': \{[^\n]*\},\n\n\};\n$/.test(sortie), 'la nouvelle ligne avant l\'accolade finale');
    assert.strictEqual(M.idLogo('https://a.espncdn.com/i/teamlogos/nhl/500/mtl.png'), 'nhl/mtl');
    assert.strictEqual(M.idLogo('https://ui-avatars.com/api/?name=x'), '');
    ok('reecrire ne touche que les lignes changées');

    // 6. La base publiée : un club sous son championnat, les ligues relues complètes.
    const { TEAM_DATA } = await import('../js/teams.js');
    const dans = (l) => Object.values(TEAM_DATA).filter((e) => e.league === l).length;
    assert.strictEqual(TEAM_DATA.arsenal.league, 'premier league');
    assert.strictEqual(TEAM_DATA['real madrid'].league, 'la liga');
    assert.strictEqual(TEAM_DATA['bayern munich'].league, 'bundesliga');
    [['premier league', 20], ['la liga', 20], ['serie a', 20], ['bundesliga', 18], ['ligue 1', 18], ['nhl', 32], ['nba', 30], ['mlb', 30], ['nfl', 32]]
        .forEach((x) => assert.strictEqual(dans(x[0]), x[1], x[0] + ' : ' + x[1] + ' équipes'));
    assert.ok(dans('wnba') >= 12, 'la WNBA est dans la base');
    assert.ok(!Object.values(TEAM_DATA).some((e) => Array.isArray(e.league) && e.league.indexOf('la liga') >= 0), 'plus de « la liga,copa del rey »');
    assert.ok(!Object.keys(TEAM_DATA).some((k) => /^tbd /.test(k) && TEAM_DATA[k].league === 'mls'));
    const db = lire('js/db.js');
    M.LIGUES.forEach((l) => assert.ok(db.toUpperCase().includes("'" + l[0].toUpperCase() + "'"), 'ligue connue de js/db.js : ' + l[0]));
    ok('la base : Arsenal en Premier League, les grands championnats complets, la WNBA présente');

    // 7. Sans import, précaché, branché ; l'ancienne page est partie.
    assert.ok(!/^\s*import\s/m.test(lire('js/favoris.js')), 'module sans import');
    assert.ok(lire('sw.js').includes("'./js/favoris.js'"), 'dans APP_SHELL');
    const html = lire('index.html'), main = lire('js/main.js');
    ['fav-barre', 'fav-rubriques', 'fav-team-search', 'fav-corps', 'fav-titre'].forEach((id) => assert.ok(html.includes('id="' + id + '"'), '#' + id));
    assert.ok(!/switchFavTab|fav-teams-list|fav-leagues-list|fav-mobile-tabs/.test(html + main + lire('styles.css')), 'les deux listes d\'avant sont parties');
    assert.ok(/modeleFavoris\(\{/.test(main) && /chercherEquipes\(mod, favRecherche/.test(main));
    ok('le module est sans import, précaché, branché ; l\'ancienne page est retirée');

    console.log('\n' + n + ' vérifications réussies.');
}
main().catch((e) => { console.error(e); process.exit(1); });

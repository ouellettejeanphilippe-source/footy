/* Alignements et feuille de match, lus dans le `summary` ESPN (js/alignements.js).

   « Je veux plus des données de ESPN, genre les alignements » (10 octobre 2026). La fiche
   recevait déjà le résumé complet d'ESPN et n'en tirait que les buteurs et le classement.
   Relevé ce jour-là sur de vrais résumés :
     - Premier League (Arsenal – Leeds) : `rosters[]` avec `formation` (« 4-2-3-1 »),
       11 titulaires (`formationPlace`), 9 remplaçants, et les `plays` de chaque joueur
       (but 62', passe, carton, changement 63') ; pas de `boxscore.players`.
     - LNH, NFL : pas de `rosters`, mais `boxscore.players[]` par équipe, en groupes
       (`forwards`, `defenses`, `goalies` ; `passing`, `rushing`…), 21 colonnes au hockey.
       L'équipe n'y dit pas si elle reçoit : c'est `header.competitions[0].competitors`.
     - MLB : les deux. `rosters` n'a que l'ordre des frappeurs ; la feuille, des stats.
       Les groupes s'y appellent par `type` (« batting », « pitching »), pas par `name`.
   Les objets ci-dessous reprennent ces formes, réduites. */
const assert = require('assert');

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function joueurFoot(num, nom, pos, place, opts) {
    opts = opts || {};
    return Object.assign({
        starter: place > 0, jersey: String(num),
        athlete: { displayName: nom }, position: { abbreviation: pos },
        formationPlace: String(place), subbedIn: false, subbedOut: false, plays: []
    }, opts);
}

const FOOT = {
    header: { competitions: [{ competitors: [{ id: '359', homeAway: 'home' }, { id: '357', homeAway: 'away' }] }] },
    boxscore: { teams: [] },
    rosters: [
        { homeAway: 'away', team: { id: '357', displayName: 'Leeds United' }, formation: '3-4-2-1', roster: [
            joueurFoot(1, 'Gardien Leeds', 'G', 1),
            joueurFoot(9, 'Avant Leeds', 'F', 11)
        ] },
        { homeAway: 'home', team: { id: '359', displayName: 'Arsenal' }, formation: '4-2-3-1', roster: [
            joueurFoot(49, 'Myles Lewis-Skelly', 'LM', 4, { subbedOut: true, plays: [
                { clock: { displayValue: "63'" }, substitution: true }] }),
            joueurFoot(1, 'David Raya', 'G', 1),
            joueurFoot(33, 'Riccardo Calafiori', 'LB', 3, { plays: [
                { clock: { displayValue: "62'" }, scoringPlay: true, didScore: true },
                { clock: { displayValue: "70'" }, yellowCard: true }] }),
            joueurFoot(13, 'Kepa Arrizabalaga', 'SUB', 0),
            joueurFoot(39, 'Bruno Guimarães', 'SUB', 0, { subbedIn: true, plays: [
                { clock: { displayValue: "63'" }, substitution: true },
                { clock: { displayValue: "70'" }, scoringPlay: true, didScore: true }] }),
            joueurFoot(4, '<img src=x onerror=alert(1)>', 'RB', 2)
        ] }
    ]
};

const HOCKEY_LABELS = ['BS', 'HT', 'TK', '+/-', 'TOI', 'PPTOI', 'SHTOI', 'ESTOI', 'SHFT', 'G', 'YTDG', 'A', 'S', 'SM', 'SOG', 'FW', 'FL', 'FO%', 'GV', 'PN', 'PIM'];
function patineur(nom, pos, g) {
    return { athlete: { displayName: nom, jersey: '9', position: { abbreviation: pos } },
        stats: ['0', '6', '0', '1', '17:46', '0:00', '5:26', '12:20', '28', String(g), '0', '0', '1', '0', '3', '0', '2', '0.0', '0', '0', '2'] };
}
const HOCKEY = {
    header: { competitions: [{ competitors: [{ id: '5', homeAway: 'home' }, { id: '28', homeAway: 'away' }] }] },
    boxscore: { teams: [], players: [
        { team: { id: '28', displayName: 'Winnipeg Jets' }, statistics: [
            { name: 'forwards', labels: HOCKEY_LABELS, athletes: [patineur('Morgan Barron', 'C', 1)] },
            { name: 'skaters', labels: HOCKEY_LABELS, athletes: [] },
            { name: 'goalies', labels: ['GA', 'SA', 'SOS', 'SOSA', 'SV', 'SV%', 'ESSV', 'PPSV', 'SHSV', 'TOI', 'YTDG', 'PIM'],
              athletes: [{ athlete: { displayName: 'Stuart Skinner', position: { abbreviation: 'G' } },
                  stats: ['2', '36', '0', '0', '34', '.944', '25', '8', '1', '60:00', '0', '0'] }] }
        ] },
        { team: { id: '5', displayName: 'Detroit Red Wings' }, statistics: [
            { name: 'forwards', labels: HOCKEY_LABELS, athletes: [patineur('Dylan Larkin', 'C', 2),
                { athlete: { displayName: 'Blessé' }, didNotPlay: true, stats: [] }] }
        ] }
    ] }
};

const BASEBALL = {
    header: { competitions: [{ competitors: [{ id: '8', homeAway: 'home' }, { id: '25', homeAway: 'away' }] }] },
    rosters: [{ homeAway: 'home', team: { id: '8', displayName: 'Milwaukee Brewers' },
        roster: [{ starter: true, batOrder: 1, athlete: { displayName: 'Jackson Chourio' }, position: { abbreviation: 'LF' } }] }],
    boxscore: { players: [
        { team: { id: '8', displayName: 'Milwaukee Brewers' }, statistics: [
            { type: 'batting', labels: ['H-AB', 'AB', 'R', 'H', 'RBI', 'HR', 'BB', 'K', '#P', 'AVG', 'OBP', 'SLG'],
              athletes: [{ starter: true, athlete: { displayName: 'Jackson Chourio' }, position: { abbreviation: 'LF' },
                  stats: ['2-4', '4', '1', '2', '3', '1', '0', '1', '17', '.301', '.350', '.512'] }] },
            { type: 'pitching', labels: ['IP', 'H', 'R', 'ER', 'BB', 'K', 'HR', 'PC-ST', 'ERA', 'PC'],
              athletes: [{ starter: true, athlete: { displayName: 'Freddy Peralta' }, position: { abbreviation: 'SP' },
                  stats: ['6.0', '4', '2', '1', '1', '8', '0', '95-64', '2.90', '95'] }] }
        ] }
    ] }
};

async function main() {
    const A = await import('../js/alignements.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    // ── 1. Football : la composition, rangée ─────────────────────────────────
    const foot = A.extraireAlignements(FOOT);
    assert.strictEqual(foot.type, 'compo');
    assert.deepStrictEqual(foot.equipes.map((e) => e.cote), ['home', 'away'], 'domicile d\'abord, quel que soit l\'ordre d\'ESPN');
    const ars = foot.equipes[0];
    assert.strictEqual(ars.formation, '4-2-3-1');
    assert.deepStrictEqual(ars.titulaires.map((j) => j.num), ['1', '4', '33', '49'], 'titulaires dans l\'ordre de la formation');
    assert.deepStrictEqual(ars.remplacants.map((j) => j.nom), ['Bruno Guimarães', 'Kepa Arrizabalaga'], 'les entrés d\'abord');
    ok('football : formation, titulaires par place, remplaçants entrés en tête');

    const calaf = ars.titulaires.find((j) => j.num === '33');
    assert.deepStrictEqual(calaf.actions, [{ type: 'but', min: "62'" }, { type: 'jaune', min: "70'" }]);
    assert.deepStrictEqual(ars.titulaires.find((j) => j.num === '49').actions, [{ type: 'sortie', min: "63'" }]);
    assert.deepStrictEqual(ars.remplacants[0].actions, [{ type: 'entree', min: "63'" }, { type: 'but', min: "70'" }]);
    ok('football : buts, cartons et changements avec la minute');

    // ── 2. Hockey : la feuille, côtés lus dans l'en-tête ─────────────────────
    const hockey = A.extraireAlignements(HOCKEY);
    assert.strictEqual(hockey.type, 'feuille');
    assert.deepStrictEqual(hockey.equipes.map((e) => e.equipe), ['Detroit Red Wings', 'Winnipeg Jets'],
        'Detroit reçoit selon header.competitors, même listé en second');
    const wpg = hockey.equipes[1];
    assert.deepStrictEqual(wpg.groupes.map((g) => g.titre), ['Attaquants', 'Gardiens'], 'groupe vide écarté, titres traduits');
    assert.ok(wpg.groupes[0].colonnes.length <= A.COLONNES_MAX, 'pas 21 colonnes sur un téléphone');
    assert.deepStrictEqual(wpg.groupes[0].colonnes, ['+/-', 'TOI', 'G', 'A', 'SOG', 'PIM']);
    assert.deepStrictEqual(wpg.groupes[0].joueurs[0].stats, ['1', '17:46', '1', '0', '3', '2'], 'les valeurs suivent leurs colonnes');
    assert.deepStrictEqual(wpg.groupes[1].colonnes, ['GA', 'SA', 'SV', 'SV%', 'TOI']);
    assert.strictEqual(hockey.equipes[0].groupes[0].joueurs.length, 1, 'un joueur qui n\'a pas joué est écarté');
    ok('hockey : feuille par groupe, six colonnes au plus, côtés justes');

    // ── 3. Baseball : la feuille l'emporte sur l'ordre des frappeurs seul ────
    const mlb = A.extraireAlignements(BASEBALL);
    assert.strictEqual(mlb.type, 'feuille');
    const mil = mlb.equipes[0];
    assert.deepStrictEqual(mil.groupes.map((g) => g.titre), ['Frappeurs', 'Lanceurs'], 'groupes nommés par `type`');
    assert.deepStrictEqual(mil.groupes[1].colonnes, ['IP', 'H', 'ER', 'BB', 'K', 'ERA'], 'colonnes propres aux lanceurs');
    ok('baseball : frappeurs et lanceurs, chacun avec ses colonnes');

    // ── 4. Rien à montrer ────────────────────────────────────────────────────
    assert.strictEqual(A.extraireAlignements(null), null);
    assert.strictEqual(A.extraireAlignements({ rosters: [{ homeAway: 'home', team: {} }, { homeAway: 'away', team: {} }], boxscore: { teams: [] } }), null,
        'avant la publication des compositions, ESPN donne les équipes sans joueurs');
    assert.strictEqual(A.alignementsHtml(null, esc), '');
    ok('avant le match ou sans données : rien');

    // ── 5. Rendu : échappé, un onglet par équipe, onglet gardé ───────────────
    const html = A.alignementsHtml(foot, esc);
    assert.ok(!html.includes('<img src=x'), 'le nom d\'un joueur est échappé');
    assert.ok(html.includes('&lt;img src=x'));
    assert.strictEqual((html.match(/class="al-onglet[ "]/g) || []).length, 2);
    assert.ok(/data-al-cote="away" hidden/.test(html), 'seule l\'équipe active est visible');
    assert.ok(html.includes('4-2-3-1') && html.includes("⚽ 62'") && html.includes("🔻 63'"));
    const html2 = A.alignementsHtml(foot, esc, 'away');
    assert.ok(/data-al-cote="home" hidden/.test(html2) && !/data-al-cote="away" hidden/.test(html2), 'onglet choisi gardé au rafraîchissement');
    const htmlH = A.alignementsHtml(hockey, esc);
    assert.ok(htmlH.includes('<th>SV%</th>') && htmlH.includes('Feuille de match'));
    ok('rendu : échappement, onglets, état gardé, tableau de la feuille');

    // ── 6. Avant le match : l'effectif, pour avoir au moins les noms ────────
    // « À tout le moins, des lignes avec les noms, depth chart pour hockey. » ESPN n'a
    // pas les trios (`/depthcharts` LNH vide) : l'effectif par position est ce qui existe.
    const RED_WINGS = { team: { displayName: 'Detroit Red Wings' }, athletes: [
        { position: 'Centers', items: [{ jersey: '71', displayName: 'Dylan Larkin', position: { abbreviation: 'C' } },
            { jersey: '22', displayName: 'Mason Appleton', position: { abbreviation: 'C' }, injuries: [{ status: 'Out' }] }] },
        { position: 'Left Wings', items: [] },
        { position: 'Goalies', items: [{ jersey: '36', displayName: 'John Gibson', position: { abbreviation: 'G' } }] }
    ] };
    const ARSENAL = { team: { displayName: 'Arsenal' }, athletes: [
        { jersey: '7', displayName: 'Bukayo Saka', position: { displayName: 'Forward', abbreviation: 'F' } },
        { jersey: '22', displayName: 'David Raya', position: { displayName: 'Goalkeeper', abbreviation: 'G' } },
        { jersey: '2', displayName: 'William Saliba', position: { displayName: 'Defender', abbreviation: 'D' } },
        { jersey: '1', displayName: 'Kepa', position: { displayName: 'Goalkeeper', abbreviation: 'G' } }
    ] };
    const eff = A.extraireEffectifs(RED_WINGS, ARSENAL, ['Domicile', 'Visiteur']);
    assert.strictEqual(eff.type, 'effectif');
    assert.deepStrictEqual(eff.equipes[0].groupes.map((g) => g.titre), ['Centres', 'Gardiens'], 'groupes d\'ESPN traduits, vides écartés');
    assert.strictEqual(eff.equipes[0].groupes[0].joueurs[1].blesse, true);
    assert.deepStrictEqual(eff.equipes[1].groupes.map((g) => g.titre), ['Gardiens', 'Défenseurs', 'Attaquants'], 'liste à plat rangée par poste');
    assert.deepStrictEqual(eff.equipes[1].groupes[0].joueurs.map((j) => j.num), ['1', '22'], 'par numéro');
    const htmlE = A.alignementsHtml(eff, esc);
    assert.ok(htmlE.includes('👥 Effectif') && htmlE.includes('Dylan Larkin') && htmlE.includes('🚑'));
    assert.strictEqual(A.extraireEffectifs(null, { athletes: [] }), null);
    ok('effectif : noms par position (hockey groupé, football à plat), blessés marqués');

    // ── 7. Le terrain : rangées tirées de la formation et des postes ─────────
    // « go pour le terrain, remplace titulaires ». Postes tels qu'ESPN les donne pour les
    // formations relevées le 10 octobre 2026 (formationPlace dans un ordre quelconque).
    const XI = (postes) => postes.map((pos, i) => ({ num: String(i + 1), nom: pos, court: pos, poste: pos, ordre: (i * 7) % 11 + 1, actions: [] }));
    const lignes = (form, postes) => A.rangeesTerrain(XI(postes), form).map((r) => r.map((j) => j.poste).join(' '));
    assert.deepStrictEqual(lignes('4-2-3-1', ['F', 'AM-R', 'RM', 'CD-L', 'G', 'AM', 'LB', 'RB', 'LM', 'CD-R', 'AM-L']),
        ['G', 'LB CD-L CD-R RB', 'LM RM', 'AM-L AM AM-R', 'F']);
    assert.deepStrictEqual(lignes('3-4-2-1', ['CF-R', 'CD', 'RM', 'G', 'CM-L', 'F', 'CD-R', 'LM', 'CF-L', 'CM-R', 'CD-L']),
        ['G', 'CD-L CD CD-R', 'LM CM-L CM-R RM', 'CF-L CF-R', 'F']);
    assert.deepStrictEqual(lignes('4-3-3', ['RF', 'CM', 'G', 'LB', 'F', 'CD-R', 'RM', 'LF', 'CD-L', 'LM', 'RB']),
        ['G', 'LB CD-L CD-R RB', 'LM CM RM', 'LF F RF']);
    assert.deepStrictEqual(lignes('3-5-1-1', ['RCF', 'CD', 'AM', 'G', 'CM-L', 'F', 'CD-R', 'LM', 'RM', 'CM-R', 'CD-L']),
        ['G', 'CD-L CD CD-R', 'LM CM-L AM CM-R RM', 'RCF', 'F']);
    assert.strictEqual(A.rangeesTerrain(XI(['G', 'F']), '4-4-2'), null, 'formation qui ne colle pas aux titulaires : la liste reste');
    assert.strictEqual(A.rangeesTerrain(XI(['G']), ''), null);
    const onze = { type: 'compo', equipes: [{ cote: 'home', equipe: 'X', formation: '4-3-3', remplacants: [],
        titulaires: XI(['RF', 'CM', 'G', 'LB', 'F', 'CD-R', 'RM', 'LF', 'CD-L', 'LM', 'RB']).map((j, i) => i === 0 ? Object.assign(j, { actions: [{ type: 'but', min: "12'" }, { type: 'but', min: "80'" }] }) : j) }] };
    const htmlT = A.alignementsHtml(onze, esc);
    assert.ok(htmlT.includes('class="al-terrain"') && !htmlT.includes('Titulaires'), 'le terrain remplace la liste des titulaires');
    assert.strictEqual((htmlT.match(/class="al-rangee"/g) || []).length, 4);
    assert.ok(htmlT.indexOf('>RF<') < htmlT.indexOf('>G<'), 'l\'attaque en haut, le gardien en bas');
    assert.ok(htmlT.includes('⚽×2'), 'deux buts sur la pastille');
    ok('terrain : 4-2-3-1, 3-4-2-1, 4-3-3, 3-5-1-1 placés comme sur ESPN ; repli sur la liste');

    console.log(`unit_alignements : ${n} groupes réussis`);
}

main().catch((e) => { console.error(e); process.exit(1); });

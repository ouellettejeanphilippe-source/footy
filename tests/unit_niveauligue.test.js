/* Un libellé long de ligue garde le niveau de sa ligue (js/db.js : leagueTier ;
   scripts/scrape_schedule.mjs : LEAGUE_ALIASES).

   Le 29 septembre 2026, ESPN a nommé la LNH « National Hockey League » et le calendrier
   du serveur a publié « NATIONAL HOCKEY LEAGUE ». leagueTier ne connaissait que « NHL » :
   la ligue passait dans les « autres », et dans le Guide ses matchs restaient des cartes
   au lieu de blocs de la grille. Le test de démarrage « un match terminé selon ESPN
   quitte le Live, et le Guide suit le score » tombait dessus, sur main comme ailleurs.
   Sans réseau. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function main() {
    globalThis.window = globalThis;
    const db = await import('../js/db.js');
    ['NATIONAL HOCKEY LEAGUE', 'National Hockey League', 'NHL'].forEach((l) => {
        assert.strictEqual(db.leagueTier(l, {}), 'main', l + ' est une ligue principale');
    });
    assert.strictEqual(db.leagueTier('NATIONAL BASKETBALL ASSOCIATION', {}), 'main');
    assert.strictEqual(db.leagueTier('Ligue inventée', {}), 'other', 'une ligue inconnue reste « autre »');
    assert.strictEqual(db.leagueTier('NATIONAL HOCKEY LEAGUE', { 'NATIONAL HOCKEY LEAGUE': 'ignored' }), 'ignored',
        'le choix de l\'utilisateur prime, sous le libellé qu\'il a vu');
    console.log('  ✓ un libellé long garde le niveau de sa ligue');

    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'scrape_schedule.mjs'), 'utf8');
    ['national hockey league', 'national basketball association', 'national football league'].forEach((a) => {
        assert.ok(src.includes("'" + a + "':"), 'le script serveur normalise « ' + a + ' »');
    });
    console.log('  ✓ le script serveur publie le nom court');
    process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

/* compterFluxUtiles (js/scrapers.js) : ce qui compte comme une source jouable.

   Jusqu'au 6 septembre 2026, un lien « Page du match » ou marqué `topLevel` sans lecteur
   extrait ne comptait pas : la carte affichait la loupe « aucun lien » alors qu'elle en
   avait, et le sélecteur du Multivision ne la proposait pas. Depuis que la tuile charge
   la page entière et laisse le script utilisateur ne garder que la vidéo, la page EST la
   source : tout lien avec une adresse compte, et seulement lui. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://x.test/' });
    for (const k of ['window', 'document', 'DOMParser', 'localStorage', 'navigator', 'HTMLElement']) {
        Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
    }
    const s = await import('../js/scrapers.js');
    const compter = s.compterFluxUtiles;
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    assert.strictEqual(compter({ streamLinks: [{ name: 'Page du match sur flexfitness.fit', url: 'https://flexfitness.fit/watch-live/x/y/1' }] }), 1,
        'la page du match est une source : c\'est ce que la tuile charge');
    assert.strictEqual(compter({ streamLinks: [{ name: 'Serveur 1', url: 'https://bloque.test/x', topLevel: true }] }), 1,
        'un lien marqué topLevel compte aussi : la page est chargée telle quelle');
    assert.strictEqual(compter({ streamLinks: [{ name: 'Direct HD', url: 'https://x.test/a', fallback: true }] }), 1,
        'un repli avec une adresse est une source');
    ok('page du match, topLevel, repli : tout lien avec une adresse compte');

    assert.strictEqual(compter({ streamLinks: [
        { name: 'Lecteur 1', url: 'https://embed.test/1' },
        { name: 'Lecteur 2', url: 'https://embed.test/2' },
        { name: 'Page du match sur footybite.bid', url: 'https://footybite.bid/game/x', topLevel: true }
    ] }), 3, 'trois adresses, trois sources');
    ok('le compte est le nombre de liens adressables');

    assert.strictEqual(compter(null), 0);
    assert.strictEqual(compter({}), 0);
    assert.strictEqual(compter({ streamLinks: [] }), 0);
    assert.strictEqual(compter({ streamLinks: [null, { name: 'sans url' }, { name: 'vide', url: '' }] }), 0,
        'sans adresse, rien à charger');
    ok('entrées vides ou sans adresse : zéro');

    console.log(`unit_fluxutiles: ${n} groupes de tests OK`);
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

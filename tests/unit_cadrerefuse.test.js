/* Un cadre que le site refuse d'afficher (js/cadrerefuse.js).

   « Damitv et sportsurge marchent pas » — « un lecteur grisé sans vidéo » (31 octobre 2026,
   Firefox + Tampermonkey + « Ignore X-Frame-Options »). gooz.aapmains.net, le flux
   d'isportsurge, n'autorise que ses sites partenaires par la CSP frame-ancestors, que cette
   extension ne retire pas : la tuile restait sur la page d'erreur de Firefox. Ce test
   verrouille ce que le module décide : reconnaître la page d'erreur, attendre selon ce que
   le script a pu tenter, et ne jamais quitter une tuile qui joue. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function main() {
    const C = await import('../js/cadrerefuse.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    // 1. La page d'erreur de Firefox, en anglais et en français ; pas une page vide.
    assert.ok(C.estPageDeRefus("Firefox Can’t Open This Page To protect your security, gooz.aapmains.net will not allow Firefox to display the page if another site has embedded it."), 'anglais');
    assert.ok(C.estPageDeRefus("Firefox ne peut pas ouvrir cette page Pour protéger votre sécurité, example.org n’autorise pas Firefox à afficher la page."), 'français');
    assert.ok(!C.estPageDeRefus(''), 'vide');
    assert.ok(!C.estPageDeRefus('refused to connect'), 'trop court pour être une page d\'erreur');
    assert.ok(!C.estPageDeRefus('Regardez le match en direct sur notre site, la meilleure qualité, sans coupure, partout.'), 'une page ordinaire');
    ok('la page d\'erreur de Firefox est reconnue');

    // 2. Le même motif que le script utilisateur (un seul sens de « refusé »).
    const script = fs.readFileSync(path.join(__dirname, '..', 'multiview-cleaner.user.js'), 'utf8');
    const m = script.match(/var REFUS_CADRE = \/(.+)\/i;/);
    assert.ok(m, 'le script porte REFUS_CADRE');
    assert.strictEqual(m[1], C.REFUS_CADRE.source, 'le motif du module est celui du script');
    ok('le motif est celui du script');

    // 3. Combien attendre : plus quand la page a été recollée.
    assert.ok(C.delaiRefus('reconstruit') > C.delaiRefus('impossible'), 'la reconstruction a sa chance');
    assert.strictEqual(C.delaiRefus('direct'), C.delaiRefus('impossible'));
    assert.strictEqual(C.delaiRefus('inconnu'), C.delaiRefus('impossible'), 'un état inconnu n\'attend pas plus');
    ok('le délai dépend de ce que le script a tenté');

    // 4. Passer au suivant seulement si rien ne joue, si l'adresse n'a pas changé, et s'il y en a un.
    const base = { joue: false, adressePosee: 'a', adresseAttendue: 'a', aSuivant: true };
    assert.strictEqual(C.doitSauterRefus(base), true);
    assert.strictEqual(C.doitSauterRefus({ ...base, joue: true }), false, 'une tuile qui joue reste');
    assert.strictEqual(C.doitSauterRefus({ ...base, adressePosee: 'b' }), false, 'la tuile a déjà changé de lien');
    assert.strictEqual(C.doitSauterRefus({ ...base, aSuivant: false }), false, 'pas d\'autre lien');
    assert.strictEqual(C.doitSauterRefus(), false);
    ok('on ne quitte jamais une tuile qui joue');

    // 5. Le script annonce le refus à l'application, et l'application l'écoute.
    assert.ok(/__mv: 'cadre_refuse'/.test(script), 'le script envoie cadre_refuse');
    assert.ok(/dire\('reconstruit'\)/.test(script) && /dire\('impossible'\)/.test(script), 'avec l\'état de la reconstruction');
    const mv = fs.readFileSync(path.join(__dirname, '..', 'js', 'multiview.js'), 'utf8');
    assert.ok(/__mv === 'cadre_refuse'/.test(mv), 'l\'application écoute cadre_refuse');
    assert.ok(/estPageDeRefus\(texte\)/.test(mv), 'et lit elle-même la page d\'erreur de sa tuile');
    const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
    assert.ok(/'\.\/js\/cadrerefuse\.js'/.test(sw), 'le module est dans la coquille du service worker');
    ok('le script annonce, l\'application écoute, le module est précaché');

    console.log('unit_cadrerefuse: OK (' + n + ')');
}
main().catch((e) => { console.error(e); process.exit(1); });

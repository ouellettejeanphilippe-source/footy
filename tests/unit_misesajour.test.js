/* La page Réglages → Mises à jour (js/misesajour.js).

   « Ya moyen de remplacer la page script par qqchose qui aide plus les gens à rester à jour »
   (31 octobre 2026). La page Script n'était qu'un guide d'installation : rien ne disait si
   le script ou l'extension qui tourne était à jour, ni comment le mettre à jour. Ce test
   verrouille ce que le module décide, et que la page, l'en-tête du script et les versions
   restent d'accord. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const lire = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

async function main() {
    const M = await import('../js/misesajour.js');
    const I = await import('../js/installation.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };
    const versions = { script: I.VERSION_SCRIPT, extension: I.VERSION_EXTENSION };

    // 1. La version publiée, lue dans sw.js, et la comparaison avec celle de l'appareil.
    assert.strictEqual(M.versionPubliee("const CACHE_NAME = 'sports-guide-v113';"), 'sports-guide-v113');
    assert.strictEqual(M.versionPubliee('rien'), null);
    assert.strictEqual(M.versionPubliee(lire('sw.js')), 'sports-guide-v' + M.numeroVersionApp(M.versionPubliee(lire('sw.js'))), 'le vrai sw.js se lit');
    assert.strictEqual(M.etatApplication('sports-guide-v112', 'sports-guide-v113').statut, 'en_retard');
    assert.strictEqual(M.etatApplication('sports-guide-v113', 'sports-guide-v113').statut, 'a_jour');
    assert.strictEqual(M.etatApplication('sports-guide-v114', 'sports-guide-v113').statut, 'a_jour', 'plus récente que la publiée : pas en retard');
    assert.strictEqual(M.etatApplication('sports-guide-v113', null).statut, 'inconnu', 'hors ligne');
    ok('la version publiée se lit et se compare');

    // 2. Les cartes : un bouton qui convient à chaque état.
    const app = M.etatApplication('sports-guide-v112', 'sports-guide-v113');
    const carte = (prot, a) => M.cartesMiseAJour(a || app, prot, versions);
    let c = carte({ type: 'script', version: '1.20', aJour: false });
    assert.strictEqual(c[0].statut, 'warn');
    assert.ok(c[0].actions.some((x) => x.onclick === 'mettreAJourApplication()' && x.primaire), 'application en retard : bouton principal');
    assert.strictEqual(c[1].statut, 'warn');
    assert.ok(c[1].actions.some((x) => x.href === M.URL_SCRIPT && x.primaire), 'script en retard : lien vers le script');
    assert.ok(c[1].ligne.includes('1.20') && c[1].ligne.includes(versions.script));
    c = carte({ type: 'extension', version: '1.5', aJour: false });
    assert.ok(c[1].actions.some((x) => x.onclick === 'telechargerExtension()'), 'extension en retard : téléchargement');
    assert.ok(c[1].aide.length >= 3, 'et les étapes pour la remplacer');
    c = carte({ type: 'script', version: versions.script, aJour: true }, M.etatApplication('sports-guide-v113', 'sports-guide-v113'));
    assert.strictEqual(c[0].statut, 'ok'); assert.strictEqual(c[1].statut, 'ok');
    c = carte({ type: 'aucune' });
    assert.strictEqual(c[1].statut, 'info');
    assert.ok(c[1].actions.some((x) => x.onclick === 'ouvrirGuideInstallation()'), 'rien d\'installé : le guide');
    ok('chaque état a son bouton');

    // 3. Prévenir au démarrage : une fois par version attendue, jamais sans retard.
    const enRetard = { type: 'script', version: '1.20', aJour: false };
    const cle = M.doitPrevenirRetard(enRetard, versions, null);
    assert.strictEqual(cle, 'script:' + versions.script);
    assert.strictEqual(M.doitPrevenirRetard(enRetard, versions, cle), null, 'déjà prévenu pour cette version');
    assert.ok(M.doitPrevenirRetard(enRetard, { script: '9.9', extension: versions.extension }, cle), 'une nouvelle version prévient de nouveau');
    assert.strictEqual(M.doitPrevenirRetard({ type: 'script', version: versions.script, aJour: true }, versions, null), null);
    assert.strictEqual(M.doitPrevenirRetard({ type: 'aucune' }, versions, null), null, 'sans protection, c\'est le guide qui parle');
    assert.ok(M.messageRetard(enRetard, versions).includes('1.20') && M.messageRetard(enRetard, versions).includes('Mises à jour'));
    ok('on prévient une fois par version');

    // 4. Les nouveautés : celles que l'utilisateur n'a pas encore, et la version embarquée y figure.
    assert.ok(M.NOUVEAUTES.some((x) => x.version === I.VERSION_SCRIPT), 'une ligne « Ce qui a changé » pour la version embarquée du script (' + I.VERSION_SCRIPT + ')');
    assert.deepStrictEqual(M.nouveautesAfficher('1.22').map((x) => x.version), ['1.24', '1.23']);
    assert.strictEqual(M.nouveautesAfficher('1.24').length, 0, 'à jour : rien de neuf');
    assert.ok(M.nouveautesAfficher(null).length > 0, 'sans protection : tout');
    assert.ok(M.nouveautesAfficher('n/a').length > 0, 'version illisible : tout');
    ok('les nouveautés sont celles qu\'on n\'a pas');

    // 5. Le HTML échappe tout texte.
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const h = M.miseAJourHtml([{ id: 'x', titre: '<b>t</b>', statut: 'warn', ligne: 'a "b" <i>', actions: [{ texte: 'Go', onclick: 'f()', primaire: true }], aide: [] }], [{ version: '1.0', date: 'd', texte: '<script>' }], esc);
    assert.ok(!h.includes('<b>t</b>') && !h.includes('<script>') && !h.includes('<i>'), 'rien d\'injecté');
    assert.ok(h.includes('onclick="f()"') && h.includes('btn primary'));
    ok('le HTML échappe tout');

    // 6. L'en-tête du script ouvre les mises à jour automatiques de Tampermonkey, à l'adresse du bouton.
    const script = lire('multiview-cleaner.user.js');
    const entete = script.slice(0, script.indexOf('==/UserScript=='));
    assert.ok(entete.includes('@updateURL    ' + M.URL_SCRIPT), '@updateURL');
    assert.ok(entete.includes('@downloadURL  ' + M.URL_SCRIPT), '@downloadURL');
    assert.ok(lire('index.html').includes('href="' + M.URL_SCRIPT + '"'), 'le guide installe depuis la même adresse');
    ok('Tampermonkey sait où chercher la mise à jour');

    // 7. La page, l'onglet, le module précaché et l'avertissement au démarrage.
    const html = lire('index.html');
    const debut = html.indexOf('<section id="script-page"');
    const page = html.slice(debut, html.indexOf('</section>', debut));
    assert.ok(page.includes('<h2>Mises à jour</h2>') && page.includes('id="maj-etat"'), 'la page montre l\'état');
    assert.ok(/<details id="maj-guide"[^>]*>[^]*id="guide-installation"/.test(page), 'le guide d\'installation reste, replié');
    assert.ok(/id="rb-script"[^>]*>[^]*?<span>Mises à jour<\/span><\/button>/.test(html), 'l\'onglet s\'appelle Mises à jour');
    assert.ok(lire('sw.js').includes("'./js/misesajour.js'"), 'module précaché');
    const mv = lire('js/multiview.js');
    assert.ok(mv.includes('rendreMisesAJour();') && mv.includes("doitPrevenirRetard(etat, versions, safeStorageGet('maj_prevenue'))"), 'rendu et avertissement branchés');
    assert.ok(mv.includes('window.ouvrirGuideInstallation = ouvrirGuideInstallation;'), 'le bouton du guide');
    assert.ok(!/Réglages → 🧩 Script/.test(mv), 'plus aucune consigne vers l\'ancien nom de la page');
    ok('la page, l\'onglet et le branchement');

    console.log('unit_misesajour: OK (' + n + ')');
}
main().catch((e) => { console.error(e); process.exit(1); });

/* Les flux officiels de LoL Esports, rendus jouables (js/esports.js).

   « Pour league : lolesports.com » (6 septembre 2026). L'application interrogeait déjà
   l'API officielle depuis longtemps et les matchs apparaissaient bien dans la grille —
   relevé ce jour-là : sept rencontres LCS, LEC, LCK, LPL et PCS, dont un LCS en direct
   (Shopify Rebellion – FlyQuest). Mais AUCUNE ne pouvait jouer, à cause de la forme des
   adresses construites :

       https://youtube.com/watch?v=<id>   une page de visionnement, pas un lecteur
       https://twitch.tv/<chaîne>         une page de chaîne, pas un lecteur

   Mesuré aux en-têtes sur ce match :
     twitch.tv/lcs                                   X-Frame-Options: SAMEORIGIN  (refusé)
     player.twitch.tv/?channel=lcs&parent=<hôte>     frame-ancestors <notre hôte>  (permis)
     youtube.com/watch?v=…                           429, et pas un lecteur
     youtube.com/embed/<id>                          200, aucune restriction de cadre

   Twitch exige que `parent` soit exactement l'hôte de la page qui l'encadre : c'est sa
   protection contre le vol de flux, et l'oublier fait échouer le lecteur en silence. */
const assert = require('assert');

async function main() {
    const E = await import('../js/esports.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };
    const HOTE = 'ouellettejeanphilippe-source.github.io';

    // ── 1. Twitch : le lecteur, avec le parent exigé ────────────────────────
    const tw = E.lienFluxEsports('twitch', 'lcs', HOTE);
    assert.ok(tw.startsWith('https://player.twitch.tv/?channel=lcs'), 'le lecteur, pas la page de chaîne : ' + tw);
    assert.ok(tw.includes('parent=' + encodeURIComponent(HOTE)), 'sans `parent`, Twitch refuse : ' + tw);
    assert.ok(!/^https:\/\/(www\.)?twitch\.tv\//.test(tw), 'jamais la page de chaîne, elle répond SAMEORIGIN');
    ok('Twitch : lecteur encadrable, avec le parent exigé');

    // ── 2. YouTube : l'intégration, pas la page de visionnement ─────────────
    const yt = E.lienFluxEsports('youtube', 'kEsofDOdNyA', HOTE);
    assert.strictEqual(yt, 'https://www.youtube.com/embed/kEsofDOdNyA?autoplay=1');
    assert.ok(!yt.includes('/watch'), 'la page de visionnement n\'est pas encadrable et répond 429');
    ok('YouTube : adresse d\'intégration');

    // ── 3. Ce qu'on ne sait pas encadrer n'est pas proposé ──────────────────
    /* Mieux vaut aucun lien qu'un lien qui affichera l'écran de refus du navigateur. */
    assert.strictEqual(E.lienFluxEsports('afreecatv', 'x', HOTE), '');
    assert.strictEqual(E.lienFluxEsports('youtube', '', HOTE), '', 'pas de paramètre, pas de lien');
    assert.strictEqual(E.lienFluxEsports('', '', HOTE), '');
    ok('un fournisseur qu\'on ne sait pas encadrer ne produit aucun lien');

    // ── 4. L'hôte : celui de la page, sinon celui de production ─────────────
    /* Twitch refuse un `parent` vide : une coquille WebView ou un fichier local doit
       quand même produire un lecteur valide. */
    assert.ok(E.lienFluxEsports('twitch', 'lcs').includes('parent='), 'un parent est toujours posé');
    assert.strictEqual(E.hoteCourant({ hostname: 'localhost' }), 'localhost');
    assert.strictEqual(E.hoteCourant({ hostname: '' }), E.HOTE_PAR_DEFAUT, 'hôte vide : on retombe sur la production');
    assert.strictEqual(E.hoteCourant(null), E.HOTE_PAR_DEFAUT);
    ok('le parent vient de la page, et jamais vide');

    // ── 5. La liste d'un événement, telle que l'API la donne ────────────────
    /* Charge réelle de getEventDetails pour Shopify Rebellion – FlyQuest. */
    const liens = E.liensDunEvenementEsports([
        { provider: 'twitch', locale: 'en-US', parameter: 'lcs' },
        { provider: 'youtube', locale: 'en-US', parameter: 'kEsofDOdNyA' },
        { provider: 'twitch', locale: 'es-MX', parameter: 'lolesportsla' },
        { provider: 'youtube', locale: 'es-MX', parameter: 'U4vY7ff_eeU' },
        { provider: 'twitch', locale: 'en-US', parameter: 'lcs' },
        { provider: 'inconnu', locale: 'fr', parameter: 'z' }
    ], HOTE);
    assert.strictEqual(liens.length, 4, 'quatre flux distincts, le doublon et l\'inconnu écartés : ' + liens.length);
    assert.strictEqual(liens[0].name, 'Twitch · en-US');
    assert.strictEqual(liens[0].source, 'lol_esports');
    assert.strictEqual(liens[0].lang, 'en-US');
    assert.ok(liens.every((l) => /^https:\/\/(player\.twitch\.tv|www\.youtube\.com)\//.test(l.url)), 'toutes encadrables');
    assert.deepStrictEqual(E.liensDunEvenementEsports(null, HOTE), [], 'aucun flux : aucune erreur');
    ok('la liste d\'un événement devient des liens jouables, sans doublon');

    console.log(`unit_esports: ${n} groupes de tests OK`);
    process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

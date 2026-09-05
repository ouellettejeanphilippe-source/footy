/* Résolution EN CHAÎNE des lecteurs (scripts/scrape_streams.mjs).

   Le but de cette application est d'amener la vidéo DANS la tuile — c'est la raison
   d'être du script utilisateur, qui vide la page de tout sauf le lecteur. « Ouvrir dans
   un onglet » n'est donc pas un repli acceptable : c'est l'échec que l'application
   existe pour supprimer.

   Or ces pages ne livrent jamais leur flux du premier coup. Chaîne relevée maillon par
   maillon le 5 septembre 2026 : Flexfitness → clearstreamdv → embed.sportspatrika.com
   → channel.php → dlhd. L'extraction s'arrêtait au PREMIER saut, et ne retenait que les
   candidats classés « embed » : les candidats « page » — précisément les maillons
   intermédiaires — étaient jetés, et le lien restait en onglet.

   Mesuré sur 40 liens réellement en échec dans le cache de production : 0 résolus avec
   le code d'alors, 14 avec la seule correction de précédence CSP, 16 en suivant la
   chaîne jusqu'à trois sauts.

   La fonction n'est pas exportable (script autonome à `await` de haut niveau, qui
   travaille dès l'import) : comme unit_scrapequeue et unit_framepolicy, on relit la
   source et on vérifie la règle, puis on rejoue l'ordre de préférence isolément. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

function main() {
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };
    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'scrape_streams.mjs'), 'utf8');

    // ── 1. La chaîne est suivie sur plusieurs sauts ─────────────────────────
    const m = /const EXTRACT_MAX_SAUTS = (\d+);/.exec(src);
    assert.ok(m, 'EXTRACT_MAX_SAUTS doit exister : la chaîne se suit sur plusieurs sauts');
    assert.ok(parseInt(m[1], 10) > 1,
        's\'arrêter au premier saut laisse le lien en onglet — c\'est le défaut corrigé (obtenu : ' + m[1] + ')');
    ok('la résolution suit la chaîne au-delà du premier saut');

    // ── 2. Un candidat « page » est SUIVI, plus jeté ────────────────────────
    assert.ok(/const suivant = cands\.find\(\(c\) => c\.url && !vus\.has\(c\.url\) && hostOf\(c\.url\) !== hote\);/.test(src),
        'faute de gagnant intégrable, le meilleur candidat doit devenir le maillon suivant');
    assert.ok(/vus\.add\(suivant\.url\);/.test(src),
        'les adresses déjà visitées doivent être mémorisées : sans quoi une chaîne circulaire boucle');
    ok('un candidat non intégrable devient le maillon suivant au lieu d\'être jeté');

    // ── 3. Un hôte découvert en chaîne est mesuré, pas supposé ──────────────
    /* Sans cette mesure on promeut un lecteur vers un hôte jamais vérifié : on rendrait
       au client le problème qu'on prétend lui enlever, et il découvrirait le refus trop
       tard — X-Frame-Options s'applique avant tout JavaScript. */
    assert.ok(/async function politiqueDeCadre\(host, url\)/.test(src),
        'les hôtes rencontrés en chaîne doivent être sondés à la demande');
    assert.ok(/if \(hostPolicy\[host\]\) return hostPolicy\[host\];/.test(src),
        'une seule mesure par hôte, mémorisée');
    ok('un hôte découvert en chaîne est mesuré à la demande, pas supposé intégrable');

    // ── 4. L'ordre de préférence, rejoué isolément ──────────────────────────
    /* Reproduction de la règle du script. Le flux direct passe DEVANT le lecteur
       intégrable : sans iframe, il n'y a pas d'X-Frame-Options à subir du tout, donc
       c'est le seul résultat qu'aucun en-tête distant ne peut reprendre. */
    const MEDIA = /\.(m3u8|mpd|mp4|webm|mov|m4v)(\?|#|$)/i;
    const choisir = (cands, hote, politique) => {
        const media = cands.find((c) => MEDIA.test(c.url));
        if (media) return { url: media.url, media: true };
        for (const c of cands) {
            if (c.kind !== 'embed') continue;
            const h = c.url.split('/')[2];
            if (!h || h === hote) continue;
            const pol = politique[h];
            if (!(pol && pol.embeddable === false)) return { url: c.url, media: false };
        }
        const suivant = cands.find((c) => c.url.split('/')[2] !== hote);
        return suivant ? { suivant: suivant.url } : null;
    };

    assert.deepStrictEqual(
        choisir([{ url: 'https://a.test/e.php', kind: 'embed' }, { url: 'https://b.test/x.m3u8', kind: 'page' }], 'p.test', {}),
        { url: 'https://b.test/x.m3u8', media: true },
        'un flux direct l\'emporte sur un lecteur à encadrer : aucune iframe, donc aucun en-tête à subir');

    assert.deepStrictEqual(
        choisir([{ url: 'https://bloque.test/e.php', kind: 'embed' }], 'p.test', { 'bloque.test': { embeddable: false } }),
        { suivant: 'https://bloque.test/e.php' },
        'un lecteur mesuré non intégrable devient le maillon suivant, au lieu de finir en onglet');

    assert.deepStrictEqual(
        choisir([{ url: 'https://ok.test/e.php', kind: 'embed' }], 'p.test', { 'ok.test': { embeddable: true } }),
        { url: 'https://ok.test/e.php', media: false },
        'un lecteur intégrable est retenu tout de suite');

    assert.strictEqual(choisir([{ url: 'https://p.test/autre', kind: 'page' }], 'p.test', {}), null,
        'rien à suivre sur le même hôte : la chaîne s\'arrête au lieu de tourner en rond');
    ok('ordre de préférence : flux direct, puis lecteur intégrable, puis maillon suivant');

    console.log(`unit_chaine: ${n} groupes de tests OK`);
    process.exit(0);
}

main();

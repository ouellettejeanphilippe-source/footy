/* Pourquoi une source ne joue pas (js/raisonflux.js).

   14 novembre 2026 : la tuile disait « Aucune vidéo » sans dire ce qu'elle savait. Ce test
   verrouille l'ordre des raisons (ce que la tuile a vu, puis la sonde du serveur, puis le
   registre), les phrases, et le fait que la tuile s'en sert. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function main() {
    const R = await import('../js/raisonflux.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };
    const code = (o) => R.raisonSansVideo(o).code;

    // 1. Sans rien savoir : pas de raison inventée.
    assert.strictEqual(code(), 'silence');
    assert.strictEqual(code({ politique: { embeddable: true, reason: 'aucun en-tête restrictif', status: 200 } }), 'silence');
    assert.strictEqual(R.raisonSansVideo().texte, '');
    ok('sans indice, aucune raison n\'est inventée');

    // 2. La sonde du serveur, telle que scrape_streams.mjs l'écrit dans hostPolicy.
    assert.strictEqual(code({ politique: { embeddable: null, reason: 'injoignable : fetch failed (ENOTFOUND)' } }), 'disparu');
    assert.strictEqual(code({ politique: { embeddable: null, reason: 'injoignable : fetch failed (ETIMEDOUT)' } }), 'muet');
    assert.strictEqual(code({ politique: { embeddable: null, reason: 'injoignable : fetch failed (CERT_HAS_EXPIRED)' } }), 'certificat');
    assert.strictEqual(code({ politique: { embeddable: true, reason: 'aucun en-tête restrictif', status: 404 } }), 'introuvable');
    assert.strictEqual(code({ politique: { embeddable: true, status: 502 } }), 'panne');
    assert.strictEqual(code({ politique: { embeddable: true, status: 403 } }), 'acces');
    assert.strictEqual(code({ politique: { embeddable: true, status: 451 } }), 'region');
    assert.strictEqual(code({ politique: { embeddable: false, reason: 'X-Frame-Options: sameorigin', status: 200 } }), 'cadre');
    assert.ok(/404/.test(R.raisonSansVideo({ politique: { status: 404 } }).texte), 'le code est dit');
    ok('la sonde du serveur donne adresse disparue, serveur muet, certificat, 404, panne, accès, région, cadre');

    // 3. Un défi porte les en-têtes de la page de défi : c'est le défi qu'on dit, pas le cadre.
    assert.strictEqual(code({ politique: { embeddable: false, reason: 'X-Frame-Options: sameorigin', status: 403, defi: true } }), 'defi');
    ok('un défi Cloudflare n\'est pas pris pour un refus de cadre');

    // 4. Ce que la tuile a vu elle-même passe avant tout ; le verdict du lien aussi vaut un refus.
    assert.strictEqual(code({ refus: true, politique: { status: 404 } }), 'cadre');
    assert.strictEqual(code({ lien: { verified: 'blocked' } }), 'cadre');
    ok('un cadre refusé vu par la tuile passe avant la sonde');

    // 5. Le registre : jamais joué, ici ou ailleurs, à partir de trois essais seulement.
    assert.strictEqual(code({ hote: { tested: 2, plays: 0 } }), 'silence');
    assert.strictEqual(code({ hote: { tested: 5, plays: 0 } }), 'jamais');
    assert.strictEqual(code({ hote: { tested: 5, plays: 0, appareilMort: true } }), 'jamais-ici');
    assert.strictEqual(code({ hote: { tested: 30, plays: 4 } }), 'silence');
    assert.ok(/0\/5/.test(R.raisonSansVideo({ hote: { tested: 5, plays: 0 } }).texte));
    ok('le registre ne parle qu\'à partir de trois essais sans lecture');

    // 6. Les phrases.
    assert.strictEqual(R.phraseSansVideo({ code: 'silence', texte: '' }, 'source suivante'), 'Aucune vidéo : source suivante');
    assert.strictEqual(R.phraseSansVideo(R.raisonSansVideo({ politique: { status: 404 } }), 'source suivante'), 'Aucune vidéo, la page du lecteur a disparu (404) : source suivante');
    assert.ok(/^Le serveur du lecteur ne répond pas\. .*autre source/.test(R.noteAbandon(R.raisonSansVideo({ politique: { reason: 'injoignable : x' } }), true)));
    assert.ok(/^Aucune vidéo sur cette source\. Aucune autre source/.test(R.noteAbandon(null, false)));
    ok('les messages portent la raison, ou rien de plus quand on ne sait pas');

    // 6 bis. Un flux direct en échec (chaîne de télé) : la raison du lecteur, dite en clair.
    assert.ok(/403.*pays/.test(R.raisonDirect('manifestLoadError HTTP 403')));
    assert.ok(/n’existe plus \(404\)/.test(R.raisonDirect('manifestLoadError HTTP 404')));
    assert.ok(/en panne \(503\)/.test(R.raisonDirect('levelLoadError HTTP 503')));
    assert.ok(/ne répond pas/.test(R.raisonDirect('manifestLoadError')), 'sans code : muet ou CORS');
    assert.ok(/ne répond pas/.test(R.raisonDirect('dash 25')), 'dash.js : manifeste illisible');
    assert.ok(/chiffré/.test(R.raisonDirect('keyLoadError')));
    assert.ok(/ne lit pas ce flux \(erreur vidéo 4\)/.test(R.raisonDirect('erreur vidéo 4')));
    assert.strictEqual(R.raisonDirect(''), 'le flux a échoué');
    const mvDirect = fs.readFileSync(path.join(__dirname, '..', 'js', 'multiview.js'), 'utf8');
    assert.ok(/creerLecteurVideo\(url, function\(raison\) \{[\s\S]{0,400}raisonDirect\(raison\)/.test(mvDirect), 'un lien direct en échec pose la note');
    ok('un flux direct en échec dit pourquoi (403, 404, panne, muet, chiffré, format)');

    // 7. Sans import, précaché, et employé par la tuile.
    const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'raisonflux.js'), 'utf8');
    assert.ok(!/^\s*import\s/m.test(src), 'module sans import');
    assert.ok(fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8').includes("'./js/raisonflux.js'"), 'dans APP_SHELL');
    const mv = fs.readFileSync(path.join(__dirname, '..', 'js', 'multiview.js'), 'utf8');
    assert.ok(/phraseSansVideo\(pourquoi, 'source suivante'\)/.test(mv), 'la bascule dit la raison');
    assert.ok(/poserNoteTuile\(celluleDeTuile\(place\), noteAbandon\(/.test(mv), 'la tuile qui s\'arrête laisse une note');
    ok('le module est sans import, précaché, et la tuile s\'en sert');

    console.log('\n' + n + ' vérifications réussies.');
}
main().catch((e) => { console.error(e); process.exit(1); });

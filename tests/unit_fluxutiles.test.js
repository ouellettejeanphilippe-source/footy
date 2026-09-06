/* Un lien n'est pas un flux : ce que le cache du serveur a le droit de considérer « chargé ».

   Question de l'utilisateur, le 6 septembre 2026 : « Je me demande si le fait que le
   serveur met à jour les liens, si c'est pas nuisible. » Mesuré sur le cache de
   production du même jour (651 matchs) : 389 matchs ne portaient AUCUN flux exploitable,
   et 294 d'entre eux portaient malgré tout au moins un lien — le repli « Page du match
   sur … », produit quand le passage horaire se fait refuser la page depuis son adresse
   de centre de données.

   Or le client décidait de rescanner ou non sur `streamLinks.length > 0`. Ce seul lien
   de repli suffisait donc à déclarer le match chargé : pour 294 matchs sur 651, le
   travail du serveur EMPÊCHAIT le client de lire la page lui-même — depuis l'adresse de
   l'utilisateur, celle qui, elle, n'est pas bloquée. La réponse à la question est oui,
   dans ce cas précis, et c'est ce que ces cas verrouillent.

   Deux catégories ne comptent pas comme flux :
   - le repli « Page du match sur … » (marqué `fallback`) ;
   - un lien de niveau supérieur sans lecteur résolu : il ne peut que s'ouvrir dans un
     onglet, soit l'échec que l'application existe pour supprimer. */
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

    // ── 1. Le cas exact relevé par l'utilisateur ────────────────────────────
    /* Philadelphia Union — CF Montréal, tel qu'il figurait dans le cache : un seul lien,
       le repli. La page Flexfitness correspondante, elle, porte deux lecteurs
       (a. et r.clearstreamdv.com). Le match doit être déclaré NON chargé. */
    const cfMontreal = {
        homeTeam: 'Philadelphia Union', awayTeam: 'CF Montréal',
        streamLinks: [{
            name: 'Page du match sur flexfitness.fit', quality: '', lang: '',
            url: 'https://flexfitness.fit/watch-live/mls/american-major-league-soccer/philadelphia-union-vs-cf-montr%C3%A9al/52966',
            icon: '🔗', source: 'flexfitness', site: 'flexfitness.fit', topLevel: true
        }]
    };
    assert.strictEqual(compter(cfMontreal), 0,
        'un repli « Page du match » seul ne doit pas passer pour un flux chargé : c\'est ce lien qui empêchait le rescan');
    ok('le repli « Page du match » ne compte pas, même reconnu par son seul nom');

    // ── 2. Le repli est écarté PAR SON NOM, pas seulement parce qu'il est topLevel ──
    /* Les deux filtres se recouvrent dans les données réelles : le repli est toujours
       posé en niveau supérieur. Ces deux cas retirent ce recouvrement, pour qu'aucun
       des deux ne puisse passer inaperçu si l'autre disparaît. */
    assert.strictEqual(compter({ streamLinks: [{ name: 'Page du match sur flexfitness.fit', url: 'https://flexfitness.fit/watch-live/x/y/1' }] }), 0,
        'le nom « Page du match » suffit à écarter le repli, même non marqué topLevel');
    assert.strictEqual(compter({ streamLinks: [{ name: 'Direct HD', url: 'https://x.test/a', fallback: true }] }), 0,
        'le marqueur `fallback` suffit à écarter le lien, même sous un nom de flux et sans topLevel');
    ok('le repli est écarté par son nom et par son marqueur, indépendamment du niveau');

    // ── 3. Niveau supérieur sans lecteur : injouable, donc pas un flux ──────
    assert.strictEqual(compter({ streamLinks: [{ name: 'Serveur 1', url: 'https://bloque.test/x', topLevel: true }] }), 0,
        'un lien de niveau supérieur sans lecteur ne s\'ouvre qu\'en onglet');
    // ...mais AVEC un lecteur résolu, il se joue, donc il compte.
    assert.strictEqual(compter({ streamLinks: [{ name: 'Serveur 1', url: 'https://bloque.test/x', topLevel: true, playerUrl: 'https://embed.test/p' }] }), 1,
        'un lien de niveau supérieur DONT le lecteur est résolu est jouable');
    ok('le niveau supérieur ne disqualifie que faute de lecteur résolu');

    // ── 4. Les vrais flux comptent, et le compte est exact ──────────────────
    /* Les deux lecteurs réellement présents sur la page Flexfitness de ce match,
       relevés le 6 septembre 2026, plus le repli qui les accompagnait. */
    const reel = { streamLinks: [
        { name: 'Page du match sur flexfitness.fit', url: 'https://flexfitness.fit/watch-live/x/y/1', topLevel: true },
        { name: 'Link 1', quality: '1080p', url: 'https://a.clearstreamdv.com/live/player.php?ch=es143' },
        { name: 'Link 2', quality: '720p', url: 'https://r.clearstreamdv.com/live/player.php?ch=es143' }
    ] };
    assert.strictEqual(compter(reel), 2, 'les deux lecteurs comptent, le repli non');
    ok('un match réellement pourvu est bien déclaré chargé');

    // ── 5. Entrées dégradées : rien ne doit lever ───────────────────────────
    assert.strictEqual(compter(null), 0);
    assert.strictEqual(compter({}), 0);
    assert.strictEqual(compter({ streamLinks: [] }), 0);
    assert.strictEqual(compter({ streamLinks: [null, { name: 'sans url' }] }), 0,
        'un lien sans adresse n\'est pas un flux');
    ok('les entrées vides ou incomplètes valent zéro sans lever');

    console.log('unit_fluxutiles: ' + n + ' groupes OK');
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

/* Relire la page dans le navigateur à l'ouverture d'un match.

   « C'est pas mieux de le faire au chargement, on dirait que oui. » — oui, pour le match
   qu'on ouvre. Mesuré le 6 septembre 2026 :

   - GitHub Actions lit depuis une adresse de centre de données que plusieurs sources
     refusent (footybite.bid : 403 depuis un serveur, des dizaines de liens chez
     l'utilisateur) ; le navigateur, lui, lit depuis l'adresse de l'utilisateur ;
   - le cache a jusqu'à une heure de retard, et ce jour-là il est resté figé six heures
     durant, le passage horaire mourant à court de mémoire ;
   - à l'inverse, le navigateur seul ne suffit pas : ni footybite.im ni flexfitness.fit
     n'envoient d'en-tête CORS, il ne peut donc pas les lire sans le script utilisateur.

   D'où la règle : le cache sert d'affichage immédiat, la relecture locale a le dernier
   mot. Ces cas verrouillent QUAND elle se déclenche. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

async function main() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://x.test/' });
    for (const k of ['window', 'document', 'DOMParser', 'localStorage', 'navigator', 'HTMLElement']) {
        Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
    }
    const s = await import('../js/scrapers.js');
    const doit = s.doitRelireLaPage;
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    const venuDuCache = { homeTeam: 'Philadelphia Union', awayTeam: 'CF Montréal', prefetched: true,
        matchUrl: 'https://flexfitness.fit/watch-live/mls/x/philadelphia-union-vs-cf-montreal/52966',
        streamLinks: [{ name: 'Page du match sur flexfitness.fit', url: 'https://flexfitness.fit/watch-live/mls/x/1', topLevel: true }] };

    // ── 1. Un match venu du cache est relu — même s'il porte déjà des liens ──
    assert.strictEqual(doit(venuDuCache), true,
        'un match venu du cache horaire doit être relu depuis le navigateur');
    /* Le point qui compte : un cache RICHE se relit aussi. Ce n'est pas un rattrapage
       pour les matchs démunis, c'est la fraîcheur pour tous — un lien d'il y a une heure
       peut être mort, et la source peut en avoir publié dix de plus depuis. */
    const cacheRiche = Object.assign({}, venuDuCache, { streamLinks: [
        { name: 'Link 1', url: 'https://a.clearstreamdv.com/live/player.php?ch=es143' },
        { name: 'Link 2', url: 'https://r.clearstreamdv.com/live/player.php?ch=es143' }
    ] });
    assert.strictEqual(doit(cacheRiche), true,
        'un cache déjà fourni doit être relu lui aussi : la fraîcheur vaut pour tous les matchs');
    ok('tout match venu du cache est relu, démuni comme fourni');

    // ── 2. Une seule relecture par match et par session ─────────────────────
    const dejaRelu = Object.assign({}, venuDuCache, { relueLocalement: true });
    assert.strictEqual(doit(dejaRelu), false,
        'rouvrir dix fois la même fiche ne doit pas rescanner dix fois');
    ok('la relecture n\'a lieu qu\'une fois par match et par session');

    // ── 3. Ce qui n'est pas venu du cache n'a rien à relire ─────────────────
    const trouveIci = Object.assign({}, venuDuCache, { prefetched: false });
    assert.strictEqual(doit(trouveIci), false,
        'un match dont les flux ont été trouvés ici même vient déjà de l\'adresse de l\'utilisateur');
    ok('un match déjà scanné localement n\'est pas rescanné');

    // ── 4. Sans page à lire, rien à faire ───────────────────────────────────
    assert.strictEqual(doit(Object.assign({}, venuDuCache, { matchUrl: '' })), false);
    assert.strictEqual(doit(null), false);
    assert.strictEqual(doit({}), false);
    ok('les entrées sans page ou dégradées ne déclenchent rien, sans lever');

    // ── 5. L'appel côté fiche relit VRAIMENT ────────────────────────────────
    /* Sans `force`, le cache local du navigateur renverrait aussitôt ce que le serveur
       avait déposé : la relecture ne relirait rien du tout. C'est le défaut le plus
       facile à réintroduire, et le seul que la fonction ci-dessus ne peut pas attraper. */
    const ui = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui.js'), 'utf8');
    const bloc = ui.slice(ui.indexOf('if (doitRelireLaPage(m))'));
    assert.ok(bloc.indexOf('if (doitRelireLaPage(m))') === 0, 'la fiche doit consulter doitRelireLaPage');
    const appel = /scrapeMatchFlux\(m,\s*([a-z]+)\s*,\s*([a-z]+)\s*\)/.exec(bloc.slice(0, 1200));
    assert.ok(appel, 'la relecture doit appeler scrapeMatchFlux');
    assert.strictEqual(appel[1], 'true',
        'la relecture doit FORCER : sinon le cache local du navigateur la court-circuite et rien n\'est relu');
    assert.strictEqual(appel[2], 'true',
        'la relecture doit être profonde : les autres sources du même match (altUrls) portent souvent les flux');
    ok('la fiche force une relecture profonde, sans quoi elle ne relirait rien');

    console.log('unit_relecture: ' + n + ' groupes OK');
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

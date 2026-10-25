/* Jouabilité observée (js/playability.js) et classement des liens (sortFluxLinks).

   Pendant des semaines, la tuile ouvrait d'abord le lien dont l'adresse « faisait bien »
   (qualité annoncée, nom du site) — et presque rien ne jouait. Ces cas verrouillent le
   nouvel ordre : le choix de l'utilisateur, puis ce qui a été OBSERVÉ en train de jouer,
   puis seulement la forme du lien. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://x.test/' });
    for (const k of ['window', 'document', 'DOMParser', 'localStorage', 'navigator', 'HTMLElement']) {
        Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
    }
    const P = await import('../js/playability.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    // ── 1. Verdict d'une observation ────────────────────────────────────────
    /* LA VIDÉO DOIT ÊTRE ARRIVÉE, PAS SEULEMENT DEMANDÉE.

       Ces assertions disaient l'inverse : `{ mediaRequests: 3 }` valait « joue ». Or
       `mediaRequests` compte les requêtes PARTIES, et rien ne regardait les réponses.
       Signalé le 26 septembre 2026 : « les embed.st, ya genre généralement RIEN qui
       joue » — pendant qu'embed.st était noté 24 sur 24 « joue », donc premier au
       classement, donc la première chose qu'une tuile chargeait. Son lecteur
       pair-à-pair demande un manifeste dès l'ouverture ; que la réponse soit un 500
       ne changeait rien au verdict. C'était déjà relevé le 20 septembre — « embed.st à
       1/1 alors que son manifeste répondait HTTP 500 » — et attribué à tort au fait que
       le registre ne s'accumulait pas.

       Le verdict se gagne donc sur `videoReady`, ou sur `mediaOk` : les réponses vidéo
       en 2xx. */
    assert.strictEqual(P.verdictFromObservation({ mediaRequests: 9, mediaOk: 0, status: 200 }), 'none',
        'demander de la vidéo sans en recevoir : ça NE joue pas');
    assert.strictEqual(P.verdictFromObservation({ mediaRequests: 3, mediaOk: 1, status: 200 }), 'none',
        'une seule réponse : le manifeste existe, aucun segment n’a suivi');
    assert.strictEqual(P.verdictFromObservation({ mediaRequests: 3, mediaOk: 2 }), 'plays',
        'le manifeste ET un segment sont arrivés : ça joue');
    assert.strictEqual(P.verdictFromObservation({ videoReady: true }), 'plays', 'un <video> avec des données : ça joue');
    assert.strictEqual(P.verdictFromObservation({ frameError: true }), 'blocked', 'cadre refusé');
    assert.strictEqual(P.verdictFromObservation({ status: 403 }), 'blocked', 'hôte mort');
    assert.strictEqual(P.verdictFromObservation({ status: 200 }), 'none', 'chargé, rien ne joue');
    assert.strictEqual(P.verdictFromObservation(null), 'none');
    assert.strictEqual(P.verdictFromObservation({ mediaOk: 4, frameError: true }), 'plays',
        'la vidéo REÇUE prime sur un cadre secondaire en erreur');
    assert.strictEqual(P.verdictFromObservation({ mediaRequests: 4, mediaOk: 0, mediaEchecs: 4, status: 200 }), 'none',
        'quatre refus de suite : le lecteur réclame, le CDN ne donne rien');
    ok('verdict : la vidéo arrivée, pas seulement demandée');

    /* Le critère est versionné, et `verify_players.mjs` vide le registre quand il change :
       des compteurs gagnés sous une règle fausse ne valent rien, et les laisser vieillir
       tout seuls prendrait des semaines. */
    assert.strictEqual(typeof P.CRITERE_VERDICT, 'number');
    assert.ok(P.CRITERE_VERDICT >= 2, 'la règle « arrivé, pas demandé » est la v2');
    ok('le critère du verdict porte une version');

    // ── 1 bis. Ce qui compte comme du trafic vidéo ──────────────────────────
    /* Relevé au premier passage réel : des bibliothèques JS dans un dossier « hls », et la
       page de sonde dont l'adresse encodée finissait en « .m3u8 », étaient comptées. */
    for (const u of [
        'https://lb2.strmd.st/secure/abc/rtmp/stream/x.m3u8',
        'https://a117.azplay47.me/hls/streama266057/index.m3u8?cst=090125',
        'https://hls.hockey.do/hls-segments/f958/1756.ts',
        'https://vkvsd287.okcdn.ru/dash/stream_1997/stream.manifest/sig/k/expires/1788',
        'https://cdn1.obstreamx.click/live/igm5bzjd4y.m3u8'
    ]) assert.strictEqual(P.isMediaRequest(u), true, u + ' est de la vidéo');
    for (const u of [
        'https://cdn.jsdelivr.net/npm/@swarmcloud/hls/p2p-engine.min.js',
        'https://static.rutube.ru/static/player_sdk/hls/1.6.15/hls.min.js',
        'https://guide-des-sports.local/probe.html?u=https%3A%2F%2Fedge.test%2Fngtrk%2Flive.m3u8',
        'https://site.test/hls/poster.png',
        'https://site.test/player.html?src=video.m3u8',
        'pas une adresse', '', null
    ]) assert.strictEqual(P.isMediaRequest(u), false, String(u) + ' n\'est pas de la vidéo');
    ok('isMediaRequest : jugé sur le chemin, jamais un script ni la page de sonde');

    // ── 2. Ce que la tuile charge vraiment ──────────────────────────────────
    assert.strictEqual(P.tileTarget({ url: 'https://a.test/page', topLevel: true, playerUrl: 'https://p.test/embed' }), 'https://a.test/page', 'toujours la page, même avec un playerUrl résiduel dans le cache');
    assert.strictEqual(P.tileTarget({ url: 'https://a.test/page' }), 'https://a.test/page');
    assert.strictEqual(P.tileTarget(null), '');
    assert.strictEqual(P.hostOfUrl('https://www.p.test/x'), 'p.test');
    assert.strictEqual(P.hostOfUrl('pas une adresse'), '');
    ok('tileTarget : la page, comme la tuile');

    // ── 3. Registre par hôte ────────────────────────────────────────────────
    let ledger = {};
    P.recordObservation(ledger, 'p.test', 'plays');
    P.recordObservation(ledger, 'p.test', 'none');
    P.recordObservation(ledger, 'mort.test', 'blocked');
    assert.deepStrictEqual(ledger['p.test'], { tested: 2, plays: 1 });
    assert.deepStrictEqual(ledger['mort.test'], { tested: 1, plays: 0 });
    for (let i = 0; i < 60; i++) P.recordObservation(ledger, 'p.test', 'plays', 40);
    assert.ok(ledger['p.test'].tested <= 40, 'au-delà du plafond, les compteurs sont divisés (obtenu : ' + ledger['p.test'].tested + ')');
    const fusion = P.mergeLedgers({ a: { tested: 2, plays: 1 } }, { a: { tested: 1, plays: 1 }, b: { tested: 1, plays: 0 } });
    assert.deepStrictEqual(fusion, { a: { tested: 3, plays: 2 }, b: { tested: 1, plays: 0 } });
    ok('registre : cumul, plafond, fusion serveur + navigateur');

    // ── 4. Score de jouabilité ──────────────────────────────────────────────
    const L = {
        joue: { url: 'https://a.test/1', verified: 'plays' },
        bloque: { url: 'https://b.test/1', verified: 'blocked' },
        rien: { url: 'https://c.test/1', verified: 'none' },
        inconnu: { url: 'https://d.test/1' },
        hoteBon: { url: 'https://e.test/1' },
        hoteMort: { url: 'https://f.test/1' }
    };
    const reg = { 'e.test': { tested: 6, plays: 5 }, 'f.test': { tested: 4, plays: 0 } };
    assert.strictEqual(P.playabilityScore(L.joue, reg), 3);
    assert.strictEqual(P.playabilityScore(L.hoteBon, reg), 2, 'hôte qui joue le plus souvent');
    assert.strictEqual(P.playabilityScore(L.inconnu, reg), 1, 'jamais éprouvé : entre les deux');
    assert.strictEqual(P.playabilityScore(L.rien, reg), 0);
    assert.strictEqual(P.playabilityScore(L.hoteMort, reg), 0, 'hôte éprouvé qui ne joue jamais');
    assert.strictEqual(P.playabilityScore(L.bloque, reg), -1);
    assert.strictEqual(P.playabilityScore({ url: 'https://e.test/2' }, { 'e.test': { tested: 2, plays: 2 } }), 1, 'moins de trois essais : on ne conclut pas');
    ok('score : observé > hôte fiable > inconnu > rien > bloqué');

    /* Patience de la tuile : un lien qui joue d'ordinaire (embed.st, 4/4 au vérificateur,
       mais 30 s et plus à démarrer sur Firefox) reçoit la patience longue ; l'inconnu et le
       douteux gardent la courte, pour ne pas bloquer 90 s sur une page morte. */
    assert.strictEqual(P.patienceMs(L.joue, reg, 30000, 90000), 90000, 'lien observé en lecture : patience longue');
    assert.strictEqual(P.patienceMs(L.hoteBon, reg, 30000, 90000), 90000, 'hôte qui joue le plus souvent : patience longue');
    assert.strictEqual(P.patienceMs(L.inconnu, reg, 30000, 90000), 30000, 'inconnu : patience courte');
    assert.strictEqual(P.patienceMs(L.rien, reg, 30000, 90000), 30000);
    assert.strictEqual(P.patienceMs(L.bloque, reg, 30000, 90000), 30000);
    ok('patience de la tuile : longue pour ce qui joue d\'ordinaire, courte sinon');

    // ── 5. Choix des cibles d'un passage ────────────────────────────────────
    const lk = (h, i) => ({ url: 'https://' + h + '/' + i });
    const matches = [
        { rank: 2, streamLinks: [lk('x.test', 1)] },
        { rank: 0, streamLinks: [lk('a.test', 1), lk('a.test', 2), lk('b.test', 1), lk('c.test', 1), lk('d.test', 1)] },
        { rank: 1, streamLinks: [lk('a.test', 3), lk('b.test', 2)] },
        { rank: 0, streamLinks: [] },
        { rank: 0, streamLinks: [{ url: 'https://p.test/page', topLevel: true, playerUrl: 'https://lecteur.test/e' }] }
    ];
    const cibles = P.pickTargets(matches, { perMatch: 3, perHost: 2, total: 10 });
    assert.strictEqual(cibles[0].matchIndex, 1, 'les matchs en direct d\'abord');
    const duLive = cibles.filter((c) => c.matchIndex === 1);
    assert.strictEqual(duLive.length, 3, 'au plus trois liens par match');
    assert.deepStrictEqual(duLive.map((c) => c.host), ['a.test', 'b.test', 'c.test'], 'des hôtes distincts par match');
    assert.ok(cibles.some((c) => c.target === 'https://p.test/page'), 'la cible est ce que la tuile charge : la page, jamais le playerUrl');
    assert.strictEqual(cibles.filter((c) => c.host === 'a.test').length, 2, 'au plus deux essais par hôte sur le passage');
    assert.strictEqual(cibles[cibles.length - 1].matchIndex, 0, 'le reste en dernier');
    assert.deepStrictEqual(P.pickTargets([], {}), []);
    ok('pickTargets : en direct d\'abord, hôtes distincts, plafond par hôte');

    // ── 6. Source suivante ──────────────────────────────────────────────────
    const liens = [lk('a.test', 1), lk('b.test', 1), lk('c.test', 1)];
    assert.strictEqual(P.nextLinkAfter(liens, 'https://a.test/1').url, 'https://b.test/1');
    assert.strictEqual(P.nextLinkAfter(liens, 'https://c.test/1').url, 'https://a.test/1', 'revient au début');
    assert.strictEqual(P.nextLinkAfter(liens, 'https://inconnu.test/').url, 'https://a.test/1', 'adresse inconnue : le premier');
    assert.strictEqual(P.nextLinkAfter([liens[0]], 'https://a.test/1'), null, 'un seul lien : rien d\'autre');
    ok('nextLinkAfter : cycle sur les liens du match');

    // ── 7. sortFluxLinks : l'observé passe avant la forme ───────────────────
    const C = await import('../js/config.js');
    globalThis.window.hostPlayLedger = { 'fiable.test': { tested: 5, plays: 5 }, 'mort.test': { tested: 5, plays: 0 } };
    const tri = C.sortFluxLinks([
        { name: 'HD 1080p', url: 'https://mort.test/1', quality: '1080p' },
        { name: 'SD', url: 'https://fiable.test/1' },
        { name: 'Vu jouer', url: 'https://autre.test/1', verified: 'plays' },
        { name: 'Bloqué', url: 'https://bloque.test/1', verified: 'blocked' },
        { name: 'Inconnu', url: 'https://inconnu.test/1' }
    ]);
    assert.deepStrictEqual(tri.map((l) => l.name), ['Vu jouer', 'SD', 'Inconnu', 'HD 1080p', 'Bloqué'],
        'observé > hôte fiable > inconnu > hôte mort (même « 1080p ») > bloqué (obtenu : ' + tri.map((l) => l.name).join(' > ') + ')');
    C.notePlayability({ url: 'https://inconnu.test/1' }, 'plays');
    C.notePlayability({ url: 'https://inconnu.test/1' }, 'plays');
    C.notePlayability({ url: 'https://inconnu.test/1' }, 'plays');
    assert.strictEqual(C.playLedger()['inconnu.test'].plays, 3, 'le registre local du navigateur compte');
    assert.strictEqual(P.playabilityScore({ url: 'https://inconnu.test/1' }, C.playLedger()), 2, 'trois lectures vues par le navigateur : l\'hôte devient fiable');
    const tri2 = C.sortFluxLinks([{ name: 'HD', url: 'https://mort.test/1', quality: '1080p' }, { name: 'Inconnu', url: 'https://inconnu.test/1' }]);
    assert.strictEqual(tri2[0].name, 'Inconnu', 'un hôte vu jouer passe devant un hôte mort, quelle que soit la qualité annoncée');
    ok('sortFluxLinks : l\'observation prime sur la qualité annoncée');

    // ── 8. Réputation continue : hôte, puis source, puis a priori ───────────
    {
        const ledger = { 'eprouve.test': { tested: 34, plays: 17 }, 'chanceux.test': { tested: 1, plays: 1 }, 'rare.test': { tested: 4, plays: 1 } };
        const sources = { bonne: { tested: 20, plays: 19 }, mauvaise: { tested: 40, plays: 0 } };
        const r = (l) => P.reputationLien(l, ledger, sources);
        assert.strictEqual(r({ url: 'https://x.test/', verified: 'plays' }), 1);
        assert.ok(r({ url: 'https://eprouve.test/1' }) > r({ url: 'https://chanceux.test/1' }), '17 sur 34 éprouvé bat un 1 sur 1 chanceux');
        assert.ok(r({ url: 'https://rare.test/1' }) < P.REPUTATION_A_PRIORI, 'un sur quatre passe sous l\'inconnu');
        assert.ok(r({ url: 'https://neuf.test/1', source: 'bonne' }) > r({ url: 'https://neuf.test/2' }), 'hôte inconnu d\'une bonne source : devant l\'inconnu sans source');
        assert.ok(r({ url: 'https://neuf.test/1', source: 'mauvaise' }) < r({ url: 'https://neuf.test/2' }), '… et celui d\'une source qui ne joue jamais, derrière');
        assert.strictEqual(r({ url: 'https://eprouve.test/1', source: 'mauvaise' }), r({ url: 'https://eprouve.test/1' }), 'l\'hôte éprouvé l\'emporte sur la source');

        const parSource = P.reputationParSource([
            { streamLinks: [{ url: 'https://eprouve.test/1', source: 'a' }, { url: 'https://eprouve.test/2', source: 'a' }, { url: 'https://rare.test/1', source: 'a' }] },
            { streamLinks: [{ url: 'https://eprouve.test/3', source: 'b' }, { url: 'https://inconnu.test/1', source: 'b' }, { url: 'https://x.test/', source: '' }] },
        ], ledger);
        assert.deepStrictEqual(parSource, { a: { tested: 38, plays: 18 }, b: { tested: 34, plays: 17 } }, 'un hôte compte une fois par source');
        ok('reputationLien : hôte lissé, puis source, puis a priori ; reputationParSource sans double compte');

        globalThis.window.hostPlayLedger = {};
        globalThis.window.sourcePlayLedger = { daddylive: { tested: 20, plays: 20 }, methstreams: { tested: 40, plays: 0 } };
        try { globalThis.localStorage.removeItem('play_ledger'); globalThis.localStorage.removeItem('play_ledger_sources'); } catch (e) {}
        const tri3 = C.sortFluxLinks([
            { name: 'Meth 1080p', url: 'https://fxtrend.test/1', quality: '1080p', source: 'methstreams' },
            { name: 'Daddy', url: 'https://dlive.test/1', source: 'daddylive' },
            { name: 'Sans source', url: 'https://autre.test/1' },
        ]);
        assert.deepStrictEqual(tri3.map((l) => l.name), ['Daddy', 'Sans source', 'Meth 1080p'],
            'dans un même palier, la réputation de la source passe avant la qualité annoncée (obtenu : ' + tri3.map((l) => l.name).join(' > ') + ')');
        C.notePlayability({ url: 'https://neuf.test/1', source: 'nouvelle' }, 'plays');
        assert.deepStrictEqual(C.sourcePlayLedger().nouvelle, { tested: 1, plays: 1 }, 'le navigateur note aussi la source');
        ok('sortFluxLinks : réputation de l\'hôte ou de la source dans le palier, avant la qualité');

        /* « Les sites les plus célèbres en premier » (25 octobre 2026) : Streamed et
           DaddyLive devant un hôte inconnu vu jouer ; jamais devant un choix ⭐ / 👎, jamais
           un lien vu mort ; et un nom connu qui ne joue jamais perd son rang. */
        assert.strictEqual(P.rangNotoriete({ url: 'https://embed.st/x', source: 'sportsurge' }), 1, 'le lecteur de Streamed, même venu d\'un agrégateur');
        assert.strictEqual(P.rangNotoriete({ url: 'https://dlive.sx/1', source: 'daddylive' }), 1);
        assert.strictEqual(P.rangNotoriete({ url: 'https://inconnu.test/1', source: 'sportsurge' }), P.RANG_INCONNU, 'un agrégateur connu vers un hôte inconnu');
        assert.strictEqual(P.rangNotoriete({ url: 'https://x.test/1', source: 'methstreams' }, { methstreams: { tested: 12, plays: 0 } }), P.RANG_INCONNU, 'connu mais éprouvé mort');
        globalThis.window.sourcePlayLedger = {};
        globalThis.window.hostPlayLedger = {};
        const tri4 = C.sortFluxLinks([
            { name: 'Inconnu vu jouer', url: 'https://hasard.test/1', verified: 'plays', source: 'footybite' },
            { name: 'Streamed mort', url: 'https://embed.st/mort', verified: 'blocked', source: 'streamed' },
            { name: 'DaddyLive', url: 'https://dlive.sx/1', source: 'daddylive' },
            { name: 'Streamed', url: 'https://embed.st/1', source: 'streamed', quality: '720p' },
            { name: 'Meth', url: 'https://meth.test/1', source: 'methstreams' },
        ]);
        assert.deepStrictEqual(tri4.map((l) => l.name), ['Streamed', 'DaddyLive', 'Meth', 'Inconnu vu jouer', 'Streamed mort']);
        ok('sortFluxLinks : les sites connus en premier, sauf vus morts');
    }

    // ── 9. L'appareil corrige le serveur (24 octobre 2026) ──────────────────
    /* « Je voudrais que ça se corrige et adapte de lui-même. » Avant, la somme
       serveur + appareil laissait 30/40 + 0/5 = 30/45 en tête sur un appareil où l'hôte
       n'avait jamais joué ; et un ⏭ manuel n'apprenait rien. */
    {
        const serveur = { 'serveurok.test': { tested: 40, plays: 30 }, 'neuf.test': { tested: 2, plays: 0 } };
        const f = P.fusionAppareil(serveur, { 'serveurok.test': { tested: 5, plays: 0 }, 'peu.test': { tested: 2, plays: 0 } });
        assert.strictEqual(f['serveurok.test'].appareilMort, true, '0 sur 5 ici : mort sur cet appareil');
        assert.deepStrictEqual([f['serveurok.test'].tested, f['serveurok.test'].plays], [9, 3], 'le serveur ne pèse plus que quatre essais');
        assert.deepStrictEqual(f['peu.test'], { tested: 2, plays: 0 }, 'sous le seuil : simple somme');
        assert.deepStrictEqual(f['neuf.test'], { tested: 2, plays: 0 }, 'le serveur seul reste tel quel');
        assert.deepStrictEqual(serveur['serveurok.test'], { tested: 40, plays: 30 }, 'le registre du serveur n\'est pas modifié');
        const g = P.fusionAppareil(serveur, { 'serveurok.test': { tested: 4, plays: 3 } });
        assert.ok(!g['serveurok.test'].appareilMort && P.playabilityScore({ url: 'https://serveurok.test/1' }, g) === 2, 'joue ici aussi : reste fiable');

        const vu = { url: 'https://serveurok.test/1', verified: 'plays' };
        assert.strictEqual(P.playabilityScore(vu, f), 0, 'vu jouer par le serveur, jamais ici : ne passe plus devant');
        assert.ok(P.reputationLien(vu, f, {}) < 0.5, '… et sa réputation n\'est plus celle d\'un lien vu jouer');
        assert.strictEqual(P.marqueJouabilite(vu, f).classe, 'si-mort', 'la liste le dit');
        assert.strictEqual(P.marqueJouabilite(vu, f).texte, 'ici 0/5');

        globalThis.window.hostPlayLedger = { 'serveurok.test': { tested: 40, plays: 30 } };
        globalThis.window.sourcePlayLedger = {};
        try { globalThis.localStorage.removeItem('play_ledger'); globalThis.localStorage.removeItem('play_ledger_sources'); } catch (e) {}
        const liens = [{ name: 'Serveur', url: 'https://serveurok.test/1', verified: 'plays' }, { name: 'Inconnu', url: 'https://autre.test/1' }];
        assert.strictEqual(C.sortFluxLinks(liens)[0].name, 'Serveur', 'au départ, le verdict du serveur mène');
        for (let i = 0; i < 3; i++) C.notePlayability({ url: 'https://serveurok.test/1' }, 'none');
        assert.strictEqual(C.sortFluxLinks(liens)[0].name, 'Inconnu', 'trois échecs ici : il descend tout seul');
        C.notePlayability({ url: 'https://serveurok.test/1' }, 'plays');
        assert.strictEqual(C.sortFluxLinks(liens)[0].name, 'Serveur', 'et remonte dès qu\'il joue ici');

        assert.strictEqual(P.sautManuelEstEchec({ aJoue: false, depuisMs: 20000 }), true, '⏭ après 20 s sans vidéo : échec');
        assert.strictEqual(P.sautManuelEstEchec({ aJoue: true, depuisMs: 20000 }), false, 'source qui a joué : jamais');
        assert.strictEqual(P.sautManuelEstEchec({ aJoue: false, depuisMs: 2000 }), false, 'trop tôt : pas laissé sa chance');
        assert.strictEqual(P.sautManuelEstEchec({ aJoue: false, depuisMs: 10 * 60000 }), false, 'regardée longtemps : autre raison');
        assert.strictEqual(P.sautManuelEstEchec({ aJoue: false, depuisMs: NaN }), false, 'durée inconnue : rien');
        ok('fusionAppareil : l\'appareil corrige le serveur ; sautManuelEstEchec');
    }

    // ── 10. Éprouver ce qui sera montré en premier ; trier sur la définition mesurée ──
    /* Mesuré le 24 octobre 2026 : 88 cibles par passage, prises dans l'ordre de collecte,
       dont 20 % sur des hôtes déjà tranchés morts. */
    {
        const ledger = { 'mort.test': { tested: 30, plays: 1 }, 'bon.test': { tested: 30, plays: 28 }, 'moyen.test': { tested: 10, plays: 5 } };
        const matches = [{ rank: 0, streamLinks: [
            { url: 'https://mort.test/1' }, { url: 'https://moyen.test/1' }, { url: 'https://neuf.test/1' }, { url: 'https://bon.test/1' },
        ] }];
        const brut = P.pickTargets(matches, { perMatch: 2 }).map((c) => c.host);
        assert.deepStrictEqual(brut, ['mort.test', 'moyen.test'], 'sans registre : l\'ordre de collecte, comme avant');
        const classe = P.pickTargets(matches, { perMatch: 2, ledger }).map((c) => c.host);
        assert.deepStrictEqual(classe, ['bon.test', 'moyen.test'], 'avec le registre : les deux premiers du classement');
        const tout = P.pickTargets(matches, { perMatch: 4, ledger }).map((c) => c.host);
        assert.strictEqual(tout[tout.length - 1], 'mort.test', 'l\'hôte tranché mort passe après toutes les autres cibles');
        assert.strictEqual(P.pickTargets(matches, { perMatch: 4, ledger, total: 3 }).some((c) => c.host === 'mort.test'), false, '… et saute s\'il n\'y a pas la place');
        assert.ok(P.hoteTranche({ tested: 20, plays: 2 }) && !P.hoteTranche({ tested: 19, plays: 0 }) && !P.hoteTranche({ tested: 40, plays: 5 }));

        const precedent = { matches: [{ streamLinks: [{ url: 'https://bon.test/1', verified: 'plays', verifiedAt: '2026-10-24T12:00:00Z', hauteur: 1080 }] }] };
        const neufs = [{ streamLinks: [{ url: 'https://bon.test/1' }] }];
        P.reporterVerifications(neufs, precedent, Date.parse('2026-10-24T13:00:00Z'));
        assert.strictEqual(neufs[0].streamLinks[0].hauteur, 1080, 'la hauteur mesurée est reportée avec son verdict');

        globalThis.window.hostPlayLedger = {};
        globalThis.window.sourcePlayLedger = {};
        try { globalThis.localStorage.removeItem('play_ledger'); globalThis.localStorage.removeItem('play_ledger_sources'); } catch (e) {}
        const tri = C.sortFluxLinks([
            { name: 'Annoncé 1080p', url: 'https://a.test/1', quality: '1080p', verified: 'plays', hauteur: 480 },
            { name: 'Vu en 720', url: 'https://b.test/1', verified: 'plays', hauteur: 720 },
            { name: 'Vu en 1080', url: 'https://c.test/1', verified: 'plays', hauteur: 1080 },
        ]);
        assert.deepStrictEqual(tri.map((l) => l.name), ['Vu en 1080', 'Vu en 720', 'Annoncé 1080p'],
            'la définition mesurée passe avant l\'annoncée (obtenu : ' + tri.map((l) => l.name).join(' > ') + ')');
        ok('pickTargets suit le classement et relègue les hôtes tranchés ; la définition mesurée trie');
    }

    console.log(`unit_playability: ${n} groupes de tests OK`);
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

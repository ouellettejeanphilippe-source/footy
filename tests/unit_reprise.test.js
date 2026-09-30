/* Une source n'est abandonnée qu'après avoir été rechargée (js/playability.js :
   actionSansVideo, arretMeriteRechargement ; js/multiview.js : armerBasculeAuto,
   armerRepriseTuile). Sans réseau.

   « Trop vite à switch de sources quand ça bugge, au lieu de tenter de recharger »
   (19 septembre 2026).

   La tuile abandonnait une source au PREMIER silence : trente secondes sans signal du
   script utilisateur et elle passait à la suivante, qui repartait de zéro. Or une page de
   lecteur rate souvent son démarrage sans que le lien soit en cause — script posé avant le
   lecteur, publicité qui vole le premier clic, segment initial perdu — et le même lien,
   rechargé, joue. Pire : un flux qui S'ARRÊTAIT après avoir joué n'était traité nulle
   part, la tuile restait noire jusqu'à ce qu'on s'en occupe à la main.

   Ce que ce test verrouille :
     - sans le script utilisateur, la tuile ne décide toujours rien seule ;
     - rien ne joue : on RECHARGE la même source, et on ne passe à la suivante qu'après ;
     - une tuile seule sur son match est rechargée elle aussi (elle n'a nulle part où
       aller, ce n'est pas une raison pour ne rien tenter) ;
     - un flux qui s'arrête après avoir joué est RECHARGÉ, jamais remplacé ;
     - une pause de l'utilisateur ne déclenche aucun rechargement — ni quand le script le
       dit, ni, pour un script plus ancien, quand un clic vient d'être vu dans le cadre ;
     - les minuteurs ne vivent pas sur la tuile : `saveMultivisionState` la sérialise. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
    const dom = new JSDOM('<!doctype html><html><body>'
        + '<div id="epg"></div><div id="toast"><span id="toasttxt"></span></div>'
        + '</body></html>', { url: 'https://x.test/' });
    const w = dom.window;
    w.__NO_AUTOSTART__ = true;
    for (const k of ['window', 'document', 'DOMParser', 'localStorage', 'navigator', 'HTMLElement', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'location', 'history', 'getComputedStyle', 'Node'])
        Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
    globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

    await import('../js/scrapers.js');
    const mv = await import('../js/multiview.js');
    const pont = await import('../js/embed-bridge.js');
    const P = await import('../js/playability.js');
    const { S } = await import('../js/state.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    // ── 1. La décision, seule ─────────────────────────────────────────────────
    assert.strictEqual(P.ESSAIS_PAR_SOURCE, 2, 'un chargement, puis un rechargement');
    assert.strictEqual(P.actionSansVideo(1, true), 'recharger', 'premier silence : on recharge la même source');
    assert.strictEqual(P.actionSansVideo(2, true), 'suivante', 'deuxième silence : la source a eu sa chance');
    assert.strictEqual(P.actionSansVideo(2, false), 'rien', 'plus de source où aller : on n\'insiste pas');
    assert.strictEqual(P.actionSansVideo(1, false), 'recharger', 'seule sur son match, la tuile a droit à son rechargement');
    assert.strictEqual(P.actionSansVideo(0, true), 'recharger');
    assert.strictEqual(P.actionSansVideo(3, true), 'suivante', 'un compteur au-delà du budget ne boucle pas');
    ok('recharger d\'abord, changer de source ensuite');

    // ── 1 bis. Une source qui a déjà joué n'est jamais quittée seule ─────────
    /* « Le switch se fait vite quand un stream lag ou buff, mais c'est normal que ça
       arrive des fois » (30 septembre 2026). */
    assert.strictEqual(P.actionSansVideo(1, true, 1, true), 'recharger',
        'même en parcours (un seul essai), la source qui a joué retrouve son rechargement');
    assert.strictEqual(P.actionSansVideo(2, true, 2, true), 'rien',
        'et après ses essais elle RESTE : pas de bascule vers un inconnu');
    assert.strictEqual(P.actionSansVideo(5, true, 1, true), 'rien', 'quel que soit le compteur');
    ok('une source qui a joué est rechargée, jamais remplacée automatiquement');

    // ── 2. Un arrêt volontaire n'est pas une panne ────────────────────────────
    assert.strictEqual(P.arretMeriteRechargement({ cause: 'pause' }), false,
        'une vidéo prête et mise en pause : recharger par-dessus serait une nuisance');
    assert.strictEqual(P.arretMeriteRechargement({ cause: 'attente' }), true, 'ré-tampon ou segment perdu');
    assert.strictEqual(P.arretMeriteRechargement({ cause: 'absente' }), true, 'le lecteur a disparu de la page');
    assert.strictEqual(P.arretMeriteRechargement({ cause: 'attente', gesteIlYaMs: 100 }), true,
        'la cause donnée par le script prime sur le dernier clic : elle sait, on devine');
    /* Script plus ancien : aucune cause. Le dernier clic vu dans le cadre départage,
       parce que mettre en pause demande un geste et que ré-tamponner n'en demande aucun. */
    assert.strictEqual(P.arretMeriteRechargement({ gesteIlYaMs: 2000 }), false, 'un clic à l\'instant : c\'est une pause');
    assert.strictEqual(P.arretMeriteRechargement({ gesteIlYaMs: 60000 }), true, 'un clic d\'il y a une minute n\'explique plus rien');
    assert.strictEqual(P.arretMeriteRechargement({}), true, 'aucun geste connu : on recharge');
    assert.strictEqual(P.arretMeriteRechargement(), true, 'et rien du tout ne lève pas d\'exception');
    assert.strictEqual(P.arretMeriteRechargement({ gesteIlYaMs: 2000, fenetreGeste: 500 }), true, 'la fenêtre est réglable');
    ok('une pause de l\'utilisateur ne déclenche aucun rechargement');

    // ── Le décor ──────────────────────────────────────────────────────────────
    mv.setupMultivisionUI();
    document.getElementById('mv-container').style.display = 'flex';

    const A = 'https://a.test/un';
    const B = 'https://b.test/deux';
    const DEUX_SOURCES = [{ id: 'm1', homeTeam: 'A', awayTeam: 'B', streamLinks: [{ url: A }, { url: B }] }];

    /* Minuteurs sous contrôle : la patience est de 30 s et le test ne peut pas attendre.
       Posés après l'import, pour n'attraper que le code éprouvé ici ; `vraiSet` reste
       sous la main pour laisser tourner les vraies microtâches. */
    const vraiSet = globalThis.setTimeout, vraiClear = globalThis.clearTimeout;
    const enAttente = new Map();
    let idMinuteur = 0;
    globalThis.setTimeout = (fn, d) => { enAttente.set(++idMinuteur, { fn, d: d | 0 }); return idMinuteur; };
    globalThis.clearTimeout = (id) => { enAttente.delete(id); };
    const armes = (delai) => [...enAttente.values()].filter((t) => t.d === delai).length;
    const declencher = (delai) => {
        const cible = [...enAttente.entries()].filter(([, t]) => t.d === delai);
        cible.forEach(([id, t]) => { enAttente.delete(id); t.fn(); });
        return cible.length;
    };
    const attendre = () => new Promise((r) => vraiSet(r, 0));
    /* Une tuile neuve à chaque groupe, et aucun minuteur hérité du groupe d'avant :
       ceux-là ne feraient plus rien (leur tuile n'est plus dans `mvFlux`) mais
       fausseraient les comptes. */
    const poser = async (matches, url, mid) => {
        enAttente.clear();
        S.matches = matches;
        mv.mvFlux.length = 0;
        mv.mvFlux.push({ url: url, name: 'M1', mid: mid, _autoTried: 0 });
        mv.updateMultivisionLayout();
        await attendre();
        return mv.mvFlux[0];
    };

    // ── 2 bis. Le rechargement est un secours, pas un péage ──────────────────
    /* « Les vidéos se chargent pas bien dans le multiview aujourd'hui » (20 septembre
       2026). Le rechargement de la veille était payé sur CHAQUE source : 60 s au lieu de
       30 par source morte, 180 au lieu de 90 pour un hôte réputé lent, et parcourir
       quatorze sources mortes passait de 7 à 14 minutes. Mesuré le jour même, les liens
       n'étaient pas en cause (40 % de lecture la veille, 42 % ce jour-là). */
    assert.strictEqual(P.essaisPourSource({ url: 'https://inconnu.test/a' }, {}, false), 2,
        'un hôte inconnu garde son second essai : c\'est le cas que le rechargement rattrape');
    assert.strictEqual(P.essaisPourSource({ url: 'https://bon.test/a', verified: 'plays' }, {}, false), 2,
        'un hôte qui joue d\'ordinaire aussi');
    assert.strictEqual(P.essaisPourSource({ url: 'https://x.test/a' }, {}, true), 1,
        'mais la tuile qui PARCOURT déjà la liste n\'en a qu\'un : on ne rattrape plus, on cherche');
    assert.strictEqual(P.essaisPourSource({ url: 'https://x.test/a', verified: 'blocked' }, {}, false), 1,
        'un cadre refusé ne jouera pas mieux au second essai');
    assert.strictEqual(P.essaisPourSource({ url: 'https://mort.test/a' }, { 'mort.test': { tested: 8, plays: 0 } }, false), 1,
        'ni un hôte éprouvé qui ne joue jamais');
    ok('le second essai va à la source qu\'on rattrape, pas à celles qu\'on traverse');

    // ── 2 ter. Les reprises sont bornées ────────────────────────────────────
    /* Défaut introduit le 19 septembre et corrigé ici : la lecture remet le compteur
       d'essais à zéro, donc un flux qui joue deux secondes, meurt et rejoue deux secondes
       se faisait recharger sans fin. */
    assert.deepStrictEqual(P.budgetReprise(0, 3000), { autorisee: true, reprises: 1 }, 'première reprise : oui');
    assert.deepStrictEqual(P.budgetReprise(1, 3000), { autorisee: true, reprises: 2 }, 'deuxième : encore');
    assert.deepStrictEqual(P.budgetReprise(2, 3000), { autorisee: false, reprises: 3 },
        'troisième sur un flux qui ne tient jamais : non, la source est cassée');
    assert.deepStrictEqual(P.budgetReprise(5, 300000), { autorisee: true, reprises: 1 },
        'mais un flux qui a TENU cinq minutes avant de lâcher retrouve son budget : c\'est un match qu\'on regardait');
    assert.strictEqual(P.budgetReprise(0, null).autorisee, true, 'aucune durée connue : on ne pénalise pas');
    ok('une source qui ne tient jamais n\'est pas rechargée en boucle');

    // ── 3. Sans le script utilisateur, la tuile ne décide rien seule ─────────
    assert.strictEqual(pont.getBridgeStatus().available, false, 'le pont n\'est pas encore annoncé');
    await poser(DEUX_SOURCES, A, 'm1');
    assert.strictEqual(armes(30000), 0, 'aucune patience armée : sans signal de lecture, rien à conclure');
    assert.strictEqual(mv.mvFlux[0].url, A, 'la tuile reste sur sa source, le bouton ⏭ reste à portée');
    assert.strictEqual(mv.armerRepriseTuile(mv.mvFlux[0], { cause: 'attente' }), false,
        'et un arrêt rapporté sans pont ne peut pas venir : aucune reprise armée');
    ok('sans le script utilisateur, ni rechargement ni changement de source');

    // ── Le pont s'annonce ────────────────────────────────────────────────────
    globalThis.setTimeout = vraiSet;
    globalThis.clearTimeout = vraiClear;
    pont.initEmbedBridge();
    w.postMessage({ __mvBridge: 'mv_bridge_ready', version: '1.9' }, '*');
    await new Promise((r) => vraiSet(r, 10));
    assert.strictEqual(pont.getBridgeStatus().available, true, 'le script utilisateur est là');
    globalThis.setTimeout = (fn, d) => { enAttente.set(++idMinuteur, { fn, d: d | 0 }); return idMinuteur; };
    globalThis.clearTimeout = (id) => { enAttente.delete(id); };

    // ── 4. Rien ne joue : la tuile recharge avant de changer de source ───────
    const tuile = await poser(DEUX_SOURCES, A, 'm1');
    assert.strictEqual(tuile._essais, 1, 'le chargement compte pour un essai');

    assert.strictEqual(declencher(30000), 1, 'la patience est armée');
    await attendre();
    assert.strictEqual(mv.mvFlux[0].url, A, 'PREMIER silence : la source ne change pas');
    assert.strictEqual(mv.mvFlux[0]._essais, 2, 'elle est rechargée, et ce rechargement est compté');
    assert.strictEqual(mv.mvFlux[0]._autoTried | 0, 0, 'aucune bascule automatique n\'a été consommée');

    assert.strictEqual(declencher(30000), 1, 'la patience est réarmée sur le rechargement');
    await attendre();
    assert.strictEqual(mv.mvFlux[0].url, B, 'DEUXIÈME silence : la source a eu ses deux essais, on passe à la suivante');
    assert.strictEqual(mv.mvFlux[0]._autoTried, 1);
    assert.strictEqual(mv.mvFlux[0]._essais, 1, 'et la suivante repart avec ses essais entiers');
    ok('deux silences pour quitter une source, un seul pour la recharger');

    // ── 4 bis. En parcours, une seule patience par source ───────────────────
    /* Le correctif du 20 septembre. La source sur laquelle on ATTERRIT garde ses deux
       essais — c'est elle que le rechargement rattrape. Dès qu'on parcourt, chaque source
       n'en a plus qu'un : on ne rattrape plus, on cherche, et chaque seconde de plus est
       une seconde d'écran noir. Sans cette règle, quatorze sources mortes coûtaient
       quatorze minutes au lieu de sept. */
    const C = 'https://c.test/trois';
    const TROIS = [{ id: 'm3', homeTeam: 'A', awayTeam: 'B', streamLinks: [{ url: A }, { url: B }, { url: C }] }];
    await poser(TROIS, A, 'm3');
    const vues = [mv.mvFlux[0].url];

    declencher(30000); await attendre();
    assert.strictEqual(mv.mvFlux[0].url, vues[0], 'la source d\'atterrissage est rechargée, pas quittée');
    assert.strictEqual(mv.mvFlux[0]._essais, 2, 'elle a bien ses deux essais');

    declencher(30000); await attendre();
    assert.strictEqual(mv.mvFlux[0]._autoTried, 1, 'second silence : on passe à la suivante');
    vues.push(mv.mvFlux[0].url);
    assert.notStrictEqual(vues[1], vues[0]);
    assert.strictEqual(mv.mvFlux[0]._essais, 1, 'la suivante est chargée une fois');

    /* Le cœur du correctif : UN seul déclenchement suffit maintenant à quitter la
       deuxième source. Avant, il en fallait deux (rechargement puis bascule). */
    declencher(30000); await attendre();
    assert.strictEqual(mv.mvFlux[0]._autoTried, 2,
        'une seule patience a suffi pour quitter la deuxième source : plus de rechargement en parcours');
    vues.push(mv.mvFlux[0].url);
    assert.notStrictEqual(vues[2], vues[1], 'et la tuile est bien passée à la troisième');
    ok('en parcours, une seule patience par source : le rechargement ne se paie qu\'à l\'atterrissage');

    // ── 4 ter. Le second essai ne rachète pas la longue patience ────────────
    /* Un hôte réputé lent a droit à 90 s pour DÉMARRER (embed.st, 6 septembre). Son
       rechargement, lui, repart sur la patience courte : sinon une seule source coûtait
       180 s. */
    localStorage.setItem('play_ledger', JSON.stringify({ 'lent.test': { tested: 10, plays: 9 } }));
    const LENT = 'https://lent.test/a';
    await poser([{ id: 'm4', homeTeam: 'L', awayTeam: 'M', streamLinks: [{ url: LENT }, { url: B }] }], LENT, 'm4');
    assert.strictEqual(armes(90000), 1, 'premier essai : la longue patience, comme avant');
    declencher(90000); await attendre();
    assert.strictEqual(mv.mvFlux[0].url, LENT, 'rechargée, pas quittée');
    assert.strictEqual(armes(30000), 1, 'mais le rechargement repart sur la patience courte');
    assert.strictEqual(armes(90000), 0, 'la longue n\'est pas redonnée une seconde fois');
    localStorage.removeItem('play_ledger');
    ok('la longue patience se donne une fois, pas deux');

    // ── 5. Une tuile seule sur son match est rechargée aussi ─────────────────
    await poser([{ id: 'seul', homeTeam: 'C', awayTeam: 'D', streamLinks: [{ url: A }] }], A, 'seul');
    assert.strictEqual(declencher(30000), 1, 'une source unique arme sa patience elle aussi');
    await attendre();
    assert.strictEqual(mv.mvFlux[0]._essais, 2,
        'elle est rechargée : n\'avoir nulle part où aller n\'est pas une raison de ne rien tenter');
    declencher(30000);
    await attendre();
    assert.strictEqual(mv.mvFlux[0].url, A, 'et au second silence elle reste là : il n\'y a pas de suivante');
    ok('une source unique est rechargée, jamais abandonnée dans le vide');

    // ── 6. Un flux qui S'ARRÊTE est rechargé, jamais remplacé ────────────────
    /* La séquence réelle, celle du gestionnaire `video_state` : la vidéo a joué (la
       source a donc retrouvé ses essais entiers), puis elle s'arrête. */
    const t2 = await poser(DEUX_SOURCES, A, 'm1');
    t2._essais = 0;
    t2._playing = false;

    assert.strictEqual(mv.armerRepriseTuile(t2, { cause: 'attente' }), true, 'un arrêt inexpliqué arme une reprise');
    assert.strictEqual(declencher(25000), 1, 'la reprise laisse d\'abord à la vidéo le temps de revenir');
    await attendre();
    assert.strictEqual(mv.mvFlux[0].url, A,
        'la source qui vient de jouer est RECHARGÉE, pas remplacée : l\'abandonner pour un inconnu est le reproche même');
    assert.strictEqual(mv.mvFlux[0]._essais, 1, 'et elle a bien été rechargée — un essai de plus sur la même adresse');
    assert.strictEqual(mv.mvFlux[0]._autoTried | 0, 0, 'aucune bascule automatique n\'a été consommée');
    ok('un flux interrompu est rechargé sur la même source');

    // ── 6 bis. Le rechargement d'une reprise ne mène pas à une autre source ──
    /* Le chemin réel du reproche : la tuile avait déjà basculé une fois (en parcours,
       un seul essai par source), la source joue, puis ré-tamponne. La reprise la
       recharge ; avant ce correctif, si la page tardait à redémarrer, la patience de
       démarrage la jugeait morte au premier silence et passait à la suivante. */
    /* Trois sources : avec deux et une bascule déjà faite, il ne resterait nulle part
       où aller et le test passerait même sans le correctif (vérifié par sabotage). */
    const TROIS_SOURCES = [{ id: 'm1', homeTeam: 'A', awayTeam: 'B', streamLinks: [{ url: A }, { url: B }, { url: 'https://c.test/trois' }] }];
    const t2b = await poser(TROIS_SOURCES, A, 'm1');
    t2b._autoTried = 1;
    t2b._essais = 0;
    t2b._aJoueUrl = A;
    t2b._playing = false;
    assert.strictEqual(mv.armerRepriseTuile(t2b, { cause: 'attente' }), true);
    assert.strictEqual(armes(12000), 0, 'la reprise n\'intervient plus après 12 s : un ré-tampon dure souvent plus');
    assert.strictEqual(declencher(25000), 1, 'elle laisse 25 s à la vidéo pour revenir seule');
    await attendre();
    assert.strictEqual(mv.mvFlux[0].url, A, 'rechargée sur place');
    assert.strictEqual(armes(45000), 1, 'le redémarrage a une patience de redémarrage, pas celle d\'un second essai');
    declencher(45000); await attendre();
    assert.strictEqual(mv.mvFlux[0].url, A, 'toujours la même source après le premier silence');
    declencher(45000); await attendre();
    assert.strictEqual(mv.mvFlux[0].url, A, 'et après le second : la tuile attend, ⏭ reste à portée');
    assert.strictEqual(mv.mvFlux[0]._autoTried, 1, 'aucune bascule automatique consommée');
    ok('un flux qui a joué puis hoqueté n\'est jamais remplacé tout seul');

    // ── 7. La vidéo qui revient seule annule le rechargement ────────────────
    const t3 = await poser(DEUX_SOURCES, A, 'm1');
    t3._playing = false;
    assert.strictEqual(mv.armerRepriseTuile(t3, { cause: 'attente' }), true);
    t3._playing = true; // le ré-tampon s'est résorbé avant l'échéance
    declencher(25000);
    await attendre();
    assert.strictEqual(mv.mvFlux[0]._essais, 1,
        'la tuile n\'a PAS été rechargée (un rechargement compterait un second essai) : un ré-tampon ne coûte rien');
    ok('une vidéo revenue d\'elle-même ne paie pas un rechargement');

    // ── 8. Ce que la reprise refuse ──────────────────────────────────────────
    assert.strictEqual(mv.armerRepriseTuile(t3, { cause: 'pause' }), false, 'l\'utilisateur a mis en pause : on ne touche à rien');
    t3._dernierGeste = Date.now();
    assert.strictEqual(mv.armerRepriseTuile(t3, {}), false, 'script plus ancien, clic à l\'instant : on suppose la même chose');
    t3._dernierGeste = Date.now() - 120000;
    assert.strictEqual(mv.armerRepriseTuile(t3, {}), true, 'mais un clic d\'il y a deux minutes n\'explique plus l\'arrêt');
    ok('la reprise laisse l\'utilisateur tranquille quand c\'est lui qui a arrêté');

    // ── 8 bis. Une source qui ne tient jamais cesse d'être rallumée ─────────
    /* La borne, dans la vraie tuile : sans elle, la lecture remet le compteur d'essais à
       zéro et un flux qui joue deux secondes, meurt et rejoue deux secondes se fait
       recharger sans fin. Défaut introduit le 19 septembre, corrigé le 20. */
    const t4 = await poser(DEUX_SOURCES, A, 'm1');
    t4._joueDepuis = Date.now() - 3000;   // n'a tenu que trois secondes
    t4._playing = false;
    assert.strictEqual(mv.armerRepriseTuile(t4, { cause: 'attente' }), true, 'première reprise : on tente');
    assert.strictEqual(mv.armerRepriseTuile(t4, { cause: 'attente' }), true, 'deuxième : encore');
    assert.strictEqual(mv.armerRepriseTuile(t4, { cause: 'attente' }), false,
        'troisième : la source ne tient pas trois secondes, la rallumer ne fait que rallumer la panne');
    t4._joueDepuis = Date.now() - 300000; // cette fois elle avait tenu cinq minutes
    assert.strictEqual(mv.armerRepriseTuile(t4, { cause: 'attente' }), true,
        'un flux qu\'on regardait depuis cinq minutes retrouve son budget : ce n\'est pas la même panne');
    ok('une source qui ne tient jamais cesse d\'être rechargée, celle qui a tenu y a droit');

    // ── 9. Les minuteurs ne vivent pas sur la tuile ──────────────────────────
    /* `saveMultivisionState` sérialise `mvFlux` en JSON. Un handle de minuteur n'est un
       nombre que dans un navigateur : ailleurs c'est un objet circulaire, et
       l'enregistrement mourrait dessus. Le test tourne dans Node, donc il le verrait. */
    globalThis.setTimeout = vraiSet;
    globalThis.clearTimeout = vraiClear;
    mv.mvFlux.forEach((s) => {
        Object.keys(s).forEach((k) => {
            assert.ok(!/timer|minuteur/i.test(k), 'aucun minuteur posé sur la tuile : ' + k);
        });
    });
    assert.doesNotThrow(() => JSON.stringify(mv.mvFlux), 'l\'état de la tuile reste sérialisable');
    assert.doesNotThrow(() => mv.saveMultivisionState(), 'et l\'enregistrement passe');
    ok('les minuteurs sont rangés hors de la tuile, l\'état reste sérialisable');

    // ── 10. Une session reprise repart avec ses essais entiers ──────────────
    /* Les compteurs sont sérialisés avec la tuile. Une tuile restaurée avec ses deux
       essais déjà dépensés serait quittée au premier silence, sans le rechargement
       qu'on vient de lui accorder : un onglet rouvert est un premier chargement. */
    mv.mvFlux.length = 0;
    localStorage.setItem('mv_state', JSON.stringify({
        flux: [{ url: A, name: 'M1', mid: 'm1', _autoTried: 1, _essais: 2, _essaisUrl: A, _dernierGeste: Date.now(), _aJoueUrl: A }],
        layout: null
    }));
    mv.restoreMultivisionState();
    assert.strictEqual(mv.mvFlux[0]._essais, undefined, 'le compte des essais ne survit pas à la session');
    assert.strictEqual(mv.mvFlux[0]._essaisUrl, undefined);
    assert.strictEqual(mv.mvFlux[0]._dernierGeste, undefined, 'ni le dernier clic, qui ne veut plus rien dire');
    assert.strictEqual(mv.mvFlux[0]._aJoueUrl, undefined, 'ni la preuve de lecture : un onglet rouvert doit la refaire');
    assert.strictEqual(mv.mvFlux[0].url, A, 'la tuile, elle, est bien revenue');
    ok('un onglet rouvert est un premier chargement, pas la suite du précédent');

    // ── 11. Le câblage : l'arrêt d'une vidéo passe par la reprise ───────────
    /* Les groupes 6 à 8 appellent `armerRepriseTuile` directement, parce qu'un
       `video_state` venu d'un vrai cadre ne se simule pas ici (`indexDeTuilePour` compare
       des fenêtres). Reste à verrouiller le SEUL chemin par lequel un arrêt est vu — sans
       lui, la tuile revient à ce qu'elle faisait avant : rien du tout. */
    const fs = require('fs');
    const src = fs.readFileSync(require('path').join(__dirname, '..', 'js', 'multiview.js'), 'utf8');
    assert.ok(/else if \(!joue && s\._playing\) \{\s*\n\s*s\._playing = false;\s*\n\s*armerRepriseTuile\(s, e\.data\);/.test(src),
        'une vidéo qui s\'arrête arme la reprise, et la cause du script lui est transmise');
    assert.ok(/joue && !s\._playing[\s\S]{0,400}couperMinuteur\(s, 'reprise'\)/.test(src),
        'une vidéo qui revient coupe le rechargement armé');
    const corps = src.slice(src.indexOf('export function armerRepriseTuile'));
    assert.ok(corps.indexOf('nextFluxForTile') > corps.indexOf('\n}\n'),
        'la reprise RECHARGE et ne change jamais de source : c\'est tout le reproche');
    ok('un arrêt de lecture mène à la reprise, et la reprise ne change pas de source');

    console.log(`unit_reprise: ${n} groupes de tests OK`);
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

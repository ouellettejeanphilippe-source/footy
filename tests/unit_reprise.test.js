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
    assert.strictEqual(declencher(12000), 1, 'la reprise laisse d\'abord à la vidéo le temps de revenir');
    await attendre();
    assert.strictEqual(mv.mvFlux[0].url, A,
        'la source qui vient de jouer est RECHARGÉE, pas remplacée : l\'abandonner pour un inconnu est le reproche même');
    assert.strictEqual(mv.mvFlux[0]._essais, 1, 'et elle a bien été rechargée — un essai de plus sur la même adresse');
    assert.strictEqual(mv.mvFlux[0]._autoTried | 0, 0, 'aucune bascule automatique n\'a été consommée');
    ok('un flux interrompu est rechargé sur la même source');

    // ── 7. La vidéo qui revient seule annule le rechargement ────────────────
    const t3 = await poser(DEUX_SOURCES, A, 'm1');
    t3._playing = false;
    assert.strictEqual(mv.armerRepriseTuile(t3, { cause: 'attente' }), true);
    t3._playing = true; // le ré-tampon s'est résorbé avant l'échéance
    declencher(12000);
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
        flux: [{ url: A, name: 'M1', mid: 'm1', _autoTried: 1, _essais: 2, _essaisUrl: A, _dernierGeste: Date.now() }],
        layout: null
    }));
    mv.restoreMultivisionState();
    assert.strictEqual(mv.mvFlux[0]._essais, undefined, 'le compte des essais ne survit pas à la session');
    assert.strictEqual(mv.mvFlux[0]._essaisUrl, undefined);
    assert.strictEqual(mv.mvFlux[0]._dernierGeste, undefined, 'ni le dernier clic, qui ne veut plus rien dire');
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

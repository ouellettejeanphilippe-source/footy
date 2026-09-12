/* Mode câble : zapper le lecteur comme on zappait la télévision (js/cable.js,
   js/multiview.js).

   « Mode bonus style câble : le swipe vertical change le match qui joue, le swipe
   horizontal change le stream. » Deux axes, deux actions, et trois choses à vérifier :

   1. la LECTURE du geste — un tremblement n'est pas un geste, une diagonale non plus
      (sinon on change de match quand on voulait changer de source, ce qui coûte le match
      qu'on regardait) ;
   2. la liste des CHAÎNES — un match sans lien n'en est pas une, un match fini non plus,
      et l'ordre doit être le même d'un geste à l'autre, sans quoi « la chaîne d'à côté »
      ne veut rien dire ;
   3. le CÂBLAGE dans le lecteur — le calque qui écoute (une iframe d'une autre origine
      ne nous laisse pas voir le doigt), le remplacement du contenu de la tuile, et
      l'échappatoire qui rend la page du site cliquable. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    // ══ A. Le module pur ═══════════════════════════════════════════════════════
    const C = await import('../js/cable.js');

    // ── 1. Lecture du geste ───────────────────────────────────────────────────
    assert.strictEqual(C.detecterGeste(0, -80, 200), 'haut');
    assert.strictEqual(C.detecterGeste(0, 80, 200), 'bas');
    assert.strictEqual(C.detecterGeste(-80, 0, 200), 'gauche');
    assert.strictEqual(C.detecterGeste(80, 0, 200), 'droite');
    assert.strictEqual(C.detecterGeste(0, -20, 200), null, 'sous le seuil : un appui qui a bougé');
    assert.strictEqual(C.detecterGeste(70, -68, 200), null, 'une diagonale est refusée, pas devinée');
    assert.strictEqual(C.detecterGeste(0, -80, 4000), null, 'un doigt qui traîne quatre secondes ne zappe pas');
    assert.strictEqual(C.detecterGeste(0, -80, undefined), 'haut', 'sans durée mesurée, la distance suffit');
    assert.strictEqual(C.detecterGeste(NaN, 0, 10), null);
    assert.strictEqual(C.detecterGeste(0, -30, 200, { seuil: 20 }), 'haut', 'le seuil est réglable');
    ok('un geste est reconnu par sa distance, son axe dominant et sa durée');

    // ── 2. Ce que chaque geste demande ────────────────────────────────────────
    assert.deepStrictEqual(C.actionDuGeste('haut'), { axe: 'chaine', sens: 1 });
    assert.deepStrictEqual(C.actionDuGeste('bas'), { axe: 'chaine', sens: -1 });
    assert.deepStrictEqual(C.actionDuGeste('gauche'), { axe: 'source', sens: 1 });
    assert.deepStrictEqual(C.actionDuGeste('droite'), { axe: 'source', sens: -1 });
    assert.strictEqual(C.actionDuGeste(null), null);
    ok('le vertical va aux matchs, l\'horizontal aux sources');

    // ── 3. Les chaînes : regardables maintenant, et rangées toujours pareil ────
    const lien = (u) => ({ url: u, name: u });
    const M = (id, extra) => Object.assign({
        id, league: 'MLS', homeTeam: id + ' A', awayTeam: id + ' B',
        matchDate: '2026-09-12', startTime: '19:00', status: 'live',
        streamLinks: [lien('https://' + id + '.test/1')]
    }, extra || {});

    const direct = { estEnDirect: (m) => m.status === 'live', bientot: (m) => m.status === 'upcoming' && m.startTime === '19:30' };
    const matchs = [
        M('c', { startTime: '20:00' }),
        M('sansLien', { streamLinks: [] }),
        M('fini', { status: 'finished' }),
        M('presume', { _finPresumee: true }),
        M('b', { startTime: '19:00' }),
        M('tard', { status: 'upcoming', startTime: '23:00' }),
        M('bientot', { status: 'upcoming', startTime: '19:30' }),
        M('a', { startTime: '19:00', league: 'Ligue 1' })
    ];
    const chaines = C.chainesDisponibles(matchs, direct);
    assert.deepStrictEqual(chaines.map((m) => m.id), ['a', 'b', 'c', 'bientot'],
        'les matchs en cours d\'abord, par heure puis par ligue ; celui qui commence bientôt à la fin');
    assert.ok(!chaines.some((m) => m.id === 'sansLien'), 'un match sans lien ne zappe sur rien : pas une chaîne');
    assert.ok(!chaines.some((m) => m.id === 'fini' || m.id === 'presume'), 'un match fini, ou présumé fini, sort de la liste');
    assert.ok(!chaines.some((m) => m.id === 'tard'), 'un match du soir n\'est pas encore une chaîne');
    assert.deepStrictEqual(C.chainesDisponibles(matchs, direct).map((m) => m.id), chaines.map((m) => m.id),
        'deux passages rendent le même ordre — sinon « la chaîne d\'à côté » change de sens');
    assert.deepStrictEqual(C.chainesDisponibles(null, direct), []);
    ok('une chaîne est un match regardable maintenant, et l\'ordre est stable');

    // ── 4. La chaîne voisine, en boucle ───────────────────────────────────────
    assert.strictEqual(C.chaineVoisine(chaines, 'a', 1).id, 'b');
    assert.strictEqual(C.chaineVoisine(chaines, 'a', -1).id, 'bientot', 'en boucle par le bas');
    assert.strictEqual(C.chaineVoisine(chaines, 'bientot', 1).id, 'a', 'en boucle par le haut');
    assert.strictEqual(C.chaineVoisine(chaines, 'fini', 1).id, 'a', 'un match qui vient de finir n\'immobilise pas le zapping');
    assert.strictEqual(C.chaineVoisine(chaines, 'fini', -1).id, 'bientot');
    assert.strictEqual(C.chaineVoisine([chaines[0]], 'a', 1), null, 'une seule chaîne : nulle part où aller');
    assert.strictEqual(C.chaineVoisine([], 'a', 1), null);
    assert.strictEqual(C.indexDeChaine(chaines, 'b'), 1);
    assert.strictEqual(C.indexDeChaine(chaines, 'inconnu'), -1);
    ok('la chaîne voisine tourne en boucle et supporte un match sorti de la liste');

    // ── 5. Le lien voisin, dans les deux sens ─────────────────────────────────
    const liens = [lien('u1'), lien('u2'), lien('u3')];
    assert.strictEqual(C.lienVoisin(liens, 'u1', 1).url, 'u2');
    assert.strictEqual(C.lienVoisin(liens, 'u1', -1).url, 'u3', 'revenir en arrière depuis le premier boucle');
    assert.strictEqual(C.lienVoisin(liens, 'u3', 1).url, 'u1');
    assert.strictEqual(C.lienVoisin(liens, 'inconnu', -1).url, 'u3');
    assert.strictEqual(C.lienVoisin([lien('u1')], 'u1', 1), null, 'un seul lien : rien à faire');
    assert.strictEqual(C.lienVoisin(null, 'u1', 1), null);
    ok('le geste horizontal avance ET recule dans les sources');

    // ── 6. L'incrustation du décodeur ─────────────────────────────────────────
    const e = C.etiquetteChaine(
        { homeTeam: 'Arsenal', awayTeam: 'Chelsea', league: 'Premier League', status: 'live', score: [2, 1], minute: "67'" },
        3, 12, { k: 2, n: 5 });
    assert.strictEqual(e.numero, 'CH 3/12');
    assert.strictEqual(e.titre, 'Arsenal – Chelsea');
    assert.strictEqual(e.details, "Premier League · 2 - 1 · 67' · source 2/5");
    const f = C.etiquetteChaine({ homeTeam: 'A', awayTeam: 'B', league: 'MLS', startTime: '19:00' }, 1, 2, { k: 1, n: 1 });
    assert.strictEqual(f.details, 'MLS · 19:00', 'une source unique ne s\'annonce pas');
    ok('l\'incrustation dit la chaîne, le match et la source');

    // ── 7. Aucun blocage : ce qui ne peut pas jouer sort de la liste ──────────
    /* « Un seul vidéo, avec aucun blocage » (12 septembre 2026). La chaîne d'à côté ne
       peut pas être un écran de refus du navigateur : on écarte ce dont l'application
       SAIT qu'il ne jouera pas ici, et on remonte devant ce qu'elle joue elle-même. */
    const optsJeu = {
        estBloque: (u) => /refuse\.test/.test(u),
        aFaitSortir: (u) => u === 'https://sortie.test/x',
        estMedia: (u) => /\.m3u8(\?|$)/.test(u),
        score: (l) => (l.verified === 'none' ? -1 : 1)
    };
    const bruts = [
        lien('https://refuse.test/1'),
        { url: 'https://verifie.test/2', verified: 'blocked' },
        lien('https://sortie.test/x'),
        { url: 'https://mort.test/3', verified: 'none' },
        lien('https://bon.test/4'),
        lien('https://cdn.test/live.m3u8')
    ];
    assert.deepStrictEqual(C.liensCable(bruts, optsJeu).map((l) => l.url),
        ['https://cdn.test/live.m3u8', 'https://bon.test/4'],
        'l\'hôte qui refuse le cadre, le lien observé bloqué, l\'adresse qui a fait sortir la page et l\'hôte mort sortent ; le flux que l\'application joue elle-même passe devant');
    assert.strictEqual(C.lienJouable(lien('https://bon.test/4'), optsJeu), true);
    assert.strictEqual(C.lienJouable({ url: '' }, optsJeu), false);
    assert.strictEqual(C.liensCable(bruts, {}).length, bruts.length - 1,
        'sans prédicats, seul un lien déjà observé bloqué est écarté : le mode dégrade, il ne vide pas');
    const lienOkJeu = (l) => C.lienJouable(l, optsJeu);
    assert.strictEqual(C.estChaine(M('bloque', { streamLinks: [lien('https://refuse.test/1')] }), Object.assign({ lienOk: lienOkJeu }, direct)), false,
        'un match dont le seul lien est bloqué n\'est pas une chaîne : le zapping ne s\'arrête pas dessus');
    assert.strictEqual(C.estChaine(M('bon', { streamLinks: [lien('https://refuse.test/1'), lien('https://bon.test/4')] }), Object.assign({ lienOk: lienOkJeu }, direct)), true,
        'mais il l\'est dès qu\'un seul lien peut jouer');
    ok('les liens et les chaînes qui ne peuvent pas jouer sortent du zapping');

    // ══ B. Le câblage dans le lecteur ══════════════════════════════════════════
    const dom = new JSDOM('<!doctype html><html><body>' +
        '<div id="epg"></div>' +
        '<div id="toast"><span id="toasttxt"></span></div>' +
        '</body></html>', { url: 'https://x.test/' });
    const w = dom.window;
    w.__NO_AUTOSTART__ = true;
    for (const k of ['window', 'document', 'DOMParser', 'localStorage', 'navigator', 'HTMLElement', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'location', 'history', 'getComputedStyle', 'Node'])
        Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
    globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

    await import('../js/scrapers.js');
    const mv = await import('../js/multiview.js');
    const state = await import('../js/state.js');

    /* Le lecteur est bâti par son propre code — et non posé en dur dans le document du
       test — parce que c'est lui qui pose l'écoute du clavier (groupe 12). */
    mv.setupMultivisionUI();
    document.getElementById('mv-container').style.display = 'flex';
    assert.ok(document.getElementById('mv-grid'), 'le lecteur a bâti sa grille');

    /* Deux chaînes en direct. La première a trois sources, pour l'axe horizontal.

       L'heure est celle de New York, fuseau de toute l'application, et le coup d'envoi
       est posé cinq minutes en arrière : `isLiveNow` refuse un match commencé depuis plus
       de quatre heures, quoi qu'en dise son statut. */
    const parties = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date(Date.now() - 5 * 60 * 1000)).reduce((a, p) => (a[p.type] = p.value, a), {});
    const AUJ = `${parties.year}-${parties.month}-${parties.day}`;
    const HEURE = `${parties.hour === '24' ? '00' : parties.hour}:${parties.minute}`;
    const enDirect = (id, links) => ({
        id, league: 'MLS', homeTeam: id.toUpperCase() + ' Home', awayTeam: id.toUpperCase() + ' Away',
        matchDate: AUJ, startTime: HEURE, status: 'live', durationMinutes: 120,
        streamLinks: links.map((u) => ({ url: u, name: u, quality: 'HD' }))
    });
    state.setMatches([
        enDirect('m1', ['https://s1.test/a', 'https://s2.test/b', 'https://s3.test/c']),
        enDirect('m2', ['https://s4.test/d'])
    ]);

    mv.mvFlux.length = 0;
    mv.mvFlux.push({ url: 'https://s1.test/a', name: 'M1', mid: 'm1', _autoTried: 0 });
    mv.setModeCable(true);

    // ── 7. Le calque de gestes existe, et seulement en mode câble ─────────────
    const cell = () => document.querySelector('.mv-cell[data-index="0"]');
    const surface = () => cell() && cell().querySelector('.mv-cable-surface');
    assert.ok(surface(), 'la tuile porte un calque : une iframe d\'une autre origine ne laisse pas voir le doigt');
    assert.strictEqual(surface().style.display, 'block', 'mode allumé : le calque écoute');
    mv.setModeCable(false);
    assert.strictEqual(surface().style.display, 'none', 'mode éteint : la page du site reprend tous les clics');
    mv.setModeCable(true);
    ok('le calque de gestes n\'est là que quand le mode câble est allumé');

    // ── 8. Vertical : un autre match, avec sa meilleure source ────────────────
    assert.strictEqual(mv.zapperChaine(0, 1), true);
    assert.strictEqual(mv.mvFlux[0].mid, 'm2', 'le doigt vers le haut passe au match suivant');
    assert.strictEqual(mv.mvFlux[0].url, 'https://s4.test/d', 'et la tuile prend la source la mieux classée du nouveau match');
    assert.ok(/M2/.test(mv.mvFlux[0].name), 'le nom de la tuile suit le match');
    assert.strictEqual(mv.zapperChaine(0, -1).valueOf(), true);
    assert.strictEqual(mv.mvFlux[0].mid, 'm1', 'le doigt vers le bas revient');
    ok('le geste vertical change le match qui joue');

    // ── 9. Horizontal : la même chaîne, une autre source ──────────────────────
    const depart = mv.mvFlux[0].url;
    assert.strictEqual(mv.changerSourceTuile(0, 1), true);
    const suivante = mv.mvFlux[0].url;
    assert.notStrictEqual(suivante, depart, 'le doigt vers la gauche passe à la source suivante');
    assert.strictEqual(mv.mvFlux[0].mid, 'm1', 'sans changer de match : c\'est tout l\'intérêt de séparer les axes');
    assert.strictEqual(mv.changerSourceTuile(0, -1), true);
    assert.strictEqual(mv.mvFlux[0].url, depart, 'et le doigt vers la droite revient sur la source d\'avant');
    ok('le geste horizontal change la source, sans changer de match');

    /* Une tuile qui change d'adresse oublie ce qui décrivait la page précédente : sans
       cela, la pastille « ● » resterait allumée sur une source qui n'a rien montré. */
    mv.mvFlux[0]._playing = true;
    mv.mvFlux[0]._sortieForcee = true;
    mv.changerSourceTuile(0, 1);
    assert.strictEqual(mv.mvFlux[0]._playing, false, 'la lecture observée ne se reporte pas sur la source suivante');
    assert.strictEqual(mv.mvFlux[0]._sortieForcee, false, 'ni la marque de sortie forcée, qui visait l\'autre adresse');
    mv.changerSourceTuile(0, -1);
    ok('changer de source oublie ce qui décrivait la page d\'avant');

    // ── 10. Le geste lu sur le calque, de bout en bout ────────────────────────
    const glisser = (dx, dy) => {
        const s = surface();
        s.dispatchEvent(new w.MouseEvent('mousedown', { clientX: 200, clientY: 200, bubbles: true, cancelable: true }));
        s.dispatchEvent(new w.MouseEvent('mouseup', { clientX: 200 + dx, clientY: 200 + dy, bubbles: true, cancelable: true }));
    };
    const avant = mv.mvFlux[0].mid;
    glisser(0, -120);
    assert.notStrictEqual(mv.mvFlux[0].mid, avant, 'un vrai glissement vers le haut zappe');
    glisser(0, 120);
    assert.strictEqual(mv.mvFlux[0].mid, avant, 'et vers le bas revient');
    const stable = mv.mvFlux[0].url;
    glisser(6, -8);
    assert.strictEqual(mv.mvFlux[0].url, stable, 'un appui qui a bougé de huit pixels ne change rien');
    ok('le calque lit le glissement et déclenche la bonne action');

    // ── 11. Aucun blocage : l'appui rend les clics à la page, sans cérémonie ──
    /* Un appui qui n'est pas un geste (le cas du site qui exige un clic pour démarrer)
       efface le calque quatre secondes, puis le rend. C'était un DOUBLE appui jusqu'ici,
       qui suspendait les gestes jusqu'à ce qu'on pense à les reprendre. */
    mv.mvFlux[0]._passeClics = 0;
    mv.majSurfacesCable();
    assert.strictEqual(surface().style.display, 'block');
    glisser(5, -6);
    assert.ok(mv.mvFlux[0]._passeClics > Date.now(), 'l\'appui ouvre une fenêtre de clics pour la page');
    assert.strictEqual(surface().style.display, 'none', 'le calque s\'efface : le clic suivant va au lecteur du site');
    assert.ok(!mv.mvFlux[0]._gestesSuspendus, 'et il ne laisse aucun état à défaire');
    mv.mvFlux[0]._passeClics = Date.now() - 1;   // la fenêtre a passé
    mv.majSurfacesCable();
    assert.strictEqual(surface().style.display, 'block', 'passé le délai, le calque revient tout seul');
    ok('un appui rend les clics à la page quatre secondes, puis le zapping reprend');

    // ── 12. La suspension longue reste, par le bouton de l'en-tête ────────────
    mv.basculerGestesTuile(0);
    assert.strictEqual(mv.mvFlux[0]._gestesSuspendus, true);
    assert.strictEqual(surface().style.display, 'none', 'gestes suspendus : la page du site redevient cliquable');
    const fige = mv.mvFlux[0].mid;
    glisser(0, -120);
    assert.strictEqual(mv.mvFlux[0].mid, fige, 'et plus rien ne zappe tant qu\'ils sont suspendus');
    mv.basculerGestesTuile(0);
    assert.strictEqual(surface().style.display, 'block', 'le bouton les reprend');
    ok('la suspension longue reste disponible, pour travailler dans la page du site');

    // ── 13. Les mêmes deux axes au clavier ────────────────────────────────────
    const touche = (key) => w.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true }));
    const avantClavier = mv.mvFlux[0].mid;
    touche('ArrowUp');
    assert.notStrictEqual(mv.mvFlux[0].mid, avantClavier, '↑ change de match');
    touche('ArrowDown');
    assert.strictEqual(mv.mvFlux[0].mid, avantClavier, '↓ revient');
    const avantSource = mv.mvFlux[0].url;
    touche('ArrowLeft');
    assert.notStrictEqual(mv.mvFlux[0].url, avantSource, '← change de source');
    touche('ArrowRight');
    assert.strictEqual(mv.mvFlux[0].url, avantSource, '→ revient');
    mv.setModeCable(false);
    touche('ArrowUp');
    assert.strictEqual(mv.mvFlux[0].mid, avantClavier, 'mode éteint : les flèches ne sont plus à nous');
    ok('les flèches du clavier font les mêmes deux axes que le doigt');

    // ── 14. Un mode spécifique : une seule vidéo ──────────────────────────────
    /* « Le câble, ça devrait être un mode spécifique, un seul vidéo ». Le mode réduit la
       grille à la tuile qu'on regarde ; les autres sont mises de côté, pas fermées, et
       reviennent en sortant. */
    mv.setModeCable(false);
    mv.mvFlux.length = 0;
    mv.mvFlux.push({ url: 'https://s1.test/a', name: 'M1', mid: 'm1', _autoTried: 0 });
    mv.mvFlux.push({ url: 'https://s4.test/d', name: 'M2', mid: 'm2', _autoTried: 0 });
    mv.mvFlux.push({ url: 'https://s2.test/b', name: 'M1 bis', mid: 'm1', _autoTried: 0 });
    mv.updateMultivisionLayout();
    mv.focusStream(1);
    assert.strictEqual(document.querySelectorAll('.mv-cell').length, 3);
    mv.setModeCable(true);
    assert.strictEqual(mv.mvFlux.length, 1, 'une seule vidéo en mode câble');
    assert.strictEqual(mv.mvFlux[0].mid, 'm2', 'celle qu\'on regardait, pas la première de la liste');
    assert.strictEqual(mv.videosMisesDeCote(), 2, 'les deux autres sont mises de côté');
    assert.strictEqual(document.querySelectorAll('.mv-cell').length, 1, 'et la grille n\'a plus qu\'une tuile');
    mv.setModeCable(false);
    assert.strictEqual(mv.mvFlux.length, 3, 'en sortant, elles reviennent');
    assert.strictEqual(mv.videosMisesDeCote(), 0);
    assert.deepStrictEqual(mv.mvFlux.map((f) => f.name), ['M2', 'M1', 'M1 bis']);
    ok('le mode câble réduit à une seule vidéo et rend les autres en sortant');

    // ── 15. Choisir un match ailleurs CHANGE de chaîne ────────────────────────
    mv.mvFlux.length = 0;
    mv.mvFlux.push({ url: 'https://s1.test/a', name: 'M1', mid: 'm1', _autoTried: 0 });
    mv.setModeCable(true);
    mv.addToMultivision('https://s4.test/d', 'M2 Home vs M2 Away', 'm2');
    assert.strictEqual(mv.mvFlux.length, 1, 'le mode garde sa promesse : toujours une seule vidéo');
    assert.strictEqual(mv.mvFlux[0].mid, 'm2', 'le match choisi devient la chaîne en cours');
    assert.strictEqual(mv.mvFlux[0].url, 'https://s4.test/d');
    ok('en mode câble, ajouter un match change de chaîne au lieu d\'ouvrir une tuile');

    // ── 16. Le zapping évite les blocages et préfère ce qui joue tout seul ────
    /* `refuse.test` est un hôte que le serveur a mesuré comme refusant d'être encadré :
       il est dans le registre appris, donc le mode ne s'y arrête pas. Et entre une page
       et un flux que l'application lit elle-même (`.m3u8`, donc `<video autoplay>`), le
       mode prend le second : c'est la seule lecture automatique qu'il maîtrise. */
    const scr = await import('../js/scrapers.js');
    const registre = scr.getEmbedRegistry();
    registre.blocked = registre.blocked || {};
    registre.blocked['refuse.test'] = Date.now();

    state.setMatches([
        enDirect('m1', ['https://s1.test/a', 'https://s2.test/b']),
        enDirect('m3', ['https://refuse.test/x', 'https://bon.test/y']),
        enDirect('m4', ['https://page.test/z', 'https://cdn.test/live.m3u8'])
    ]);
    mv.mvFlux.length = 0;
    mv.mvFlux.push({ url: 'https://s1.test/a', name: 'M1', mid: 'm1', _autoTried: 0 });
    mv.updateMultivisionLayout();

    assert.strictEqual(mv.zapperChaine(0, 1), true);
    assert.strictEqual(mv.mvFlux[0].mid, 'm3');
    assert.strictEqual(mv.mvFlux[0].url, 'https://bon.test/y',
        'la chaîne suivante ne s\'ouvre pas sur l\'hôte qui refuse le cadre');
    assert.strictEqual(mv.zapperChaine(0, 1), true);
    assert.strictEqual(mv.mvFlux[0].mid, 'm4');
    assert.strictEqual(mv.mvFlux[0].url, 'https://cdn.test/live.m3u8',
        'et elle prend le flux que l\'application joue elle-même, qui démarre sans clic');
    /* La source suivante du même match reste jouable, elle aussi. */
    assert.strictEqual(mv.changerSourceTuile(0, 1), true);
    assert.strictEqual(mv.mvFlux[0].url, 'https://page.test/z');
    assert.strictEqual(mv.mvFlux[0].mid, 'm4');
    ok('le zapping saute les blocages connus et préfère ce qui démarre tout seul');

    // ── 17. Lecture automatique : la tuile reçoit l'ordre de jouer ────────────
    /* Pour une PAGE, l'application ne peut que demander (le cadre est d'une autre
       origine) : `mv_clean` puis `mv_play`, et `mv_unmute` par le son. Pour un <video>
       qui est le sien, elle appelle `play()` — et réessaie en muet si le navigateur
       refuse le son, comme le fait le script utilisateur. */
    cell().querySelectorAll('.mv-media').forEach((el) => el.removeAttribute('id'));
    const faux = document.createElement('video');
    faux.id = 'mv-iframe-0';
    let joue = 0, muetApresRefus = 0;
    faux.play = function() { joue++; return joue === 1 ? Promise.reject(new Error('autoplay refusé')) : Promise.resolve(); };
    Object.defineProperty(faux, 'muted', { set: function() { muetApresRefus++; }, get: function() { return false; }, configurable: true });
    cell().querySelector('.mv-video-container').appendChild(faux);
    assert.strictEqual(mv.relancerLectureTuile(0), true);
    await new Promise((r) => setTimeout(r, 20));
    assert.ok(joue >= 1, 'la vidéo de la tuile reçoit play()');
    assert.ok(muetApresRefus >= 1, 'et un refus du navigateur la relance en muet plutôt que de la laisser arrêtée');
    ok('la lecture est relancée sur la tuile, sans attendre un clic');

    mv.setModeCable(false);

    console.log(`unit_cable: ${n} groupes de tests OK`);
    process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

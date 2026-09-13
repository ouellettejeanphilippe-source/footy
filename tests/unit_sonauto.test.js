/* Son automatique (js/multiview.js : sonAuto, donnerLeSon, noterSonBloque). Sans réseau.

   « Son automatique on » (13 septembre 2026).

   Un navigateur REFUSE une lecture automatique avec le son. La vidéo démarre donc muette,
   et le son ne peut lui être rendu qu'ENSUITE — une fois qu'elle joue, et que la page a
   reçu une activation. L'application n'en faisait que la première moitié :
   `applyMvAudioState` envoie `mv_unmute` à la tuile active au moment où on la POSE, donc
   avant que la vidéo n'existe. Le script utilisateur coupait alors le son pour obtenir la
   lecture — c'est son repli — et personne ne revenait le rendre : on regardait le match
   muet en cherchant le bouton.

   Ce que ce test verrouille :
     - le son ne va qu'à la tuile qu'on REGARDE (les autres restent muettes, sinon quatre
       tuiles parleraient en même temps) ;
     - un refus du navigateur est retenu : on n'insiste pas à chaque `video_state`, ce qui
       ferait osciller la lecture entre muet et arrêté ;
     - un clic dans le cadre est la sortie de ce refus, parce que c'est une activation
       fraîche que le navigateur accepte ;
     - le réglage coupé, plus rien ne demande le son. */
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
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    mv.setupMultivisionUI();
    document.getElementById('mv-container').style.display = 'flex';

    /* Deux tuiles, et de faux lecteurs à la place des iframes : on note ce que
       l'application leur DIT, puisque c'est tout ce qu'elle peut faire d'un cadre
       d'une autre origine. */
    mv.mvFlux.length = 0;
    mv.mvFlux.push({ url: 'https://s1.test/a', name: 'M1', mid: 'm1', _autoTried: 0 });
    mv.mvFlux.push({ url: 'https://s2.test/b', name: 'M2', mid: 'm2', _autoTried: 0 });
    mv.updateMultivisionLayout();

    const ordres = [[], []];
    [0, 1].forEach((i) => {
        const ancien = document.getElementById('mv-iframe-' + i);
        if (ancien) ancien.removeAttribute('id');
        const faux = document.createElement('div');
        faux.id = 'mv-iframe-' + i;
        faux.contentWindow = { postMessage: (m) => ordres[i].push(m) };
        document.body.appendChild(faux);
    });
    const vider = () => { ordres[0].length = 0; ordres[1].length = 0; };

    // ── 1. Le son ne va qu'à la tuile qu'on regarde ───────────────────────────
    mv.focusStream(0);
    vider();
    assert.strictEqual(mv.donnerLeSon(0, 'joue'), true, 'la tuile active prend le son dès qu\'elle joue');
    assert.ok(ordres[0].includes('mv_unmute'), 'elle reçoit mv_unmute');
    assert.ok(ordres[1].includes('mv_mute'), 'et l\'autre est coupée : deux vidéos qui parlent, c\'est inécoutable');
    vider();
    assert.strictEqual(mv.donnerLeSon(1, 'joue'), false, 'une tuile qu\'on ne regarde pas ne réclame pas le son');
    assert.deepStrictEqual(ordres[1], [], 'et rien ne lui est envoyé');
    ok('le son va à la tuile regardée, et à elle seule');

    // ── 2. Un refus du navigateur est retenu ─────────────────────────────────
    vider();
    assert.strictEqual(mv.noterSonBloque(0), true, 'le refus est noté');
    assert.strictEqual(mv.mvFlux[0]._sonBloque, true);
    assert.strictEqual(mv.noterSonBloque(0), false, 'et il n\'est noté qu\'une fois');
    assert.strictEqual(mv.donnerLeSon(0, 'joue'), false,
        'après un refus, on n\'insiste plus à chaque démarrage : insister ferait osciller la lecture entre muet et arrêté');
    assert.deepStrictEqual(ordres[0], []);
    ok('un son refusé n\'est pas redemandé en boucle');

    // ── 3. Un clic dans le cadre est la sortie ───────────────────────────────
    vider();
    assert.strictEqual(mv.donnerLeSon(0, 'geste'), true,
        'un clic est une activation fraîche : le navigateur l\'accepte, donc on retente');
    assert.ok(ordres[0].includes('mv_unmute'));
    assert.strictEqual(mv.mvFlux[0]._sonBloque, false, 'et le refus est oublié');
    ok('un geste dans la vidéo rend le son, même après un refus');

    // ── 4. Le réglage coupé : plus rien ne demande le son ────────────────────
    assert.strictEqual(mv.sonAuto, true, 'allumé par défaut : c\'est la demande');
    mv.setSonAuto(false);
    vider();
    assert.strictEqual(mv.donnerLeSon(0, 'joue'), false);
    assert.strictEqual(mv.donnerLeSon(0, 'geste'), false, 'même un geste ne rend pas le son quand le réglage est coupé');
    assert.deepStrictEqual(ordres[0].filter((m) => m === 'mv_unmute'), [], 'aucune demande de son');
    let retenu = null;
    try { retenu = localStorage.getItem('son_auto'); } catch (e) {}
    assert.strictEqual(retenu, '0', 'le choix est retenu d\'une fois à l\'autre');
    mv.setSonAuto(true);
    assert.strictEqual(mv.mvFlux[0]._sonBloque, false, 'rallumer efface les refus : on repart propre');
    ok('le réglage coupe tout et se retient');

    // ── 5. Une tuile disparue ne fait rien planter ───────────────────────────
    assert.strictEqual(mv.donnerLeSon(7, 'joue'), false, 'index hors liste');
    assert.strictEqual(mv.noterSonBloque(7), false);
    ok('un index hors liste est refusé sans exception');

    console.log(`unit_sonauto: ${n} groupes de tests OK`);
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

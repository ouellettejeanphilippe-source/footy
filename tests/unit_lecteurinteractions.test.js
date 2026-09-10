/* Le lecteur qui déborde sur le reste de l'interface (js/multiview.js, js/mv-menu.js).

   « Le multiview cause plusieurs "bugs" en interactions avec les autres éléments de
   UI/UX » (10 septembre 2026). Quatre défauts relevés dans le code, tous de la même
   famille : le lecteur pose un état GLOBAL (le défilement de la page, une marge sur le
   guide, une classe de plein écran, un menu) et ne le rend pas quand on sort par un
   autre chemin que celui qu'il attendait.

   1. Mode Cinéma : il pose `body { overflow: hidden }` et seul son bouton « Quitter »
      le rendait. Sortir par l'onglet Live, le Guide ou Options laissait la PAGE non
      défilante, définitivement, sans que rien ne dise pourquoi.
   2. Redimensionnement en mode réduit : les trois modes étaient traités comme la
      colonne. En fenêtre flottante, le guide recevait une marge droite de 400 px pour
      rien ; sur téléphone, replier la barre d'adresse (donc un `resize`) faisait
      DISPARAÎTRE la fenêtre flottante.
   3. Sortie du plein écran par Échap : le nettoyage ne visait que `#mv-grid`, alors que
      la barre demande le plein écran sur `#mv-grid-WRAPPER`. La grille restait étalée
      par-dessus le guide, avec un bouton rouge collé en haut de page.
   4. Menus en fenêtre détachée : posés sur le `<body>` d'ici alors que les boutons sont
      là-bas — menu invisible, calé sur les coordonnées d'un autre écran. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
    const dom = new JSDOM('<!doctype html><html><body>' +
        '<div id="epg"></div><div id="mv-container" style="display:none"><div id="mv-grid-wrapper"><div id="mv-grid"></div></div></div>' +
        '<div id="toast"><span id="toasttxt"></span></div>' +
        '</body></html>', { url: 'https://x.test/' });
    const w = dom.window;
    w.__NO_AUTOSTART__ = true;
    for (const k of ['window', 'document', 'DOMParser', 'localStorage', 'navigator', 'HTMLElement', 'Event', 'CustomEvent', 'location', 'history', 'getComputedStyle', 'Node']) {
        Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
    }
    globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

    await import('../js/scrapers.js');
    const mv = await import('../js/multiview.js');
    const menu = await import('../js/mv-menu.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    const grille = document.getElementById('mv-grid-wrapper');
    const mvc = document.getElementById('mv-container');
    const epg = document.getElementById('epg');

    // ── 1. Le mode Cinéma rend le défilement, par tous les chemins ───────────
    mv.toggleTheaterMode(grille);
    assert.ok(grille.classList.contains('mv-theater'));
    assert.strictEqual(document.body.style.overflow, 'hidden', 'le mode Cinéma bloque bien le défilement');

    assert.strictEqual(mv.quitterModeCinema(), true, 'quitter par un autre chemin est possible');
    assert.ok(!grille.classList.contains('mv-theater'));
    assert.strictEqual(document.body.style.overflow, '', 'et la PAGE redéfile');
    assert.strictEqual(document.getElementById('mv-close-theater'), null, 'le bouton flottant part avec');

    /* Le cas qui faisait la panne : la classe a disparu par un autre chemin, mais le
       défilement est resté bloqué. On le rend quand même. */
    document.body.style.overflow = 'hidden';
    mv.quitterModeCinema();
    assert.strictEqual(document.body.style.overflow, '', 'un défilement bloqué est rendu même sans classe à retirer');
    ok('le mode Cinéma ne peut plus laisser la page non défilante');

    // ── 2. Redimensionnement : chaque mode réduit garde sa géométrie ─────────
    mvc.classList.add('mv-pip');
    mvc.style.display = 'flex';
    /* jsdom ne met rien en page : sans cette largeur, l'ancienne règle et la nouvelle
       posaient toutes deux « 0px » et le test n'aurait rien vu. */
    Object.defineProperty(mvc, 'offsetWidth', { value: 400, configurable: true });
    const redimensionner = (largeur) => {
        Object.defineProperty(w, 'innerWidth', { value: largeur, configurable: true });
        w.dispatchEvent(new w.Event('resize'));
    };

    localStorage.setItem('multiviewPipMode', 'floating');
    epg.style.paddingRight = '400px';
    redimensionner(1280);
    assert.strictEqual(epg.style.paddingRight, '0px',
        'la fenêtre flottante passe PAR-DESSUS : elle ne réserve pas 400 px dans le guide');

    /* Sur téléphone, replier la barre d'adresse émet un `resize` : la fenêtre flottante
       ne doit pas disparaître pour autant. */
    redimensionner(390);
    assert.notStrictEqual(mvc.style.display, 'none',
        'un redimensionnement sur téléphone ne fait pas disparaître la fenêtre flottante');

    localStorage.setItem('multiviewPipMode', 'minimized');
    epg.style.paddingRight = '300px';
    redimensionner(1280);
    assert.strictEqual(epg.style.paddingRight, '0px', 'la barre réduite non plus');
    redimensionner(390);
    assert.notStrictEqual(mvc.style.display, 'none');

    /* La colonne, elle, réserve bien sa place, et se retire sur téléphone : c'est le seul
       mode dont ces deux règles sont vraies, et elles le restent. */
    localStorage.setItem('multiviewPipMode', 'sidebar');
    redimensionner(1280);
    assert.strictEqual(epg.style.paddingRight, '400px', 'la colonne pousse le guide de sa largeur');
    redimensionner(390);
    assert.strictEqual(mvc.style.display, 'none', 'et s\'efface sur téléphone, où elle n\'a pas la place');
    assert.strictEqual(epg.style.paddingRight, '0px');

    localStorage.removeItem('multiviewPipMode');
    mvc.classList.remove('mv-pip');
    mvc.style.display = 'flex';
    redimensionner(1024);
    ok('un redimensionnement n\'applique plus la règle de la colonne aux modes flottants');

    // ── 3. Sortie du plein écran : la classe est nettoyée où qu'elle soit ────
    grille.classList.add('mv-fullscreen');
    const bouton = document.createElement('button');
    bouton.id = 'mv-close-fs';
    grille.appendChild(bouton);

    document.dispatchEvent(new w.Event('fullscreenchange'));
    assert.ok(!grille.classList.contains('mv-fullscreen'),
        'la classe posée sur mv-grid-WRAPPER (celui que la barre passe en plein écran) est retirée');
    assert.strictEqual(document.getElementById('mv-close-fs'), null, 'et le bouton rouge de sortie aussi');

    /* L'ancienne cible reste couverte : rien ne dit quel élément a été mis en plein écran. */
    document.getElementById('mv-grid').classList.add('mv-fullscreen');
    mv.quitterPleinEcranLecteur();
    assert.ok(!document.getElementById('mv-grid').classList.contains('mv-fullscreen'));
    ok('quitter le plein écran par Échap ne laisse plus la grille étalée sur le guide');

    // ── 4. Le menu s'ouvre dans la fenêtre qui porte le bouton ───────────────
    const autre = new JSDOM('<!doctype html><html><body><button id="b">⋮</button></body></html>', { url: 'https://x.test/pip' });
    const ancreDetachee = autre.window.document.getElementById('b');
    menu.ouvrirMenu(ancreDetachee, [{ label: 'Recharger', onSelect() {} }]);
    assert.strictEqual(document.querySelector('.mv-menu'), null,
        'le menu d\'un bouton de la fenêtre détachée ne doit PAS atterrir dans la page');
    assert.ok(autre.window.document.querySelector('.mv-menu'),
        'il s\'ouvre dans le document du bouton, le seul où on le verra');
    menu.fermerMenus();
    assert.strictEqual(autre.window.document.querySelector('.mv-menu'), null);

    /* Et le cas normal, dans la page, continue de marcher. */
    const ancreIci = document.createElement('button');
    document.body.appendChild(ancreIci);
    menu.ouvrirMenu(ancreIci, [{ label: 'Recharger', onSelect() {} }]);
    assert.ok(document.querySelector('.mv-menu'), 'un bouton de la page ouvre son menu dans la page');
    menu.fermerMenus();
    ok('le menu du lecteur suit la fenêtre où vit son bouton');

    console.log(`unit_lecteurinteractions: ${n} groupes de tests OK`);
    process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

/* Le lecteur qui déborde sur le reste de l'interface (js/multiview.js, js/mv-menu.js).

   « Le multiview cause plusieurs "bugs" en interactions avec les autres éléments de
   UI/UX » (10 septembre 2026). Quatre défauts relevés dans le code, tous de la même
   famille : le lecteur pose un état GLOBAL (le défilement de la page, une marge sur le
   guide, une classe de plein écran, un menu) et ne le rend pas quand on sort par un
   autre chemin que celui qu'il attendait.

   1. Mode Cinéma : il pose `body { overflow: hidden }` et seul son bouton « Quitter »
      le rendait. Sortir par l'onglet Live, le Guide ou Options laissait la PAGE non
      défilante, définitivement, sans que rien ne dise pourquoi.
   2. Les modes réduits (colonne, fenêtre flottante, barre) débordaient sur le guide.
      Ils sont retirés le 9 octobre 2026 : quitter le lecteur le masque.
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

    // ── 2. Quitter le lecteur le MASQUE : plus de lecteur réduit sur Live ni Guide ──
    /* « Le multiview dans l'écran des matchs live et guide, je veux plus ça »
       (9 octobre 2026). Il se réduisait en colonne, en fenêtre flottante ou en barre ;
       sur téléphone, la fenêtre flottante couvrait la barre d'onglets du bas. */
    const redimensionner = (largeur) => {
        Object.defineProperty(w, 'innerWidth', { value: largeur, configurable: true });
        w.dispatchEvent(new w.Event('resize'));
    };
    mvc.classList.remove('mv-pip');
    mvc.style.display = 'none';
    mv.toggleMultiview();
    assert.strictEqual(mvc.style.display, 'flex', 'l\'onglet Lecteur l\'ouvre en plein cadre');
    assert.ok(mvc.classList.contains('mv-full'));

    /* Les anciens réglages des modes réduits ne doivent plus rien faire revenir. */
    localStorage.setItem('multiviewPipMode', 'floating');
    mv.toggleMultiviewPip();   // le chemin de applyFilter('live') et de showMatchSelector
    assert.strictEqual(mvc.style.display, 'none', 'quitter le lecteur le masque, il ne se réduit plus');
    assert.ok(!mvc.classList.contains('mv-full'));
    assert.strictEqual(epg.style.display, 'flex', 'le guide reprend tout l\'écran');
    assert.strictEqual(epg.style.paddingRight, '0px', 'sans colonne réservée');
    redimensionner(390);
    redimensionner(1280);
    assert.strictEqual(mvc.style.display, 'none', 'un redimensionnement ne le fait pas réapparaître');
    assert.strictEqual(epg.style.paddingRight, '0px');

    mv.toggleMultiviewPip();   // le chemin de openMultiviewTab
    assert.strictEqual(mvc.style.display, 'flex', 'et l\'onglet Lecteur le rend tel quel');
    assert.ok(mvc.classList.contains('mv-full') && !mvc.classList.contains('mv-pip'));
    localStorage.removeItem('multiviewPipMode');

    /* Le menu ⋯ ne propose plus de réduire. */
    const ancreBarre = document.createElement('button');
    document.body.appendChild(ancreBarre);
    mv.ouvrirMenuBarre(ancreBarre);
    const libelles = Array.from(document.querySelectorAll('.mv-menu .mv-menu-lb')).map((e) => e.textContent);
    menu.fermerMenus();
    assert.ok(libelles.length > 3, 'le menu s\'ouvre');
    for (const retire of ['Réduire dans un coin', 'Panneau latéral', 'Fenêtre flottante', 'Agrandir']) {
        assert.ok(!libelles.includes(retire), 'plus d\'entrée « ' + retire + ' »');
    }
    ok('quitter le lecteur le masque : plus de lecteur réduit par-dessus Live et Guide');

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

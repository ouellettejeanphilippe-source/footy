/* ══ MENU FLOTTANT DU MULTIVISION ═══════════════════════════════════════════════

   Demande du 6 septembre 2026 : « faire que le dropdown des options soit par-dessus
   le multiview ». Les menus des tuiles et de la barre étaient des <div> absolus posés
   DANS leur bouton : la cellule les rognait (`overflow: hidden`, il le faut pour la
   vidéo) et, dès la deuxième tuile, la voisine — ou son iframe — passait par-dessus.
   Un menu à moitié visible n'est pas un menu.

   Ici, un seul menu à la fois, posé en `position: fixed` au niveau du document (ou
   de l'élément en plein écran, seul endroit visible dans ce mode), à l'index
   d'empilement maximal, calé sur le bouton qui l'a ouvert et ramené dans l'écran s'il
   en déborde. Il se ferme au clic ailleurs, à Échap, au défilement, au
   redimensionnement, et quand la fenêtre perd le focus — c'est ce qui arrive quand on
   clique dans une iframe, dont les clics ne remontent jamais au document.

   Module sans import : la barre et les tuiles lui passent des éléments
   `{ label, icon, onSelect, actif, sep, titre }`, rien d'autre. */

var menuOuvert = null;
var ancreOuverte = null;
var docsEcoutes = [];

/* Le document où vit le bouton qui ouvre le menu.

   « Fenêtre détachée » (`toggleDocumentPiP`, js/multiview.js) DÉPLACE `#mv-grid-wrapper`,
   donc toutes les tuiles et leurs boutons ⋮, dans le document d'une AUTRE fenêtre. Le
   menu, lui, était toujours posé sur le `<body>` d'ici : cliquer ⋮ dans la fenêtre
   détachée ouvrait un menu invisible, dans la fenêtre principale, calé sur des
   coordonnées d'un autre écran — et le clic suivant, fait là-bas, ne le refermait pas,
   puisque les écouteurs n'étaient posés que sur ce document-ci. Même famille de défaut
   que le repos des commandes (§7.5) : raisonner sur `document` quand la grille n'y est
   plus. On suit l'ancre. */
function docDe(ancre) {
    return (ancre && ancre.ownerDocument) || document;
}

/* Élément qui reçoit le menu : en plein écran, seul le sous-arbre de l'élément en
   plein écran est peint — un menu posé sur <body> serait invisible. */
function hoteDuMenu(ancre) {
    var d = docDe(ancre);
    return d.fullscreenElement || d.webkitFullscreenElement || d.body || document.body;
}

export function fermerMenus() {
    if (menuOuvert) { menuOuvert.remove(); menuOuvert = null; }
    if (ancreOuverte) { try { ancreOuverte.setAttribute('aria-expanded', 'false'); } catch (e) {} ancreOuverte = null; }
}

/* Ramène le menu dans la fenêtre : sous le bouton par défaut, au-dessus s'il n'y a
   pas la place, et jamais hors des bords. */
function positionner(menu, ancre) {
    /* Les coordonnées d'une ancre sont celles de SA fenêtre : en fenêtre détachée, se
       caler sur `window.innerWidth` d'ici plaçait le menu hors de l'écran visible. */
    var vue = docDe(ancre).defaultView || window;
    var vw = vue.innerWidth, vh = vue.innerHeight, marge = 8;
    var r = ancre && ancre.getBoundingClientRect ? ancre.getBoundingClientRect() : { left: vw / 2, right: vw / 2, top: vh / 2, bottom: vh / 2 };
    menu.style.maxHeight = (vh - 2 * marge) + 'px';
    var mw = menu.offsetWidth, mh = menu.offsetHeight;
    var left = r.right - mw;
    if (left < marge) left = Math.max(marge, r.left);
    if (left + mw > vw - marge) left = Math.max(marge, vw - marge - mw);
    var top = r.bottom + 6;
    if (top + mh > vh - marge) {
        var dessus = r.top - 6 - mh;
        top = dessus >= marge ? dessus : Math.max(marge, vh - marge - mh);
    }
    menu.style.left = Math.round(left) + 'px';
    menu.style.top = Math.round(top) + 'px';
}

/* Un jeu d'écouteurs par document qui a déjà porté un menu : la fenêtre détachée a le
   sien. Posés une seule fois par document, jamais retirés — ils ne font rien tant
   qu'aucun menu n'est ouvert. */
function poserEcouteurs(doc) {
    doc = doc || document;
    /* Une fenêtre détachée fermée laisse un document orphelin (`defaultView` nul) : le
       garder retiendrait son arbre en mémoire pour rien, un de plus à chaque détachement
       d'une même session. */
    docsEcoutes = docsEcoutes.filter(function (d) { return d === document || d.defaultView; });
    if (docsEcoutes.indexOf(doc) >= 0) return;
    docsEcoutes.push(doc);
    var vue = doc.defaultView || window;
    doc.addEventListener('pointerdown', function (e) {
        if (!menuOuvert) return;
        if (menuOuvert.contains(e.target)) return;
        if (ancreOuverte && ancreOuverte.contains && ancreOuverte.contains(e.target)) return;
        fermerMenus();
    }, true);
    doc.addEventListener('keydown', function (e) {
        if (!menuOuvert) return;
        if (e.key === 'Escape') { fermerMenus(); return; }
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        var boutons = Array.prototype.slice.call(menuOuvert.querySelectorAll('button:not([disabled])'));
        if (!boutons.length) return;
        var i = boutons.indexOf(document.activeElement);
        var suivant = e.key === 'ArrowDown' ? (i + 1) % boutons.length : (i - 1 + boutons.length) % boutons.length;
        boutons[suivant].focus();
        e.preventDefault();
    });
    vue.addEventListener('resize', fermerMenus);
    vue.addEventListener('scroll', fermerMenus, true);
    vue.addEventListener('blur', fermerMenus);
    doc.addEventListener('fullscreenchange', fermerMenus);
}

/* Ouvre un menu sous `ancre`. Un second appel sur la même ancre le referme (bascule).
   `elements` : liste de { label, icon, onSelect, actif, disabled, danger, sep, titre }.
   Rend l'élément du menu, ou null s'il vient d'être refermé. */
export function ouvrirMenu(ancre, elements, options) {
    options = options || {};
    if (menuOuvert && ancreOuverte === ancre) { fermerMenus(); return null; }
    fermerMenus();

    var doc = docDe(ancre);
    var menu = doc.createElement('div');
    menu.className = 'mv-menu' + (options.classe ? ' ' + options.classe : '');
    menu.setAttribute('role', 'menu');
    if (options.label) menu.setAttribute('aria-label', options.label);

    (elements || []).forEach(function (el) {
        if (!el) return;
        if (el.sep) { var sep = doc.createElement('div'); sep.className = 'mv-menu-sep'; menu.appendChild(sep); return; }
        if (el.titre) { var t = doc.createElement('div'); t.className = 'mv-menu-title'; t.textContent = el.titre; menu.appendChild(t); return; }
        var b = doc.createElement('button');
        b.type = 'button';
        b.setAttribute('role', 'menuitem');
        b.className = 'mv-menu-item' + (el.actif ? ' actif' : '') + (el.danger ? ' danger' : '');
        if (el.disabled) b.disabled = true;
        if (el.title) b.title = el.title;
        var ic = doc.createElement('span'); ic.className = 'mv-menu-ic'; ic.textContent = el.icon || ''; ic.setAttribute('aria-hidden', 'true');
        var lb = doc.createElement('span'); lb.className = 'mv-menu-lb'; lb.textContent = el.label || '';
        b.appendChild(ic); b.appendChild(lb);
        if (el.actif) { var coche = doc.createElement('span'); coche.className = 'mv-menu-check'; coche.textContent = '✓'; coche.setAttribute('aria-hidden', 'true'); b.appendChild(coche); }
        b.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            fermerMenus();
            try { if (typeof el.onSelect === 'function') el.onSelect(e); } catch (err) { console.error('[mv-menu]', err); }
        });
        menu.appendChild(b);
    });

    hoteDuMenu(ancre).appendChild(menu);
    menuOuvert = menu;
    ancreOuverte = ancre || null;
    if (ancre && ancre.setAttribute) ancre.setAttribute('aria-expanded', 'true');
    positionner(menu, ancre);
    poserEcouteurs(doc);
    /* La fenêtre principale garde ses écouteurs : c'est elle qui perd le focus quand on
       clique dans une iframe, et c'est ce signal-là qui referme le menu. */
    poserEcouteurs(document);

    var premier = menu.querySelector('button:not([disabled])');
    if (premier && options.focus !== false && !('ontouchstart' in window)) premier.focus({ preventScroll: true });
    return menu;
}

if (typeof window !== 'undefined') {
    window.ouvrirMenu = ouvrirMenu;
    window.fermerMenus = fermerMenus;
}

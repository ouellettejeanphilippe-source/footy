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
var ecouteursPoses = false;

/* Élément qui reçoit le menu : en plein écran, seul le sous-arbre de l'élément en
   plein écran est peint — un menu posé sur <body> serait invisible. */
function hoteDuMenu() {
    return document.fullscreenElement || document.webkitFullscreenElement || document.body;
}

export function fermerMenus() {
    if (menuOuvert) { menuOuvert.remove(); menuOuvert = null; }
    if (ancreOuverte) { try { ancreOuverte.setAttribute('aria-expanded', 'false'); } catch (e) {} ancreOuverte = null; }
}

export function menuEstOuvert() { return !!menuOuvert; }

/* Ramène le menu dans la fenêtre : sous le bouton par défaut, au-dessus s'il n'y a
   pas la place, et jamais hors des bords. */
function positionner(menu, ancre) {
    var vw = window.innerWidth, vh = window.innerHeight, marge = 8;
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

function poserEcouteurs() {
    if (ecouteursPoses) return;
    ecouteursPoses = true;
    document.addEventListener('pointerdown', function (e) {
        if (!menuOuvert) return;
        if (menuOuvert.contains(e.target)) return;
        if (ancreOuverte && ancreOuverte.contains && ancreOuverte.contains(e.target)) return;
        fermerMenus();
    }, true);
    document.addEventListener('keydown', function (e) {
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
    window.addEventListener('resize', fermerMenus);
    window.addEventListener('scroll', fermerMenus, true);
    window.addEventListener('blur', fermerMenus);
    document.addEventListener('fullscreenchange', fermerMenus);
}

/* Ouvre un menu sous `ancre`. Un second appel sur la même ancre le referme (bascule).
   `elements` : liste de { label, icon, onSelect, actif, disabled, danger, sep, titre }.
   Rend l'élément du menu, ou null s'il vient d'être refermé. */
export function ouvrirMenu(ancre, elements, options) {
    options = options || {};
    if (menuOuvert && ancreOuverte === ancre) { fermerMenus(); return null; }
    fermerMenus();

    var menu = document.createElement('div');
    menu.className = 'mv-menu' + (options.classe ? ' ' + options.classe : '');
    menu.setAttribute('role', 'menu');
    if (options.label) menu.setAttribute('aria-label', options.label);

    (elements || []).forEach(function (el) {
        if (!el) return;
        if (el.sep) { var sep = document.createElement('div'); sep.className = 'mv-menu-sep'; menu.appendChild(sep); return; }
        if (el.titre) { var t = document.createElement('div'); t.className = 'mv-menu-title'; t.textContent = el.titre; menu.appendChild(t); return; }
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('role', 'menuitem');
        b.className = 'mv-menu-item' + (el.actif ? ' actif' : '') + (el.danger ? ' danger' : '');
        if (el.disabled) b.disabled = true;
        if (el.title) b.title = el.title;
        var ic = document.createElement('span'); ic.className = 'mv-menu-ic'; ic.textContent = el.icon || ''; ic.setAttribute('aria-hidden', 'true');
        var lb = document.createElement('span'); lb.className = 'mv-menu-lb'; lb.textContent = el.label || '';
        b.appendChild(ic); b.appendChild(lb);
        if (el.actif) { var coche = document.createElement('span'); coche.className = 'mv-menu-check'; coche.textContent = '✓'; coche.setAttribute('aria-hidden', 'true'); b.appendChild(coche); }
        b.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            fermerMenus();
            try { if (typeof el.onSelect === 'function') el.onSelect(e); } catch (err) { console.error('[mv-menu]', err); }
        });
        menu.appendChild(b);
    });

    hoteDuMenu().appendChild(menu);
    menuOuvert = menu;
    ancreOuverte = ancre || null;
    if (ancre && ancre.setAttribute) ancre.setAttribute('aria-expanded', 'true');
    positionner(menu, ancre);
    poserEcouteurs();

    var premier = menu.querySelector('button:not([disabled])');
    if (premier && options.focus !== false && !('ontouchstart' in window)) premier.focus({ preventScroll: true });
    return menu;
}

if (typeof window !== 'undefined') {
    window.ouvrirMenu = ouvrirMenu;
    window.fermerMenus = fermerMenus;
}

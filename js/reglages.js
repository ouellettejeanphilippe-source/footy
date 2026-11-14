/* Les Réglages en rubriques (14 novembre 2026, « Go pour les captures » : une autre
   application range ses réglages dans une colonne de rubriques avec un champ de recherche,
   et propose des thèmes en un clic).

   Ici, ce qui se calcule sans la page : chercher un réglage par son nom ou son explication,
   et la liste des préréglages d'apparence. Le branchement est dans js/ui.js
   (`brancherRechercheReglages`) et js/multiview.js (`buildSwatches`). Sans import. */

/* Minuscules, sans accent ni ponctuation : « Mises à jour » se trouve par « mise a jour ». */
export function normaliser(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[’']/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
}

/* Les réglages qui ne sont pas une ligne d'une page : ceux du menu Look et les deux
   actions de la colonne. `action` dit quoi ouvrir (js/ui.js). */
export var ENTREES_FIXES = [
    { titre: 'Couleur des cartes', texte: 'Uni, dégradé, deux couleurs, ligue, neutre', rubrique: 'Look', action: 'look' },
    { titre: 'Couleur du match', texte: 'L’accent prend la couleur du match regardé ou à la une', rubrique: 'Look', action: 'look' },
    { titre: 'Masquer les scores', texte: 'Ni score, ni buteurs, ni statistiques : anti-divulgâcheur, spoiler', rubrique: 'Look', action: 'look' },
    { titre: 'Actualiser', texte: 'Relire les scores et les liens maintenant', rubrique: 'Actions', action: 'actualiser' },
    { titre: 'Mettre à jour l’app', texte: 'Récupérer la dernière version publiée', rubrique: 'Actions', action: 'maj' }
];

/* Les pages des Réglages : l'identifiant de la section, la vue d'`applyFilter`, le nom. */
export var PAGES = [
    { id: 'options-page', vue: 'options', rubrique: 'Options' },
    { id: 'script-page', vue: 'script', rubrique: 'Mises à jour' },
    { id: 'logs-page', vue: 'logs', rubrique: 'Logs' }
];

function texteDe(el) { return el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : ''; }

/* L'index : une entrée par ligne de réglage (`.field`) et par panneau (`.panel-title`),
   lue dans la page telle qu'elle est. `el` est l'élément vers lequel défiler. */
export function indexer(doc, pages) {
    var index = [];
    (pages || PAGES).forEach(function(p) {
        var section = doc && doc.getElementById(p.id);
        if (!section) return;
        Array.prototype.forEach.call(section.querySelectorAll('.field-label, .panel-title, .maj-guide > summary'), function(el) {
            var petit = el.querySelector && el.querySelector('small, .help');
            var titre = texteDe(el.querySelector && el.querySelector('span') && !el.classList.contains('field-label') ? el.querySelector('span') : el);
            var texte = texteDe(petit);
            if (texte && titre.slice(-texte.length) === texte) titre = titre.slice(0, titre.length - texte.length).trim();
            if (!titre) return;
            index.push({ titre: titre, texte: texte, rubrique: p.rubrique, vue: p.vue, el: el.closest ? (el.closest('.field, .panel, details') || el) : el });
        });
    });
    return index.concat(ENTREES_FIXES);
}

/* Les entrées qui contiennent TOUS les mots cherchés, celles dont le titre les porte
   d'abord. Rien pour une recherche vide. */
export function chercher(index, q, max) {
    var mots = normaliser(q).split(' ').filter(Boolean);
    if (!mots.length) return [];
    var notes = [];
    (index || []).forEach(function(e, i) {
        var titre = normaliser(e.titre), tout = titre + ' ' + normaliser(e.texte) + ' ' + normaliser(e.rubrique);
        if (!mots.every(function(m) { return tout.indexOf(m) >= 0; })) return;
        var dansTitre = mots.every(function(m) { return titre.indexOf(m) >= 0; });
        notes.push({ e: e, rang: (dansTitre ? 0 : 1000) + (titre.indexOf(mots[0]) === 0 ? 0 : 100) + i });
    });
    notes.sort(function(a, b) { return a.rang - b.rang; });
    return notes.slice(0, max || 8).map(function(n) { return n.e; });
}

/* Les préréglages : l'identité d'origine, puis huit palettes choisies parmi celles
   d'Options (`PALETTES`, js/multiview.js), dans cet ordre. */
export var DEFAUT = { id: 'defaut', name: 'Défaut', c1: '#0b0d12', c2: '#151b2b', c3: '#0b0d12', accent: '#0a84ff' };
export var IDS_PREREGLAGES = ['midnight', 'vercel', 'github_dark', 'cyberpunk', 'ocean', 'forest', 'sunset', 'minimal_light'];
export function prereglages(palettes) {
    var parId = {};
    (palettes || []).forEach(function(p) { if (p && p.id) parId[p.id] = p; });
    return [DEFAUT].concat(IDS_PREREGLAGES.map(function(id) { return parId[id]; }).filter(Boolean));
}

/* Le texte se lit-il en noir sur cette couleur ? (les préréglages clairs) */
export function estClaire(hex) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || ''));
    if (!m) return false;
    return (0.299 * parseInt(m[1], 16) + 0.587 * parseInt(m[2], 16) + 0.114 * parseInt(m[3], 16)) > 150;
}

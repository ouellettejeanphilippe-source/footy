/* Le choix des matchs du lecteur, façon Prime Video (29 octobre 2026, « go pour le style
   Prime Video » ; « Prime Video a un mode multiview qui marche super bien, s'en inspirer »).

   Prime Video ouvre son multiview sur un écran de choix : les matchs en direct en cartes,
   jusqu'à quatre cochés, puis « Regarder ». Ici, « + Ajouter » renvoyait au Live avec un
   toast (« Sélectionnez un match… »), une vidéo à la fois. Ce module tient la sélection ;
   js/multiview.js dessine l'écran et applique le choix.

   Sans import : pur, testé sous Node. Les matchs sont ceux de l'application
   ({ id, homeTeam, awayTeam, ... }) ; `enCours` est la liste des `mid` des tuiles, dans
   leur ordre. */

export var MAX_VIDEOS = 4;

/* Les cartes à montrer : les matchs qu'on peut regarder (`chaines`, déjà triés : en
   direct d'abord), plus ceux qui sont dans le lecteur sans l'être encore (fini, liens
   disparus) — sans quoi on ne pourrait pas les décocher. Ceux du lecteur viennent en tête,
   dans l'ordre des tuiles : c'est ce qu'on regarde. */
export function cartesDuChoix(chaines, enCours, tous) {
    var vus = {};
    var cartes = [];
    var parId = {};
    (tous || []).concat(chaines || []).forEach(function (m) { if (m && m.id !== undefined) parId[String(m.id)] = m; });
    (enCours || []).forEach(function (mid) {
        var k = String(mid);
        if (vus[k]) return;
        vus[k] = true;
        cartes.push(parId[k] || { id: k, inconnu: true });
    });
    (chaines || []).forEach(function (m) {
        if (!m || m.id === undefined) return;
        var k = String(m.id);
        if (vus[k]) return;
        vus[k] = true;
        cartes.push(m);
    });
    return cartes;
}

/* Cocher ou décocher `id`. Rend la nouvelle sélection (un tableau neuf), ou la même si
   le plafond est atteint : on ne coche pas une cinquième vidéo. */
export function basculerChoix(selection, id, max) {
    var plafond = max || MAX_VIDEOS;
    var k = String(id);
    var s = (selection || []).map(String);
    var i = s.indexOf(k);
    if (i >= 0) { s.splice(i, 1); return s; }
    if (s.length >= plafond) return s;
    s.push(k);
    return s;
}

/* Ce qu'il faut faire au lecteur pour passer de `enCours` à `selection` : les tuiles à
   retirer (leurs index, du plus grand au plus petit, pour qu'un retrait ne décale pas le
   suivant) et les matchs à ajouter, dans l'ordre où on les a cochés. Une tuile déjà là
   reste telle quelle : elle ne recharge pas. */
export function differenceChoix(enCours, selection) {
    var garder = (selection || []).map(String);
    var presents = (enCours || []).map(String);
    var retirer = [];
    presents.forEach(function (mid, idx) { if (garder.indexOf(mid) < 0) retirer.push(idx); });
    retirer.sort(function (a, b) { return b - a; });
    var ajouter = garder.filter(function (mid) { return presents.indexOf(mid) < 0; });
    return { retirer: retirer, ajouter: ajouter };
}

/* Le libellé du bouton principal. */
export function libelleRegarder(enCours, selection) {
    var d = differenceChoix(enCours, selection);
    var n = (selection || []).length;
    if (!d.retirer.length && !d.ajouter.length) return n ? 'Regarder (' + n + ')' : 'Choisir au moins un match';
    return 'Regarder (' + n + ')';
}

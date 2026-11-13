/* Le bilan d'une équipe sur la carte d'un match (13 novembre 2026, « dans la carte de sélection de
   match, mettre les stats genre la fiche où sont les noms et logos » ; précisé : les cartes du Live).

   La fiche lit le bilan dans le `summary` d'ESPN, une requête par match : trop pour une grille.
   Le `scoreboard`, déjà lu pour le calendrier, le porte aussi (`competitors[].records[]`,
   « 9-7-1 » : victoires, défaites, puis prolongation ou nuls selon le sport) : aucune requête de plus.

   Lu par `js/api.js` et `scripts/scrape_schedule.mjs` (champs `homeRecord` / `awayRecord` d'un
   match), rendu par `js/ui.js`. Sans import. */

var FORME = /^\d{1,3}(-\d{1,3}){1,3}$/;

/* Le bilan d'ensemble d'un `competitor` du scoreboard : la ligne `total` ou `ytd`, sinon la
   première. Rend '' quand il n'y en a pas ou qu'elle n'a pas la forme attendue. */
export function bilanDe(competiteur) {
    var r = competiteur && Array.isArray(competiteur.records) ? competiteur.records : [];
    var ligne = r.filter(function(x) { return x && (x.type === 'total' || x.type === 'ytd'); })[0] || r[0];
    var s = ligne && typeof ligne.summary === 'string' ? ligne.summary.trim() : '';
    return FORME.test(s) ? s : '';
}

/* Le bilan à côté du nom, sur la carte. Rien pour un bilan absent ou mal formé (un vieux cache). */
export function bilanHtml(bilan, esc) {
    var s = typeof bilan === 'string' ? bilan.trim() : '';
    if (!FORME.test(s)) return '';
    return '<span class="prime-bilan" title="Bilan de la saison : ' + esc(s) + '">' + esc(s) + '</span>';
}

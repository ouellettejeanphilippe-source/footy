/* Relevé des sorties de l'application, vidéos chargées.

   « ça le fait encore » (18 octobre 2026) : l'onglet de l'appli parti sur une pub, « je
   quittais pas, le stream redirige », appli v61, script 1.15, Firefox 158, « rien, je
   regardais ». Pas reproduit dans un vrai Firefox 158 : un cadre d'une autre origine n'y
   emmène l'onglet qu'après un clic chez lui, et la garde « Quitter le site ? » le retient
   alors (docs/WORKLOG.md, Blocages). Plutôt qu'un correctif de plus à l'aveugle, chaque
   sortie est notée : la garde était-elle armée, et sinon pourquoi ; la page est-elle
   vraiment partie ; ce qui précédait (geste, focus, dernier clic dans une tuile). La page
   Logs les montre au retour, en clair.

   Lu le soir même : quatre « page restée · garde armée » juste après la pose des vidéos,
   puis une page quittée et un retour trois secondes après. C'était `history.back()`
   appelé par une vidéo, qui fait reculer tout l'onglet sans clic (Firefox 158) ; le
   script 1.17 le rend inerte.

   Trois lectures possibles du prochain détournement :
     - une sortie « garde armée » puis « quittée » : le navigateur n'a pas posé la
       question (ou on a répondu « Quitter ») ;
     - une sortie « garde levée » : le signe de départ qui l'a levée est faux ;
     - aucune sortie notée, mais un retour par « Précédent » : la page est partie sans
       même passer par `beforeunload`.

   Module sans import : `js/multiview.js` lui donne l'état de la garde, il range et rend du
   HTML. */

export var SORTIES_MAX = 12;

/* Ajoute une sortie en tête du journal (le plus récent d'abord), borné. */
export function noterSortie(journal, etat, maintenant) {
    var j = Array.isArray(journal) ? journal.slice() : [];
    var e = { type: 'sortie', at: maintenant, quittee: false };
    Object.keys(etat || {}).forEach(function (k) { e[k] = etat[k]; });
    j.unshift(e);
    return j.slice(0, SORTIES_MAX);
}

/* La page est vraiment partie (`pagehide`) : la dernière sortie notée, si elle est toute
   récente, ne l'a pas retenue. Restée à `false`, elle dit qu'on est resté sur la page. */
export function marquerQuittee(journal, maintenant, persistee) {
    var j = Array.isArray(journal) ? journal.slice() : [];
    var e = j[0];
    if (!e || e.type !== 'sortie' || e.quittee || maintenant - e.at > 60000) return j;
    j[0] = Object.assign({}, e, { quittee: true, cache: !!persistee });
    return j;
}

/* Un retour sur l'application par « Précédent » (ou le cache de navigation). */
export function noterRetour(journal, maintenant, depuisCache) {
    var j = Array.isArray(journal) ? journal.slice() : [];
    j.unshift({ type: 'retour', at: maintenant, cache: !!depuisCache });
    return j.slice(0, SORTIES_MAX);
}

/* Un recul de l'onglet demandé par une vidéo, absorbé par le tampon d'historique
   (js/tampon.js) : la page n'est pas partie, rien ne passe par `beforeunload`. */
export function noterBlocage(journal, etat, maintenant) {
    var j = Array.isArray(journal) ? journal.slice() : [];
    var e = { type: 'bloque', at: maintenant };
    ['sites', 'poseesIlYaMs', 'script', 'clicTuileIlYaMs'].forEach(function (k) { if (etat && etat[k] !== undefined) e[k] = etat[k]; });
    j.unshift(e);
    return j.slice(0, SORTIES_MAX);
}

/* Pourquoi la garde était, ou n'était pas, armée — en clair. */
export function raisonDeLaGarde(e) {
    if (!e) return '';
    if (e.armee) {
        if (e.activation && e.activation.deja === false) return 'garde armée, mais la page n\'avait reçu aucun geste : le navigateur ne pose pas la question dans ce cas';
        return 'garde armée : le navigateur devait demander « Quitter le site ? »';
    }
    if (e.reglage === false) return 'garde levée : réglage « Bloquer les redirections des sites » coupé';
    if (!e.tuiles) return 'garde levée : aucune vidéo';
    if (e.pages === 0) return 'garde levée : aucune tuile n\'affiche la page d\'un site (mode direct, chargement ou lecteur officiel)';
    if (e.autorisee) return 'garde levée : navigation de l\'application (mise à jour, installation du script)';
    if (e.cachee) return 'garde levée : onglet en arrière-plan';
    if (e.parLeHaut) return 'garde levée : pointeur sorti par le haut (vers les onglets)';
    if (e.modificateur) return 'garde levée : Ctrl, Cmd ou Alt tenu';
    if (typeof e.toucheIlYaMs === 'number') return 'garde levée : F5, Ctrl+R ou bouton Précédent de la souris il y a ' + e.toucheIlYaMs + ' ms';
    return 'garde levée';
}

function heure(at) {
    var d = new Date(at);
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

function duree(ms) {
    if (typeof ms !== 'number' || !isFinite(ms) || ms < 0) return null;
    if (ms < 1000) return ms + ' ms';
    if (ms < 120000) return Math.round(ms / 1000) + ' s';
    return Math.round(ms / 60000) + ' min';
}

function videos(e) {
    return e.sites.map(function (site, i) {
        var pose = Array.isArray(e.poseesIlYaMs) ? duree(e.poseesIlYaMs[i]) : null;
        return site + (pose ? ' (chargée il y a ' + pose + ')' : '');
    }).join(', ');
}

/* Le journal pour la page Logs. `esc` échappe le HTML (js/utils.js). */
export function sortiesHtml(journal, esc) {
    var j = Array.isArray(journal) ? journal : [];
    var html = '<div class="diag-sorties" style="margin-bottom:10px;"><div style="font-weight:700; margin-bottom:4px;">Sorties de l\'appli (vidéos chargées)</div>';
    if (!j.length) return html + '<div style="color:var(--muted2); font-size:12px;">Aucune sortie notée.</div></div>';
    j.forEach(function (e) {
        if (e.type === 'retour') {
            html += '<div style="padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:12px;">↩ <b>' + esc(heure(e.at)) + '</b> retour sur l\'appli'
                + (e.cache ? ' (page gardée en mémoire)' : ' (rechargée)') + '</div>';
            return;
        }
        var details = [];
        if (e.type === 'bloque') {
            if (Array.isArray(e.sites) && e.sites.length) details.push('vidéos : ' + videos(e));
            if (e.script) details.push('script ' + e.script);
            html += '<div style="padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:12px;">⛔ <b>' + esc(heure(e.at)) + '</b> '
                + 'recul de l\'onglet demandé par une vidéo · bloqué, la page est restée'
                + '<div style="color:var(--muted2);">' + esc(details.join(' · ')) + '</div></div>';
            return;
        }
        if (e.activation) details.push('geste dans la page : ' + (e.activation.active ? 'à l\'instant' : (e.activation.deja ? 'plus tôt' : 'jamais')));
        if (typeof e.focusTuile === 'number' && e.focusTuile >= 0) details.push('focus dans la vidéo ' + (e.focusTuile + 1));
        var clic = duree(e.clicTuileIlYaMs);
        details.push(clic ? 'dernier clic dans une vidéo il y a ' + clic : 'aucun clic dans une vidéo');
        if (e.focusPage === false) details.push('fenêtre sans le focus');
        if (e.pointeur) details.push('pointeur vu à ' + e.pointeur.y + ' px du haut' + (duree(e.pointeur.ilYaMs) ? ' il y a ' + duree(e.pointeur.ilYaMs) : ''));
        if (e.sortieFenetre) details.push('sorti de la fenêtre à ' + e.sortieFenetre.y + ' px du haut' + (duree(e.sortieFenetre.ilYaMs) ? ' il y a ' + duree(e.sortieFenetre.ilYaMs) : ''));
        if (e.derniereTouche) details.push('dernière touche ' + e.derniereTouche.touche + (duree(e.derniereTouche.ilYaMs) ? ' il y a ' + duree(e.derniereTouche.ilYaMs) : ''));
        if (Array.isArray(e.sites) && e.sites.length) details.push('vidéos : ' + videos(e));
        if (e.script) details.push('script ' + e.script);
        else if (e.script === null) details.push('sans script');
        if (e.tampon === false && e.armee) details.push('sans tampon d\'historique');
        html += '<div style="padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:12px;">'
            + (e.quittee ? '🚪' : '🛡') + ' <b>' + esc(heure(e.at)) + '</b> '
            + (e.quittee ? 'page quittée' : 'page restée') + ' · ' + esc(raisonDeLaGarde(e))
            + '<div style="color:var(--muted2);">' + esc(details.join(' · ')) + '</div></div>';
    });
    return html + '</div>';
}

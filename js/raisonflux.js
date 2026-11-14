/* Pourquoi une source ne joue pas (14 novembre 2026, « ya des idées à s'inspirer? » : une
   autre application dit, après une douzaine de secondes, pourquoi une chaîne ne joue pas).

   La tuile rechargeait, changeait de source ou s'arrêtait avec « Aucune vidéo », sans dire
   ce qu'elle savait. Or on sait souvent quelque chose : le serveur a sondé chaque hôte
   (`hostPolicy` de data/streams.json : code de réponse, en-têtes d'encadrement, défi,
   « injoignable » et sa cause), la vérification a un verdict par lien, le registre compte
   les essais de l'hôte, et la tuile a pu lire elle-même une page de refus. Ici, on en tire
   UNE raison courte, la plus certaine d'abord. Sans import. */

/* Dans l'ordre de certitude : ce que la tuile a vu elle-même, puis ce que le serveur a
   mesuré sur l'hôte, puis ce que le registre a compté, puis rien (« silence »). */
export function raisonSansVideo(o) {
    var x = o || {};
    var lien = x.lien || {};
    var p = x.politique || null;
    var h = x.hote || null;
    var raison = p ? String(p.reason || '') : '';
    var statut = p ? (p.status | 0) : 0;

    if (x.refus) return { code: 'cadre', texte: 'le site refuse de s’afficher dans l’application' };

    if (p && /^injoignable/i.test(raison)) {
        if (/ENOTFOUND|EAI_AGAIN/i.test(raison)) return { code: 'disparu', texte: 'l’adresse du lecteur n’existe plus' };
        if (/CERT|certificate|SSL|TLS|self.signed/i.test(raison)) return { code: 'certificat', texte: 'le certificat de sécurité du lecteur est invalide' };
        return { code: 'muet', texte: 'le serveur du lecteur ne répond pas' };
    }
    if (statut === 404 || statut === 410) return { code: 'introuvable', texte: 'la page du lecteur a disparu (' + statut + ')' };
    if (statut >= 500) return { code: 'panne', texte: 'le serveur du lecteur est en panne (' + statut + ')' };
    /* Un défi (Cloudflare) vient avec des en-têtes d'encadrement qui sont ceux de la page de
       défi, pas du lecteur : il passe donc avant `embeddable`. */
    if (p && p.defi) return { code: 'defi', texte: 'le site filtre ses visiteurs (vérification anti-robot)' };
    if (statut === 451) return { code: 'region', texte: 'le lecteur est bloqué dans cette région (451)' };
    if (statut === 401 || statut === 403) return { code: 'acces', texte: 'le site refuse l’accès (' + statut + ')' };

    if (lien.verified === 'blocked' || (p && p.embeddable === false)) return { code: 'cadre', texte: 'le site refuse de s’afficher dans l’application' };

    if (h && (h.tested | 0) >= 3 && !(h.plays | 0)) {
        return h.appareilMort
            ? { code: 'jamais-ici', texte: 'ce lecteur n’a jamais joué sur cet appareil (0/' + (h.tested | 0) + ')' }
            : { code: 'jamais', texte: 'ce lecteur n’a encore jamais joué (0/' + (h.tested | 0) + ')' };
    }
    return { code: 'silence', texte: '' };
}

/* « Aucune vidéo : <suite> », avec la raison entre les deux quand on en a une :
   « Aucune vidéo, la page du lecteur a disparu (404) : source suivante (2/5) ». */
export function phraseSansVideo(raison, suite) {
    var t = raison && raison.texte ? ', ' + raison.texte : '';
    return 'Aucune vidéo' + t + (suite ? ' : ' + suite : '');
}

/* La note laissée sur la tuile quand elle n'essaie plus rien d'elle-même. */
export function noteAbandon(raison, autresSources) {
    var t = raison && raison.texte ? raison.texte.charAt(0).toUpperCase() + raison.texte.slice(1) : 'Aucune vidéo sur cette source';
    return t + '. ' + (autresSources ? '⏭ pour essayer une autre source.' : 'Aucune autre source pour ce match.');
}

/* Registre des adaptateurs par domaine.

   « Chaque domaine doit donc être différent dans le système de fetch and parse »
   (6 septembre 2026). Un adaptateur = un fichier = un domaine, et rien d'autre.

   Contrat d'un adaptateur :
     hotes           : [fragment d'hôte]  — ce que cet adaptateur reconnaît
     extraireLiens   : (ctx) -> [liens]   — les flux de UNE page de match

   Le contexte est fourni par l'appelant, jamais importé par l'adaptateur (un import du
   module central rendrait le graphe circulaire) :
     ctx.html      texte de la page
     ctx.doc       document déjà analysé
     ctx.match     le match auquel la page se rattache
     ctx.pageText  texte visible de la page (pour le contexte de diagnostic)
     ctx.pageLiens ancres de la page (idem)
     ctx.aides     { estPageDeMatchOuLigue, qualite, memeMatch, parseListe }
                   `parseListe` est le parseur de liste DU domaine, `memeMatch`
                   l'appariement : OnHockey en a besoin, ses matchs pointant tous vers sa
                   grille unique plutôt que vers une page par match.

   Un domaine sans adaptateur n'est pas un problème : le moteur générique
   (js/extractors.js) reste le chemin par défaut, et la plupart des sources s'en
   contentent. On n'écrit un adaptateur que là où le site a vraiment sa propre forme.

   Un adaptateur n'importe jamais le module central (js/scrapers.js) ni ce qui y remonte
   (js/utils.js, js/config.js) : le cycle ferait retirer tout le graphe des modules
   derrière chaque adaptateur. Les modules feuilles (db, match, extractors) sont sûrs.
   `unit_adaptateurs` vérifie la règle en lisant les imports de chaque fichier. */

import * as footybite from './footybite.js';
import * as onhockey from './onhockey.js';
import * as streameast from './streameast.js';
import * as vipleague from './vipleague.js';
import * as liveleagues from './liveleagues.js';

export var ADAPTATEURS = [footybite, onhockey, streameast, vipleague, liveleagues];

/* L'adaptateur qui reconnaît cet hôte, ou null. */
export function adaptateurPour(hote) {
    var h = String(hote || '').toLowerCase();
    if (!h) return null;
    for (var i = 0; i < ADAPTATEURS.length; i++) {
        var a = ADAPTATEURS[i];
        for (var j = 0; j < (a.hotes || []).length; j++) {
            if (h.indexOf(a.hotes[j]) >= 0) return a;
        }
    }
    return null;
}

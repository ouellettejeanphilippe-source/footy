/* ══ QUAND LE SERVEUR SE TAIT ═══════════════════════════════════════════════════

   Deux manques révélés par la panne du 10 au 12 septembre 2026, où le workflow des
   liens est mort pendant 45 heures :

   1. **Personne n'a rien dit.** L'application savait que le cache avait 2700 minutes
      (`prefetchedStreamsInfo.ageMin`), elle s'en servait même pour décider de relire les
      sources — mais l'écran Journaux l'affichait en vert comme si tout allait bien, et
      seul un double appui sur « recharger » lâchait un « le workflow tourne encore ? ».
      Un cache censé être frais à 30 minutes doit crier passé 90.

   2. **L'application ne peut pas remplacer le serveur.** Elle sait se replier — au-delà
      de trois heures de cache, elle relit les sources elle-même — mais seulement leurs
      pages de LISTE, une dizaine. Or le gros du travail du serveur est les ~600 **pages
      de match**, celles qui portent les dizaines de lecteurs ; elle n'en lit qu'une,
      celle de la carte qu'on ouvre. D'où l'écart mesuré ce jour-là : 4985 liens côté
      serveur contre 2 par match en repli.

   Ce module ne fait que DÉCIDER : l'état du cache, et quels matchs valent une lecture
   directe. Il ne touche ni au réseau ni au DOM, et n'importe rien — les prédicats
   (direct, imminent, hôte bloqué, liens utiles) viennent de l'appelant, comme dans
   js/cable.js. */

/* Le cache est republié toutes les 30 minutes. Un passage manqué, c'est 60 minutes ;
   deux, 90. Au-delà, ce n'est plus de la gigue de cron, c'est une panne — et c'est le
   moment de le dire ET de chercher soi-même. */
export var SEUIL_VIEUX_MIN = 45;
export var SEUIL_PERIME_MIN = 90;

/* Combien de pages de match l'application s'autorise à lire par passe de rattrapage.
   Avec le script utilisateur, elle lit en direct, depuis l'adresse de l'utilisateur —
   celle qui passe là où le centre de données de GitHub est refusé. Sans lui, chaque page
   part par un proxy CORS public : c'est lent et souvent refusé, donc on en tente peu,
   plutôt que d'attendre trente fois pour rien. */
export var CIBLES_AVEC_PONT = 12;
export var CIBLES_SANS_PONT = 4;

/* Deux passes de rattrapage ne se suivent pas de moins de cinq minutes : les sites
   publient leurs liens dans l'heure qui précède le coup d'envoi, pas à la seconde. */
export var INTERVALLE_RATTRAPAGE_MS = 5 * 60 * 1000;

/* L'état du cache serveur, en un mot.

     'absent'  : illisible (deux essais en échec) — l'application est seule ;
     'perime'  : plus vieux que `seuilPerime` — le workflow ne publie plus ;
     'vieux'   : un passage manqué, pas encore une panne ;
     'ok'      : rien à dire.

   `info` est `window.prefetchedStreamsInfo` ({ ageMin, count }) ; `erreur` dit si la
   dernière lecture a échoué. Un cache lu mais VIDE compte comme absent : il ne porte
   aucun lien, quelle que soit sa fraîcheur. */
export function etatCacheServeur(info, opts) {
    var o = opts || {};
    var seuilVieux = typeof o.seuilVieux === 'number' ? o.seuilVieux : SEUIL_VIEUX_MIN;
    var seuilPerime = typeof o.seuilPerime === 'number' ? o.seuilPerime : SEUIL_PERIME_MIN;
    if (o.erreur) return { niveau: 'absent', ageMin: (info && info.ageMin) || null };
    if (!info || !info.count) return { niveau: 'absent', ageMin: (info && info.ageMin) || null };
    var age = info.ageMin;
    if (typeof age !== 'number' || !isFinite(age) || age < 0) return { niveau: 'ok', ageMin: null };
    if (age >= seuilPerime) return { niveau: 'perime', ageMin: age };
    if (age >= seuilVieux) return { niveau: 'vieux', ageMin: age };
    return { niveau: 'ok', ageMin: age };
}

/* Faut-il que l'application cherche elle-même ? Seulement quand le serveur ne fournit
   plus : un cache vieux d'une heure reste meilleur que ce qu'un téléphone peut lire par
   proxy. */
export function rattrapageNecessaire(etat) {
    return !!etat && (etat.niveau === 'perime' || etat.niveau === 'absent');
}

/* « 2 h 15 », « 45 min » : l'âge dit en clair, parce que « 135 min » ne se lit pas. */
export function ageEnClair(ageMin) {
    if (typeof ageMin !== 'number' || !isFinite(ageMin) || ageMin < 0) return '';
    if (ageMin < 60) return Math.round(ageMin) + ' min';
    var h = Math.floor(ageMin / 60);
    var mn = Math.round(ageMin % 60);
    return mn ? (h + ' h ' + (mn < 10 ? '0' : '') + mn) : (h + ' h');
}

/* Les matchs dont l'application va lire la page elle-même.

   Ce qu'on garde : ce qu'on peut REGARDER maintenant (en direct, ou coup d'envoi dans
   l'heure) et qui n'a AUCUN lien utile — le rattrapage comble des trous, il ne double
   pas ce qui est déjà pourvu. Il faut aussi une page à lire (`matchUrl`) que l'hôte ne
   refuse pas systématiquement.

   L'ordre est l'urgence : en direct d'abord, puis par proximité du coup d'envoi, puis
   par identifiant pour que deux passes voient la même liste. Borné à `max` : la passe
   doit finir avant que le match ne soit fini.

   Prédicats injectés : `estEnDirect`, `bientot`, `aDesLiens`, `pageBloquee`,
   `minutesAvant`. Aucun n'est obligatoire — à défaut, le statut du match sert de repli. */
export function ciblesDeRattrapage(matches, opts) {
    var o = opts || {};
    var max = typeof o.max === 'number' ? o.max : CIBLES_SANS_PONT;
    if (max <= 0) return [];
    var gardees = [];
    var liste = Array.isArray(matches) ? matches : [];
    for (var i = 0; i < liste.length; i++) {
        var m = liste[i];
        if (!m || !m.matchUrl) continue;
        if (m.status === 'finished' || m._finPresumee) continue;
        if (typeof o.pageBloquee === 'function' && o.pageBloquee(m.matchUrl)) continue;
        if (typeof o.aDesLiens === 'function' ? o.aDesLiens(m) : !!(m.streamLinks && m.streamLinks.length)) continue;
        var direct = typeof o.estEnDirect === 'function' ? !!o.estEnDirect(m) : m.status === 'live';
        var proche = typeof o.bientot === 'function' ? !!o.bientot(m) : false;
        if (!direct && !proche) continue;
        var minutes = typeof o.minutesAvant === 'function' ? o.minutesAvant(m) : 0;
        gardees.push({ m: m, rang: direct ? 0 : 1, minutes: (typeof minutes === 'number' && isFinite(minutes)) ? minutes : 9999 });
    }
    gardees.sort(function(a, b) {
        if (a.rang !== b.rang) return a.rang - b.rang;
        if (a.minutes !== b.minutes) return a.minutes - b.minutes;
        return String(a.m.id) < String(b.m.id) ? -1 : (String(a.m.id) > String(b.m.id) ? 1 : 0);
    });
    return gardees.slice(0, max).map(function(x) { return x.m; });
}

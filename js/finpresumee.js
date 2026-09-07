/* ══ FIN PRÉSUMÉE D'UN MATCH ═══════════════════════════════════════════════════════

   Demande du 7 septembre 2026 : « des matchs qui n'arrêtent pas même si finaux sur
   ESPN, c'est normal ? » — puis : « ça continue sauf si indication de ESPN de extra
   innings ou périodes ? ».

   Un match ne passe à « Fin » que quand ESPN le dit. Quand les requêtes vers ESPN
   échouent — réseau cellulaire, tunnel, onglet gelé — rien ne le dit, et la carte reste
   « DIRECT » des heures. Ce module pose une règle de bon sens, en second rideau :

     - ESPN qui parle a toujours raison. Si ce match a reçu une mise à jour de score
       il y a moins de FRAICHEUR_SCORES_MS, on ne présume rien : un match en manches
       supplémentaires ou en prolongation dure ce qu'il dure.
     - Sans nouvelle depuis plus longtemps, passé la durée normale de son sport plus une
       marge, le match est présumé fini : « Fin ? » sur la carte, et il quitte le Live.
     - Si la DERNIÈRE nouvelle d'ESPN disait déjà « manches supplémentaires » ou
       « prolongation » (période au-delà du règlement, ou libellé OT / extra / shootout),
       la marge est bien plus large : on sait que ça s'éternise.

   Module sans import (comme js/playability.js) : le temps écoulé et la durée normale
   sont fournis par l'appelant (js/config.js), qui sait lire startTime et la ligue. */

export var FRAICHEUR_SCORES_MS = 12 * 60 * 1000;
export var MARGE_FIN_MIN = 45;
export var MARGE_PROLONGATION_MIN = 120;

/* Nombre de périodes du temps réglementaire, d'après le nom de la ligue ; null si on ne
   sait pas (course, catch, esport…). */
export function periodesReglementaires(league) {
    var l = String(league || '').toLowerCase();
    if (!l) return null;
    if (/mlb|baseball|npb|kbo/.test(l)) return 9;
    if (/nhl|hockey|pwhl|lhjmq|qmjhl|ahl|liiga|shl|khl/.test(l)) return 3;
    if (/nba|wnba|basket|ncaab|euroleague/.test(l)) return 4;
    if (/nfl|cfl|ncaaf|ncaa football|american football|college football/.test(l)) return 4;
    if (/soccer|premier|liga|serie a|bundesliga|ligue 1|mls|uefa|champions|europa|eredivisie|primeira|süper|super lig|world cup|copa|fifa|conmebol|concacaf|nwsl|usl/.test(l)) return 2;
    return null;
}

/* La dernière nouvelle d'ESPN dit-elle que le match est au-delà du temps réglementaire ? */
export function enProlongation(m) {
    if (!m) return false;
    var detail = String(m.detail || '') + ' ' + String(m.minute || '');
    if (/\b(OT|\d?OT|overtime|prolongation|extra|shootout|tirs au but|S\/O|penalt)/i.test(detail)) return true;
    var reg = periodesReglementaires(m.league);
    var p = parseInt(m.period, 10);
    if (reg && !isNaN(p) && p > reg) return true;
    if (reg === 9) {
        var manche = /(\d{1,2})(?:st|nd|rd|th|e)\b/i.exec(detail);
        if (manche && parseInt(manche[1], 10) > 9) return true;
    }
    return false;
}

/* `ecouleMin` : minutes depuis le coup d'envoi ; `dureeMin` : durée normale du sport.
   `now` : instant de référence (Date ou nombre), pour comparer à `m._scoreAt`. */
export function finPresumee(m, ecouleMin, dureeMin, now) {
    if (!m || m.status !== 'live') return false;
    if (typeof ecouleMin !== 'number' || isNaN(ecouleMin)) return false;
    var t = now ? +now : Date.now();
    if (m._scoreAt && t - m._scoreAt < FRAICHEUR_SCORES_MS) return false;
    var marge = enProlongation(m) ? MARGE_PROLONGATION_MIN : MARGE_FIN_MIN;
    return ecouleMin > (dureeMin || 180) + marge;
}

/* Texte d'explication pour l'infobulle de « Fin ? ». */
export function raisonFinPresumee(m, ecouleMin, dureeMin, now) {
    var t = now ? +now : Date.now();
    var depuis = m && m._scoreAt ? Math.round((t - m._scoreAt) / 60000) : null;
    var d = dureeMin || 180;
    return 'Présumé terminé : ' + (depuis === null ? 'aucune nouvelle d\'ESPN' : 'aucune nouvelle d\'ESPN depuis ' + depuis + ' min')
        + ', et ' + Math.round(ecouleMin) + ' min écoulées pour une durée normale de ' + Math.round(d) + ' min'
        + (enProlongation(m) ? ' (prolongation connue, marge élargie)' : '') + '.';
}

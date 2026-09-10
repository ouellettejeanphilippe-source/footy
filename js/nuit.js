/* ══ LA NUIT APPARTIENT À LA VEILLE ═══════════════════════════════════════════════

   Demande du 8 septembre 2026 : « Ya des matchs qui finissent dans la nuit. »

   Un match porte la date de son coup d'envoi (`matchDate`, jour civil de New York),
   et l'application ne montrait que les matchs dont la date est celle du jour :
   `m.matchDate === aujourd'hui`, à cinq endroits. À 00:30, un match de base-ball
   commencé à 22:05 est en septième manche ; mais « aujourd'hui » vient de changer, et
   il n'est plus nulle part — ni dans la grille (qui recommence à 00:00), ni dans le
   Live, ni dans les scores (ESPN n'est relu que pour la date du jour), ni dans les
   liens (le cache serveur est filtré sur la même date). Le seul cas qui marchait
   encore était l'onglet ouvert depuis le soir, tant qu'on ne le rechargeait pas.

   La règle : un match commencé hier qui déborde sur cette nuit (coup d'envoi plus
   durée normale du sport au-delà de minuit) fait partie de la journée d'aujourd'hui,
   comme dans un guide télé où l'émission de 22:05 est encore à l'antenne à 00:00.

     - `appartientAuJour(m, jour)` remplace les cinq comparaisons de date.
     - `nuitEnCours(minutes)` dit si on est encore dans la nuit (avant 06:00) : c'est
       seulement là que l'API relit la veille, pour n'en garder que ce qui déborde.
     - Dans la grille, un tel match est dessiné à 00:00, sur ce qui lui reste
       (`minutesDansLaJournee` rend un départ négatif, que l'appelant tronque).
     - Un flux relu après minuit par le serveur porte la date du jour alors que le
       match est d'hier soir : `memeMatchATraversLaNuit` laisse l'appariement passer
       quand les dates se suivent et que l'heure de coup d'envoi est la même.

   Module sans import (comme js/finpresumee.js) : lisible par le serveur
   (scripts/scrape_schedule.mjs) comme par le navigateur. Les dates sont des chaînes
   « YYYY-MM-DD » du fuseau America/New_York ; la veille se calcule en jours entiers
   UTC, sans que l'heure d'été n'intervienne. */

/* Jusqu'à cette minute du jour, un match d'hier soir peut encore être en cours :
   22:05 + 3 h de base-ball + manches supplémentaires, ou 23:00 sur la côte ouest
   avec prolongation. Au-delà, la veille n'est plus relue. */
export var NUIT_FIN_MIN = 6 * 60;

/* Durée retenue quand le match n'en porte pas. La large sert aux flux du cache
   serveur, qui n'ont pas de durée : mieux vaut retenir un lien de trop qu'en perdre. */
export var DUREE_DEFAUT_MIN = 120;
export var DUREE_LARGE_MIN = 240;

/* « HH:MM » → minutes depuis minuit, ou null si absent ou illisible. */
export function minutesDeLHeure(startTime) {
    var t = /^(\d{1,2}):(\d{2})$/.exec(String(startTime || '').trim());
    if (!t) return null;
    var h = parseInt(t[1], 10), mn = parseInt(t[2], 10);
    if (h > 23 || mn > 59) return null;
    return h * 60 + mn;
}

function decalerJour(jour, jours) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(jour || ''))) return null;
    var t = Date.parse(jour + 'T00:00:00Z');
    if (isNaN(t)) return null;
    return new Date(t + jours * 86400000).toISOString().slice(0, 10);
}

export function veille(jour) { return decalerJour(jour, -1); }
export function lendemain(jour) { return decalerJour(jour, 1); }

/* Le match déborde-t-il sur la nuit : coup d'envoi plus durée au-delà de minuit ? */
export function debordeSurLaNuit(m, dureeDefaut) {
    var debut = minutesDeLHeure(m && m.startTime);
    if (debut === null) return false;
    var duree = (m && m.durationMinutes) || dureeDefaut || DUREE_DEFAUT_MIN;
    return debut + duree > 1440;
}

/* Le match fait-il partie de la journée `jour` : daté de ce jour, ou d'hier et
   débordant sur cette nuit ? */
export function appartientAuJour(m, jour, dureeDefaut) {
    if (!m || !jour) return false;
    if (m.matchDate === jour) return true;
    if (!m.matchDate) return false;
    return m.matchDate === veille(jour) && debordeSurLaNuit(m, dureeDefaut);
}

/* Est-on encore dans la nuit, à `minutesDepuisMinuit` (heure de New York) ? */
export function nuitEnCours(minutesDepuisMinuit) {
    return typeof minutesDepuisMinuit === 'number' && minutesDepuisMinuit >= 0 && minutesDepuisMinuit < NUIT_FIN_MIN;
}

/* Minutes du coup d'envoi comptées depuis le minuit de `jour` : négatif pour un match
   d'hier soir (« 22:05 » la veille vaut −115), null si l'heure est illisible. C'est la
   clé de tri et de position dans la grille : un match d'hier passe avant ceux de
   00:00, et sa case commence au bord gauche. */
export function minutesDansLaJournee(m, jour) {
    var debut = minutesDeLHeure(m && m.startTime);
    if (debut === null) return null;
    if (jour && m.matchDate && m.matchDate !== jour) {
        var veilleJour = veille(jour);
        if (m.matchDate === veilleJour) return debut - 1440;
        if (m.matchDate === lendemain(jour)) return debut + 1440;
    }
    return debut;
}

/* « hier » pour un match de la veille vu depuis `jour`, « demain » pour un match du
   lendemain, rien sinon. La case d'un match d'hier soir affichait « 22:05 » sans le
   dire ; à 00:30, on lisait un coup d'envoi dans vingt-deux heures. */
export function libelleJour(m, jour) {
    if (!m || !jour || !m.matchDate || m.matchDate === jour) return '';
    if (m.matchDate === veille(jour)) return 'hier';
    if (m.matchDate === lendemain(jour)) return 'demain';
    return '';
}

/* Comparateur d'heures pour les tris de cartes : ce qui n'a pas d'heure va à la fin. */
export function comparerHeures(a, b, jour) {
    var ma = minutesDansLaJournee(a, jour), mb = minutesDansLaJournee(b, jour);
    if (ma === null && mb === null) return 0;
    if (ma === null) return 1;
    if (mb === null) return -1;
    return ma - mb;
}

/* Deux entrées datées de jours consécutifs décrivent-elles le même match, relu après
   minuit ? Le serveur date du jour les flux dont la source ne dit pas la date ; à
   00:30 le match de 22:05 d'hier y apparaît daté d'aujourd'hui. On l'accepte si le
   match d'hier déborde sur la nuit et que l'heure de coup d'envoi est la même — ou
   inconnue (« 00:00 » est ce que posent les parseurs qui n'ont rien trouvé). */
export function memeMatchATraversLaNuit(m1, m2) {
    if (!m1 || !m2 || !m1.matchDate || !m2.matchDate || m1.matchDate === m2.matchDate) return false;
    var avant = m1.matchDate < m2.matchDate ? m1 : m2;
    var apres = avant === m1 ? m2 : m1;
    if (lendemain(avant.matchDate) !== apres.matchDate) return false;
    if (!debordeSurLaNuit(avant, DUREE_LARGE_MIN)) return false;
    var hAvant = minutesDeLHeure(avant.startTime), hApres = minutesDeLHeure(apres.startTime);
    return hApres === null || hApres === 0 || hAvant === hApres;
}

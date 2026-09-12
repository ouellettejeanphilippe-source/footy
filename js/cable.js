/* Mode câble : zapper le lecteur comme on zappait la télévision.

   « Mode bonus style câble : le swipe vertical change le match qui joue, le swipe
   horizontal change le stream. » Deux gestes, deux axes, et rien à apprendre :

     ↑ / ↓   chaîne suivante / précédente — un autre MATCH, celui d'à côté dans la liste
             des matchs en direct qui ont au moins un lien ;
     ← / →   source suivante / précédente — le MÊME match, un autre flux.

   Ce module ne connaît ni le DOM ni le reste de l'application : il ne fait que lire un
   geste, ranger les chaînes et désigner la voisine. C'est `js/multiview.js` qui pose la
   surface qui écoute, remplace le contenu de la tuile et affiche l'incrustation. Sans
   import, donc testable seul (règle des modules spécialisés, AGENTS.md). */

/* ── Lecture du geste ────────────────────────────────────────────────────────

   Trois garde-fous, tous nécessaires sur un téléphone tenu d'une main :

   - `SEUIL_PX` : sous 48 px, c'est un appui qui a bougé, pas un geste. Zapper sur un
     tremblement serait pire que ne pas zapper du tout, parce qu'on perdrait le match
     qu'on regardait.
   - `DOMINANCE` : un doigt ne trace pas droit. Un axe doit l'emporter d'une fois et
     demie sur l'autre, faute de quoi le geste est refusé plutôt que deviné — une
     diagonale interprétée « vertical » change de match quand on voulait changer de flux.
   - `DUREE_MAX_MS` : au-delà d'une seconde, le doigt traîne (on lit le décor de la page,
     on hésite). Ce n'est plus un geste de zapping. */
export var SEUIL_PX = 48;
export var DOMINANCE = 1.5;
export var DUREE_MAX_MS = 1000;

/* Rend 'haut', 'bas', 'gauche', 'droite', ou null si ce n'était pas un geste.
   `opts` permet d'assouplir les seuils (tests, réglage ultérieur). */
export function detecterGeste(dx, dy, dt, opts) {
    var o = opts || {};
    var seuil = typeof o.seuil === 'number' ? o.seuil : SEUIL_PX;
    var dominance = typeof o.dominance === 'number' ? o.dominance : DOMINANCE;
    var dureeMax = typeof o.dureeMax === 'number' ? o.dureeMax : DUREE_MAX_MS;
    if (typeof dx !== 'number' || typeof dy !== 'number' || !isFinite(dx) || !isFinite(dy)) return null;
    if (typeof dt === 'number' && isFinite(dt) && dt > dureeMax) return null;
    var ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax >= seuil && ax >= ay * dominance) return dx < 0 ? 'gauche' : 'droite';
    if (ay >= seuil && ay >= ax * dominance) return dy < 0 ? 'haut' : 'bas';
    return null;
}

/* Ce que le geste demande : { axe: 'chaine' | 'source', sens: +1 | -1 }.

   Le sens vertical suit le zapping des télécommandes et des applications de flux
   verticaux : vers le HAUT fait monter d'une chaîne. Le sens horizontal suit la lecture :
   vers la GAUCHE avance (source suivante), comme on pousse une page pour voir la
   suivante. */
export function actionDuGeste(direction) {
    if (direction === 'haut') return { axe: 'chaine', sens: 1 };
    if (direction === 'bas') return { axe: 'chaine', sens: -1 };
    if (direction === 'gauche') return { axe: 'source', sens: 1 };
    if (direction === 'droite') return { axe: 'source', sens: -1 };
    return null;
}

/* ── Les chaînes ─────────────────────────────────────────────────────────────

   Une chaîne, c'est un match qu'on peut REGARDER MAINTENANT : en direct (ou sur le point
   de l'être) et pourvu d'au moins un lien. Un match sans lien n'est pas une chaîne : le
   zapping tomberait sur un écran noir, ce qui est exactement ce qu'un mode « câble » ne
   doit pas faire.

   Les prédicats viennent de l'appelant (`estEnDirect`, `bientot` : `isLiveNow` et
   `startsWithin` de js/config.js) pour que ce module reste sans import. À défaut, le
   statut du match sert de repli. */
export function aUnLien(m, opts) {
    var L = (m && m.streamLinks) || [];
    var filtre = opts && typeof opts.lienOk === 'function' ? opts.lienOk : null;
    for (var i = 0; i < L.length; i++) {
        if (!L[i] || !L[i].url) continue;
        if (filtre && !filtre(L[i])) continue;
        return true;
    }
    return false;
}

export function estChaine(m, opts) {
    if (!m || !aUnLien(m, opts)) return false;
    var o = opts || {};
    if (m.status === 'finished' || m._finPresumee) return false;
    var direct = typeof o.estEnDirect === 'function' ? !!o.estEnDirect(m) : m.status === 'live';
    var proche = typeof o.bientot === 'function' ? !!o.bientot(m) : false;
    return direct || proche;
}

/* ── Ce qui peut JOUER, et ce qui joue TOUT SEUL ──────────────────────────────

   « Un seul vidéo, avec aucun blocage, lecture automatique des lecteurs »
   (12 septembre 2026). Un mode qui zappe doit toujours montrer quelque chose : la
   chaîne d'à côté ne peut pas être un écran de refus du navigateur, ni une page qui
   attend un clic qu'on ne sait pas où donner.

   Deux règles, et elles viennent des mesures que l'application a déjà sous la main :

   - `lienJouable` ÉCARTE ce dont on sait qu'il ne jouera pas ici : un lien dont l'hôte
     refuse d'être encadré (relevé par le serveur dans les en-têtes X-Frame-Options et
     CSP, versé dans le registre appris), un lien observé bloqué, une adresse qui a déjà
     fait sortir la page du lecteur. Ce ne sont pas des jugements de qualité — un lien
     lent ou médiocre reste une chaîne — mais des BLOCAGES constatés.
   - `liensCable` remonte devant les flux que l'application joue ELLE-MÊME : un `.m3u8`
     ou un `.mp4` va dans son propre `<video autoplay muted playsinline>`, donc démarre
     sans clic et sans script utilisateur. C'est la seule lecture automatique dont on ait
     la maîtrise ; pour les pages, on ne peut que demander au script installé.

   Les prédicats sont injectés (`estBloque`, `estMedia`, `score`), comme ceux du direct :
   ce module reste sans import. Sans eux, rien n'est écarté — le mode dégrade vers son
   comportement d'avant plutôt que de vider la liste des chaînes. */
export function lienJouable(lien, opts) {
    if (!lien || !lien.url) return false;
    var o = opts || {};
    if (lien.verified === 'blocked') return false;
    if (typeof o.estBloque === 'function' && o.estBloque(lien.url)) return false;
    if (typeof o.aFaitSortir === 'function' && o.aFaitSortir(lien.url)) return false;
    if (typeof o.score === 'function' && o.score(lien) < 0) return false;
    return true;
}

export function liensCable(liens, opts) {
    var o = opts || {};
    var gardes = (liens || []).filter(function(l) { return lienJouable(l, o); });
    if (typeof o.estMedia !== 'function') return gardes;
    /* Tri STABLE : on ne refait pas le classement de `sortFluxLinks` (préférences de
       l'utilisateur, jouabilité observée, qualité), on ne fait que remonter ce qui
       démarre tout seul. */
    var media = [], reste = [];
    gardes.forEach(function(l) { (o.estMedia(l.url) ? media : reste).push(l); });
    return media.concat(reste);
}

/* Ordre des chaînes : les matchs en cours d'abord, puis par heure de coup d'envoi, puis
   par ligue et par identifiant. Deux passages doivent rendre le même ordre, sinon la
   chaîne 3 n'est pas la même d'un geste à l'autre — d'où le tri complet jusqu'à
   l'identifiant, qui départage tout. */
export function comparerChaines(a, b, opts) {
    var o = opts || {};
    var direct = function(m) {
        return (typeof o.estEnDirect === 'function' ? !!o.estEnDirect(m) : m.status === 'live') ? 0 : 1;
    };
    var da = direct(a), db = direct(b);
    if (da !== db) return da - db;
    var ja = String(a.matchDate || ''), jb = String(b.matchDate || '');
    if (ja !== jb) return ja < jb ? -1 : 1;
    var ha = String(a.startTime || ''), hb = String(b.startTime || '');
    if (ha !== hb) return ha < hb ? -1 : 1;
    var la = String(a.league || ''), lb = String(b.league || '');
    if (la !== lb) return la < lb ? -1 : 1;
    return String(a.id) < String(b.id) ? -1 : (String(a.id) > String(b.id) ? 1 : 0);
}

export function chainesDisponibles(matches, opts) {
    var liste = Array.isArray(matches) ? matches : [];
    var gardees = [];
    for (var i = 0; i < liste.length; i++) { if (estChaine(liste[i], opts)) gardees.push(liste[i]); }
    return gardees.sort(function(a, b) { return comparerChaines(a, b, opts); });
}

export function indexDeChaine(chaines, mid) {
    var L = chaines || [];
    for (var i = 0; i < L.length; i++) { if (String(L[i].id) === String(mid)) return i; }
    return -1;
}

/* La chaîne voisine, en boucle. Si le match de la tuile n'est plus une chaîne (il vient
   de finir, ses liens ont disparu), on n'immobilise pas le zapping : on entre dans la
   liste par le bout que le geste désigne. */
export function chaineVoisine(chaines, mid, sens) {
    var L = chaines || [];
    if (!L.length) return null;
    var i = indexDeChaine(L, mid);
    if (i < 0) return sens >= 0 ? L[0] : L[L.length - 1];
    if (L.length < 2) return null;
    var pas = sens >= 0 ? 1 : -1;
    return L[(i + pas + L.length) % L.length];
}

/* Lien voisin dans une liste déjà classée, en boucle. Symétrique de `nextLinkAfter`
   (js/playability.js), dont il reprend le contrat, mais dans les deux sens : le geste
   horizontal se fait aussi à rebours, et revenir sur la source d'avant est la moitié de
   l'intérêt du geste. */
export function lienVoisin(liens, url, sens) {
    var L = (liens || []).filter(function(l) { return l && l.url; });
    if (L.length < 2) return null;
    var i = -1;
    for (var k = 0; k < L.length; k++) { if (L[k].url === url) { i = k; break; } }
    var pas = sens >= 0 ? 1 : -1;
    if (i < 0) return sens >= 0 ? L[0] : L[L.length - 1];
    return L[(i + pas + L.length) % L.length];
}

/* ── L'incrustation ──────────────────────────────────────────────────────────

   Ce que le décodeur affichait en bas de l'écran pendant deux secondes : le numéro de la
   chaîne, ce qui passe dessus, et — ici — la source utilisée, parce que c'est l'autre
   axe du geste et qu'on ne peut pas le lire autrement. Rendu en données ({ numero,
   titre, details }) pour que la mise en forme reste au lecteur. */
export function etiquetteChaine(m, position, total, source) {
    var titre = m ? [m.homeTeam, m.awayTeam].filter(Boolean).join(' – ') : '';
    if (!titre && m) titre = m.name || m.league || '';
    var details = [];
    if (m && m.league) details.push(m.league);
    if (m && m.status === 'live' && Array.isArray(m.score) && m.score.length === 2) {
        details.push(m.score[0] + ' - ' + m.score[1] + (m.minute ? ' · ' + m.minute : ''));
    } else if (m && m.startTime) {
        details.push(m.startTime);
    }
    if (source && source.n > 1) details.push('source ' + source.k + '/' + source.n);
    return {
        numero: (position > 0 && total > 0) ? ('CH ' + position + '/' + total) : '',
        titre: titre,
        details: details.join(' · ')
    };
}

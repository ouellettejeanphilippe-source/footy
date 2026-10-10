/* La liste de l'appli Android TV (`tv/`) : data/tv.json.

   « Mon rêve, c'est une version qui peut marcher sur Chromecast, sans les pubs, en
   prenant le moins de ressources possible » (10 octobre 2026). Sur un Chromecast avec
   Google TV, le moins cher est de ne charger AUCUNE page : le lecteur natif d'Android
   (ExoPlayer, décodage matériel) lit le manifeste HLS que la vérification a vu passer
   (`media`, scripts/verify_players.mjs). Pas de page, donc pas de régie.

   Ce fichier est ce que la télé télécharge. data/streams.json pèse 2,6 Mo et décrit 1 600
   matchs, dont une cinquantaine ont un flux direct : on n'en garde que ceux-là, avec ce
   qu'il faut pour les jouer et rien d'autre. Quelques kilo-octets, lus en une fraction
   de seconde par un appareil de 2 Go de mémoire.

   `referer` est la page qui a demandé le manifeste pendant la vérification : le cadre
   IMBRIQUÉ du lecteur, presque jamais la page du lien. Mesuré le 10 octobre 2026 sur
   instreams.pro (lien freestreams) : 200 avec ce cadre (xstream.st), 200 sans rien, 403
   avec la page du lien. L'appli essaie donc ce cadre, puis rien, puis la page
   (tv/README.md). Vide quand la vérification ne l'a pas vu.

   Seuls les manifestes HLS (.m3u8) sont gardés : l'appli n'embarque pas le module DASH,
   et aucun .mpd n'a été observé à ce jour.

   Module sans import, sauf js/directmedia.js qui en est un aussi. */

import { dureeDeVie } from './directmedia.js';

export var VERSION_LISTE_TV = 1;

function stamp(s) {
    var t = s ? Date.parse(s) : NaN;
    return isNaN(t) ? 0 : t;
}

/* Les liens jouables d'un match, du plus récemment vu au plus ancien : une adresse
   fraîche a plus de chances de répondre encore. Les adresses périmées tombent, au même
   rythme que dans le mode direct (adresse signée : 3 h, nue : 12 h). */
export function liensTv(match, now) {
    var t = now === undefined ? Date.now() : now;
    var vus = {};
    var liens = [];
    ((match && match.streamLinks) || []).forEach(function (l) {
        if (!l || !l.media || l.verified !== 'plays' || vus[l.media]) return;
        if (!/\.m3u8$/i.test(String(l.media).split('#')[0].split('?')[0])) return;
        var at = stamp(l.mediaAt);
        if (!at || t - at > dureeDeVie(l.media) || at - t > 5 * 60 * 1000) return;
        vus[l.media] = true;
        liens.push({
            nom: String(l.name || l.site || l.source || 'Flux'),
            source: String(l.source || ''),
            media: l.media,
            referer: String(l.mediaReferer || ''),
            page: String(l.url || ''),
            vu: l.mediaAt
        });
    });
    liens.sort(function (a, b) { return stamp(b.vu) - stamp(a.vu); });
    return liens;
}

function rangStatut(s) { return s === 'live' ? 0 : 1; }

export function listeTv(data, options) {
    var o = options || {};
    var now = o.now === undefined ? Date.now() : o.now;
    var matchs = [];
    (((data && data.matches) || [])).forEach(function (m) {
        if (!m || m.status === 'finished') return;
        var liens = liensTv(m, now);
        if (!liens.length) return;
        matchs.push({
            ligue: String(m.league || ''),
            domicile: String(m.homeTeam || ''),
            exterieur: String(m.awayTeam || ''),
            date: String(m.matchDate || ''),
            heure: String(m.startTime || ''),
            statut: String(m.status || 'upcoming'),
            liens: liens
        });
    });
    matchs.sort(function (a, b) {
        return rangStatut(a.statut) - rangStatut(b.statut)
            || (a.date + a.heure).localeCompare(b.date + b.heure)
            || a.ligue.localeCompare(b.ligue);
    });
    return {
        version: VERSION_LISTE_TV,
        generee: new Date(now).toISOString(),
        // L'agent de la vérification : celui sous lequel les adresses ont été obtenues.
        agent: String(o.agent || ''),
        matchs: matchs
    };
}

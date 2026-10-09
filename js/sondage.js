/* Sondage d'un domaine (scripts/sonder_domaine.mjs) : les décisions, sans réseau.

   « Créer un outil qui permet de trouver facilement les liens quand on a un nouveau
   domaine » (9 octobre 2026). Le script fait les requêtes ; ce module décide à quelle
   source un domaine ressemble, quelle lecture l'emporte, et comment l'inscrire dans
   domains.json. Sans import, comme les autres modules spécialisés : testable sans DOM. */

/* « streamed.st », « https://streamed.st », « streamed.st/home » → adresse complète. */
export function normaliserAdresse(brut) {
    var s = String(brut || '').trim();
    if (!s) return '';
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    try {
        var u = new URL(s);
        if (!/^https?:$/.test(u.protocol) || !u.hostname || u.hostname.indexOf('.') < 0) return '';
        return u.href;
    } catch (e) { return ''; }
}

/* Le nom d'un site sans ses préfixes de miroir ni son domaine de premier niveau :
   « v5.gostreameast.link » → « gostreameast », « ww1.sportsurge.st » → « sportsurge ». */
export function nomDuSite(hote) {
    var parts = String(hote || '').toLowerCase().replace(/^(www\d*|ww\d+|v\d+|app|m)\./, '').split('.');
    if (parts.length < 2) return parts[0] || '';
    return parts[parts.length - 2];
}

/* Sources dont l'identifiant apparaît dans le nom du site : « methstreams.st » ressemble à
   methstreams, « gostreameast » à streameast. Le plus long identifiant d'abord : un nom
   qui contient « streameast » ne doit pas être pris pour « streamed » (préfixe commun),
   et ne l'est pas puisque « streamed » n'y figure pas — mais l'ordre départage les cas
   où deux identifiants s'y trouvent. */
export function devinerSources(hote, ids) {
    var nom = nomDuSite(hote);
    if (!nom) return [];
    return (ids || []).filter(function (id) { return id && nom.indexOf(String(id).toLowerCase()) >= 0; })
        .sort(function (a, b) { return b.length - a.length; });
}

/* Adresse à essayer pour une source sur un nouveau domaine : le chemin de l'adresse en
   service est gardé quand on n'en a pas donné (vipleague vit sur /watch-now, buffstreams
   sur /indexcracked29). */
export function adressePourSource(donnee, adresseActuelle) {
    var u, a;
    try { u = new URL(donnee); } catch (e) { return donnee; }
    if (u.pathname !== '/' || u.search) return u.href;
    try { a = new URL(adresseActuelle); } catch (e) { return u.href; }
    return u.origin + a.pathname + a.search;
}

/* La meilleure lecture d'une page : un parseur dédié bat le repli générique (il connaît
   le gabarit), puis le plus de matchs. Rend null si aucune ne livre rien. */
export function meilleureLecture(resultats) {
    var L = (resultats || []).filter(function (r) { return r && (r.matchs | 0) > 0; });
    if (!L.length) return null;
    L.sort(function (a, b) {
        if (!!a.generique !== !!b.generique) return a.generique ? 1 : -1;
        return (b.matchs | 0) - (a.matchs | 0);
    });
    return L[0];
}

/* Liens d'une page de match regroupés par hôte, le plus fourni d'abord, avec ce que le
   registre de jouabilité en sait (`ledger`, celui de data/streams.json). */
export function resumerLiens(liens, ledger) {
    var parHote = {};
    (liens || []).forEach(function (l) {
        if (!l || !l.url) return;
        var h;
        try { h = new URL(l.url).hostname.replace(/^www\./, ''); } catch (e) { return; }
        var r = parHote[h] || (parHote[h] = { hote: h, liens: 0, onglet: 0, registre: null });
        r.liens++;
        if (l.topLevel) r.onglet++;
    });
    return Object.keys(parHote).map(function (h) {
        var e = ledger && ledger[h];
        if (e && (e.tested | 0) > 0) parHote[h].registre = (e.plays | 0) + '/' + (e.tested | 0);
        return parHote[h];
    }).sort(function (a, b) { return b.liens - a.liens || (a.hote < b.hote ? -1 : 1); });
}

/* domains.json avec `adresse` ajoutée aux miroirs de la source `id`, en DERNIER : un
   miroir ajouté à la main n'a encore rien prouvé, le script serveur le promouvra s'il
   livre des matchs (shouldPromoteSource). L'adresse en service n'est pas touchée. Rend
   un nouvel objet ; `ajoute` dit si quelque chose a changé.

   `parDefaut` : les miroirs en dur (SOURCE_MIRRORS) quand domains.json n'en déclare pas
   pour cette source. La clé MIRRORS d'une source REMPLACE sa liste en dur : l'écrire avec
   la seule nouvelle adresse ferait oublier les autres. */
export function ajouterMiroir(domains, id, adresse, parDefaut) {
    var d = JSON.parse(JSON.stringify(domains || {}));
    if (!id || !adresse) return { domains: d, ajoute: false };
    d.MIRRORS = d.MIRRORS || {};
    var liste = Array.isArray(d.MIRRORS[id]) ? d.MIRRORS[id] : (Array.isArray(parDefaut) ? parDefaut.slice() : []);
    if (liste.indexOf(adresse) >= 0) return { domains: d, ajoute: false };
    d.MIRRORS[id] = liste.concat([adresse]);
    return { domains: d, ajoute: true };
}

/* Les matchs d'une lecture qui vivent VRAIMENT sur le domaine sondé. Un parseur appliqué
   à un site qui n'est pas le sien peut fabriquer des adresses chez lui : celui d'OnHockey,
   lancé sur ntv.cx, rendait sept « matchs » pointant tous vers onhockey.tv. Comparés par
   nom de site (`nomDuSite`), pour qu'un miroir qui redirige (vipleague.me → .vg) compte. */
export function matchsDuDomaine(liste, hote) {
    var nom = nomDuSite(hote);
    return (liste || []).filter(function (m) {
        if (!m || !m.matchUrl) return false;
        try { return nomDuSite(new URL(m.matchUrl).hostname) === nom; } catch (e) { return false; }
    });
}

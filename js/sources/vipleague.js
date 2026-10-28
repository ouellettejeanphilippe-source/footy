/* VIPLeague : lecture d'une page de match.

   Un fichier par domaine — voir js/sources/index.js pour le contrat.

   Le lecteur lui-même n'est pas dans le HTML : un script (embed.min.js) le monte en
   JavaScript avec un jeton CSRF et une signature liés à l'adresse IP de celui qui charge la
   page, valables une minute. Aucun lecteur ne s'extrait donc, et aucun ne serait bon pour un
   autre appareil. Mais la page ANNONCE ses serveurs, comme Liveleagues et Olympicweb (même
   moteur) :

     <a class="btn stream-dropdown-item" data-uri="/view-live/football/ceara-vs-goias-link-1">Video 1</a>
     <a class="btn stream-dropdown-item" data-uri="/view-live/football/ceara-vs-goias-link-2">Video 2</a>

   Chaque `link-N` est une page du site qui monte le lecteur d'un autre serveur (`pid` 4 puis
   3 sur l'exemple) ; elle se laisse encadrer (relevé le 27 octobre 2026 : le cadre reste en
   place, le lecteur `dervlin.me/sd0embed` s'y charge). On garde ces pages : la tuile les
   charge, et le jeton est frais pour qui regarde.

   Avant, l'adaptateur n'apportait qu'un filtre (« le HTML ne contient que des publicités »)
   et la page de match rendait un seul « lien » : l'onglet de navigation « Live Games »
   (/watch-now). Les 12 matchs VIPLeague du cache du 27 octobre n'avaient que ça.

   Les deux points d'entrée du contrat sont utilisés : `extraireLiens` pour les serveurs,
   `filtrerLiens` pour écarter ce que le moteur générique ramasse d'autre (publicités, onglets
   du site, `/vl`, `/watch-now`). */

export var hotes = ['vipleague'];

/* Ses serveurs sont les seules diffusions de la page : le reste (navigation, régie) n'est
   pas gardé — voir `seulementSesLiens`, js/sources/index.js. */
export var seulementSesLiens = true;

var SERVEUR_RE = /\/view-live\/[^?#]+-link-(\d+)\/?$/i;

export function extraireLiens(ctx) {
    var doc = ctx.doc, m = ctx.match;
    var origine = '';
    try { origine = new URL(m.matchUrl).origin; } catch (e) {}
    var liens = [];
    var noeuds = doc ? doc.querySelectorAll('[data-uri]') : [];
    [].forEach.call(noeuds, function(b) {
        var uri = (b.getAttribute('data-uri') || '').trim();
        if (!uri || !SERVEUR_RE.test(uri.split('?')[0])) return;
        var url = /^https?:\/\//i.test(uri) ? uri : (origine + (uri.charAt(0) === '/' ? '' : '/') + uri);
        if (liens.some(function(l) { return l.url === url; })) return;
        var numero = SERVEUR_RE.exec(uri.split('?')[0])[1];
        liens.push({
            name: (b.textContent || '').replace(/\s+/g, ' ').trim() || ('Video ' + numero),
            quality: '',
            lang: 'MULTI',
            url: url,
            icon: '📺',
            scrapeContext: { blockText: (b.textContent || '').trim(), pageText: ctx.pageText || '', pageLink: m.matchUrl, allLinks: ctx.pageLiens || [] }
        });
    });
    return liens;
}

export function filtrerLiens(liens) {
    return (liens || []).filter(function (l) {
        return l && l.url && /vipleague/i.test(l.url) && !/\/(vl|watch-now)\/?$/.test(l.url.split('?')[0]);
    });
}

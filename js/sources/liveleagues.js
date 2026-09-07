/* Liveleagues : lecture d'une page de match.

   Un fichier par domaine — voir js/sources/index.js pour le contrat.

   Même moteur que VIPLeague, mais ce domaine-ci ANNONCE ses diffusions dans le HTML :
     <a class="btn btn-link" data-uri="/fiba/nigeria-w-vs-france-w-1-live-streaming" data-open="_self">
        Broadcast 1 <span class="badge ...">HD</span></a>
   Ce sont des pages du site (le lecteur y est monté en JavaScript), pas des lecteurs
   nus ; elles se servent sans en-tête X-Frame-Options (relevé le 7 septembre 2026), donc
   se laissent encadrer. L'attribut est `data-uri`, pas `href` : le moteur générique ne
   les voyait pas. Le même bloc est répété deux fois (version large, menu déroulant
   mobile) : on dédoublonne.

   Le reste de la page — publicités, lien vers le site frère de baseball, étiquettes
   « match tags » — n'est pas un flux : le filtre ne garde que les diffusions du domaine,
   comme pour VIPLeague. */

export var hotes = ['liveleagues'];

var DIFFUSION_RE = /-live-streaming\/?$/i;

export function extraireLiens(ctx) {
    var doc = ctx.doc, m = ctx.match;
    var qualite = ctx.aides && ctx.aides.qualite ? ctx.aides.qualite : function() { return ''; };
    var origine = '';
    try { origine = new URL(m.matchUrl).origin; } catch (e) {}
    var liens = [];
    var noeuds = doc ? doc.querySelectorAll('a[data-uri]') : [];
    [].forEach.call(noeuds, function(a) {
        var uri = (a.getAttribute('data-uri') || '').trim();
        if (!uri || !DIFFUSION_RE.test(uri)) return;
        var url = /^https?:\/\//i.test(uri) ? uri : (origine + (uri.charAt(0) === '/' ? '' : '/') + uri);
        if (liens.some(function(l) { return l.url === url; })) return;
        var badge = a.querySelector('.badge');
        var badgeTexte = badge ? badge.textContent.trim() : '';
        var nom = a.textContent.replace(badgeTexte, '').replace(/\s+/g, ' ').trim() || 'Diffusion';
        liens.push({
            name: nom,
            quality: qualite(badgeTexte),
            lang: 'MULTI',
            url: url,
            icon: '📺',
            scrapeContext: { blockText: a.textContent.replace(/\s+/g, ' ').trim(), pageText: ctx.pageText || '', pageLink: m.matchUrl, allLinks: ctx.pageLiens || [] }
        });
    });
    return liens;
}

export function filtrerLiens(liens) {
    return (liens || []).filter(function(l) {
        return l && l.url && /liveleagues/i.test(l.url) && DIFFUSION_RE.test(l.url.split('?')[0]);
    });
}

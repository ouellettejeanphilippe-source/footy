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

   **Deuxième forme (27 octobre 2026).** Le site a refait ce bloc : les diffusions sont maintenant
   de vraies ancres, `<a class="stream-link-item" href="/fiba/…-1-live-streaming"><span
   class="stream-link-number">1</span> <span class="txt">Broadcast</span> <span class="lang">
   </span><span class="stream-quality"></span></a>`. L'adaptateur ne lisait que `a[data-uri]` :
   sur une page en direct, il ne rendait rien et la fiche n'offrait que « Page du match » (3
   diffusions manquées sur Corinthians–Santa Fe). Les deux formes sont lues.

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
    var noeuds = doc ? doc.querySelectorAll('a[data-uri], a.stream-link-item[href]') : [];
    [].forEach.call(noeuds, function(a) {
        var uri = (a.getAttribute('data-uri') || a.getAttribute('href') || '').trim();
        if (!uri || !DIFFUSION_RE.test(uri)) return;
        var url = /^https?:\/\//i.test(uri) ? uri : (origine + (uri.charAt(0) === '/' ? '' : '/') + uri);
        if (liens.some(function(l) { return l.url === url; })) return;
        var badge = a.querySelector('.badge, .stream-quality');
        var badgeTexte = badge ? badge.textContent.trim() : '';
        var nom = a.textContent.replace(badgeTexte, '').replace(/\s+/g, ' ').trim() || 'Diffusion';
        /* « 1 Broadcast » (le numéro d'abord) se lit « Broadcast 1 », comme l'ancienne forme. */
        var numero = a.querySelector('.stream-link-number'), libelle = a.querySelector('.stream-link-info .txt');
        if (numero && libelle) nom = (libelle.textContent.trim() + ' ' + numero.textContent.trim()).replace(/\s+/g, ' ').trim();
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

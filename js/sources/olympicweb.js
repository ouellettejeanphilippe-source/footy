/* OlympicStreams (olympicweb.me) et FBStream (fbstream.is) : lecture d'une page de match.

   Un fichier par domaine — voir js/sources/index.js pour le contrat. Les deux sites
   partagent le moteur de VIPLeague et de Liveleagues : la page de match ANNONCE ses
   diffusions en boutons, pas en ancres (relevé le 9 octobre 2026) :
     olympicweb : <button data-uri="/be1-nfa-vs-dainava-alytus-live-stream/1/">Live Stream 1</button>
     fbstream   : <button data-uri="/live/stream/pakistan-vs-sri-lanka-fb-1/">Stream 1 🌟</button>
   Le même bloc est répété dans un menu déroulant (`a.dropdown-item[data-uri]`) : on
   dédoublonne. Ce sont des pages du site, pas des lecteurs nus : le lecteur y est monté
   en JavaScript avec un jeton lié à l'adresse IP de qui la charge et valable une minute,
   donc seule la PAGE se garde ; la tuile la charge, le jeton est frais.

   Le reste de la page (navigation, guide de VPN, autres matchs) n'est pas un flux : le
   filtre ne garde que les diffusions du domaine. */

export var hotes = ['olympicweb', 'fbstream'];

/* Ses boutons sont les seules diffusions de la page : le reste (navigation par sport,
   régie publicitaire) n'est pas gardé — voir `seulementSesLiens`, js/sources/index.js. */
export var seulementSesLiens = true;

var DIFFUSION_RE = /(-live-stream\/\d+\/?$|-fb-\d+\/?$)/i;

export function extraireLiens(ctx) {
    var doc = ctx.doc, m = ctx.match;
    var origine = '';
    try { origine = new URL(m.matchUrl).origin; } catch (e) {}
    var liens = [];
    var noeuds = doc ? doc.querySelectorAll('[data-uri]') : [];
    [].forEach.call(noeuds, function(b) {
        var uri = (b.getAttribute('data-uri') || '').trim();
        if (!uri || !DIFFUSION_RE.test(uri.split('?')[0])) return;
        var url = /^https?:\/\//i.test(uri) ? uri : (origine + (uri.charAt(0) === '/' ? '' : '/') + uri);
        if (liens.some(function(l) { return l.url === url; })) return;
        liens.push({
            name: (b.textContent || '').replace(/\s+/g, ' ').trim() || 'Diffusion',
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
    return (liens || []).filter(function(l) {
        return l && l.url && /olympicweb|fbstream/i.test(l.url) && DIFFUSION_RE.test(l.url.split('?')[0]);
    });
}

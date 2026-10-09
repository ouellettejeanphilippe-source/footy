/* mybuffstreams.plus et isportsurge.ws : lecture d'une page de match.

   Un fichier par domaine — voir js/sources/index.js pour le contrat. Les deux sites
   partagent un moteur (relevé le 9 octobre 2026) : la page porte une iframe vide et des
   boutons qui la remplissent,
     <iframe id="cx-iframe" src="https://gooz.aapmains.net/new-stream-embed/">
     window.changeStream = function (streamId) { …src = 'https://gooz.aapmains.net/new-stream-embed/' + streamId }
     <button id="stream-btn-48213" onclick="changeStream(48213)">
   Les boutons n'apparaissent qu'à l'approche du coup d'envoi. Le moteur générique ne
   voyait que l'iframe VIDE (un lecteur sans flux) : on reconstruit un lecteur par bouton,
   sur la base que la page écrit elle-même (son domaine change). */

export var hotes = ['mybuffstreams', 'isportsurge'];
export var seulementSesLiens = true;

var BASE_RE = /['"](https?:\/\/[^'"\s]+\/new-stream-embed\/)['"]\s*\+\s*streamId/;

export function extraireLiens(ctx) {
    var html = String(ctx.html || '');
    var mb = BASE_RE.exec(html);
    var base = mb ? mb[1] : '';
    if (!base) {
        var f = ctx.doc && ctx.doc.querySelector('iframe[src*="new-stream-embed"]');
        var src = f ? f.getAttribute('src') || '' : '';
        var mi = /^(https?:\/\/.+\/new-stream-embed\/)/.exec(src);
        base = mi ? mi[1] : '';
    }
    if (!base) return [];
    var ids = [], m, re = /changeStream\(\s*['"]?(\d+)|id=["']stream-btn-(\d+)/g;
    while ((m = re.exec(html)) !== null) { var id = m[1] || m[2]; if (ids.indexOf(id) < 0) ids.push(id); }
    return ids.map(function(id, i) {
        var bouton = ctx.doc && ctx.doc.getElementById('stream-btn-' + id);
        var nom = bouton ? bouton.textContent.replace(/\s+/g, ' ').trim() : '';
        return { name: nom || ('Flux ' + (i + 1)), quality: '', lang: 'MULTI', url: base + id, icon: '📺' };
    });
}

// L'iframe vide de la page (…/new-stream-embed/ sans identifiant) n'est pas un lecteur.
export function filtrerLiens(liens) {
    return (liens || []).filter(function(l) { return l && l.url && !/\/new-stream-embed\/?(\?|$)/.test(l.url); });
}

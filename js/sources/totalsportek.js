/* TotalSportek (total-sportekk.st) : lecture d'une page de match.

   Un fichier par domaine — voir js/sources/index.js pour le contrat. La page liste ses
   flux dans un tableau (`tr.custom-stream-row` : chaîne, débit, langue), chaque lien
   enveloppé dans une page relais qui ne fait qu'encadrer le vrai lecteur :
     https://hitcast.st/totview.php?src=https://vertex.st/embed/…
   (relevé le 9 octobre 2026 sur la page en direct du Grand Prix de Singapour : neuf
   liens). Le moteur générique les trouve ; on les DÉBALLE, pour que la tuile charge le
   lecteur et que le registre de jouabilité le juge, plutôt que de juger le relais. Les
   liens n'apparaissent qu'une heure avant le coup d'envoi. */

export var hotes = ['total-sportekk', 'totalsportek'];

export function deballer(url) {
    try {
        var u = new URL(url);
        if (!/totview\.php$/i.test(u.pathname)) return url;
        var src = u.searchParams.get('src');
        return src && /^https?:\/\//i.test(src) ? src : url;
    } catch (e) { return url; }
}

export function filtrerLiens(liens) {
    var vus = {};
    return (liens || []).map(function(l) {
        if (!l || !l.url) return l;
        var vrai = deballer(l.url);
        return vrai === l.url ? l : Object.assign({}, l, { url: vrai });
    }).filter(function(l) {
        if (!l || !l.url || vus[l.url]) return false;
        vus[l.url] = true;
        return true;
    });
}

// Rien à ajouter au moteur générique, qui trouve déjà le tableau des flux : on ne fait que déballer.
export function extraireLiens() { return []; }

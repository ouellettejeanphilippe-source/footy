/* Roxiestreams (roxiestreams.su) : lecture d'une page d'emplacement.

   Un fichier par domaine — voir js/sources/index.js pour le contrat. La page ne porte
   pas de lecteur : ses boutons en construisent un (relevé le 9 octobre 2026),
     <button onclick="showPlayer('clappr', getRandomStream('foxd.m3u8', 'tedesco'))">
     getRandomStream = (chemin, sous = 'tedesco') => `https://${sous}.${domaine}/${chemin}`
   où `domaine` est tiré au sort dans /domainsz77.txt — une seule valeur ce jour-là. Le
   flux est un manifeste HLS nu, que l'application joue elle-même (js/directmedia.js) :
   ni page, ni régie, ni « disable-devtool ». Un adaptateur ne fait pas de requête : le
   domaine est donc écrit ici ; s'il change, la page reste ouvrable en secours. */

export var hotes = ['roxiestreams'];

export var DOMAINE_FLUX = 'formaturamaxi.com.br';

export function extraireLiens(ctx) {
    var html = String(ctx.html || '');
    var re = /getRandomStream\(\s*['"]([^'"]+\.m3u8)['"]\s*(?:,\s*['"]([a-z0-9-]+)['"])?\s*\)/gi;
    var liens = [], m, n = 0;
    while ((m = re.exec(html)) !== null) {
        var url = 'https://' + (m[2] || 'tedesco') + '.' + DOMAINE_FLUX + '/' + m[1];
        if (liens.some(function(l) { return l.url === url; })) continue;
        n++;
        liens.push({ name: 'Flux ' + n + ' (HLS)', quality: '', lang: 'MULTI', url: url, icon: '▶️' });
    }
    return liens;
}

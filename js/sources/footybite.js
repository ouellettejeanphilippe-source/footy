/* Footybite : lecture d'une page de match.

   UN FICHIER PAR DOMAINE. Décision du 6 septembre 2026 : « chaque domaine doit donc être
   différent dans le système de fetch and parse ». Les agrégateurs ne se ressemblent pas —
   l'un rend ses flux dans une charge Next.js, l'autre dans une iframe, un troisième dans
   une API JSON ; et la chaîne qui mène à la vidéo diffère aussi : accueil → page du match
   → lecteur chez l'un, accueil → liste → page → lecteur chez l'autre. Les empiler dans
   une seule fonction à branches, c'est le nid à régressions qu'on vient de démêler.

   Un adaptateur ne connaît QUE son domaine. Il reçoit tout ce dont il a besoin dans son
   contexte (`ctx`) et n'importe rien du module central — sans quoi l'import serait
   circulaire, et chaque adaptateur retirerait tout le graphe des modules derrière lui.

   Contrat (voir js/sources/index.js) :
     hotes         : fragments d'hôte que cet adaptateur reconnaît
     extraireLiens : (ctx) -> [liens]   ctx = { html, doc, match, pageText, pageLiens, aides }

   Ce que Footybite sert, mesuré le 6 septembre 2026 sur ses pages réelles : les flux
   vivent dans la charge Next.js (`self.__next_f.push`), sous trois formes — un tableau
   `directStreams`, un tableau `iframeStreams`, et des `"url":"…"` isolées. Un repli lit
   le DOM quand la charge est absente. Everton–Manchester United y donnait 53 liens. */

export var hotes = ['footybite'];

export function extraireLiens(ctx) {
    var html = ctx.html, doc = ctx.doc, m = ctx.match;
    var pageTextContext = ctx.pageText, pageLinksContext = ctx.pageLiens;
    var isMatchOrLeaguePage = ctx.aides.estPageDeMatchOuLigue;
    var extractQuality = ctx.aides.qualite;
    var links = [];

        var scriptRegex = /self\.__next_f\.push\(\[1,"(.*?)"\]\)/g;
        var match;
        var concatenatedData = "";

        while ((match = scriptRegex.exec(html)) !== null) {
            var chunk = match[1];
            chunk = chunk.replace(/\\"/g, '"')
                         .replace(/\\\\/g, '\\')
                         .replace(/\\n/g, '\n');
            concatenatedData += chunk;
        }

        try {
            var serverIndex = 1;

            // Legacy / alternate direct extraction
            var urlRegex = /"url":"(https?:\/\/[^"]+)"/g;
            var urlMatch;

            while ((urlMatch = urlRegex.exec(concatenatedData)) !== null) {
                var streamUrl = urlMatch[1];
                if (!streamUrl.includes('w3.org') && !streamUrl.includes('cloudflare') && !streamUrl.includes('dashgenius') && !streamUrl.includes('gstatic')) {
                    if (isMatchOrLeaguePage(streamUrl, m)) continue;
                    links.push({
                        name: 'Serveur ' + serverIndex,
                        quality: 'HD',
                        lang: 'MULTI',
                        url: streamUrl,
                        icon: '📺',
                        scrapeContext: { blockText: streamUrl, pageText: pageTextContext, pageLink: m.matchUrl, allLinks: pageLinksContext }
                    });
                    serverIndex++;
                }
            }

            // Stream arrays matching directStreams and iframeStreams
            var directMatch = /"directStreams":(\[.*?\])/.exec(concatenatedData);
            var iframeMatch = /"iframeStreams":(\[.*?\])/.exec(concatenatedData);

            if (directMatch) {
                var directStreams = JSON.parse(directMatch[1]);
                directStreams.forEach(function(s) {
                    if (s.link && !links.find(l => l.url === s.link)) {
                        if (isMatchOrLeaguePage(s.link, m)) return;
                        links.push({
                            name: 'Serveur ' + serverIndex + (s.name ? ' - ' + s.name : ''),
                            quality: extractQuality((s.name || '') + ' ' + (s.quality || '')),
                            lang: 'MULTI',
                            url: s.link,
                            icon: '📺',
                            scrapeContext: { blockText: JSON.stringify(s), pageText: pageTextContext, pageLink: m.matchUrl, allLinks: pageLinksContext }
                        });
                        serverIndex++;
                    }
                });
            }

            if (iframeMatch) {
                var iframeStreams = JSON.parse(iframeMatch[1]);
                iframeStreams.forEach(function(s) {
                    if (s.src && !links.find(l => l.url === s.src)) {
                        if (isMatchOrLeaguePage(s.src, m)) return;
                        links.push({
                            name: 'Serveur ' + serverIndex + (s.name ? ' - ' + s.name : ''),
                            quality: 'HD',
                            lang: 'MULTI',
                            url: s.src,
                            icon: '📺',
                            scrapeContext: { blockText: JSON.stringify(s), pageText: pageTextContext, pageLink: m.matchUrl, allLinks: pageLinksContext }
                        });
                        serverIndex++;
                    }
                });
            }
        } catch(e) {}

        // Site-Specific DOM Fallback for Footybite
        if (links.length === 0) {
            var fbBtns = doc.querySelectorAll('a');
            [].forEach.call(fbBtns, function(btn) {
                var url = btn.getAttribute('href');
                if (url && url.indexOf('http') === 0 && (btn.textContent.trim().toLowerCase() === 'watch' || url.toLowerCase().includes('stream'))) {
                    var wrapper = btn.closest('div');
                    var name = wrapper ? wrapper.textContent.replace(btn.textContent, '').trim() : 'Serveur';
                    if (!name) name = 'Serveur';

                    var quality = extractQuality(name);
                    var lang = 'MULTI';
                    if (name.toLowerCase().includes('english')) lang = 'EN';
                    if (name.toLowerCase().includes('spanish')) lang = 'ES';

                    // Cleanup name for UI display
                    var cleanName = name.replace(/\s*-\s*english.*/i, '')
                                        .replace(/\s*·\s*english.*/i, '')
                                        .replace(/\s*-\s*spanish.*/i, '')
                                        .replace(/\s*·\s*spanish.*/i, '')
                                        .replace(/\s*-\s*HD/i, '')
                                        .replace(/\s*·\s*HD/i, '')
                                        .trim();
                    if (!cleanName) cleanName = 'Serveur';

                    if (!links.find(l => l.url === url)) {
                        if (isMatchOrLeaguePage(url, m)) return;
                        links.push({
                            name: cleanName,
                            quality: quality,
                            lang: lang,
                            url: url,
                            icon: '📺',
                            scrapeContext: { blockText: name + ' ' + url, pageText: pageTextContext, pageLink: m.matchUrl, allLinks: pageLinksContext }
                        });
                    }
                }
            });
        }
    return links;
}

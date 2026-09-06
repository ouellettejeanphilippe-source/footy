/* Streameast : lecture d'une page de match.

   Un fichier par domaine — voir js/sources/index.js pour le contrat.

   Streameast sert ses flux dans une charge Next.js (`self.__next_f.push`), comme Footybite,
   mais avec sa propre forme. Ses pages de match répondent 429 depuis un serveur : elles
   figurent dans MATCH_PAGE_BLOCKED_HOSTS (js/config.js) et ne sont lues que depuis le
   navigateur de l'utilisateur. */

export var hotes = ['streameast'];

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
            var directMatch = /"directStreams":(\[.*?\])/.exec(concatenatedData);
            var iframeMatch = /"iframeStreams":(\[.*?\])/.exec(concatenatedData);

            var directStreams = directMatch ? JSON.parse(directMatch[1]) : [];
            var iframeStreams = iframeMatch ? JSON.parse(iframeMatch[1]) : [];

            var serverIndex = 1;

                if (Array.isArray(directStreams)) {
                    directStreams.forEach(function(s) {
                        if (s.link) {
                            if (isMatchOrLeaguePage(s.link, m)) return;
                            var langStr = (s.language || '').toLowerCase();
                            links.push({
                                name: 'Server ' + serverIndex + ' - ' + (s.name || 'Flux'),
                                quality: extractQuality((s.name || '') + ' ' + (s.quality || '')),
                                lang: langStr.includes('english') ? 'EN' : (langStr || 'MULTI').toUpperCase(),
                                url: s.link,
                                icon: '📺',
                                scrapeContext: { blockText: JSON.stringify(s), pageText: pageTextContext, pageLink: m.matchUrl, allLinks: pageLinksContext }
                            });
                            serverIndex++;
                        }
                    });
                }

                if (Array.isArray(iframeStreams)) {
                    iframeStreams.forEach(function(s) {
                        if (s.src) {
                            if (isMatchOrLeaguePage(s.src, m)) return;
                            links.push({
                                name: 'Server ' + serverIndex + ' - ' + (s.name || 'Flux'),
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
        } catch(e) {
            console.error("Error parsing Streameast streams:", e);
        }

    return links;
}

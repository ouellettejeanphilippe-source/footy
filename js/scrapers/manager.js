// ══ SCRAPER MANAGER ═══════════════════════════

function scrapeMatchFlux(m){
    return new Promise(function(resolve){
        if (!m.matchUrl || m.streamsLoaded) return resolve();
        if (m.source === new URL(SITE).hostname || m.source === 'footybite.to' || m.source === 'footybite.com') {
             fetchPage(m.matchUrl).then(function(html){
                 var div = document.createElement('div');
                 div.innerHTML = html;
                 var links = div.querySelectorAll('a[href*="/"]');
                 links.forEach(function(a){
                     var href = a.getAttribute('href');
                     var text = a.textContent.trim() || 'Stream';
                     if(href && href.indexOf('javascript') === -1 && href.indexOf(SITE) === -1) {
                         if (!m.streams) m.streams = [];
                         if (m.streams.length < 20) {
                             m.streams.push({ name: text, url: href });
                         }
                     }
                 });
                 m.streamsLoaded = true;
                 resolve();
             }).catch(function(){ resolve(); });
        } else {
             // Basic generic scraping for other sources if they require deep fetch
             fetchPage(m.matchUrl).then(function(html){
                 var div = document.createElement('div');
                 div.innerHTML = html;
                 var iframes = div.querySelectorAll('iframe');
                 iframes.forEach(function(fr){
                     var src = fr.getAttribute('src');
                     if (src) {
                         if (!m.streams) m.streams = [];
                         m.streams.push({ name: 'Lecteur intégré', url: src });
                     }
                 });
                 m.streamsLoaded = true;
                 resolve();
             }).catch(function(){ resolve(); });
        }
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { scrapeMatchFlux };
}

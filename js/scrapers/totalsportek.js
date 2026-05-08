function parseTotalsportek(html) {
    var matches = [];
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var links = doc.querySelectorAll('a[href]');
    [].forEach.call(links, function(a) {
        var href = a.getAttribute('href');
        if(href && href.includes('/game/') && href.includes('-vs-')) {
            var urlParts = href.split('/game/')[1].split('/')[0].split('-vs-');
            if(urlParts.length === 2) {
                var home = urlParts[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim();
                var away = urlParts[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim();
                if(home && away) {
                    var matchUrl = href;
                    if(!matchUrl.startsWith('http') && !matchUrl.startsWith('javascript')) {
                        matchUrl = 'https://www.totalsportek-real.com' + (matchUrl.startsWith('/') ? matchUrl : '/' + matchUrl);
                    }
                    if(matchUrl && !matchUrl.startsWith('javascript') && !matches.find(m => m.matchUrl === matchUrl)) {
                        matches.push({
                            id: 'ts_' + matches.length,
                            league: 'Sports',
                            flag: lgFlag('Sports'),
                            color: lgColor('Sports'),
                            homeTeam: getOfficialTeamName(home),
                            awayTeam: getOfficialTeamName(away),
                            matchUrl: matchUrl,
                            startTime: '00:00',
                            status: 'upcoming',
                            streamLinks: [],
                            streamsLoaded: false,
                            source: 'totalsportek'
                        });
                    }
                }
            }
        }
    });
    return matches;
}

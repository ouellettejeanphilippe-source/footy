function parseVipleague(html) {
    var matches = [];
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var links = doc.querySelectorAll('a[href]');
    [].forEach.call(links, function(a) {
        var href = a.getAttribute('href');
        if(href && href.includes('-streaming') && !href.includes('-links')) {
            var urlParts = href.split('/').pop().split('-streaming')[0].split('-vs-');
            if(urlParts.length >= 2) {
                var home = urlParts[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim();
                var away = urlParts.slice(1).join(' ').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim();
                if(home && away) {
                    var matchUrl = href;
                    if(!matchUrl.startsWith('http') && !matchUrl.startsWith('javascript')) {
                        matchUrl = 'https://vipleague.io' + (matchUrl.startsWith('/') ? matchUrl : '/' + matchUrl);
                    }
                    if(matchUrl.startsWith('http') && !matches.find(m => m.matchUrl === matchUrl)) {
                        matches.push({
                            id: 'vip_' + matches.length,
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
                            source: 'vipleague'
                        });
                    }
                }
            }
        }
    });
    return matches;
}

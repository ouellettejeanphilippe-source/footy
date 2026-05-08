function parseNflbite(html) {
    var matches = [];
    var regex = /<a class="teams-logo" href="([^"]*\/teams\/([^"]*)-live-stream\/)">[\s\S]*?<img class="team-logo-img" src="([^"]*)"/g;
    var match;
    var i = 0;
    while ((match = regex.exec(html)) !== null) {
        var url = match[1];
        var teamName = match[2].replace(/-/g, " ").trim();
        var logo = match[3];

        var streamLinks = [];

        matches.push({
            id: "nflbite_" + i,
            homeTeam: getOfficialTeamName(teamName),
            awayTeam: 'TBD',
            homeLogo: logo,
            status: "upcoming",
            score: null,
            startTime: "00:00",
            matchUrl: url.indexOf("http") === 0 ? url : "https://nflbite.is" + url,
            streamLinks: streamLinks,
            streamsLoaded: false,
            league: "NFL",
            source: "nflbite"
        });
        i++;
    }

    // Fallback: Just parse any team-like link
    if (matches.length === 0) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var links = doc.querySelectorAll('a[href*="/teams/"]');
        [].forEach.call(links, function(a) {
             var href = a.getAttribute('href');
             if(href.includes('-live-stream')) {
                 var teamPart = href.split('/teams/')[1].split('-live-stream')[0];
                 var teamN = teamPart.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim();
                 if (teamN && !matches.find(m => m.homeTeam === teamN)) {
                     var matchUrl = href.startsWith('http') ? href : MLBITE_URL.replace(/\/$/, '') + (href.startsWith('/') ? href : '/' + href);
                     matches.push({
                        id: "nflbite_fb_" + i++,
                        homeTeam: getOfficialTeamName(teamN),
                        awayTeam: 'TBD',
                        status: "upcoming",
                        startTime: "00:00",
                        matchUrl: matchUrl,
                        streamLinks: [],
                        streamsLoaded: false,
                        league: "NFL",
                        source: "nflbite"
                     });
                 }
             }
        });
    }
    lg("NFLBite extraits", matches.length);
    return matches;
}

function parseMlbbite(html) {
    var matches = [];
    try {
        var doc = new DOMParser().parseFromString(html, "text/html");

        // MLBBite new format: <a href="/watch/..." class="inline-match-item"> or similar
        // Just find any link that looks like a match link if .inline-match-item is missing
        var items = doc.querySelectorAll(".inline-match-item, a[href*='/watch/live/']");

        // Remove duplicates based on href
        var uniqueItems = [];
        var hrefs = new Set();
        [].forEach.call(items, function(el) {
            var href = el.getAttribute("href");
            if (href && !hrefs.has(href)) {
                hrefs.add(href);
                uniqueItems.push(el);
            }
        });

        uniqueItems.forEach(function(el, i) {
            var href = el.getAttribute("href");
            if (!href) return;

            var matchUrl = href.indexOf("http") === 0 ? href : "https://mlbbite.plus" + href;

            var home = "TBD";
            var away = "TBD";
            var score = null;
            var status = "upcoming";
            var startTime = "00:00";

            // Try different team selectors depending on mlbbite layout
            var teams = el.querySelectorAll(".team---item b, .team-name, .name");
            if (teams.length >= 2) {
                home = teams[0].textContent.trim();
                away = teams[1].textContent.trim();
            } else {
                // Try parsing from the URL: /watch/live/san-francisco-giants-at-tampa-bay-rays-5-free-live-stream
                var urlMatch = href.match(/live\/([a-z0-9-]+)-(?:at|vs)-([a-z0-9-]+?)(?:-\d*-?free-live-stream(?:s)?|-live-stream)?(?:\.html|\/)?$/);
                if (urlMatch) {
                    away = urlMatch[1].replace(/-/g, ' ');
                    home = urlMatch[2].replace(/-/g, ' ');
                }
            }

            if (home === "TBA" && away === "TBA") return;

            // Find logos
            var imgs = el.querySelectorAll(".img img, img.logo");
            var homeLogo = imgs.length > 0 ? imgs[0].getAttribute("src") : null;
            var awayLogo = imgs.length > 1 ? imgs[1].getAttribute("src") : null;

            var scoreEl = el.querySelector(".first-team-result, .score");
            if (scoreEl) {
                var s = scoreEl.textContent.trim().split("-");
                if (s.length === 2) {
                    score = [parseInt(s[0]), parseInt(s[1])];
                }
            }

            var statusEl = el.querySelector(".result-status-text, .status");
            if (statusEl) {
                var sTxt = statusEl.textContent.toLowerCase();
                if (sTxt.indexOf("live") !== -1 || sTxt.indexOf("in progress") !== -1 || sTxt.indexOf("top") !== -1 || sTxt.indexOf("bot") !== -1) {
                    status = "live";
                } else if (sTxt.indexOf("finished") !== -1 || sTxt.indexOf("ft") !== -1 || sTxt.indexOf("final") !== -1) {
                    status = "finished";
                }
            }

            var dateEl = el.querySelector(".match-date, .time");
            if (dateEl && !scoreEl) {
                var rawTime = dateEl.textContent.trim();
                var timeM = rawTime.match(/(\d{1,2}):(\d{2})/);
                if (timeM) {
                    startTime = timeM[1].padStart(2, "0") + ":" + timeM[2];
                }
            } else if (dateEl && dateEl.hasAttribute("title") && status === "upcoming") {
                var rawTime = dateEl.getAttribute("title").trim() || dateEl.textContent.trim();
                var timeM = rawTime.match(/(\d{1,2}):(\d{2})/);
                if (timeM) {
                    startTime = timeM[1].padStart(2, "0") + ":" + timeM[2];
                }
            }

            var streamLinks = [];

            matches.push({
                id: "mlbbite_" + i,
                homeTeam: getOfficialTeamName(home),
                awayTeam: getOfficialTeamName(away),
                homeLogo: homeLogo,
                awayLogo: awayLogo,
                status: status,
                score: score,
                startTime: startTime,
                matchUrl: matchUrl,
                streamLinks: streamLinks,
                streamsLoaded: false,
                league: "MLB",
                source: "mlbbite"
            });
        });
    } catch (e) {}
    lg("MLBBite extraits", matches.length);
    return matches;
}

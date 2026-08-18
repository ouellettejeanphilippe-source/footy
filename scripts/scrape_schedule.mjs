import fs from 'fs';
import { JSDOM } from 'jsdom';

// We emulate some DOM/window globals required by `scrapers.js` regex parsing if needed
const dom = new JSDOM();
global.DOMParser = dom.window.DOMParser;
global.window = dom.window;

// Utilities ported from utils.js & db.js
function pad(n) { return n < 10 ? '0' + n : n; }

function getEspnDateStr(d) {
    var formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(d).replace(/-/g, '');
}

function getEstDateStrFromDate(d) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const parts = formatter.formatToParts(d);
    let yy, mm, dd;
    parts.forEach(p => {
        if(p.type === 'year') yy = p.value;
        if(p.type === 'month') mm = p.value;
        if(p.type === 'day') dd = p.value;
    });
    return `${yy}-${mm}-${dd}`;
}

function getEstTimeStrFromDate(d) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit', minute: '2-digit', hour12: false
    });
    return formatter.format(d);
}

const ESPN_LEAGUES = {
  'premier league': 'soccer/eng.1',
  'la liga': 'soccer/esp.1',
  'serie a': 'soccer/ita.1',
  'bundesliga': 'soccer/ger.1',
  'ligue 1': 'soccer/fra.1',
  'champions league': 'soccer/uefa.champions',
  'europa league': 'soccer/uefa.europa',
  'conference league': 'soccer/uefa.europa.conf',
  'mls': 'soccer/usa.1',
  'eredivisie': 'soccer/ned.1',
  'primeira liga': 'soccer/por.1',
  'nations league': 'soccer/uefa.nations',
  'fa cup': 'soccer/eng.fa',
  'league cup': 'soccer/eng.league_cup',
  'copa del rey': 'soccer/esp.copa_del_rey',
  'dfb pokal': 'soccer/ger.dfb_pokal',
  'saudi pro league': 'soccer/ksa.1',
  'fifa world cup': 'soccer/fifa.world',
  'nba': 'basketball/nba',
  'basketball': 'basketball/nba',
  'nhl': 'hockey/nhl',
  'hockey': 'hockey/nhl',
  'ice hockey': 'hockey/nhl',
  'nfl': 'football/nfl',
  'american football': 'football/nfl',
  'american-football': 'football/nfl',
  'mlb': 'baseball/mlb',
  'baseball': 'baseball/mlb',
  'cfl': 'football/cfl',
  'world baseball classic': 'baseball/world-baseball-classic',
  'fiba world cup': 'basketball/fiba',
  'ncaa men\'s basketball': 'basketball/mens-college-basketball',
  'olympics men\'s basketball': 'basketball/mens-olympics-basketball',
  'ncaa women\'s basketball': 'basketball/womens-college-basketball',
  'ncaa football': 'football/college-football',
  'world hockey championships': 'hockey/hockey-world-cup',
  'world cup of hockey': 'hockey/hockey-world-cup',
  'ncaa men\'s ice hockey': 'hockey/mens-college-hockey',
  'olympics men\'s ice hockey': 'hockey/olympics-mens-ice-hockey',
  'olympics women\'s ice hockey': 'hockey/olympics-womens-ice-hockey',
  'ncaa women\'s hockey': 'hockey/womens-college-hockey',
  'pwhl': 'hockey/womens-professional-hockey-league',
  'f1': 'racing/f1',
  'formula 1': 'racing/f1',
  'formula-1': 'racing/f1',
  'nascar': 'racing/nascar-premier',
  'indycar': 'racing/irl',
  'wwe': 'wwe/wwe',
  'aew': 'wwe/wwe',
  'boxing': 'boxing/boxing',
  'mma': 'mma/ufc',
  'ufc': 'mma/ufc',
  'tennis': 'tennis/atp',
  'golf': 'golf/pga'
};

function formatLeagueName(l) { return l ? l.replace(/-/g, ' ').toUpperCase() : 'UNKNOWN'; }
function getLeagueDuration(league) {
    if(!league) return 105;
    const l = league.toLowerCase();
    if(l.includes('nfl') || l.includes('football')) return 180;
    if(l.includes('mlb') || l.includes('baseball')) return 180;
    if(l.includes('nhl') || l.includes('hockey')) return 150;
    if(l.includes('nba') || l.includes('basketball')) return 150;
    if(l.includes('wwe') || l.includes('aew')) return 180;
    if(l.includes('f1') || l.includes('racing')) return 120;
    if(l.includes('tennis')) return 180;
    if(l.includes('mma') || l.includes('ufc')) return 180;
    return 105;
}

const STATIC_TEAM_MAP = { 'internazionale': 'Inter Milan', 'ac milan': 'AC Milan', 'paris saint-germain': 'Paris Saint-Germain', 'manchester united': 'Manchester United', 'manchester city': 'Manchester City', 'tottenham hotspur': 'Tottenham' }; // Excerpt
function getOfficialTeamName(t) {
    if(!t) return t;
    const n = t.toLowerCase().trim();
    return STATIC_TEAM_MAP[n] || t.trim();
}

const LEAGUE_FLAGS = { 'premier league': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'nba': '🏀', 'nhl': '🏒', 'mlb': '⚾', 'nfl': '🏈', 'f1': '🏎️', 'wwe': '🤼‍♂️' };
function lgFlag(l) { return LEAGUE_FLAGS[l ? l.toLowerCase() : ''] || '🏆'; }

const LEAGUE_COLORS = { 'premier league': '#3d195b', 'nba': '#c9082a', 'nhl': '#000000', 'mlb': '#002D72', 'nfl': '#013369', 'f1': '#e10600', 'wwe': '#e10600' };
function lgColor(l) { return LEAGUE_COLORS[l ? l.toLowerCase() : ''] || '#444'; }


// Fetch APIs
async function fetchPage(url) {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if(!res.ok) return null;
        return await res.text();
    } catch(e) {
        return null;
    }
}

async function fetchEspnSchedule(leaguePath, dateStr) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${leaguePath}/scoreboard?dates=${dateStr}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    return { path: leaguePath, data: await res.json() };
  } catch (e) { return null; }
}

async function fetchLolEsportsSchedule() {
    const url = 'https://esports-api.lolesports.com/persisted/gw/getSchedule?hl=en-US';
    try {
        const res = await fetch(url, { headers: { 'x-api-key': '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z' }, signal: AbortSignal.timeout(10000) });
        return await res.json();
    } catch(e) { return null; }
}

async function fetchLolEsportsLiveStreams() {
    const url = 'https://esports-api.lolesports.com/persisted/gw/getLive?hl=en-US';
    try {
        const res = await fetch(url, { headers: { 'x-api-key': '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z' }, signal: AbortSignal.timeout(10000) });
        return await res.json();
    } catch(e) { return null; }
}

// Minimal matching logic
function isMatch(a,b) {
    if(!a||!b)return false;
    return a.toLowerCase().replace(/[^a-z0-9]/g,'') === b.toLowerCase().replace(/[^a-z0-9]/g,'');
}

// Simple ICS parser
function parseIcs(icsData, targetDateStr) {
    var lines = icsData.split(/\r?\n/);
    var matches = [];
    var currentEv = null;

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.startsWith('BEGIN:VEVENT')) {
            currentEv = {};
        } else if (line.startsWith('END:VEVENT')) {
            if (currentEv && currentEv.dtstart && currentEv.summary) {
                var dStr = currentEv.dtstart.substring(0, 8);
                var yy = dStr.substring(0, 4);
                var mm = dStr.substring(4, 6);
                var dd = dStr.substring(6, 8);
                var dateObj = new Date(Date.UTC(parseInt(yy), parseInt(mm) - 1, parseInt(dd),
                    currentEv.dtstart.length > 8 ? parseInt(currentEv.dtstart.substring(9, 11)) : 12,
                    currentEv.dtstart.length > 8 ? parseInt(currentEv.dtstart.substring(11, 13)) : 0));

                var evEstDate = getEstDateStrFromDate(dateObj);

                if (evEstDate === targetDateStr) {
                     matches.push({
                         id: 'ics_' + currentEv.uid,
                         homeTeam: currentEv.summary,
                         awayTeam: '',
                         matchDate: evEstDate,
                         startTime: getEstTimeStrFromDate(dateObj),
                         time: getEstTimeStrFromDate(dateObj)
                     });
                }
            }
            currentEv = null;
        } else if (currentEv) {
            if (line.startsWith('DTSTART')) {
                currentEv.dtstart = line.split(':')[1];
            } else if (line.startsWith('SUMMARY')) {
                currentEv.summary = line.split(':')[1];
            } else if (line.startsWith('UID')) {
                currentEv.uid = line.split(':')[1];
            }
        }
    }
    return matches;
}

function parsePWHLSchedule(html) {
    var matches = [];
    try {
        var doc = new JSDOM(html).window.document;
        var scripts = doc.querySelectorAll('script');
        for (var i = 0; i < scripts.length; i++) {
            var txt = scripts[i].textContent || '';
            if (txt.indexOf('games') !== -1) {
                var start = txt.indexOf('{');
                var end = txt.lastIndexOf('}');
                if (start !== -1 && end !== -1) {
                    var jsonStr = txt.substring(start, end + 1);
                    try {
                        var data = JSON.parse(jsonStr);
                        if (data && data.games) {
                            data.games.forEach(function(g) {
                                matches.push({
                                    id: 'pwhl_' + g.game_id,
                                    homeTeam: g.home_team_name,
                                    awayTeam: g.away_team_name,
                                    date: g.date_time_gmt,
                                    time: g.game_status,
                                    homeScore: g.home_goal_count,
                                    awayScore: g.away_goal_count,
                                    isFinished: g.game_status === 'Final'
                                });
                            });
                        }
                    } catch(e) {}
                }
            }
        }
    } catch(e) {}
    return matches;
}

// MAIN RUN
async function run() {
    const targetDate = new Date();
    // Move forward/backward hours to ensure EST sync for script runs
    targetDate.setUTCHours(targetDate.getUTCHours() - 5);
    const todayStr = getEspnDateStr(targetDate);
    const targetDateStr = getEstDateStrFromDate(targetDate);

    console.log(`Starting server-side schedule scrape for EST date ${targetDateStr} (ESPN ${todayStr})...`);

    const espnPaths = Array.from(new Set(Object.values(ESPN_LEAGUES)));
    let baseMatches = [];
    let baseMatchesById = {};

    const promises = espnPaths.map(path => fetchEspnSchedule(path, todayStr));
    const results = await Promise.all(promises);

    results.forEach(res => {
        if(!res || !res.data || !res.data.events) return;
        const data = res.data;
        const path = res.path;
        const leagueName = data.leagues && data.leagues[0] ? data.leagues[0].name : path;

        data.events.forEach(ev => {
            const isRacing = leagueName.toLowerCase().includes('f1') || leagueName.toLowerCase().includes('indycar') || path.includes('racing');
            const compsToProcess = (isRacing && ev.competitions) ? ev.competitions : ((ev.competitions && ev.competitions.length > 0) ? [ev.competitions[0]] : []);

            compsToProcess.forEach(comp => {
                if(!comp) return;
                let homeName, awayName;
                if(isRacing) {
                    homeName = ev.name || 'Racing Event';
                    awayName = comp.type && comp.type.abbreviation ? comp.type.abbreviation : 'Race';
                } else {
                    if(!comp.competitors) return;
                    const homeC = comp.competitors.find(c => c.homeAway === 'home');
                    const awayC = comp.competitors.find(c => c.homeAway === 'away');
                    if(!homeC || !awayC) return;
                    homeName = homeC.team.name;
                    awayName = awayC.team.name;
                }

                let status = 'upcoming';
                if(ev.status.type.state === 'in') status = 'live';
                if(ev.status.type.state === 'post') status = 'finished';

                let score = null;
                if(status !== 'upcoming' && !isRacing) {
                    const homeScoreObj = comp.competitors.find(c => c.homeAway === 'home');
                    const awayScoreObj = comp.competitors.find(c => c.homeAway === 'away');
                    if(homeScoreObj && awayScoreObj && homeScoreObj.score !== undefined && awayScoreObj.score !== undefined) {
                        score = [parseInt(homeScoreObj.score), parseInt(awayScoreObj.score)];
                    }
                }

                let minute = null;
                if(status === 'live' && ev.status.displayClock) minute = ev.status.displayClock;
                else if(status === 'live' && ev.status.period) minute = 'P' + ev.status.period;

                const dateObj = new Date(comp.date || ev.date);
                const startTime = getEstTimeStrFromDate(dateObj);
                const matchDate = isRacing ? targetDateStr : getEstDateStrFromDate(dateObj);
                const isPlayoff = ev.season && ev.season.type === 3;

                const matchObj = {
                    id: isRacing ? `espn_${ev.id}_${comp.id}` : `espn_${ev.id}`,
                    league: formatLeagueName(leagueName),
                    flag: lgFlag(leagueName),
                    color: lgColor(leagueName),
                    homeTeam: getOfficialTeamName(homeName),
                    awayTeam: getOfficialTeamName(awayName),
                    matchDate,
                    homeLogo: isRacing ? null : (comp.competitors.find(c=>c.homeAway==='home').team.logo || null),
                    awayLogo: isRacing ? null : (comp.competitors.find(c=>c.homeAway==='away').team.logo || null),
                    startTime,
                    durationMinutes: getLeagueDuration(leagueName),
                    status, score, minute, streamLinks: [], streamsLoaded: false, source: 'api', isPlayoff
                };

                if(!baseMatchesById[matchObj.id]) {
                    baseMatches.push(matchObj);
                    baseMatchesById[matchObj.id] = matchObj;
                }
            });
        });
    });

    console.log(`Parsed ${baseMatches.length} ESPN matches.`);

    // F1 & IndyCar
    const f1Html = await fetchPage('https://ics.ecal.com/ecal-sub/65cfbda721adce1847679093/Formula%201.ics');
    if(f1Html) {
        parseIcs(f1Html, targetDateStr).forEach(m => {
            m.flag = lgFlag('F1'); m.color = lgColor('F1'); m.source = 'api'; m.league = 'F1'; m.status = 'upcoming'; m.durationMinutes = 120;
            if(!baseMatches.find(x => isMatch(x.homeTeam, m.homeTeam) && x.matchDate === m.matchDate)) baseMatches.push(m);
        });
    }

    const indyHtml = await fetchPage('https://www.indycar.com/-/media/Files/2024/ICS/INDYCAR.ics');
    if(indyHtml) {
         parseIcs(indyHtml, targetDateStr).forEach(m => {
            m.flag = lgFlag('IndyCar'); m.color = lgColor('IndyCar'); m.source = 'api'; m.league = 'INDYCAR'; m.status = 'upcoming'; m.durationMinutes = 120;
            if(!baseMatches.find(x => isMatch(x.homeTeam, m.homeTeam) && x.matchDate === m.matchDate)) baseMatches.push(m);
        });
    }

    // PWHL
    const pwhl1 = await fetchPage('https://www.thepwhl.com/en/schedule');
    const pwhl2 = await fetchPage('https://www.thepwhl.com/en/schedule-25-26');
    [pwhl1, pwhl2].forEach(html => {
        if(!html) return;
        parsePWHLSchedule(html).forEach(m => {
            const dateObj = new Date(m.date);
            m.matchDate = getEstDateStrFromDate(dateObj);
            m.startTime = getEstTimeStrFromDate(dateObj);
            m.status = m.time === 'LIVE' ? 'live' : 'upcoming';
            if (m.isFinished || (m.isFinished === undefined && m.homeScore && m.awayScore && m.status !== 'live')) m.status = 'finished';
            if (m.homeScore && m.awayScore) m.score = [parseInt(m.homeScore), parseInt(m.awayScore)];

            m.flag = lgFlag('PWHL'); m.color = lgColor('PWHL'); m.source = 'api'; m.league = 'PWHL'; m.durationMinutes = 150;
            if(!baseMatches.find(x => x.id === m.id)) baseMatches.push(m);
        });
    });

    // WWE Weekly
    const dateObjTarget = new Date(targetDateStr + "T12:00:00Z");
    const dayOfWeekTarget = dateObjTarget.getUTCDay();
    const synthesizedWWE = [];
    if (dayOfWeekTarget === 1) synthesizedWWE.push({ id: 'wwe_raw_'+targetDateStr, homeTeam: 'WWE', awayTeam: 'Raw', matchDate: targetDateStr, startTime: '20:00' });
    if (dayOfWeekTarget === 2) synthesizedWWE.push({ id: 'wwe_nxt_'+targetDateStr, homeTeam: 'WWE', awayTeam: 'NXT', matchDate: targetDateStr, startTime: '20:00' });
    if (dayOfWeekTarget === 5) synthesizedWWE.push({ id: 'wwe_smackdown_'+targetDateStr, homeTeam: 'WWE', awayTeam: 'SmackDown', matchDate: targetDateStr, startTime: '20:00' });
    if (dayOfWeekTarget === 3) synthesizedWWE.push({ id: 'aew_dynamite_'+targetDateStr, homeTeam: 'AEW', awayTeam: 'Dynamite', matchDate: targetDateStr, startTime: '20:00' });

    synthesizedWWE.forEach(m => {
        m.league = m.homeTeam === 'AEW' ? 'AEW' : 'WWE';
        m.flag = lgFlag(m.league); m.color = lgColor(m.league); m.source = 'api'; m.status = 'upcoming'; m.durationMinutes = 180;
        if(!baseMatches.find(x => x.id === m.id)) baseMatches.push(m);
    });

    // LoL Esports
    const targetLeagues = ['lcs', 'lec', 'lck', 'lpl', 'pcs', 'vcs', 'ljl', 'lla', 'cblol', 'world_championship', 'msi'];
    const lolData = await fetchLolEsportsSchedule();
    if(lolData && lolData.data && lolData.data.schedule && lolData.data.schedule.events) {
        lolData.data.schedule.events.forEach(ev => {
            if(ev.type !== 'match' || !ev.match || !ev.match.teams || ev.match.teams.length < 2 || !ev.league || !ev.league.slug) return;
            if(!targetLeagues.includes(ev.league.slug.toLowerCase())) return;
            const dateObj = new Date(ev.startTime);
            const mDate = getEstDateStrFromDate(dateObj);
            if(mDate !== targetDateStr) return;

            const t1 = ev.match.teams[0]; const t2 = ev.match.teams[1];
            const status = ev.state === 'inProgress' ? 'live' : (ev.state === 'completed' ? 'finished' : 'upcoming');
            const score = status !== 'upcoming' ? [t1.result?.gameWins||0, t2.result?.gameWins||0] : null;

            const m = {
                id: 'lol_' + ev.match.id, league: formatLeagueName(ev.league.name),
                flag: lgFlag(ev.league.name), color: lgColor(ev.league.name),
                homeTeam: t1.name||t1.code, awayTeam: t2.name||t2.code,
                homeLogo: t1.image, awayLogo: t2.image,
                matchDate: mDate, startTime: getEstTimeStrFromDate(dateObj),
                durationMinutes: 60, status, score, source: 'api'
            };
            if(!baseMatches.find(x => x.id === m.id)) baseMatches.push(m);
        });
    }

    baseMatches.sort((a,b) => a.startTime > b.startTime ? 1 : -1);

    const cacheData = { fetchDate: todayStr, matches: baseMatches };

    if (!fs.existsSync('data')) fs.mkdirSync('data');
    fs.writeFileSync(`data/schedule.json`, JSON.stringify(cacheData, null, 2));

    console.log(`Saved ${baseMatches.length} total matches to data/schedule.json`);
}

run();

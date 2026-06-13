import fs from 'fs';

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

function pad(n) { return n < 10 ? '0' + n : n; }

function getEspnDateStr(d) {
  return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
}

async function fetchEspnSchedule(leaguePath, dateStr) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${leaguePath}/scoreboard?dates=${dateStr}`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return null;
    const data = await response.json();
    return { path: leaguePath, data: data };
  } catch (e) {
    return null;
  }
}

async function run() {
    const targetDate = new Date();
    const todayStr = getEspnDateStr(targetDate);
    const espnPaths = Array.from(new Set(Object.values(ESPN_LEAGUES)));

    console.log(`Starting server-side schedule scrape for date ${todayStr}...`);

    const promises = espnPaths.map(path => fetchEspnSchedule(path, todayStr));
    const results = await Promise.all(promises);
    const validResults = results.filter(r => r && r.data && r.data.events && r.data.events.length > 0);

    const cacheData = { fetchDate: todayStr, leagues: validResults };

    if (!fs.existsSync('data')) fs.mkdirSync('data');
    fs.writeFileSync(`data/schedule.json`, JSON.stringify(cacheData, null, 2));

    console.log(`Saved ${validResults.length} ESPN league responses to data/schedule.json`);
}

run();

/* Tests unitaires des parseurs (jsdom) : exécutés par `npm test`, sans réseau.
   Couvre les découvertes du 2026-09-02 :
   - OnHockey : grille schedule_table.php, lecteurs déballés (np_stream400.php / np_youtube.php)
   - extractStreamLinks : Sportsurge (.stream-item[data-href]), lecteurs "/?stream_id=", nettoyage
     des liens sociaux et des clones partenaires, iframe nommée par son hôte
   - MLBBite : statut en direct / terminé et heure relative
   - Streameast : liens de miroirs en ouverture externe (topLevel) */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://ouellettejeanphilippe-source.github.io/footy/' });
    const w = dom.window;
    w.__NO_AUTOSTART__ = true;
    for (const k of ['window', 'document', 'DOMParser', 'localStorage', 'navigator', 'HTMLElement', 'Event', 'CustomEvent', 'location', 'history', 'getComputedStyle']) {
        Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
    }
    globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

    const scrapers = await import('../js/scrapers.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    // ── OnHockey ───────────────────────────────────────────────────────────
    assert.strictEqual(scrapers.unwrapOnHockeyPlayer("np_stream400.php?channel=//embedsports.me/nhl/nhl-network-stream-1"), 'https://embedsports.me/nhl/nhl-network-stream-1');
    assert.strictEqual(scrapers.unwrapOnHockeyPlayer('https://onhockey.tv/np_stream400.php?channel=//cdnlivetv.is/api/v1/channels/player/?name=nhl+network%26code=us'), 'https://cdnlivetv.is/api/v1/channels/player/?name=nhl+network&code=us');
    assert.strictEqual(scrapers.unwrapOnHockeyPlayer('np_youtube.php?channel=SfoxJmONsPQ'), 'https://www.youtube.com/embed/SfoxJmONsPQ');
    assert.strictEqual(scrapers.unwrapOnHockeyPlayer('np_stream400.php?channel='), 'https://onhockey.tv/np_stream400.php?channel=');
    assert.strictEqual(scrapers.unwrapOnHockeyPlayer('//embedsports.me/nhl/x'), 'https://embedsports.me/nhl/x');
    ok('unwrapOnHockeyPlayer déballe les lecteurs OnHockey');

    const ohHtml = `<table id='gametable'><tbody class='NA'>
      <tr align="center"><td></td><td><b>NHL</b></td><td><a href='standings_lr.php'>draw</a></td></tr>
      <tr class='game'><td><text class='game_hour'>19</text>:30</td><td>Montreal Canadiens - Toronto Maple Leafs
        <div class='gamelinks'>english: <a href='np_stream400.php?channel=//embedsports.me/nhl/montreal-canadiens-vs-toronto-maple-leafs-stream-1' title='Canadiens'>plytvme</a>
        french: <a href='np_youtube.php?channel=SfoxJmONsPQ' title='RDS'>yt</a></div></td><td class='liveon'></td></tr>
    </tbody></table>`;
    const oh = scrapers.parseOnHockey(ohHtml);
    assert.strictEqual(oh.length, 1);
    assert.ok(/^\d{2}:\d{2}$/.test(oh[0].startTime) && oh[0].startTime !== '00:00', 'heure GMT convertie: ' + oh[0].startTime);
    assert.strictEqual(oh[0].streamLinks.length, 2);
    assert.strictEqual(oh[0].streamLinks[0].url, 'https://embedsports.me/nhl/montreal-canadiens-vs-toronto-maple-leafs-stream-1');
    assert.strictEqual(oh[0].streamLinks[1].url, 'https://www.youtube.com/embed/SfoxJmONsPQ');
    assert.strictEqual(oh[0].streamLinks[1].lang, 'FR');
    ok('parseOnHockey lit schedule_table.php et renvoie des lecteurs directs');

    // ── extractStreamLinks ─────────────────────────────────────────────────
    const m = { matchUrl: 'https://v2.sportsurge.net/watch-baseball-streams/watch-63082-baseball-san-diego-padres-cincinnati-reds-8/', homeTeam: 'Cincinnati Reds', awayTeam: 'San Diego Padres', league: 'MLB', source: 'sportsurge' };
    const ssHtml = `<html><body>
      <div class="stream-item" data-href="https://dudestream1.com/ekiy25"><span class="stream-row-site-name">Dudestream1</span><span class="stream-row-spec">1080p</span><span class="stream-row-spec">english</span></div>
      <div class="stream-item" data-href="http://gstream24.fun/?stream_id=63082"><span class="stream-row-site-name">Gstream24</span><span class="stream-row-spec">720p</span></div>
      <div class="stream-item" data-href="https://x.com/CrackStreamsMe9"><span class="stream-row-site-name">Follow us</span></div>
      <a href="https://thestreameast.top/mlb/san-diego-padres-cincinnati-reds/44002336" target="_blank">Watch</a>
      <a href="https://x.com/CrackStreamsMe9" target="_blank">Follow Us To Watch More Games</a>
      <a href="https://www.youtube.com/embed/abc123XYZ" target="_blank">YouTube</a>
      <iframe src="https://embedsports.me/mlb/san-diego-padres-vs-cincinnati-reds-stream-1"></iframe>
    </body></html>`;
    const links = scrapers.extractStreamLinks(ssHtml, m);
    const urls = links.map((l) => l.url);
    assert.ok(urls.includes('https://dudestream1.com/ekiy25'), 'lecteur Sportsurge conservé');
    assert.ok(urls.includes('http://gstream24.fun/?stream_id=63082'), 'lecteur "/?stream_id=" conservé');
    assert.ok(urls.includes('https://embedsports.me/mlb/san-diego-padres-vs-cincinnati-reds-stream-1'), 'iframe conservée');
    assert.ok(urls.includes('https://www.youtube.com/embed/abc123XYZ'), 'lecteur YouTube embarqué conservé');
    assert.ok(!urls.some((u) => /x\.com|thestreameast\.top/.test(u)), 'liens sociaux et clones partenaires écartés: ' + urls.join(','));
    assert.ok(links.find((l) => l.url.indexOf('embedsports') >= 0).name.indexOf('embedsports.me') >= 0, 'iframe nommée par son hôte');
    const ss = links.find((l) => l.url === 'https://dudestream1.com/ekiy25');
    assert.strictEqual(ss.quality, '1080p');
    assert.strictEqual(ss.lang, 'EN');
    ok('extractStreamLinks garde les lecteurs et écarte les faux liens');

    assert.strictEqual(scrapers.isJunkStreamHost('x.com', '/foo'), true);
    assert.strictEqual(scrapers.isJunkStreamHost('www.youtube.com', '/embed/abc'), false);
    assert.strictEqual(scrapers.isJunkStreamHost('www.youtube.com', '/@channel'), true);
    assert.strictEqual(scrapers.isJunkStreamHost('embedsports.me', '/nfl/x'), false);
    ok('isJunkStreamHost');

    // Repli : aucune source de lecteur -> lien vers la page du match (ouverture externe)
    const empty = scrapers.extractStreamLinks('<html><body><p>rien</p></body></html>', { matchUrl: 'https://mlbbite.plus/watch/live/a-at-b-15-free-live-stream', homeTeam: 'B', awayTeam: 'A', league: 'MLB', source: 'mlbbite' });
    assert.strictEqual(empty.length, 1);
    assert.strictEqual(empty[0].topLevel, true);
    ok('repli "Page du match" marqué topLevel');

    // ── Sportsurge : <base href> ───────────────────────────────────────────
    const ssList = `<html><head><base href="https://v2.sportsurge.net/"></head><body>
      <a href="watch-63082-baseball-san-diego-padres-cincinnati-reds-8/" class="match-row" title="San Diego Padres - Cincinnati Reds">
        <span class="match-row-team-name">San Diego Padres</span><span class="match-row-team-name">Cincinnati Reds</span>
        <span class="match-time" data-timestamp="1788367200">12:40</span><span class="match-row-mobile-category">Baseball</span></a>
    </body></html>`;
    const ssm = scrapers.parseSportsurge(ssList, 'https://v2.sportsurge.net/watch-baseball-streams/');
    assert.strictEqual(ssm.length, 1);
    assert.strictEqual(ssm[0].matchUrl, 'https://v2.sportsurge.net/watch-63082-baseball-san-diego-padres-cincinnati-reds-8/');
    const ssm2 = scrapers.parseSportsurge(ssList.replace(/<base[^>]*>/, ''), 'https://v2.sportsurge.net/watch-baseball-streams/');
    assert.strictEqual(ssm2[0].matchUrl, 'https://v2.sportsurge.net/watch-baseball-streams/watch-63082-baseball-san-diego-padres-cincinnati-reds-8/');
    ok('parseSportsurge résout les liens relatifs contre <base href>');

    // ── MLBBite ────────────────────────────────────────────────────────────
    const mlbHtml = `<div>
      <a href="/watch/live/san-diego-padres-at-cincinnati-reds-15-free-live-stream" class="inline-match-item live-background match-with-result">
        <div class="first-team"><div class="team---item"><b>Reds</b></div></div>
        <div class="result-wrap"><span class="result-status-text live">Live</span><b title="9 minutes ago" class="match-date"><span>0 - 2</span></b></div>
        <div class="second-team"><div class="team---item"><b>Padres</b></div></div></a>
      <a href="/watch/live/atlanta-braves-at-washington-nationals-28-free-live-stream" class="inline-match-item">
        <div class="first-team"><div class="team---item"><b>Nationals</b></div></div>
        <div class="result-wrap"><b title="15 minutes from now" class="match-date">15 minutes from now</b></div>
        <div class="second-team"><div class="team---item"><b>Braves</b></div></div></a>
      <a href="/watch/live/new-york-mets-at-tampa-bay-rays-7-free-live-stream" class="inline-match-item match-with-result">
        <div class="first-team"><div class="team---item"><b>Rays</b></div></div>
        <div class="result-wrap"><span class="result-status-text ">Finished</span><b class="match-date">3 hours ago</b></div>
        <div class="second-team"><div class="team---item"><b>Mets</b></div></div></a>
    </div>`;
    const mlb = scrapers.parseMlbbite(mlbHtml);
    assert.strictEqual(mlb.length, 3);
    assert.strictEqual(mlb[0].status, 'live');
    assert.strictEqual(mlb[1].status, 'upcoming');
    assert.ok(/^\d{2}:\d{2}$/.test(mlb[1].startTime) && mlb[1].startTime !== '00:00', 'heure relative convertie: ' + mlb[1].startTime);
    assert.strictEqual(mlb[2].status, 'finished');
    ok('parseMlbbite : statut et heure relative');

    // ── Streameast ─────────────────────────────────────────────────────────
    const seHtml = `<ul><li><a href="https://www.streameast.ms/mlb/atlanta-braves-vs-washington-nationals-5/">Atlanta Braves vs Washington Nationals</a> 13:05</li></ul>`;
    const se = scrapers.parseStreameast(seHtml);
    assert.ok(se.length >= 1);
    assert.strictEqual(se[0].streamLinks[0].topLevel, true);
    ok('parseStreameast : liens des miroirs en ouverture externe');

    console.log(`unit_scrapers: ${n} groupes de tests OK`);
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

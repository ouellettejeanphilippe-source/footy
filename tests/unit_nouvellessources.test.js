/* Sources ajoutées le 9 octobre 2026 (ppv, daddylive, watchsports, isportsurge, crichd) et
   nouveau gabarit de Methstreams. Gabarits figés, réduits aux formes relevées ce jour-là
   avec scripts/sonder_domaine.mjs : rien ici ne dépend du réseau ni de l'heure (les
   instants de ppv sont en 2000 et en 2100). */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
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

  const S = await import('../js/scrapers.js');
  const C = await import('../js/config.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  // ── Affiche ───────────────────────────────────────────────────────────────
  assert.deepStrictEqual(S.separerAffiche('Galatasaray vs Kasimpasa'), { home: 'Galatasaray', away: 'Kasimpasa' });
  assert.deepStrictEqual(S.separerAffiche('Texas A&M Aggies at Missouri Tigers'), { home: 'Missouri Tigers', away: 'Texas A&M Aggies' },
    '« visiteur at local » : les camps s\'inversent');
  assert.deepStrictEqual(S.separerAffiche('Edmonton @ Calgary'), { home: 'Calgary', away: 'Edmonton' });
  assert.strictEqual(S.separerAffiche('WWE Friday Night SmackDown'), null);
  ok('separerAffiche : vs, v, at, @ ; null sans deux camps');

  // ── Methstreams : l'index de recherche ───────────────────────────────────
  const meth = `<html><body><a href="/event/m-a-vs-b">A vs B</a>
    <script type="application/json" id="searchIndex">[
      {"t":"Fox Cricket","u":"/event/fox-cricket","g":"24/7 Channels","p":"","w":-3600000,"l":0,"e":0},
      {"t":"Galatasaray vs Kasimpasa","u":"/event/m-galatasaray-vs-kasimpasa-1009","g":"Süper Lig","p":"","w":1791565200000,"l":1,"e":0},
      {"t":"Heidenheim vs Kaiserslautern","u":"/event/m-heidenheim-vs-kaiserslautern-1009","g":"Bundesliga 2","p":"","w":1791563400000,"l":0,"e":1},
      {"t":"Galatasaray vs Kasimpasa","u":"/event/m-galatasaray-vs-kasimpasa-1009","g":"Süper Lig","p":"","w":1791565200000,"l":1,"e":0}
    ]</script></body></html>`;
  const mm = S.parseMethstreams(meth, 'https://methstreams.st/home');
  assert.strictEqual(mm.length, 2, 'chaînes 24/7 écartées, doublon d\'adresse écarté');
  assert.strictEqual(mm[0].matchUrl, 'https://methstreams.st/event/m-galatasaray-vs-kasimpasa-1009');
  assert.strictEqual(mm[0].homeTeam.toLowerCase().indexOf('galatasaray') >= 0, true);
  assert.strictEqual(mm[0].startTime, '13:00', '17:00 UTC = 13:00 à New York');
  assert.strictEqual(mm[0].matchDate, '2026-10-09');
  assert.strictEqual(mm[0].status, 'live');
  assert.strictEqual(mm[1].status, 'finished');
  assert.strictEqual(S.parseMethstreamsIndex('<script id="searchIndex" type="application/json">pas du json</script>', 'https://x.test/').length, 0);
  ok('Methstreams : la grille vient de l\'index JSON, à l\'instant près');

  // ── ppv ──────────────────────────────────────────────────────────────────
  const ppv = JSON.stringify({ streams: [
    { category: '24/7 Streams', streams: [{ name: 'NFL Network', always_live: 1, starts_at: 0, iframe: 'https://embed.test/nfl-network' }] },
    { category: 'American Football', streams: [
      { name: 'Texas A&M Aggies at Missouri Tigers', tag: 'College Football', source_tag: 'ABC', starts_at: 4102444800, ends_at: 4102459200, always_live: 0,
        iframe: 'https://embed.test/cfb/tam-miz', substreams: [{ source_tag: 'SkyCast', iframe: 'https://embed.test/cfb/tam-miz/skycast' }, { source_tag: 'ABC', iframe: 'https://embed.test/cfb/tam-miz' }] },
      { name: 'Old Game at Older Team', tag: 'NFL', starts_at: 946684800, ends_at: 946699200, always_live: 0, iframe: 'https://embed.test/old' },
      { name: 'Sans lecteur at Personne', tag: 'NFL', starts_at: 4102444800, always_live: 0, iframe: '' },
    ] },
  ] });
  const pp = S.parsePpv(ppv, 'https://api.ppv.st/api/streams');
  assert.strictEqual(pp.length, 2, 'chaîne permanente et événement sans lecteur écartés');
  assert.strictEqual(pp[0].awayTeam.toLowerCase().indexOf('texas') >= 0, true, 'le visiteur est à gauche du « at »');
  assert.deepStrictEqual(pp[0].streamLinks.map((l) => [l.name, l.url]), [['ABC', 'https://embed.test/cfb/tam-miz'], ['SkyCast', 'https://embed.test/cfb/tam-miz/skycast']],
    'le lecteur principal puis les flux de secours, sans doublon');
  assert.strictEqual(pp[0].status, 'upcoming');
  assert.strictEqual(pp[1].status, 'finished');
  assert.strictEqual(pp[0].matchUrl, 'https://api.ppv.st/api/streams', 'le match pointe vers la source : le serveur ne le relit pas');
  assert.deepStrictEqual(S.parsePpv('<!doctype html>'), []);
  ok('ppv : un match par événement, avec ses lecteurs');

  // ── daddylive ────────────────────────────────────────────────────────────
  const dl = `<div class="schedule__day"><div class="schedule__dayTitle">Friday 09th Oct 2026 - Schedule Time UK GMT</div>
    <div class="schedule__category"><div class="card__meta">Upcoming Events</div>
      <div class="schedule__event"><span class="schedule__time">05:00</span><span class="schedule__eventTitle">🥊 Tyson Fury vs Anthony Joshua Fight live on Friday, December 11, 2026</span>
        <div class="schedule__channels"><a href="/watch.php?id=5000">Netflix</a></div></div></div>
    <div class="schedule__category"><div class="card__meta">Ireland Republic ⚽</div>
      <div class="schedule__event"><span class="schedule__time">18:45</span><span class="schedule__eventTitle">⚽ Ireland Republic - FAI Cup : Bohemians 🇮🇪 vs Waterford United 🇮🇪</span>
        <div class="schedule__channels"><a href="/watch.php?id=365">RTE 2 Ireland</a><a href="/watch.php?id=365">RTE 2 Ireland</a></div></div>
      <div class="schedule__event"><span class="schedule__time">22:00</span><span class="schedule__eventTitle">⚽ College Soccer : Virginia 🇺🇸 vs California 🇺🇸</span>
        <div class="schedule__channels"><a href="/watch.php?id=00">📢 Channel Not Listed</a></div></div></div>
    <div class="schedule__category"><div class="card__meta">Boxing 🥊</div>
      <div class="schedule__event"><span class="schedule__time">16:00</span><span class="schedule__eventTitle">🥊 New School Promotion : Pylyp Akilov vs. Kenedy Ayoo</span>
        <div class="schedule__channels"><a href="/watch.php?id=161">Sport 2 Hungary</a></div></div>
      <div class="schedule__event"><span class="schedule__time">00:00</span><span class="schedule__eventTitle">🥊 Boxing : Luis Castillo vs Jorge Zarate</span>
        <div class="schedule__channels"><a href="/watch.php?id=82">ESPN2 BR</a><a href="/watch.php?id=375">ESPN Deportes</a></div></div>
      <div class="schedule__event"><span class="schedule__time">00:00</span><span class="schedule__eventTitle">🤼 WWE Friday Night SmackDown</span>
        <div class="schedule__channels"><a href="/watch.php?id=343">USA Network</a></div></div></div>
  </div>`;
  const dd = S.parseDaddylive(dl, 'https://dlive.sx/');
  assert.deepStrictEqual(dd.map((m) => m.startTime + ' ' + m.matchDate), ['14:45 2026-10-09', '12:00 2026-10-09', '20:00 2026-10-09'],
    'UTC converti ; « 00:00 » après « 16:00 » dans la catégorie appartient au lendemain (20 h la veille à New York)');
  assert.deepStrictEqual(dd[0].streamLinks.map((l) => l.url), ['https://dlive.sx/watch.php?id=365'], 'chaîne en double fusionnée');
  assert.deepStrictEqual(dd[2].streamLinks.map((l) => l.name), ['ESPN2 BR', 'ESPN Deportes']);
  assert.ok(dd.every((m) => m.matchUrl === 'https://dlive.sx/'));
  assert.ok(!dd.some((m) => /Fury|Virginia|SmackDown/.test(m.homeTeam + m.awayTeam)),
    'écartés : « Upcoming Events » (autres jours), chaîne non listée, émission sans affiche');
  ok('daddylive : programme du jour, chaînes en lecteurs, passage de minuit');

  {
    const M = await import('../js/match.js');
    const chaine = { url: 'https://dlive.sx/watch.php?id=38', programme: true };
    const regie = { url: 'https://regie.test/4/1' };
    const grille = [
      { league: 'Cricket', streamLinks: [Object.assign({}, chaine), Object.assign({}, regie)] },
      { league: 'PGA Tour', streamLinks: [Object.assign({}, chaine), Object.assign({}, regie)] },
    ];
    const decor = M.adressesNonSpecifiques(grille);
    assert.ok(decor['https://regie.test/4/1'], 'une adresse sans programme qui traverse les sports reste du décor');
    assert.ok(!decor['https://dlive.sx/watch.php?id=38'], 'une chaîne rattachée par le programme n\'en est pas');
    ok('la règle du décor épargne les chaînes rattachées par un programme');
  }

  // ── watchsports ──────────────────────────────────────────────────────────
  const ws = `<ul>
    <li><a href="/football/tur.1/401888280" class="game-row matchup is-live" aria-label="Galatasaray vs Kasimpasa - Live - 9 streams - Turkish Super Lig"><time datetime="2026-10-09T13:00:00-04:00">x</time></a></li>
    <li><a href="/cfb/401858254" class="game-row matchup" aria-label="Florida St vs Louisville - 10/09 07:00 PM - 7 streams - L&amp;N Federal Credit Union Stadium"><time datetime="2026-10-09T19:00:00-04:00">x</time></a></li>
    <li><a href="/cfb/401858254" class="game-row matchup" aria-label="Florida St vs Louisville - doublon">x</a></li>
    <li><a href="/news/1" class="game-row" aria-label="Nouvelles du jour">x</a></li>
  </ul>`;
  const wm = S.parseWatchsports(ws, 'https://watchsports.su/');
  assert.strictEqual(wm.length, 2);
  assert.strictEqual(wm[0].status, 'live');
  assert.strictEqual(wm[0].matchUrl, 'https://watchsports.su/football/tur.1/401888280');
  assert.ok(/turk|super|süper/i.test(wm[0].league), 'football : la compétition donne la ligue (' + wm[0].league + ')');
  assert.strictEqual(wm[1].startTime, '19:00');
  assert.ok(!/stadium/i.test(wm[1].league), 'hors football : le sport de l\'adresse, pas le stade (' + wm[1].league + ')');
  ok('watchsports : une ligne par match, heure ISO, ligue par sport ou compétition');

  // ── isportsurge ──────────────────────────────────────────────────────────
  const isp = `<a class="row MaclariListele" href="https://isportsurge.ws/watch/nhl/pittsburgh-penguins-columbus-blue-jackets/442015584">
      <span>Columbus Blue Jackets</span><span>Pittsburgh Penguins</span><div>7 hours from now</div>
      <img alt="Watch NHL: Columbus Blue Jackets vs Pittsburgh Penguins" src="x.png"></a>
    <a class="row MaclariListele" href="https://isportsurge.ws/watch/nhl"><img alt="logo"></a>`;
  const im = S.parseIsportsurge(isp, 'https://isportsurge.ws/index8');
  assert.strictEqual(im.length, 1);
  assert.ok(/columbus/i.test(im[0].homeTeam) && /pittsburgh/i.test(im[0].awayTeam));
  assert.strictEqual(im[0].status, 'upcoming');
  assert.strictEqual(im[0].league, 'NHL');
  ok('isportsurge : l\'affiche est lue dans le texte de l\'image');

  // ── cdnlivetv ────────────────────────────────────────────────────────────
  {
    const maintenant = Date.UTC(2026, 9, 9, 16, 0);
    const api = JSON.stringify({ 'cdn-live-tv': {
      NFL: [
        { event: 'BC Lions vs Ottawa Redblacks', homeTeam: 'BC Lions', awayTeam: 'Ottawa Redblacks', tournament: 'CFL', status: 'NS', start: '2026-10-10 02:00',
          channels: [{ channel_name: 'TSN 1 FHD CA', url: 'https://cdnlivetv.test/player/?name=TSN%201' }, { channel_name: 'TSN 1 FHD CA', url: 'https://cdnlivetv.test/player/?name=TSN%201' }] },
        { event: 'Sans chaîne', homeTeam: 'A', awayTeam: 'B', status: 'NS', start: '2026-10-10 02:00', channels: [] },
        { event: 'Annulé', homeTeam: 'Aa', awayTeam: 'Bb', status: 'CANC', start: '2026-10-10 02:00', channels: [{ url: 'https://x.test/' }] },
        { event: 'En février', homeTeam: 'Aa', awayTeam: 'Bb', status: 'NS', start: '2027-02-07 23:30', channels: [{ url: 'https://x.test/' }] },
      ],
      total_events: 4, cached: true,
    } });
    const cd = S.parseCdnlivetv(api, 'https://api.cdnlivetv.test/', maintenant);
    assert.strictEqual(cd.length, 1, 'sans chaîne, annulé, hors fenêtre de 48 h : écartés');
    assert.strictEqual(cd[0].startTime, '22:00', '02:00 UTC = 22:00 la veille à New York');
    assert.strictEqual(cd[0].matchDate, '2026-10-09');
    assert.deepStrictEqual(cd[0].streamLinks.map((l) => l.name), ['TSN 1 FHD CA']);
    assert.ok(cd[0].streamLinks[0].programme);
    ok('cdnlivetv : événements avec chaînes, heure UTC, fenêtre de 48 h');
  }

  // ── bintv ────────────────────────────────────────────────────────────────
  {
    const api = JSON.stringify({
      'Live Events': [{ name: 'Lens vs Olympique Lyonnais', category: 'Soccer', status: 'live', streams: [{ name: 'beIN SPORTS CONNECT', url: 'https://relais.test/?id=1' }] }],
      'Upcoming Events': [
        { name: 'Afghanistan vs Bangladesh in UAE 2026 - One-off Test - Afghanistan vs Bangladesh', category: 'Cricket', status: 'upcoming', streams: [{ name: 'Willow HD', url: 'https://relais.test/?id=2' }] },
        { name: 'Werder Bremen @ Borussia Dortmund', category: 'Soccer', status: 'upcoming', streams: [{ name: 'DAZN', url: 'https://relais.test/?id=3' }] },
        { name: 'Brighton &amp;amp; Hove Albion vs Fulham', category: 'Soccer', status: 'upcoming', streams: [] },
      ],
      '24/7 Channels': [{ name: 'Sky Sports', streams: [{ url: 'https://relais.test/?id=4' }] }],
    });
    const bt = S.parseBintv(api, 'https://bintvjson.test/');
    assert.strictEqual(bt.length, 3, 'chaînes permanentes et événement sans flux écartés');
    assert.strictEqual(bt[0].status, 'upcoming', 'le « live » de bintv, posé trop tôt, n\'est pas repris');
    assert.ok(/afghanistan/i.test(bt[1].homeTeam) && /bangladesh/i.test(bt[1].awayTeam), 'le dernier segment qui oppose deux camps');
    assert.ok(/dortmund/i.test(bt[2].homeTeam), '« visiteur @ local »');
    assert.strictEqual(bt[0].startTime, '00:00', 'pas d\'heure : rattachement par les noms');
    ok('bintv : événements à venir et en cours, sans heure, chaînes permanentes écartées');
  }

  // ── olympicweb / fbstream ────────────────────────────────────────────────
  {
    const grille = `<a data-bs-toggle="collapse" data-bs-target="#1" href="/live-sky-sports-news-stream" title="Sky Sports News">Sky Sports News</a>
      <a data-bs-toggle="collapse" data-bs-target="#2" href="/live-al-fateh-vs-al-ahli-stream" title="Al Fateh v Al Ahli"><span content="2026-10-09T15:55">15:55</span> Al Fateh v Al Ahli</a>`;
    const ol = S.parseOlympicweb(grille, 'https://olympicweb.me/live/soccer-stream');
    assert.strictEqual(ol.length, 1, 'chaîne permanente (sans heure) écartée');
    assert.strictEqual(ol[0].startTime, '10:55', '15:55 à Londres (BST) = 10:55 à New York');
    assert.strictEqual(ol[0].matchUrl, 'https://olympicweb.me/live-al-fateh-vs-al-ahli-stream');
    assert.strictEqual(ol[0].source, 'olympicweb');
    const fb = S.parseOlympicweb('<a data-bs-toggle="collapse" href="/live/stream/detroit-red-wings-vs-seattle-kraken" title="Detroit Red Wings - Seattle Kraken"><span content="2026-10-10T00:00">00:00</span></a>', 'https://fbstream.is/stream/nhl');
    assert.strictEqual(fb.length, 1);
    assert.ok(/detroit/i.test(fb[0].homeTeam) && /seattle/i.test(fb[0].awayTeam), 'titre « Home - Away »');
    assert.strictEqual(fb[0].source, 'fbstream');
    assert.strictEqual(fb[0].league, 'NHL');

    const page = `<nav><a href="/stream/football">Live Football</a></nav>
      <a href="https://budgetezy.org/4/192e375ae107ee49a678d22a4b0111c8">Al Fateh v Al Ahli</a>
      <button data-uri="/al-fateh-vs-al-ahli-live-stream/1/">Live Stream 1</button>
      <button data-uri="/al-fateh-vs-al-ahli-live-stream/2/">Live Stream 2</button>
      <a class="dropdown-item" data-uri="/al-fateh-vs-al-ahli-live-stream/1/">Live Stream 1</a>`;
    const liens = S.extractStreamLinks(page, { matchUrl: 'https://olympicweb.me/live-al-fateh-vs-al-ahli-stream', source: 'olympicweb', homeTeam: 'Al Fateh', awayTeam: 'Al Ahli', streamLinks: [] });
    assert.deepStrictEqual(liens.map((l) => l.url).sort(), ['https://olympicweb.me/al-fateh-vs-al-ahli-live-stream/1/', 'https://olympicweb.me/al-fateh-vs-al-ahli-live-stream/2/'],
      'les boutons data-uri seulement : ni la navigation, ni la régie (seulementSesLiens)');
    ok('olympicweb / fbstream : grille à l\'heure de Londres, diffusions en boutons data-uri');
  }

  // ── totalsportek, relais et régies ───────────────────────────────────────
  {
    const page = `<table><tr class="custom-stream-row"><td>NBA League Pass</td>
      <td><a href="https://hitcast.st/totview.php?src=https://vertex.st/ch?id=3">Watch</a></td></tr>
      <tr><td><a href="https://knowacaliforniafarmer.com/4/277c0c6540f884f7bc917ebc7fa8b568">Dragons vs Ospreys FULL</a></td></tr></table>`;
    const liens = S.finalizeStreamLinks(S.extractStreamLinks(page, { matchUrl: 'https://total-sportekk.st/events/a-vs-b', source: 'totalsportek', homeTeam: 'A', awayTeam: 'B', streamLinks: [] }));
    assert.ok(liens.some((l) => l.url === 'https://vertex.st/ch?id=3'), 'le relais totview est déballé');
    assert.ok(!liens.some((l) => /totview|knowacaliforniafarmer/.test(l.url)), 'ni relais ni régie /4/<hex>');
    assert.strictEqual(S.isJunkStreamPath('https://hai8g.com/4/8553101'), true);
    assert.strictEqual(S.isJunkStreamPath('https://budgetezy.org/4/192e375ae107ee49a678d22a4b0111c8'), true);
    assert.strictEqual(S.isJunkStreamPath('https://embed.st/embed/admin/ppv-a-vs-b/1'), false);
    assert.strictEqual(S.isJunkStreamPath('https://dlive.sx/stream/stream-46.php'), false);
    ok('totalsportek : relais déballé, régie à identifiant hexadécimal écartée');
  }

  // ── watchfooty ───────────────────────────────────────────────────────────
  {
    const api = JSON.stringify([
      { title: 'Al Fateh vs Al Ahli', teams: { home: { name: 'Al Fateh' }, away: { name: 'Al Ahli' } }, status: 'in', timestamp: 1791565200000, league: 'Saudi Pro League',
        streams: [{ url: 'https://sportsembed.test/embed/1/a/deluxe/1', source: 'deluxe', language: 'English', quality: 'HD' }, { url: 'https://nsfw.test/', nsfw: true }] },
      { title: 'Sans flux', teams: { home: { name: 'Aa' }, away: { name: 'Bb' } }, status: 'pre', timestamp: 1791565200000, streams: [] },
      { title: 'Fini', teams: { home: { name: 'Aa' }, away: { name: 'Bb' } }, status: 'post', timestamp: 1791565200000, streams: [{ url: 'https://x.test/1' }] },
    ]);
    const wf = S.parseWatchfooty(api, 'https://api.watchfooty.test/api/v1/matches/football');
    assert.strictEqual(wf.length, 1, 'sans flux, terminé : écartés');
    assert.strictEqual(wf[0].status, 'live');
    assert.strictEqual(wf[0].startTime, '13:00');
    assert.deepStrictEqual(wf[0].streamLinks.map((l) => l.name), ['deluxe · English'], 'le flux « nsfw » est écarté');
    ok('watchfooty : matchs avec lecteurs, statut in/pre, instant en millisecondes');
  }

  // ── mybuffstreams et le moteur new-stream-embed ──────────────────────────
  {
    const grille = `<div class="top-tournament"><h2 class="league-name">Upcoming NHL Streams Links</h2><ul class="competitions">
        <li><a class="competition" title="Buffstreams Washington Capitals vs New York Rangers" href="https://mybuffstreams.test/nhl/caps-rangers/1">
          <span class="competition-cell-side1"><span class="name"> Washington Capitals </span></span>
          <time datetime="2026-10-09 23:00:00">7:00 PM</time>
          <span class="competition-cell-side2"><span class="name"> New York Rangers </span></span></a></li></ul></div>
      <div class="top-tournament"><h2 class="league-name">Upcoming Boxing Streams Links</h2><ul class="competitions">
        <li><a class="d-block competition" href="https://mybuffstreams.test/title-game/boxing/a-vs-b-live-streams-links">
          <div> Zaur Abdullaev vs Khariton Agrba - 11:00 AM ET </div><small>22 hours from now</small></a></li></ul></div>`;
    const mb = S.parseMybuffstreams(grille, 'https://mybuffstreams.test/home6');
    assert.strictEqual(mb.length, 2);
    assert.strictEqual(mb[0].startTime, '19:00', '23:00 UTC = 19:00 à New York');
    assert.strictEqual(mb[0].league, 'NHL', 'la ligue vient du titre de la section');
    assert.ok(/agrba/i.test(mb[1].awayTeam) && !/from now|ET/.test(mb[1].awayTeam), 'combat : « A vs B - 11:00 AM ET », sans la date relative');
    assert.strictEqual(mb[1].startTime, '11:00');

    const page = `<iframe id="cx-iframe" src="https://gooz.test/new-stream-embed/"></iframe>
      <button id="stream-btn-48213" onclick="changeStream(48213)">HD English</button>
      <button id="stream-btn-48214" onclick="changeStream(48214)">SD</button>
      <script>window.changeStream = function (streamId){ document.getElementById('cx-iframe').src='https://gooz.test/new-stream-embed/' + streamId }</script>`;
    const liens = S.finalizeStreamLinks(S.extractStreamLinks(page, { matchUrl: 'https://mybuffstreams.test/nhl/caps-rangers/1', source: 'mybuffstreams', homeTeam: 'Washington Capitals', awayTeam: 'New York Rangers', streamLinks: [] }));
    assert.deepStrictEqual(liens.map((l) => l.url).sort(), ['https://gooz.test/new-stream-embed/48213', 'https://gooz.test/new-stream-embed/48214'],
      'un lecteur par bouton, jamais l\'iframe vide');
    ok('mybuffstreams : grille par section, combats ; lecteurs reconstruits depuis changeStream');
  }

  // ── freestreams ──────────────────────────────────────────────────────────
  {
    // HTML mal imbriqué comme celui du site : </td></div> fait sortir les boutons du conteneur.
    const page = `<table><tbody id="myTable">
      <tr data-timestamp="1791556200000"><td class="matchtime"></td><td><div><span class="leaguename">Second League</span></td></div>
        <td class="event-title"><div><span>Yantra vs Vihren Sandanski</span></div></td>
        <td><div class="buttoncontainer"><a href="https://freestreams-live1h.pk/diemasport/">Diema Sport (BG)</a></div></td></tr>
      <tr data-timestamp="1791601200000"><td></td><td><span class="leaguename">Liga MX</span></td>
        <td class="event-title"><span>Tigres UANL vs Toluca</span></td><td><div class="buttoncontainer"></div></td></tr>
    </tbody></table>`;
    const fr = S.parseFreestreams(page, 'https://freestreams-live1i.pk/football-streamz5/');
    assert.strictEqual(fr.length, 1, 'un match sans chaîne (pas encore publiée) est écarté');
    assert.strictEqual(fr[0].startTime, '10:30', '14:30 UTC = 10:30 à New York');
    assert.deepStrictEqual(fr[0].streamLinks.map((l) => l.url), ['https://freestreams-live1h.pk/diemasport/'], 'gardé tel quel : l\'ancien domaine redirige');
    ok('freestreams : une ligne par match, chaînes du site en liens de programme');
  }

  // ── roxiestreams ─────────────────────────────────────────────────────────
  {
    const grille = `<table><tbody>
      <tr><td><a href="/soccer-streams-16">Al Fateh vs Al-Ahli</a></td><td class="event-start-time">October 9, 2026 7:55 AM</td></tr>
      <tr><td><a href="/soccer-streams-17">Sans heure vs Personne</a></td><td>—</td></tr>
    </tbody></table>`;
    const rx = S.parseRoxiestreams(grille, 'https://roxiestreams.su/soccer');
    assert.strictEqual(rx.length, 1);
    assert.strictEqual(rx[0].startTime, '10:55', '7:55 AM à Los Angeles (PDT) = 10:55 à New York');
    assert.strictEqual(rx[0].league, 'Soccer');
    const page = `<button onclick="showPlayer('clappr', getRandomStream('fs2.m3u8', 'tedesco'))">Stream 1</button>
      <script>setTimeout(() => showPlayer('clappr', getRandomStream('fs2.m3u8')), 500);</script>`;
    const liens = S.extractStreamLinks(page, { matchUrl: 'https://roxiestreams.su/soccer-streams-16', source: 'roxiestreams', homeTeam: 'Al Fateh', awayTeam: 'Al Ahli', streamLinks: [] });
    assert.ok(liens.some((l) => l.url === 'https://tedesco.formaturamaxi.com.br/fs2.m3u8'), 'le manifeste HLS est reconstruit');
    assert.strictEqual(liens.filter((l) => /\.m3u8$/.test(l.url)).length, 1, 'une fois, malgré les deux appels');
    ok('roxiestreams : grille à l\'heure du Pacifique, flux HLS reconstruit depuis la page');
  }

  // ── crichd : le repli générique ──────────────────────────────────────────
  const cr = `<a href="/events/south-africa-vs-australia">South Africa vs Australia</a><a href="/events/india-vs-england">India vs England</a>`;
  assert.strictEqual(S.parseCrichd(cr, 'https://crichd.at/').length, 2);
  ok('crichd : grille lue par le repli générique');

  // ── Déclaration : une source n'existe qu'à moitié si elle manque à une table ─
  const ids = C.SCRAPERS_CONFIG.map((sc) => sc.id);
  for (const id of ids) {
    assert.strictEqual(typeof S.PARSEURS[id], 'function', id + ' : parseur absent de PARSEURS');
    assert.ok(C.SOURCE_VAR_NAMES[id], id + ' : clé absente de SOURCE_VAR_NAMES');
    assert.ok(Array.isArray(C.SOURCE_MIRRORS[id]) && C.SOURCE_MIRRORS[id].length, id + ' : miroirs absents');
  }
  assert.deepStrictEqual(Object.keys(S.PARSEURS).sort(), ids.slice().sort(), 'pas de parseur sans source déclarée');
  const domains = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'domains.json'), 'utf8'));
  for (const id of ids) assert.ok(domains[C.SOURCE_VAR_NAMES[id]], id + ' : adresse absente de domains.json');
  for (const id of S.SOURCES_SERVEUR_SEULEMENT) assert.ok(ids.includes(id));
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  assert.ok(/PARSEURS/.test(main) && !/'methstreams':\s*parseMethstreams/.test(main), 'le navigateur lit la table unique');
  for (const f of ['scrape_streams.mjs', 'sonder_domaine.mjs']) {
    assert.ok(/scrapers\.PARSEURS/.test(fs.readFileSync(path.join(__dirname, '..', 'scripts', f), 'utf8')), f + ' lit la table unique');
  }
  ok('chaque source déclarée a son parseur, son adresse, ses miroirs et sa clé dans domains.json');

  // applySourceUrl suit les nouvelles sources
  C.applySourceUrl('ppv', 'https://api.ppv.cx/api/streams');
  assert.strictEqual(C.SCRAPERS_CONFIG.find((s) => s.id === 'ppv').url, 'https://api.ppv.cx/api/streams');
  C.applySourceUrl('ppv', 'https://api.ppv.st/api/streams');
  ok('applySourceUrl déplace aussi les nouvelles sources');

  console.log(`unit_nouvellessources : ${n} groupes OK`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

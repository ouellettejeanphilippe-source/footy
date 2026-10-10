/* La liste de l'appli Android TV (js/tvliste.js → data/tv.json), et les garde-fous du
   projet tv/ lui-même.

   « Mon rêve, c'est une version qui peut marcher sur Chromecast, sans les pubs, en
   prenant le moins de ressources possible » (10 octobre 2026). L'appli ne charge aucune
   page : elle lit le manifeste observé par la vérification, avec le Referer du cadre qui
   l'avait demandé. Ce test verrouille ce qui la rend possible : le Referer voyage de la
   vérification jusqu'au fichier, et le fichier ne garde que ce que la télé peut jouer. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');

async function main() {
  const tv = await import('../js/tvliste.js');
  const play = await import('../js/playability.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  const NOW = Date.parse('2026-10-10T15:00:00Z');
  const il = (min) => new Date(NOW - min * 60000).toISOString();
  const lien = (o) => Object.assign({ name: 'L', url: 'https://site.test/p', source: 'src', verified: 'plays', media: 'https://cdn.test/a.m3u8', mediaAt: il(10) }, o);
  const data = {
    matches: [
      { league: 'NHL', homeTeam: 'A', awayTeam: 'B', matchDate: '2026-10-10', startTime: '19:00', status: 'upcoming',
        streamLinks: [lien({ media: 'https://cdn.test/u.m3u8' })] },
      { league: 'Premier League', homeTeam: 'Arsenal', awayTeam: 'Leeds', matchDate: '2026-10-10', startTime: '10:00', status: 'live',
        streamLinks: [
          lien({ name: 'vieux', media: 'https://cdn.test/v.m3u8', mediaAt: il(60), mediaReferer: 'https://xstream.st/' }),
          lien({ name: 'frais', media: 'https://cdn.test/f.m3u8', mediaAt: il(5) }),
          lien({ name: 'doublon', media: 'https://cdn.test/f.m3u8', mediaAt: il(5) }),
          lien({ name: 'muet', verified: 'none' }),
          lien({ name: 'sans media', media: undefined }),
          lien({ name: 'dash', media: 'https://cdn.test/d.mpd' }),
          lien({ name: 'signé périmé', media: 'https://cdn.test/s.m3u8?e=1&st=x', mediaAt: il(4 * 60) }),
          lien({ name: 'nu périmé', media: 'https://cdn.test/n.m3u8', mediaAt: il(13 * 60) }),
        ] },
      { league: 'MLB', homeTeam: 'C', awayTeam: 'D', status: 'finished', streamLinks: [lien({})] },
      { league: 'NBA', homeTeam: 'E', awayTeam: 'F', status: 'live', streamLinks: [lien({ verified: 'blocked' })] },
    ]
  };

  // 1. Ne garde que les matchs qui ont un flux jouable, en direct d'abord.
  {
    const t = tv.listeTv(data, { now: NOW, agent: 'UA' });
    assert.strictEqual(t.version, tv.VERSION_LISTE_TV);
    assert.strictEqual(t.agent, 'UA');
    assert.deepStrictEqual(t.matchs.map((m) => m.domicile), ['Arsenal', 'A']);
    ok('seuls les matchs non terminés avec un flux jouable, en direct d\'abord');
  }

  // 2. Les liens : jouables, HLS, frais, sans doublon, du plus récent au plus ancien.
  {
    const ls = tv.listeTv(data, { now: NOW }).matchs[0].liens;
    assert.deepStrictEqual(ls.map((l) => l.nom), ['frais', 'vieux']);
    assert.strictEqual(ls[1].referer, 'https://xstream.st/');
    assert.strictEqual(ls[0].referer, '', 'sans Referer observé : vide, pas la page (la page donne 403)');
    assert.strictEqual(ls[0].page, 'https://site.test/p');
    ok('liens jouables, HLS seulement, périmés écartés, Referer observé gardé');
  }

  // 3. Le Referer survit à un nouveau passage du scrape (reporterVerifications).
  {
    const precedent = { matches: [{ streamLinks: [lien({ verifiedAt: il(10), mediaReferer: 'https://xstream.st/' })] }] };
    const nouveaux = [{ streamLinks: [{ url: 'https://site.test/p' }] }];
    play.reporterVerifications(nouveaux, precedent, NOW);
    assert.strictEqual(nouveaux[0].streamLinks[0].mediaReferer, 'https://xstream.st/');
    ok('le Referer voyage avec le verdict d\'un passage à l\'autre');
  }

  // 4. La vérification note le Referer, écrit data/tv.json, et le workflow le publie.
  {
    const v = lire('scripts/verify_players.mjs');
    assert.match(v, /obs\.mediaReferer = r\.request\(\)\.headers\(\)\['referer'\]/);
    assert.match(v, /link\.mediaReferer = obs\.mediaReferer/);
    assert.match(v, /writeFileSync\('data\/tv\.json'/);
    assert.match(lire('scripts/scrape_streams.mjs'), /mediaReferer: l\.mediaReferer/);
    assert.match(lire('.github/workflows/scrape_streams.yml'), /file_pattern: "data\/streams\.json data\/tv\.json"/);
    assert.match(lire('scripts/maj_liens.mjs'), /'data\/tv\.json'/);
    ok('le Referer est capturé, data/tv.json écrit et publié');
  }

  // 5. L'appli TV : sur le lanceur Google TV, sans WebView, et lit le fichier que l'on publie.
  {
    const manifeste = lire('tv/app/src/main/AndroidManifest.xml');
    assert.match(manifeste, /android\.intent\.category\.LEANBACK_LAUNCHER/);
    assert.match(manifeste, /android:banner=/);
    const java = lire('tv/app/src/main/java/ca/local/footytv/MainActivity.java');
    assert.ok(!/WebView/.test(java), 'pas de WebView : c\'est tout l\'intérêt');
    assert.match(java, /raw\.githubusercontent\.com\/ouellettejeanphilippe-source\/footy\/main\/data\/tv\.json/);
    assert.match(lire('tv/app/src/main/java/ca/local/footytv/Liste.java'), new RegExp('VERSION = ' + tv.VERSION_LISTE_TV + ';'));
    ok('appli TV : lanceur Google TV, sans WebView, même fichier et même version');

    // Mode câble : une vidéo démarre seule à l'ouverture, le Live se pose par-dessus,
    // et le téléphone a ses gestes (« faire version téléphone que je teste sans le Chromecast »).
    assert.match(java, /if \(!demarrerSiPossible\(\)\) ouvrirLive\(\);/);
    assert.match(java, /GestureDetector/);
    assert.match(manifeste, /android\.hardware\.touchscreen" android:required="false"/);
    ok('mode câble à l\'ouverture, Live par-dessus, gestes pour le téléphone');
  }

  console.log(`unit_tvliste : ${n} groupes réussis`);
}

main().catch((e) => { console.error(e); process.exit(1); });

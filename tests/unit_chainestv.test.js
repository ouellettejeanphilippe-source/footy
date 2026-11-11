/* La section « Télé » du Live (js/chainestv.js, 10 novembre 2026) : l'analyse de la liste
   Free-TV, le fichier data/chaines.json, le HTML de la section et le chargement. Sans réseau. */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const racine = path.join(__dirname, '..');
const charger = () => import('../js/chainestv.js');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const escJs = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const LISTE = [
  '#EXTM3U',
  '#EXTINF:-1 tvg-name="CBC Toronto" tvg-logo="https://i.example/cbc.png" tvg-country="CA" group-title="Canada",CBC Toronto Ⓖ',
  'https://cbc.example/hls/master5.m3u8',
  '#EXTINF:-1 tvg-name="CTV Toronto" tvg-logo="" group-title="Canada",CTV Toronto',
  'http://ctv.example/1712/index.m3u8',
  '#EXTINF:-1 tvg-name="CTV News" group-title="Canada",CTV News Ⓨ',
  'https://www.youtube.com/c/CTVNews/live',
  '#EXTINF:-1 tvg-name="Noovo" tvg-logo="http://i.example/noovo.png" group-title="Canada",Noovo',
  '#EXTVLCOPT:http-user-agent=x',
  'https://noovo.example/dash/manifest.mpd',
  '#EXTINF:-1 tvg-name="CBC Toronto" group-title="Canada",CBC Toronto',
  'https://cbc.example/autre.m3u8',
  '#EXTINF:-1 tvg-name="Sans adresse" group-title="Canada",Sans adresse',
  '#EXTINF:-1 tvg-name="France 2" group-title="France",France 2',
  'https://f2.example/a.m3u8?x=1',
].join('\n');

test('chainesDeListe : le groupe demandé, en https, HLS ou DASH, sans marque ni doublon', async () => {
  const T = await charger();
  assert.deepStrictEqual(T.chainesDeListe(LISTE, 'Canada'), [
    { id: 'tv_cbctoronto', nom: 'CBC Toronto', url: 'https://cbc.example/hls/master5.m3u8', logo: 'https://i.example/cbc.png' },
    { id: 'tv_noovo', nom: 'Noovo', url: 'https://noovo.example/dash/manifest.mpd', logo: '' },
  ]);
  assert.deepStrictEqual(T.chainesDeListe(LISTE, 'France').map((c) => c.url), ['https://f2.example/a.m3u8?x=1']);
  assert.deepStrictEqual(T.chainesDeListe('', 'Canada'), []);
});

test('estFluxDeChaine : http, YouTube et adresse sans extension sont refusés', async () => {
  const T = await charger();
  assert.strictEqual(T.estFluxDeChaine('https://a.example/x.m3u8'), true);
  assert.strictEqual(T.estFluxDeChaine('https://a.example/x.mpd?t=1'), true);
  assert.strictEqual(T.estFluxDeChaine('http://a.example/x.m3u8'), false);
  assert.strictEqual(T.estFluxDeChaine('https://www.youtube.com/c/CTVNews/live'), false);
  assert.strictEqual(T.estFluxDeChaine('javascript:alert(1)//.m3u8'), false);
});

test('idDeChaine : un identifiant qu\'aucun match ne porte, stable et sans accent', async () => {
  const T = await charger();
  assert.strictEqual(T.idDeChaine('Télé Québec'), 'tv_telequebec');
  assert.strictEqual(T.idDeChaine('CPAC (FR)'), 'tv_cpacfr');
});

test('sectionTele : un bouton par chaîne, qui pose le flux dans le lecteur ; rien sans chaîne', async () => {
  const T = await charger();
  assert.strictEqual(T.sectionTele([], esc, escJs), '');
  const html = T.sectionTele([{ id: 'tv_x', nom: 'L\'<b>Écran</b>', url: 'https://a.example/x.m3u8?a=1&b=2', logo: '' }], esc, escJs);
  assert.match(html, /class="titre-tele"[^>]*><span>Télé<\/span>/);
  assert.strictEqual((html.match(/class="chaine-tv"/g) || []).length, 1);
  assert.ok(html.includes("openFlux(event,&#39;https%3A%2F%2Fa.example%2Fx.m3u8%3Fa%3D1%26b%3D2&#39;"), 'l\'adresse voyage encodée');
  assert.ok(html.includes('&#39;tv_x&#39;,false)'), 'sous l\'identifiant de la chaîne');
  assert.ok(!html.includes('<b>'), 'le nom est échappé');
  assert.ok(!html.includes('<img'), 'pas de logo : pas d\'image');
});

test('chainesValides et chargerChaines : le fichier est revérifié, chaque chaîne sondée, lu une fois, relu après un échec', async () => {
  const T = await charger();
  assert.deepStrictEqual(T.chainesValides(null), []);
  assert.deepStrictEqual(T.chainesValides({ chaines: [{ nom: 'A', url: 'http://a.example/x.m3u8' }, { nom: '', url: 'https://a.example/x.m3u8' }, null] }), []);
  T.oublierChaines();
  let appels = 0;
  const rep = (ok, corps) => Promise.resolve({ ok, text: () => Promise.resolve(corps), json: () => Promise.resolve(JSON.parse(corps)) });
  const fichier = JSON.stringify({ chaines: [
    { nom: 'A', url: 'https://a.example/x.m3u8', logo: 'http://i.example/a.png' },
    { nom: 'Morte', url: 'https://a.example/404.m3u8' },
    { nom: 'Bloquée', url: 'https://a.example/cors.m3u8' },
    { nom: 'Page', url: 'https://a.example/page.m3u8' },
    { nom: 'Dash', url: 'https://a.example/ok.mpd' },
    { nom: 'Chiffrée', url: 'https://a.example/drm.mpd' },
  ] });
  const bon = (u) => {
    if (u === 'data/chaines.json') { appels++; return rep(true, fichier); }
    if (/404/.test(u)) return rep(false, 'Not Found');
    if (/cors/.test(u)) return Promise.reject(new TypeError('Failed to fetch'));
    if (/page/.test(u)) return rep(true, '<html>bloqué dans votre pays</html>');
    if (/drm/.test(u)) return rep(true, '<?xml version="1.0"?><MPD><ContentProtection/></MPD>');
    if (/\.mpd/.test(u)) return rep(true, '<?xml version="1.0"?><MPD type="dynamic"></MPD>');
    return rep(true, '#EXTM3U\n#EXT-X-VERSION:3\n');
  };
  assert.deepStrictEqual(await T.chargerChaines(bon), [
    { id: 'tv_a', nom: 'A', url: 'https://a.example/x.m3u8', logo: '' },
    { id: 'tv_dash', nom: 'Dash', url: 'https://a.example/ok.mpd', logo: '' },
  ], 'seules les chaînes dont le manifeste répond d\'ici : ni 404, ni refus CORS, ni page, ni DASH chiffré');
  await T.chargerChaines(bon);
  assert.strictEqual(appels, 1, 'lu une fois');
  T.oublierChaines();
  assert.deepStrictEqual(await T.chargerChaines(() => Promise.reject(new Error('hors ligne'))), []);
  assert.strictEqual((await T.chargerChaines(bon)).length, 2, 'relu après un échec');
  T.oublierChaines();
});

test('data/chaines.json : des chaînes canadiennes en https, dont ICI Télé et TVA', async () => {
  const T = await charger();
  const j = JSON.parse(fs.readFileSync(path.join(racine, 'data', 'chaines.json'), 'utf8'));
  const l = T.chainesValides(j);
  assert.strictEqual(l.length, j.chaines.length, 'toutes les entrées du fichier sont lisibles');
  assert.ok(l.length >= 5, 'au moins cinq chaînes');
  const noms = l.map((c) => c.nom).join('|');
  assert.match(noms, /ICI Télé/);
  assert.match(noms, /TVA/);
});

test('branchement : le module est pré-caché et la section est posée dans le Live', () => {
  const lire = (f) => fs.readFileSync(path.join(racine, f), 'utf8');
  assert.ok(lire('sw.js').includes("'./js/chainestv.js'"), 'APP_SHELL');
  assert.ok(lire('js/ui.js').includes('sectionTele(chainesTele, esc, escJs)'), 'js/ui.js');
  assert.ok(lire('.github/workflows/scrape_schedule.yml').includes('node scripts/chaines_tv.mjs'), 'workflow quotidien');
});

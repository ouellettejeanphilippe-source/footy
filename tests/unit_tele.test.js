/* L'application sur une télé Android (js/tele.js).

   « Garder le concept actuel de l'app, juste adapter à CCGTV » (10 octobre 2026) : les
   décisions sans DOM — ce que la première ouverture allume, ce que ferme la touche
   Retour, l'ordre des Referer du lecteur natif — et les garde-fous de l'APK. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');

async function main() {
  const tele = await import('../js/tele.js');
  const dm = await import('../js/directmedia.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  // 1. La première ouverture allume ce que l'utilisateur n'a jamais réglé, rien d'autre.
  assert.deepStrictEqual(tele.reglagesDeDepart(() => null), { modeTv: true, modeCable: true });
  assert.deepStrictEqual(tele.reglagesDeDepart((k) => (k === 'pref-tv-mode' ? 'false' : null)), { modeCable: true });
  assert.deepStrictEqual(tele.reglagesDeDepart(() => '0'), {});
  ok('modes TV et câble à la première ouverture, jamais par-dessus un choix');

  // 2. Retour : du plus proche au plus loin, et ne quitte que depuis le Live.
  assert.strictEqual(tele.actionRetour({ menuLecteur: true, fiche: true, vue: 'autre' }), 'menu');
  assert.strictEqual(tele.actionRetour({ fiche: true, menuPlus: true }), 'fiche');
  assert.strictEqual(tele.actionRetour({ menuPlus: true, vue: 'autre' }), 'plus');
  assert.strictEqual(tele.actionRetour({ vue: 'autre' }), 'live');
  assert.strictEqual(tele.actionRetour({ vue: 'live' }), 'quitter');
  assert.strictEqual(tele.actionRetour(), 'quitter');
  ok('Retour ferme menu, fiche, menu Plus, revient au Live, puis laisse quitter');

  // 3. Les Referer : cadre observé, page vue par la WebView, rien, page du lien.
  assert.deepStrictEqual(tele.referersPour({ referer: 'https://cadre.test/', pageUrl: 'https://page.test/p' }, 'https://lien.test/l'),
    ['https://cadre.test/', 'https://page.test/p', '', 'https://lien.test/l']);
  assert.deepStrictEqual(tele.referersPour({ pageUrl: 'https://lien.test/l' }, 'https://lien.test/l'), ['https://lien.test/l', ''],
    'sans doublon : la page du lien n\'est essayée qu\'une fois');
  assert.deepStrictEqual(tele.referersPour({ referer: 'javascript:x' }, ''), [''], 'rien qui ne soit une adresse web');
  ok('referersPour : ordre mesuré, sans doublon, sans adresse étrangère');

  // 4. Le Referer du serveur entre dans le registre du mode direct, et n'en sort pas.
  const T = 1800000000000;
  const reg = dm.retenirMediaDirect({}, 'https://lien.test/l', { url: 'https://cdn.test/a.m3u8', pageUrl: 'https://lien.test/l', referer: 'https://cadre.test/' }, T);
  assert.strictEqual(dm.mediaDirectPour(reg, 'https://lien.test/l', T + 1000).referer, 'https://cadre.test/');
  assert.ok(!('referer' in dm.retenirMediaDirect({}, 'x', { url: 'https://cdn.test/b.m3u8' }, T).x), 'pas de champ vide inventé');
  assert.match(lire('js/main.js'), /referer: l\.mediaReferer \|\| ''/, 'semé depuis data/streams.json');
  ok('le registre du mode direct garde le Referer observé par le serveur');

  // 5. Le plugin n'existe que dans l'APK ; ailleurs, l'application garde hls.js.
  assert.strictEqual(tele.pluginNatif({}), null);
  assert.strictEqual(tele.pluginNatif({ Capacitor: { Plugins: {} } }), null);
  const p = { jouer() {} };
  assert.strictEqual(tele.pluginNatif({ Capacitor: { Plugins: { LecteurNatif: p } } }), p);
  assert.strictEqual(tele.surTeleAndroid({ __ANDROID_TV__: true }), true);
  assert.strictEqual(tele.surTeleAndroid({}), false);
  ok('lecteur natif seulement dans l\'APK, télé seulement quand le natif le dit');

  // 6. L'APK : sur le lanceur Google TV, le lecteur déclaré, le plugin enregistré avant le pont.
  const man = lire('mobile/android/app/src/main/AndroidManifest.xml');
  assert.match(man, /android\.intent\.category\.LEANBACK_LAUNCHER/);
  assert.match(man, /android:banner="@drawable\/banniere_tele"/);
  assert.match(man, /android\.hardware\.touchscreen" android:required="false"/);
  assert.match(man, /android:name="\.LecteurActivity"/);
  const main = lire('mobile/android/app/src/main/java/ca/local/footy/MainActivity.java');
  assert.ok(main.indexOf('registerPlugin(LecteurNatifPlugin.class)') < main.indexOf('super.onCreate(etat)'), 'Capacitor exige le plugin avant super.onCreate');
  assert.match(main, /window\.retourTele/);
  assert.match(lire('mobile/android/app/src/main/java/ca/local/footy/BloqueurWebViewClient.java'), /window\.__ANDROID_TV__ = true; window\.activerTeleAndroid/);
  assert.match(lire('mobile/android/app/src/main/java/ca/local/footy/LecteurNatifPlugin.java'), /@CapacitorPlugin\(name = "LecteurNatif"\)/);
  ok('APK : lanceur Google TV, bannière, lecteur natif, Retour et télé signalés à l\'application');

  // 7. Le diagnostic Android de la page Logs : lisible, échappé, les lignes récentes d'abord.
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = tele.diagnosticAndroidHtml({
    etats: { webview: 'com.google.android.webview 140.0', script: 'posé dans tous les cadres (60 Ko)', bloqueur: '99113 hôtes' },
    requetesBloquees: 412, navigationsRefusees: 3,
    hotesBloques: [{ hote: 'regie.example', n: 300 }, { hote: '<img src=x>', n: 2 }],
    lignes: ['15:00:01  premier', '15:00:02  lecteur natif : ERROR_CODE_IO_BAD_HTTP_STATUS']
  }, esc);
  assert.match(html, /com\.google\.android\.webview 140\.0/);
  assert.match(html, /posé dans tous les cadres/);
  assert.match(html, /412 requêtes bloquées/);
  assert.match(html, /regie\.example \(300\)/);
  assert.ok(!html.includes('<img src=x>'), 'un nom d\'hôte n\'injecte rien');
  assert.ok(html.indexOf('ERROR_CODE_IO_BAD_HTTP_STATUS') < html.indexOf('premier'), 'le plus récent en haut');
  assert.match(tele.diagnosticAndroidHtml(null, esc), /pas encore posé/);
  ok('diagnostic Android : WebView, script, bloqueur, hôtes bloqués, journal récent d\'abord');

  // 8. Les deux écarts de la WebView avec Chrome, corrigés dans l'APK.
  assert.match(lire('mobile/android/app/src/main/java/ca/local/footy/MainActivity.java'), /setAcceptThirdPartyCookies\(vue, true\)/);
  assert.strictEqual(JSON.parse(lire('mobile/capacitor.config.json')).android.allowMixedContent, true);
  ok('APK : cookies tiers acceptés et contenu mixte permis, comme dans Chrome');

  console.log(`unit_tele : ${n} groupes réussis`);
}

main().catch((e) => { console.error(e); process.exit(1); });

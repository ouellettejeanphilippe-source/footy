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

  /* 1. « T'as forcé le mode câble, je veux que l'APK soit exactement le site » (25 octobre
     2026) : rien n'est plus allumé d'office ; ce que les versions précédentes avaient
     allumé est éteint, une seule fois. */
  const stock = (o) => (k) => (k in o ? o[k] : null);
  assert.deepStrictEqual(tele.reglagesImposesADefaire(stock({ 'pref-tv-mode': 'true', mode_cable: '1' })), { modeTv: true, modeCable: true });
  assert.deepStrictEqual(tele.reglagesImposesADefaire(stock({})), { modeTv: false, modeCable: false }, 'rien d\'allumé : rien à éteindre, mais c\'est noté');
  assert.strictEqual(tele.reglagesImposesADefaire(stock({ [tele.CLE_APK_COMME_SITE]: '1', 'pref-tv-mode': 'true' })), null, 'une seule fois : ensuite, le mode TV est un choix');
  /* L'échelle : la télé à la largeur d'un écran d'ordinateur, le mode TV un peu plus
     gros, et rien ailleurs. Un choix d'Options l'emporte. */
  assert.strictEqual(tele.zoomInterface(960, 'auto', { tele: true }), 0.8, 'Chromecast : l\'échelle d\'une appli de télé (page de 1200 px)');
  assert.strictEqual(tele.zoomInterface(960, 'auto', { tele: true, modeTv: true }), 0.65, 'Chromecast en mode TV : 0,65 (au lieu de 1,3)');
  assert.strictEqual(tele.zoomInterface(1920, 'auto', { modeTv: true }), 1.3, 'ordinateur en mode TV : comme avant');
  assert.strictEqual(tele.zoomInterface(1920, 'auto', {}), 1, 'ailleurs : rien');
  assert.strictEqual(tele.zoomInterface(390, null, { tele: true }), 0.5, 'jamais sous 0,5');
  assert.strictEqual(tele.zoomInterface(960, '80', { tele: true }), 0.8, 'le choix d\'Options');
  assert.strictEqual(tele.zoomInterface(960, 'n\'importe', { tele: true }), 0.8, 'un choix illisible : automatique');
  ok('APK = site : modes imposés défaits une fois, échelle d\'un écran d\'ordinateur sur la télé');

  // 2. Retour : du plus proche au plus loin, et ne quitte que depuis le Live.
  assert.strictEqual(tele.actionRetour({ menuLecteur: true, fiche: true, vue: 'autre' }), 'menu');
  assert.strictEqual(tele.actionRetour({ fiche: true, menuPlus: true }), 'fiche');
  assert.strictEqual(tele.actionRetour({ menuPlus: true, vue: 'autre' }), 'plus');
  assert.strictEqual(tele.actionRetour({ vue: 'autre' }), 'live');
  assert.strictEqual(tele.actionRetour({ vue: 'live' }), 'quitter');
  assert.strictEqual(tele.actionRetour({ fenetre: true, fiche: true }), 'fenetre', 'le guide ou le menu Look, par-dessus la fiche');
  // La barre de navigation d'abord (comme sur Netflix), sauf depuis le lecteur.
  assert.strictEqual(tele.actionRetour({ vue: 'live', navVisible: true }), 'nav');
  assert.strictEqual(tele.actionRetour({ vue: 'live', navVisible: true, dansNav: true }), 'quitter');
  assert.strictEqual(tele.actionRetour({ vue: 'autre', navVisible: true, dansNav: true }), 'live');
  assert.strictEqual(tele.actionRetour({ vue: 'player', navVisible: true }), 'live', 'le lecteur revient au Live');
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
  assert.match(main, /dispatchEvent\(new Event\('retourTeleNatif'\)\);return !!\(window\.retourTele/, 'la manette apprend qu\'Android a fait le Retour (js/manette.js)');
  /* « Reset l'app lorsque fermée, pas garder en mémoire » : Retour sur la dernière page et
     Accueil (sur une télé) ferment la tâche ; ouvrir le lecteur natif n'est pas partir. */
  assert.match(main, /void fermer\(\) \{\s*finishAndRemoveTask\(\);/);
  assert.match(main, /if \("true"\.equals\(reponse\)\) return;\s*\/\/[^\n]*\n\s*fermer\(\);/, 'Retour sur la dernière page : fermer, pas mettre de côté');
  assert.match(main, /protected void onUserLeaveHint\(\)[\s\S]*UI_MODE_TYPE_TELEVISION\) fermer\(\);/);
  assert.match(lire('mobile/android/app/src/main/java/ca/local/footy/LecteurNatifPlugin.java'), /FLAG_ACTIVITY_NO_USER_ACTION/);
  assert.match(lire('mobile/android/app/src/main/java/ca/local/footy/LecteurActivity.java'), /protected void onUserLeaveHint\(\)[\s\S]*finishAndRemoveTask\(\);/);
  /* La manette dans le lecteur natif : les mêmes boutons que dans l'application en mode
     câble (js/manette.js) — LB/RB le match, LT/RT la source. */
  const lecteurNatif = lire('mobile/android/app/src/main/java/ca/local/footy/LecteurActivity.java');
  const bloc = (signal) => { const i = lecteurNatif.indexOf(signal); return lecteurNatif.slice(lecteurNatif.lastIndexOf('case KeyEvent.KEYCODE_DPAD', i), i); };
  assert.match(bloc('signaler("chaine", -1'), /KEYCODE_BUTTON_L1/);
  assert.match(bloc('signaler("chaine", 1'), /KEYCODE_BUTTON_R1/);
  assert.match(bloc('signaler("source", -1'), /KEYCODE_BUTTON_L2/);
  assert.match(bloc('signaler("source", 1'), /KEYCODE_BUTTON_R2/);
  assert.match(lire('mobile/android/app/src/main/java/ca/local/footy/BloqueurWebViewClient.java'), /window\.__ANDROID_TV__ = true; window\.activerTeleAndroid/);
  assert.match(lire('mobile/android/app/src/main/java/ca/local/footy/LecteurNatifPlugin.java'), /@CapacitorPlugin\(name = "LecteurNatif"\)/);
  ok('APK : lanceur Google TV, bannière, lecteur natif, Retour et télé signalés à l\'application');

  // 7. Le diagnostic Android de la page Logs : lisible, échappé, les lignes récentes d'abord.
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = tele.diagnosticAndroidHtml({
    etats: { webview: 'com.google.android.webview 140.0', script: 'posé dans tous les cadres (60 Ko)', bloqueur: '99113 hôtes', cadres: '4 pages de lecteur ouvertes sans refus d\'encadrement' },
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
  assert.match(html, /Pages qui refusent l&#39;iframe|Pages qui refusent l'iframe/);
  assert.match(html, /4 pages de lecteur ouvertes sans refus/);
  assert.ok(!tele.diagnosticAndroidHtml(null, esc).includes('refusent l'), 'rien tant qu\'aucune page n\'a été reprise');
  assert.match(tele.diagnosticAndroidHtml(null, esc), /pas encore posé/);
  /* « Je veux l'APK avec les mêmes fonctions que le site » (25 octobre 2026) : la page d'un
     lecteur qui refuse l'iframe est reprise sans son refus (CadreSansRefus.java, testé
     sur la JVM par CadreSansRefusTest), seulement pour la page d'un cadre. */
  const bloqueur = lire('mobile/android/app/src/main/java/ca/local/footy/BloqueurWebViewClient.java');
  assert.match(bloqueur, /CadreSansRefus\.estPageDeCadre\(requete\.getMethod\(\), requete\.isForMainFrame\(\), requete\.getRequestHeaders\(\), url\)/);
  assert.match(bloqueur, /new WebResourceResponse\(r\.mime, r\.encodage, r\.statut, r\.raison, r\.entetes, r\.corps\)/);
  assert.ok(bloqueur.indexOf('l.estBloque(hote)') < bloqueur.indexOf('cadreSansRefus(requete, url, hote)'), 'une régie bloquée ne se télécharge jamais');
  ok('diagnostic Android : WebView, script, bloqueur, hôtes bloqués, journal récent d\'abord');

  // 8. Les deux écarts de la WebView avec Chrome, corrigés dans l'APK.
  assert.match(lire('mobile/android/app/src/main/java/ca/local/footy/MainActivity.java'), /setAcceptThirdPartyCookies\(vue, true\)/);
  assert.strictEqual(JSON.parse(lire('mobile/capacitor.config.json')).android.allowMixedContent, true);
  ok('APK : cookies tiers acceptés et contenu mixte permis, comme dans Chrome');

  /* 9. « L'APK peut pas juste servir le site ? » (25 octobre 2026) : il ouvre le site
     publié, en https, avec une page embarquée quand le réseau manque au démarrage ; pas de
     service worker là (Capacitor pose son pont dans les pages qu'il relaie) ; « Mettre à
     jour » vide aussi le cache de la WebView. */
  const config = JSON.parse(lire('mobile/capacitor.config.json'));
  assert.strictEqual(config.server.url, 'https://ouellettejeanphilippe-source.github.io/footy/');
  assert.strictEqual(config.server.errorPath, 'hors-ligne.html');
  const horsLigne = lire('mobile/hors-ligne.html');
  assert.ok(horsLigne.includes("var SITE = '" + config.server.url + "'"), 'la page hors ligne relance le même site');
  assert.match(lire('mobile/assembler-www.mjs'), /copyFile\(path\.join\(ICI, 'hors-ligne\.html'\), path\.join\(WWW, 'hors-ligne\.html'\)\)/, 'et elle est dans l\'APK');
  assert.strictEqual(config.server.cleartext, undefined, 'pas de http en clair');
  const plugin = lire('mobile/android/app/src/main/java/ca/local/footy/LecteurNatifPlugin.java');
  assert.match(plugin, /@PluginMethod\s+public void viderCache\(PluginCall call\)/);
  assert.match(plugin, /getBridge\(\)\.getWebView\(\)\.clearCache\(true\)/);
  const nav = { serviceWorker: {} };
  assert.strictEqual(tele.doitEnregistrerServiceWorker({ navigator: nav }), true, 'le site : oui');
  assert.strictEqual(tele.doitEnregistrerServiceWorker({ navigator: nav, Capacitor: { isNativePlatform: () => true } }), false, 'l\'APK : non');
  assert.strictEqual(tele.doitEnregistrerServiceWorker({ navigator: {} }), false, 'sans service worker possible : non');
  assert.match(lire('js/main.js'), /if \(doitEnregistrerServiceWorker\(\)\) \{\n  window\.addEventListener\('load'/);
  ok('APK : le site en ligne, page hors ligne embarquée, pas de service worker, cache vidable');

  console.log(`unit_tele : ${n} groupes réussis`);
}

main().catch((e) => { console.error(e); process.exit(1); });

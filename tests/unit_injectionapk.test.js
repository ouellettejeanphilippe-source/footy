/* Le script utilisateur dans l'APK Android, sans Tampermonkey.

   « Intégrer le script Tampermonkey (ses fonctionnalités) dans l'APK ainsi que façon de
   bloquer les pubs » (10 octobre 2026). NettoyeurLecteurs.java remplace la marque du
   gabarit mobile/injection-userscript.js par multiview-cleaner.user.js et pose le tout
   dans chaque cadre. Ce test fait la même chose, puis l'exécute :
   - dans la fenêtre principale, le pont doit répondre à `mv_bridge_hello` (donc il voit
     le `GM_xmlhttpRequest` du gabarit) et lire une page par lui ;
   - une deuxième exécution dans le même document ne fait rien ;
   - le gabarit et le script sont bien emportés dans l'APK. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const RACINE = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');

async function main() {
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  const gabarit = lire('mobile/injection-userscript.js');
  const script = lire('multiview-cleaner.user.js');
  const MARQUE = '/*__SCRIPT__*/';
  assert.strictEqual(gabarit.split(MARQUE).length, 2, 'une seule marque dans le gabarit');
  assert.match(lire('mobile/android/app/src/main/java/ca/local/footy/NettoyeurLecteurs.java'), /MARQUE = "\/\*__SCRIPT__\*\/"/);
  // Remplacement littéral, comme String.replace(CharSequence, CharSequence) en Java.
  const complet = gabarit.split(MARQUE).join(script);
  new Function(complet);   // lève si l'assemblage n'est pas du JavaScript valide
  ok('gabarit + script : une seule marque, un JavaScript valide');

  // 2. Dans la fenêtre principale de l'application : le pont répond et lit une page.
  const dom = new JSDOM('<!doctype html><html><body><div id="marea"></div><div class="epg"></div></body></html>',
    { url: 'https://localhost/index.html', runScripts: 'outside-only' });
  const w = dom.window;
  const demandes = [];
  w.fetch = (url, opts) => {
    demandes.push({ url, opts });
    return Promise.resolve({ status: 200, statusText: 'OK', url, text: () => Promise.resolve('<html>page</html>') });
  };
  const recus = [];
  w.addEventListener('message', (e) => { if (e.data && e.data.__mvBridge) recus.push(e.data); });
  // Le pont n'écoute que sa propre fenêtre (`e.source === window`) : jsdom ne la pose pas
  // pour un postMessage venu de Node, d'où cet envoi explicite.
  const envoyer = (data) => w.dispatchEvent(new w.MessageEvent('message', { data, source: w }));
  w.eval(complet);
  assert.strictEqual(w.__footyNettoyeur, true);
  envoyer({ __mvBridge: 'mv_bridge_hello' });
  await new Promise((r) => setTimeout(r, 50));
  const pret = recus.find((d) => d.__mvBridge === 'mv_bridge_ready');
  assert.ok(pret, 'le pont s\'annonce : il a trouvé GM_xmlhttpRequest dans le gabarit');
  assert.match(script, new RegExp("var VERSION = '" + pret.version.replace('.', '\\.') + "'"));
  envoyer({ __mvBridge: 'mv_bridge_fetch', id: 'p1', url: 'https://source.test/match' });
  await new Promise((r) => setTimeout(r, 100));
  assert.strictEqual(demandes.length, 1, 'une seule requête, par le fetch de la page (CapacitorHttp dans l\'APK)');
  assert.strictEqual(demandes[0].url, 'https://source.test/match');
  const page = recus.find((d) => d.__mvBridge === 'mv_bridge_page' && d.id === 'p1');
  assert.ok(page && page.ok, 'la page revient à l\'application');
  ok('fenêtre principale : le pont s\'annonce et lit une page par GM_xmlhttpRequest');

  // 3. Posé deux fois (document-start, puis onPageFinished) : une seule exécution.
  const prets = () => recus.filter((d) => d.__mvBridge === 'mv_bridge_ready').length;
  w.eval(complet);
  await new Promise((r) => setTimeout(r, 50));
  const avant = prets();
  envoyer({ __mvBridge: 'mv_bridge_hello' });
  await new Promise((r) => setTimeout(r, 50));
  assert.strictEqual(prets() - avant, 1, 'un seul pont répond au bonjour, pas deux');
  ok('une deuxième pose dans le même document ne refait rien');

  // 4. L'APK emporte le gabarit et le script, et pose le script avant le premier chargement des lecteurs.
  const assembleur = lire('mobile/assembler-www.mjs');
  assert.match(assembleur, /FICHIERS_MOBILE = \['blocage-hotes\.txt', 'injection-userscript\.js'\]/);
  assert.match(assembleur, /'multiview-cleaner\.user\.js',/);
  const main = lire('mobile/android/app/src/main/java/ca/local/footy/MainActivity.java');
  assert.match(main, /NettoyeurLecteurs\.installer\(getBridge\(\)\.getWebView\(\), nettoyeur\)/);
  assert.match(lire('mobile/android/app/src/main/java/ca/local/footy/NettoyeurLecteurs.java'), /addDocumentStartJavaScript\(vue, complet, Collections\.singleton\("\*"\)\)/);
  assert.match(lire('mobile/android/app/src/main/java/ca/local/footy/BloqueurWebViewClient.java'), /GardeNavigation\.decider\(url, requete\.isForMainFrame\(\), hoteAppli\)/);
  ok('APK : gabarit et script emportés, posés dans tous les cadres, verrou de navigation');

  console.log(`unit_injectionapk : ${n} groupes réussis`);
}

main().catch((e) => { console.error(e); process.exit(1); });

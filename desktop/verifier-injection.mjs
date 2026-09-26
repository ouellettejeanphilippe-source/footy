/* Prouve que le Multiview Stream Cleaner s'injecte bien sans Tampermonkey.
 *
 * Le doute que ce script lève : `preload-userscript.js` peut très bien être
 * chargé sans que le script tourne — un monde isolé, un `nodeIntegrationInSub-
 * Frames` oublié, une exception avalée, et l'application a l'air normale
 * pendant que les lecteurs restent sales. On ne peut pas le voir de l'extérieur,
 * alors on le demande à la page elle-même.
 *
 * Trois faits sont vérifiés, du plus bas au plus haut :
 *
 *   1. `GM_xmlhttpRequest` existe        le préchargement a bien atteint le
 *                                       MONDE DE LA PAGE (dans un monde isolé,
 *                                       la page ne le verrait pas)
 *   2. le pont répond au salut          la seconde moitié du script tourne
 *                                       (elle ne s'exécute que dans la fenêtre
 *                                       principale) et parle à l'application
 *   3. l'application le voit            `getBridgeStatus().available` est vrai,
 *                                       donc c'est bien le chemin que
 *                                       js/embed-bridge.js utilisera
 *
 *   node desktop/verifier-injection.mjs
 */

import { _electron as electron } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));

const app = await electron.launch({
  args: ['.'],
  cwd: ICI,
  executablePath: path.join(ICI, 'node_modules', 'electron', 'dist', 'electron.exe'),
});

const page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');

const constats = await page.evaluate(async () => {
  const gm = typeof window.GM_xmlhttpRequest;

  // Le pont répond `mv_bridge_ready` à un `mv_bridge_hello` — le même échange
  // que js/embed-bridge.js fait au démarrage.
  const repond = await new Promise((resolve) => {
    const minuteur = setTimeout(() => resolve(false), 5000);
    window.addEventListener('message', function ecoute(e) {
      if (e && e.data && e.data.__mvBridge === 'mv_bridge_ready') {
        clearTimeout(minuteur);
        window.removeEventListener('message', ecoute);
        resolve(e.data.version || true);
      }
    });
    window.postMessage({ __mvBridge: 'mv_bridge_hello' }, '*');
  });

  return {
    gm,
    repond,
    vuParLApp: window.getBridgeStatus ? window.getBridgeStatus().available : 'getBridgeStatus absent',
  };
});

await app.close();

console.log('GM_xmlhttpRequest dans la page :', constats.gm);
console.log('le pont repond au salut        :', constats.repond);
console.log("l'application voit le pont     :", constats.vuParLApp);

const bon = constats.gm === 'function' && constats.repond && constats.vuParLApp === true;
console.log(bon ? "\nOK : le script tourne, sans Tampermonkey." : "\nECHEC : le script ne tourne pas comme il faut.");
process.exit(bon ? 0 : 1);

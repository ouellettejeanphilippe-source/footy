/* Le nettoyeur (multiview-cleaner.user.js) ne touche pas aux lecteurs officiels.

   « It's stuck » (16 octobre 2026) sur « Chargement de player.twitch.tv… » : dans le cadre
   du lecteur Twitch, le nettoyeur posait ses pièges sur `window.parent` et `window.top`,
   que le lecteur consulte pour vérifier son `parent`. Le script doit donc rendre la main
   avant de toucher à la page. On l'exécute dans un cadre simulé : un `document` qui
   signale toute lecture dit s'il est allé plus loin. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function touche(source, url) {
    const u = new URL(url);
    let lu = false;
    const document = new Proxy({}, { get() { lu = true; throw new Error('document lu'); } });
    const ctx = {
        location: { hostname: u.hostname, pathname: u.pathname, href: url, origin: u.origin },
        document,
        console,
        setTimeout() {}, setInterval() {}, clearInterval() {}
    };
    ctx.window = ctx;
    ctx.self = ctx;
    ctx.top = {};      // un cadre : la fenêtre du haut est une autre
    ctx.parent = ctx.top;
    try { vm.runInNewContext(source, ctx); } catch (e) { /* le cadre simulé est incomplet : seul `lu` compte */ }
    return lu;
}

let n = 0;
const ok = (name) => { n++; console.log('  ✓ ' + name); };

const SCRIPT = fs.readFileSync(path.join(ROOT, 'multiview-cleaner.user.js'), 'utf8');
['https://player.twitch.tv/?channel=riotgames&parent=127.0.0.1',
 'https://www.youtube.com/embed/poQCaeQpQu8?autoplay=1',
 'https://www.youtube-nocookie.com/embed/abc'].forEach((u) => {
    assert.strictEqual(touche(SCRIPT, u), false, 'le nettoyeur ne doit pas toucher ' + u);
});
ok('le nettoyeur rend la main sur Twitch et YouTube encadrés');

['https://embed.st/embed/abc', 'https://www.youtube.com/watch?v=abc'].forEach((u) => {
    assert.strictEqual(touche(SCRIPT, u), true, 'le nettoyeur doit travailler sur ' + u);
});
ok('le différentiel : ailleurs, il travaille');

console.log(`unit_lecteurofficiel: ${n} groupes de tests OK`);

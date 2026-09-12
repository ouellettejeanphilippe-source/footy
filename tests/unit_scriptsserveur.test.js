/* Les scripts serveur ne prennent que des symboles qui EXISTENT.

   Panne du 10 au 12 septembre 2026, 45 heures sans un seul lien frais. La surcharge
   vivante de `domains.json` (PR #567) a ajouté ceci à `scripts/scrape_streams.mjs` :

       const { …, appliquerSurchargeSources, appliquerHotesDistants, … } = config;

   Or `appliquerHotesDistants` vit dans `js/extractors.js`. `js/config.js` l'importe pour
   son propre `fetchRemoteConfig`, mais ne le ré-exporte pas : la destructuration rendait
   `undefined` — sans une ligne d'avertissement, parce qu'une propriété absente d'un objet
   n'est pas une erreur — et le script mourait au premier appel, `appliquerHotesDistants is
   not a function`, AVANT de lire la moindre source. Le workflow a donc échoué toutes les
   30 minutes pendant deux jours ; `data/streams.json` est resté figé au 10 septembre
   16:28 UTC, et l'application a servi des liens de la veille et de l'avant-veille.

   Un import STATIQUE aurait sauté aux yeux (Node refuse le module au chargement) ; la
   destructuration d'un espace de noms, non. Aucun test ne couvrait ce chemin : les tests
   unitaires prennent `appliquerHotesDistants` sur `js/extractors.js`, où il est bien
   exporté, et les scripts serveur ne sont pas exécutés par `npm test` (ils sortent sur le
   réseau). Ce test lit donc les scripts comme du TEXTE et vérifie, symbole par symbole,
   que chaque nom destructuré d'un module du client y est réellement exporté.

   Il couvre tous les fichiers de `scripts/`, ceux d'aujourd'hui comme ceux de demain. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const RACINE = path.join(__dirname, '..');

/* Les deux formes qu'un script serveur utilise pour prendre des symboles du client :
     const ns = await import('../js/x.js');  puis  const { a, b } = ns;
     const { a, b } = await import('../js/x.js');
   La seconde est déjà sûre (Node lèverait si le module n'existait pas) mais un nom absent
   y rend `undefined` tout autant : on la vérifie aussi. */
function symbolesAttendus(source) {
    const espaces = new Map();          // nom de variable -> chemin du module
    const attentes = [];                // { module, noms: [...], ligne }

    const reNs = /const\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+import\(\s*['"]([^'"]+)['"]\s*\)/g;
    let m;
    while ((m = reNs.exec(source))) espaces.set(m[1], m[2]);

    const reDirect = /const\s*\{([^}]*)\}\s*=\s*await\s+import\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((m = reDirect.exec(source))) {
        attentes.push({ module: m[2], noms: nomsDe(m[1]), index: m.index });
    }

    const reDest = /const\s*\{([^}]*)\}\s*=\s*([A-Za-z_$][\w$]*)\s*;/g;
    while ((m = reDest.exec(source))) {
        const mod = espaces.get(m[2]);
        if (mod) attentes.push({ module: mod, noms: nomsDe(m[1]), index: m.index });
    }

    /* Les imports statiques (`import { a, b } from '../js/x.js'`) sont déjà refusés au
       chargement par Node ; vérifiés ici quand même, pour que le compte du test dise la
       vérité sur ce qu'il couvre. */
    const reStatique = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
    while ((m = reStatique.exec(source))) {
        attentes.push({ module: m[2], noms: nomsDe(m[1]), index: m.index });
    }
    return attentes;
}

/* « a, b: c, d = 1 » -> les noms tels que le MODULE doit les exporter (a, b, d). */
function nomsDe(bloc) {
    return bloc.split(',')
        .map((s) => s.trim().split(':')[0].split('=')[0].trim())
        .filter((s) => /^[A-Za-z_$][\w$]*$/.test(s));
}

async function main() {
    /* Même amorçage que les scripts serveur eux-mêmes : un DOM simulé, puis
       js/scrapers.js en premier pour fixer l'ordre d'évaluation du cycle de modules. */
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://x.test/' });
    const w = dom.window;
    w.__NO_AUTOSTART__ = true;
    for (const k of ['window', 'document', 'DOMParser', 'localStorage', 'navigator', 'HTMLElement', 'Event', 'CustomEvent', 'location', 'history', 'getComputedStyle']) {
        Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
    }
    globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));
    await import('../js/scrapers.js');

    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    const scripts = fs.readdirSync(path.join(RACINE, 'scripts')).filter((f) => f.endsWith('.mjs')).sort();
    assert.ok(scripts.length >= 3, 'les scripts serveur sont bien là (' + scripts.join(', ') + ')');

    let verifies = 0;
    for (const fichier of scripts) {
        const source = fs.readFileSync(path.join(RACINE, 'scripts', fichier), 'utf8');
        const attentes = symbolesAttendus(source);

        for (const a of attentes) {
            if (!/^\.\.\/js\//.test(a.module)) continue;   // fs, jsdom, playwright : pas notre affaire
            const mod = await import('../' + a.module.replace(/^\.\.\//, ''));
            for (const nom of a.noms) {
                assert.ok(Object.prototype.hasOwnProperty.call(mod, nom) || mod[nom] !== undefined,
                    'scripts/' + fichier + ' prend « ' + nom + ' » sur ' + a.module
                    + ', qui ne l\'exporte pas (le script mourrait à l\'exécution)');
                verifies++;
            }
        }
        ok('scripts/' + fichier + ' : ' + attentes.filter((a) => /^\.\.\/js\//.test(a.module))
            .reduce((s, a) => s + a.noms.length, 0) + ' symboles du client, tous exportés');
    }
    assert.ok(verifies >= 15, 'le test voit bien les symboles (' + verifies + ' vérifiés)');
    ok(verifies + ' symboles vérifiés au total');

    /* Le cas EXACT de la panne, nommé, pour qu'un retour en arrière soit lisible. */
    const config = await import('../js/config.js');
    const extractors = await import('../js/extractors.js');
    assert.strictEqual(typeof extractors.appliquerHotesDistants, 'function',
        'appliquerHotesDistants est exporté par js/extractors.js');
    assert.strictEqual(typeof config.appliquerSurchargeSources, 'function',
        'appliquerSurchargeSources est exporté par js/config.js');
    const scrapeStreams = fs.readFileSync(path.join(RACINE, 'scripts/scrape_streams.mjs'), 'utf8');
    assert.ok(!/\bappliquerHotesDistants\b[^\n]*\}\s*=\s*config\s*;/.test(scrapeStreams),
        'scrape_streams.mjs ne prend plus appliquerHotesDistants sur config (il n\'y est pas)');
    ok('la panne du 10 septembre : appliquerHotesDistants pris sur son module');

    console.log(`unit_scriptsserveur: ${n} groupes de tests OK`);
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

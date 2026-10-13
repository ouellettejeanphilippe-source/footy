/* L'extension Chrome (extension/) et le guide qui l'installe (js/installation.js).

   « Ya moyen d'améliorer le ad block sur Chrome pour éviter que ça soit juste Firefox
   qui peut ? » (13 octobre 2026). Le guide envoyait les utilisateurs de Chrome vers
   uBlock Origin, qui ne s'y installe plus depuis le retrait de Manifest V2 : sur Chrome,
   aucune publicité n'était bloquée. Ce test garde ce qui peut se défaire sans bruit :

   - nettoyeur.js est une copie assemblée de multiview-cleaner.user.js : une
     modification du script sans `node extension/construire.mjs --script` laisserait
     l'extension sur l'ancienne version ;
   - les versions et les adresses de l'application, écrites à quatre endroits ;
   - les fichiers que Chrome charge, et ceux que le zip emporte ;
   - les règles de blocage (forme, plafond, domaines dont l'application a besoin) ;
   - le zip fabriqué dans le navigateur, relu octet par octet ;
   - quand la fenêtre du début s'ouvre, et ce qu'elle dit. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.join(__dirname, '..');
const EXT = path.join(ROOT, 'extension');
const lire = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let inst, construire, listes;
test.before(async () => {
  inst = await import(path.join(ROOT, 'js', 'installation.js'));
  construire = await import(path.join(EXT, 'construire.mjs'));
  listes = await import(path.join(ROOT, 'scripts', 'listes-blocage.mjs'));
});

const manifest = () => JSON.parse(lire('extension/manifest.json'));

test('nettoyeur.js est le gabarit + le script utilisateur actuel', () => {
  const attendu = construire.assemblerNettoyeur(lire('extension/gabarit-nettoyeur.js'), lire('multiview-cleaner.user.js'));
  assert.strictEqual(lire('extension/nettoyeur.js'), attendu,
    'relancer `node extension/construire.mjs --script` après avoir modifié multiview-cleaner.user.js');
});

test('une seule version de l\'extension', () => {
  const v = manifest().version;
  assert.strictEqual(inst.VERSION_EXTENSION, v, 'js/installation.js');
  assert.match(lire('extension/gabarit-nettoyeur.js'), new RegExp(`VERSION_EXTENSION = '${v.replace('.', '\\.')}'`));
});

test('les adresses de l\'application sont les mêmes partout', () => {
  const relais = manifest().content_scripts.find((c) => c.js.includes('relais.js'));
  const hotes = relais.matches.map((m) => new URL(m.replace('/*', '/')).hostname).sort();
  for (const f of ['extension/gabarit-nettoyeur.js', 'extension/fond.js']) {
    const m = /HOTES_APPLICATION = (\[[^\]]*\])/.exec(lire(f));
    assert.ok(m, f);
    assert.deepStrictEqual(JSON.parse(m[1].replace(/'/g, '"')).sort(), hotes, f);
  }
  assert.strictEqual(relais.all_frames, false, 'le relais (et donc le pont) ne vit que dans la fenêtre principale');
});

test('le nettoyeur est posé partout, avant la page, dans le monde de la page', () => {
  const n = manifest().content_scripts.find((c) => c.js.includes('nettoyeur.js'));
  assert.strictEqual(n.world, 'MAIN');
  assert.strictEqual(n.run_at, 'document_start');
  assert.strictEqual(n.all_frames, true);
  assert.strictEqual(n.match_origin_as_fallback, true, 'cadres about:blank et srcdoc compris');
});

test('le zip emporte tout ce que Chrome charge, et ces fichiers existent', () => {
  const m = manifest();
  const charges = new Set([
    m.background.service_worker,
    ...Object.values(m.icons),
    ...m.content_scripts.flatMap((c) => c.js),
    ...m.declarative_net_request.rule_resources.map((r) => r.path)
  ]);
  for (const f of charges) assert.ok(inst.FICHIERS_EXTENSION.includes(f), `${f} manque au zip`);
  for (const f of inst.FICHIERS_EXTENSION) assert.ok(fs.existsSync(path.join(EXT, f)), `${f} absent du dossier`);
  assert.ok(lire('desktop/package.json').includes('"extension/**/*"'), 'la version de bureau sert aussi le dossier');
});

test('les règles de blocage : forme, plafond, et jamais un domaine de l\'application', () => {
  const regles = JSON.parse(lire('extension/regles/blocage.json'));
  const ids = new Set(regles.map((r) => r.id));
  assert.strictEqual(ids.size, regles.length, 'identifiants uniques');
  assert.ok(regles.length < 30000, 'sous le minimum garanti de règles statiques');
  const bloques = regles.filter((r) => r.action.type === 'block').flatMap((r) => r.condition.requestDomains);
  assert.ok(bloques.length > 5000, `${bloques.length} hôtes seulement`);
  const types = new Set(['main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object', 'xmlhttprequest', 'ping', 'csp_report', 'media', 'websocket', 'other']);
  for (const r of regles) for (const t of r.condition.resourceTypes) assert.ok(types.has(t), `type inconnu de Chrome 111 : ${t}`);
  for (const h of listes.JAMAIS) assert.ok(!bloques.includes(h), `${h} bloqué`);
  const permis = regles.find((r) => r.action.type === 'allow');
  assert.ok(permis && permis.priority > 1, 'une règle d\'exception passe devant les blocages');
  for (const h of listes.JAMAIS) assert.ok(permis.condition.requestDomains.includes(h), `${h} hors des exceptions`);
});

test('reglesDeBlocage coupe en paquets et ajoute les exceptions', () => {
  const hotes = Array.from({ length: 9000 }, (_, i) => `pub${i}.test`);
  const r = construire.reglesDeBlocage(hotes, ['ok.pub1.test']);
  assert.strictEqual(r.filter((x) => x.action.type === 'block').length, 3);
  assert.ok(r.at(-1).condition.requestDomains.includes('ok.pub1.test'));
});

test('lecture des listes : les mêmes règles que l\'APK', () => {
  const b = new Set(), e = new Set();
  listes.lireListe([
    '||pub.test^', '||tiers.test^$third-party', '||cdn.test^$script', '||page.test^$domain=a.com',
    '@@||sauve.test^', '||sauve.test^', 'site.test##.pub', '! commentaire'
  ].join('\n'), b, e);
  assert.deepStrictEqual([...b].sort(), ['pub.test', 'sauve.test', 'tiers.test']);
  assert.deepStrictEqual([...e], ['sauve.test']);
});

/* Relit un zip comme le ferait un décompresseur : répertoire central, en-têtes locaux,
   CRC de chaque fichier. */
function lireZip(octets) {
  const b = Buffer.from(octets);
  const fin = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(fin >= 0, 'fin du répertoire central');
  const n = b.readUInt16LE(fin + 10);
  let p = b.readUInt32LE(fin + 16);
  const fichiers = {};
  for (let i = 0; i < n; i++) {
    assert.strictEqual(b.readUInt32LE(p), 0x02014b50);
    const crc = b.readUInt32LE(p + 16), taille = b.readUInt32LE(p + 24);
    const ln = b.readUInt16LE(p + 28), lx = b.readUInt16LE(p + 30), lc = b.readUInt16LE(p + 32);
    const nom = b.slice(p + 46, p + 46 + ln).toString('utf8');
    const local = b.readUInt32LE(p + 42);
    assert.strictEqual(b.readUInt32LE(local), 0x04034b50);
    const debut = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
    const contenu = b.slice(debut, debut + taille);
    assert.strictEqual(zlib.crc32(contenu), crc, `CRC de ${nom}`);
    fichiers[nom] = contenu;
    p += 46 + ln + lx + lc;
  }
  return fichiers;
}

test('le zip de l\'extension se relit, fichier pour fichier', async () => {
  const zip = await inst.zipExtension((chemin) => Promise.resolve(fs.readFileSync(path.join(EXT, chemin))));
  const fichiers = lireZip(zip);
  assert.deepStrictEqual(Object.keys(fichiers).sort(), inst.FICHIERS_EXTENSION.map((f) => `${inst.DOSSIER_EXTENSION}/${f}`).sort());
  assert.ok(fichiers[`${inst.DOSSIER_EXTENSION}/regles/blocage.json`].equals(fs.readFileSync(path.join(EXT, 'regles/blocage.json'))));
  assert.ok(fichiers[`${inst.DOSSIER_EXTENSION}/icone.png`].equals(fs.readFileSync(path.join(EXT, 'icone.png'))), 'binaire intact');
  assert.strictEqual(inst.crc32(Buffer.from('123456789')), 0xCBF43926, 'CRC-32 de référence');
});

const UA = {
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0',
  android: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'
};

test('le navigateur reconnu, et la page de ses extensions', () => {
  assert.deepStrictEqual(inst.quelNavigateur({ userAgent: UA.chrome }), { id: 'chromium', nom: 'Chrome', page: 'chrome://extensions' });
  assert.strictEqual(inst.quelNavigateur({ userAgent: UA.edge }).page, 'edge://extensions');
  assert.strictEqual(inst.quelNavigateur({ userAgent: UA.chrome, brave: {} }).page, 'brave://extensions');
  assert.strictEqual(inst.quelNavigateur({ userAgent: UA.firefox }).id, 'firefox');
  assert.strictEqual(inst.quelNavigateur({ userAgent: UA.android }).id, 'mobile');
});

test('la fenêtre du début : quand elle s\'ouvre', () => {
  const chrome = inst.quelNavigateur({ userAgent: UA.chrome });
  const firefox = inst.quelNavigateur({ userAgent: UA.firefox });
  const rien = inst.etatProtection({}, { available: false });
  const script = inst.etatProtection({}, { available: true, version: '1.11' });
  const ext = inst.etatProtection({ __footyExtension: inst.VERSION_EXTENSION }, { available: true });
  const vieille = inst.etatProtection({ __footyExtension: '0.9' }, { available: true });

  assert.strictEqual(inst.doitProposerGuide(null, chrome, rien), true, 'premier lancement');
  assert.strictEqual(inst.doitProposerGuide('true', chrome, rien), true, 'a vu l\'ancien guide, qui envoyait vers un uBlock mort');
  assert.strictEqual(inst.doitProposerGuide('true', firefox, rien), false, 'Firefox : l\'ancien guide valait');
  assert.strictEqual(inst.doitProposerGuide(inst.GUIDE_VU, chrome, rien), false, 'une fois suffit');
  assert.strictEqual(inst.doitProposerGuide(null, chrome, script), false, 'un nettoyeur tourne (Tampermonkey, bureau, APK)');
  assert.strictEqual(inst.doitProposerGuide(null, chrome, ext), false, 'extension à jour');
  assert.strictEqual(inst.doitProposerGuide(inst.GUIDE_VU, chrome, vieille), true, 'extension périmée');
  assert.strictEqual(inst.doitProposerGuide('maj-' + inst.VERSION_EXTENSION, chrome, vieille), false, 'mise à jour déjà proposée');
});

test('la fenêtre du début : ce qu\'elle dit', () => {
  const chrome = inst.guideInstallationHtml(inst.quelNavigateur({ userAgent: UA.chrome }), inst.etatProtection({}, null));
  assert.match(chrome, /Aucune protection détectée/);
  assert.ok(chrome.indexOf('l\'extension Guide des Sports') < chrome.indexOf('Firefox : uBlock'), 'le chemin de Chrome d\'abord');
  for (const etape of ['telechargerExtension(this)', 'Extraire tout', 'chrome://extensions', 'Mode développeur', 'Charger l\'extension non empaquetée', 'rechargez la page']) {
    assert.ok(chrome.includes(etape), etape);
  }
  const ff = inst.guideInstallationHtml(inst.quelNavigateur({ userAgent: UA.firefox }), inst.etatProtection({}, null));
  assert.ok(ff.indexOf('Firefox : uBlock') < ff.indexOf('l\'extension Guide des Sports'), 'le chemin de Firefox d\'abord');
  assert.ok(ff.includes('about:config') && ff.includes('installerScriptUtilisateur()'));
  const ok = inst.guideInstallationHtml(inst.quelNavigateur({ userAgent: UA.chrome }), inst.etatProtection({ __footyExtension: inst.VERSION_EXTENSION }, null));
  assert.match(ok, /Extension Guide des Sports active/);
  assert.match(ok, /<details><summary class="help">Revoir l'installation/);
});

test('plus aucun lien vers uBlock Origin pour Chrome ou Edge', () => {
  const morts = ['cjpalhdlnbpafiamejdnhcphjbkeiagm', 'odfafepnkmbhccpbejgmiehpchacaeak'];
  for (const f of ['index.html', 'js/multiview.js', 'js/installation.js', 'README.md']) {
    for (const id of morts) assert.ok(!lire(f).includes(id), `${f} pointe encore vers ${id}`);
  }
});

test('le module est précaché, et les fonctions du guide sont exposées', () => {
  assert.ok(lire('sw.js').includes("'./js/installation.js'"));
  const mv = lire('js/multiview.js');
  for (const f of ['telechargerExtension', 'copierTexte', 'installerScriptUtilisateur']) {
    assert.ok(mv.includes(`window.${f} = ${f};`), f);
  }
});

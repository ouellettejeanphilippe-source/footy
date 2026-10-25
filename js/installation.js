/* La protection des lecteurs : ce qui tourne déjà, quand ouvrir la fenêtre du début, et
   le zip de l'extension maison (extension/).

   Le guide lui-même est l'ancien (uBlock Origin, Tampermonkey, le script ; Firefox
   recommandé), écrit dans index.html (#guide-installation, page Plus → 🧩 Script) et
   repris par la fenêtre du début : « garder vieux guide plutôt que nouveau »
   (13 octobre 2026). Depuis le 25 octobre 2026 (« les mêmes fonctions sur Firefox et
   Chrome »), un panneau Chrome y mène à l'extension (`telechargerExtension`) : uBlock
   Origin ne s'installe plus sur Chrome, et l'extension y fait ce que font sur Firefox
   uBlock Origin, Tampermonkey et le script.

   Sans import : `getBridgeStatus` est passé par l'appelant. */

/* Doit suivre "version" de extension/manifest.json (vérifié par unit_extension). */
export var VERSION_EXTENSION = '1.5';

/* Doit suivre @version de multiview-cleaner.user.js (vérifié par unit_extension). Un script
   plus ancien s'annonce « pas à jour » (18 octobre 2026 : le recul de l'onglet n'est bloqué
   dans les vidéos que depuis la 1.17, et rien ne disait que Tampermonkey tournait encore
   sur l'ancienne). */
export var VERSION_SCRIPT = '1.18';

/* La valeur de `hasSeenScriptModal` posée après la fenêtre du début. Toute valeur non
   vide veut dire « déjà vue » (« 2 » vient du guide retiré). */
export var GUIDE_VU = 'true';

/* Ce que le zip contient, dans le dossier qu'il crée. Seulement ce que Chrome charge :
   pas le gabarit ni le générateur. */
export var FICHIERS_EXTENSION = ['manifest.json', 'fond.js', 'relais.js', 'nettoyeur.js', 'icone.png', 'regles/blocage.json'];
export var DOSSIER_EXTENSION = 'guide-des-sports-extension';

/* { type: 'extension' | 'script' | 'aucune', version, aJour } */
export function etatProtection(win, pont) {
  var w = win || (typeof window !== 'undefined' ? window : {});
  if (w.__footyExtension) {
    return { type: 'extension', version: String(w.__footyExtension), aJour: !versionInferieure(String(w.__footyExtension), VERSION_EXTENSION) };
  }
  if (pont && pont.available) return { type: 'script', version: pont.version || '?', aJour: !!pont.version && !versionInferieure(String(pont.version), VERSION_SCRIPT) };
  return { type: 'aucune', version: null, aJour: true };
}

export function versionInferieure(a, b) {
  var pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
    var x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x < y;
  }
  return false;
}

/* La fenêtre s'ouvre-t-elle au démarrage ? Une seule fois, et jamais si un nettoyeur
   tourne déjà (extension, script, version de bureau ou APK, qui l'injectent). */
export function doitProposerGuide(vu, etat) {
  return !vu && etat.type === 'aucune';
}

/* ── Le zip ─────────────────────────────────────────────────────────────────────
   Fabriqué dans le navigateur à partir des fichiers servis avec l'application : pas de
   copie binaire de plus dans le dépôt, et toujours la version servie. Méthode
   « stockée » (sans compression), que tous les décompresseurs lisent. */

var TABLE_CRC = null;
export function crc32(octets) {
  if (!TABLE_CRC) {
    TABLE_CRC = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      TABLE_CRC[n] = c >>> 0;
    }
  }
  var crc = 0xFFFFFFFF;
  for (var i = 0; i < octets.length; i++) crc = TABLE_CRC[(crc ^ octets[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/* fichiers : [{ nom, octets: Uint8Array }] → Uint8Array du zip. */
export function fabriquerZip(fichiers) {
  var enc = new TextEncoder();
  var morceaux = [], central = [], decalage = 0;
  fichiers.forEach(function (f) {
    var nom = enc.encode(f.nom);
    var crc = crc32(f.octets);
    var taille = f.octets.length;
    var local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);   // noms en UTF-8
    local.setUint16(8, 0, true);        // stocké
    local.setUint16(10, 0, true);
    local.setUint16(12, 0x21, true);    // 1er janvier 1980
    local.setUint32(14, crc, true);
    local.setUint32(18, taille, true);
    local.setUint32(22, taille, true);
    local.setUint16(26, nom.length, true);
    local.setUint16(28, 0, true);
    morceaux.push(new Uint8Array(local.buffer), nom, f.octets);

    var c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, 0, true);
    c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, taille, true);
    c.setUint32(24, taille, true);
    c.setUint16(28, nom.length, true);
    c.setUint32(42, decalage, true);
    central.push(new Uint8Array(c.buffer), nom);
    decalage += 30 + nom.length + taille;
  });
  var tailleCentrale = central.reduce(function (s, m) { return s + m.length; }, 0);
  var fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, fichiers.length, true);
  fin.setUint16(10, fichiers.length, true);
  fin.setUint32(12, tailleCentrale, true);
  fin.setUint32(16, decalage, true);
  var tout = morceaux.concat(central, [new Uint8Array(fin.buffer)]);
  var total = tout.reduce(function (s, m) { return s + m.length; }, 0);
  var sortie = new Uint8Array(total), pos = 0;
  tout.forEach(function (m) { sortie.set(m, pos); pos += m.length; });
  return sortie;
}

/* Le bouton du panneau Chrome du guide : fabrique le zip et le fait télécharger. Rend le
   nom du fichier. Le lien est cliqué par programme : la fenêtre du guide ne se ferme que
   sur un vrai clic (`isTrusted`, installTampermonkey). */
export function telechargerExtension(lire, doc) {
  var d = doc || document;
  return zipExtension(lire).then(function (octets) {
    var url = URL.createObjectURL(new Blob([octets], { type: 'application/zip' }));
    var a = d.createElement('a');
    a.href = url;
    a.download = DOSSIER_EXTENSION + '-' + VERSION_EXTENSION + '.zip';
    d.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    return a.download;
  });
}

/* Télécharge les fichiers de l'extension servis avec l'application et rend le zip. */
export function zipExtension(lire) {
  var charger = lire || function (chemin) {
    return fetch('./extension/' + chemin, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(chemin + ' : HTTP ' + r.status);
      return r.arrayBuffer();
    });
  };
  return Promise.all(FICHIERS_EXTENSION.map(function (chemin) {
    return charger(chemin).then(function (tampon) {
      return { nom: DOSSIER_EXTENSION + '/' + chemin, octets: new Uint8Array(tampon) };
    });
  })).then(fabriquerZip);
}

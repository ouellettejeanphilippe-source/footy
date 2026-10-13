/* Le guide d'installation de la protection des lecteurs : la fenêtre du début et la page
   Plus → 🧩 Script, qui disent la même chose.

   « Ya moyen d'améliorer le ad block sur Chrome pour éviter que ça soit juste Firefox
   qui peut ? » (13 octobre 2026). uBlock Origin ne s'installe plus sur Chrome depuis le
   retrait de Manifest V2 ; le lien du guide menait à une page morte. Sur Chrome, Edge,
   Brave et Opera, c'est désormais l'extension maison (extension/) : blocage réseau des
   listes d'uBlock, script de nettoyage, et levée du refus d'iframe. Sur Firefox, qui
   n'accepte pas durablement une extension non signée, on garde uBlock Origin et
   Tampermonkey.

   Le guide part de ce qui est déjà en place (`etatProtection`) et du navigateur
   (`quelNavigateur`), et ne montre d'abord que le chemin qui le concerne.

   Sans import : `getBridgeStatus` est passé par l'appelant. */

/* Doit suivre "version" de extension/manifest.json (vérifié par unit_extension). En
   dessous, l'application propose la mise à jour. */
export var VERSION_EXTENSION = '1.0';

/* La valeur de `hasSeenScriptModal` qui veut dire « a vu le guide de l'extension ».
   L'ancienne valeur (« true ») a vu l'ancien guide : un navigateur Chromium sans
   protection le revoit une fois, puisque l'ancien l'envoyait vers une page morte. */
export var GUIDE_VU = '2';

/* Ce que le zip contient, dans le dossier qu'il crée. Seulement ce que Chrome charge :
   pas le gabarit ni le générateur. */
export var FICHIERS_EXTENSION = ['manifest.json', 'fond.js', 'relais.js', 'nettoyeur.js', 'icone.png', 'regles/blocage.json'];
export var DOSSIER_EXTENSION = 'guide-des-sports-extension';
var ZIP_DEPOT = 'https://github.com/ouellettejeanphilippe-source/footy/archive/refs/heads/main.zip';

export function quelNavigateur(nav) {
  var n = nav || (typeof navigator !== 'undefined' ? navigator : {});
  var ua = String(n.userAgent || '');
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return { id: 'mobile', nom: 'téléphone' };
  if (/Firefox\//.test(ua)) return { id: 'firefox', nom: 'Firefox' };
  if (/Edg\//.test(ua)) return { id: 'chromium', nom: 'Edge', page: 'edge://extensions' };
  if (/OPR\//.test(ua)) return { id: 'chromium', nom: 'Opera', page: 'opera://extensions' };
  if (n.brave) return { id: 'chromium', nom: 'Brave', page: 'brave://extensions' };
  if (/Chrome\/|Chromium\//.test(ua)) return { id: 'chromium', nom: 'Chrome', page: 'chrome://extensions' };
  return { id: 'autre', nom: 'ce navigateur' };
}

/* { type: 'extension' | 'script' | 'aucune', version, aJour } */
export function etatProtection(win, pont) {
  var w = win || (typeof window !== 'undefined' ? window : {});
  if (w.__footyExtension) {
    return { type: 'extension', version: String(w.__footyExtension), aJour: !versionInferieure(String(w.__footyExtension), VERSION_EXTENSION) };
  }
  if (pont && pont.available) return { type: 'script', version: pont.version || '?', aJour: true };
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

/* La fenêtre s'ouvre-t-elle au démarrage ? Jamais si un nettoyeur tourne déjà (extension,
   script, version de bureau ou APK, qui l'injectent), sauf extension périmée. */
export function doitProposerGuide(vu, nav, etat) {
  if (etat.type === 'extension') return !etat.aJour && vu !== 'maj-' + VERSION_EXTENSION;
  if (etat.type === 'script') return false;
  if (!vu) return true;
  return nav.id === 'chromium' && vu !== GUIDE_VU;
}

function lienStore(url, classe, texte) {
  return '<a href="' + url + '" target="_blank" rel="noopener" class="btn store ' + classe + '">' + texte + '</a>';
}

function bandeauEtat(etat, nav) {
  if (etat.type === 'extension' && etat.aJour) {
    return '<div class="panel accent guide-etat ok"><strong>✅ Extension Guide des Sports active (v' + etat.version + ')</strong>' +
      '<p>Publicités, fenêtres surgissantes et refus d\'iframe sont pris en charge. Rien d\'autre à installer.</p></div>';
  }
  if (etat.type === 'extension') {
    return '<div class="panel warn-panel guide-etat maj"><strong>⬆️ Une nouvelle version de l\'extension existe (v' + VERSION_EXTENSION + ', vous avez la v' + etat.version + ')</strong>' +
      '<p>Téléchargez-la ci-dessous, remplacez le contenu du dossier <code>' + DOSSIER_EXTENSION + '</code> par le nouveau, puis cliquez ↻ sur l\'extension dans <code>' + (nav.page || 'chrome://extensions') + '</code>.</p></div>';
  }
  if (etat.type === 'script') {
    var conseil = nav.id === 'chromium'
      ? '<p>Sur ' + nav.nom + ', l\'extension ci-dessous bloque aussi les publicités, que uBlock Origin ne bloque plus sur Chrome. Après l\'avoir installée, désactivez le script dans Tampermonkey.</p>'
      : '';
    return '<div class="panel accent guide-etat ok"><strong>✅ Script de nettoyage actif (v' + etat.version + ')</strong>' + conseil + '</div>';
  }
  return '<div class="panel warn-panel guide-etat aucune"><strong>⚠️ Aucune protection détectée</strong>' +
    '<p>Les lecteurs vont garder leurs publicités et leurs fenêtres surgissantes, et certains peuvent faire quitter l\'application. Quelques minutes suffisent pour les bloquer.</p></div>';
}

function sectionChromium(nav) {
  var page = nav.page || 'chrome://extensions';
  var nom = nav.id === 'chromium' ? nav.nom : 'Chrome, Edge, Brave ou Opera';
  return '' +
    '<div class="panel guide-chromium">' +
      '<div class="panel-title"><span>🧩 ' + nom + ' : l\'extension Guide des Sports</span></div>' +
      '<p class="help">Une seule extension remplace uBlock Origin, Tampermonkey et le script : elle bloque les publicités (les mêmes listes qu\'uBlock), ferme les fenêtres surgissantes, nettoie les lecteurs et laisse s\'afficher ceux qui refusent l\'iframe. Elle n\'agit que dans l\'application, sauf le blocage des publicités, qui vaut partout.</p>' +
      '<ol class="guide-etapes">' +
        '<li><strong>Téléchargez l\'extension</strong> : <button type="button" class="btn primary" onclick="telechargerExtension(this)">⬇️ Télécharger l\'extension (.zip)</button> <span class="help guide-zip-etat"></span></li>' +
        '<li><strong>Décompressez le fichier</strong> (clic droit → « Extraire tout… »). Rangez le dossier <code>' + DOSSIER_EXTENSION + '</code> à un endroit où il restera, par exemple dans Documents : ' + nom + ' le relit à chaque démarrage, il ne faut pas le supprimer.</li>' +
        '<li><strong>Ouvrez la page des extensions</strong> dans un nouvel onglet : <code>' + page + '</code> <button type="button" class="btn" onclick="copierTexte(\'' + page + '\', this)">Copier l\'adresse</button><br><span class="help">Un site n\'a pas le droit d\'ouvrir cette page lui-même : collez l\'adresse dans la barre d\'adresse.</span></li>' +
        '<li><strong>Activez « Mode développeur »</strong>, l\'interrupteur en haut à droite de cette page (dans la colonne de gauche sur Edge).</li>' +
        '<li><strong>Cliquez « Charger l\'extension non empaquetée »</strong> et choisissez le dossier <code>' + DOSSIER_EXTENSION + '</code> (celui qui contient <code>manifest.json</code>).</li>' +
        '<li><strong>Revenez ici et rechargez la page.</strong> Le bandeau en haut de ce guide passe au vert.</li>' +
      '</ol>' +
      '<p class="help">Déjà installés ? <strong>uBlock Origin</strong> ne s\'installe plus sur Chrome (Google a retiré Manifest V2) ; là où il tourne encore, comme <strong>uBlock Origin Lite</strong>, il peut rester : il masque en plus les emplacements vides. Dans <strong>Tampermonkey</strong>, désactivez « Multiview Stream Cleaner », sinon le nettoyage tourne deux fois. Sur Brave, gardez les boucliers.</p>' +
      '<p class="help">Si le bouton de téléchargement échoue : <a href="' + ZIP_DEPOT + '" target="_blank" rel="noopener">téléchargez le dépôt</a> et choisissez son dossier <code>extension</code> à l\'étape 5.</p>' +
    '</div>';
}

function sectionFirefox() {
  return '' +
    '<div class="panel guide-firefox">' +
      '<div class="panel-title"><span>🦊 Firefox : uBlock Origin + le script</span></div>' +
      '<p class="help">Firefox garde uBlock Origin complet. Il n\'accepte pas durablement une extension non signée : on y passe donc par Tampermonkey.</p>' +
      '<ol class="guide-etapes">' +
        '<li><strong>Installez uBlock Origin</strong> : ' + lienStore('https://addons.mozilla.org/fr/firefox/addon/ublock-origin/', 'firefox', 'uBlock Origin') + '</li>' +
        '<li><strong>Installez Tampermonkey</strong> : ' + lienStore('https://addons.mozilla.org/fr/firefox/addon/tampermonkey/', 'firefox', 'Tampermonkey') + '</li>' +
        '<li><strong>Installez le script</strong> : <button type="button" class="btn primary" onclick="installerScriptUtilisateur()">Installer le script</button> puis « Installer » dans Tampermonkey.</li>' +
        '<li><strong>Pages qui refusent l\'iframe</strong> (« Firefox ne peut pas ouvrir cette page ») : ' + lienStore('https://addons.mozilla.org/fr/firefox/addon/ignore-x-frame-options-header/', 'firefox', 'Ignore X-Frame-Options Header') + '</li>' +
        '<li><strong>Lecture automatique</strong> : dans <code>about:config</code>, <code>media.autoplay.default</code> = <code>0</code>, <code>media.autoplay.blocking_policy</code> = <code>0</code>, <code>media.block-autoplay-until-in-foreground</code> = <code>false</code>. Sinon une tuile ne démarre qu\'après un clic, et seulement au premier plan.</li>' +
        '<li><strong>Protection contre le pistage</strong> : bouclier à gauche de l\'adresse → la désactiver <em>pour ce site</em>. Elle coupe les cookies dont plusieurs lecteurs ont besoin.</li>' +
      '</ol>' +
      '<p class="help">Rechargez ensuite l\'application. Si une tuile reste vide, son bouton ⏭ passe à la source suivante.</p>' +
    '</div>';
}

function sectionMobile() {
  return '' +
    '<div class="panel guide-mobile">' +
      '<div class="panel-title"><span>📱 Sur téléphone</span></div>' +
      '<p class="help">Les navigateurs de téléphone ne posent pas de script dans les lecteurs. L\'application Android (APK) embarque le nettoyage et le blocage des publicités : rien à installer d\'autre. Sur un ordinateur, rouvrez ce guide pour l\'extension.</p>' +
    '</div>';
}

/* Le guide entier. Le chemin du navigateur courant d'abord ; les autres repliés. */
export function guideInstallationHtml(nav, etat) {
  var principal, autres = [];
  if (nav.id === 'firefox') { principal = sectionFirefox(); autres.push(sectionChromium({ id: 'autre' })); }
  else if (nav.id === 'mobile') { principal = sectionMobile(); autres.push(sectionChromium({ id: 'autre' }), sectionFirefox()); }
  else { principal = sectionChromium(nav); autres.push(sectionFirefox()); }
  var replie = etat.type === 'extension' && etat.aJour;
  return '<div class="stack prose guide-installation">' +
    bandeauEtat(etat, nav) +
    (replie ? '<details><summary class="help">Revoir l\'installation</summary>' + principal + '</details>' : principal) +
    '<details class="guide-autres"><summary class="help">Un autre navigateur ?</summary><div class="stack">' + autres.join('') + '</div></details>' +
  '</div>';
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

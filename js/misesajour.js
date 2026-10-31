/* La page Réglages → Mises à jour (31 octobre 2026, « ya moyen de remplacer la page script par
   qqchose qui aide plus les gens à rester à jour »).

   La page Script n'était qu'un guide d'installation : rien ne disait si ce qu'on avait
   installé était à jour, ni comment le mettre à jour. Ici, ce que l'application sait déjà
   (la version du script ou de l'extension qui tourne, `etatProtection`, et la version qu'elle
   embarque, `VERSION_SCRIPT` / `VERSION_EXTENSION`) devient trois cartes — l'application, la
   protection des lecteurs, ce qui a changé — avec le bouton qui convient à chacune. Le guide
   d'installation reste sur la page, replié, pour qui n'a encore rien.

   Sans import : les versions, `esc` et l'état de la protection sont passés par l'appelant. */

/* Où Tampermonkey va chercher le script (même adresse que le bouton du guide). */
export var URL_SCRIPT = 'https://raw.githubusercontent.com/ouellettejeanphilippe-source/footy/main/multiview-cleaner.user.js';

/* Ce qui a changé, pour des gens qui n'ouvriront jamais le journal du dépôt. Une ligne par
   version du script ; `unit_misesajour` exige celle de la version embarquée, pour que la
   page ne reste pas muette sur une nouveauté. */
export var NOUVEAUTES = [
  { version: '1.24', date: '31 octobre 2026', texte: 'Tampermonkey vérifie maintenant lui-même si une nouvelle version du script existe.' },
  { version: '1.23', date: '31 octobre 2026', texte: 'Un lien que le site refuse d\'afficher (lecteur gris, sans vidéo) fait passer la tuile au lien suivant au lieu de rester bloquée.' },
  { version: '1.22', date: '31 octobre 2026', texte: 'Nettoyage moins agressif : la page est cachée au lieu d\'être supprimée, et se replie sur un plein cadre si la vidéo s\'arrête. Un site qui réécrit window.open ne fait plus planter son lecteur.' },
  { version: '1.21', date: '31 octobre 2026', texte: 'Les lecteurs que le site reconstruit après coup (Video.js) ne sont plus détruits par le nettoyage.' }
];

/* « sports-guide-v112 » → 112 ; null si ce n'est pas une version de l'application. */
export function numeroVersionApp(v) {
  var m = /-v(\d+)\s*$/.exec(String(v || ''));
  return m ? parseInt(m[1], 10) : null;
}

/* La version publiée, lue dans le texte de sw.js (CACHE_NAME), null si introuvable. */
export function versionPubliee(texteSw) {
  var m = /CACHE_NAME\s*=\s*['"]([^'"]+)['"]/.exec(String(texteSw || ''));
  return m ? m[1] : null;
}

/* { statut: 'a_jour' | 'en_retard' | 'inconnu', locale, publiee } */
export function etatApplication(locale, publiee) {
  var l = numeroVersionApp(locale), p = numeroVersionApp(publiee);
  if (l === null || p === null) return { statut: 'inconnu', locale: locale, publiee: publiee || null };
  return { statut: p > l ? 'en_retard' : 'a_jour', locale: locale, publiee: publiee };
}

/* Faut-il prévenir au démarrage que le script ou l'extension est en retard ? Une fois par
   version attendue (la clé), pas à chaque ouverture ; jamais sans protection ni à jour. */
export function clePrevenirRetard(etat, versions) {
  if (!etat || etat.type === 'aucune' || etat.aJour) return null;
  var v = etat.type === 'extension' ? versions.extension : versions.script;
  return etat.type + ':' + v;
}
export function doitPrevenirRetard(etat, versions, derniereCle) {
  var cle = clePrevenirRetard(etat, versions);
  return cle && cle !== derniereCle ? cle : null;
}

/* Le texte du message de démarrage. */
export function messageRetard(etat, versions) {
  var quoi = etat.type === 'extension' ? 'L\'extension de nettoyage' : 'Le script de nettoyage';
  var derniere = etat.type === 'extension' ? versions.extension : versions.script;
  return quoi + ' n\'est pas à jour (' + etat.version + ' → ' + derniere + ') : Réglages → Mises à jour.';
}

/* Les cartes. Chacune : { id, titre, statut: 'ok'|'warn'|'info', ligne, actions: [{ texte, href?, onclick?, primaire? }], aide: [texte] }.
   `app` vient de etatApplication, `prot` de etatProtection, `versions` = { script, extension }. */
export function cartesMiseAJour(app, prot, versions) {
  var cartes = [];

  // 1. L'application
  var a = app || { statut: 'inconnu' };
  var carteApp = { id: 'maj-app', titre: 'L\'application', statut: 'ok', ligne: '', actions: [], aide: [] };
  if (a.statut === 'en_retard') {
    carteApp.statut = 'warn';
    carteApp.ligne = 'Une nouvelle version est disponible (' + a.publiee + '). Vous avez ' + a.locale + '.';
    carteApp.actions.push({ texte: 'Mettre à jour maintenant', onclick: 'mettreAJourApplication()', primaire: true });
  } else if (a.statut === 'a_jour') {
    carteApp.ligne = 'À jour (' + a.locale + ').';
    carteApp.actions.push({ texte: 'Forcer la mise à jour', onclick: 'mettreAJourApplication()' });
  } else {
    carteApp.statut = 'info';
    carteApp.ligne = 'Version ' + (a.locale || '?') + ' ; impossible de savoir s\'il y en a une plus récente (hors ligne ?).';
    carteApp.actions.push({ texte: 'Mettre à jour maintenant', onclick: 'mettreAJourApplication()' });
  }
  cartes.push(carteApp);

  // 2. La protection des lecteurs
  var p = prot || { type: 'aucune' };
  var carteProt = { id: 'maj-protection', titre: 'La protection des lecteurs', statut: 'ok', ligne: '', actions: [], aide: [] };
  if (p.type === 'extension') {
    if (p.aJour) {
      carteProt.ligne = 'Extension du Guide des Sports ' + p.version + ' : à jour.';
    } else {
      carteProt.statut = 'warn';
      carteProt.ligne = 'Extension du Guide des Sports ' + p.version + ' : la ' + versions.extension + ' est disponible.';
      carteProt.actions.push({ texte: 'Télécharger l\'extension ' + versions.extension + ' (.zip)', onclick: 'telechargerExtension()', primaire: true });
      carteProt.aide = [
        'Décompressez le fichier.',
        'Ouvrez chrome://extensions (Edge : edge://extensions).',
        'Retirez l\'ancienne extension, puis « Charger l\'extension non empaquetée » et choisissez le nouveau dossier.',
        'Rechargez l\'application.'
      ];
    }
  } else if (p.type === 'script') {
    if (p.aJour) {
      carteProt.ligne = 'Script de nettoyage ' + p.version + ' : à jour.';
      carteProt.aide = ['Tampermonkey vérifie les mises à jour tout seul. Pour forcer : Tampermonkey → Tableau de bord → Vérifier les mises à jour.'];
    } else {
      carteProt.statut = 'warn';
      carteProt.ligne = 'Script de nettoyage ' + p.version + ' : la ' + versions.script + ' est disponible.';
      carteProt.actions.push({ texte: 'Mettre à jour le script', href: URL_SCRIPT, primaire: true });
      carteProt.aide = [
        'Tampermonkey s\'ouvre : cliquez « Mettre à jour » (ou « Installer »).',
        'Rechargez ensuite l\'application.',
        'Pour que ce soit automatique : Tampermonkey → Tableau de bord → Vérifier les mises à jour (il le fait ensuite seul).'
      ];
    }
  } else {
    carteProt.statut = 'info';
    carteProt.ligne = 'Aucune protection détectée : ni extension, ni script. Les publicités et les fenêtres surgissantes passent, et les lecteurs ne sont pas nettoyés.';
    carteProt.actions.push({ texte: 'Voir comment l\'installer', onclick: 'ouvrirGuideInstallation()', primaire: true });
  }
  cartes.push(carteProt);

  return cartes;
}

/* Les nouveautés des versions plus récentes que celle qui tourne (toutes si rien ne tourne ou
   si la version est inconnue), les quatre plus récentes au plus. */
export function nouveautesAfficher(versionInstallee, liste) {
  var l = (liste || NOUVEAUTES).slice();
  var inst = versionInstallee && /^\d+(\.\d+)*$/.test(String(versionInstallee)) ? String(versionInstallee) : null;
  if (inst) l = l.filter(function(n) { return comparer(n.version, inst) > 0; });
  return l.slice(0, 4);
}
function comparer(a, b) {
  var pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
    var x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/* Le HTML de la page : les cartes, puis les nouveautés. `esc` échappe le texte ; les actions
   sont des constantes de ce module (jamais une donnée de l'extérieur), sauf l'adresse du
   script, qui est la constante URL_SCRIPT. */
export function miseAJourHtml(cartes, nouveautes, esc) {
  var e = esc || function(s) { return String(s); };
  var h = '';
  (cartes || []).forEach(function(c) {
    var puce = c.statut === 'ok' ? 'maj-ok' : (c.statut === 'warn' ? 'maj-warn' : 'maj-info');
    h += '<div class="panel maj-carte" id="' + e(c.id) + '">';
    h += '<div class="panel-title"><span>' + e(c.titre) + '</span><span class="maj-puce ' + puce + '">' + (c.statut === 'ok' ? 'À jour' : c.statut === 'warn' ? 'À mettre à jour' : 'À savoir') + '</span></div>';
    h += '<p>' + e(c.ligne) + '</p>';
    if (c.actions && c.actions.length) {
      h += '<div class="btn-row">';
      c.actions.forEach(function(a) {
        var cls = 'btn' + (a.primaire ? ' primary' : '');
        if (a.href) h += '<a class="' + cls + '" href="' + e(a.href) + '" target="_blank" rel="noopener">' + e(a.texte) + '</a>';
        else h += '<button type="button" class="' + cls + '" onclick="' + e(a.onclick) + '">' + e(a.texte) + '</button>';
      });
      h += '</div>';
    }
    if (c.aide && c.aide.length) {
      h += c.aide.length === 1 ? '<p class="help">' + e(c.aide[0]) + '</p>'
        : '<ol class="help">' + c.aide.map(function(t) { return '<li>' + e(t) + '</li>'; }).join('') + '</ol>';
    }
    h += '</div>';
  });
  if (nouveautes && nouveautes.length) {
    h += '<div class="panel maj-carte" id="maj-nouveautes"><div class="panel-title"><span>Ce qui a changé</span></div><ul class="maj-liste">';
    nouveautes.forEach(function(n) { h += '<li><strong>' + e(n.version) + '</strong> <span class="help">' + e(n.date) + '</span><br>' + e(n.texte) + '</li>'; });
    h += '</ul></div>';
  }
  return h;
}

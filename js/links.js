/* Inventaire des liens de flux : combien, chez qui, et où il en manque.

   Trois questions que l'application ne savait pas répondre :

   1. « Combien de liens par domaine primaire ? » — `getDomain` (js/config.js) rend le
      nom d'hôte complet, si bien que `embed1.exemple.com`, `embed2.exemple.com` et
      `cdn.exemple.com` comptaient pour trois fournisseurs distincts. `primaryDomain`
      replie ces sous-domaines sur le domaine enregistrable (la partie qu'on achète),
      seule maille utile pour juger « cette source rapporte-t-elle encore des liens ? ».
   2. « Quels matchs n'ont aucun lien ? » — l'information existait par carte, jamais en
      liste.
   3. « Comment relancer la recherche pour ceux-là ? » — il fallait ouvrir chaque fiche
      une par une pour déclencher `scrapeMatchFlux`.

   Module sans aucun import (comme js/fetcher.js et js/extractors.js) : il lit `S.matches`
   et appelle `scrapeMatchFlux` par la liaison globale que js/scrapers.js publie déjà.
   C'est délibéré — `js/ui.js` s'en sert, et un import direct de `js/scrapers.js` ajouterait
   une arête au cycle utils ↔ config ↔ ui ↔ multiview ↔ main ↔ scrapers ↔ api, dont l'ordre
   d'évaluation est déjà fragile (voir docs/ARCHITECTURE.md, « Graphe de modules »). */

/* Échappement local : `esc` vit dans js/utils.js, que ce module n'importe pas. */
function escHtml(x) {
  return String(x == null ? '' : x)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function scrapeFlux(m, force, deep) {
  if (typeof window.scrapeMatchFlux !== 'function') {
    return Promise.reject(new Error('module de recherche indisponible'));
  }
  return window.scrapeMatchFlux(m, force, deep);
}

/* Suffixes publics à deux niveaux les plus courants sur les sources rencontrées.
   Une liste exhaustive (Public Suffix List) pèse plus de 200 Ko pour un gain nul ici :
   on ne compare que des domaines de streaming, presque tous en TLD simple. */
var TWO_LEVEL_SUFFIXES = [
  'co.uk', 'org.uk', 'me.uk', 'ac.uk', 'gov.uk', 'co.jp', 'ne.jp', 'or.jp',
  'com.au', 'net.au', 'org.au', 'com.br', 'com.mx', 'com.ar', 'com.tr',
  'co.in', 'co.za', 'co.nz', 'co.kr', 'com.cn', 'com.hk', 'com.sg', 'com.pl',
  'com.es', 'com.pt', 'com.ua', 'com.ng', 'com.ph', 'com.vn', 'com.my'
];

/* Domaine enregistrable d'une URL : « player.embedsports.me » → « embedsports.me ».
   Rend '' si l'adresse est inexploitable (jamais d'exception : appelé en boucle sur des
   données agrégées, dont une partie est malformée par nature). */
export function primaryDomain(url) {
  if (!url || typeof url !== 'string') return '';
  var host = '';
  try {
    var candidate = url;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
      candidate = candidate.indexOf('//') === 0 ? 'http:' + candidate : 'http://' + candidate;
    }
    host = new URL(candidate).hostname;
  } catch (e) {
    var m = String(url).match(/^(?:[a-z]+:\/\/)?(?:[^@/\n]+@)?([^:/?#\n]+)/i);
    host = m ? m[1] : '';
  }
  host = String(host || '').toLowerCase().replace(/\.$/, '');
  if (!host || /^\d+(\.\d+){3}$/.test(host)) return host;
  /* Pas de point : ce n'est pas un nom de domaine mais une chaîne quelconque prise pour
     telle par le repli de secours (« Page du match », un libellé collé dans le champ
     d'ajout manuel…). La compter comme un fournisseur fausserait l'inventaire. */
  if (host.indexOf('.') === -1) return '';

  var parts = host.split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');

  var lastTwo = parts.slice(-2).join('.');
  if (TWO_LEVEL_SUFFIXES.indexOf(lastTwo) !== -1 && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return lastTwo;
}

/* Agrège les liens de tous les matchs par domaine primaire.
   Renvoie une liste triée par nombre de liens décroissant, chaque entrée portant :
   - `links`   : nombre total de liens hébergés par ce domaine ;
   - `matches` : nombre de matchs distincts qui en proposent au moins un ;
   - `pages`   : liens classés « page » (non intégrables : ouverts en onglet ou via le
                 tour de passe-passe), le reste étant intégrable directement ;
   - `hosts`   : sous-domaines réellement vus, pour repérer une rotation d'hôtes. */
export function streamDomainStats(matches) {
  var byDomain = {};
  (matches || []).forEach(function (m) {
    if (!m || !m.streamLinks || !m.streamLinks.length) return;
    var seenHere = {};
    m.streamLinks.forEach(function (s) {
      if (!s || !s.url) return;
      var dom = primaryDomain(s.url);
      if (!dom) return;
      if (!byDomain[dom]) byDomain[dom] = { domain: dom, links: 0, matches: 0, pages: 0, hosts: {} };
      var entry = byDomain[dom];
      entry.links++;
      if (s.topLevel) entry.pages++;
      var host = '';
      try { host = new URL(s.url).hostname.replace(/^www\./, ''); } catch (e) {}
      if (host) entry.hosts[host] = (entry.hosts[host] || 0) + 1;
      if (!seenHere[dom]) { seenHere[dom] = true; entry.matches++; }
    });
  });

  return Object.keys(byDomain).map(function (d) {
    var e = byDomain[d];
    return {
      domain: e.domain,
      links: e.links,
      matches: e.matches,
      pages: e.pages,
      embeds: e.links - e.pages,
      hosts: Object.keys(e.hosts).sort(function (a, b) { return e.hosts[b] - e.hosts[a]; })
    };
  }).sort(function (a, b) {
    if (b.links !== a.links) return b.links - a.links;
    return a.domain.localeCompare(b.domain);
  });
}

/* Répartition par domaine primaire pour un seul match (mêmes champs, sans `matches`). */
export function matchDomainStats(m) {
  return streamDomainStats(m ? [m] : []);
}

/* Matchs susceptibles d'avoir des liens mais qui n'en ont aucun.
   Les matchs terminés sont exclus : relancer une recherche pour eux gaspille des
   requêtes sur des pages qui ont disparu des agrégateurs. */
export function matchesWithoutLinks(matches) {
  return (matches || []).filter(function (m) {
    if (!m || m.status === 'finished') return false;
    if (m.streamLinks && m.streamLinks.length > 0) return false;
    return !!(m.matchUrl || (m.altUrls && m.altUrls.length));
  });
}

/* Relance la recherche pour un match précis (bouton 🔎 des cartes et de la fiche).
   `deep` : suit aussi les pages du même match sur les autres sources (m.altUrls). */
export function searchLinksForMatch(matchId) {
  var matches = (window.S && window.S.matches) || [];
  var m = matches.find(function (x) { return String(x.id) === String(matchId); });
  if (!m) return Promise.resolve(0);

  m.streamsLoaded = false;
  return scrapeFlux(m, true, true).then(function () {
    var n = m.streamLinks ? m.streamLinks.length : 0;
    if (window.showToast) {
      window.showToast(n > 0
        ? n + ' lien' + (n > 1 ? 's' : '') + ' trouvé' + (n > 1 ? 's' : '') + ' pour ' + m.homeTeam
        : 'Toujours aucun lien pour ' + m.homeTeam + ' (sources muettes).');
    }
    return n;
  }).catch(function (e) {
    if (window.showToast) window.showToast('Recherche impossible : ' + (e && e.message ? e.message : e));
    return 0;
  });
}

/* Balayage groupé : relance la recherche sur les matchs sans lien, du plus proche dans
   le temps au plus lointain, en série (les sources répondent mal en parallèle) et
   plafonné — sans plafond, un guide de 300 matchs lancerait 300 séquences de requêtes.
   `onProgress(done, total, found)` alimente la barre d'avancement de l'interface. */
export var MISSING_SCAN_LIMIT = 12;

var scanRunning = false;
export function isMissingScanRunning() { return scanRunning; }

export function searchMissingLinks(options) {
  options = options || {};
  var limit = options.limit || MISSING_SCAN_LIMIT;
  var onProgress = options.onProgress || function () {};

  if (scanRunning) return Promise.resolve({ scanned: 0, found: 0, busy: true });

  var candidates = matchesWithoutLinks((window.S && window.S.matches) || [])
    .sort(function (a, b) {
      var wa = a.status === 'live' ? 0 : 1;
      var wb = b.status === 'live' ? 0 : 1;
      if (wa !== wb) return wa - wb;
      return String(a.startTime || '99:99').localeCompare(String(b.startTime || '99:99'));
    })
    .slice(0, limit);

  if (candidates.length === 0) return Promise.resolve({ scanned: 0, found: 0, empty: true });

  scanRunning = true;
  var found = 0;
  var done = 0;
  onProgress(0, candidates.length, 0);

  var chain = Promise.resolve();
  candidates.forEach(function (m) {
    chain = chain.then(function () {
      m.streamsLoaded = false;
      return scrapeFlux(m, true, true).catch(function () {});
    }).then(function () {
      done++;
      if (m.streamLinks && m.streamLinks.length > 0) found++;
      onProgress(done, candidates.length, found);
    });
  });

  return chain.then(function () {
    scanRunning = false;
    return { scanned: candidates.length, found: found };
  }).catch(function (e) {
    scanRunning = false;
    throw e;
  });
}

/* Poignée du badge 🔎 des cartes (js/ui.js). Le badge lui-même sert d'indicateur
   d'avancement : la recherche prend plusieurs secondes et rien d'autre ne bouge à
   l'écran pendant ce temps. */
export function cardSearchLinks(ev, matchId) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  var btn = ev && ev.currentTarget;
  if (btn && btn.disabled) return;
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

  return searchLinksForMatch(matchId).then(function (n) {
    if (!btn || !btn.parentNode) return n;
    if (n > 0) {
      var badge = document.createElement('div');
      badge.className = 'card-streams';
      badge.setAttribute('data-mid', String(matchId));
      badge.title = n + ' flux disponibles';
      badge.textContent = '▶ ' + n;
      btn.parentNode.replaceChild(badge, btn);
    } else {
      btn.disabled = false;
      btn.textContent = '🔎';
      btn.title = 'Aucun lien trouvé — réessayer';
    }
    return n;
  });
}

/* Rendu de l'inventaire par domaine primaire (page Logs). */
export function renderDomainStats() {
  var el = document.getElementById('domain-stats-container');
  if (!el) return;

  var matches = (window.S && window.S.matches) || [];
  var stats = streamDomainStats(matches);
  var totalLinks = stats.reduce(function (n, d) { return n + d.links; }, 0);
  var withLinks = matches.filter(function (m) { return m.streamLinks && m.streamLinks.length; }).length;
  /* Deux nombres distincts : les matchs sans aucun lien, et ceux d'entre eux pour
     lesquels une recherche a une chance d'aboutir (une page de match est connue). Les
     confondre laissait croire à un inventaire complet alors que treize matchs restaient
     sans lien, simplement hors de portée du chercheur. */
  var noLinks = matches.filter(function (m) { return !(m.streamLinks && m.streamLinks.length); }).length;
  var searchable = matchesWithoutLinks(matches).length;

  if (stats.length === 0) {
    el.innerHTML = '<div style="color:var(--muted2); text-align:center;">Aucun lien chargé pour le moment.</div>';
    return;
  }

  var esc = escHtml;
  var max = stats[0].links || 1;

  var head = '<div style="color:var(--muted); margin-bottom:8px;">'
    + totalLinks + ' liens · ' + stats.length + ' domaines · '
    + withLinks + '/' + matches.length + ' matchs pourvus · '
    + noLinks + ' sans lien (' + searchable + ' relançables)</div>';

  var rows = stats.map(function (d) {
    var detail = d.embeds + ' intégrables · ' + d.pages + ' pages · ' + d.matches + ' matchs';
    if (d.hosts.length > 1) detail += ' · ' + d.hosts.length + ' sous-domaines';
    return '<div class="domain-row">'
      + '<span class="dr-name" title="' + esc(d.hosts.join(', ')) + '">' + esc(d.domain) + '</span>'
      + '<span class="dr-count">' + d.links + '</span>'
      + '<span class="dr-detail">' + esc(detail) + '</span>'
      + '<span class="dr-bar"><i style="width:' + Math.round((d.links / max) * 100) + '%"></i></span>'
      + '</div>';
  }).join('');

  el.innerHTML = head + '<div class="domain-stats">' + rows + '</div>';
}

/* Balayage groupé piloté depuis la barre d'outils du Guide. */
export function findMissingLinks() {
  var btn = document.getElementById('btn-find-missing');
  var bar = document.getElementById('missing-scan-progress');
  var setBar = function (html) { if (bar) { bar.innerHTML = html; bar.style.display = html ? 'flex' : 'none'; } };

  if (isMissingScanRunning()) {
    if (window.showToast) window.showToast('Recherche déjà en cours…');
    return Promise.resolve();
  }
  if (btn) btn.disabled = true;

  return searchMissingLinks({
    onProgress: function (done, total, found) {
      setBar('<span>🔎 ' + done + '/' + total + ' · ' + found + ' pourvus</span>'
        + '<span class="ms-bar"><i style="width:' + Math.round((done / total) * 100) + '%"></i></span>');
    }
  }).then(function (res) {
    if (btn) btn.disabled = false;
    setBar('');
    if (res.empty) {
      if (window.showToast) window.showToast('Tous les matchs à venir ont déjà des liens.');
      return res;
    }
    if (window.showToast) {
      window.showToast(res.found + ' match' + (res.found > 1 ? 's' : '') + ' pourvu' + (res.found > 1 ? 's' : '')
        + ' sur ' + res.scanned + ' recherché' + (res.scanned > 1 ? 's' : '') + '.');
    }
    if (typeof window.buildEPG === 'function' && window.S) window.buildEPG(window.S.matches);
    renderDomainStats();
    return res;
  }).catch(function (e) {
    if (btn) btn.disabled = false;
    setBar('');
    if (window.showToast) window.showToast('Recherche interrompue : ' + (e && e.message ? e.message : e));
  });
}

/* Filtre la liste des flux d'une fiche de match sur un ou plusieurs domaines primaires
   (`doms` : liste séparée par des virgules ; vide = tout afficher). La pastille « Autres »
   en porte plusieurs, d'où la liste plutôt qu'un domaine unique.
   Purement visuel — aucune donnée n'est perdue : les lignes portent leur domaine en
   attribut (renderFluxItem), on masque les autres. */
export function filterFluxByDomain(doms) {
  var col = document.getElementById('modal-right-col');
  if (!col) return;
  var wanted = String(doms || '').split(',').filter(Boolean);

  var chips = col.querySelectorAll('.dom-chip');
  for (var i = 0; i < chips.length; i++) {
    chips[i].classList.toggle('active', (chips[i].getAttribute('data-doms') || '') === (doms || ''));
  }

  var rows = col.querySelectorAll('.si[data-dom]');
  for (var j = 0; j < rows.length; j++) {
    var show = wanted.length === 0 || wanted.indexOf(rows[j].getAttribute('data-dom')) !== -1;
    rows[j].style.display = show ? '' : 'none';
  }
}

/* Liaisons globales : l'interface les appelle depuis des attributs onclick.
   Gardées derrière un test d'environnement pour que les tests unitaires (Node, sans DOM)
   puissent importer ce module. */
if (typeof window !== 'undefined') {
  window.primaryDomain = primaryDomain;
  window.streamDomainStats = streamDomainStats;
  window.matchDomainStats = matchDomainStats;
  window.matchesWithoutLinks = matchesWithoutLinks;
  window.searchLinksForMatch = searchLinksForMatch;
  window.searchMissingLinks = searchMissingLinks;
  window.cardSearchLinks = cardSearchLinks;
  window.renderDomainStats = renderDomainStats;
  window.findMissingLinks = findMissingLinks;
  window.filterFluxByDomain = filterFluxByDomain;
}

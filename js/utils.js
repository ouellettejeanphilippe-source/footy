import { fetchSubPages } from './scrapers.js';
import { S } from './state.js';
import { PROXIES, resolveUrl } from './config.js';
import { inspectPageContent, orderProxies, recordProxyResult, DEFAULT_PROXY_TIMEOUT, statutAcceptable } from './fetcher.js';
import { getBridgeStatus, fetchViaBridge } from './embed-bridge.js';
import { mvFlux, toggleMultiviewPip, openOptionsPage, openLogsPage, openScriptPage, toggleMultiview, quitterModeCinema } from './multiview.js';
import { userPrefs, buildEPG, getOriginalMatchId } from './ui.js';
import { openFavPage } from './main.js';

/* ══ HELPERS ═══════════════════════════ */

/* ══ LOCALSTORAGE UTILS ═════════════════ */
export function safeStorageGet(key, fallback = null) {
    try {
        var val = localStorage.getItem(key);
        return val !== null ? val : fallback;
    } catch(e) {
        return fallback;
    }
}

/* Écritures refusées par le stockage local, par appareil.

   `safeStorageSet` avalait TOUTE erreur, y compris `QuotaExceededError` — le cas le plus
   probable sur un téléphone, où la limite est de quelques mégaoctets et où le calendrier
   du jour, les liens et les caches par date s'accumulent. Un stockage plein est alors
   invisible : les écritures ne prennent pas, les lectures rendent une version ancienne,
   et rien ne le dit. On retient donc la dernière erreur et leur nombre ; la page Logs
   les montre sous « Cet appareil ». */
export var stockageInfo = { echecs: 0, derniereCle: null, derniereErreur: null, liberees: [] };

/* Stockage plein : faire de la place plutôt que perdre l'écriture (18 octobre 2026,
   « Stockage local ❌ 1 écriture refusée · QuotaExceededError · 4569 Ko » sous Firefox,
   dont la limite est de 5 120 Ko à ce compte). Mesuré sur les données du jour : le
   calendrier du jour, qui garde les liens fusionnés, fait à lui seul 620 Ko (68 matchs,
   2 931 liens), celui d'hier autant ; les matchs du dernier scraping, toutes sources
   confondues, vont jusqu'à 1 100 Ko (700 matchs, 4 750 liens), et le cache des liens
   s'y ajoute. Tout cela se refait depuis le réseau. On le retire dans cet ordre, jusqu'à
   ce que l'écriture passe : jamais les favoris, les réglages, l'état du lecteur, ce que
   le navigateur a appris des lecteurs et des débits, ni le relevé des sorties. */
export var CACHES_JETABLES = ['stream_cache', 'last_scraped_matches', 'api_calendar_cache_'];

function estPlein(e) {
    var nom = e && (e.name || '');
    return nom === 'QuotaExceededError' || nom === 'NS_ERROR_DOM_QUOTA_REACHED' || (e && (e.code === 22 || e.code === 1014));
}

function rangJetable(k) {
    for (var i = 0; i < CACHES_JETABLES.length; i++) {
        var p = CACHES_JETABLES[i];
        if (k === p || (p.slice(-1) === '_' && k && k.indexOf(p) === 0)) return i;
    }
    return Infinity;
}

/* Les clés jetables présentes, dans l'ordre où on les sacrifie (les calendriers du plus
   ancien au plus récent), sans jamais la clé qu'on écrit. Un cache n'en chasse pas un
   plus utile que lui : les matchs du dernier scraping ne font pas partir le calendrier. */
function clesJetables(sauf) {
    var presentes = [];
    try { for (var i = 0; i < localStorage.length; i++) presentes.push(localStorage.key(i)); } catch (e) { return []; }
    var plafond = rangJetable(sauf);
    return presentes.filter(function(k) { var r = rangJetable(k); return k && k !== sauf && r !== Infinity && r <= plafond; })
        .sort(function(a, b) { return (rangJetable(a) - rangJetable(b)) || (a < b ? -1 : (a > b ? 1 : 0)); });
}

export function safeStorageSet(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch(e) {
        if (estPlein(e)) {
            var jetables = clesJetables(key);
            for (var i = 0; i < jetables.length; i++) {
                try { localStorage.removeItem(jetables[i]); } catch (e2) {}
                if (stockageInfo.liberees.indexOf(jetables[i]) < 0) stockageInfo.liberees.push(jetables[i]);
                try { localStorage.setItem(key, value); if (typeof window !== 'undefined') window.stockageInfo = stockageInfo; return true; } catch (e3) {}
            }
        }
        stockageInfo.echecs++;
        stockageInfo.derniereCle = key;
        stockageInfo.derniereErreur = (e && (e.name || e.message)) ? String(e.name || e.message) : 'refus';
        if (typeof window !== 'undefined') window.stockageInfo = stockageInfo;
        return false;
    }
}

/* Les plus grosses clés, pour la page Logs : [[clé, Ko], …]. */
export function plusGrossesCles(n) {
    try {
        var t = [];
        for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            t.push([k, Math.round(((k || '').length + (localStorage.getItem(k) || '').length) / 1024)]);
        }
        return t.sort(function(a, b) { return b[1] - a[1]; }).slice(0, n || 3);
    } catch (e) { return []; }
}

/* Le calendrier d'un jour passé n'a plus besoin de ses liens fusionnés (620 Ko pour la
   journée du 18 octobre) : ils viennent de data/streams.json et du scraping à chaque passe. On
   garde ses matchs (la nuit appartient à la veille, js/nuit.js) et on retire les liens. */
export function allegerCalendrier(dateStr) {
    var cle = 'api_calendar_cache_' + dateStr;
    var brut = safeStorageGet(cle);
    if (!brut) return false;
    try {
        var c = JSON.parse(brut);
        if (!c || !Array.isArray(c.matches) || !c.matches.some(function(m) { return m && m.streamLinks && m.streamLinks.length; })) return false;
        c.matches.forEach(function(m) { if (m && m.streamLinks) { m.streamLinks = []; m.streamsLoaded = false; } });
        return safeStorageSet(cle, JSON.stringify(c));
    } catch (e) { return false; }
}

/* Le calendrier du jour, rangé SANS les liens qui reviennent du serveur (29 octobre 2026,
   « bien meilleure performance sur CCGTV »). 590 Ko de ses 683 Ko étaient des liens de
   data/streams.json, que chaque passe relit et refusionne : les ranger, c'était payer la mise
   en texte à chaque passe et la relecture au démarrage pour rien. On ne garde que ceux que
   l'appareil a trouvés lui-même (fiche d'un match, lecture des sources, rattrapage) : ceux-là
   n'ont pas d'autre copie après 30 minutes (`stream_cache`). Sans la liste du serveur (pas
   encore lue, injoignable), rien n'est retiré. Les matchs touchés sont copiés : la grille
   garde ses liens. Un match laissé sans lien repasse `streamsLoaded = false`, comme
   `allegerCalendrier`. */
export function sansLiensDuServeur(matches, serveur) {
    var urls = new Set();
    (serveur || []).forEach(function(m) {
        ((m && m.streamLinks) || []).forEach(function(l) { if (l && l.url) urls.add(l.url); });
    });
    if (!urls.size || !Array.isArray(matches)) return matches;
    return matches.map(function(m) {
        if (!m || !Array.isArray(m.streamLinks) || !m.streamLinks.length) return m;
        var garde = m.streamLinks.filter(function(l) { return !l || !urls.has(l.url); });
        if (garde.length === m.streamLinks.length) return m;
        var copie = Object.assign({}, m, { streamLinks: garde });
        if (!garde.length) copie.streamsLoaded = false;
        return copie;
    });
}

/* Taille approximative de ce que l'application garde en local, en kilo-octets. */
export function tailleStockageKo() {
    try {
        var total = 0;
        for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            total += (k || '').length + (localStorage.getItem(k) || '').length;
        }
        return Math.round(total / 1024);
    } catch (e) { return null; }
}

export function safeStorageGetJSON(key, fallback = null) {
    var val = safeStorageGet(key);
    if (val !== null) {
        try {
            return JSON.parse(val);
        } catch(e) {}
    }
    return fallback;
}

export function safeStorageRemove(key) {
    try {
        localStorage.removeItem(key);
    } catch(e) {}
}

/* La grille complète (matchs + liens fusionnés) est mise en cache sous une clé par
   jour consulté (`api_calendar_cache_YYYYMMDD`), et rien ne les supprimait jamais :
   quelques centaines de kilo-octets s'ajoutaient à chaque nouvelle date visitée
   jusqu'à ce que le quota du navigateur (5 Mo) saute — après quoi toute écriture,
   y compris les préférences, échoue en silence (voir safeStorageSet). On garde
   aujourd'hui et hier (le fuseau Est peut différer du fuseau local en soirée) et on
   purge le reste, une fois au démarrage. */
export function purgeStaleCalendarCache(keepDateStrs) {
    try {
        var keep = {}; (keepDateStrs || []).forEach(function(d) { keep[d] = true; });
        var toRemove = [];
        for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (k && k.indexOf('api_calendar_cache_') === 0 && !keep[k.slice('api_calendar_cache_'.length)]) {
                toRemove.push(k);
            }
        }
        toRemove.forEach(function(k) { localStorage.removeItem(k); });
        return toRemove.length;
    } catch (e) { return 0; }
}

export function safeStorageSetJSON(key, value) {
    return safeStorageSet(key, JSON.stringify(value));
}

/* ─── Les gros caches locaux : écrits au plus tous les quarts d'heure ──────────
   « Bien meilleure performance sur CCGTV » (29 octobre 2026). Mesuré dans Chromium,
   processeur ralenti six fois : `api_calendar_cache_<jour>` pèse 683 Ko (122 matchs,
   2 916 liens, dont 590 Ko de liens), et le réécrire coûtait 330 ms d'un seul tenant,
   presque tout dans `localStorage.setItem` — la moitié du gel de chaque passe de
   chargement (toutes les 5 min), et le même gel à chaque relève des scores en direct
   (`majScoresDansCache`, chaque minute pendant les matchs), lecteur ouvert compris.
   `last_scraped_matches` (les liens lus par le navigateur) suit la même voie. Ces caches
   ne servent qu'à redessiner vite au démarrage, et une passe les refait aussitôt :
   l'écriture part tout de suite si la dernière date de plus d'`ECART_ECRITURE_CACHE_MS`,
   sinon elle attend (la dernière valeur seulement) et part au bout du délai, ou dès que
   la page est cachée ou quittée. `lireCacheLocal` rend la valeur en attente : la lire
   juste après l'avoir écrite donne bien ce qu'on vient d'écrire, comme avant. */
export var ECART_ECRITURE_CACHE_MS = 15 * 60 * 1000;
/* Posés à la première utilisation, pas à l'évaluation du module : `js/main.js` lit
   `last_scraped_matches` pendant l'évaluation du cycle d'imports, avant ces lignes. */
var cachesEnAttente;               // clé → texte JSON pas encore écrit
var derniereEcritureCache;
var minuteurCaches;
function ecartEcriture() { return ECART_ECRITURE_CACHE_MS || 15 * 60 * 1000; }

export function lireCacheLocal(key, fallback = null) {
    if (cachesEnAttente && Object.prototype.hasOwnProperty.call(cachesEnAttente, key)) {
        try { return JSON.parse(cachesEnAttente[key]); } catch (e) { return fallback; }
    }
    return safeStorageGetJSON(key, fallback);
}

/* Écrit tout ce qui attend ; rend le nombre de clés écrites. */
export function viderCachesEnAttente() {
    if (minuteurCaches) { clearTimeout(minuteurCaches); minuteurCaches = null; }
    var cles = Object.keys(cachesEnAttente || {});
    for (var i = 0; i < cles.length; i++) {
        var texte = cachesEnAttente[cles[i]];
        delete cachesEnAttente[cles[i]];
        safeStorageSet(cles[i], texte);
    }
    if (cles.length) derniereEcritureCache = Date.now();
    return cles.length;
}

export function ecrireCacheLocal(key, value) {
    var texte = JSON.stringify(value);
    cachesEnAttente = cachesEnAttente || {};
    var ecart = Date.now() - (derniereEcritureCache || 0);
    if (!minuteurCaches && (ecart >= ecartEcriture() || ecart < 0)) {
        delete cachesEnAttente[key];
        derniereEcritureCache = Date.now();
        return safeStorageSet(key, texte);
    }
    cachesEnAttente[key] = texte;
    if (!minuteurCaches) {
        minuteurCaches = setTimeout(viderCachesEnAttente, Math.max(1000, ecartEcriture() - ecart));
        // Sous Node (tests, scripts), un minuteur d'un quart d'heure ne doit pas retenir le processus.
        if (minuteurCaches && typeof minuteurCaches.unref === 'function') minuteurCaches.unref();
    }
    return true;
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('pagehide', viderCachesEnAttente);
    if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('visibilitychange', function() {
            if (document.visibilityState === 'hidden') viderCachesEnAttente();
        });
    }
    window.viderCachesEnAttente = viderCachesEnAttente;
}


export function pad(n){return String(n).padStart(2,'0');}
export function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

export function getLeagueDuration(league) {
  if(!league) return 180;
  var l = league.toLowerCase();

  if(l.indexOf('mlb') >= 0 || l.indexOf('baseball') >= 0) return 180;
  if(l.indexOf('nfl') >= 0 || l.indexOf('american football') >= 0 || l.indexOf('cfl') >= 0) return 180;
  if(l.indexOf('nba') >= 0 || l.indexOf('basketball') >= 0) return 150;
  if(l.indexOf('nhl') >= 0 || l.indexOf('hockey') >= 0 || l.indexOf('pwhl') >= 0 || l.indexOf('qmjhl') >= 0 || l.indexOf('lhjmq') >= 0) return 150;
  if(l.indexOf('f1') >= 0 || l.indexOf('formula 1') >= 0) return 120;
  if(l.indexOf('motogp') >= 0 || l.indexOf('moto gp') >= 0) return 60;
  if(l.indexOf('indycar') >= 0 || l.indexOf('indy') >= 0) return 120;
  if(l.indexOf('wwe') >= 0 || l.indexOf('wrestling') >= 0) return 180;
  if(['lcs', 'lec', 'lpl', 'lck', 'msi', 'worlds', 'league of legends'].includes(l)) return 60;

  return 180; // Default requested
}
export function escJs(s){var e=String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'\\"');return e.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
export function lg(label,val){S.log.push({l:String(label),v:String(val||'')});}


/* ══ RESOLVER ═══════════════════════════ */
export function resolveStreamUrl(url) {
    return new Promise(function(resolve) {
        if (!url || typeof url !== 'string') {
            resolve(url);
            return;
        }

        // Convert YouTube URLs to embed format
        var ytMatch = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|live\/)|youtu\.be\/)([^"&?\/\s]{11})/i);
        if (ytMatch && ytMatch[1]) {
            resolve('https://www.youtube.com/embed/' + ytMatch[1] + '?autoplay=1');
            return;
        }

        // Convert Twitch URLs to embed format with parent
        var twitchMatch = url.match(/(?:twitch\.tv\/|player\.twitch\.tv\/\?channel=)([^"&?\/\s]+)/i);
        if (twitchMatch && twitchMatch[1] && twitchMatch[1].toLowerCase() !== 'videos') {
            var parent = window.location.hostname || 'localhost';
            resolve('https://player.twitch.tv/?channel=' + twitchMatch[1] + '&parent=' + parent);
            return;
        }

        /* Rien d'autre à faire ici : l'adresse est rendue telle quelle.

           Cette fonction contenait un second moteur d'extraction, écrit à la main :
           première <iframe> dont le `src` ne contenait pas « ads », plus des expressions
           régulières sur les charges Next.js (`directStreams`, `iframeStreams`). Il était
           déclenché par une LISTE FIGÉE DE DOUZE DOMAINES (`isAggregateSite`) — or ces
           sources changent d'adresse plusieurs fois par saison, et la liste cessait alors
           silencieusement de correspondre.

           Tout cela est déjà fait, en mieux, par js/extractors.js : six stratégies de
           récolte, un pointage, aucun nom de site en dur, et des tests. Et les deux
           appelants de resolveStreamUrl enchaînent justement sur ce moteur —
           `resolveBlockedEmbed` pour le Multivision, `scrapeMatchFlux` pour l'ajout
           manuel d'un flux. Le moteur à la main passait donc AVANT le bon et le
           court-circuitait quand il croyait avoir trouvé.

           Restent ici les seules conversions qu'aucun extracteur ne peut deviner, parce
           qu'elles tiennent à la forme d'URL d'un service : YouTube, Twitch, et les règles
           définies par l'utilisateur dans l'Investigateur. */
        resolve(url);
    });
}

/* ══ FETCH ══════════════════════════════ */

/* ══ FETCH PAGE (direct + proxys CORS) ══════════════════════════════
   Stratégie :
   1. Cache mémoire court (45 s) + dédoublonnage des requêtes en cours : plusieurs
      appelants (modal, fetchSubPages, resolveStreamUrl) partagent le même téléchargement.
   2. Transports essayés dans l'ordre de santé (voir js/fetcher.js) : direct d'abord
      (échoue vite en CORS, réussit côté serveur), puis chaque proxy.
   3. Requêtes "hedgées" : si un transport ne répond pas sous HEDGE_DELAY, le suivant
      est lancé en parallèle ; la première réponse valide gagne, les autres sont annulées.
   4. Validation du contenu (inspectPageContent) : un HTTP 200 qui contient une page
      d'erreur de proxy est traité comme un échec et le proxy est relégué 3 minutes.
*/
var PAGE_CACHE = {};
var PAGE_CACHE_TTL = 45 * 1000;
var PAGE_CACHE_MAX = 80;
var INFLIGHT = {};
var HEDGE_DELAY = 3000;
var proxyHealth = safeStorageGetJSON('proxy_health', {}) || {};

function pruneCache() {
    var keys = Object.keys(PAGE_CACHE);
    if (keys.length <= PAGE_CACHE_MAX) return;
    keys.sort(function(a, b) { return PAGE_CACHE[a].t - PAGE_CACHE[b].t; });
    for (var i = 0; i < keys.length - PAGE_CACHE_MAX; i++) delete PAGE_CACHE[keys[i]];
}

export function getProxyHealth() { return proxyHealth; }

function noteProxy(proxy, url, ok) {
    recordProxyResult(proxyHealth, proxy, url, ok, Date.now());
    safeStorageSetJSON('proxy_health', proxyHealth);
}

export function fetchPage(url, opts){
  opts = opts || {};
  var now = Date.now();
  if (!opts.force) {
      var cached = PAGE_CACHE[url];
      if (cached && now - cached.t < PAGE_CACHE_TTL) return Promise.resolve(cached.html);
      if (INFLIGHT[url]) return INFLIGHT[url];
  }

  /* Le pont du script utilisateur passe AVANT les proxys quand il est là.

     Il n'est pas soumis à la politique d'origine croisée : il ne dépend donc d'aucun
     service tiers, contrairement aux proxys CORS publics qui tombent tous en même temps.
     Relevé du 4 septembre 2026, sur `example.com` comme sur les sites sources :
     allorigins rend 500/522, codetabs 522, et proxy.cors.sh est passé derrière un
     challenge Cloudflare qui rend 403 dès qu'un en-tête Origin est présent — c'est-à-dire
     pour toute requête venue d'un navigateur. Les quatre transports étant hors service,
     PLUS AUCUNE extraction ne fonctionnait : ni la recherche de flux d'un match, ni la
     résolution d'un lien d'agrégateur, ni le tour de passe-passe, qui partagent tous
     `fetchPage`.

     Le pont existait déjà et était éprouvé, mais n'était câblé que dans le tour de
     passe-passe. Le placer ici répare toutes ces voies d'un coup, pour qui a le script.
     En cas d'échec on retombe sur les proxys : le pont n'est pas un point de passage
     obligé, seulement le premier essayé.

     Sans le pont, le seul transport public qui tienne encore (29 septembre 2026) est le
     lecteur de Jina, en tête de liste après l'accès direct — voir buildProxyList
     (js/fetcher.js). C'est lui qui rend le rattrapage possible depuis la version web. */
  function fetchViaBridgeFirst() {
      var bridge = null;
      try { bridge = getBridgeStatus(); } catch (e) {}
      if (!bridge || !bridge.available) return Promise.reject(new Error('pont absent'));
      return fetchViaBridge(url).then(function(res) {
          var html = res && res.html;
          if (!html || String(html).length < 200) throw new Error('pont : réponse vide');
          return html;
      });
  }

  var p = fetchViaBridgeFirst().then(function(html) {
      lg('OK pont script utilisateur', 'len=' + html.length);
      S.proxy = 'script';
      return html;
  }).catch(function() { return fetchViaProxies(); });

  function fetchViaProxies() { return new Promise(function(resolve, reject){
    var order = orderProxies(PROXIES, proxyHealth, url, Date.now());
    var errs = [], launched = 0, pending = 0, done = false, hedgeTimer = null;
    var controllers = [];

    function finish(html, proxy) {
        if (done) return;
        done = true;
        clearTimeout(hedgeTimer);
        controllers.forEach(function(c) { try { c.abort(); } catch(e) {} });
        noteProxy(proxy, url, true);
        lg('OK ' + proxy.id, 'len=' + html.length);
        S.proxy = proxy.id;
        resolve(html);
    }

    function fail(proxy, msg, proxyFault) {
        if (done) return;
        errs.push(proxy.id + ': ' + msg);
        if (proxyFault !== false) noteProxy(proxy, url, false);
        pending--;
        clearTimeout(hedgeTimer);
        launchNext();
    }

    function launchNext() {
        if (done) return;
        if (launched >= order.length) {
            if (pending === 0) { done = true; reject(new Error(errs.join('\n') || 'Aucun transport disponible')); }
            return;
        }
        var proxy = order[launched++];
        var pu;
        /* Un transport peut changer de forme selon la page (js/relais.js) : adresse,
           en-têtes et lecture viennent alors de l'adaptation, la santé reste la sienne. */
        var forme = proxy;
        try {
            var adapte = proxy.adapter ? proxy.adapter(url) : null;
            if (adapte) forme = { headers: adapte.headers, parse: adapte.parse };
            pu = adapte ? adapte.url : proxy.build(url);
        } catch(e) { errs.push(proxy.id + ': ' + e.message); launchNext(); return; }
        pending++;
        lg('Essai ' + proxy.id, pu.slice(0, 70) + '…');

        var ctrl = new AbortController();
        controllers.push(ctrl);
        var timeout = setTimeout(function() { ctrl.abort(); }, proxy.timeout || DEFAULT_PROXY_TIMEOUT);
        var headers = { 'Accept': 'text/html,*/*' };
        if (forme.headers) { for (var h in forme.headers) headers[h] = forme.headers[h]; }

        var status = 0;
        fetch(pu, { signal: ctrl.signal, headers: headers, credentials: 'omit' })
          .then(function(r) {
              status = r.status;
              /* Un « introuvable » qui sert quand même la grille du site n'est pas un
                 échec : voir statutAcceptable (js/fetcher.js). Réservé à la découverte
                 des listes, jamais aux pages de match. */
              if (!statutAcceptable(r.status, opts)) throw new Error('HTTP ' + r.status);
              return r.text();
          })
          .then(function(t) {
              clearTimeout(timeout);
              if (done) return;
              if (forme.parse) { try { t = forme.parse(t); } catch(e) { throw new Error('réponse illisible'); } }
              var bad = inspectPageContent(t);
              if (bad) { fail(proxy, bad.reason, bad.proxyFault); return; }
              finish(t, proxy);
          })
          .catch(function(e) {
              clearTimeout(timeout);
              if (done) return;
              var msg = e && e.name === 'AbortError' ? 'délai dépassé' : (e && e.message ? e.message : String(e));
              // Un 4xx du site cible n'est pas une preuve de défaillance du proxy ;
              // les erreurs réseau, délais et 5xx le sont.
              var proxyFault = !(status >= 400 && status < 500 && status !== 429);
              fail(proxy, msg, proxyFault);
          });

        // Hedging : si ce transport traîne, on lance le suivant en parallèle
        hedgeTimer = setTimeout(launchNext, HEDGE_DELAY);
    }
    launchNext();
  }); }

  INFLIGHT[url] = p;
  p.then(function(html) { PAGE_CACHE[url] = { t: Date.now(), html: html }; pruneCache(); })
   .catch(function() {})
   .then(function() { if (INFLIGHT[url] === p) delete INFLIGHT[url]; });
  return p;
}

/* ══ TOAST ══════════════════════════════ */
export function showToast(msg){var t=document.getElementById('toast');document.getElementById('toasttxt').textContent=msg;t.classList.add('show');setTimeout(function(){t.classList.remove('show');},2500);}


/* ══ FILTERS ════════════════════════════ */



/* Vues atteignables depuis la navigation. « upcoming » a été retirée : le Guide couvre
   déjà le programme de la journée, dont elle n'était qu'une liste à plat. */
export var FILTERS = ['all','live','fav','options','logs','script'];

/* Pages hors grille : une seule fonction les montre/masque, plutôt que quatre copies
   du même bloc (openFavPage, openOptionsPage, openLogsPage, openScriptPage). */
export var PAGE_IDS = ['fav-page', 'options-page', 'logs-page', 'script-page'];
export function showPage(id) {
  PAGE_IDS.forEach(function(pid) {
    var el = document.getElementById(pid);
    if (el) el.style.display = (pid === id) ? 'flex' : 'none';
  });
  var epg = document.getElementById('epg');
  if (epg) epg.style.display = id ? 'none' : 'flex';
  var marea = document.getElementById('marea');
  if (marea && !id) marea.style.display = 'flex';
  var sf = document.getElementById('sport-filters-container');
  if (sf) sf.style.display = id ? 'none' : 'flex';
  /* Le bouton « Actualiser » n'a de sens que devant la grille : sur les pages Logs,
     Options et Script il n'y a rien à rafraîchir (styles.css, `body.view-page`). */
  if (document.body) document.body.classList.toggle('view-page', !!id);
}

/* Onglet actif : une classe, pas des styles en ligne. L'ancienne version posait
   couleur, bordure, fond et ombre en `style` sur chaque bouton à chaque appel, ce que
   la feuille de style ne pouvait plus corriger. */
/* Les pages de l'onglet Réglages (index.html, #reglages-barre) : l'onglet reste allumé
   sur chacune, et la barre des Réglages dit laquelle est ouverte. */
var PAGES_REGLAGES = ['options', 'logs', 'script'];
export function ongletDeLaVue(vue) {
  return PAGES_REGLAGES.indexOf(vue) !== -1 ? 'options' : vue;
}
export function syncNavState(active) {
  var onglet = ongletDeLaVue(active);
  FILTERS.forEach(function(k) {
    var el = document.getElementById('filter-' + k);
    if (!el) return;
    var on = k === onglet;
    el.classList.toggle('active-toggle', on);
    if (on) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  });
  PAGES_REGLAGES.forEach(function(k) {
    var rb = document.getElementById('rb-' + k);
    if (!rb) return;
    rb.classList.toggle('active-toggle', k === active);
    if (k === active) rb.setAttribute('aria-current', 'page'); else rb.removeAttribute('aria-current');
  });
  var mvBtn = document.getElementById('mv-toggle-btn');
  if (mvBtn) {
    mvBtn.classList.toggle('active-toggle', active === 'player');
    mvBtn.classList.toggle('has-streams', active !== 'player' && mvFlux.length > 0);
    if (active === 'player') mvBtn.setAttribute('aria-current', 'page'); else mvBtn.removeAttribute('aria-current');
    mvBtn.style.cssText = '';
    var compte = document.getElementById('nav-compte');
    if (compte) { compte.hidden = !mvFlux.length; compte.textContent = mvFlux.length ? String(mvFlux.length) : ''; }
  }
  document.body.setAttribute('data-view', active);
  /* La grille retenue pendant le lecteur (buildEPG, js/ui.js) est dessinée en le
     quittant, par quelque chemin que ce soit. */
  if (active !== 'player' && typeof window.grilleEnAttente === 'function') window.grilleEnAttente();
}

export function applyFilter(f){
  /* Un appel à une vue disparue (raccourci mémorisé, ancien code) laisserait sinon
     `data-filter` sur une valeur que plus aucune branche de rendu ne traite, donc une
     page vide sans message. On retombe sur le direct. */
  if (FILTERS.indexOf(f) === -1) f = 'live';
  S.filter=f;
  syncNavState(f);

  // Le Multivision plein écran passe en PiP dès qu'on revient au guide
  var mvc = document.getElementById('mv-container');
  if(mvc && mvc.style.display !== 'none' && !mvc.classList.contains('mv-pip')) {
      toggleMultiviewPip();
  }
  /* Filet : on revient à une vue de la page, elle doit défiler. Le mode Cinéma du
     lecteur bloque `body { overflow }` ; quel que soit le chemin par lequel on est
     arrivé ici, c'est fini (voir quitterModeCinema, js/multiview.js). */
  quitterModeCinema();

  /* Les contrôles « Maintenant » et ± pilotent uniquement la grille temporelle du Guide
     (visibilité portée par body.view-timeline, styles.css). */
  var zoomEpg = document.querySelector('.zoom-controls');
  if (zoomEpg) zoomEpg.style.removeProperty('display');
  document.body.classList.toggle('view-timeline', f === 'all');

  if (f === 'options') {
      openOptionsPage();
  } else if (f === 'logs') {
      openLogsPage();
  } else if (f === 'script') {
      openScriptPage();
  } else if (f === 'fav') {
      openFavPage();
  } else {
      var errbox = document.getElementById('errbox');
      if (errbox && errbox.classList.contains('show')) {
          // Une vraie erreur reste affichée ; on ne masque que les pages annexes
          PAGE_IDS.forEach(function(pid) { var el = document.getElementById(pid); if (el) el.style.display = 'none'; });
      } else {
          showPage(null);
      }

      document.body.setAttribute('data-filter', f);

      if (typeof S !== 'undefined' && S.matches && S.matches.length > 0) {
          buildEPG(S.matches);
      }
      window.dispatchEvent(new Event('filterChanged'));
  }
}

export function openMultiviewTab() {
    showPage(null);
    PAGE_IDS.forEach(function(pid) { var el = document.getElementById(pid); if (el) el.style.display = 'none'; });
    syncNavState('player');

    var mvc = document.getElementById('mv-container');
    if(mvc) {
        if(mvc.style.display === 'none') {
            toggleMultiview(); // Open it
        } else if(mvc.classList.contains('mv-pip')) {
            toggleMultiviewPip(); // Restore from PIP to full
        }
    }
}

export function toggleAccordion(lgName) {
  S.collapsedLg[lgName] = !S.collapsedLg[lgName];
  // Sync section state if it was an epg section
  S.collapsedSections[lgName] = S.collapsedLg[lgName];

  var isC = S.collapsedLg[lgName];
  if (!isC) {
      // If it's a secondary league or "Autres Flux", fetch streams for matches in it when expanded
      var matchesToFetch = [];
      var rowsToFetch = document.querySelectorAll('.mrow[data-lg="' + lgName + '"], .match-card[data-lg="' + lgName + '"]');
      rowsToFetch.forEach(function(el) {
          var id = getOriginalMatchId(el.id.replace('mb-', ''));   // la copie Favoris porte un suffixe
          if (id) {
              var m = S.matchMap.get(id);
              if (m && !m.streamsLoaded) {
                  matchesToFetch.push(m);
              }
          }
      });
      if (matchesToFetch.length > 0 && typeof fetchSubPages === 'function') {
          fetchSubPages(matchesToFetch);
      }
  }

  var hdrs = document.querySelectorAll('.lg-hdr[data-lg-hdr="' + lgName + '"]');
  hdrs.forEach(function(h) {
      if(isC) h.classList.add('collapsed');
      else h.classList.remove('collapsed');
  });

  var rows = document.querySelectorAll('.mrow[data-lg="' + lgName + '"]');
  rows.forEach(function(r) {
      r.style.display = isC ? 'none' : 'flex';
  });

  var cards = document.querySelectorAll('.match-card[data-lg="' + lgName + '"]');
  cards.forEach(function(c) {
      c.style.display = isC ? 'none' : 'flex';
  });
}

// Global bindings for HTML compatibility
window.safeStorageGet = safeStorageGet;
window.safeStorageSet = safeStorageSet;
window.safeStorageGetJSON = safeStorageGetJSON;
window.safeStorageSetJSON = safeStorageSetJSON;
window.safeStorageRemove = safeStorageRemove;
window.purgeStaleCalendarCache = purgeStaleCalendarCache;
window.getLeagueDuration = getLeagueDuration;
window.escJs = escJs;
window.lg = lg;
window.fetchPage = fetchPage;
window.getProxyHealth = getProxyHealth;
window.showToast = showToast;
window.applyFilter = applyFilter;
window.showPage = showPage;
window.openMultiviewTab = openMultiviewTab;
window.toggleAccordion = toggleAccordion;
window.resolveStreamUrl = resolveStreamUrl;

export function formatTeamNameBreak(name) {
    if (!name) return '';
    var n = name.trim();
    var parts = n.split(' ');
    if (parts.length <= 1) return esc(n);
    if (parts.length === 2) return esc(parts[0]) + '<br>' + esc(parts[1]);

    var prefixes = [
        "new york", "new jersey", "tampa bay", "st. louis", "san jose", "los angeles", "san diego",
        "san antonio", "san francisco", "kansas city", "green bay", "new england",
        "new orleans", "las vegas", "oklahoma city", "golden state",
        "real salt lake", "west ham", "brighton & hove", "1. fc", "cf", "fc", "ac",
        "as", "inter", "dc", "d.c.", "rb", "sporting", "racing", "red bull"
    ];

    var nLower = n.toLowerCase();
    for (var i = 0; i < prefixes.length; i++) {
        var p = prefixes[i];
        if (nLower.startsWith(p + ' ')) {
            return esc(n.substring(0, p.length)) + '<br>' + esc(n.substring(p.length + 1));
        }
    }

    var suffixes = [
        "maple leafs", "golden knights", "red wings", "blue jackets", "white sox", "red sox",
        "blue jays", "trail blazers", "hotspur", "united", "city", "rovers",
        "albion", "athletic", "wanderers", "fc", "cf"
    ];

    for (var i = 0; i < suffixes.length; i++) {
        var s = suffixes[i];
        if (nLower.endsWith(' ' + s)) {
            return esc(n.substring(0, n.length - s.length - 1)) + '<br>' + esc(n.substring(n.length - s.length));
        }
    }

    return esc(parts[0]) + '<br>' + esc(parts.slice(1).join(' '));
}

export function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    } else {
        var textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        return new Promise(function(resolve, reject) {
            var successful = document.execCommand('copy');
            textArea.remove();
            if (successful) {
                resolve();
            } else {
                reject(new Error('copy command failed'));
            }
        });
    }
}
window.copyToClipboard = copyToClipboard;



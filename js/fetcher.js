/* ══ FETCHER (helpers purs pour fetchPage) ═════════════════════════
   Ce module ne dépend ni du DOM ni des autres modules de l'app : il est
   importable tel quel dans Node (tests unitaires, scripts serveur).
   Il fournit :
     - buildProxyList(opts)      : la liste ordonnée des transports (direct + proxys CORS)
     - inspectPageContent(text)  : détection des pages d'erreur renvoyées avec un HTTP 200
     - orderProxies(...)         : tri des transports selon leur santé récente
     - recordProxyResult(...)    : mise à jour de la santé d'un transport
*/

export var PROXY_COOLDOWN_MS = 3 * 60 * 1000;   // un transport en échec est relégué 3 min
export var DEFAULT_PROXY_TIMEOUT = 8000;
export var DIRECT_TIMEOUT = 5000;

function encode(u) { return encodeURIComponent(u); }

// Un proxy personnalisé peut être donné sous 3 formes :
//   https://mon-worker.workers.dev/?url={url}   -> {url} est remplacé par l'URL encodée
//   https://mon-worker.workers.dev/?url=          -> l'URL encodée est ajoutée à la fin
//   https://mon-worker.workers.dev/               -> l'URL brute est ajoutée (style cors-anywhere)
export function applyProxyTemplate(template, url) {
    if (!template) return url;
    var t = String(template).trim();
    if (t.indexOf('{url}') >= 0) return t.replace('{url}', encode(url));
    if (/[=?]$/.test(t)) return t + encode(url);
    if (!/\/$/.test(t)) t += '/';
    return t + url;
}

export function buildProxyList(opts) {
    opts = opts || {};
    var list = [];

    if (opts.customProxy) {
        list.push({
            id: 'custom',
            label: 'Proxy personnalisé',
            build: function(u) { return applyProxyTemplate(opts.customProxy, u); }
        });
    }

    // Tentative directe : gratuite, très rapide à échouer (CORS) dans le navigateur,
    // et c'est le chemin normal côté serveur (GitHub Actions) où il n'y a pas de CORS.
    list.push({ id: 'direct', label: 'Direct', direct: true, timeout: DIRECT_TIMEOUT, build: function(u) { return u; } });

    list.push({
        id: 'cors.sh',
        label: 'proxy.cors.sh',
        headers: opts.corsShKey ? { 'x-cors-api-key': opts.corsShKey } : null,
        build: function(u) { return 'https://proxy.cors.sh/' + u; }
    });

    if (opts.corsProxyIoKey) {
        list.push({
            id: 'corsproxy.io',
            label: 'corsproxy.io (clé API)',
            build: function(u) { return 'https://corsproxy.io/?key=' + encode(opts.corsProxyIoKey) + '&url=' + encode(u); }
        });
    }

    list.push({ id: 'allorigins-raw', label: 'allorigins (raw)', build: function(u) { return 'https://api.allorigins.win/raw?url=' + encode(u); } });
    list.push({
        id: 'allorigins-get',
        label: 'allorigins (json)',
        build: function(u) { return 'https://api.allorigins.win/get?url=' + encode(u); },
        parse: function(t) { var j = JSON.parse(t); return j && typeof j.contents === 'string' ? j.contents : ''; }
    });
    list.push({ id: 'codetabs', label: 'codetabs', build: function(u) { return 'https://api.codetabs.com/v1/proxy?quest=' + u; } });

    return list;
}

/* Renvoie null si le contenu semble être la vraie page, sinon un objet
   { reason, proxyFault } : proxyFault=true quand la faute est clairement celle
   du transport (page pub, clé manquante, stub 301…) plutôt que du site cible. */
export function inspectPageContent(text) {
    if (text === null || text === undefined) return { reason: 'vide', proxyFault: true };
    var t = String(text);
    var trimmed = t.trim();
    if (!trimmed) return { reason: 'vide', proxyFault: true };

    var head = trimmed.slice(0, 4000);
    var headLower = head.toLowerCase();

    if (trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[') {
        var jl = trimmed.slice(0, 600).toLowerCase();
        if (jl.indexOf('api key') >= 0 || jl.indexOf('api_key') >= 0 || jl.indexOf('apikey') >= 0 ||
            jl.indexOf('keyless') >= 0 || jl.indexOf('corsfix_error') >= 0 || jl.indexOf('not_registered') >= 0 ||
            jl.indexOf('"error"') >= 0 && jl.indexOf('proxy') >= 0) {
            return { reason: 'proxy: réponse JSON d\'erreur', proxyFault: true };
        }
        return null; // petit JSON légitime (scores, etc.)
    }

    // Stubs de redirection / erreurs Cloudflare renvoyés avec un statut 200 par certains proxys
    if (/^error code: \d{3}/.test(headLower)) return { reason: 'proxy: ' + head.slice(0, 20), proxyFault: true };
    if (headLower.indexOf('301 moved permanently') >= 0 && trimmed.length < 1500) return { reason: 'proxy: stub 301', proxyFault: true };
    if (headLower.indexOf('hidemy.name') >= 0) return { reason: 'proxy: page publicitaire hidemy.name', proxyFault: true };
    if (headLower.indexOf('missing required request header') >= 0 || headLower.indexOf('see /corsdemo') >= 0) return { reason: 'proxy: en-tête requis', proxyFault: true };
    if (headLower.indexOf('anonymous legacy proxy urls') >= 0) return { reason: 'proxy: clé API requise', proxyFault: true };
    if (headLower.indexOf('oops... request timeout') >= 0 || headLower.indexOf('500 internal server error') >= 0 ||
        headLower.indexOf('502 bad gateway') >= 0 || headLower.indexOf('522 connection timed out') >= 0) {
        return { reason: 'proxy: erreur passerelle', proxyFault: true };
    }

    // Pages renvoyées par le site cible lui-même (pas la faute du proxy)
    if (headLower.indexOf('just a moment') >= 0 && (headLower.indexOf('cf-chl') >= 0 || headLower.indexOf('challenge-platform') >= 0 || headLower.indexOf('cloudflare') >= 0)) {
        return { reason: 'site: défi Cloudflare', proxyFault: false };
    }
    if (headLower.indexOf('performance & security by cloudflare') >= 0 && trimmed.length < 20000) {
        return { reason: 'site: page d\'erreur Cloudflare', proxyFault: false };
    }
    if (headLower.indexOf('domain has been seized') >= 0) return { reason: 'site: domaine saisi', proxyFault: false };

    if (trimmed.length < 200) return { reason: 'vide (' + trimmed.length + 'c)', proxyFault: true };
    return null;
}

/* Clé de santé : les proxys sont globaux, l'accès direct dépend du site cible. */
export function healthKey(proxy, url) {
    if (proxy && proxy.direct) {
        var m = /^https?:\/\/([^\/?#]+)/i.exec(url || '');
        return 'direct:' + (m ? m[1].toLowerCase() : '?');
    }
    return proxy ? proxy.id : '?';
}

export function isHealthy(entry, now) {
    if (!entry) return true;
    now = now || Date.now();
    if (!entry.lastFail) return true;
    if (entry.lastOk && entry.lastOk >= entry.lastFail) return true;
    return now - entry.lastFail > PROXY_COOLDOWN_MS;
}

/* Partition stable : transports sains dans l'ordre d'origine, puis les autres. */
export function orderProxies(list, health, url, now) {
    health = health || {};
    var good = [], bad = [];
    for (var i = 0; i < list.length; i++) {
        var e = health[healthKey(list[i], url)];
        (isHealthy(e, now) ? good : bad).push(list[i]);
    }
    return good.concat(bad);
}

export function recordProxyResult(health, proxy, url, ok, now) {
    health = health || {};
    now = now || Date.now();
    var k = healthKey(proxy, url);
    var e = health[k] || { ok: 0, fail: 0 };
    if (ok) { e.ok = (e.ok || 0) + 1; e.lastOk = now; }
    else { e.fail = (e.fail || 0) + 1; e.lastFail = now; }
    health[k] = e;
    return health;
}

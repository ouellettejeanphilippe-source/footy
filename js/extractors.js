/* ══ EXTRACTEURS ═══════════════════════════════════════════════════════════
   Moteur générique de découverte de lecteurs dans une page de match.

   Pourquoi ce module : chaque agrégateur a son DOM. Certains posent une <iframe>
   dans la page, d'autres cachent l'adresse dans un attribut data-* que lit un
   bouton qui remplace l'iframe en JavaScript, d'autres la publient dans un blob
   JSON (Next.js, Nuxt, tableau `allStreams`), d'autres encore ne font que pointer
   vers un autre domaine. Écrire une branche `if (host === 'x')` par site ne tient
   pas dans le temps : les sites changent plus vite que le code, et une branche qui
   casse rend la source entièrement muette sans que rien ne le signale.

   L'approche retenue : on récolte TOUS les candidats, par des stratégies
   indépendantes du site et qui tournent toutes (aucune ne court-circuite les
   autres), puis on les NOTE. Un site inconnu passe donc par les mêmes chemins
   qu'un site connu ; ajouter une source ne demande plus de code.

   Ce module ne dépend d'aucun autre (comme js/fetcher.js) : il s'importe tel quel
   dans Node pour les tests et pour scripts/scrape_streams.mjs.
*/

/* ── Vocabulaire des blobs JSON ────────────────────────────────────────────
   Clés sous lesquelles les sites rangent une adresse de lecteur, et clés qui
   servent à le nommer. Généralise "directStreams"/"iframeStreams" (Footybite,
   Streameast) et "allStreams" (Methstreams) sans les nommer. */
export var URL_KEYS = ['url', 'src', 'link', 'value', 'file', 'embed', 'iframe', 'stream', 'source', 'player', 'm3u8', 'hls', 'href'];
export var LABEL_KEYS = ['name', 'label', 'title', 'server', 'text', 'channel', 'quality', 'language', 'lang', 'type'];

/* ── Hôtes de lecteurs déjà observés ───────────────────────────────────────
   Amorce du registre, relevée dans le champ `playerHosts` de data/streams.json.
   Le registre apprend ensuite tout seul (voir noteEmbedResult) : cette liste
   n'est qu'un point de départ pour que la première exécution note correctement. */
export var SEED_PLAYER_HOSTS = [
    'embedsports.me', 'embedindia.st', 'streame.center', 'embedstream.me',
    'cdnlivetv.is', 'dlstreams.st', 'epiembeds.online', 'youtube.com', 'player.twitch.tv'
];

/* Agrégateurs : leurs pages sont des pages de match, pas des lecteurs — sauf
   quand le chemin annonce explicitement un lecteur (/embed, /player…). */
export var AGGREGATOR_RE = /(^|\.)(footybite|nflbite|nbabite|mlbbite|totalsportek|sportsurge|isportsurge|buffstreams|mybuffstreams|buffstream|streameast|gostreameast|thestreameast|methstreams|crackstreams|vipleague|hesgoal|onhockey|1stream|thetvapp)\./i;

/* Jamais un lecteur : réseaux sociaux, messageries, paris, ressources statiques. */
export var JUNK_HOST_RE = /(^|\.)(x\.com|twitter\.com|facebook\.com|instagram\.com|tiktok\.com|t\.me|telegram\.(me|org)|discord\.(gg|com)|reddit\.com|chatango\.com|w3\.org|gstatic\.com|googletagmanager\.com|google-analytics\.com|doubleclick\.net|cloudflare\.com|cloudflareinsights\.com)$/i;
export var BETTING_RE = /(1xbet|bet365|betway|melbet|parimatch|22bet|stake\.com|bc\.game|betano|bwin|unibet|casino)/i;
export var ASSET_RE = /\.(png|jpe?g|gif|svg|webp|ico|css|js|mjs|json|xml|txt|woff2?|ttf|eot|mp3|pdf|zip)(\?|#|$)/i;

/* Indices de chemin : ce qui, dans l'adresse elle-même, trahit un lecteur.
   Le poids est volontairement plus fort pour un flux brut (.m3u8) que pour un
   simple « /watch », qui désigne aussi bien une page de match qu'un lecteur. */
export var PLAYER_PATH_HINTS = [
    [/\.m3u8(\?|#|$)/i, 60],
    [/\.mpd(\?|#|$)/i, 60],
    [/\/embed(ed)?(\/|\?|#|$)/i, 45],
    [/\/(player|iframe)(\/|\.|\?|#|$)/i, 40],
    [/(^|\/)(player|embed|stream|live)\.php/i, 40],
    [/[?&](stream_?id|channel|embed|player|feed)=/i, 32],
    [/\/stream(s)?\/[a-z0-9]/i, 22],
    [/\/live\//i, 18],
    [/[?&](id|v|c)=[a-z0-9]/i, 12],
    [/\/(watch|play)\b/i, 8]
];

/* Chemins qui désignent une page de navigation (catégorie, ligue, index) plutôt
   qu'un match ou un lecteur : « /nba-streams », « /indexcracked29 », « /league/x ». */
export var NAV_PATH_RE = /\/[a-z-]*(streams?|cracked)\d*\/?$|\/(league|category|sport|sports|tag|schedule)\//i;

export var EMBED_THRESHOLD = 30;   // au-dessus : jouable dans une iframe
export var KEEP_THRESHOLD = 0;     // au-dessus : gardé, mais ouvert dans un onglet

/* ══ OUTILS ════════════════════════════════════════════════════════════════ */

export function absolutize(href, base) {
    if (!href) return '';
    var h = String(href).trim();
    if (!h || /^(javascript|mailto|tel|data|blob|#)/i.test(h)) return '';
    if (/^https?:\/\//i.test(h)) return h;
    if (h.indexOf('//') === 0) return 'https:' + h;
    try { return new URL(h, base).href; } catch (e) { return ''; }
}

export function hostOf(url) {
    try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return ''; }
}

/* Deux adresses ne différant que par le protocole, « www. » ou une barre finale
   désignent le même lecteur. Même règle que js/scrapers.js, répétée ici pour que
   le module reste sans dépendance. */
export function canonical(url) {
    try {
        var u = new URL(url);
        return u.hostname.toLowerCase().replace(/^www\./, '') + u.pathname.replace(/\/+$/, '') + (u.search || '');
    } catch (e) { return String(url || '').toLowerCase().replace(/\/+$/, ''); }
}

/* Une page peut déclarer <base href>, auquel cas les liens relatifs se résolvent
   contre lui et non contre l'URL visitée (cas Sportsurge : sans ça, des 404). */
export function effectiveBase(doc, pageUrl) {
    try {
        var b = doc.querySelector('base[href]');
        if (b) {
            var bh = b.getAttribute('href');
            if (bh) return absolutize(bh, pageUrl) || pageUrl;
        }
    } catch (e) {}
    return pageUrl;
}

/* Adresses encodées : base64 (« aHR0c… ») et pourcent-encodées, que plusieurs
   sites utilisent pour échapper aux extracteurs naïfs. */
export function decodeMaybe(value) {
    var v = String(value || '').trim();
    if (!v) return '';
    if (/^aHR0c[A-Za-z0-9+/=]+$/.test(v)) {
        try {
            var dec = typeof atob === 'function' ? atob(v) : Buffer.from(v, 'base64').toString('binary');
            if (/^https?:\/\//i.test(dec)) return dec;
        } catch (e) {}
    }
    if (/^https?%3A%2F%2F/i.test(v)) {
        try { return decodeURIComponent(v); } catch (e) {}
    }
    return v;
}

function looksLikeUrlish(v) {
    var s = String(v || '');
    if (s.length < 4 || s.length > 2000) return false;
    return /^(https?:\/\/|\/\/)[^\s'"<>]+$/i.test(s) || /^aHR0c[A-Za-z0-9+/=]+$/.test(s) || /^https?%3A%2F%2F/i.test(s);
}

/* ══ STRATÉGIES DE RÉCOLTE ═════════════════════════════════════════════════
   Chacune est indépendante et ne connaît aucun site. Elles produisent des
   candidats { url, label, via } ; `via` sert ensuite à la notation, car la
   provenance structurelle est un signal fort (une <iframe> est presque toujours
   un lecteur, un <a> presque jamais). */

/* 1. L'iframe posée directement dans la page, y compris ses variantes différées
      (data-src, data-lazy-src) que posent les greffons de performance. */
export function harvestIframes(doc, base) {
    var out = [];
    var nodes = doc.querySelectorAll('iframe, embed, video, source');
    [].forEach.call(nodes, function (el) {
        ['src', 'data-src', 'data-lazy-src', 'data-litespeed-src'].forEach(function (attr) {
            var raw = el.getAttribute(attr);
            if (!raw) return;
            var url = absolutize(decodeMaybe(raw), base);
            if (!url) return;
            var tag = el.tagName.toLowerCase();
            out.push({
                url: url,
                label: (el.getAttribute('title') || el.getAttribute('name') || '').trim(),
                via: tag === 'video' || tag === 'source' ? 'video' : 'iframe'
            });
        });
    });
    return out;
}

/* 2. Le bouton qui change l'iframe. C'est le cas le plus répandu et celui que les
      branches par site rataient : l'adresse n'est pas dans une balise <a>, elle
      dort dans un attribut data-* (data-href, data-stream, data-server…) ou dans
      un gestionnaire onclick, et un script la recopie dans l'iframe au clic.
      On accepte donc n'importe quel data-* dont la valeur ressemble à une adresse,
      plutôt qu'une liste fermée de noms d'attributs. */
export function harvestSwitchers(doc, base) {
    var out = [];
    /* Sélecteur réduit aux gestionnaires inline : tous les attributs data-*, quel
       que soit leur nom, sont déjà couverts par harvestRawDataAttrs en une passe
       linéaire. Chaque sélecteur supplémentaire dans cette liste oblige le moteur
       de sélecteurs à réexaminer toute la page — la liste complète coûtait 500 ms
       par page de match, payés 140 fois par exécution du script serveur. */
    var nodes = doc.querySelectorAll('[onclick], [href^="javascript:"]');
    [].forEach.call(nodes, function (el) {
        /* Le libellé n'est calculé qu'une fois une adresse trouvée : `textContent`
           descend tout le sous-arbre, et le faire pour chaque <li> et chaque
           <button> d'une grille coûtait à lui seul l'essentiel du temps
           d'extraction (800 ms sur une page dense, contre 60 ms ici). */
        var label = null;
        var labelOf = function () {
            if (label === null) label = (el.getAttribute('title') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
            return label;
        };

        // a) tout attribut data-* porteur d'une adresse
        var attrs = el.attributes || [];
        for (var i = 0; i < attrs.length; i++) {
            var a = attrs[i];
            if (a.name.charCodeAt(0) !== 100 || a.name.indexOf('data-') !== 0) continue; // 'd'
            if (!a.value || a.value.length < 4) continue;
            var val = decodeMaybe(a.value);
            if (!looksLikeUrlish(val)) continue;
            var u = absolutize(val, base);
            if (u) out.push({ url: u, label: labelOf(), via: 'switcher' });
        }

        // b) adresses citées dans un gestionnaire inline : onclick="go('https://…')"
        var handler = el.getAttribute('onclick') || '';
        var href = el.getAttribute('href') || '';
        if (/^javascript:/i.test(href)) handler += ' ' + href;
        if (handler && handler.indexOf('/') >= 0) {
            var lit = /['"]((?:https?:\/\/|\/\/)[^'"\s]{6,}|\/[^'"\s]{4,})['"]/g;
            var mm;
            while ((mm = lit.exec(handler)) !== null) {
                var hu = absolutize(decodeMaybe(mm[1]), base);
                if (hu) out.push({ url: hu, label: labelOf(), via: 'switcher' });
            }
        }
    });
    return out;
}

/* 2 bis. Tout attribut `data-quelquechose="<adresse>"`, quel que soit son nom, lu
   directement dans le HTML. C'est la forme la plus générale du « bouton qui change
   l'iframe » : aucun site n'a besoin d'être connu, et aucun nom d'attribut n'a
   besoin d'être prévu. Une seule passe linéaire, sans DOM. */
export function harvestRawDataAttrs(html, base, doc) {
    var out = [];
    var re = /\sdata-([a-z0-9_-]{1,40})\s*=\s*["']([^"']{6,600})["']/gi;
    var m;
    var found = [];      // { attr, raw, url }
    var attrNames = {};
    while ((m = re.exec(html)) !== null) {
        var val = decodeMaybe(m[2]);
        if (!looksLikeUrlish(val)) continue;
        var u = absolutize(val, base);
        if (!u) continue;
        found.push({ attr: 'data-' + m[1].toLowerCase(), raw: m[2], url: u });
        attrNames['data-' + m[1].toLowerCase()] = true;
    }
    if (!found.length) return out;

    /* Libellés : on ne requête que les noms d'attributs réellement rencontrés —
       en pratique un ou deux par page, donc quelques nœuds — au lieu de balayer
       toute la page. Le texte du bouton (« Server 2 · 1080p ») est ce qui rend la
       liste de flux lisible ; sans lui on n'affiche que des adresses. */
    var labels = {};
    if (doc) {
        Object.keys(attrNames).forEach(function (name) {
            try {
                var nodes = doc.querySelectorAll('[' + name + ']');
                [].forEach.call(nodes, function (el) {
                    var v = el.getAttribute(name);
                    if (!v) return;
                    var t = (el.getAttribute('title') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
                    if (t) labels[v] = t;
                });
            } catch (e) {}
        });
    }

    found.forEach(function (f) {
        out.push({ url: f.url, label: labels[f.raw] || '', via: 'switcher' });
    });
    return out;
}

/* 3. Les blobs JSON embarqués. On ne cherche PAS des clés nommées : on parse ce
      qu'on trouve et on descend l'arbre en collectant toute valeur qui ressemble
      à une adresse, en prenant les clés voisines comme libellé. Couvre Next.js
      (self.__next_f.push), Nuxt, __PRELOADED_STATE__, JSON-LD et les simples
      `var allStreams = [...]`. */
export function harvestJsonBlobs(html, doc, base) {
    var out = [];
    var texts = [];

    /* Corps entièrement JSON, parsé directement plutôt que poussé dans `texts`.
       On ne lisait le JSON que dans les <script> d'une page : une API qui renvoie un
       tableau ou un objet ne donnait donc aucun candidat. Et l'y pousser n'aurait rien
       changé — `sliceJsonLiterals` n'isole que ce qui SUIT un « = » ou un « : », or un
       corps qui est lui-même un tableau n'a rien devant lui. Ce sont pourtant les
       sources les plus fiables à lire, puisqu'elles n'ont aucun HTML à deviner. */
    var trimmed = String(html || '').trim();
    if ((trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[') && trimmed.length < MAX_LITERAL_LEN) {
        try { walkJson(JSON.parse(trimmed), out, base, 0); } catch (e) {}
    }

    // Next.js : charge utile découpée en morceaux à recoller avant de parser.
    var nextRe = /self\.__next_f\.push\(\[1,\s*"((?:[^"\\]|\\.)*)"\]\)/g;
    var chunk, joined = '';
    while ((chunk = nextRe.exec(html)) !== null) {
        joined += chunk[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\n/g, '\n');
    }
    if (joined) texts.push(joined);

    var scripts = doc.querySelectorAll('script');
    [].forEach.call(scripts, function (s) {
        var t = s.textContent || '';
        if (t.length > 4 && t.length < 3000000) texts.push(t);
    });

    texts.forEach(function (text) {
        // a) littéraux JSON complets. Un balayage à parenthèses équilibrées plutôt
        //    qu'une expression régulière paresseuse : celle-ci relisait la page
        //    entière à chaque « = » et coûtait des centaines de millisecondes sur
        //    une page ordinaire, alors que ce balayage est linéaire.
        sliceJsonLiterals(text).forEach(function (lit) {
            try { walkJson(JSON.parse(lit), out, base, 0); } catch (e) {}
        });
        // b) repli robuste : paires "clé":"adresse" isolées, même dans un JSON
        //    tronqué ou mal échappé (fréquent dans les charges Next.js).
        var pair = new RegExp('"(' + URL_KEYS.join('|') + ')"\\s*:\\s*"((?:https?:\\\\?/\\\\?/|\\\\?/\\\\?/)[^"]{6,})"', 'gi');
        var p;
        while ((p = pair.exec(text)) !== null) {
            var raw = p[2].replace(/\\\//g, '/');
            var u = absolutize(decodeMaybe(raw), base);
            if (u) out.push({ url: u, label: '', via: 'json' });
        }
    });
    return out;
}

/* Isole les littéraux tableau/objet qui suivent un « = » ou un « : », en comptant
   les crochets et en sautant les chaînes. Renvoie au plus MAX_LITERALS morceaux,
   et ignore ceux qui ne contiennent aucune adresse — inutile de les parser. */
export var MAX_LITERALS = 24;
export var MAX_LITERAL_LEN = 300000;

export function sliceJsonLiterals(text) {
    var out = [];
    var n = text.length;
    for (var i = 0; i < n && out.length < MAX_LITERALS; i++) {
        var ch = text.charAt(i);
        if (ch !== '=' && ch !== ':') continue;
        var j = i + 1;
        while (j < n && /\s/.test(text.charAt(j))) j++;
        var open = text.charAt(j);
        if (open !== '[' && open !== '{') continue;

        var close = open === '[' ? ']' : '}';
        var depth = 0, inStr = false, quote = '', k = j;
        for (; k < n && k - j < MAX_LITERAL_LEN; k++) {
            var c = text.charAt(k);
            if (inStr) {
                if (c === '\\') { k++; continue; }
                if (c === quote) inStr = false;
                continue;
            }
            if (c === '"' || c === "'") { inStr = true; quote = c; continue; }
            if (c === open) depth++;
            else if (c === close) { depth--; if (depth === 0) break; }
        }
        if (depth !== 0 || k >= n) { i = j; continue; }
        var lit = text.slice(j, k + 1);
        // Seuls les littéraux porteurs d'une adresse méritent un JSON.parse.
        if (/https?:(\\)?\/(\\)?\/|"\/\//.test(lit)) out.push(lit);
        i = k; // on reprend après le littéral : le balayage reste linéaire
    }
    return out;
}

/* Descente récursive : toute valeur d'apparence « adresse » est un candidat, et
   les clés voisines de son objet servent à le nommer (« Server 2 · 1080p EN »). */
/* Une clé désigne-t-elle une adresse ? La liste `URL_KEYS` était comparée à
   l'identique, si bien que `embedUrl`, `streamUrl` ou `videoSrc` — la façon dont les
   API nomment couramment leurs adresses — n'étaient jamais reconnues. On accepte donc
   aussi les clés qui se terminent par l'un de ces mots. Les images et autres fichiers
   ainsi ramassés (`posterUrl`, `badgeUrl`) sont écartés plus loin par le pointage, qui
   rejette déjà les extensions d'actifs. */
export var URL_KEY_SUFFIXES = ['url', 'src', 'link', 'href', 'embed', 'stream', 'player'];

export function isUrlKey(key) {
    var k = String(key || '').toLowerCase();
    if (URL_KEYS.indexOf(k) >= 0) return true;
    for (var i = 0; i < URL_KEY_SUFFIXES.length; i++) {
        var suf = URL_KEY_SUFFIXES[i];
        if (k.length > suf.length && k.slice(-suf.length) === suf) return true;
    }
    return false;
}

export function walkJson(node, out, base, depth) {
    if (!node || depth > 8 || out.length > 400) return;
    if (Array.isArray(node)) {
        for (var i = 0; i < node.length; i++) walkJson(node[i], out, base, depth + 1);
        return;
    }
    if (typeof node !== 'object') return;

    var label = '';
    LABEL_KEYS.forEach(function (k) {
        var v = node[k];
        if (typeof v === 'string' && v && !looksLikeUrlish(v) && v.length < 60 && label.indexOf(v) < 0) {
            label = label ? label + ' · ' + v : v;
        }
    });

    Object.keys(node).forEach(function (k) {
        var v = node[k];
        if (typeof v === 'string' && isUrlKey(k) && looksLikeUrlish(decodeMaybe(v))) {
            var u = absolutize(decodeMaybe(v), base);
            if (u) out.push({ url: u, label: label.slice(0, 80), via: 'json' });
        } else if (v && typeof v === 'object') {
            walkJson(v, out, base, depth + 1);
        }
    });
}

/* 4. Les liens ordinaires. Faible poids par défaut : un <a> est le plus souvent
      de la navigation. Le pointage relèvera ceux qui partent vers un autre
      domaine ou dont le chemin annonce un lecteur. */
export function harvestAnchors(doc, base) {
    var out = [];
    var nodes = doc.querySelectorAll('a[href]');
    [].forEach.call(nodes, function (a) {
        var url = absolutize(decodeMaybe(a.getAttribute('href')), base);
        if (!url) return;
        var label = (a.getAttribute('title') || a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
        // Un <input value="https://…"> voisin (tables « copier le lien ») compte pareil.
        out.push({ url: url, label: label, via: 'anchor' });
    });
    [].forEach.call(doc.querySelectorAll('input[value]'), function (inp) {
        var v = inp.getAttribute('value') || '';
        if (!looksLikeUrlish(v)) return;
        var u = absolutize(decodeMaybe(v), base);
        if (u) out.push({ url: u, label: '', via: 'switcher' });
    });
    return out;
}

/* 5. Adresses encodées croisées n'importe où dans le HTML brut : certains sites
      ne les exposent ni en attribut ni en JSON, seulement dans une chaîne. */
export function harvestEncoded(html, base) {
    var out = [];
    var b64 = /["'](aHR0c[A-Za-z0-9+/=]{16,})["']/g;
    var m;
    while ((m = b64.exec(html)) !== null) {
        var u = absolutize(decodeMaybe(m[1]), base);
        if (u) out.push({ url: u, label: '', via: 'encoded' });
    }
    var pct = /["'](https?%3A%2F%2F[^"'\s]{8,})["']/gi;
    while ((m = pct.exec(html)) !== null) {
        var u2 = absolutize(decodeMaybe(m[1]), base);
        if (u2) out.push({ url: u2, label: '', via: 'encoded' });
    }
    return out;
}

/* Récolte complète : toutes les stratégies, dédoublonnée en conservant la
   provenance la plus forte et le libellé le plus informatif. */
export function harvestCandidates(html, pageUrl, doc) {
    doc = doc || new DOMParser().parseFromString(String(html || ''), 'text/html');
    var base = effectiveBase(doc, pageUrl);
    var all = []
        .concat(harvestIframes(doc, base))
        .concat(harvestSwitchers(doc, base))
        .concat(harvestRawDataAttrs(String(html || ''), base, doc))
        .concat(harvestJsonBlobs(String(html || ''), doc, base))
        .concat(harvestAnchors(doc, base))
        .concat(harvestEncoded(String(html || ''), base));

    var rank = { video: 5, iframe: 4, switcher: 3, json: 2, encoded: 1, anchor: 0 };
    var byKey = {};
    all.forEach(function (c) {
        if (!c.url) return;
        var k = canonical(c.url);
        var prev = byKey[k];
        if (!prev) { byKey[k] = { url: c.url, label: c.label || '', via: c.via, vias: [c.via] }; return; }
        if (prev.vias.indexOf(c.via) < 0) prev.vias.push(c.via);
        if ((rank[c.via] || 0) > (rank[prev.via] || 0)) prev.via = c.via;
        if (!prev.label && c.label) prev.label = c.label;
    });
    return Object.keys(byKey).map(function (k) { return byKey[k]; });
}

/* ══ REGISTRE APPRIS ═══════════════════════════════════════════════════════
   L'application ne peut pas deviner à l'avance quels hôtes acceptent d'être
   intégrés : c'est une propriété du serveur distant (X-Frame-Options /
   frame-ancestors), pas de son adresse. On l'apprend donc à l'usage et on
   persiste le verdict — c'est ce qui rend le classement adaptatif plutôt que
   figé dans une liste écrite à la main. */
export function createRegistry(seed) {
    var reg = { players: {}, blocked: {} };
    (seed || SEED_PLAYER_HOSTS).forEach(function (h) { reg.players[h] = { ok: 1, fail: 0 }; });
    return reg;
}

export function noteEmbedResult(registry, host, embedded) {
    if (!registry || !host) return registry;
    registry.players = registry.players || {};
    registry.blocked = registry.blocked || {};
    var e = registry.players[host] || { ok: 0, fail: 0 };
    if (embedded) { e.ok++; delete registry.blocked[host]; }
    else { e.fail++; if (e.fail >= 2 && e.ok === 0) registry.blocked[host] = Date.now(); }
    registry.players[host] = e;
    return registry;
}

export function reputationOf(registry, host) {
    if (!registry || !host) return 0;
    if (registry.blocked && registry.blocked[host]) return -40;
    var e = registry.players && registry.players[host];
    if (!e) return 0;
    if (e.ok > 0 && e.fail === 0) return 35;
    if (e.ok > e.fail) return 20;
    if (e.fail > e.ok) return -25;
    return 0;
}

/* ══ NOTATION ══════════════════════════════════════════════════════════════
   Remplace la liste de rejets en dur. Chaque signal ajoute ou retire des points
   et laisse une trace lisible dans `reasons`, pour que l'écran Journaux puisse
   expliquer pourquoi un lien a été gardé ou écarté — c'était impossible avant. */
export function scoreCandidate(cand, ctx) {
    ctx = ctx || {};
    var reasons = [];
    var url = cand.url || '';
    var host = hostOf(url);
    var pageHost = ctx.pageHost || hostOf(ctx.pageUrl || '');
    var path = '';
    var search = '';
    try { var u = new URL(url); path = u.pathname || '/'; search = u.search || ''; } catch (e) { return { score: -999, kind: 'reject', reasons: ['adresse illisible'] }; }

    // Rejets nets : rien ne les rattrape.
    if (ASSET_RE.test(path)) return { score: -999, kind: 'reject', reasons: ['ressource statique'] };
    if (JUNK_HOST_RE.test(host) && !(/youtube\.com$/.test(host) && /^\/embed\//.test(path))) return { score: -999, kind: 'reject', reasons: ['hôte jamais lecteur'] };
    if (BETTING_RE.test(url)) return { score: -999, kind: 'reject', reasons: ['pari / publicité'] };
    if ((path === '/' || path === '') && !search) return { score: -999, kind: 'reject', reasons: ['racine de site'] };
    if (/^\/?(index|home|accueil)([.-][a-z0-9-]*)?\/?$/i.test(path)) return { score: -999, kind: 'reject', reasons: ['page d\'index'] };

    var score = 0;
    var viaPoints = { video: 50, iframe: 45, switcher: 40, json: 30, encoded: 25, anchor: 5 };
    score += viaPoints[cand.via] || 0;
    reasons.push('trouvé via ' + cand.via + ' (+' + (viaPoints[cand.via] || 0) + ')');

    // Confirmé par plusieurs stratégies : signal plus sûr qu'une seule.
    if (cand.vias && cand.vias.length > 1) { score += 8; reasons.push('confirmé par ' + cand.vias.length + ' stratégies (+8)'); }

    var target = path + search;
    for (var i = 0; i < PLAYER_PATH_HINTS.length; i++) {
        if (PLAYER_PATH_HINTS[i][0].test(target)) {
            score += PLAYER_PATH_HINTS[i][1];
            reasons.push('chemin de lecteur (+' + PLAYER_PATH_HINTS[i][1] + ')');
            break;
        }
    }

    var rep = reputationOf(ctx.registry, host);
    if (rep) { score += rep; reasons.push('réputation de l\'hôte (' + (rep > 0 ? '+' : '') + rep + ')'); }

    if (pageHost && host && host !== pageHost) { score += 12; reasons.push('domaine externe (+12)'); }
    else if (pageHost && host === pageHost) { score -= 10; reasons.push('même domaine que la page (-10)'); }

    if (AGGREGATOR_RE.test(host + '.')) {
        var looksPlayer = /\/(embed|player|stream|watch)\b|\.php/i.test(target);
        if (!looksPlayer) { score -= 45; reasons.push('page d\'agrégateur (-45)'); }
    }
    if (NAV_PATH_RE.test(path) && !/-vs-|\/game\/|\/embed|\/watch\//i.test(path)) { score -= 35; reasons.push('page de navigation (-35)'); }
    if (ctx.matchUrl && canonical(url) === canonical(ctx.matchUrl)) { score -= 30; reasons.push('c\'est la page du match elle-même (-30)'); }

    var label = String(cand.label || '');
    if (/(opens in a new tab|click if you want|watch a different|regarder un autre|voir tous|see all|more games)/i.test(label)) { score -= 40; reasons.push('libellé de navigation (-40)'); }

    var kind;
    if (ctx.registry && ctx.registry.blocked && ctx.registry.blocked[host]) { kind = 'page'; reasons.push('hôte connu pour refuser l\'intégration'); }
    else if (score >= EMBED_THRESHOLD) kind = 'embed';
    else if (score >= KEEP_THRESHOLD) kind = 'page';
    else kind = 'reject';

    return { score: score, kind: kind, reasons: reasons, host: host };
}

/* Point d'entrée : HTML brut → lecteurs classés et triés.
   `kind` vaut 'embed' (jouable dans une iframe) ou 'page' (à ouvrir dans un
   onglet) : c'est cette valeur, et non une supposition de l'interface, qui doit
   décider du comportement au clic. */
export function extractPlayers(html, pageUrl, opts) {
    opts = opts || {};
    var doc = opts.doc || new DOMParser().parseFromString(String(html || ''), 'text/html');
    var cands = harvestCandidates(html, pageUrl, doc);
    var ctx = { pageUrl: pageUrl, pageHost: hostOf(pageUrl), matchUrl: opts.matchUrl || pageUrl, registry: opts.registry };
    var out = [];
    cands.forEach(function (c) {
        var verdict = scoreCandidate(c, ctx);
        if (verdict.kind === 'reject') return;
        out.push({
            url: c.url,
            label: c.label || '',
            via: c.via,
            vias: c.vias || [c.via],
            kind: verdict.kind,
            score: verdict.score,
            reasons: verdict.reasons
        });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    if (opts.limit) out = out.slice(0, opts.limit);
    return out;
}

// Liaisons globales pour la compatibilité HTML
if (typeof window !== 'undefined') {
    window.extractPlayers = extractPlayers;
    window.harvestCandidates = harvestCandidates;
    window.scoreCandidate = scoreCandidate;
    window.createRegistry = createRegistry;
    window.noteEmbedResult = noteEmbedResult;
}

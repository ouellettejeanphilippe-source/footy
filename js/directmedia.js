/* Mode direct : la deuxième façon d'utiliser un lien de flux.

   Décision du 6 septembre 2026 : « les embed.st, ça devrait être une deuxième façon
   d'utiliser un lien de stream, qu'on pourrait aussi avoir en mode normal, pour avoir les
   deux options ». Le mode normal charge la PAGE du site dans la tuile et le script
   utilisateur la nettoie ; c'est ce qui marche, mais certaines pages (embed.st : 640 Ko de
   script obfusqué, moteur pair-à-pair) chargent lentement, gèlent, puis plantent.

   Le mode direct court-circuite la page : pendant que la page joue, le script utilisateur
   voit passer le MANIFESTE vidéo (.m3u8 / .mpd) que son lecteur demande, et le remonte à
   l'application ; la tuile peut alors jouer ce manifeste dans son propre <video> (hls.js),
   sans la page, sa régie ni son moteur pair-à-pair. Les deux modes restent à un clic l'un
   de l'autre sur la tuile.

   Ce qui peut faire échouer le direct, et qu'on observe plutôt que de deviner : un CDN qui
   refuse notre origine (CORS) ou notre référent (403), une adresse signée qui expire. Dans
   tous ces cas la tuile revient d'elle-même au mode page et retient l'échec.

   Module sans import : partagé par l'application et les tests. */

export var MEDIA_DIRECT_TTL_MS = 3 * 3600 * 1000;

/* Une adresse SANS jeton ne peut pas expirer : on la garde plus longtemps.
   --------------------------------------------------------------------
   Trois heures conviennent à une adresse signée : elle porte sa propre péremption,
   souvent d'une à trois heures. Mesuré sur un passage de vérification le 26 septembre
   2026, sur 36 adresses observées :

       avec jeton (`e=`, `st=`, `token=`…)    7    expirent en 1 à 3 h
       SANS aucun jeton                      29    rien ne les fait expirer

   Les vingt-neuf restaient bonnes tant que l'événement durait. Les jeter au bout de
   trois heures n'obéissait à aucune contrainte du serveur : c'est nous qui les
   oubliions.

   Ça compte surtout sur TÉLÉPHONE. Là-bas, ni le nettoyage des lecteurs ni la
   réécriture des en-têtes ne sont possibles — aucun navigateur mobile n'injecte de
   script dans une iframe d'origine croisée. Le mode direct, qui ne pose aucune iframe,
   y est donc la seule voie propre : « la vraie réponse aux pages qui refusent l'iframe
   est ailleurs » (js/embed-bridge.js, 5 septembre 2026). Encore faut-il qu'il lui reste
   quelque chose à jouer.

   Douze heures, pas davantage : au-delà le match est fini de toute façon, et une
   adresse morte coûte un essai à la tuile avant qu'elle ne revienne à la page. */
export var MEDIA_DIRECT_TTL_LONG_MS = 12 * 3600 * 1000;

/* Ce qui fait qu'une adresse porte sa propre expiration. Les noms varient d'un CDN à
   l'autre ; ceux-ci couvrent ce qui a été réellement observé — `?st=…&e=…` chez
   embedme.st et streame.center, `?s=…&e=…` chez dlive.sx. */
export function adresseSignee(url) {
    var u = String(url || '').split('#')[0];
    /* Un jeton peut aussi être dans le CHEMIN (18 octobre 2026, judiaslevels.embeds.gay :
       `/main/secure/<64 hexadécimaux>/1792358790/willow-usa.m3u8`), gardé douze heures
       alors qu'il expirait en deux heures et demie. */
    if (/\/[0-9a-f]{32,}\//i.test(u.split('?')[0]) || expirationDe(u) !== null) return true;
    var q = u.split('?')[1] || '';
    if (!q) return false;
    return /(^|&)(e|exp|expires|expiry|st|s|token|hash|md5|sig|signature|key)=/i.test(q);
}

/* L'heure d'expiration que l'adresse porte elle-même : un nombre de dix chiffres, segment
   du chemin ou valeur d'un paramètre, qui tombe à trois jours de `now` au plus (au-delà,
   c'est un identifiant, pas une heure). En millisecondes, ou null. Mesuré le 18 octobre
   2026 : « 410 Gone - Token expired » à l'heure dite, et l'appli proposait encore
   ▶ direct. */
var FENETRE_EXPIRATION_MS = 3 * 24 * 3600 * 1000;
export function expirationDe(url, now) {
    var t = now === undefined ? Date.now() : now;
    var re = /[\/=]([12]\d{9})(?=[\/&.?#]|$)/g, m;
    var u = String(url || '');
    while ((m = re.exec(u))) {
        var ms = Number(m[1]) * 1000;
        if (Math.abs(ms - t) <= FENETRE_EXPIRATION_MS) return ms;
    }
    return null;
}

export function dureeDeVie(url) {
    return adresseSignee(url) ? MEDIA_DIRECT_TTL_MS : MEDIA_DIRECT_TTL_LONG_MS;
}

/* Un manifeste, pas un segment ni une bibliothèque : jugé sur le chemin, sans requête. */
export function estManifeste(url) {
    var u = String(url || '');
    if (!/^https?:\/\//i.test(u)) return false;
    var chemin = u.split('#')[0].split('?')[0];
    if (/(^|\/)(ads?|preroll|vast|vmap)(\/|\.|$)/i.test(chemin)) return false;
    return /\.(m3u8|mpd)$/i.test(chemin);
}

/* Registre { lienUrl: { url, pageUrl, at } } dans le stockage local : la tuile qui rouvre
   le même lien sait d'emblée qu'un direct existe. Les entrées plus vieilles que le TTL
   tombent (adresses signées, événements finis). */
export function retenirMediaDirect(registre, lienUrl, media, now) {
    var r = registre && typeof registre === 'object' ? registre : {};
    var t = now === undefined ? Date.now() : now;
    Object.keys(r).forEach(function (k) {
        var e = r[k];
        // Chaque entrée vieillit à SON rythme : une adresse signée expire vite, une
        // adresse nue tient le temps de l'événement (voir dureeDeVie).
        if (!e || typeof e.at !== 'number' || t - e.at > dureeDeVie(e.url)) delete r[k];
    });
    if (lienUrl && media && estManifeste(media.url)) {
        r[lienUrl] = { url: media.url, pageUrl: media.pageUrl || '', at: t, echecs: (r[lienUrl] && r[lienUrl].url === media.url) ? (r[lienUrl].echecs | 0) : 0 };
        /* Le cadre qui a demandé le manifeste, vu par la vérification du serveur
           (`mediaReferer`) : le lecteur natif d'Android le renvoie (js/tele.js). */
        if (media.referer) r[lienUrl].referer = String(media.referer);
    }
    return r;
}

export function mediaDirectPour(registre, lienUrl, now) {
    var e = registre && registre[lienUrl];
    if (!e || !estManifeste(e.url)) return null;
    var t = now === undefined ? Date.now() : now;
    if (typeof e.at !== 'number' || t - e.at > dureeDeVie(e.url)) return null;
    var exp = expirationDe(e.url, t);
    if (exp !== null && t > exp) return null;
    return e;
}

/* ─── Vérifier avant de proposer ────────────────────────────────────────────────
   « Le direct marche jamais » (18 octobre 2026). Relu ce soir-là, depuis un autre
   réseau que celui qui les avait vus : 7 manifestes du cache sur 39 répondaient (avec le
   `Referer` de leur lecteur), 22 refusaient (403, jeton lié à l'adresse qui l'a obtenu),
   les autres étaient expirés ou injoignables. Et celui de bintv-sources ne sert qu'une
   fois : relu une seconde après son lecteur, depuis le même navigateur, 404. Le bouton
   ▶ direct s'affichait pour tous.

   La tuile lit donc le manifeste AVANT de proposer le bouton, par le chemin même que le
   direct prendra (le pont du script, ou fetch), et ne le montre que si un vrai manifeste
   répond. Le verdict vaut `SONDE_VALIDE_MS`. */
export var SONDE_VALIDE_MS = 10 * 60 * 1000;
export function verdictSonde(statut, debut) {
    var st = statut | 0;
    if (st && (st < 200 || st >= 300)) return { ok: false, raison: 'HTTP ' + st };
    var d = String(debut || '').replace(/^\uFEFF/, '').trim();
    if (/^#EXTM3U/.test(d) || /^<\?xml|^<MPD/i.test(d)) return { ok: true, raison: '' };
    return { ok: false, raison: d ? 'pas un manifeste' : 'réponse vide' };
}

/* Un direct qui a échoué deux fois pour ce lien ne se propose plus d'office : on garde
   l'entrée (le bouton reste), mais `aProposer` dit à la tuile de ne pas le tenter seule. */
export function noterEchecDirect(registre, lienUrl) {
    var e = registre && registre[lienUrl];
    if (e) e.echecs = (e.echecs | 0) + 1;
    return registre;
}
export function aProposer(entree) {
    return !!entree && (entree.echecs | 0) < 2;
}

/* ─── Le direct par le pont du script utilisateur ───────────────────────────────
   « Le bouton direct, ça marche avec AUCUN SITE » (18 octobre 2026). Mesuré le jour même
   sur les manifestes du cache : les CDN ne répondent `Access-Control-Allow-Origin` qu'à
   l'origine de LEUR lecteur (streame.center, dembed.st, matchora.to, getembed.live…), ou
   pas du tout, et plusieurs refusent (403) un `Referer` qui n'est pas le leur. hls.js,
   lancé depuis l'application, demandait le manifeste avec notre origine : le navigateur
   le refusait avant la première image, et la tuile revenait à la page.

   Le script utilisateur (≥ 1.14, sous Tampermonkey, Violentmonkey ou Greasemonkey) lit
   sans CORS et pose le `Referer` du lecteur (js/embed-bridge.js, `lireOctetsViaPont`).
   `chargeurParPont` est un chargeur hls.js (option `loader`) qui fait passer par lui
   manifestes, clés et segments. */

/* Le `Referer` que le lecteur de la page envoyait. La vérification du serveur l'a relevé
   sur la requête même (`referer`, depuis `mediaReferer`) ; à défaut, le cadre où le
   script a vu passer le manifeste (`pageUrl`), réduit à son origine comme le fait un
   navigateur pour une requête d'une autre origine. */
export function refererPourDirect(media) {
    var r = media && typeof media.referer === 'string' ? media.referer : '';
    if (/^https?:\/\//i.test(r)) return r;
    var page = media && typeof media.pageUrl === 'string' ? media.pageUrl : '';
    if (!/^https?:\/\//i.test(page)) return '';
    try { return new URL(page).origin + '/'; } catch (e) { return ''; }
}

export function origineDe(url) {
    if (!/^https?:\/\//i.test(String(url || ''))) return '';
    try { return new URL(url).origin; } catch (e) { return ''; }
}

function horlogeChargeur() {
    return (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
}

function statsVides() {
    return {
        aborted: false, loaded: 0, retry: 0, total: 0, chunkCount: 0, bwEstimate: 0,
        loading: { start: 0, first: 0, end: 0 },
        parsing: { start: 0, end: 0 },
        buffering: { start: 0, first: 0, end: 0 }
    };
}

/* Rend une classe de chargeur au contrat de hls.js 1.5 : `load(context, config,
   callbacks)`, `abort()`, `destroy()`, `stats`, `context`. `lire(url, options)` rend une
   promesse de { octets, status, finalUrl } ; une erreur porte `status` et `delai`.
   Les manifestes (réponse texte) sont décodés en UTF-8, le reste rendu tel quel. */
export function chargeurParPont(lire, entetes) {
    var referer = (entetes && entetes.referer) || '';
    var origine = (entetes && entetes.origine) || origineDe(referer);

    function ChargeurPont(config) {
        this.config = config;
        this.context = null;
        this.callbacks = null;
        this.stats = statsVides();
        this._minuteur = null;
        this._fini = false;
        this._jeton = 0;
    }

    ChargeurPont.prototype.load = function (context, config, callbacks) {
        var self = this;
        this.context = context;
        this.callbacks = callbacks;
        this._fini = false;
        /* Un chargeur peut être relancé : la réponse d'un essai abandonné ne doit pas
           clore le suivant. */
        var jeton = ++this._jeton;
        var stats = this.stats;
        stats.loading.start = horlogeChargeur();
        var binaire = context.responseType === 'arraybuffer';
        var debut = context.rangeStart | 0;
        var fin = context.rangeEnd | 0;
        var plage = (debut || fin) ? 'bytes=' + debut + '-' + (fin ? fin - 1 : '') : '';
        var politique = config && config.loadPolicy;
        var delaiMs = (politique && politique.maxLoadTimeMs) || (config && config.timeout) || 20000;

        var finir = function () {
            if (self._fini || jeton !== self._jeton) return false;
            self._fini = true;
            if (self._minuteur) { clearTimeout(self._minuteur); self._minuteur = null; }
            return !!self.callbacks;
        };
        this._minuteur = setTimeout(function () {
            if (!finir()) return;
            self.callbacks.onTimeout(stats, context, null);
        }, delaiMs);

        lire(context.url, { referer: referer, origine: origine, plage: plage, timeoutMs: delaiMs }).then(function (rep) {
            if (!finir()) return;
            var octets = rep.octets;
            var taille = octets && octets.byteLength ? octets.byteLength : 0;
            stats.loading.first = stats.loading.end = horlogeChargeur();
            stats.loaded = stats.total = taille;
            var donnees = binaire ? octets : new TextDecoder('utf-8').decode(octets);
            self.callbacks.onSuccess({ url: rep.finalUrl || context.url, data: donnees, code: rep.status }, stats, context, null);
        }, function (err) {
            if (!finir()) return;
            stats.loading.end = horlogeChargeur();
            if (err && err.delai) { self.callbacks.onTimeout(stats, context, null); return; }
            self.callbacks.onError({ code: (err && err.status) | 0, text: String((err && err.message) || 'pont') }, context, null, stats);
        });
    };

    ChargeurPont.prototype.abort = function () {
        var cb = this.callbacks;
        if (this._fini) return;
        this._fini = true;
        this.stats.aborted = true;
        if (this._minuteur) { clearTimeout(this._minuteur); this._minuteur = null; }
        if (cb && typeof cb.onAbort === 'function') cb.onAbort(this.stats, this.context, null);
    };

    ChargeurPont.prototype.destroy = function () {
        if (!this._fini) this.abort();
        this.callbacks = null;
        this.config = null;
    };

    ChargeurPont.prototype.getCacheAge = function () { return null; };
    ChargeurPont.prototype.getResponseHeader = function () { return null; };

    return ChargeurPont;
}

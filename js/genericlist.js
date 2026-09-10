/* ══ ANALYSE GÉNÉRIQUE D'UNE LISTE DE MATCHS ═══════════════════════════════

   « Ya moyen de futur proof encore plus l'app, pour si les sites changent […] que ça
   brise pas ou que ça se répare sans toujours faire du code » (10 septembre 2026).

   La découverte des LECTEURS dans une page de match est déjà sans branche par site :
   `js/extractors.js` récolte par la forme (iframes, boutons de bascule, attributs
   `data-*`, blobs JSON, ancres, adresses encodées) et apprend la réputation des hôtes.
   Une source qui change de gabarit de lecteur continue donc de livrer.

   La découverte des MATCHS, elle, était l'inverse : quinze parseurs `parse*`
   (js/scrapers.js) écrits sur le gabarit exact d'un site. Le jour où footybite refait
   son HTML, `parseFootybite` rend zéro, la source est morte, et il faut lire la page,
   écrire un parseur et publier. C'est exactement la panne qui demande « du code ».

   Ce module est le second rideau. Il ne connaît aucun site : il cherche la FORME que
   toutes ces listes partagent, parce qu'elle vient du besoin, pas du gabarit — un lien
   par rencontre, un titre « A vs B », souvent une heure à côté :

       <a href="/nba/lakers-vs-celtics-live" title="Lakers vs Celtics">
           <span>19:30</span> Lakers vs Celtics</a>

   Il n'est JAMAIS appelé quand le parseur dédié fonctionne (voir `parseGenerique`,
   js/scrapers.js) : tant qu'une source va bien, ce fichier ne s'exécute pas et ne peut
   donc rien salir. Et son pire échec est bénin : un match inventé ne crée pas de carte
   — `mergeFluxToApi` n'attache que ce que le calendrier connaît déjà, le reste va au
   diagnostic (`S.unmatchedStreams`).

   Module SANS import : testable seul, et importable par le script serveur. Il rend des
   enregistrements bruts ; c'est `js/scrapers.js` qui les habille (nom officiel d'équipe,
   ligue, couleurs, durée) avec les outils qu'il a déjà. */

/* Séparateurs d'un affrontement, du plus explicite au plus ambigu. `poids` dit la
   confiance : « vs » ne veut dire qu'une chose, « - » sert aussi bien à « Premier
   League - Live Streams ». `inverse` marque la forme américaine « visiteur @ local ». */
export var SEPARATEURS = [
    { re: /\s+(?:vs\.?|versus)\s+/i, poids: 40 },
    { re: /\s+v\s+/i, poids: 30 },
    { re: /\s+@\s+/, poids: 30, inverse: true },
    { re: /\s+[-–—]\s+/, poids: 10 }
];

/* Les mêmes, écrits dans une adresse : « lakers-vs-celtics », « lakers_vs_celtics ». */
export var SEPARATEURS_SLUG = [
    { re: /[-_]vs[-_]/i, poids: 40 },
    { re: /[-_]at[-_]/i, poids: 30, inverse: true },
    { re: /[-_]v[-_]/i, poids: 25 }
];

/* Mots qui trahissent un élément de menu plutôt qu'une équipe : « NBA Streams »,
   « Watch Free Live », « Schedule ». Un côté de l'affrontement qui n'est QUE cela n'en
   est pas un. */
export var MOT_DE_MENU_RE = /^(?:watch|free|live|streams?|streaming|schedule|calendar|home|index|all|full|hd|today|tomorrow|yesterday|tv|online|links?|replays?|highlights?|news|more|menu|login|register|search|contact|about|privacy|terms|dmca)$/i;

/* Une chaîne qui ne contient plus rien d'autre que du vocabulaire de site. */
function estDuMenu(txt) {
    var mots = String(txt || '').split(/\s+/).filter(Boolean);
    if (!mots.length) return true;
    for (var i = 0; i < mots.length; i++) {
        if (!MOT_DE_MENU_RE.test(mots[i].replace(/[^\w]/g, ''))) return false;
    }
    return true;
}

/* Un côté d'affrontement plausible : ni vide, ni un mot de menu, ni une date, ni un
   pavé de texte (un paragraphe entier n'est pas un nom d'équipe). */
export function nomPlausible(nom) {
    nom = String(nom || '').replace(/\s+/g, ' ').trim();
    if (nom.length < 2 || nom.length > 60) return false;
    if (!/[a-zà-ÿ]/i.test(nom)) return false;          // au moins une lettre
    if (/^\d{1,2}[:h]\d{2}/.test(nom)) return false;   // une heure
    if (estDuMenu(nom)) return false;
    if (nom.split(/\s+/).length > 8) return false;     // une phrase
    return true;
}

/* Nettoie un libellé récolté : heure en tête, état en tête, espaces insécables. */
export function nettoyerLibelle(txt) {
    return String(txt || '')
        .replace(/ /g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/^(?:live|direct|en\s+direct|upcoming|à\s+venir|hd)\s*[:|·•-]?\s*/i, '')
        .replace(/^\d{1,2}[:h]\d{2}(?:\s*(?:am|pm))?\s*[:|·•-]?\s*/i, '')
        .replace(/\s*[|·•]\s*(?:live|hd|free|stream(?:s|ing)?)\s*$/i, '')
        .trim();
}

/* Coupe un titre en deux camps. Rend `null` si rien de crédible.
   `source` sert à la note : un titre explicite vaut mieux qu'un slug d'adresse. */
export function couperAffrontement(titre) {
    var t = nettoyerLibelle(titre);
    if (!t) return null;
    for (var i = 0; i < SEPARATEURS.length; i++) {
        var sep = SEPARATEURS[i];
        var m = t.match(sep.re);
        if (!m) continue;
        var idx = t.indexOf(m[0]);
        var a = nettoyerLibelle(t.slice(0, idx));
        var b = nettoyerLibelle(t.slice(idx + m[0].length));
        /* Un troisième camp signale un titre qui n'est pas une rencontre
           (« Foot - Basket - Tennis ») : on ne devine pas. */
        if (sep.re.test(b)) return null;
        if (!nomPlausible(a) || !nomPlausible(b)) continue;
        return sep.inverse
            ? { home: b, away: a, poids: sep.poids }
            : { home: a, away: b, poids: sep.poids };
    }
    return null;
}

/* Le dernier segment d'une adresse, rendu lisible : « /nba/lakers-vs-celtics-live » →
   « Lakers vs Celtics ». Les queues de gabarit (« -live », « -stream », « -free ») sont
   retirées : elles viennent du site, pas des équipes. */
export function couperAffrontementSlug(href) {
    var chemin = String(href || '').split(/[?#]/)[0];
    var segments = chemin.split('/').filter(Boolean);
    if (!segments.length) return null;
    var slug = segments[segments.length - 1].replace(/\.(html?|php|aspx?)$/i, '');
    for (var i = 0; i < SEPARATEURS_SLUG.length; i++) {
        var sep = SEPARATEURS_SLUG[i];
        var m = slug.match(sep.re);
        if (!m) continue;
        var idx = slug.indexOf(m[0]);
        var a = mots(slug.slice(0, idx));
        var b = mots(slug.slice(idx + m[0].length));
        if (!nomPlausible(a) || !nomPlausible(b)) continue;
        return sep.inverse
            ? { home: b, away: a, poids: sep.poids - 10 }
            : { home: a, away: b, poids: sep.poids - 10 };
    }
    return null;
}

/* « tag-hungary-w-live-stream-free » → « Hungary W », « cincinnati-reds-15-free-live-stream »
   → « Cincinnati Reds ». Le nombre en queue est l'identifiant que le site colle au slug
   (mlbbite, streameast) : sans ce retrait, l'équipe s'appelait « Cincinnati Reds 15 » et
   ne s'appariait plus. */
function mots(part) {
    return String(part || '')
        .replace(/^(?:tag|watch|live|stream)[-_]/i, '')
        .replace(/[-_]+(?:live|stream(?:s|ing)?|free|online|hd|reddit|tv|now|today)(?=$|[-_])/gi, '')
        .replace(/[-_]+\d{1,4}$/, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b[a-zà-ÿ]/g, function (l) { return l.toUpperCase(); });
}

/* ── Heure ─────────────────────────────────────────────────────────────────
   Trois formes, par ordre de fiabilité : un horodatage en secondes ou
   millisecondes (`data-timestamp`), une date ISO portant son fuseau, un « HH:MM »
   écrit dans la page. Les deux premières donnent un instant ; la troisième ne donne
   qu'un texte, parce qu'on ignore le fuseau du site — c'est l'appelant qui décide
   quoi en faire. */
export var ATTRS_TEMPS = ['datetime', 'content', 'data-timestamp', 'data-time', 'data-start', 'data-starttime', 'data-date', 'data-utc', 'title'];

export function lireInstant(valeur) {
    var v = String(valeur == null ? '' : valeur).trim();
    if (!v) return null;
    if (/^\d{10}$/.test(v)) return new Date(parseInt(v, 10) * 1000);
    if (/^\d{13}$/.test(v)) return new Date(parseInt(v, 10));
    /* ISO avec fuseau explicite : le seul cas où l'instant est connu sans deviner. */
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/.test(v)) {
        var d = new Date(v.replace(' ', 'T'));
        return isNaN(d.getTime()) ? null : d;
    }
    return null;
}

export function lireHeureTexte(txt) {
    /* Les bornes de mot ne conviennent pas : dans « 14:00PSG - Marseille », le texte
       d'une ancre où l'heure et le nom se touchent, `\b` après « 00 » échoue. */
    var m = String(txt || '').match(/(?:^|[^\d:h])([01]?\d|2[0-3])[:h]([0-5]\d)(?!\d)(\s*(am|pm))?/i);
    if (!m) return null;
    var h = parseInt(m[1], 10), min = m[2], ampm = (m[4] || '').toLowerCase();
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    return (h < 10 ? '0' : '') + h + ':' + min;
}

/* La rangée qui porte l'ancre : l'heure et l'état vivent souvent à côté du lien, pas
   dedans. On remonte au plus trois parents, et on s'arrête sur un ancêtre qui contient
   d'autres ancres — ce n'est plus la ligne d'un match, c'est la liste. */
export function rangeeDe(a) {
    var el = a, n = 0;
    while (el && el.parentElement && n < 3) {
        var p = el.parentElement;
        if (p.querySelectorAll && p.querySelectorAll('a[href]').length > 1) break;
        el = p; n++;
    }
    return el || a;
}

function attributTemps(el) {
    if (!el || !el.getAttribute) return null;
    for (var i = 0; i < ATTRS_TEMPS.length; i++) {
        var d = lireInstant(el.getAttribute(ATTRS_TEMPS[i]));
        if (d) return d;
    }
    return null;
}

export function chercherTemps(a, rangee) {
    var portees = [a, rangee];
    for (var i = 0; i < portees.length; i++) {
        var el = portees[i];
        if (!el) continue;
        var d = attributTemps(el);
        if (d) return { instant: d };
        if (el.querySelectorAll) {
            var enfants = el.querySelectorAll('time, [datetime], [content], [data-timestamp], [data-time], [data-start], [data-utc]');
            for (var j = 0; j < enfants.length; j++) {
                var de = attributTemps(enfants[j]);
                if (de) return { instant: de };
            }
        }
    }
    for (var k = 0; k < portees.length; k++) {
        if (!portees[k]) continue;
        var t = lireHeureTexte(portees[k].textContent || '');
        if (t) return { texte: t };
    }
    return null;
}

/* ── Rejets ────────────────────────────────────────────────────────────────
   Ce qu'on refuse AVANT de chercher un affrontement : ressources, ancres internes,
   protocoles non http, et les hôtes qui ne sont jamais une page de match. */
export var HREF_REJET_RE = /^(?:#|javascript:|mailto:|tel:|data:)/i;
export var EXT_REJET_RE = /\.(png|jpe?g|gif|svg|webp|ico|css|js|mjs|json|xml|txt|woff2?|ttf|mp4|m3u8|pdf|zip)(\?|#|$)/i;
export var HOTE_REJET_RE = /(^|\.)(x\.com|twitter\.com|facebook\.com|instagram\.com|tiktok\.com|t\.me|telegram\.(me|org)|discord\.(gg|com)|reddit\.com|youtube\.com|youtu\.be)$/i;

function hoteDe(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
}

/* ── Extraction ────────────────────────────────────────────────────────────

   `options` :
     base            adresse de la page (résolution des liens relatifs) ;
     memeSiteSeul    n'accepter que les liens du même hôte (défaut : vrai) ;
     minimum         note minimale d'un enregistrement retenu (défaut : 20) ;
     max             nombre maximal d'enregistrements (défaut : 400).

   Rend des enregistrements `{ home, away, matchUrl, instant, heureTexte, statut,
   ligue, note }`, triés par note décroissante puis par ordre d'apparition. */
export function extraireMatchsGeneriques(html, pageUrl, options) {
    options = options || {};
    var minimum = options.minimum == null ? 20 : options.minimum;
    var maximum = options.max == null ? 400 : options.max;
    var memeSiteSeul = options.memeSiteSeul !== false;

    var doc;
    try { doc = new DOMParser().parseFromString(String(html || ''), 'text/html'); }
    catch (e) { return []; }
    if (!doc || !doc.querySelectorAll) return [];

    var base = pageUrl || options.base || '';
    var hoteBase = hoteDe(base);
    var ancres = doc.querySelectorAll('a[href]');
    var vus = {};
    var out = [];

    for (var i = 0; i < ancres.length && out.length < maximum; i++) {
        var a = ancres[i];
        var href = a.getAttribute('href') || '';
        if (!href || HREF_REJET_RE.test(href) || EXT_REJET_RE.test(href)) continue;

        var url;
        try { url = new URL(href, base || undefined).href; } catch (e) { continue; }
        if (!/^https?:/i.test(url)) continue;
        var hote = hoteDe(url);
        if (HOTE_REJET_RE.test(hote)) continue;
        if (memeSiteSeul && hoteBase && hote !== hoteBase) continue;

        var cle = url.replace(/\/$/, '').toLowerCase();
        if (vus[cle]) continue;

        /* Le titre : l'attribut d'abord (c'est le libellé propre du site), le texte
           ensuite (il porte l'heure et l'état collés au nom). */
        var rangee = rangeeDe(a);
        var duel = null, note = 0;
        var candidats = [a.getAttribute('title'), a.getAttribute('aria-label'), a.textContent];
        for (var c = 0; c < candidats.length && !duel; c++) {
            duel = couperAffrontement(candidats[c]);
            if (duel) note = duel.poids + (c === 0 ? 10 : 0);
        }
        if (!duel) {
            duel = couperAffrontementSlug(url);
            if (duel) note = duel.poids;
        }
        if (!duel) continue;

        var temps = chercherTemps(a, rangee);
        if (temps) note += temps.instant ? 25 : 15;

        /* Le « - » seul ne prouve rien : sans heure à côté, on ne retient pas. */
        if (duel.poids <= 10 && !temps) continue;
        if (note < minimum) continue;

        var contexte = ((a.className || '') + ' ' + (rangee && rangee.className || '') + ' ' + (a.textContent || '')).toLowerCase();
        var statut = /\b(live|en\s?direct|now\s?playing|in\s?play)\b/.test(contexte) ? 'live' : 'upcoming';

        vus[cle] = true;
        out.push({
            home: duel.home,
            away: duel.away,
            matchUrl: url,
            instant: temps && temps.instant ? temps.instant : null,
            heureTexte: temps && temps.texte ? temps.texte : null,
            statut: statut,
            ligue: ligueDepuisChemin(url, hoteBase),
            note: note,
            ordre: out.length
        });
    }

    out.sort(function (x, y) { return (y.note - x.note) || (x.ordre - y.ordre); });
    return out;
}

/* La ligue, quand le chemin la porte : « /nba/lakers-vs-celtics » → « nba ».
   Le premier segment, s'il est court et alphabétique — sinon rien : mieux vaut pas de
   ligue qu'une fausse, `officialTeamNameForLeague` s'en sert. */
export function ligueDepuisChemin(url, hoteBase) {
    var chemin;
    try { chemin = new URL(url).pathname; } catch (e) { return null; }
    var seg = chemin.split('/').filter(Boolean);
    if (seg.length < 2) return null;
    var premier = seg[0].toLowerCase();
    if (!/^[a-z][a-z0-9-]{1,24}$/.test(premier)) return null;
    if (/^(watch|live|stream|streams|match|matches|game|games|event|events|tag|page|category|sport|sports|schedule|now-playing)$/.test(premier)) {
        /* « /watch/nba/… » : la ligue est le segment suivant. */
        if (seg.length >= 3 && /^[a-z][a-z0-9-]{1,24}$/.test(seg[1].toLowerCase())) return seg[1].toLowerCase().replace(/-/g, ' ');
        return null;
    }
    if (hoteBase && premier === hoteBase.split('.')[0]) return null;
    return premier.replace(/-/g, ' ');
}

if (typeof window !== 'undefined') {
    window.extraireMatchsGeneriques = extraireMatchsGeneriques;
}

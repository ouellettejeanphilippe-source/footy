/* Jouabilité observée : ce qui JOUE dans une tuile, plutôt que ce qui en a la forme.

   Pendant des semaines, le Multivision a choisi ses flux d'après la FORME des liens —
   qualité annoncée, nom du site, en-têtes de cadre — et presque rien ne jouait. Mesuré le
   6 septembre 2026 sur les 1 237 cibles de tuile du cache : 39 hôtes les couvrent toutes ;
   la plupart servent une page intermédiaire (une iframe vers le maillon suivant), une
   page anti-adblock, ou répondent 403. Aucun de ces défauts ne se lit dans l'adresse.

   Ce module tient la règle commune à trois endroits :
   1. `scripts/verify_players.mjs` (GitHub Actions, toutes les heures) charge les lecteurs
      des matchs en direct dans un VRAI navigateur, encadrés comme dans une tuile, et note
      ce qu'il observe : trafic vidéo, élément <video> prêt, cadre refusé.
   2. `sortFluxLinks` (js/config.js) classe les liens d'après ces observations — celles du
      serveur (`hostPlay` dans data/streams.json) et celles du navigateur de l'utilisateur
      (registre local, alimenté par le script utilisateur qui voit la vidéo jouer).
   3. La tuile (js/multiview.js) recharge la source quand rien ne joue, et ne passe à la
      suivante qu'après cet essai (`actionSansVideo`, `arretMeriteRechargement`).

   Module sans aucun import : chargé par le script serveur, par le navigateur, et par les
   tests, sans tirer le graphe des modules. */

/* Adresses de segments ou de manifestes vidéo : en voir une partir d'un cadre, c'est voir
   la vidéo jouer, quel que soit le lecteur.

   Jugée sur le CHEMIN de l'adresse, pas sur l'adresse entière. Au premier passage réel
   (6 septembre 2026), une expression appliquée à l'adresse entière comptait comme vidéo
   `cdn.jsdelivr.net/npm/@swarmcloud/hls/p2p-engine.min.js` (« /hls/ » dans le chemin
   d'une bibliothèque), `static.rutube.ru/…/hls/1.6.15/hls.min.js`, et la page de sonde
   elle-même quand l'adresse encodée de la cible finissait en « .m3u8 ». Un fichier de
   script, de style ou d'image n'est jamais de la vidéo, quel que soit son dossier. */
var MEDIA_EXT_RE = /\.(m3u8|mpd|ts|m4s|mp4|webm|aac|mp3|flv)$/i;
var NOT_MEDIA_EXT_RE = /\.(js|mjs|css|html?|json|xml|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|txt|map)$/i;
export function isMediaRequest(url) {
    var path;
    try { path = new URL(String(url)).pathname; } catch (e) { return false; }
    if (NOT_MEDIA_EXT_RE.test(path)) return false;
    if (MEDIA_EXT_RE.test(path)) return true;
    return /\/(hls|dash)\//i.test(path) || /videoplayback/i.test(path);
}

export function hostOfUrl(u) {
    try { return new URL(String(u)).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
}

/* Ce que la tuile charge réellement pour un lien : la page, telle que le site la sert
   (voir fallbackToIframe, js/multiview.js). Un `playerUrl` résiduel du cache n'est plus
   chargé : les lecteurs extraits ne jouaient pas, la page entière nettoyée par le script
   utilisateur, si. */
export function tileTarget(link) {
    return (link && link.url) || '';
}

/* Verdict d'une observation en navigateur.
   - `plays`   : du trafic vidéo est parti, ou un <video> a des données prêtes ;
   - `blocked` : le cadre a été refusé (page d'erreur du navigateur) ou l'hôte a répondu
                 une erreur — ce lien ne jouera pour personne ;
   - `none`    : chargé, mais rien ne joue. Faible signal : un centre de données peut être
                 traité autrement qu'un vrai visiteur. */
export function verdictFromObservation(obs) {
    var o = obs || {};
    if ((o.mediaRequests | 0) > 0 || o.videoReady) return 'plays';
    if (o.frameError || (o.status | 0) >= 400) return 'blocked';
    return 'none';
}

/* Registre par hôte : { hôte: { tested, plays } }. Les observations s'additionnent d'un
   passage à l'autre ; au-delà de `cap` essais, les deux compteurs sont divisés par deux,
   pour que le passé lointain pèse moins que la dernière heure. */
export function recordObservation(ledger, host, verdict, cap) {
    if (!host) return ledger;
    var l = ledger || {};
    var e = l[host] || { tested: 0, plays: 0 };
    e.tested += 1;
    if (verdict === 'plays') e.plays += 1;
    var max = cap || 40;
    if (e.tested > max) { e.tested = Math.round(e.tested / 2); e.plays = Math.round(e.plays / 2); }
    l[host] = e;
    return l;
}

/* Ce que la vérification a appris, REPORTÉ d'un passage au suivant.

   Défaut trouvé le 20 septembre 2026, après « tous les matchs, aucune source ne marche ».
   `scripts/scrape_streams.mjs` réécrit `data/streams.json` toutes les 30 minutes sans y
   remettre `hostPlay` (le mot n'apparaissait pas une seule fois dans le fichier), et
   `verify_players.mjs` repartait donc d'un registre VIDE à chaque passage, n'y laissant
   que les ~81 observations de son propre budget. Le registre ne pouvait jamais
   s'accumuler.

   Ça n'était pas un détail de comptabilité : `playabilityScore` n'ose rétrograder un hôte
   qu'à partir de `tested >= 3`. Avec un ou deux essais par hôte, un CDN mort restait
   « jamais éprouvé » (score 1) et passait DEVANT un hôte réellement mesuré. Mesuré le
   jour même : `embed.st` à 1/1 dans le registre alors que son manifeste répondait
   `HTTP 500` — en accès isolé comme en rafale, donc pas une limite par IP. L'application
   le classait en tête à chaque passage, et l'utilisateur parcourait des sources mortes.

   Les verdicts par LIEN se reportent aussi, mais avec une péremption : un lien marqué
   `blocked` ne doit pas l'être à vie, un hôte se répare. Au-delà de `VERIF_VALIDITE_MS`,
   l'observation est oubliée et le lien redevient à éprouver. Rend le nombre de liens
   effectivement repris. */
export var VERIF_VALIDITE_MS = 6 * 60 * 60 * 1000;
export function reporterVerifications(matches, precedent, maintenant, validiteMs) {
    var now = maintenant || Date.now();
    var validite = (validiteMs == null) ? VERIF_VALIDITE_MS : validiteMs;
    var vus = {};
    ((precedent && precedent.matches) || []).forEach(function (m) {
        (((m && m.streamLinks) || [])).forEach(function (l) {
            if (!l || !l.url || !l.verified) return;
            var at = l.verifiedAt ? Date.parse(l.verifiedAt) : NaN;
            if (isNaN(at) || now - at > validite || now - at < 0) return;
            vus[l.url] = { verified: l.verified, verifiedAt: l.verifiedAt };
        });
    });
    var n = 0;
    (matches || []).forEach(function (m) {
        (((m && m.streamLinks) || [])).forEach(function (l) {
            if (!l || !l.url || l.verified) return; // une observation fraîche prime toujours
            var v = vus[l.url];
            if (!v) return;
            l.verified = v.verified;
            l.verifiedAt = v.verifiedAt;
            n++;
        });
    });
    return n;
}

export function mergeLedgers(a, b) {
    var out = {};
    [a, b].forEach(function (l) {
        Object.keys(l || {}).forEach(function (h) {
            var e = l[h] || {};
            var t = out[h] || { tested: 0, plays: 0 };
            t.tested += e.tested | 0;
            t.plays += e.plays | 0;
            out[h] = t;
        });
    });
    return out;
}

/* Score de jouabilité d'un lien, du plus sûr au plus douteux :
     3  observé en train de jouer (ce lien même) ;
     2  hôte qui joue le plus souvent ;
     1  jamais éprouvé ;
     0  hôte éprouvé qui ne joue à peu près jamais, ou lien observé sans vidéo ;
    -1  cadre refusé ou hôte mort. */
export function playabilityScore(link, ledger) {
    if (!link) return 0;
    if (link.verified === 'plays') return 3;
    if (link.verified === 'blocked') return -1;
    var host = hostOfUrl(tileTarget(link));
    var e = ledger && ledger[host];
    if (e && e.tested >= 3) {
        var rate = e.plays / e.tested;
        if (rate >= 0.5) return 2;
        if (e.plays === 0) return link.verified === 'none' ? -1 : 0;
        return 1;
    }
    if (link.verified === 'none') return 0;
    return 1;
}

/* Combien de temps la tuile attend une vidéo avant de passer à la source suivante.

   « embed.st, soit ça marche pas, soit c'est hyper long… finalement ça marche après x
   temps » (6 septembre 2026, Firefox). Sa page pèse 640 Ko de script obfusqué, décodé au
   chargement, plus un moteur pair-à-pair qui cherche des pairs avant de se rabattre sur le
   CDN : la vidéo vient, mais tard. Avec une patience fixe de 30 s, la tuile quittait la
   source AVANT qu'elle ne joue, puis la suivante repartait de zéro — d'où « ça marche pas
   du tout ». Un lien observé en train de jouer, ou dont l'hôte joue le plus souvent
   (score ≥ 2), mérite la patience longue ; un inconnu ou un douteux garde la courte. */
export function patienceMs(link, ledger, courte, longue) {
    return playabilityScore(link, ledger) >= 2 ? longue : courte;
}

/* Combien de fois une même source est chargée dans une tuile avant d'être abandonnée :
   le premier chargement, puis UN rechargement. */
export var ESSAIS_PAR_SOURCE = 2;

/* Que faire d'une tuile où rien ne joue au bout de sa patience : `recharger` la même
   source tant qu'il lui reste un essai, `suivante` ensuite, `rien` quand il n'y a nulle
   part où aller.

   « Trop vite à switch de sources quand ça bugge, au lieu de tenter de recharger »
   (19 septembre 2026). La règle d'avant abandonnait une source au PREMIER silence, alors
   qu'une page de lecteur rate souvent son démarrage sans que le lien soit en cause —
   script posé avant le lecteur, publicité qui vole le premier clic, segment initial
   perdu, cadre posé pendant que l'onglet était en arrière-plan — et le même lien,
   rechargé, joue. Passer à la suivante coûtait alors une source qui marchait, et la
   suivante repartait de zéro. On ne quitte donc une source qu'après l'avoir rechargée. */
export function actionSansVideo(essais, resteDesSources, essaisMax) {
    var max = essaisMax || ESSAIS_PAR_SOURCE;
    if ((essais | 0) < max) return 'recharger';
    return resteDesSources ? 'suivante' : 'rien';
}

/* Combien d'essais CETTE source mérite — le correctif du 20 septembre 2026, « les vidéos
   se chargent pas bien dans le multiview aujourd'hui ».

   Le rechargement introduit la veille était juste, mais il était PAYÉ PARTOUT : chaque
   source morte coûtait deux fois sa patience, 60 s au lieu de 30, et 180 au lieu de 90
   pour un hôte réputé lent. Parcourir quatorze sources mortes passait de 7 à 14 minutes.
   Mesuré le jour même : les liens n'étaient pas en cause (40 % de lecture la veille,
   42 % ce jour-là) — c'était bien le prix du second essai.

   Le rechargement est un SECOURS, pas un péage. Il sert à rattraper la source sur
   laquelle la tuile a ATTERRI quand sa page rate son démarrage : script posé avant le
   lecteur, publicité qui vole le premier clic, segment initial perdu. Deux situations ne
   le méritent pas :
     - la tuile PARCOURT déjà la liste (une bascule automatique a eu lieu) : on ne
       rattrape plus, on cherche, et chaque seconde de plus est une seconde sans image ;
     - l'hôte est connu pour ne pas jouer (score ≤ 0 : cadre refusé, hôte éprouvé qui
       ne joue jamais, lien déjà observé sans vidéo) — le recharger ne le fera pas jouer. */
export function essaisPourSource(link, ledger, enParcours, essaisMax) {
    if (enParcours) return 1;
    if (playabilityScore(link, ledger) <= 0) return 1;
    return essaisMax || ESSAIS_PAR_SOURCE;
}

/* Combien de fois on recharge une source qui S'ARRÊTE après avoir joué, et quand ce
   compte est oublié.

   Sans borne, la reprise du 19 septembre boucle : un flux qui joue deux secondes, meurt,
   est rechargé, rejoue deux secondes… La lecture remettait le compteur d'essais à zéro,
   donc rien n'arrêtait le cycle — un défaut introduit ce jour-là, jamais rapporté mais
   bien réel. Une source qui ne tient pas est cassée ; la rallumer en boucle ne fait que
   rallumer la même panne.

   Mais une source qui a joué LONGTEMPS avant de lâcher est un tout autre cas : c'est un
   match qu'on regardait, et il mérite qu'on le rattrape. Le compte est donc oublié quand
   la vidéo a tenu `oubliMs`. Rend `{ autorisee, reprises }` : le nouveau compte à ranger
   sur la tuile. */
export var REPRISES_PAR_SOURCE = 2;
export var REPRISE_OUBLI_MS = 120000;
export function budgetReprise(reprises, jouaitDepuisMs, maxReprises, oubliMs) {
    var max = maxReprises || REPRISES_PAR_SOURCE;
    var oubli = (oubliMs == null) ? REPRISE_OUBLI_MS : oubliMs;
    var n = (typeof jouaitDepuisMs === 'number' && jouaitDepuisMs >= oubli) ? 0 : (reprises | 0);
    return { autorisee: n < max, reprises: n + 1 };
}

/* Une vidéo qui S'ARRÊTE après avoir joué mérite-t-elle un rechargement de sa source ?

   Oui, sauf si c'est l'utilisateur qui l'a arrêtée. Le script utilisateur à jour le dit
   (`cause`) : `pause` est une vidéo prête et volontairement arrêtée, `attente` un
   ré-tampon ou un segment perdu, `absente` un lecteur qui a disparu de la page. Un
   script plus ancien n'envoie pas ce champ ; on se rabat alors sur le dernier clic vu
   dans le cadre, parce que mettre une vidéo en pause demande un geste et que ré-tamponner
   n'en demande aucun. */
export function arretMeriteRechargement(opts) {
    var o = opts || {};
    if (o.cause === 'pause') return false;
    if (o.cause === 'attente' || o.cause === 'absente') return true;
    var fenetre = (o.fenetreGeste == null) ? 20000 : o.fenetreGeste;
    if (typeof o.gesteIlYaMs === 'number' && o.gesteIlYaMs >= 0 && o.gesteIlYaMs < fenetre) return false;
    return true;
}

/* Cibles à éprouver pendant un passage : les matchs par ordre de `rank` (0 = en direct,
   1 = imminent, 2 = le reste), au plus `perMatch` liens par match sur des hôtes
   distincts, au plus `perHost` liens par hôte sur tout le passage (un hôte qui sert cent
   liens n'a pas besoin de cent essais), au plus `total` cibles. */
export function pickTargets(matches, opts) {
    var o = opts || {};
    var perMatch = o.perMatch || 3, perHost = o.perHost || 4, total = o.total || 150;
    var hostCount = {};
    var out = [];
    var ordered = (matches || []).map(function (m, i) { return { m: m, i: i }; })
        .filter(function (x) { return x.m && Array.isArray(x.m.streamLinks) && x.m.streamLinks.length; })
        .sort(function (a, b) { return (a.m.rank | 0) - (b.m.rank | 0); });
    ordered.forEach(function (x) {
        if (out.length >= total) return;
        var vus = {};
        var pris = 0;
        for (var k = 0; k < x.m.streamLinks.length && pris < perMatch && out.length < total; k++) {
            var l = x.m.streamLinks[k];
            var target = tileTarget(l);
            var host = hostOfUrl(target);
            if (!host || vus[host]) continue;
            if ((hostCount[host] | 0) >= perHost) continue;
            vus[host] = true;
            hostCount[host] = (hostCount[host] | 0) + 1;
            out.push({ matchIndex: x.i, linkIndex: k, target: target, host: host });
            pris++;
        }
    });
    return out;
}

/* Lien suivant dans l'ordre donné, après celui dont l'adresse est `currentUrl` ; revient
   au début en bout de liste. Rend null s'il n'y a pas d'autre lien. */
export function nextLinkAfter(links, currentUrl) {
    var L = (links || []).filter(function (l) { return l && l.url; });
    if (L.length < 2) return null;
    var i = -1;
    for (var k = 0; k < L.length; k++) { if (L[k].url === currentUrl) { i = k; break; } }
    return L[(i + 1) % L.length];
}

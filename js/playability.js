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

/* Le critère du verdict, versionné.

   Il change de valeur quand la RÈGLE change, et `verify_players.mjs` repart alors
   d'un registre vide : des compteurs gagnés sous une règle fausse ne valent rien,
   et les laisser vieillir tout seuls prendrait des semaines pendant lesquelles le
   classement continuerait de se tromper.

   v2 (26 septembre 2026) : la vidéo doit être ARRIVÉE, pas seulement demandée. */
export var CRITERE_VERDICT = 2;

/* Verdict d'une observation en navigateur.
   - `plays`   : un <video> a des données prêtes, ou de la vidéo est vraiment arrivée ;
   - `blocked` : le cadre a été refusé (page d'erreur du navigateur) ou l'hôte a répondu
                 une erreur — ce lien ne jouera pour personne ;
   - `none`    : chargé, mais rien ne joue. Faible signal : un centre de données peut être
                 traité autrement qu'un vrai visiteur.

   POURQUOI CE N'EST PLUS LE NOMBRE DE REQUÊTES QUI DÉCIDE
   -------------------------------------------------------
   La règle d'avant était `mediaRequests > 0 || videoReady`, et `mediaRequests`
   comptait les requêtes PARTIES (`page.on('request')`), jamais les réponses. Une
   seule requête dont l'adresse ressemble à de la vidéo suffisait donc — qu'elle
   réponde 403, 404, ou rien du tout.

   Ce n'était pas une subtilité. Signalé le 26 septembre 2026 : « les embed.st, ya
   genre généralement RIEN qui joue ». Or embed.st était noté 24 sur 24 « joue »,
   donc premier au classement, donc la première chose qu'une tuile chargeait. Son
   lecteur pair-à-pair DEMANDE un manifeste dès l'ouverture ; que rien n'arrive
   ensuite ne changeait pas le verdict. Le classement récompensait l'intention de
   jouer, pas le fait de jouer — et l'écran restait noir.

   Deux preuves sont maintenant acceptées, et aucune autre :

     `videoReady`  un <video> du cadre a `readyState >= 2` ou `currentTime > 0`.
                   C'est la preuve directe : des données décodables sont là.

     `mediaOk >= 2` au moins deux réponses vidéo en 2xx. Deux, et non une : une
                   seule est le manifeste, qui prouve que la liste de lecture
                   existe — pas qu'un segment ait suivi. Deux veut dire le
                   manifeste ET un segment, ou deux segments.

   `mediaRequests` est conservé, mais seulement pour le diagnostic : l'écart entre
   « demandé » et « arrivé » est précisément ce qui était invisible. */
export function verdictFromObservation(obs) {
    var o = obs || {};
    if (o.videoReady) return 'plays';
    if ((o.mediaOk | 0) >= 2) return 'plays';
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
            vus[l.url] = { verified: l.verified, verifiedAt: l.verifiedAt, media: l.media, mediaAt: l.mediaAt, mediaReferer: l.mediaReferer, hauteur: l.hauteur };
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
            /* L'adresse du flux voyage avec son verdict : elle a été observée au même
               instant, et le mode direct a sa propre péremption (MEDIA_DIRECT_TTL_MS,
               js/directmedia.js) qui la jettera plus tôt si elle était signée. */
            if (v.media) { l.media = v.media; l.mediaAt = v.mediaAt; if (v.mediaReferer) l.mediaReferer = v.mediaReferer; }
            // La hauteur mesurée voyage elle aussi avec son verdict (sortFluxLinks, js/config.js).
            if (v.hauteur) l.hauteur = v.hauteur;
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

/* Le registre de CET appareil passe devant celui du serveur, dès qu'il a de quoi juger.

   « Je voudrais que ça se corrige et adapte de lui-même » (24 octobre 2026). Le serveur
   éprouve les lecteurs dans un Chromium d'ordinateur ; ce que joue un Firefox, un
   téléphone ou la télé n'est pas forcément la même chose. Or le navigateur ajoutait ses
   observations au registre du serveur par simple somme : un hôte à 30 sur 40 côté serveur
   et 0 sur 5 ici restait à 30 sur 45 — en tête, sur un appareil où il n'a jamais joué.

   Dès que l'appareil a éprouvé un hôte `SEUIL_APPAREIL` fois, le serveur ne compte plus
   que comme un a priori de `POIDS_SERVEUR_APPAREIL` essais (à son taux) : 0 sur 5 ici et
   30 sur 40 là-bas donnent 3 sur 9. Et l'hôte qui n'a JAMAIS joué ici porte
   `appareilMort` : un lien que le serveur a vu jouer (`verified: 'plays'`) n'est plus
   présumé jouer sur cet appareil (voir playabilityScore, reputationLien). En dessous du
   seuil, la somme d'avant : deux essais ratés peuvent être une panne passagère.

   Sert pour les hôtes comme pour les sources (js/config.js, `playLedger`,
   `sourcePlayLedger`). Pure.

   **Le veto de l'appareil expire** (26 octobre 2026). Un hôte jugé mort ici était
   rétrogradé pour toujours : classé en bas, il n'était plus jamais essayé, donc ne
   jouait plus jamais ici, donc restait mort — une panne d'un soir le condamnait, et
   le registre ne faisait que grossir (le serveur, lui, réhabilite ses hôtes écartés,
   `ciblesDeRehabilitation`). Chaque observation locale porte maintenant son heure
   (`at`, posée par `notePlayability`) ; sans observation depuis `OUBLI_APPAREIL_MS`
   (24 h), ou sans heure du tout (registre d'avant), l'appareil ne compte plus que comme
   une somme : plus de `appareilMort`, le serveur mène, l'hôte a droit à un nouvel essai —
   qui, s'il échoue, le remet mort pour 24 h. */
export var SEUIL_APPAREIL = 3;
export var POIDS_SERVEUR_APPAREIL = 4;
export var OUBLI_APPAREIL_MS = 24 * 3600 * 1000;
export function fusionAppareil(serveur, local, now) {
    var t = (typeof now === 'number') ? now : Date.now();
    var out = mergeLedgers(serveur, null);
    Object.keys(local || {}).forEach(function (k) {
        var l = local[k] || {};
        var lt = l.tested | 0, lp = l.plays | 0;
        var s = out[k] || { tested: 0, plays: 0 };
        var recent = typeof l.at === 'number' && t - l.at < OUBLI_APPAREIL_MS;
        if (lt < SEUIL_APPAREIL || !recent) {
            out[k] = { tested: s.tested + lt, plays: s.plays + lp };
            return;
        }
        var st = Math.min(s.tested, POIDS_SERVEUR_APPAREIL);
        var sp = s.tested ? Math.round(s.plays * st / s.tested) : 0;
        var e = { tested: lt + st, plays: lp + sp, appareil: { tested: lt, plays: lp } };
        if (lp === 0) e.appareilMort = true;
        out[k] = e;
    });
    return out;
}

/* Un ⏭ MANUEL compte-t-il comme « rien n'a joué » ?

   Jusqu'ici, seule la bascule automatique notait un échec — et elle n'existe qu'avec le
   script utilisateur. Sans lui, l'appareil n'apprenait rien : on zappait les mêmes sources
   mortes jour après jour. Un ⏭ appuyé sur une source qui n'a donné aucun signe de lecture,
   après lui avoir laissé `SAUT_MIN_MS` (le temps de charger) et avant `SAUT_MAX_MS` (au-delà,
   on la regardait peut-être, et on change pour une autre raison), est un échec. Une source
   qui a joué dans cette tuile n'est jamais notée sur un ⏭. */
export var SAUT_MIN_MS = 8 * 1000;
export var SAUT_MAX_MS = 90 * 1000;
export function sautManuelEstEchec(opts) {
    var o = opts || {};
    if (o.aJoue) return false;
    var d = Number(o.depuisMs);
    if (!isFinite(d)) return false;
    return d >= SAUT_MIN_MS && d <= SAUT_MAX_MS;
}

/* Score de jouabilité d'un lien, du plus sûr au plus douteux :
     3  observé en train de jouer (ce lien même) ;
     2  hôte qui joue le plus souvent ;
     1  jamais éprouvé ;
     0  hôte éprouvé qui ne joue à peu près jamais, ou lien observé sans vidéo ;
    -1  cadre refusé ou hôte mort. */
/* La part de l'APPAREIL seule dans une entrée fusionnée (fusionAppareil) : ce qu'il a vu
   lui-même, récemment ; null s'il n'a pas de quoi juger. */
function entreeAppareil(e) {
    if (!e || !e.appareil) return null;
    return { tested: e.appareil.tested | 0, plays: e.appareil.plays | 0, appareilMort: !!e.appareilMort };
}

export function playabilityScore(link, ledger) {
    if (!link) return 0;
    var host = hostOfUrl(tileTarget(link));
    var e = ledger && ledger[host];
    /* Non vérifiable depuis le serveur (nonVerifiableDepuisServeur) : son verdict et son
       registre ne disent rien de cet hôte ; seul ce que CET appareil a vu compte. Sans
       rien : un inconnu, à essayer. */
    if (link.nonVerifiable) {
        var ea = entreeAppareil(e);
        if (!ea) return 1;
        if (ea.appareilMort) return 0;
        return (ea.tested >= 3 && ea.plays / ea.tested >= 0.5) ? 2 : 1;
    }
    /* Jamais joué sur cet appareil (fusionAppareil) : ni le verdict du serveur ni son
       taux ne le remontent. */
    if (e && e.appareilMort) return link.verified === 'blocked' ? -1 : 0;
    if (link.verified === 'plays') return 3;
    if (link.verified === 'blocked') return -1;
    if (e && e.tested >= 3) {
        var rate = e.plays / e.tested;
        if (rate >= 0.5) return 2;
        if (e.plays === 0) return link.verified === 'none' ? -1 : 0;
        return 1;
    }
    if (link.verified === 'none') return 0;
    return 1;
}

/* Ce que l'observation permet de DIRE d'un lien, sur sa ligne dans la liste.

   Pourquoi la liste le dit, alors que `playabilityScore` le savait déjà :
   `sortFluxLinks` mettait bien les liens jouables en tête, mais la liste
   continuait d'afficher tous les autres à la suite, sans rien pour les
   distinguer. Mesuré le 26 septembre 2026 sur le cache du jour : 2205 des
   4825 liens (46 %) portaient sur un hôte éprouvé au moins trois fois qui
   n'a JAMAIS joué — sportplus.watch à lui seul en portait 950, un cinquième
   du total. Rien ne le disait, donc on cliquait dedans.

   Ce qui est marqué, et ce qui ne l'est pas :

     'si-joue'   CE lien-ci a été vu en train de jouer ;
     'si-mort'   son hôte a été éprouvé N fois sans jamais jouer ;
     'si-rare'   il joue, mais moins d'une fois sur deux ;
     null        hôte inconnu, ou éprouvé moins de trois fois — une marque sur un
                 doute serait du bruit.

   Le seuil de trois est celui de `playabilityScore` : au-dessous, un hôte peut
   simplement être tombé pendant l'essai. Le compte part EN CLAIR plutôt qu'un
   jugement, parce que 0/4 et 0/24 ne méritent pas la même confiance.

   POURQUOI « JOUE PARFOIS » EST MARQUÉ LUI AUSSI
   ---------------------------------------------
   `playabilityScore` ne rend 0 qu'à `plays === 0` ; un hôte à une réussite sur
   quatre obtient 1, c'est-à-dire EXACTEMENT ce qu'obtient un hôte jamais éprouvé.
   Mesuré le 26 septembre 2026, après correction du critère du verdict : embed.st
   tombe à 1/4 — et porte 956 liens, soit 22 % de la liste. Sans marque, un
   cinquième des liens se présentait comme « inconnu » alors qu'on savait qu'il
   joue une fois sur quatre.

   Rend un descriptif, pas du HTML : ce module ne connaît pas l'interface, et
   c'est ce qui permet de l'éprouver sans navigateur ni DOM. */
export function marqueJouabilite(link, ledger) {
    if (!link || !link.url) return null;
    var ea = ledger && ledger[hostOfUrl(tileTarget(link))];
    if (ea && ea.appareilMort) {
        return {
            classe: 'si-mort',
            texte: 'ici 0/' + ea.appareil.tested,
            infobulle: 'Cet hôte a été essayé ' + ea.appareil.tested + ' fois sur cet appareil sans '
                + "qu'aucune vidéo ne démarre. Il est classé en bas de la liste ; il remontera s'il se met à jouer.",
        };
    }
    if (link.nonVerifiable) {
        var eap = entreeAppareil(ea);
        if (eap && eap.tested >= 3) {
            return {
                classe: eap.plays / eap.tested >= 0.5 ? 'si-joue' : 'si-rare',
                texte: 'ici ' + eap.plays + '/' + eap.tested,
                infobulle: 'Le serveur de vérification ne peut pas joindre cet hôte ; sur cet appareil, il a joué '
                    + eap.plays + ' fois sur ' + eap.tested + '.',
            };
        }
        return {
            classe: 'si-essai',
            texte: 'à essayer',
            infobulle: 'Le serveur de vérification ne peut pas joindre cet hôte (il bloque les centres de données) : '
                + "rien ne dit qu'il ne joue pas chez toi. Cet appareil apprendra en l'essayant.",
        };
    }
    if (link.verified === 'plays') {
        return {
            classe: 'si-joue',
            texte: 'joue',
            infobulle: 'Observé en train de jouer par la vérification des lecteurs.',
        };
    }
    var e = ledger && ledger[hostOfUrl(tileTarget(link))];
    if (!e || (e.tested | 0) < 3) return null;
    var compte = e.plays + '/' + e.tested;
    if ((e.plays | 0) === 0) {
        return {
            classe: 'si-mort',
            texte: compte,
            infobulle: 'Cet hôte a été chargé ' + e.tested + ' fois dans un vrai navigateur sans '
                + "qu'aucune vidéo ne démarre. Le lien reste ouvrable — un hôte peut revenir — mais "
                + "il y a peu de chances qu'il joue.",
        };
    }
    if (e.plays / e.tested < 0.5) {
        return {
            classe: 'si-rare',
            texte: compte,
            infobulle: 'Cet hôte n’a joué que ' + e.plays + ' fois sur ' + e.tested + ' essais dans un '
                + 'vrai navigateur. Il peut marcher, mais rarement du premier coup.',
        };
    }
    return null;
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
/* `aDejaJoue` (30 septembre 2026, « le switch se fait vite quand un stream lag ou
   buffer, mais c'est normal que ça arrive des fois ») : la source a joué dans CETTE tuile.
   Son silence est alors un hoquet. On la recharge avec ses essais entiers, même quand la
   tuile parcourait la liste. On ne passe à une autre source qu'APRÈS ces essais, et
   seulement s'il en reste une : la tuile s'est arrêtée et ne revient pas. Avant, elle
   restait noire avec pour seule issue le bouton ⏭. */
export function actionSansVideo(essais, resteDesSources, essaisMax, aDejaJoue) {
    var max = essaisMax || ESSAIS_PAR_SOURCE;
    if (aDejaJoue) max = Math.max(max, ESSAIS_PAR_SOURCE);
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

   Mais deux rechargements par tranche de dix minutes suffisent. Au-delà, démonter la
   page ne fait que couper un flux qui aurait pu revenir seul. Le compte repart à zéro
   quand la fenêtre est passée, pas parce que la vidéo a tenu deux minutes. Rend
   `{ autorisee, reprises }` : le nouveau compte à ranger sur la tuile. Le second
   argument est l'âge de la fenêtre en cours, en millisecondes. */
export var REPRISES_PAR_SOURCE = 2;
export var FENETRE_REPRISE_MS = 10 * 60 * 1000;
/* Deux changements de source automatiques par tuile. Le bouton ⏭ n'est pas compté. */
export var BASCULES_AUTO_MAX = 2;
export function budgetReprise(reprises, ageFenetreMs, maxReprises, fenetreMs) {
    var max = maxReprises || REPRISES_PAR_SOURCE;
    var fenetre = (fenetreMs == null) ? FENETRE_REPRISE_MS : fenetreMs;
    var n = (typeof ageFenetreMs === 'number' && ageFenetreMs >= fenetre) ? 0 : (reprises | 0);
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
   liens n'a pas besoin de cent essais), au plus `total` cibles.

   ÉPROUVER CE QUE L'APPLICATION MONTRERA EN PREMIER (24 octobre 2026, « faut vraiment
   réfléchir à comment optimiser que les meilleurs streams soient les premiers »). Mesuré
   ce jour-là : un passage n'éprouve que ~88 cibles dans son budget, et il les prenait
   dans l'ordre de COLLECTE des liens ; 18 d'entre elles (20 %) portaient sur des hôtes
   déjà jugés morts (`hoteTranche`), 8 seulement sur des hôtes incertains. Avec
   `opts.ledger` (et `opts.sources`), les liens de chaque match sont pris dans l'ordre
   du classement (palier, puis réputation, comme sortFluxLinks) — un verdict sur le
   premier lien affiché vaut plus qu'un verdict sur le neuvième —, et les liens d'un hôte
   tranché mort passent après toutes les autres cibles : éprouvés seulement s'il reste
   de la place. Sans registre, l'ordre de collecte, comme avant. */
export var TRANCHE_ESSAIS = 20;
export var TRANCHE_TAUX_MORT = 0.1;
export function hoteTranche(entree) {
    var e = entree || {};
    return (e.tested | 0) >= TRANCHE_ESSAIS && (e.plays | 0) / e.tested <= TRANCHE_TAUX_MORT;
}
export function pickTargets(matches, opts) {
    var o = opts || {};
    var perMatch = o.perMatch || 3, perHost = o.perHost || 4, total = o.total || 150;
    var ledger = o.ledger || null, sources = o.sources || null;
    var ordered = (matches || []).map(function (m, i) { return { m: m, i: i }; })
        .filter(function (x) { return x.m && Array.isArray(x.m.streamLinks) && x.m.streamLinks.length; })
        .sort(function (a, b) { return (a.m.rank | 0) - (b.m.rank | 0); });
    // Les candidats de chaque match : dans l'ordre du classement, un par hôte, `perMatch` au plus.
    var parMatch = ordered.map(function (x) {
        var liens = x.m.streamLinks;
        var idx = liens.map(function (l, k) { return k; });
        if (ledger) idx.sort(function (a, b) {
            var d = playabilityScore(liens[b], ledger) - playabilityScore(liens[a], ledger);
            if (d) return d;
            return (reputationLien(liens[b], ledger, sources) - reputationLien(liens[a], ledger, sources)) || (a - b);
        });
        var vus = {}, c = [];
        for (var j = 0; j < idx.length && c.length < perMatch; j++) {
            var l = liens[idx[j]];
            if (!l || !l.url) continue;
            var target = tileTarget(l), host = hostOfUrl(target);
            if (!host || vus[host]) continue;
            vus[host] = true;
            c.push({ matchIndex: x.i, linkIndex: idx[j], target: target, host: host, rank: x.m.rank | 0, lien: l });
        }
        return c;
    });
    /* Sans registre : match après match, comme avant. Avec : EN LARGEUR — le premier lien
       affiché de chaque match, puis le deuxième… —, et dans chaque tour les plus
       incertains d'abord (p·(1−p) sur la réputation : un hôte à 50 % apprend plus qu'un
       hôte à 95 %). Un budget de ~88 cibles couvrait sinon les trente premiers matchs de
       la liste, trois liens chacun, et laissait les trois cents autres sans un essai. */
    var file = [];
    if (!ledger) parMatch.forEach(function (c) { file = file.concat(c); });
    else {
        for (var tour = 0; tour < perMatch; tour++) {
            var ceTour = [];
            parMatch.forEach(function (c) { if (c[tour]) ceTour.push(c[tour]); });
            ceTour.forEach(function (c) { var p = reputationLien(c.lien, ledger, sources); c.incertitude = p * (1 - p); });
            ceTour.sort(function (a, b) { return (a.rank - b.rank) || (b.incertitude - a.incertitude); });
            file = file.concat(ceTour);
        }
    }
    var hostCount = {}, out = [], plusTard = [];
    file.forEach(function (c) {
        if ((hostCount[c.host] | 0) >= perHost) return;
        hostCount[c.host] = (hostCount[c.host] | 0) + 1;
        var cible = { matchIndex: c.matchIndex, linkIndex: c.linkIndex, target: c.target, host: c.host };
        if (ledger && hoteTranche(ledger[c.host])) plusTard.push(cible);
        else out.push(cible);
    });
    return out.concat(plusTard).slice(0, total);
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

/* LES LIENS MORTS NE SONT PAS PUBLIÉS (9 octobre 2026).

   « Si on a plus de domaines qui feedent, si on peut juste ne pas ramasser les mauvais
   liens, pas nécessairement les gérer à même l'app. » Le classement (`sortFluxLinks`) et
   la bascule de la tuile savent déjà passer un lien qui ne joue pas ; mais chaque source
   ajoutée apporte son lot de lecteurs qui ne jouent JAMAIS, et la liste s'allonge d'autant.
   Relevé ce jour-là sur le cache : 52 hôtes à zéro lecture sur au moins trois essais, et
   483 liens « Follow the guide » vers une page de VPN (imgcdnngx.com, 403, 0 sur 31).

   On écarte donc, au moment d'écrire data/streams.json, le lien dont l'hôte a été chargé
   `SEUIL_HOTE_MORT` fois dans un vrai navigateur sans qu'aucune vidéo n'arrive. Ce qui
   n'est PAS écarté :

   - un lien vu lui-même en train de jouer (`verified === 'plays'`) ;
   - un hôte de SOURCE (`estSource`) : c'est une page de match, la porte de secours vers
     les lecteurs, pas un lecteur ;
   - un lien `topLevel` (ouvert dans un onglet) dont l'hôte répond : la vérification le
     charge dans un cadre, qu'il refuse — elle ne dit donc rien de ce qu'il fait dans un
     onglet. Il n'est écarté que si la page elle-même répond en erreur ou est injoignable
     (`politique[hote].status >= 400`, ou `embeddable === null`).

   Un hôte écarté peut revenir : il est rendu avec UN lien témoin (`hotes[h].echantillon`),
   que `verify_players.mjs` continue d'éprouver (`ciblesDeRehabilitation`). Une seule lecture
   observée, et `plays` cesse d'être nul : ses liens reviennent au passage suivant.

   **Ce que le serveur ne peut pas atteindre n'est pas mort** (26 octobre 2026, « ya pas
   moyen que l'application en direct du browser humain trouve les liens ? »). La
   vérification tourne sur les machines de GitHub, que plusieurs sites bloquent : foxiy.st
   et fxtrend.st (les lecteurs de Methstreams) et gooz.aapmains.net (MyBuffstreams) y sont
   « injoignables » et répondent 200 ailleurs ; les miroirs Streameast rendent un 403 de
   défi Cloudflare. Zéro lecture en quarante essais ne dit alors rien du lien : il était
   pourtant retiré, et avec lui des sources entières. `nonVerifiableDepuisServeur(politique)`
   reconnaît ces hôtes (injoignable sans que le nom soit inconnu, ou page de défi) ; leurs
   liens restent publiés, marqués `nonVerifiable`, sans verdict, et c'est l'APPAREIL qui
   tranche : `playabilityScore`, `reputationLien`, `rangNotoriete` et `marqueJouabilite`
   n'y regardent que la part de l'appareil (« à essayer », puis « ici p/n »), jamais le
   registre du serveur. Un hôte dont le nom n'existe plus (ENOTFOUND) reste mort. */
export var SEUIL_HOTE_MORT = 8;

/* Une page de défi (Cloudflare « Just a moment… », « Attention Required ») servie en 403
   ou 503 : le site bloque l'adresse, il ne dit rien du lecteur. `entetes` : un objet
   Headers (`get`) ou un dictionnaire. */
export function estPageDeDefi(texte, entetes) {
    var cf = '';
    if (entetes) {
        if (typeof entetes.get === 'function') cf = entetes.get('cf-mitigated') || '';
        else cf = entetes['cf-mitigated'] || '';
    }
    if (/challenge/i.test(String(cf))) return true;
    return /just a moment|cf-chl|cf-browser-verification|challenge-platform|attention required|checking your browser|__cf_chl/i.test(String(texte || '').slice(0, 20000));
}
export function nonVerifiableDepuisServeur(p) {
    if (!p) return false;
    if (p.defi) return true;
    if (p.embeddable === null && !/ENOTFOUND|getaddrinfo|EAI_AGAIN/i.test(String(p.reason || ''))) return true;
    return false;
}

/* Dans le navigateur : la relecture d'une page de match ramène aussi des liens d'hôtes
   que le serveur sait morts (il peut les joindre et n'y a jamais vu jouer). Mesuré le
   26 octobre 2026 sur un match NFL : 61 liens taifood-blog.asia sur 66. `hotesEcartes`
   est celui de data/streams.json. Pure. */
export function filtrerHotesEcartes(links, hotesEcartes) {
    if (!Array.isArray(links) || !hotesEcartes || typeof hotesEcartes !== 'object') return links;
    return links.filter(function (l) {
        var h = l && l.url ? hostOfUrl(tileTarget(l)) : '';
        return !(h && hotesEcartes[h]);
    });
}

export function hoteMort(entree, seuil) {
    var s = seuil || SEUIL_HOTE_MORT;
    return !!entree && (entree.tested | 0) >= s && (entree.plays | 0) === 0;
}

export function ecarterLiensMorts(matches, ledger, opts) {
    var o = opts || {};
    var politique = o.politique || {};
    var hotes = {};
    var hotesNonVerifiables = {};
    var retires = 0;
    var nonVerifiables = 0;
    (matches || []).forEach(function (m) {
        if (!m || !Array.isArray(m.streamLinks)) return;
        m.streamLinks = m.streamLinks.filter(function (l) {
            if (!l || !l.url) return true;
            if (l.verified === 'plays') return true;
            var h = hostOfUrl(tileTarget(l));
            if (!h) return true;
            if (typeof o.estSource === 'function' && o.estSource(h)) return true;
            var e = ledger && ledger[h];
            if (!hoteMort(e, o.seuil)) return true;
            var pol = politique[h] || politique[h.replace(/^v2\./, '')];
            if (nonVerifiableDepuisServeur(pol)) {
                l.nonVerifiable = true;
                delete l.verified; delete l.verifiedAt;
                nonVerifiables++;
                hotesNonVerifiables[h] = (hotesNonVerifiables[h] | 0) + 1;
                return true;
            }
            if (l.topLevel) {
                var p = pol;
                var pageMorte = !!p && (p.embeddable === null || (p.status | 0) >= 400);
                if (!pageMorte) return true;
            }
            var r = hotes[h] || (hotes[h] = { liens: 0, echantillon: l.url, tested: e.tested | 0, plays: 0 });
            r.liens++;
            retires++;
            return false;
        });
    });
    return { retires: retires, hotes: hotes, nonVerifiables: nonVerifiables, hotesNonVerifiables: hotesNonVerifiables };
}

/* Témoins des hôtes écartés à éprouver pendant un passage : au plus `max`, le moins
   récemment essayé d'abord (jamais essayé en tête), puis par nom pour que deux passages
   rendent le même ordre. Sans cela, un hôte écarté ne serait plus jamais chargé, et ne
   pourrait plus jamais revenir. */
export function ciblesDeRehabilitation(ecartes, max) {
    var n = max == null ? 6 : max;
    return Object.keys(ecartes || {})
        .filter(function (h) { return ecartes[h] && ecartes[h].echantillon; })
        .sort(function (a, b) {
            var ta = Date.parse(ecartes[a].essaiAt || '') || 0, tb = Date.parse(ecartes[b].essaiAt || '') || 0;
            if (ta !== tb) return ta - tb;
            return a < b ? -1 : (a > b ? 1 : 0);
        })
        .slice(0, n)
        .map(function (h) { return { host: h, target: ecartes[h].echantillon, ecarte: true }; });
}

/* RÉPUTATION CONTINUE (9 octobre 2026, « tu peux utiliser la réputation des sites pour
   classer l'ordre d'apparition des streams ? »).

   `playabilityScore` range les liens en cinq paliers. Le palier 1 mélangeait ce qu'on
   savait et ce qu'on ignorait : un hôte jamais éprouvé, un hôte qui joue une fois sur
   quatre, un hôte à 9 sur 32 — tous au même rang, départagés ensuite par la seule
   qualité ANNONCÉE. Cette fonction rend un taux de lecture estimé, de 0 à 1, qui sert à
   ordonner À L'INTÉRIEUR d'un palier :

   - l'hôte d'abord, si on l'a éprouvé : (lectures + 4·p) / (essais + 4), p = 1/3 — un
     a priori d'une lecture sur trois qui pèse comme quatre essais, et empêche un 1 sur 1
     chanceux (0,47) de passer devant un 17 sur 34 éprouvé (0,48) ;
   - sinon la SOURCE qui a fourni le lien (l'agrégateur : ppv, daddylive, fbstream…),
     même formule sur ce que ses liens ont donné : une source dont les lecteurs jouent
     souvent fait passer ses hôtes inconnus devant ceux d'une source qui ne livre que des
     pages mortes ;
   - sinon l'a priori seul, 1/3.

   Un lien vu jouer vaut 1. Pure : registres reçus en arguments. */
export var REPUTATION_A_PRIORI = 1 / 3;
var POIDS_A_PRIORI = 4;

function tauxLisse(e) {
    if (!e || (e.tested | 0) <= 0) return null;
    return ((e.plays | 0) + POIDS_A_PRIORI * REPUTATION_A_PRIORI) / ((e.tested | 0) + POIDS_A_PRIORI);
}

export function reputationLien(link, ledger, sources) {
    if (!link) return 0;
    var eh = ledger && ledger[hostOfUrl(tileTarget(link))];
    if (link.nonVerifiable) {
        var ta = tauxLisse(entreeAppareil(eh));
        return ta !== null ? ta : REPUTATION_A_PRIORI;
    }
    if (link.verified === 'plays' && !(eh && eh.appareilMort)) return 1;
    var hote = tauxLisse(eh);
    if (hote !== null) return hote;
    var source = tauxLisse(sources && link.source ? sources[link.source] : null);
    if (source !== null) return source;
    return REPUTATION_A_PRIORI;
}

/* La réputation de chaque SOURCE déduite du registre des hôtes, quand le registre par
   source n'existe pas encore (premiers passages) : pour chaque source, la somme des
   essais et des lectures des hôtes DISTINCTS vers lesquels pointent ses liens. Un hôte
   compte une fois par source, quel que soit le nombre de ses liens — sinon une source
   qui pose cinquante liens sur le même hôte mort pèserait cinquante fois son verdict. */
export function reputationParSource(matches, ledger) {
    var vus = {}, out = {};
    (matches || []).forEach(function (m) {
        ((m && m.streamLinks) || []).forEach(function (l) {
            if (!l || !l.source) return;
            var h = hostOfUrl(tileTarget(l));
            var e = h && ledger && ledger[h];
            if (!e || (e.tested | 0) <= 0) return;
            var cle = l.source + '|' + h;
            if (vus[cle]) return;
            vus[cle] = true;
            var t = out[l.source] || (out[l.source] = { tested: 0, plays: 0 });
            t.tested += e.tested | 0;
            t.plays += e.plays | 0;
        });
    });
    return out;
}

/* LA NOTORIÉTÉ DES SITES (25 octobre 2026, « prioriser de mettre en premier les flux des
   sites les plus célèbres pour être fiables »).

   Rang 1 : les sites connus qui servent leur propre lecteur, sur leur propre CDN
   (Streamed et son lecteur embed.st, DaddyLive et dlive.sx). Rang 2 : les noms connus
   qui ont aussi leurs lecteurs. Rang 3 : tout le reste, dont les agrégateurs (Sportsurge,
   Footybite…) qui renvoient vers des hôtes pris au hasard, même quand leur nom est connu.
   Le rang se lit sur la SOURCE du lien, ou sur son hôte quand celui-ci est le lecteur
   d'un site connu (un agrégateur qui pointe vers embed.st donne un lien de Streamed).
   `sortFluxLinks` (js/config.js) l'applique après les choix de l'utilisateur et le palier
   de jouabilité (un lien vu jouer passe devant un nom connu), avant la réputation. */
export var NOTORIETE_SOURCES = {
    streamed: 1, daddylive: 1,
    methstreams: 2, streameast: 2, totalsportek: 2, crichd: 2, cdnlivetv: 2, vipleague: 2, mybuffstreams: 2
};
export var NOTORIETE_HOTES = {
    'embed.st': 1, 'streamed.su': 1, 'streamed.pk': 1, 'streamed.buzz': 1, 'dlive.sx': 1,
    'cdnlivetv.tv': 2, 'vipleague.vg': 2
};
export var RANG_INCONNU = 3;
/* Un nom connu ne protège pas une source qui, éprouvée, ne joue jamais : `sources` est le
   registre par source (sourcePlayLedger). Ni un HÔTE mesuré mauvais (26 octobre 2026, « le
   pourcentage de streams qui marchent est vraiment plus bas ») : embed.st, rang 1, était
   à 1 lecture sur 38 au registre du serveur et passait quand même en tête de 26 matchs
   sur 287, devant des liens jamais éprouvés ; sondé ce jour-là, rien n'y jouait en 20 s.
   `ledger` est le registre par hôte (playLedger) : dès `ESSAIS_SANS_LECTURE` essais, un
   taux sous `TAUX_NOTORIETE_MIN` fait perdre le rang, et la réputation décide. */
export var ESSAIS_SANS_LECTURE = 10;
export var TAUX_NOTORIETE_MIN = 0.2;

export function rangNotoriete(link, sources, ledger) {
    if (!link) return RANG_INCONNU;
    var src = link.source ? String(link.source).toLowerCase() : '';
    var e = src && sources ? sources[src] : null;
    if (e && (e.tested | 0) >= ESSAIS_SANS_LECTURE && (e.plays | 0) === 0) return RANG_INCONNU;
    var hote = hostOfUrl(link.url);
    var eh = ledger && ledger[hote];
    if (!link.nonVerifiable && eh && (eh.tested | 0) >= ESSAIS_SANS_LECTURE && (eh.plays | 0) / eh.tested < TAUX_NOTORIETE_MIN) return RANG_INCONNU;
    if (eh && eh.appareilMort) return RANG_INCONNU;
    var parHote = NOTORIETE_HOTES[hote];
    var parSource = src ? NOTORIETE_SOURCES[src] : undefined;
    return Math.min(parHote || RANG_INCONNU, parSource || RANG_INCONNU);
}

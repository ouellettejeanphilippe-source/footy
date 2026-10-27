import { fetchPage } from './utils.js';
import { DEFAULT_LEAGUES, OTHER_LEAGUES, teamColorPair } from './db.js';
import { PROXIES } from './config.js';
import { S, favTeams, sourcesStatus, scrapeLogs, manualStreamLogs, customLgOrder, setCustomLgOrder } from './state.js';
import { esc, showToast, escJs, applyFilter, resolveStreamUrl, safeStorageGetJSON, safeStorageSetJSON, safeStorageGet, safeStorageSet, showPage, syncNavState, tailleStockageKo, plusGrossesCles } from './utils.js';
import { fetchGameStats, renderScorersHtml, formatStatLabel } from './api.js';
import { getOriginalMatchId, QI, QC, userPrefs, closeMod, buildEPG } from './ui.js';
import { sortFluxLinks, getDomain, domainPrefs, toggleDomainPref, notePlayability, playLedger, isLiveNow, startsWithin } from './config.js';
import { nextLinkAfter, hostOfUrl, tileTarget, patienceMs, playabilityScore, actionSansVideo, arretMeriteRechargement, essaisPourSource, budgetReprise, FENETRE_REPRISE_MS, BASCULES_AUTO_MAX, sautManuelEstEchec, OUBLI_APPAREIL_MS } from './playability.js';
import { estManifeste, retenirMediaDirect, mediaDirectPour, noterEchecDirect, aProposer, chargeurParPont, refererPourDirect, origineDe, verdictSonde, SONDE_VALIDE_MS } from './directmedia.js';
import { pluginNatif, referersPour, diagnosticAndroidHtml, surTeleAndroid } from './tele.js';
import { BIBLIOTHEQUES, typeDeMedia, configHls, decisionErreurHls, relanceAutorisee, RELANCES_MAX, DELAI_STAGNATION_MS, PERMISSIONS_CADRE } from './lecteurdirect.js';
import { noterMesure, mesurePour, formaterMesure } from './debit.js';
import { scrapeMatchFlux, compterFluxUtiles, doitRafraichirTuile, INTERVALLE_TUILE_MS, getEmbedRegistry } from './scrapers.js';
import { loadAll, loadPrefetchedStreams } from './main.js';
import { initEmbedBridge, getBridgeStatus, waitForBridge, lireOctetsViaPont } from './embed-bridge.js';
import { etatProtection, doitProposerGuide, GUIDE_VU, VERSION_SCRIPT, VERSION_EXTENSION, telechargerExtension } from './installation.js';
import { ouvrirMenu, fermerMenus, menuEstOuvert } from './mv-menu.js';
import { brancherManette, tuileVoisine } from './manette.js';
import { detecterGeste, actionDuGeste, chainesDisponibles, chaineVoisine, indexDeChaine, lienVoisin, etiquetteChaine, liensCable, lienJouable } from './cable.js';
import { etatCacheServeur, ageEnClair } from './rattrapage.js';
import { ecranDeTuile, placementSecondEcran, ecranSecondaire, optionsFenetre, partPremierEcran } from './deuxecrans.js';
import { estLecteurOfficiel } from './esports.js';
import { noterSortie, marquerQuittee, noterRetour, noterBlocage, sortiesHtml } from './sorties.js';
import { ETAT_TAMPON, estTampon, tamponPossible, decisionRetour, BALAYAGE_MS } from './tampon.js';

/* ══ MULTIVISION (SPLIT SCREEN) ═════════ */

/* Le pont du script utilisateur s'annonce de lui-même : on ouvre l'écoute dès le
   chargement du module pour ne pas rater son bonjour. */
initEmbedBridge();

/* Passerelle des documents reconstruits : ils vivent à notre origine et viennent y
   chercher de quoi reconstruire À LEUR TOUR leurs iframes imbriquées. Sans cela,
   X-Frame-Options reprend la main un cran plus bas et l'écran « Firefox Can't Open This
   Page » revient à l'intérieur de la tuile. Rien à installer côté utilisateur : le pont
   rend le téléchargement plus fiable, les proxys CORS prennent le relais à défaut. */

/* Demande au script utilisateur de ne garder que le lecteur dans cette tuile.

   Le script sait le faire depuis toujours, mais il cherchait le lecteur tout seul et
   renonçait au bout de 15 secondes. Sur ces sites le lecteur arrive au bout d'une chaîne
   d'iframes, parfois bien plus tard — certains annoncent « stream will go live 30 minutes
   before the match starts ». La tuile gardait alors tout le décor du site autour de la
   vidéo : bandeau, boutons, avis.

   L'application, elle, SAIT quand la tuile vient de charger et quand l'utilisateur vient
   de lever le bac à sable. Elle le dit, plutôt que de laisser le script deviner. On
   redemande quelques fois après le chargement, parce que le lecteur apparaît souvent
   après le `load` du document hôte ; au-delà, c'est l'observateur du script qui prend le
   relais, sans coût tant que rien n'arrive.

   `postMessage` traverse l'origine croisée, contrairement à tout accès au contenu : c'est
   la seule chose que l'application puisse adresser à la page. Le script n'obéit qu'à la
   fenêtre qui l'encadre, et « nettoyer » ne divulgue rien. */
function demanderNettoyage(iframe) {
    var envoyer = function() {
        posterATuile(iframe, 'mv_clean');
    };
    iframe.addEventListener('load', function() {
        envoyer();
        var n = 0;
        var rappel = setInterval(function() {
            if (++n > 6 || !iframe.isConnected) { clearInterval(rappel); return; }
            envoyer();
        }, 2000);
    });
}

/* Le bouton de levée du bac à sable par domaine (🛡️/🔓) a été retiré le 5 septembre
   2026 à la demande de l'utilisateur : « sandbox chié toujours » — le geste ne réglait
   rien, le refus venant d'un script de la page imbriquée qu'on ne peut pas plus
   contourner en levant le bac à sable qu'en le gardant. Voir js/embed-bridge.js. */

/* ─── Lecture directe des flux vidéo bruts ────────────────────────────────────
   `js/extractors.js` reconnaît une adresse `.m3u8` (HLS) comme un candidat plus
   fort qu'un simple lien d'iframe (60 points contre 45) — c'est le format que
   beaucoup de ces sites servent en coulisse. Mais rien, ensuite, ne la traitait
   différemment : le code posait cette adresse en `iframe.src`, et un navigateur
   ne joue pas du HLS brut dans un cadre. La tuile restait noire, silencieusement
   — pas d'erreur, pas de bandeau, juste rien. C'est un flux qui EXISTE et qui ne
   s'affiche jamais, contribuant au sentiment qu'« il devrait y avoir plus de
   streams » alors que l'extraction les avait bel et bien trouvés.

   Un `<video>` natif n'encadre rien : il n'y a pas de X-Frame-Options à
   respecter, pas de bac à sable à poser, aucun script tiers ne s'exécute. C'est
   aussi, à cette occasion, une meilleure réponse à « sandbox toujours cassé » —
   pour tout flux qui se résout en adresse directe, le problème du bac à sable ne
   se pose simplement plus. */
export function estMediaDirecte(url) {
    return /\.(m3u8|mpd|mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(String(url || ''));
}
/* Une bibliothèque de lecture (hls.js, dash.js : js/lecteurdirect.js, BIBLIOTHEQUES),
   chargée à la demande, miroir après miroir : un CDN bloqué ne condamne plus le direct.
   Un échec complet n'est pas retenu — le réseau peut revenir. */
var CHARGEMENTS = {};
function chargerBibliotheque(nom) {
    var b = BIBLIOTHEQUES[nom];
    if (window[b.global]) return Promise.resolve(window[b.global]);
    if (CHARGEMENTS[nom]) return CHARGEMENTS[nom];
    CHARGEMENTS[nom] = new Promise(function(resolve, reject) {
        var essayer = function(i) {
            if (i >= b.adresses.length) { CHARGEMENTS[nom] = null; reject(new Error(nom + ' indisponible')); return; }
            var s = document.createElement('script');
            s.src = b.adresses[i];
            s.onload = function() { if (window[b.global]) resolve(window[b.global]); else essayer(i + 1); };
            s.onerror = function() { s.remove(); essayer(i + 1); };
            document.head.appendChild(s);
        };
        essayer(0);
    });
    return CHARGEMENTS[nom];
}
function chargerHlsJs() { return chargerBibliotheque('hls'); }
/* Rend un `<video>` prêt à jouer `url`, avec les mêmes classe et style que
   l'iframe qu'il remplace — la mise en page (taille, recadrage, glisser-déposer)
   ne fait ainsi aucune différence entre les deux.

   `pont` (voir `pontPourDirect`) fait passer manifeste et segments par le script
   utilisateur, avec le `Referer` du lecteur et sans CORS. hls.js est alors pris même
   quand le navigateur lit le HLS lui-même : le lecteur natif ne laisse pas choisir par
   où passent ses requêtes.
   `entetes` : dans l'APK, les en-têtes du relais (entetesRelais) posés sur chaque requête
   de hls.js ; Android y remplace le `Referer` (RelaisReferer.java).
   `type` : `hls`, `dash` ou `fichier` quand la sonde l'a lu dans les premiers octets
   (js/lecteurdirect.js, typeDeMedia) ; sinon déduit de l'extension.

   Pendant la lecture (25 octobre 2026, « qualité maximale et compatibilité maximale ») :
   - une erreur fatale de hls.js est d'abord REPRISE (decisionErreurHls : décodeur, puis
     codec audio ; réseau relancé si le flux avait joué) et n'est remontée à l'appelant
     qu'ensuite ;
   - un flux qui s'arrête après avoir joué (ré-tampon, réseau muet, `ended` sur un
     direct) est relancé, la même source, au plus RELANCES_MAX fois par OUBLI_RELANCE_MS,
     comme le mode page (armerRepriseTuile) ; au-delà, l'appelant décide ;
   - DASH joue par dash.js (sans pont : dash.js n'a pas de chargeur à remplacer ; les
     en-têtes du relais de l'APK passent par son RequestModifier) ;
   - `detruireLecteur` arrête tout : moteur, minuteurs, décodeur. */
export function creerLecteurVideo(url, surEchec, pont, entetes, type, opts) {
    var o = opts || {};
    var video = document.createElement('video');
    var fini = false;
    var aJoue = false;
    var gere = false;       // hls.js ou dash.js tient la vidéo : ses erreurs passent par lui
    var relancer = null;    // relance la même source, posé par le lecteur choisi
    var minuteur = null;
    var etatRelance = { relances: 0, depuis: Date.now() };
    function arreterVeille() { if (minuteur) { clearTimeout(minuteur); minuteur = null; } }
    var echec = function(raison) {
        if (fini) return;
        fini = true;
        arreterVeille();
        if (typeof surEchec === 'function') surEchec(raison);
    };
    /* Un arrêt après la lecture : on laisse le temps à la vidéo de revenir seule, puis on
       relance la MÊME source tant que le budget le permet. Une pause volontaire (vidéo en
       pause, pas finie) n'est pas un arrêt. */
    function surArret(cause) {
        if (fini || !aJoue || minuteur) return;
        minuteur = setTimeout(function() {
            minuteur = null;
            if (fini || !video.isConnected) return;
            if (video.paused && !video.ended) return;
            var r = relanceAutorisee(etatRelance);
            etatRelance = r.etat;
            if (!r.autorisee) { echec('arrêté (' + cause + ') après ' + RELANCES_MAX + ' relances'); return; }
            if (typeof relancer === 'function') relancer();
        }, o.delaiStagnationMs || DELAI_STAGNATION_MS);
    }
    video._arreter = function() { fini = true; arreterVeille(); };
    video.addEventListener('playing', function() { aJoue = true; arreterVeille(); });
    video.addEventListener('timeupdate', function() { if (!video.paused) arreterVeille(); });
    video.addEventListener('waiting', function() { surArret('attente'); });
    video.addEventListener('stalled', function() { surArret('réseau muet'); });
    video.addEventListener('ended', function() { surArret('fin du flux'); });
    video.addEventListener('error', function() {
        if (gere) return; // hls.js / dash.js rapportent eux-mêmes leurs erreurs
        var code = video.error && video.error.code;
        if (aJoue && typeof relancer === 'function') {
            var r = relanceAutorisee(etatRelance);
            etatRelance = r.etat;
            if (r.autorisee) { relancer(); return; }
        }
        echec('erreur vidéo' + (code ? ' ' + code : ''));
    });
    video.className = 'mv-media mv-video';
    video.style.cssText = 'width:100%;height:100%;border:none;pointer-events:auto;transition:transform 0.15s;object-fit:contain;background:#000;';
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    // La plupart des navigateurs refusent l'autoplay avec le son : coupé par défaut,
    // les contrôles natifs (video.controls = true) laissent l'utilisateur réactiver.
    video.muted = true;

    var genre = type || typeDeMedia(url, '');
    var poserEntetes = entetes ? function(xhr) { Object.keys(entetes).forEach(function(k) { try { xhr.setRequestHeader(k, entetes[k]); } catch (e) {} }); return xhr; } : null;
    if (genre === 'hls' && (pont || entetes || !video.canPlayType('application/vnd.apple.mpegurl'))) {
        chargerHlsJs().then(function(Hls) {
            if (fini) return;
            if (!(Hls && Hls.isSupported())) { video.src = url; return; } // dernier recours : certains navigateurs y arrivent quand même
            var hls = new Hls(configHls({
                tele: surTeleAndroid(),
                loader: pont ? chargeurParPont(pont.lire, { referer: pont.referer }) : null,
                xhrSetup: poserEntetes
            }));
            var etatErreur = { media: 0, reseau: 0, aJoue: false };
            hls.on(Hls.Events.ERROR, function(ev, d) {
                etatErreur.aJoue = aJoue;
                var r = decisionErreurHls(d, etatErreur);
                etatErreur = r.etat;
                if (r.action === 'ignorer') return;
                var code = d && d.response && d.response.code;
                var quoi = String((d && (d.details || d.type)) || 'hls') + (code ? ' HTTP ' + code : '');
                try {
                    if (r.action === 'recoverMedia') hls.recoverMediaError();
                    else if (r.action === 'swapCodec') { hls.swapAudioCodec(); hls.recoverMediaError(); }
                    else if (r.action === 'startLoad') hls.startLoad();
                    else echec(quoi);
                } catch (e) { echec(quoi); }
            });
            relancer = function() {
                try { if (typeof hls.stopLoad === 'function') hls.stopLoad(); hls.startLoad(); } catch (e) { echec('relance impossible'); }
            };
            hls.loadSource(url);
            hls.attachMedia(video);
            video._hls = hls; // pour destruction propre (detruireLecteur)
            gere = true;
        }).catch(function() { if (!fini) video.src = url; });
    } else if (genre === 'dash') {
        chargerBibliotheque('dash').then(function(dashjs) {
            if (fini) return;
            var player = dashjs.MediaPlayer().create();
            if (poserEntetes && typeof player.extend === 'function') {
                player.extend('RequestModifier', function() {
                    return { modifyRequestHeader: poserEntetes, modifyRequestURL: function(u) { return u; } };
                }, true);
            }
            player.on(dashjs.MediaPlayer.events.ERROR, function(e) {
                var err = e && e.error;
                echec('dash ' + String((err && typeof err === 'object') ? (err.code || err.message || '') : (err || '')).trim());
            });
            player.initialize(video, url, true);
            video._dash = player;
            gere = true;
            relancer = function() { try { player.attachSource(url); } catch (e) { echec('relance impossible'); } };
        }).catch(function() { echec('dash.js indisponible'); });
    } else {
        video.src = url; // HLS nativement supporté (Safari/iOS), ou format progressif (mp4, webm…)
        relancer = function() {
            try { video.load(); var p = video.play(); if (p && typeof p.catch === 'function') p.catch(function() {}); } catch (e) {}
        };
    }
    return video;
}
/* Arrête un lecteur vidéo pour de bon : la veille, le moteur (hls.js ou dash.js, qui
   sinon continue de télécharger des segments pour une vidéo qui n'est plus là) et le
   décodeur du navigateur (source retirée, `load()`). À appeler AVANT de vider ou de
   retirer la cellule d'une tuile. */
export function detruireLecteur(video) {
    if (!video) return;
    if (typeof video._arreter === 'function') video._arreter();
    if (video._hls) { try { video._hls.destroy(); } catch (e) {} video._hls = null; }
    if (video._dash) {
        var p = video._dash;
        try { if (typeof p.destroy === 'function') p.destroy(); else if (typeof p.reset === 'function') p.reset(); } catch (e) {}
        video._dash = null;
    }
    try { video.pause(); } catch (e) {}
    try { video.removeAttribute('src'); if (typeof video.load === 'function') video.load(); } catch (e) {}
}
export function detruireLecteursDe(el) {
    if (!el || typeof el.querySelectorAll !== 'function') return;
    Array.prototype.forEach.call(el.querySelectorAll('video.mv-video'), detruireLecteur);
}
/* ─── Mode direct : la deuxième façon d'utiliser un lien (voir js/directmedia.js) ───
   La tuile joue dans son propre <video> le manifeste que le script utilisateur a vu
   passer pendant que la page jouait, sans la page. Si rien ne joue dans les 25 s, ou si
   hls.js rapporte une erreur fatale (CORS, 403, adresse expirée), la tuile revient
   d'elle-même au mode page, retient l'échec, et le dit. */
var DELAI_DIRECT_MS = 25000;
function registreDirect() { return safeStorageGetJSON('direct_media', {}) || {}; }
/* Le pont du script utilisateur pour ce manifeste, s'il sait lire en binaire (≥ 1.14,
   sous un gestionnaire de scripts) ; null sinon, et hls.js lit lui-même, ce que les CDN
   de ces flux refusent presque tous (js/directmedia.js, chargeurParPont). */
/* « Le mode direct… ça part en mode câble sur ma télé » ; « y marche pas à date, et ça
   chie avec le reste du UI » (25 octobre 2026). Dans l'APK, le flux direct joue dans sa
   tuile, comme sur le site, par hls.js ; il n'ouvre plus le lecteur natif plein écran.
   Ce qui le rend possible : Capacitor fait passer les requêtes de la page par le réseau
   d'Android (CapacitorHttp, adresse « /_capacitor_http_interceptor_ »), sans CORS, et
   Android y pose le `Referer` que porte l'en-tête `X-Footy-Referer` (RelaisReferer.java,
   appelé par BloqueurWebViewClient) — ce qu'aucune page ne sait faire elle-même. */
export var ENTETE_RELAIS_REFERER = 'X-Footy-Referer';
export var ENTETE_RELAIS_ORIGINE = 'X-Footy-Origin';
function relaisApk() { return !!pluginNatif(); }
export function entetesRelais(media) {
    var ref = refererPourDirect(media);
    var h = {};
    h[ENTETE_RELAIS_REFERER] = ref;
    h[ENTETE_RELAIS_ORIGINE] = origineDe(ref);
    return h;
}

function pontPourDirect(media) {
    var pont = (typeof getBridgeStatus === 'function') ? getBridgeStatus() : null;
    if (!pont || !pont.available || !pont.binaire) return null;
    return { lire: lireOctetsViaPont, referer: refererPourDirect(media) };
}
/* Le bouton ▶ direct n'est montré qu'après avoir lu le manifeste depuis CE navigateur
   (js/directmedia.js, « Vérifier avant de proposer »). `sondesDirect` : { adresse du
   manifeste: { ok, at, raison, enCours } }, en mémoire seulement : un verdict dépend du
   réseau et du moment. */
var sondesDirect = {};
export function etatSondesDirect() { return sondesDirect; }
function texteDebut(octets) {
    try { return new TextDecoder().decode(new Uint8Array(octets).slice(0, 64)); } catch (e) { return ''; }
}
/* Le chemin qu'une lecture prendrait maintenant : un verdict obtenu par l'autre ne vaut
   plus (le script qui s'annonce après coup avec la lecture binaire). */
function cheminDirect(media) { return pontPourDirect(media) ? 'pont' : (relaisApk() ? 'relais' : 'fetch'); }
function finSonde(media, ok, raison, chemin, type) {
    sondesDirect[media.url] = { ok: ok, at: Date.now(), raison: raison || '', chemin: chemin, type: type || '' };
    mvFlux.forEach(function(f, i) {
        var m = f && (f._media || mediaDirectPour(registreDirect(), f.url));
        if (m && m.url === media.url) rafraichirPastille(i);
    });
}
function sonderDirect(media) {
    var so = sondesDirect[media.url];
    var chemin = cheminDirect(media);
    if (so && so.chemin === chemin && (so.enCours || Date.now() - so.at < SONDE_VALIDE_MS)) return;
    sondesDirect[media.url] = { enCours: true, at: Date.now(), chemin: chemin };
    var pont = pontPourDirect(media);
    var lecture = pont
        ? lireOctetsViaPont(media.url, { referer: pont.referer, origine: origineDe(pont.referer), timeoutMs: 8000 }).then(function(r) { return { status: r.status, debut: texteDebut(r.octets) }; })
        : fetch(media.url, { credentials: 'omit', headers: relaisApk() ? entetesRelais(media) : undefined }).then(function(r) { return r.text().then(function(x) { return { status: r.status, debut: x.slice(0, 64) }; }); });
    lecture.then(function(r) {
        var v = verdictSonde(r.status, r.debut);
        finSonde(media, v.ok, v.raison, chemin, typeDeMedia(media.url, r.debut));
    }, function(e) {
        finSonde(media, false, (e && e.status) ? 'HTTP ' + e.status : (pont ? ((e && e.message) || 'refus') : 'refusé par le navigateur (CORS)'), chemin);
    });
}
/* Le bouton ▶ direct de cette tuile est-il à montrer ? En mode direct, oui toujours : c'est
   lui qui ramène à la page. Sinon, la sonde dit si le flux répond par le chemin que
   prendra la lecture (le pont du script, le relais de l'APK, ou fetch). */
function directDisponible(s) {
    if (s && s.mode === 'direct') return true;
    var media = s && (s._media || mediaDirectPour(registreDirect(), s.url));
    if (!media) return false;
    var so = sondesDirect[media.url];
    if (so && !so.enCours && so.chemin === cheminDirect(media) && Date.now() - so.at < SONDE_VALIDE_MS) return so.ok;
    sonderDirect(media);
    return false;
}

/* Le script qui s'annonce (ou se ré-annonce avec la lecture binaire) change le chemin
   d'une lecture : les boutons ▶ direct sont réévalués. */
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('mvBridgeReady', function() { mvFlux.forEach(function(f, i) { rafraichirPastille(i); }); });
}

function poserDirect(media, url, container, cell, s) {
    detruireLecteursDe(container);
    container.innerHTML = '';
    var pont = pontPourDirect(media);
    var entetes = (!pont && relaisApk()) ? entetesRelais(media) : null;
    s._currentUrl = url;
    s._playing = false;
    var idx = parseInt(cell.dataset.index, 10);
    var fini = false;
    var versPage = function(raison) {
        if (s._currentUrl !== url || s.mode !== 'direct') return;
        safeStorageSetJSON('direct_media', noterEchecDirect(registreDirect(), url));
        sondesDirect[media.url] = { ok: false, at: Date.now(), raison: raison, chemin: cheminDirect(media) };
        s.mode = 'page';
        s._currentUrl = null;
        s._playing = false;
        showToast('Direct refusé (' + raison + ') : retour à la page'
            + ((pont || entetes) ? '' : ' — le script utilisateur à jour (1.14, Tampermonkey) fait passer le direct'));
        saveMultivisionState();
        updateMultivisionLayout();
    };
    /* Refusé dans la tuile : dans l'APK, le lecteur d'Android a sa chance (poserDirectNatif),
       puis seulement la page. */
    var revenir = function(raison) {
        if (fini) return;
        fini = true;
        if (s._currentUrl !== url || s.mode !== 'direct') return;
        var natif = entetes ? pluginNatif() : null;
        if (natif) {
            detruireLecteur(video);
            container.innerHTML = '';
            showToast('Direct refusé dans la tuile (' + raison + ') : essai au lecteur d\'Android');
            poserDirectNatif(natif, media, url, container, s, idx, function(r) { versPage(r + ', lecteur d\'Android compris'); });
            return;
        }
        versPage(raison);
    };
    var sonde = sondesDirect[media.url];
    var video = creerLecteurVideo(media.url, revenir, pont, entetes, sonde && sonde.type);
    video.id = 'mv-iframe-' + idx;
    video.style.transform = s.cropped ? 'scale(1.15)' : 'scale(1)';
    video.addEventListener('playing', function() {
        if (s._currentUrl !== url) return;
        fini = true;
        s._playing = true;
        rafraichirPastille(idx);
    });
    container.appendChild(video);
    setTimeout(function() { if (!s._playing) revenir('rien en ' + Math.round(DELAI_DIRECT_MS / 1000) + ' s'); }, DELAI_DIRECT_MS);
}

/* ─── Le lecteur natif d'Android, en repli (APK de mobile/, js/tele.js) ───
   « Je suis pas fermé au lecteur natif… S'il marche, c'est ça l'important » (25 octobre
   2026). Le direct joue d'abord dans la tuile (poserDirect) ; s'il y échoue, l'APK
   essaie le lecteur d'Android (LecteurNatifPlugin → LecteurActivity, ExoPlayer, plein
   écran) avant de revenir à la page. Il essaie les `Referer` de `referersPour` et lit
   les segments déguisés en image. La tuile garde sa place et montre de quoi le
   relancer. Dans le lecteur natif, ◀▶ change de source (`changerSourceTuile`) ; ▲▼ ne
   zappe plus de match (« ça part en mode câble »). Quand plus aucun `Referer` ne passe,
   il le dit (`echec`) et la tuile revient à la page. */
var natifCourant = null;    // { s, url, idx, revenir } : la tuile que joue le lecteur natif
var natifEcoute = false;
function ecouterNatif(natif) {
    if (natifEcoute || typeof natif.addListener !== 'function') return;
    natifEcoute = true;
    natif.addListener('evenement', function(ev) {
        var c = natifCourant;
        if (!c || !ev || mvFlux[c.idx] !== c.s || c.s._currentUrl !== c.url) return;
        if (ev.type === 'joue') { c.s._playing = true; rafraichirPastille(c.idx); }
        else if (ev.type === 'echec') { natifCourant = null; c.revenir(ev.raison || 'lecteur natif'); }
        else if (ev.type === 'source') changerSourceTuile(c.idx, ev.sens < 0 ? -1 : 1);
    });
}
function poserDirectNatif(natif, media, url, container, s, idx, revenir) {
    ecouterNatif(natif);
    natifCourant = { s: s, url: url, idx: idx, revenir: revenir };
    var lancer = function() {
        try {
            natif.jouer({
                media: media.url,
                referers: referersPour(media, url),
                titre: s.name || getDomain(url),
                source: getDomain(url)
            });
        } catch (e) { revenir('lecteur natif indisponible'); }
    };
    var bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'mv-natif';
    bouton.textContent = '▶ Reprendre en plein écran';
    bouton.addEventListener('click', function(e) { e.stopPropagation(); natifCourant = { s: s, url: url, idx: idx, revenir: revenir }; lancer(); });
    container.appendChild(bouton);
    lancer();
}
/* Une tuile qui repart sur une PAGE : le lecteur natif, posé par-dessus, la cacherait. */
function fermerNatif() {
    if (!natifCourant) return;
    natifCourant = null;
    var natif = pluginNatif();
    if (natif && typeof natif.fermer === 'function') { try { natif.fermer(); } catch (e) {} }
}


/* Bascule une tuile entre « page » (la page du site, nettoyée par le script) et
   « direct » (le manifeste vidéo dans notre lecteur). Les deux restent à un clic. */
export function toggleDirectMode(idx) {
    var s = mvFlux[idx];
    if (!s) return;
    var media = s._media || mediaDirectPour(registreDirect(), s.url);
    if (s.mode !== 'direct' && !media) { showToast('Aucun flux direct connu pour cette source : laisse la page jouer une fois.'); return; }
    s.mode = (s.mode === 'direct') ? 'page' : 'direct';
    s._currentUrl = null;
    s._playing = false;
    saveMultivisionState();
    updateMultivisionLayout();
    showToast(s.mode === 'direct' ? 'Mode direct : ' + getDomain(media.url) : 'Mode page');
}

/* Remplace `elementActuel` (l'iframe déjà posée) par un lecteur vidéo si `url`
   est une adresse média directe ; sinon ne fait rien. Rend l'élément à utiliser
   pour la suite (le nouveau lecteur, ou `elementActuel` inchangé) — l'appelant
   doit toujours réaffecter sa variable avec ce retour. */
function versVideoSiDirect(elementActuel, url, container) {
    if (!estMediaDirecte(url)) return elementActuel;
    /* Un lien qui EST un manifeste : aucun lecteur connu pour son `Referer`, mais le pont
       lève au moins le refus d'origine. */
    var video = creerLecteurVideo(url, null, pontPourDirect({}));
    /* Le recadrage (`s.cropped`) est appliqué à l'iframe AVANT la résolution du
       tour de passe-passe, quand le lecteur n'arrive qu'après coup — sans quoi le
       remplacement tardif par une vidéo perdrait ce réglage. */
    if (elementActuel && elementActuel.style && elementActuel.style.transform) {
        video.style.transform = elementActuel.style.transform;
    }
    if (elementActuel && elementActuel.parentNode === container) {
        container.replaceChild(video, elementActuel);
    } else {
        container.appendChild(video);
    }
    return video;
}



/* ══ MULTIVIEW GAME MODE ═══════════════ */
export var mvGameModeActive = false;
export var mvGameModeInterval = null;
export var gmCurrentTab = 'stats'; // 'stats' | 'scores'
export var gmPinnedMatches = safeStorageGetJSON('gmPinnedMatches', []);
export var globalStatsInterval = null;
/* Les autres modules ne peuvent pas affecter une liaison importée : ils passent par ce
   setter (même motif que setCustomLgOrder / setLeagueTier). */
export function setGlobalStatsInterval(v) { globalStatsInterval = v; window.globalStatsInterval = v; }
export var activeMvStatsCards = [];

export function toggleMvGameMode() {
    mvGameModeActive = !mvGameModeActive;
    var mvContainer = document.getElementById('mv-container');
    var gmBtn = document.getElementById('mv-gm-btn');

    if (mvGameModeActive) {
        if (gmBtn) {
            gmBtn.style.background = 'rgba(255,69,58,0.2)';
            gmBtn.style.borderColor = 'rgba(255,69,58,0.4)';
            gmBtn.style.color = '#fff';
        }

        // Add stats sidebar to multiview if not present
        if (!document.getElementById('mv-stats-sidebar')) {
            var statsSidebar = document.createElement('div');
            statsSidebar.id = 'mv-stats-sidebar';
            statsSidebar.style.cssText = 'width: 350px; background: rgba(20, 20, 20, 0.95); border-left: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; transition: width 0.15s;';

            var headerHtml = '<div style="display:flex; border-bottom:1px solid rgba(255,255,255,0.1); padding:0;">' +
                             '<button id="gm-tab-stats" class="gm-tab active" onclick="switchGmTab(\'stats\')" style="flex:1; background:none; border:none; color:#fff; padding:15px 0; cursor:pointer; font-weight:bold; border-bottom: 2px solid var(--accent);">Stats du Match</button>' +
                             '<button id="gm-tab-scores" class="gm-tab" onclick="switchGmTab(\'scores\')" style="flex:1; background:none; border:none; color:var(--muted); padding:15px 0; cursor:pointer; font-weight:bold; border-bottom: 2px solid transparent;">Scores Live</button>' +
                             '</div>';

            var contentHtml = '<div id="gm-content-wrapper" style="flex:1; overflow-y:auto; padding:15px;">' +
                              '<div id="mv-stats-content" style="color:var(--muted); font-size:13px; text-align:center; padding-top:20px;">Chargement...</div>' +
                              '<div id="mv-scores-content" style="display:none; color:var(--muted); font-size:13px; text-align:center; padding-top:20px;">Chargement...</div>' +
                              '</div>';

            statsSidebar.innerHTML = headerHtml + contentHtml;

            var gridWrapper = document.getElementById('mv-grid-wrapper');
            if (gridWrapper) {
                gridWrapper.appendChild(statsSidebar);
            }
        } else {
            document.getElementById('mv-stats-sidebar').style.display = 'flex';
            document.getElementById('mv-stats-sidebar').style.width = '350px';
        }

        updateGmCurrentTab();
        if (typeof mvGameModeInterval !== 'undefined' && mvGameModeInterval) clearInterval(mvGameModeInterval);
        mvGameModeInterval = setInterval(updateGmCurrentTab, 300000); // Update every 5m
    } else {
        if (gmBtn) {
            gmBtn.style.background = '';
            gmBtn.style.borderColor = '';
            gmBtn.style.color = '';
        }

        var statsSidebar = document.getElementById('mv-stats-sidebar');
        if (statsSidebar) {
            statsSidebar.style.display = 'none';
            statsSidebar.style.width = '0px';
        }

        if (mvGameModeInterval) {
            clearInterval(mvGameModeInterval);
            mvGameModeInterval = null;
        }
    }
}

export function switchGmTab(tab) {
    gmCurrentTab = tab;

    var tabStats = document.getElementById('gm-tab-stats');
    var tabScores = document.getElementById('gm-tab-scores');
    var contentStats = document.getElementById('mv-stats-content');
    var contentScores = document.getElementById('mv-scores-content');

    if (tab === 'stats') {
        if(tabStats) { tabStats.style.color = '#fff'; tabStats.style.borderBottomColor = 'var(--accent)'; }
        if(tabScores) { tabScores.style.color = 'var(--muted)'; tabScores.style.borderBottomColor = 'transparent'; }
        if(contentStats) contentStats.style.display = 'block';
        if(contentScores) contentScores.style.display = 'none';
        updateMvGameModeStats();
    } else {
        if(tabScores) { tabScores.style.color = '#fff'; tabScores.style.borderBottomColor = 'var(--accent)'; }
        if(tabStats) { tabStats.style.color = 'var(--muted)'; tabStats.style.borderBottomColor = 'transparent'; }
        if(contentScores) contentScores.style.display = 'block';
        if(contentStats) contentStats.style.display = 'none';
        updateGmScoresTab();
    }
}

export function toggleGmPinMatch(matchId, e) {
    if (e) e.stopPropagation();
    matchId = String(matchId);
    var idx = gmPinnedMatches.indexOf(matchId);
    if (idx > -1) {
        gmPinnedMatches.splice(idx, 1);
    } else {
        gmPinnedMatches.push(matchId);
    }
    safeStorageSetJSON('gmPinnedMatches', gmPinnedMatches);
    updateGmScoresTab();
}

export function updateGmScoresTab() {
    if (!mvGameModeActive) return;

    var content = document.getElementById('mv-scores-content');
    if (!content) return;

    var liveMatches = S.matches.filter(function(m) {
        return (m.status === 'live' || gmPinnedMatches.indexOf(String(m.id)) > -1) && (DEFAULT_LEAGUES[(m.league||'').toUpperCase()] || OTHER_LEAGUES[(m.league||'').toUpperCase()]);
    });

    if (liveMatches.length === 0) {
        content.innerHTML = '<div style="padding:20px; text-align:center;">Aucun match en direct pour le moment.</div>';
        return;
    }

    // Sort: Pinned first, then by time/league
    liveMatches.sort(function(a, b) {
        var aPin = gmPinnedMatches.indexOf(String(a.id)) > -1 ? 1 : 0;
        var bPin = gmPinnedMatches.indexOf(String(b.id)) > -1 ? 1 : 0;
        if (aPin !== bPin) return bPin - aPin;
        if (a.league !== b.league) return a.league.localeCompare(b.league);
        return a.startTime.localeCompare(b.startTime);
    });

    var html = '<div style="display:flex; flex-direction:column; gap:10px;">';

    liveMatches.forEach(function(m) {
        var isPinned = gmPinnedMatches.indexOf(String(m.id)) > -1;
        var pinIcon = isPinned ? '📌' : '📍';
        var pinColor = isPinned ? 'var(--accent)' : 'var(--muted)';

        var scoreStr = m.score ? (esc(m.score[0]) + ' - ' + esc(m.score[1])) : 'À venir';
        var timeStr = (m.status === 'live' && m.minute) ? esc(m.minute) + "'" : esc(m.startTime);
        var statusColor = m.status === 'live' ? 'var(--accent)' : 'var(--muted)';

        html += '<div style="background:rgba(255,255,255,0.05); border-radius:8px; padding:10px; display:flex; align-items:center; gap:10px;">';

        html += '<div style="flex:1;">';
        html += '<div style="font-size:11px; color:var(--muted); margin-bottom:4px;">' + esc(m.flag) + ' ' + esc(m.league) + '</div>';

        html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">';
        html += '<div style="font-size:13px; font-weight:bold; color:#fff; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + esc(m.homeTeam) + '</div>';
        html += '<div style="font-size:14px; font-weight:bold; color:' + statusColor + '; min-width:30px; text-align:right;">' + (m.score ? esc(m.score[0]) : '-') + '</div>';
        html += '</div>';

        html += '<div style="display:flex; justify-content:space-between; align-items:center;">';
        html += '<div style="font-size:13px; font-weight:bold; color:#fff; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + esc(m.awayTeam) + '</div>';
        html += '<div style="font-size:14px; font-weight:bold; color:' + statusColor + '; min-width:30px; text-align:right;">' + (m.score ? esc(m.score[1]) : '-') + '</div>';
        html += '</div>';

        html += '<div style="font-size:11px; color:' + statusColor + '; margin-top:4px; text-align:right;">' + timeStr + '</div>';
        html += '</div>'; // End flex:1

        html += '<button onclick="toggleGmPinMatch(\'' + m.id + '\', event)" style="background:none; border:none; cursor:pointer; font-size:16px; color:' + pinColor + '; padding:5px; transition:transform 0.15s;" onmouseover="this.style.transform=\'scale(1.2)\'" onmouseout="this.style.transform=\'none\'" aria-label="Épingler le match" title="Épingler le match">' + pinIcon + '</button>';

        html += '</div>'; // End card
    });

    html += '</div>';
    content.innerHTML = html;
}

export function updateGmCurrentTab() {
    if (gmCurrentTab === 'stats') {
        updateMvGameModeStats();
    } else {
        updateGmScoresTab();
    }
}

export function closePinnedStats(matchId) {
    var idx = activeMvStatsCards.indexOf(String(matchId));
    if (idx > -1) {
        activeMvStatsCards.splice(idx, 1);
        updateMvGameModeStats();
    }
}

export function openPinnedStats(matchId) {
    if (!mvGameModeActive) return;
    var idx = activeMvStatsCards.indexOf(String(matchId));
    if (idx === -1) {
        activeMvStatsCards.push(String(matchId));
    }
    updateMvGameModeStats();
    setTimeout(function() {
        var container = document.getElementById('mv-stats-carousel');
        if (container) {
            container.scrollLeft = container.scrollWidth;
        }
    }, 100);
}

export function updateMvGameModeStats() {
    if (!mvGameModeActive) return;

    var content = document.getElementById('mv-stats-content');
    if (!content) return;

    var pinnedHtml = '';
    if (gmPinnedMatches.length > 0) {
        var pinnedList = gmPinnedMatches.map(function(id) { return S.matchMap.get(String(id)); }).filter(Boolean);
        if (pinnedList.length > 0) {
            pinnedHtml += '<div style="margin-bottom: 15px;">';
            pinnedHtml += '<h4 style="color:#fff; margin-bottom:10px; font-size:14px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">Matchs Épinglés</h4>';
            pinnedHtml += '<div style="display:flex; flex-direction:column; gap:8px;">';
            pinnedList.forEach(function(pm) {
                var scoreStr = pm.score ? (esc(pm.score[0]) + ' - ' + esc(pm.score[1])) : 'À venir';
                var timeStr = (pm.status === 'live' && pm.minute) ? esc(pm.minute) + "'" : esc(pm.startTime);
                var statusColor = pm.status === 'live' ? 'var(--accent)' : 'var(--muted)';
                pinnedHtml += '<div onclick="openPinnedStats(\'' + pm.id + '\')" style="background:rgba(255,255,255,0.05); border-radius:8px; padding:10px; cursor:pointer; transition:background 0.15s;" onmouseover="this.style.background=\'rgba(255,255,255,0.1)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.05)\'">';
                pinnedHtml += '<div style="font-size:11px; color:var(--muted); margin-bottom:4px;">' + esc(pm.flag) + ' ' + esc(pm.league) + '</div>';
                pinnedHtml += '<div style="display:flex; justify-content:space-between; align-items:center;">';
                pinnedHtml += '<div style="font-size:13px; font-weight:bold; color:#fff;">' + esc(pm.homeTeam) + ' - ' + esc(pm.awayTeam) + '</div>';
                pinnedHtml += '<div style="font-size:14px; font-weight:bold; color:' + statusColor + ';">' + scoreStr + '</div>';
                pinnedHtml += '</div>';
                pinnedHtml += '<div style="font-size:11px; color:' + statusColor + '; margin-top:4px; text-align:right;">' + timeStr + '</div>';
                pinnedHtml += '</div>';
            });
            pinnedHtml += '</div></div>';
        }
    }

    var matchCardsToFetch = [];
    var mainMatchId = null;

    if (activeMvIdx !== null && activeMvIdx < mvFlux.length) {
        var activeFlux = mvFlux[activeMvIdx];
        var mainM = S.matchMap.get(String(activeFlux.mid));
        if (mainM) {
            mainMatchId = mainM.id;
            matchCardsToFetch.push(mainM);
        }
    }

    activeMvStatsCards.forEach(function(cid) {
        if (String(cid) !== String(mainMatchId)) {
            var cardM = S.matchMap.get(String(cid));
            if (cardM) {
                matchCardsToFetch.push(cardM);
            }
        }
    });

    if (matchCardsToFetch.length === 0) {
        content.innerHTML = pinnedHtml + '<div style="padding:20px; text-align:center;">Sélectionnez un match (cliquez sur un écran) pour voir les statistiques.</div>';
        return;
    }

    var carouselHtml = '<div id="mv-stats-carousel" style="display:flex; overflow-x:auto; scroll-snap-type: x mandatory; gap:15px; padding-bottom:10px; scrollbar-width: none;">';

    matchCardsToFetch.forEach(function(m) {
        var isMain = String(m.id) === String(mainMatchId);
        carouselHtml += '<div id="mv-stat-card-' + m.id + '" style="min-width: 100%; scroll-snap-align: start; flex: 0 0 100%; position:relative;">';

        if (!isMain) {
            carouselHtml += '<button onclick="closePinnedStats(\'' + m.id + '\')" style="position:absolute; top:0; right:0; background:rgba(255,255,255,0.1); border:none; border-radius:50%; width:24px; height:24px; color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; z-index:10;" aria-label="Fermer" title="Fermer">✕</button>';
        }

        carouselHtml += '<div id="mv-gm-header-' + m.id + '" style="font-size:16px; font-weight:bold; color:#fff; text-align:center; padding: 0 25px;">' + esc(m.homeTeam) + ' vs ' + esc(m.awayTeam) + '</div>';
        carouselHtml += (m.score ? '<div style="font-size:24px; font-weight:bold; color:var(--accent); text-align:center;">' + esc(m.score[0]) + ' - ' + esc(m.score[1]) + '</div>' : '<div style="text-align:center; color:var(--muted);">À venir</div>');
        carouselHtml += '<div style="font-size:12px; color:var(--muted); text-align:center;">' + esc(m.flag) + ' ' + esc(m.league) + ' | ' + esc(m.startTime) + (m.status === 'live' && m.minute ? ' • ' + esc(m.minute) + "\'" : '') + '</div>';

        carouselHtml += '<div id="mv-stat-body-' + m.id + '"><div style="text-align:center; margin-top:20px; color:var(--muted);">Chargement des stats...</div></div>';
        carouselHtml += '</div>';
    });

    carouselHtml += '</div>';
    content.innerHTML = pinnedHtml + carouselHtml;

    // Fetch stats for all cards
    matchCardsToFetch.forEach(function(m) {
        fetchGameStats(m.id).then(function(res) {
            if (!mvGameModeActive || !res.data) return;

            var bodyEl = document.getElementById('mv-stat-body-' + m.id);
            if (!bodyEl) return;

            var html = '';
            var mHomeId = null, mAwayId = null;
            if (res.data && res.data.header && res.data.header.competitions && res.data.header.competitions[0] && res.data.header.competitions[0].competitors) {
                var c = res.data.header.competitions[0].competitors;
                var hC = c.find(function(x) { return x.homeAway === 'home'; });
                var aC = c.find(function(x) { return x.homeAway === 'away'; });
                if(hC) mHomeId = hC.id;
                if(aC) mAwayId = aC.id;
            }

            var hRankFormStr = (res.hRank ? '#' + res.hRank + ' ' : '') + (res.hForm ? '[' + res.hForm + ']' : '');
            var aRankFormStr = (res.aRank ? '#' + res.aRank + ' ' : '') + (res.aForm ? '[' + res.aForm + ']' : '');

            var hdr = document.getElementById('mv-gm-header-' + m.id);
            if (hdr && (hRankFormStr || aRankFormStr)) {
                 hdr.innerHTML = '<div style="display:flex; justify-content:space-between; font-size:11px; color:rgba(255,255,255,0.5); font-weight:normal;">' +
                                 '<span>' + esc(hRankFormStr) + '</span><span>' + esc(aRankFormStr) + '</span></div>' +
                                 '<div>' + esc(m.homeTeam) + ' vs ' + esc(m.awayTeam) + '</div>';
            }

            if (res.scorers && res.scorers.length > 0) {
                html += renderScorersHtml(res.scorers, m, mHomeId, mAwayId);
                html += '<div style="height:15px;"></div>';
            }

            var stats = [];
            if (res.source === 'espn' && res.data.boxscore && res.data.boxscore.teams) {
                var ts = res.data.boxscore.teams;
                if(ts.length === 2 && ts[0].statistics && ts[1].statistics) {
                    var hStats = ts[0].statistics;
                    var aStats = ts[1].statistics;

                    // Always try to put home team on the left, away on the right. Usually ts[0] is home if homeAway == 'home', else we need to swap
                    var hIsTs0 = ts[0].homeAway === 'home';
                    if (ts[0].homeAway !== 'home' && ts[1].homeAway === 'home') hIsTs0 = false;
                    else if (typeof mHomeId !== 'undefined' && mHomeId && ts[0].team && ts[0].team.id === mHomeId) hIsTs0 = true;
                    else if (typeof mHomeId !== 'undefined' && mHomeId && ts[1].team && ts[1].team.id === mHomeId) hIsTs0 = false;

                    var homeStats = hIsTs0 ? ts[0].statistics : ts[1].statistics;
                    var awayStats = hIsTs0 ? ts[1].statistics : ts[0].statistics;

                    homeStats.forEach(function(hStat) {
                        var aStat = awayStats.find(function(s) { return s.name === hStat.name; });
                        if (aStat && hStat.displayValue && aStat.displayValue) {
                            // Only add if there is some value to display to keep it clean, though we could just show all
                            stats.push({
                                label: hStat.name,
                                displayLabel: hStat.label || hStat.displayName || hStat.name,
                                h: hStat.displayValue,
                                a: aStat.displayValue
                            });
                        }
                    });
                }
            }

            if(stats.length > 0) {
                html += '<h4 style="color:#fff;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:4px;">Statistiques</h4>';
                html += '<div style="display:flex;flex-direction:column;gap:8px;background:rgba(255,255,255,0.02);padding:10px;border-radius:12px;">';
                stats.forEach(function(st) {
                    var label = formatStatLabel(st.label);
                    if (!label || label === st.label) label = formatStatLabel(st.displayLabel) || st.displayLabel;
                    html += '<div style="display:flex;justify-content:space-between;font-size:12px;align-items:center;">';
                    html += '<span style="font-weight:bold;width:40px;text-align:left;">'+esc(st.h)+'</span>';
                    html += '<span style="color:var(--muted);flex:1;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="'+esc(label)+'">'+esc(label)+'</span>';
                    html += '<span style="font-weight:bold;width:40px;text-align:right;">'+esc(st.a)+'</span>';
                    html += '</div>';
                });
                html += '</div>';
            }

            bodyEl.innerHTML = html ? '<div style="margin-top:15px;">' + html + '</div>' : '<div style="margin-top:15px; color:var(--muted); text-align:center;">Aucune statistique détaillée disponible.</div>';
        }).catch(function() {
            var bodyEl = document.getElementById('mv-stat-body-' + m.id);
            if (bodyEl) bodyEl.innerHTML = '<div style="margin-top:15px; color:var(--muted); text-align:center;">Erreur lors du chargement des statistiques.</div>';
        });
    });
}

export var mvFlux = [];

/* ══ SORTIE FORCÉE : une page qui fait sauter le cadre ═══════════════════════════════
   « J'ai voulu ajouter un stream dans un match et là, la page me redirect non stop vers
   le stream sur le site externe » (7 septembre 2026). Les iframes de lecteur n'ont plus
   d'attribut `sandbox` (retiré le 5 septembre à la demande de l'utilisateur) : une page
   encadrée peut donc naviguer la fenêtre entière (`top.location = …`, le classique
   « frame busting »). Le Multivision est restauré au chargement (mv_state), la tuile est
   reposée, la page ressort du cadre : boucle sans fin.

   On ne peut pas empêcher cette navigation sans `sandbox`. On peut la RECONNAÎTRE : la
   fenêtre est quittée (`pagehide`) quelques secondes après la pose d'une tuile. On note
   alors les adresses suspectes ; au retour, ces tuiles ne sont pas rechargées mais
   affichent un avertissement avec deux issues — charger quand même, ou ouvrir le site
   dans un onglet. Une fermeture ou un rechargement volontaire dans les 15 s qui suivent
   la pose d'une tuile coûte un clic (« Charger quand même ») : bien moins qu'une boucle. */
var FENETRE_SORTIE_MS = 15000;
var VALIDITE_SORTIE_MS = 10 * 60 * 1000;
var CLE_SORTIE = 'mv_sortie_forcee';
/* Le relevé des sorties (js/sorties.js) : chaque sortie de la page, vidéos chargées, avec
   l'état de la garde ; et les retours par « Précédent ». */
var CLE_SORTIES = 'journal_sorties';

/* Adresses des tuiles posées il y a moins de FENETRE_SORTIE_MS. */
export function suspectsDeSortie(flux, now) {
    return (flux || []).filter(function(s) {
        return s && s.url && s._posedAt && (now - s._posedAt) >= 0 && (now - s._posedAt) < FENETRE_SORTIE_MS;
    }).map(function(s) { return s.url; });
}

/* Marque `_sortieForcee` sur les tuiles dont l'adresse figure dans l'enregistrement,
   s'il est encore valable. Rend le nombre de tuiles marquées. */
export function marquerSortiesForcees(flux, record, now) {
    if (!record || !Array.isArray(record.urls) || !record.at) return 0;
    if (now - record.at < 0 || now - record.at > VALIDITE_SORTIE_MS) return 0;
    var n = 0;
    (flux || []).forEach(function(s) {
        if (s && s.url && record.urls.indexOf(s.url) >= 0) { s._sortieForcee = true; n++; }
    });
    return n;
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('pagehide', function(e) {
        var urls = suspectsDeSortie(mvFlux, Date.now());
        if (urls.length) safeStorageSetJSON(CLE_SORTIE, { urls: urls, at: Date.now() });
        safeStorageSetJSON(CLE_SORTIES, marquerQuittee(safeStorageGetJSON(CLE_SORTIES, []), Date.now(), e && e.persisted));
    });
}

/* ══ GARDE CONTRE LES REDIRECTIONS ══════════════════════════════════════════════════
   « L'app se fait maintenant plus facilement redirect vers l'un des sites, ce que je
   veux vraiment pas » (9 octobre 2026). Sans `sandbox`, un clic dans une page de
   lecteur suffit à son script pour faire `top.location = …` : l'onglet entier part sur
   le site, ou sur sa régie. Le script utilisateur l'empêche quand il est là, mais pas
   sur téléphone, et la sortie forcée ci-dessus ne joue qu'APRÈS coup.

   Mesuré dans Chromium, avec un vrai clic dans un lecteur hostile d'une autre origine :
   l'API Navigation (`navigate`) ne voit même pas cette navigation ; `beforeunload`, si.
   Le navigateur demande alors « Quitter le site ? », et refuser garde l'application en
   place, vidéos comprises. C'est le seul verrou possible sans bac à sable.

   Armé seulement quand des vidéos sont chargées : sans tuile, aucune page tierce ne
   peut détourner l'onglet. Les navigations voulues par l'application (mise à jour,
   installation du script) passent par `autoriserSortie`. Réglage `garde_sortie`,
   allumé par défaut, dans le menu ⚙ Réglages du lecteur.

   Sauf quand c'est l'utilisateur qui s'en va (18 octobre 2026, « ça me demande souvent
   si je veux quitter quand je ferme la page, ce qui devrait jamais arriver »).
   `beforeunload` ne dit pas qui part : fermer l'onglet et le détournement par un lecteur
   arrivent par le même événement. Ce qui les distingue, c'est ce qui précède.

   Une première version n'armait la garde que dans les 5 s suivant un geste dans une
   tuile. Le jour même : « l'onglet de l'appli » parti sur une régie (srowox.com/click,
   arrêtée par uBlock), « tout seul, sans clic », script 1.14. Firefox laisse un cadre
   d'une autre origine emmener l'onglet sans geste, et le piège du script sur
   `window.top` ne peut pas tenir (`top` n'est pas redéfinissable).

   La garde reste donc armée, et ne se lève que sur les signes d'un départ voulu :
     - le pointeur est sorti de la page par le HAUT, vers les onglets, la croix, le
       rechargement ou la barre d'adresse. La page le voit quand il traverse la barre du
       lecteur ; le script utilisateur le signale (`pointeur`) quand il quitte un cadre
       collé au haut de la fenêtre, et quand il revient directement dans une tuile ;
     - une touche de raccourci : Ctrl, Cmd ou Alt enfoncé (Ctrl+W, Cmd+W, Alt+F4,
       Ctrl+R), ou F5. Le navigateur ne transmet pas la lettre de Ctrl+W, mais transmet
       la touche Ctrl ; le script la relaie quand le focus est dans une tuile (`touche`) ;
     - l'onglet est caché (fermer un onglet d'arrière-plan).
   Un mouvement ou un clic dans la page, ou le message `mv_frame_clicked`, efface le
   départ. Un lecteur qui détourne l'onglet pendant qu'on regarde, au clic ou sans
   clic, trouve donc la garde armée.

   Le « sans clic », enfin compris le soir même (« toute demande de redirect doit être
   bloquée, je devrais pas avoir le popup ») : dans Firefox 158, un cadre sans clic chez
   lui ne peut PAS naviguer l'onglet, mais `history.back()` le fait reculer, et
   `history.forward()` avancer. Le script (1.17) rend l'historique inerte dans les
   cadres ; la garde ne pose plus la question que pour un `top.location` qui suit un
   clic dans le cadre. Les boutons Précédent et Suivant de la souris valent départ. */
var sortieAutoriseeJusqua = 0;
export var gardeSortie = true;
try { gardeSortie = (localStorage.getItem('garde_sortie') !== '0'); } catch (e) { gardeSortie = true; }

export function autoriserSortie() { sortieAutoriseeJusqua = Date.now() + 5000; }

/* Délai pendant lequel F5 (ou un Ctrl+R vu en entier) vaut départ. */
export var TOUCHE_DEPART_MS = 1500;
/* Un modificateur dont on n'a pas vu le relâchement (focus parti ailleurs) ne lève pas
   la garde plus de 10 s. */
export var MODIFICATEUR_MAX_MS = 10000;
/* Marge, en pixels, sous le haut de la fenêtre : un pointeur rapide sort de la page sans
   qu'elle le voie à la ligne 0, et Firefox ne rapporte souvent que sa dernière position
   vue, quelques pixels plus bas (18 octobre 2026, deux « Quitter le site ? » au relevé
   sans que l'utilisateur sache d'où). */
export var MARGE_HAUT_PX = 20;
var depart = { parLeHaut: false, modificateur: false, modificateurAt: -Infinity, toucheAt: -Infinity, clicAt: -Infinity,
    /* Pour le relevé seulement : dernière position vue, dernière sortie de la fenêtre,
       dernière touche de raccourci (jamais une autre touche). */
    y: null, yAt: -Infinity, sortieY: null, sortieAt: -Infinity, nomTouche: null, nomToucheAt: -Infinity,
    /* Le dernier balayage horizontal (pavé tactile), pour le tampon d'historique. */
    balayageAt: -Infinity };
/* Horloge monotone : un intervalle se mesure mieux ainsi, et elle n'est pas figée par
   les tests qui fixent Date.now. */
function horlogeDepart() {
    return (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
}

/* Le pointeur, vu par la page ou rapporté d'un cadre. `dehors` : sorti de la fenêtre
   par le haut. */
export function noterPointeur(dehors) { depart.parLeHaut = !!dehors; }

/* Une touche, vue par la page ou rapportée d'un cadre. `modificateur` : Ctrl, Cmd ou
   Alt tenu à cet instant ; `depart` : une touche qui quitte d'elle-même (F5, Ctrl+R). */
export function noterTouche(modificateur, toucheDeDepart, mono) {
    var t = (mono === undefined) ? horlogeDepart() : mono;
    depart.modificateur = !!modificateur;
    if (modificateur) depart.modificateurAt = t;
    if (toucheDeDepart) depart.toucheAt = t;
}

export function utilisateurPart(mono) {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return true;
    if (depart.parLeHaut) return true;
    var t = (mono === undefined) ? horlogeDepart() : mono;
    if (depart.modificateur && t - depart.modificateurAt < MODIFICATEUR_MAX_MS) return true;
    return t - depart.toucheAt < TOUCHE_DEPART_MS;
}

/* Les tuiles qui affichent la page d'un site, seules capables d'emmener l'onglet. Une
   vidéo jouée en mode direct (`<video>`), une tuile qui charge encore, le panneau « ce
   site a fait sortir la page » ou un lecteur officiel (js/esports.js) n'en ont pas : la
   garde n'a alors rien à retenir, et « Quitter le site ? » ne venait qu'à la fermeture. */
export function pagesDeSites() {
    var n = 0;
    try {
        documentsDuLecteur().forEach(function(d) {
            Array.prototype.forEach.call(d.querySelectorAll('iframe[id^="mv-iframe-"]'), function(f) {
                var src = f.getAttribute('src') || '';
                if (/^https?:/i.test(src) && !estLecteurOfficiel(src)) n++;
            });
        });
    } catch (e) { return mvFlux.length; }
    return n;
}

/* Le dernier clic vu dans une tuile (`mv_frame_clicked`), pour le relevé des sorties. */
export function noterClicTuile(mono) { depart.clicAt = (mono === undefined) ? horlogeDepart() : mono; }

/* Tout ce qui décide de la garde, à cet instant : ce que note le relevé des sorties
   (js/sorties.js), et ce que montre la page Logs. */
export function etatGarde(now, mono) {
    var t = (mono === undefined) ? horlogeDepart() : mono;
    var maintenant = (now === undefined) ? Date.now() : now;
    var ua = (typeof navigator !== 'undefined') ? navigator.userActivation : null;
    var a = (typeof document !== 'undefined') ? document.activeElement : null;
    var focus = (a && a.tagName === 'IFRAME' && /^mv-iframe-\d+$/.test(a.id || '')) ? parseInt(a.id.slice(10), 10) : -1;
    var age = function(at) { return isFinite(at) ? Math.round(t - at) : null; };
    var focusPage = null;
    try { focusPage = (typeof document !== 'undefined' && typeof document.hasFocus === 'function') ? document.hasFocus() : null; } catch (e) {}
    return {
        armee: gardeSortieArmee(now, mono),
        reglage: gardeSortie,
        tuiles: mvFlux.length,
        pages: pagesDeSites(),
        autorisee: maintenant <= sortieAutoriseeJusqua,
        cachee: typeof document !== 'undefined' && document.visibilityState === 'hidden',
        parLeHaut: depart.parLeHaut,
        modificateur: !!(depart.modificateur && t - depart.modificateurAt < MODIFICATEUR_MAX_MS),
        toucheIlYaMs: (t - depart.toucheAt < TOUCHE_DEPART_MS) ? Math.round(t - depart.toucheAt) : null,
        clicTuileIlYaMs: isFinite(depart.clicAt) ? Math.round(t - depart.clicAt) : null,
        activation: ua ? { active: !!ua.isActive, deja: !!ua.hasBeenActive } : null,
        focusTuile: focus,
        focusPage: focusPage,
        pointeur: depart.y === null ? null : { y: depart.y, ilYaMs: age(depart.yAt) },
        sortieFenetre: depart.sortieY === null ? null : { y: depart.sortieY, ilYaMs: age(depart.sortieAt) },
        derniereTouche: depart.nomTouche === null ? null : { touche: depart.nomTouche, ilYaMs: age(depart.nomToucheAt) },
        poseesIlYaMs: mvFlux.map(function(f) { return f._posedAt ? Math.max(0, maintenant - f._posedAt) : null; }),
        script: versionDuScript(),
        tampon: (typeof window !== 'undefined' && tamponPossible(window)) ? estTampon(history.state) : null,
        sites: mvFlux.map(function(f) { return getDomain(f._currentUrl || f.url || ''); })
    };
}

/* La version du script utilisateur qui s'est annoncée, ou null. */
function versionDuScript() {
    try { var b = getBridgeStatus(); return (b && b.available && b.version) ? String(b.version) : null; } catch (e) { return null; }
}

export function gardeSortieArmee(now, mono) {
    return gardeSortie && mvFlux.length > 0 && (now === undefined ? Date.now() : now) > sortieAutoriseeJusqua
        && !utilisateurPart(mono) && pagesDeSites() > 0;
}

var TOUCHES_MODIFICATRICES = { Control: 1, Meta: 1, Alt: 1, OS: 1 };
function estToucheDeDepart(e) {
    return e.key === 'F5' || ((e.ctrlKey || e.metaKey) && /^[rwq]$/i.test(e.key || ''));
}
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('mouseout', function(e) {
        if (e.relatedTarget) return;
        depart.sortieY = Math.round(e.clientY); depart.sortieAt = horlogeDepart();
        if (e.clientY <= MARGE_HAUT_PX) noterPointeur(true);
    }, true);
    var pointeurDedans = function(e) {
        depart.parLeHaut = false;
        if (typeof e.clientY === 'number') { depart.y = Math.round(e.clientY); depart.yAt = horlogeDepart(); }
        noterTouche(e.ctrlKey || e.metaKey || e.altKey, false);
    };
    document.addEventListener('mousemove', pointeurDedans, true);
    document.addEventListener('mouseover', pointeurDedans, true);
    document.addEventListener('pointerdown', pointeurDedans, true);
    document.addEventListener('keydown', function(e) {
        noterTouche(TOUCHES_MODIFICATRICES[e.key] || e.ctrlKey || e.metaKey || e.altKey, estToucheDeDepart(e));
        if (TOUCHES_MODIFICATRICES[e.key] || estToucheDeDepart(e)) {
            depart.nomTouche = ((e.ctrlKey && e.key !== 'Control') ? 'Ctrl+' : '') + ((e.metaKey && e.key !== 'Meta') ? 'Cmd+' : '') + e.key;
            depart.nomToucheAt = horlogeDepart();
        }
    }, true);
    document.addEventListener('keyup', function(e) {
        if (TOUCHES_MODIFICATRICES[e.key]) noterTouche(e.ctrlKey || e.metaKey || e.altKey, false);
    }, true);
    document.addEventListener('wheel', function(e) {
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) depart.balayageAt = horlogeDepart();
    }, { capture: true, passive: true });
    /* Les boutons Précédent et Suivant de la souris : c'est l'utilisateur qui recule. */
    document.addEventListener('mousedown', function(e) {
        if (e.button !== 3 && e.button !== 4) return;
        noterTouche(false, true);
        depart.nomTouche = 'bouton ' + (e.button === 3 ? 'Précédent' : 'Suivant') + ' de la souris';
        depart.nomToucheAt = horlogeDepart();
    }, true);
}

export function toggleGardeSortie() {
    fermerMenus();
    gardeSortie = !gardeSortie;
    try { localStorage.setItem('garde_sortie', gardeSortie ? '1' : '0'); } catch (e) {}
    showToast(gardeSortie
        ? '🛡 Redirections bloquées : un site qui tente d\'emmener l\'onglet ailleurs déclenche « Quitter le site ? » — répondre non.'
        : '⚠ Redirections permises : un clic dans une vidéo peut faire quitter l\'application.');
    return gardeSortie;
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('beforeunload', function(e) {
        var etat = etatGarde();
        if (etat.tuiles) safeStorageSetJSON(CLE_SORTIES, noterSortie(safeStorageGetJSON(CLE_SORTIES, []), etat, Date.now()));
        if (!etat.armee) return;
        e.preventDefault();
        e.returnValue = '';
        return '';
    });
}

/* Un retour sur l'application par « Précédent » : noté dans le relevé, pour qu'un
   détournement qui n'est pas passé par `beforeunload` se voie quand même. */
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    try {
        /* L'API Navigation d'abord (`traverse`), la chronologie de navigation à défaut
           (`back_forward`) : l'horloge factice des tests remplace `performance`. */
        var activation = (window.navigation && window.navigation.activation) ? window.navigation.activation.navigationType : '';
        var nav = (typeof performance !== 'undefined' && performance.getEntriesByType) ? performance.getEntriesByType('navigation')[0] : null;
        if (activation === 'traverse' || (nav && nav.type === 'back_forward')) safeStorageSetJSON(CLE_SORTIES, noterRetour(safeStorageGetJSON(CLE_SORTIES, []), Date.now(), false));
    } catch (e) {}
    window.addEventListener('pageshow', function(e) {
        if (e && e.persisted) safeStorageSetJSON(CLE_SORTIES, noterRetour(safeStorageGetJSON(CLE_SORTIES, []), Date.now(), true));
    });
}

/* Le tampon d'historique (js/tampon.js) : posé quand une tuile affiche la page d'un site,
   il absorbe le `history.back()` qu'une vidéo envoie à l'onglet. `surTampon` dit si
   l'entrée courante est le tampon : un `popstate` qui en descend l'a consommé. */
var surTampon = (typeof history !== 'undefined') && estTampon(history.state);

export function poserTampon() {
    if (!gardeSortie || typeof window === 'undefined' || !tamponPossible(window) || surTampon) return false;
    try { history.pushState(ETAT_TAMPON, '', location.href); } catch (e) { return false; }
    surTampon = true;
    return true;
}

export function balayageRecent(mono) {
    var t = (mono === undefined) ? horlogeDepart() : mono;
    return t - depart.balayageAt < BALAYAGE_MS;
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('popstate', function(e) {
        var consomme = surTampon;
        surTampon = estTampon(e.state);
        if (!consomme || surTampon) return;
        var decision = decisionRetour({ reglage: gardeSortie, pages: pagesDeSites(), utilisateurPart: utilisateurPart(), balayage: balayageRecent() });
        /* La garde ne repose pas la question pour ce recul-là : c'est l'utilisateur. */
        if (decision === 'laisser') { autoriserSortie(); try { history.back(); } catch (err) {} return; }
        poserTampon();
        safeStorageSetJSON(CLE_SORTIES, noterBlocage(safeStorageGetJSON(CLE_SORTIES, []), etatGarde(), Date.now()));
        showToast('⛔ Une vidéo a voulu faire reculer l\'onglet : bloqué. Pour reculer toi-même : ← du navigateur ou Alt+←.');
    });
}

/* « Charger quand même » : la tuile est reposée par le chemin normal. */
export function chargerQuandMeme(idx) {
    var s = mvFlux[idx];
    if (!s) return;
    s._sortieForcee = false;
    saveMultivisionState();
    rechargerTuile(idx);
}

function poserAvertissementSortie(container, cell, s) {
    var idx = parseInt(cell.dataset.index, 10);
    detruireLecteursDe(container);
    container.innerHTML = '';
    var box = document.createElement('div');
    box.className = 'mv-sortie-forcee';
    box.innerHTML = '<div class="mv-sortie-titre">Ce site a fait sortir la page du lecteur</div>'
        + '<div class="mv-sortie-texte">' + esc(getDomain(s.url)) + ' a redirigé toute la fenêtre vers lui la dernière fois. La tuile n\'a pas été rechargée pour éviter la boucle.</div>'
        + '<div class="mv-sortie-actions">'
        + '<button type="button" class="btn" onclick="chargerQuandMeme(' + idx + '); event.stopPropagation();">Charger quand même</button>'
        + '</div>';
    container.appendChild(box);
}


/* ══ MULTIVISION STREAM SELECTOR ════════ */
export function showFluxSelector(idx, mid, event) {
    mid = getOriginalMatchId(mid);
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    var m = S.matchMap.get(String(mid));

    var existing = document.getElementById('mv-flux-selector');
    if (existing) existing.remove();

    var selector = document.createElement('div');
    selector.id = 'mv-flux-selector';
    selector.style.cssText = 'position:fixed;z-index:9999;background:rgba(20,20,20,0.95);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:16px;backdrop-filter:blur(15px);display:flex;flex-direction:column;gap:16px;max-height:80vh;overflow-y:auto;box-shadow:0 15px 40px rgba(0,0,0,0.8);width:90%;max-width:360px;top:50%;left:50%;transform:translate(-50%, -50%);';

    // Add close button for mobile
    var closeBtn = document.createElement('div');
    closeBtn.innerHTML = '<span class="ic ic-close"></span>';
    closeBtn.style.cssText = 'position:absolute;top:12px;right:12px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.1);border-radius:50%;cursor:pointer;color:#fff;font-size:14px;';
    closeBtn.onclick = function() { selector.remove(); };
    selector.appendChild(closeBtn);

    // Section 1: Alternative Flux for current match
    if (m && m.streamLinks && m.streamLinks.length > 0) {
        var titleFlux = document.createElement('div');
        titleFlux.style.cssText = 'font-size:11px;font-weight:bold;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;';
        titleFlux.textContent = 'Sources pour ce match';
        selector.appendChild(titleFlux);

        var streamsContainer = document.createElement('div');
        streamsContainer.style.cssText = 'display:flex;flex-direction:column;gap:4px;';

        var sortedLinks = sortFluxLinks(m.streamLinks);
        sortedLinks.forEach(function(s) {
            var dom = getDomain(s.url);
            var isActive = mvFlux[idx].url === s.url;

            /* Une source est un arrêt de la télécommande, et OK la lance (« choisir une source
               permet juste de upvote ou downvote, pas de choisir le stream », 25 octobre 2026 :
               la ligne n'était qu'un bloc, seuls ⭐ et 👎 prenaient le focus). ⭐ et 👎 restent
               pour la souris et le doigt (tabindex -1, ignorés par js/tv-navigation.js). */
            var btn = document.createElement('div');
            btn.className = 'mv-flux-choix' + (isActive ? ' actif' : '');
            btn.setAttribute('role', 'button');
            btn.setAttribute('tabindex', '0');
            if (isActive) btn.setAttribute('data-focus-depart', '');
            btn.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px;min-height:44px;border-radius:8px;cursor:pointer;transition:all 0.15s;background:' + (isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)') + ';border:1px solid ' + (isActive ? 'rgba(255,255,255,0.3)' : 'transparent') + ';';

            btn.onmouseenter = function() { if(!isActive) this.style.background = 'rgba(255,255,255,0.1)'; };
            btn.onmouseleave = function() { if(!isActive) this.style.background = 'rgba(255,255,255,0.05)'; };

            btn.onclick = function(e) {
                e.stopPropagation();
                if(!isActive) {
                    mvFlux[idx].url = s.url;
                    mvFlux[idx]._autoTried = 0; mvFlux[idx]._playing = false; mvFlux[idx]._playNoted = false;
                    // name and mid stays the same
                    saveMultivisionState(); updateMultivisionLayout();
                }
                selector.remove();
            };

            var pref = domainPrefs[dom] || 0;
            var favEv = "toggleDomainPref('" + escJs(dom) + "', 'fav', '" + (m.id ? escJs(m.id) : '') + "'); event.stopPropagation(); event.preventDefault(); showFluxSelector(" + idx + ", '" + escJs(mid) + "');";
            var depEv = "toggleDomainPref('" + escJs(dom) + "', 'dep', '" + (m.id ? escJs(m.id) : '') + "'); event.stopPropagation(); event.preventDefault(); showFluxSelector(" + idx + ", '" + escJs(mid) + "');";

            btn.innerHTML = '<div style="font-size:16px;">' + (s.icon||QI[s.quality]||'📺') + '</div>' +
                            '<div style="flex:1;overflow:hidden;">' +
                            '<div style="font-size:13px;font-weight:bold;color:#fff;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;">' + esc(s.name) + '</div>' +
                            '<div style="font-size:11px;color:var(--muted);">' + esc(dom) + '</div>' +
                            '</div>' +
                            (isActive ? '<div style="font-size:9px;background:var(--accent);color:#fff;padding:2px 4px;border-radius:4px;font-weight:bold;margin-right:4px;">ACTIF</div>' : '') +
                            '<span class="sbadge ' + (QC[s.quality]||'bSD') + '" style="font-size:9px;padding:2px 4px;margin-right:8px;">' + (s.quality||'SD') + '</span>' +
                            '<div style="display:flex; align-items:center; gap:4px;">' +
                                '<button tabindex="-1" title="Prioriser ce domaine" aria-label="Prioriser ce domaine" onclick="' + favEv + '" style="width:28px; height:28px; border-radius:8px; background:' + (pref === 1 ? 'var(--accent)' : 'rgba(255,255,255,0.05)') + '; border:none; color:' + (pref === 1 ? '#fff' : 'var(--muted)') + '; cursor:pointer; font-size:12px; transition:all 0.15s; display:flex; align-items:center; justify-content:center;">⭐</button>' +
                                '<button tabindex="-1" title="Déprioriser ce domaine" aria-label="Déprioriser ce domaine" onclick="' + depEv + '" style="width:28px; height:28px; border-radius:8px; background:' + (pref === -1 ? 'var(--red)' : 'rgba(255,255,255,0.05)') + '; border:none; color:' + (pref === -1 ? '#fff' : 'var(--muted)') + '; cursor:pointer; font-size:12px; transition:all 0.15s; display:flex; align-items:center; justify-content:center;">👎</button>' +
                            '</div>';

            streamsContainer.appendChild(btn);
        });
        selector.appendChild(streamsContainer);
    }

    /* « Remplacer par un autre match » est parti avec « Changer de match » (25 octobre 2026 :
       « juste possible après avoir fermé le match ») : fermer la vidéo, puis + Ajouter. */

    document.body.appendChild(selector);

    // Close on outside click
    setTimeout(function() {
        var closeListener = function(e) {
            if (!selector.contains(e.target)) {
                selector.remove();
                document.removeEventListener('click', closeListener);
            }
        };
        document.addEventListener('click', closeListener);
    }, 10);
}







/* ══ MULTIVISION MATCH SELECTOR ════════ */
export function showMatchSelector(event, replaceIdx) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    var isReplace = replaceIdx !== undefined;

    window.multiviewPendingAction = {
        type: isReplace ? 'replace' : 'add',
        replaceIdx: replaceIdx
    };

    var mvc = document.getElementById('mv-container');
    if (mvc && !mvc.classList.contains('mv-pip') && mvc.style.display !== 'none') {
        toggleMultiviewPip();
    }

    applyFilter('live');

    // Show a toast to instruct the user
    showToast(isReplace ? 'Sélectionnez un match en direct pour remplacer' : 'Sélectionnez un match en direct pour ajouter');
}


/* Le lecteur revient au premier plan : ses commandes avec lui. Le repos les avait peut-être
   effacées juste avant qu'on le quitte, et rien ne les rendait avant le prochain geste
   au-dessus de la barre — on arrivait devant une barre vide. */
function reveillerCommandes() {
    if (typeof window.resetMvIdleTimer === 'function') window.resetMvIdleTimer();
}

export function toggleMultiviewPip() {
    var mvc = document.getElementById('mv-container');
    var epg = document.getElementById('epg');
    if(!mvc || !epg) return;

    if(mvc.classList.contains('mv-pip')) {
        // Restore to full screen multiview
        poserPleinCadre(mvc);
        mvc.style.display = 'flex';
        epg.style.display = 'none';
        epg.style.paddingRight = '0';
        syncNavState('player');

        var optionsPage = document.getElementById('options-page');
        if (optionsPage) optionsPage.style.display = 'none';
        var logsPage = document.getElementById('logs-page');
        if (logsPage) logsPage.style.display = 'none';
        var scriptPage = document.getElementById('script-page');
        if (scriptPage) scriptPage.style.display = 'none';

        updateMultivisionLayout();
        reveillerCommandes();
    } else {
        /* Le lecteur passe en ARRIÈRE-PLAN : masqué, pas réduit.

           « Le multiview dans l'écran des matchs live et guide, je veux plus ça »
           (9 octobre 2026). Il se réduisait en colonne, en fenêtre flottante ou en barre
           par-dessus le Live et le Guide ; sur téléphone, la fenêtre flottante (400 px de
           large) débordait de l'écran et couvrait la barre d'onglets du bas. Il est
           maintenant simplement caché : les tuiles restent chargées (le son continue,
           rien ne recharge au retour), et l'onglet Lecteur, souligné tant qu'une vidéo
           tourne (`has-streams`), les rend en un geste. La classe `mv-pip` garde son sens
           pour le reste du code : « le lecteur n'est pas au premier plan ». */
        fermerMenus();
        quitterModeCinema();
        quitterPleinEcranLecteur();
        mvc.classList.remove('mv-full');
        mvc.classList.add('mv-pip');
        mvc.style.display = 'none';
        epg.style.display = 'flex';
        epg.style.paddingRight = '0';
        syncNavState(S.filter || 'live');
    }
}

/* Redimensionnement de la fenêtre. Le lecteur n'a plus de mode réduit (9 octobre 2026) :
   en arrière-plan il est caché, et rien ici ne doit le faire réapparaître ni pousser le
   guide. Un `resize` sur téléphone (barre d'adresse repliée) ne veut rien dire de plus. */
window.addEventListener('resize', function() {
    var mvc = document.getElementById('mv-container');

    /* Un écran en portrait empile les tuiles (voir dispositionEffective) : le rendu suit
       l'orientation, sans toucher au choix de l'utilisateur. */
    if (mvc && mvc.style.display !== 'none' && mvFlux.length > 0) updateMultivisionLayout();
});



/* Géométrie du Multivision plein cadre : une classe, la feuille de style fait le reste
   (sous l'en-tête sur bureau, au-dessus de la barre du bas sur mobile — voir
   `#mv-container.mv-full`, styles.css). Les styles en ligne posés par les modes PiP
   sont effacés au passage ; `display` reste piloté en ligne par les appelants. */
function poserPleinCadre(mvc) {
    mvc.style.cssText = '';
    mvc.classList.remove('mv-pip');
    mvc.classList.add('mv-full');
}

/* Où est la grille des tuiles : dans la page, ou dans la fenêtre détachée ?

   `toggleDocumentPiP` déplace `#mv-grid-wrapper` dans le document d'une autre fenêtre.
   Tout ce qui la cherchait sous `#mv-container` ne la trouvait plus. */
export function grilleDuLecteur() {
    var g = document.getElementById('mv-grid-wrapper');
    if (g) return g;
    if (docPiPWindow && docPiPWindow.document) return docPiPWindow.document.getElementById('mv-grid-wrapper');
    return null;
}

/* La grille est-elle hors de la page (fenêtre détachée) ? */
export function grilleDetachee() {
    var g = grilleDuLecteur();
    return !!(g && g.ownerDocument && g.ownerDocument !== document);
}

/* ══ MODE DEUX ÉCRANS (js/deuxecrans.js pour les règles) ═══════════════════════
   La tuile 1 reste dans la page ; les suivantes vivent dans `#mv-grid-2`, la grille
   d'une seconde fenêtre (`toggleDeuxEcrans`). Une tuile n'est donc plus forcément
   dans `document` : ce qui cherche une tuile passe par `celluleDeTuile` /
   `cadreDeTuile`, et ce qui lui parle par `posterATuile`. */
var fenetreEcran2 = null;

export function secondeGrille() {
    if (!fenetreEcran2) return null;
    try {
        if (fenetreEcran2.closed) return null;
        return fenetreEcran2.document.getElementById('mv-grid-2');
    } catch (e) { return null; }
}

export function deuxEcransActif() {
    return !!secondeGrille();
}

/* Les documents où une tuile peut se trouver : la page, la fenêtre détachée (PiP),
   le second écran. */
function documentsDuLecteur() {
    var docs = [document];
    [grilleDuLecteur(), secondeGrille()].forEach(function(g) {
        if (g && g.ownerDocument && docs.indexOf(g.ownerDocument) < 0) docs.push(g.ownerDocument);
    });
    return docs;
}

export function cadreDeTuile(idx) {
    var docs = documentsDuLecteur();
    for (var i = 0; i < docs.length; i++) {
        var el = docs[i].getElementById('mv-iframe-' + idx);
        if (el) return el;
    }
    return null;
}

export function celluleDeTuile(idx) {
    var docs = documentsDuLecteur();
    for (var i = 0; i < docs.length; i++) {
        var el = docs[i].querySelector('.mv-cell[data-index="' + idx + '"]');
        if (el) return el;
    }
    return null;
}

export function toutesLesCellules() {
    var out = [];
    documentsDuLecteur().forEach(function(d) {
        Array.prototype.forEach.call(d.querySelectorAll('.mv-cell'), function(c) { out.push(c); });
    });
    return out;
}

/* Parler à une tuile. Le script utilisateur n'obéit qu'à la fenêtre qui l'encadre
   (`FENETRE_PARENTE`, multiview-cleaner.user.js) : pour une tuile posée dans une autre
   fenêtre, l'ordre doit PARTIR de cette fenêtre. `__mvRelais` est une fonction définie
   dans son propre script : `e.source` y vaut alors la fenêtre qui encadre la tuile. */
export function posterATuile(el, message) {
    if (!el || !el.contentWindow) return;
    var vue = el.ownerDocument && el.ownerDocument.defaultView;
    try {
        if (vue && vue !== window && typeof vue.__mvRelais === 'function') vue.__mvRelais(el.contentWindow, message);
        else el.contentWindow.postMessage(message, '*');
    } catch (e) {}
}

/* Prépare une fenêtre qui va porter des tuiles : le relais des ordres (ci-dessus), le
   renvoi vers la page des messages que les lecteurs adressent à `window.top` (qui est
   CETTE fenêtre), et les fonctions globales qu'appellent les `onclick` des en-têtes —
   un attribut `onclick` se résout dans la fenêtre qui porte le bouton. */
export function brancherFenetreDeTuiles(fen) {
    var doc = fen.document;
    if (!fen.__mvRelais) {
        var sc = doc.createElement('script');
        sc.textContent = 'window.__mvRelais = function (cible, message) { try { cible.postMessage(message, "*"); } catch (e) {} };';
        (doc.head || doc.documentElement).appendChild(sc);
    }
    fen.addEventListener('message', function(e) {
        if (e.source === fen) return;
        try { window.dispatchEvent(new MessageEvent('message', { data: e.data, origin: e.origin, source: e.source })); } catch (err) {}
    });
    Object.keys(window).forEach(function(k) {
        try { if (typeof window[k] === 'function' && !(k in fen)) fen[k] = window[k]; } catch (e) {}
    });
}

/* Copie les feuilles de style de la page dans une autre fenêtre (PiP, second écran). */
function copierFeuillesDeStyle(doc) {
    var styleSheets = document.styleSheets;
    for (var i = 0; i < styleSheets.length; i++) {
        var styleSheet = styleSheets[i];
        try {
            if (styleSheet.href) {
                var newLinkEl = doc.createElement('link');
                newLinkEl.rel = 'stylesheet';
                newLinkEl.href = styleSheet.href;
                doc.head.appendChild(newLinkEl);
            } else if (styleSheet.ownerNode && styleSheet.ownerNode.textContent) {
                var newStyleEl = doc.createElement('style');
                newStyleEl.textContent = styleSheet.ownerNode.textContent;
                doc.head.appendChild(newStyleEl);
            }
        } catch (e) {
            console.warn('Failed to copy stylesheet', e);
        }
    }
}

/* Le repos vaut aussi pour le second écran : ses en-têtes de tuiles et sa barre. */
function reposSecondEcran(cacher) {
    var g2 = secondeGrille();
    if (!g2) return;
    appliquerRepos(g2, g2.ownerDocument.getElementById('mv-ecran2-barre'), cacher);
}

/* Ouvre ou ferme le second écran. La fenêtre est ordinaire (`window.open`) : on la
   passe en plein écran sur le moniteur qu'on veut. Quand le navigateur sait nommer les
   écrans (`getScreenDetails`, Chromium), elle s'ouvre directement sur l'autre. */
export async function toggleDeuxEcrans() {
    if (deuxEcransActif()) { fermerDeuxEcrans(); return; }
    if (docPiPWindow) { showToast('Fermez d\'abord la fenêtre détachée.'); return; }
    if (modeCable) { showToast('Le mode câble n\'a qu\'une vidéo : éteignez-le pour utiliser deux écrans.'); return; }
    fermerMenus();
    quitterModeCinema();

    /* La liste des écrans demande une permission. Attendre la réponse avant
       `window.open` userait l'activation du clic, et la fenêtre serait bloquée : on ne
       s'en sert d'emblée que si elle est déjà accordée, sinon on la demande APRÈS
       l'ouverture et on déplace la fenêtre. */
    var ecran = null, permis = false;
    var details = typeof window.getScreenDetails === 'function';
    if (details) {
        try {
            var etat = navigator.permissions ? await navigator.permissions.query({ name: 'window-management' }) : null;
            permis = !!(etat && etat.state === 'granted');
        } catch (e) { permis = false; }
        if (permis) {
            try {
                var d = await window.getScreenDetails();
                ecran = ecranSecondaire(d.screens, d.currentScreen);
            } catch (e) { ecran = null; }
        }
    }

    var fen = window.open('', 'footy-ecran2', optionsFenetre(ecran));
    if (!fen) { showToast('Fenêtre bloquée : autorisez les fenêtres surgissantes pour ce site.'); return; }
    if (details && !permis) {
        window.getScreenDetails().then(function(d) {
            var e = ecranSecondaire(d.screens, d.currentScreen);
            if (!e || fen.closed) return;
            fen.moveTo(e.availLeft, e.availTop);
            fen.resizeTo(e.availWidth, e.availHeight);
        }).catch(function() {});
    }
    /* Document neuf : une fenêtre du même nom restée ouverte garde sinon son contenu. */
    var doc = fen.document;
    doc.open();
    doc.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"></head><body></body></html>');
    doc.close();
    preparerSecondEcran(fen, true);
}

/* Construit le second écran dans `fen` (fenêtre ordinaire ou fenêtre détachée PiP) et
   y envoie les vidéos 2 à 4. `pleinEcran` : la fenêtre détachée ne peut pas passer en
   plein écran, son bouton n'y est pas. */
var secondEcranPiP = false;
function preparerSecondEcran(fen, pleinEcran) {
    secondEcranPiP = !pleinEcran;
    var doc = fen.document;
    doc.title = 'Guide des Sports — 2e écran';
    doc.body.style.cssText = 'margin:0;padding:0;background:#000;overflow:hidden;display:flex;flex-direction:column;width:100vw;height:100vh;';
    doc.body.innerHTML = '<div id="mv-ecran2-barre" style="position:fixed;bottom:12px;left:50%;transform:translateX(-50%);z-index:50;display:flex;gap:6px;transition:opacity .15s;">'
        + (pleinEcran ? '<button type="button" id="mv-ecran2-pe" class="btn">⛶ Plein écran</button>' : '')
        + '<button type="button" id="mv-ecran2-fermer" class="btn">⤺ Ramener les vidéos</button></div>'
        + '<div id="mv-ecran2-vide" style="display:none;margin:auto;color:#aaa;font:16px system-ui,sans-serif;text-align:center;padding:20px;">'
        + 'Deuxième écran prêt.<br>La vidéo 1 joue dans la page ; les vidéos 2 à 4 s\'affichent ici.</div>'
        + '<div id="mv-grid-2" style="flex:1;display:grid;gap:2px;background:#000;"></div>';
    copierFeuillesDeStyle(doc);
    brancherFenetreDeTuiles(fen);

    var pe = doc.getElementById('mv-ecran2-pe');
    if (pe) pe.addEventListener('click', function() {
        var racine = doc.documentElement;
        if (doc.fullscreenElement) { doc.exitFullscreen(); return; }
        try { var p = racine.requestFullscreen(); if (p && p.catch) p.catch(function() {}); } catch (e) {}
    });
    doc.getElementById('mv-ecran2-fermer').addEventListener('click', function() { fermerDeuxEcrans(); });
    ['mousemove', 'click'].forEach(function(ev) { doc.addEventListener(ev, function() { window.resetMvIdleTimer && window.resetMvIdleTimer(); }); });
    doc.addEventListener('touchstart', function() { window.resetMvIdleTimer && window.resetMvIdleTimer(); }, { passive: true });
    /* Les raccourcis (1 à 4 : mettre cette vidéo sur l'écran principal) marchent aussi
       quand c'est la seconde fenêtre qui a le clavier. */
    doc.addEventListener('keydown', function(e) {
        try { window.dispatchEvent(new KeyboardEvent('keydown', { key: e.key, code: e.code, ctrlKey: e.ctrlKey, altKey: e.altKey, shiftKey: e.shiftKey, metaKey: e.metaKey })); } catch (err) {}
    });
    fen.addEventListener('pagehide', function() { if (fenetreEcran2 === fen) fermerDeuxEcrans(); });

    fenetreEcran2 = fen;
    updateMultivisionLayout();
    if (typeof window.resetMvIdleTimer === 'function') window.resetMvIdleTimer();
}

/* ── Deux écrans, une seule fenêtre étirée ─────────────────────────────────────
   Disposition `ecrans` : la page entière couvre les deux moniteurs. La vidéo 1 occupe
   la part de la grille posée sur le premier écran, les autres s'empilent sur le second.
   Un échange ne fait que réordonner des cellules de la même page : aucune iframe ne
   change de document, rien ne recharge. */
export function fractionDeuxEcrans(grid) {
    var sc = window.screen || {};
    var r = grid.getBoundingClientRect ? grid.getBoundingClientRect() : { left: 0, width: 0 };
    return partPremierEcran({
        fenetreX: window.screenX || 0, grilleGauche: r.left, grilleLargeur: r.width,
        ecranGauche: sc.availLeft || 0, ecranLargeur: sc.availWidth || sc.width || 0
    });
}

var dispositionAvantEcrans = 'auto';
export function toggleEcransEtire() {
    if (mvLayout === 'ecrans') {
        setMvLayout(dispositionAvantEcrans === 'ecrans' ? 'auto' : dispositionAvantEcrans);
    } else {
        if (deuxEcransActif()) fermerDeuxEcrans();
        dispositionAvantEcrans = mvLayout;
        setMvLayout('ecrans');
        showToast('Étirez la fenêtre sur les deux écrans : la vidéo 1 se cale sur le premier, les autres sur le second.');
    }
    saveMultivisionState();
    updateMultivisionLayout();
}

/* Déplacer une fenêtre n'émet pas `resize` : on relit sa position tant que la
   disposition est active, et on recale la frontière quand elle a bougé. */
var veilleEtiree = null, derniereMesureEtiree = '';
function surveillerFenetreEtiree() {
    if (veilleEtiree) return;
    veilleEtiree = setInterval(function() {
        if (mvLayout !== 'ecrans') { clearInterval(veilleEtiree); veilleEtiree = null; return; }
        var sc = window.screen || {};
        var mesure = [window.screenX, sc.availLeft, sc.availWidth, window.innerWidth].join(',');
        if (mesure !== derniereMesureEtiree) { derniereMesureEtiree = mesure; updateMultivisionLayout(); }
    }, 1500);
    if (veilleEtiree && veilleEtiree.unref) veilleEtiree.unref();
}

/* Ramène toutes les tuiles dans la page, puis ferme la seconde fenêtre. */
export function fermerDeuxEcrans() {
    var fen = fenetreEcran2;
    var g2 = secondeGrille();
    fenetreEcran2 = null;
    fermerMenus();
    var grid = document.getElementById('mv-grid');
    var aReposer = false;
    if (g2 && grid) {
        /* Le retour recharge chaque vidéo rapportée, comme l'aller : elle repart comme un
           chargement neuf (lecture relancée, son, pastille), et une vidéo directe est
           reposée — sinon elle revenait muette, marquée ● sans jouer, et sans reprise. */
        Array.prototype.slice.call(g2.querySelectorAll('.mv-cell')).forEach(function(c) {
            grid.appendChild(c);
            var s = mvFlux.find(function(x) { return x._internalId === c.getAttribute('data-internal-id'); });
            if (!s) return;
            if (s.mode === 'direct') { s._currentUrl = null; aReposer = true; }
            else reveillerApresDeplacement(s, c);
        });
    }
    try { if (fen && !fen.closed) fen.close(); } catch (e) {}
    updateMultivisionLayout();
    if (aReposer) setTimeout(updateMultivisionLayout, 0);
    applyMvFocusStyling();
    applyMvAudioState();
    if (typeof window.resetMvIdleTimer === 'function') window.resetMvIdleTimer();
}

/* Échange deux tuiles de place, comme le glisser-déposer dans une même fenêtre : ni
   les autres tuiles ni le son ne bougent (le son suit la tuile qui l'avait). */
export function echangerTuiles(a, b) {
    if (a === b || a < 0 || b < 0 || a >= mvFlux.length || b >= mvFlux.length) return;
    var temp = mvFlux[a];
    mvFlux[a] = mvFlux[b];
    mvFlux[b] = temp;
    if (activeMvIdx === a) activeMvIdx = b;
    else if (activeMvIdx === b) activeMvIdx = a;
    saveMultivisionState();
    updateMultivisionLayout();
    applyMvFocusStyling();
    applyMvAudioState();
}

/* La tuile `idx` du second écran ÉCHANGE sa place avec la vidéo principale : celle-ci
   part à l'endroit exact que l'autre quitte. (`⇄` de l'en-tête, menu ⋮.) La vidéo qui
   arrive devant prend le son. */
export function mettreSurEcranPrincipal(idx) {
    if (idx <= 0 || idx >= mvFlux.length) return;
    echangerTuiles(idx, 0);
    focusStream(0);
}

/* Les deux tuiles sont-elles dans la même fenêtre ? */
function estMemeFenetre(idx, cell) {
    var autre = celluleDeTuile(idx);
    return !autre || autre.ownerDocument === cell.ownerDocument;
}

/* Pendant un glisser, les cadres ne doivent pas avaler les événements — dans toutes
   les fenêtres du lecteur. */
function pointeursDesCadres(valeur) {
    documentsDuLecteur().forEach(function(d) {
        Array.prototype.forEach.call(d.querySelectorAll('.mv-iframe'), function(fr) { fr.style.pointerEvents = valeur; });
    });
}

window.addEventListener('pagehide', function() {
    try { if (fenetreEcran2 && !fenetreEcran2.closed) fenetreEcran2.close(); } catch (e) {}
});

/* Efface (ou rétablit) les commandes du lecteur : la barre, et les en-têtes de tuiles
   DANS LA GRILLE, où qu'elle soit. `barre` vaut null quand la grille est détachée : la
   barre, elle, reste dans la page. Rend le nombre d'en-têtes touchés — c'est ce compte
   qui valait zéro en fenêtre détachée, faute de chercher au bon endroit. */
export function appliquerRepos(grille, barre, cacher) {
    if (barre) {
        barre.style.opacity = cacher ? '0' : '1';
        barre.style.pointerEvents = cacher ? 'none' : 'auto';
        barre.classList.toggle('mv-cachee', !!cacher);
    }
    if (!grille) return 0;
    grille.style.cursor = cacher ? 'none' : 'default';
    var hdrs = grille.querySelectorAll('.mv-hdr');
    for (var i = 0; i < hdrs.length; i++) {
        hdrs[i].style.opacity = cacher ? '0' : '1';
        hdrs[i].style.pointerEvents = cacher ? 'none' : 'auto';
    }
    var ovs = grille.querySelectorAll('.mv-idle-overlay');
    for (var j = 0; j < ovs.length; j++) {
        ovs[j].style.display = cacher ? 'block' : 'none';
        if (cacher) ovs[j].style.pointerEvents = 'auto';
    }
    return hdrs.length;
}

export function setupMultivisionUI() {
    if(document.getElementById('mv-container')) return;
    brancherManetteApplication();

    // Create Multivision Container

    var mvContainer = document.createElement('div');

    mvContainer.id = 'mv-container';
    poserPleinCadre(mvContainer);
    mvContainer.style.display = 'none';

    var mvToolbar = document.createElement('div');
    mvToolbar.id = 'mv-toolbar';

  /* Barre du lecteur, la seule (« refondre les menus, surtout dans le multiview, pour
     qqchose de moderne et moins all over the place », 25 octobre 2026). Les commandes
     étaient en trois endroits : la barre, l'en-tête de chaque tuile (⏭, ▶ direct,
     cadrage, Site, ⋮, ✕) et des doublons dans les menus. Elles sont ici, de gauche à
     droite, du plus précis au plus général, comme le lecteur d'un service de vidéo :
       - les vidéos, une pastille chacune (numéro, match ; la choisie dit sa source) :
         choisir celle sur qui agit la suite, à la télécommande comme au doigt ;
       - ce qu'on fait à la vidéo choisie : ⏮ ⏭ la source, ▶ direct quand il existe,
         ⋮ ses options ;
       - ce qu'on fait au lecteur : Ajouter, Plein écran, ⚙ Réglages (Disposition y est
         un sous-menu).
     « Pas de liens vers le vrai site, jamais » (25 octobre 2026) : le bouton ↗ Site est
     parti, comme « Ouvrir sur le site » du menu ⋮.
     ⏭ prend le focus quand la barre revient (focaliserCommandes). Les menus s'ouvrent
     par-dessus tout (js/mv-menu.js). */
  var mvToolbarHtml = '<div class="mv-bar-videos" id="mv-bar-videos" role="group" aria-label="Vidéos du lecteur"><span class="mv-title">Lecteur</span></div>'
      + '<div class="mv-bar-groupe mv-source-nav" role="group" aria-label="Vidéo choisie">'
      + '<button type="button" class="mv-tb-btn mv-tb-ic-seul" id="mv-src-prev" onclick="changerSourceActive(-1)" title="Source précédente de la vidéo choisie" aria-label="Source précédente"><span class="mv-tb-ic" aria-hidden="true">⏮</span></button>'
      + '<button type="button" class="mv-tb-btn" id="mv-src-next" onclick="changerSourceActive(1)" title="Source suivante de la vidéo choisie"><span class="mv-tb-ic" aria-hidden="true">⏭</span><span class="mv-tb-lb">Source<span class="mv-tb-lb-long"> suivante</span></span></button>'
      + '<button type="button" class="mv-tb-btn" id="mv-bar-direct" onclick="basculerDirectActif()" title="Basculer entre la page du site et le flux direct" hidden><span class="mv-tb-ic" aria-hidden="true">▶</span><span class="mv-tb-lb">Direct</span></button>'
      + '<button type="button" class="mv-tb-btn mv-tb-ic-seul" id="mv-bar-video-menu" onclick="ouvrirMenuVideoActive(this, event)" aria-haspopup="menu" aria-expanded="false" title="Options de la vidéo choisie" aria-label="Options de la vidéo choisie"><span class="mv-tb-ic" aria-hidden="true">⋮</span><span class="mv-tb-lb mv-tb-lb-tel">Vidéo</span></button>'
      + '</div>'
      + '<div class="sp"></div>'
      + '<div id="mv-actions-menu" class="mv-bar-groupe mv-actions" role="group" aria-label="Lecteur">'
      + '<button type="button" class="mv-tb-btn primary" onclick="showMatchSelector(event)" title="Choisir un match à ajouter"><span class="mv-tb-ic mv-tb-plus" aria-hidden="true">+</span><span class="mv-tb-lb">Ajouter</span></button>'
      + '<button type="button" class="mv-tb-btn" onclick="toggleFullscreen(document.getElementById(\'mv-grid-wrapper\'))" title="Plein écran"><span class="mv-tb-ic" aria-hidden="true">⛶</span><span class="mv-tb-lb">Plein écran</span></button>'
      + '<button type="button" class="mv-tb-btn" id="mv-more-btn" onclick="ouvrirMenuBarre(this, event)" aria-haspopup="menu" aria-expanded="false" title="Réglages du lecteur"><span class="mv-tb-ic" aria-hidden="true">⚙</span><span class="mv-tb-lb">Réglages</span></button>'
      + '</div>';

    mvToolbar.innerHTML = mvToolbarHtml;


    var mvGridWrapper = document.createElement('div');

    mvGridWrapper.id = 'mv-grid-wrapper';
    mvGridWrapper.style.cssText = 'display:flex; flex:1; width:100%; overflow:hidden; background:#000;direction:ltr;';

    var mvGrid = document.createElement('div');
    mvGrid.id = 'mv-grid';
    mvGrid.style.cssText = 'flex:1;display:grid;gap:2px;background:#000;';

    mvGridWrapper.appendChild(mvGrid);

    var exitTheaterBtn = document.createElement('button');
    exitTheaterBtn.id = 'mv-exit-theater';
    exitTheaterBtn.innerHTML = 'Quitter le Plein Onglet';
    exitTheaterBtn.style.cssText = 'position:absolute;top:20px;left:50%;transform:translateX(-50%);z-index:999;background:rgba(0,0,0,0.8);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:20px;padding:8px 16px;cursor:pointer;display:none;backdrop-filter:blur(5px);font-weight:bold;box-shadow:0 4px 12px rgba(0,0,0,0.5);opacity:0;transition:opacity 0.15s;';


    window.addEventListener('message', function(e) {
        if (e.data === 'mv_frame_clicked') {
            var idxClic = indexDeTuilePour(e.source);
            if (idxClic >= 0) {
                noterPointeur(false);   // un clic dans une tuile : le pointeur est dans la page
                noterClicTuile();
                if (activeMvIdx !== idxClic) focusStream(idxClic);
                mvFlux[idxClic]._dernierGeste = Date.now();
                donnerLeSon(idxClic, 'geste');
            }
        }
        /* Pointeur et clavier vus dans une tuile, pour la garde « Quitter le site ? »
           (voir `utilisateurPart`). Un cadre ne quitte la fenêtre par le haut que s'il
           en touche le haut : sinon le pointeur entre dans la page, qui le voit. Une tuile
           du second écran est dans une autre fenêtre. */
        if (e.data && typeof e.data === 'object' && e.data.__mv === 'pointeur') {
            var idxP = indexDeTuilePour(e.source);
            if (idxP < 0) return;
            if (!e.data.dehors) { noterPointeur(false); return; }
            var cadreP = cadreDeTuile(idxP);
            if (cadreP && cadreP.ownerDocument === document && cadreP.getBoundingClientRect().top <= 1) noterPointeur(true);
            return;
        }
        if (e.data && typeof e.data === 'object' && e.data.__mv === 'touche') {
            if (indexDeTuilePour(e.source) >= 0) {
                noterTouche(e.data.modificateur, e.data.depart);
                if (e.data.modificateur || e.data.depart) {
                    depart.nomTouche = (e.data.bouton ? 'bouton Précédent ou Suivant de la souris' : (e.data.depart ? 'F5 ou Ctrl+R' : 'Ctrl, Cmd ou Alt')) + ' (dans la vidéo)';
                    depart.nomToucheAt = horlogeDepart();
                }
            }
            return;
        }
        /* Le son a été refusé par le navigateur dans la tuile (le script utilisateur a
           dû remuer la vidéo pour qu'elle continue de jouer). */
        if (e.data && typeof e.data === 'object' && e.data.__mv === 'sound_state' && e.data.blocked) {
            var idxSon = indexDeTuilePour(e.source);
            if (idxSon >= 0) noterSonBloque(idxSon);
            return;
        }
        /* « Vidéo en lecture » (ou plus), envoyé par multiview-cleaner.user.js depuis le
           cadre où joue le lecteur — souvent un cadre imbriqué, d'où la remontée des
           parents. C'est le seul signal fiable que quelque chose joue : depuis
           l'application, une iframe d'origine croisée est opaque. */
        /* Le script a vu passer le manifeste vidéo (.m3u8/.mpd) que le lecteur de la page
           demande : on le retient pour ce lien (registre local, 3 h) et le bouton
           « ▶ direct » apparaît sur la tuile. Le premier vu est le manifeste maître. */
        if (e.data && typeof e.data === 'object' && e.data.__mv === 'media_url' && typeof e.data.url === 'string') {
            var idxM = indexDeTuilePour(e.source);
            if (idxM < 0 || !estManifeste(e.data.url)) return;
            var sm = mvFlux[idxM];
            if (sm._media) return;
            sm._media = { url: e.data.url, pageUrl: String(e.data.pageUrl || ''), at: Date.now() };
            safeStorageSetJSON('direct_media', retenirMediaDirect(registreDirect(), sm.url, sm._media));
            saveMultivisionState();
            rafraichirPastille(idxM);
            return;
        }
        /* Débit et définition réels, mesurés par le script pendant que le flux joue.
           Retenus par adresse de flux pour que la LISTE des sources puisse les montrer,
           bien après que la tuile ait été fermée (voir js/debit.js). */
        if (e.data && typeof e.data === 'object' && e.data.__mv === 'video_stats') {
            var idxS = indexDeTuilePour(e.source);
            if (idxS < 0) return;
            var sS = mvFlux[idxS];
            var mesure = { kbps: e.data.kbps, w: e.data.w, h: e.data.h };
            safeStorageSetJSON('debits', noterMesure(safeStorageGetJSON('debits', {}) || {}, sS.url, mesure));
            sS._mesure = mesure;
            rafraichirPastille(idxS);
            return;
        }
        if (e.data && typeof e.data === 'object' && e.data.__mv === 'video_state') {
            var idx = indexDeTuilePour(e.source);
            if (idx < 0) return;
            var s = mvFlux[idx];
            var joue = !!e.data.playing;
            if (joue && !s._playing) {
                s._playing = true;
                couperMinuteur(s, 'auto');
                /* La vidéo est revenue d'elle-même : le rechargement armé par l'arrêt
                   n'a plus lieu d'être. Un ré-tampon ne coûte donc rien. */
                couperMinuteur(s, 'reprise');
                /* La source a PROUVÉ qu'elle joue. Si elle lâche plus tard, elle a droit
                   à ses essais entiers plutôt qu'au reliquat de son démarrage. */
                s._essais = 0;
                /* Depuis quand elle joue : c'est ce qui distingue le flux qu'on regardait
                   depuis dix minutes du flux qui ne tient jamais deux secondes, et qu'il
                   ne sert à rien de recharger en boucle (budgetReprise). */
                s._joueDepuis = Date.now();
                /* L'adresse qui a JOUÉ dans cette tuile. Un arrêt est d'abord un hoquet :
                   on recharge. On ne change de source qu'une fois ces essais épuisés
                   (actionSansVideo). */
                s._aJoueUrl = s._currentUrl || s.url;
                retirerChargement(celluleDeTuile(idx));
                if (!s._playNoted) { s._playNoted = true; notePlayability(lienDuMatchPourFlux(s, s.url) || { url: s.url }, 'plays'); }
                /* Son automatique : la vidéo existe et joue, c'est maintenant que le son
                   peut lui être rendu — avant, le navigateur refusait et le script
                   utilisateur remettait le muet pour obtenir la lecture. */
                donnerLeSon(idx, 'joue');
            } else if (!joue && s._playing) {
                s._playing = false;
                armerRepriseTuile(s, e.data);
            }
            rafraichirPastille(idx);
        }
    });

    window.addEventListener('blur', function() {
        setTimeout(function() {
            var activeElement = document.activeElement;
            if (activeElement && activeElement.tagName === 'IFRAME' && activeElement.classList.contains('mv-iframe')) {
                var idx = parseInt(activeElement.id.replace('mv-iframe-', ''));
                if (!isNaN(idx)) {
                    if (activeMvIdx !== idx) {
                        focusStream(idx);
                    }
                }
            }
        }, 100);
    });

    // Auto-hide the exit theater button after 3 seconds
    var theaterTimeout;
    mvContainer.addEventListener('mousemove', function() {
        if (mvContainer.classList.contains('theater-mode')) {
            exitTheaterBtn.style.opacity = '1';
            clearTimeout(theaterTimeout);
            theaterTimeout = setTimeout(function() {
                exitTheaterBtn.style.opacity = '0';
            }, 3000);
        }
    });

    exitTheaterBtn.onclick = function() { toggleTheaterMode(document.getElementById('mv-grid-wrapper')); };

    mvContainer.appendChild(mvToolbar);
    mvContainer.appendChild(mvGridWrapper);
    mvContainer.appendChild(exitTheaterBtn);
    document.body.appendChild(mvContainer);
 restoreMultivisionState();


    if (!window._mvKeydownAttached) {
        window.addEventListener('keydown', function(e) {
            var mvc = document.getElementById('mv-container');
            if (!mvc || mvc.style.display === 'none') return;

            var activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
            if (activeTag === 'input' || activeTag === 'textarea') return;

            var key = e.key;
            /* Mode câble au clavier : les mêmes deux axes que le doigt, sur la tuile
               active. Seulement quand le mode est allumé — sans lui, les flèches
               restent au navigateur et à la navigation TV. */
            if (modeCable && mvFlux.length && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
                var idxCable = (activeMvIdx !== null && activeMvIdx < mvFlux.length) ? activeMvIdx : 0;
                var dirs = { ArrowUp: 'haut', ArrowDown: 'bas', ArrowLeft: 'gauche', ArrowRight: 'droite' };
                gesteCable(idxCable, dirs[key]);
                e.preventDefault();
                return;
            }
            if (['1', '2', '3', '4'].includes(key)) {
                var targetIdx = parseInt(key) - 1;
                if (targetIdx >= 0 && targetIdx < mvFlux.length) {
                    if (targetIdx === 0) {
                        focusStream(0);
                    } else {
                        var item = mvFlux.splice(targetIdx, 1)[0];
                        mvFlux.unshift(item);

                        saveMultivisionState();
                        updateMultivisionLayout();
                        focusStream(0);
                    }
                }
            } else if (['5', '6', '7', '8'].includes(key)) {
                var targetIdx = parseInt(key) - 5;
                if (targetIdx > 0 && targetIdx < mvFlux.length) {
                    // Moving item to front without changing active stream focus
                    var item = mvFlux.splice(targetIdx, 1)[0];
                    mvFlux.unshift(item);

                    // Adjust activeMvIdx to keep focus on the same stream
                    if (activeMvIdx === targetIdx) {
                        activeMvIdx = 0; // The active stream was moved to front
                    } else if (activeMvIdx !== null && activeMvIdx < targetIdx) {
                        activeMvIdx++; // The active stream was shifted right
                    }

                    saveMultivisionState();
                    updateMultivisionLayout();
                    applyMvFocusStyling();
                    applyMvAudioState();
                }
            }
        });
        window._mvKeydownAttached = true;
    }


window.mvIdleTimer = null;
function reposRetenu() {
    var barre = document.getElementById('mv-toolbar');
    return !!(barre && barre._survolee);
}
/* Le repos du lecteur : trois secondes sans un geste, et la barre comme les en-têtes de
   tuiles s'effacent pour ne pas rester posés sur la vidéo.

   Tout cela cherchait ses éléments dans `#mv-container` et n'écoutait que lui. Or la
   fenêtre détachée (`toggleDocumentPiP`) DÉPLACE `#mv-grid-wrapper` — donc toutes les
   tuiles — dans un AUTRE document : plus aucun geste n'y atteignait `#mv-container`, et
   `mvContainer.querySelectorAll('.mv-hdr')` n'y trouvait plus rien. Les boutons de tuile
   restaient donc posés sur la vidéo, définitivement. On travaille désormais sur la
   grille là où elle se trouve (`grilleDuLecteur`), et `toggleDocumentPiP` fait écouter
   la fenêtre qui la porte. */
window.resetMvIdleTimer = function() {
        var grille = grilleDuLecteur();
        if (!grilleDetachee()) mvContainer.style.cursor = 'default';
        appliquerRepos(grille, document.getElementById('mv-toolbar'), false);
        reposSecondEcran(false);

        clearTimeout(window.mvIdleTimer);
        window.mvIdleTimer = setTimeout(function() {
            reposSecondEcran(true);
            var g = grilleDuLecteur();
            if (!g) return;
            var horsPage = grilleDetachee();
            var mvc = document.getElementById('mv-container');
            /* « Ça cache les menus » (9 octobre 2026). Deux cas où effacer ne rend
               service à personne : un menu du lecteur est ouvert (on le lit, la souris
               immobile — la barre disparaissait sous lui), ou le pointeur est posé sur
               la barre elle-même. On repousse le repos d'autant. */
            if (menuEstOuvert() || (!horsPage && reposRetenu())) { window.resetMvIdleTimer(); return; }
            if (!horsPage && mvc) mvc.style.cursor = 'none';
            /* Depuis le 25 octobre 2026 (« interface moderne », comme Netflix), la barre
               est posée en bas, PAR-DESSUS la vidéo (styles.css) : l'effacer rend l'image
               entière, et elle s'efface donc avec les en-têtes. Elle n'avait pas lieu de
               l'être quand elle avait sa propre bande au-dessus de la grille (10 octobre).
               Une grille déplacée dans une autre fenêtre laisse la barre ici : elle reste. */
            appliquerRepos(g, horsPage ? null : document.getElementById('mv-toolbar'), true);
        }, 3000);
    }

    mvContainer.addEventListener('mousemove', window.resetMvIdleTimer);
    /* Le pointeur qui ENTRE dans une tuile : l'iframe garde ensuite ses mouvements pour
       elle (origine croisée), mais son entrée, elle, se voit d'ici (`mouseover` sur
       l'élément iframe). Les commandes de la tuile visée réapparaissent donc dès qu'on
       y arrive, pas seulement en frôlant ses bords. */
    mvContainer.addEventListener('mouseover', window.resetMvIdleTimer);
    mvContainer.addEventListener('click', window.resetMvIdleTimer);
    mvToolbar.addEventListener('mouseenter', function() { mvToolbar._survolee = true; });
    mvToolbar.addEventListener('mouseleave', function() { mvToolbar._survolee = false; });
    mvContainer.addEventListener('touchstart', window.resetMvIdleTimer, {passive: true});

    /* La première touche, commandes effacées, ne fait que les montrer (comme Netflix) :
       une flèche ou OK n'agit pas à l'aveugle sur un bouton invisible. En mode câble, les
       flèches zappent quand même, comme un décodeur. Retour garde son chemin
       (window.retourTele). En capture : avant la navigation aux flèches. */
    window.addEventListener('keydown', function(e) {
        if (document.body.getAttribute('data-view') !== 'player') return;
        var etaientCachees = commandesCachees();
        window.resetMvIdleTimer();
        if (!etaientCachees) return;
        var fleche = /^Arrow/.test(e.key);
        if (!(fleche || e.key === 'Enter' || e.key === ' ')) return;
        if (fleche && modeCable) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        focaliserCommandes();
    }, true);

}



/* ══ AJUSTEMENT DU CONTENU D'UNE TUILE ═══════════════════════════════════════════
   Demande du 6 septembre 2026 : « fit content dans multiview ». Une tuile a rarement
   les proportions d'une vidéo : en grille 2×2 sur un écran large, elle est plus large
   que 16:9 ; en colonne, plus haute. Trois façons de poser le lecteur dedans :
     - stretch : le cadre prend toute la tuile (comportement d'origine, la page du site
       se réorganise elle-même) ;
     - contain : le plus grand 16:9 qui tient dans la tuile, centré — toute la vidéo
       visible, bandes noires possibles ;
     - cover   : le plus petit 16:9 qui couvre la tuile — plus de bandes, bords rognés.
   Le calcul est fait par la feuille de style (unités de conteneur cqw/cqh) : aucun
   observateur de redimensionnement, la tuile suit la grille toute seule. Le choix est
   retenu par tuile (s.fit, sauvegardé avec mv_state). */
export var MV_FIT_MODES = {
    stretch: { icon: '⤢', label: 'étiré',  next: 'contain' },
    contain: { icon: '▭', label: 'ajusté', next: 'cover' },
    cover:   { icon: '⛶', label: 'rempli', next: 'stretch' }
};
export function applyMvFit(cell, s) {
    var vc = cell && cell.querySelector('.mv-video-container');
    if (!vc) return;
    var mode = (s && MV_FIT_MODES[s.fit]) ? s.fit : 'stretch';
    vc.classList.remove('fit-stretch', 'fit-contain', 'fit-cover');
    vc.classList.add('fit-' + mode);
}
export function setMvFit(idx, mode) {
    var s = mvFlux[idx];
    if (!s || !MV_FIT_MODES[mode]) return;
    s.fit = mode;
    saveMultivisionState();
    updateMultivisionLayout();
}
export function cycleMvFit(idx) {
    var s = mvFlux[idx];
    if (!s) return;
    var next = (MV_FIT_MODES[s.fit] || MV_FIT_MODES.stretch).next;
    setMvFit(idx, next);
    showToast('Tuile ' + (idx + 1) + ' : contenu ' + MV_FIT_MODES[next].label);
}
/* Même ajustement pour toutes les tuiles d'un coup (bouton de la barre du Multivision). */
export function cycleMvFitAll() {
    if (!mvFlux.length) return;
    var current = mvFlux[0].fit || 'stretch';
    var next = (MV_FIT_MODES[current] || MV_FIT_MODES.stretch).next;
    mvFlux.forEach(function(s) { s.fit = next; });
    saveMultivisionState();
    updateMultivisionLayout();
    showToast('Toutes les tuiles : contenu ' + MV_FIT_MODES[next].label);
}
window.applyMvFit = applyMvFit;
window.setMvFit = setMvFit;
window.cycleMvFit = cycleMvFit;
window.cycleMvFitAll = cycleMvFitAll;

export function moveMultiviewStream(idx, direction) {
    if (idx < 0 || idx >= mvFlux.length) return;

    var targetIdx;
    if (direction === 'left' || direction === 'up') {
        targetIdx = idx - 1;
    } else if (direction === 'right' || direction === 'down') {
        targetIdx = idx + 1;
    }

    if (targetIdx < 0 || targetIdx >= mvFlux.length) return;

    // Swap the elements in the array
    var temp = mvFlux[idx];
    mvFlux[idx] = mvFlux[targetIdx];
    mvFlux[targetIdx] = temp;

    if (activeMvIdx === idx) {
        activeMvIdx = targetIdx;
    } else if (activeMvIdx === targetIdx) {
        activeMvIdx = idx;
    }

    saveMultivisionState();
    updateMultivisionLayout();
    applyMvFocusStyling();
    applyMvAudioState();
}

/* ══ PERSISTENCE MULTIVISION ═══════════ */
export function saveMultivisionState() {
    safeStorageSetJSON('mv_state', { flux: mvFlux, layout: mvLayout, horsCable: fluxHorsCable });
}

export function restoreMultivisionState() {
    try {
        var parsed = safeStorageGetJSON('mv_state');
        if(parsed) {

            // Backward compatibility with just array
            if(Array.isArray(parsed) && parsed.length > 0) {
                mvFlux = parsed;
                setTimeout(function() {
                    updateMultivisionLayout();
                }, 500);
            } else if (parsed && parsed.flux && Array.isArray(parsed.flux)) {
                mvFlux = parsed.flux;
                if (parsed.layout) mvLayout = parsed.layout;
                /* Les vidéos mises de côté en entrant dans le mode câble : elles doivent
                   survivre à un rechargement, sinon éteindre le mode après une reprise de
                   session les perdrait sans rien dire. */
                if (Array.isArray(parsed.horsCable)) fluxHorsCable = parsed.horsCable;
                setTimeout(function() {
                    updateMultivisionLayout();
                }, 500);
            }
            /* Les compteurs d'une tuile sont sérialisés avec elle, et ils ne veulent rien
               dire dans une session neuve : une tuile restaurée avec ses deux essais déjà
               dépensés serait quittée au premier silence, sans le rechargement qu'on vient
               de lui accorder. Un onglet rouvert est un premier chargement. */
            mvFlux.forEach(function(s) { delete s._essais; delete s._essaisUrl; delete s._reprises; delete s._fenetreReprise; delete s._joueDepuis; delete s._dernierGeste; delete s._aJoueUrl; });
            /* Des tuiles restaurées au démarrage ne passent pas par addToMultivision :
               sans cela, une session reprise ne relisait plus jamais ses sources. */
            if (mvFlux.length) armerRafraichissementTuiles();

            var sortie = safeStorageGetJSON(CLE_SORTIE);
            if (sortie) {
                try { localStorage.removeItem(CLE_SORTIE); } catch (e) {}
                var marquees = marquerSortiesForcees(mvFlux, sortie, Date.now());
                if (marquees) {
                    setTimeout(function() {
                        showToast('Un flux a fait sortir la page du lecteur : il n\'a pas été rechargé (voir la tuile).');
                    }, 800);
                }
            }
        }
    } catch(e) {}
}

// Layout state
export var mvLayout = 'auto'; // auto, focus, vertical, horizontal, custom

export function setMvLayout(l) {
    mvLayout = l;
    window.mvLayout = l;
}
export var activeMvIdx = null;

export function focusStream(idx) {
    if (idx < 0 || idx >= mvFlux.length) return;

    activeMvIdx = idx;
    applyMvFocusStyling();
    applyMvAudioState();

    if (typeof updateMvGameModeStats === 'function') {
        updateMvGameModeStats();
    }
}

export function applyMvFocusStyling() {
    majBarreVideos();
    var cells = toutesLesCellules();
    cells.forEach(function(cell) {
        var idx = parseInt(cell.dataset.index);
        if (idx === activeMvIdx) {
            cell.style.boxShadow = 'inset 0 0 0 2px rgba(150, 150, 150, 0.6)';
        } else {
            cell.style.boxShadow = 'none';
        }
    });
}

export function applyMvAudioState() {
    // Determine which stream should be unmuted.
    // If activeMvIdx is null or out of bounds, unmute the first one (0) or default logic.
    var targetIdx = activeMvIdx !== null && activeMvIdx < mvFlux.length ? activeMvIdx : (mvFlux.length > 0 ? 0 : null);

    mvFlux.forEach(function(s, idx) {
        var iframe = cadreDeTuile(idx);
        if (iframe && iframe.tagName === 'VIDEO') { iframe.muted = (idx !== targetIdx); return; }
        if (iframe && iframe.contentWindow) posterATuile(iframe, idx === targetIdx ? 'mv_unmute' : 'mv_mute');
    });
}


/* ── SON AUTOMATIQUE ─────────────────────────────────────────────────────────────
   « Son automatique on » (13 septembre 2026).

   Un navigateur REFUSE une lecture automatique avec le son : la vidéo doit démarrer
   muette, et le son ne peut lui être rendu qu'ENSUITE, une fois qu'elle joue et que la
   page a reçu une activation. L'application ne faisait que la première moitié du
   chemin : `applyMvAudioState` envoie `mv_unmute` à la tuile active au moment où on la
   pose — donc AVANT que la vidéo ne joue. Le script utilisateur coupait alors le son
   pour obtenir la lecture (c'est son repli), et personne ne revenait le rendre : on
   regardait un match muet en cherchant le bouton.

   Trois moments, donc, et un seul point de décision (`donnerLeSon`) :
     - la tuile annonce qu'elle JOUE (`video_state`) — le bon moment, la vidéo existe ;
     - un clic est fait DANS son cadre (`mv_frame_clicked`) — une activation fraîche,
       que le navigateur accepte, et la seule sortie quand il a refusé une fois ;
     - la tuile devient celle qu'on regarde (`focusStream`, chemin existant).

   Si le son est refusé, la tuile le dit (`sound_state`, blocked) : on note le refus,
   on le dit UNE fois, et on n'insiste plus jusqu'au prochain geste — insister ferait
   osciller la lecture entre muet et arrêté. Réglage retenu sous `son_auto`, allumé
   par défaut, parce que c'est la demande ; le menu ⚙ Réglages le coupe. */
export var sonAuto = true;
try { sonAuto = (localStorage.getItem('son_auto') !== '0'); } catch (e) { sonAuto = true; }

export function setSonAuto(v) {
    sonAuto = !!v;
    try { localStorage.setItem('son_auto', sonAuto ? '1' : '0'); } catch (e) {}
    if (sonAuto) mvFlux.forEach(function(s) { s._sonBloque = false; });
    applyMvAudioState();
    return sonAuto;
}

export function toggleSonAuto() {
    fermerMenus();
    var actif = setSonAuto(!sonAuto);
    showToast(actif
        ? '🔊 Son automatique : la vidéo qu\'on regarde prend le son dès qu\'elle joue.'
        : '🔇 Son automatique coupé : les tuiles restent muettes jusqu\'à ce qu\'on le demande.');
    return actif;
}

/* Rend le son à la tuile `idx` si c'est bien celle qu'on regarde. `raison` vaut 'joue'
   (la vidéo vient de démarrer), 'geste' (un clic dans le cadre : on retente même après
   un refus) ou 'focus'. Rend true si la demande a été faite. */
export function donnerLeSon(idx, raison) {
    if (!sonAuto) return false;
    var s = mvFlux[idx];
    if (!s) return false;
    var cible = (activeMvIdx !== null && activeMvIdx < mvFlux.length) ? activeMvIdx : (mvFlux.length ? 0 : -1);
    if (idx !== cible) return false;
    if (s._sonBloque && raison !== 'geste') return false;
    if (raison === 'geste') s._sonBloque = false;
    applyMvAudioState();
    return true;
}

/* La tuile dit que le navigateur a refusé le son : on le note, on le dit une fois, et
   on attend un geste. Sans cette mémoire, chaque `video_state` relancerait une demande
   que le navigateur refusera de la même façon. */
export function noterSonBloque(idx) {
    var s = mvFlux[idx];
    if (!s || s._sonBloque) return false;
    s._sonBloque = true;
    if (!window._sonBloqueDit) {
        window._sonBloqueDit = true;
        showToast('Le navigateur refuse le son sans un geste : touchez la vidéo une fois et il restera.');
    }
    return true;
}

/* Disposition réellement rendue. En portrait (téléphone, tablette debout), deux tuiles
   côte à côte font deux bandes de la largeur d'un pouce : on les empile, quel que soit le
   choix retenu — qui reste intact et reprend en paysage. */
function lecteurJamaisMontre(mvc, grid, grid2) {
    if (!mvc || mvc.style.display !== 'none') return false;
    if (grid2 || grid.ownerDocument !== document) return false;
    return !grid.querySelector('.mv-cell');
}

/* Les tuiles posées dans un même passage partent l'une après l'autre, pas ensemble :
   quatre pages lourdes demandées à la même milliseconde se partagent le réseau et le
   processeur, et aucune n'apparaît vite. La première part tout de suite. */
export var ECART_CHARGEMENT_MS = 450;

/* Indicateur de chargement d'une tuile : une pastille au centre, qui ne prend aucun clic
   et ne couvre pas la page (une page qui peint vite reste visible autour). Retirée au
   `load` du cadre, au premier signal « joue », ou au bout de DUREE_CHARGEMENT_MS. */
export var DUREE_CHARGEMENT_MS = 15000;
function poserChargement(container, libelle) {
    var doc = container.ownerDocument || document;
    var el = doc.createElement('div');
    el.className = 'mv-chargement';
    el.setAttribute('role', 'status');
    el.innerHTML = '<span class="mv-chargement-roue" aria-hidden="true"></span><span class="mv-chargement-lb"></span>';
    el.querySelector('.mv-chargement-lb').textContent = libelle;
    container.appendChild(el);
    setTimeout(function() { el.remove(); }, DUREE_CHARGEMENT_MS);
    return el;
}
export function retirerChargement(cell) {
    if (!cell) return;
    Array.prototype.forEach.call(cell.querySelectorAll('.mv-chargement'), function(el) { el.remove(); });
}

function dispositionEffective(count) {
    if (count >= 2 && window.innerHeight > window.innerWidth) return 'vertical';
    return mvLayout;
}

export function updateMultivisionLayout() {
    /* La grille peut être dans la fenêtre détachée (une seule vidéo détachée entière). */
    var grid = document.getElementById('mv-grid') || (docPiPWindow && docPiPWindow.document ? docPiPWindow.document.getElementById('mv-grid') : null);
    if(!grid) return;

    var count = mvFlux.length;
    var layout = dispositionEffective(count);
    /* Deux écrans : la tuile 1 ici, les autres dans `#mv-grid-2` (js/deuxecrans.js). */
    var grid2 = secondeGrille();
    if (grid2) {
        var vide2 = grid2.ownerDocument.getElementById('mv-ecran2-vide');
        if (vide2) vide2.style.display = count <= 1 ? 'block' : 'none';
        grid2.style.display = count <= 1 ? 'none' : 'grid';
    }
    /* Deux écrans, fenêtre étirée : la disposition « une grande, les autres à côté », la
       grande calée sur le premier écran. Tout reste dans la page : rien ne recharge. */
    var etire = layout === 'ecrans' && count >= 2 && !grid2;
    var fractionEtire = etire ? fractionDeuxEcrans(grid) : null;
    if (layout === 'ecrans') layout = 'focus';
    if (etire) surveillerFenetreEtiree();

    // Assign internal IDs to streams for tracking DOM elements
    mvFlux.forEach(function(s, idx) {
        if (!s._internalId) s._internalId = 'mv-flux-' + Date.now() + '-' + idx;
    });

    // Remove old empty message if any
    var emptyMsg = document.getElementById('mv-empty-msg');
    if(count === 0) {
        if (!emptyMsg) {
            grid.innerHTML = '<div id="mv-empty-msg" class="mv-empty">'
                + '<div class="mv-empty-ic">📺</div>'
                + '<p>Aucune vidéo pour l\'instant.<br>Choisissez un match, puis une source : elle s\'affiche ici. Jusqu\'à quatre vidéos en même temps.</p>'
                + '<button class="btn primary lg" onclick="showMatchSelector(event)">➕ Choisir un match</button>'
                + '</div>';
        } else {
            // keep it
            if (grid2) Array.from(grid2.children).forEach(function(c) { detruireLecteursDe(c); c.remove(); });
            var children = Array.from(grid.children);
            children.forEach(function(child) {
                if (child.id !== 'mv-empty-msg') {
                    detruireLecteursDe(child);
                    grid.removeChild(child);
                }
            });
        }
        return;
    } else if (emptyMsg) {
        emptyMsg.remove();
    }

    var mvc = document.getElementById('mv-container');
    /* « Les lags de chargement » (9 octobre 2026). Au démarrage, les tuiles de la séance
       précédente (`mv_state`) étaient posées 500 ms après l'ouverture de l'application,
       lecteur fermé : jusqu'à quatre pages de diffusion, chargées de régies, se
       chargeaient en même temps que le calendrier et les liens, derrière le guide qu'on
       était en train de regarder. Tant que le lecteur n'a jamais été montré, on ne pose
       rien : son ouverture (`toggleMultiview`) redessine, et c'est là qu'elles partent.
       Un lecteur déjà peuplé puis mis en arrière-plan garde ses tuiles. */
    if (lecteurJamaisMontre(mvc, grid, grid2)) return;

    // Ensure we track custom column widths
    if (!grid._customCols) grid._customCols = {};

    // Reset grid styles before applying layout
    grid.style.display = 'grid';
    grid.style.flexWrap = '';
    grid.style.flexDirection = '';
    grid.style.overflowAuto = '';
    grid.style.alignContent = '';

    if (mvc) {
        if (mvc.classList.contains('mv-pip')) {
            // Always force vertical layout in PiP mode
            grid.style.gridTemplateColumns = '1fr';
            grid.style.gridTemplateRows = 'repeat(' + Math.max(1, count) + ', 1fr)';
        } else {
            if (layout === 'focus' && count >= 2) {
                var col1 = grid._customCols[0] ? grid._customCols[0] + 'fr' : '3fr';
                var col2 = grid._customCols[0] ? (1 - grid._customCols[0]).toFixed(3) + 'fr' : '1fr';
                if (fractionEtire) { col1 = fractionEtire + 'fr'; col2 = (1 - fractionEtire).toFixed(3) + 'fr'; }
                grid.style.gridTemplateColumns = col1 + ' ' + col2;
                grid.style.gridTemplateRows = 'repeat(' + (count - 1) + ', 1fr)';
            } else if (layout === 'vertical') {
                grid.style.gridTemplateColumns = '1fr';
                grid.style.gridTemplateRows = 'repeat(' + count + ', 1fr)';
            } else if (layout === 'horizontal') {
                var template = '';
                var usedFr = 0;
                var remainingCols = count - Object.keys(grid._customCols).length;
                for (var c in grid._customCols) usedFr += parseFloat(grid._customCols[c]);
                var remainingFr = 1 - usedFr;

                for (var i = 0; i < count; i++) {
                    template += (grid._customCols[i] ? grid._customCols[i] + 'fr ' : (remainingCols > 0 ? (remainingFr / remainingCols).toFixed(3) : 0) + 'fr ');
                }
                grid.style.gridTemplateColumns = template.trim();
                grid.style.gridTemplateRows = '1fr';
            } else {
                // auto / Grid Mode Layout
                if(count === 1) {
                    grid.style.gridTemplateColumns = '1fr';
                    grid.style.gridTemplateRows = '1fr';
                } else if(count === 2) {
                    var col1 = grid._customCols[0] ? grid._customCols[0] + 'fr' : '1fr';
                    var col2 = grid._customCols[0] ? (1 - grid._customCols[0]).toFixed(3) + 'fr' : '1fr';
                    grid.style.gridTemplateColumns = col1 + ' ' + col2;
                    grid.style.gridTemplateRows = '1fr';
                } else if(count === 3) {
                    var col1 = grid._customCols[0] ? grid._customCols[0] + 'fr' : '1fr';
                    var col2 = grid._customCols[0] ? (1 - grid._customCols[0]).toFixed(3) + 'fr' : '1fr';
                    grid.style.gridTemplateColumns = col1 + ' ' + col2;
                    grid.style.gridTemplateRows = '1fr 1fr';
                } else if(count >= 4) {
                    var col1 = grid._customCols[0] ? grid._customCols[0] + 'fr' : '1fr';
                    var col2 = grid._customCols[0] ? (1 - grid._customCols[0]).toFixed(3) + 'fr' : '1fr';
                    grid.style.gridTemplateColumns = col1 + ' ' + col2;
                    grid.style.gridTemplateRows = '1fr 1fr';
                }
            }
        }
    }    // Existing cells
    var existingCells = Array.from(grid.children).concat(grid2 ? Array.from(grid2.children) : []).filter(function(child) {
        return child.hasAttribute('data-internal-id');
    });
    var placement2 = grid2 ? placementSecondEcran(count - 1) : null;
    if (grid2) {
        grid2.style.gridTemplateColumns = placement2.colonnes;
        grid2.style.gridTemplateRows = placement2.lignes;
    }

    // Create or update cells
    var nouvellesTuiles = 0;
    mvFlux.forEach(function(s, idx) {
        var cellId = s._internalId;
        var cellClass = 'mv-cell';
        var cell = existingCells.find(function(c) { return c.getAttribute('data-internal-id') === cellId; });

        if (!cell) {
            cell = document.createElement('div');
            cell.setAttribute('data-internal-id', cellId);
            cell.classList.add('mv-cell');
            cell.dataset.index = idx;
            cell.style.cssText = 'position:relative;background:#111;display:flex;flex-direction:column;cursor:default;overflow:hidden;resize:horizontal;padding-right:8px;';

            var hdr = document.createElement('div');
            hdr.className = 'mv-hdr';

            var videoContainer = document.createElement('div');
            videoContainer.className = 'mv-video-container';
            videoContainer.style.cssText = 'flex:1;position:relative;width:100%;height:100%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#000;';

            var overlay = document.createElement('div');
            overlay.className = 'mv-idle-overlay';
            overlay.style.cssText = 'position:absolute;inset:0;z-index:5;display:none;';

            cell.appendChild(hdr);
            cell.appendChild(videoContainer);
            cell.appendChild(overlay);
            grid.appendChild(cell);

            /* Le calque de gestes du mode câble : posé une fois, montré seulement quand
               le mode est allumé (majSurfacesCable). */
            poserSurfaceCable(cell, idx);

            overlay.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                window.resetMvIdleTimer();
            });
            overlay.addEventListener('touchstart', function(e) {
                e.stopPropagation();
                window.resetMvIdleTimer();
            }, {passive: true});

            var retard = (nouvellesTuiles++) * ECART_CHARGEMENT_MS;
            if (!retard) fallbackToIframe(s.url, videoContainer, cell, s);
            else {
                var urlPrevue = s.url;
                s._currentUrl = urlPrevue;
                poserChargement(videoContainer, 'En attente…');
                setTimeout(function() {
                    if (!cell.isConnected || s.url !== urlPrevue || s._currentUrl !== urlPrevue) return;
                    fallbackToIframe(urlPrevue, videoContainer, cell, s);
                }, retard);
            }
        }

        /* Pose un flux dans la cellule : la PAGE du match, telle que le site la sert.

           Décision du 6 septembre 2026, après des semaines sans vidéo : « remet les pages
           complètes que le script nuke, plus de trucs direct vers vidéos, reconstruire
           marche pas ». Le lecteur extrait par le serveur et la page reconstruite en
           `srcdoc` sont retirés de la tuile ; il ne reste que ce qui a marché sur Chrome —
           charger la page entière et laisser multiview-cleaner.user.js ne garder que la
           vidéo. Une page qui refuse l'iframe affiche l'écran du navigateur : c'est alors
           au navigateur qu'on s'adresse (extension qui ignore X-Frame-Options, voir la
           page d'installation), pas à la tuile. */
        function fallbackToIframe(url, container, cell, s) {
            if (s.mode === 'direct') {
                var mediaDirect = s._media || mediaDirectPour(registreDirect(), url);
                if (mediaDirect) { poserDirect(mediaDirect, url, container, cell, s); return; }
                s.mode = 'page';
            }
            if (natifCourant && natifCourant.s === s) fermerNatif();
            detruireLecteursDe(container);
            container.innerHTML = '';
            s._currentUrl = url;
            if (s._sortieForcee) {
                /* La page ne peut pas repartir dans la tuile : la reposer relance la
                   sortie. On charge la source suivante, une fois. Le panneau ne reste
                   que s'il n'y a rien d'autre. « Charger quand même » est sur ce panneau,
                   et sur un choix manuel de cette adresse. */
                if (nextFluxForTile(parseInt(cell.dataset.index, 10), 'auto')) return;
                poserAvertissementSortie(container, cell, s); return;
            }
            poserChargement(container, 'Chargement de la vidéo…');
            resolveStreamUrl(url).then(function(finalUrl) {
                if (s._currentUrl !== url) return;
                container.innerHTML = '';

                var iframe = document.createElement('iframe');
                iframe.className = 'mv-media mv-iframe';
                /* L'identifiant dès la création (4 octobre 2026, « ça unmute avec plusieurs
                   players mais pas un ») : il n'était posé qu'au redessin SUIVANT de la grille.
                   Avec plusieurs vidéos, chaque ajout redessine ; avec une seule, rien ne venait
                   après, et `cadreDeTuile` ne trouvait pas le cadre — ni ordre de son envoyé,
                   ni « joue », ni clic reconnus pour cette tuile. */
                iframe.id = 'mv-iframe-' + parseInt(cell.dataset.index, 10);
                /* Fond noir et `color-scheme: dark` sur le cadre lui-même (8 septembre 2026,
                   « background toujours blanc ») : tant que la page du site n'a rien peint —
                   chargement, page vide, lecteur qui n'occupe pas toute la hauteur — le
                   navigateur affichait du BLANC au milieu d'une application sombre. Ces deux
                   déclarations valent pour la zone que le cadre n'a pas encore peinte, et pour
                   les pages qui ne fixent pas leur propre fond. Une page qui, elle, déclare un
                   fond blanc reste blanche : son document est d'une autre origine, aucune
                   feuille de style d'ici ne l'atteint — c'est le script utilisateur qui la
                   nettoie, ou le bouton ⤢ de la tuile qui recadre sur la vidéo. */
                iframe.style.cssText = 'width:100%;height:100%;border:none;pointer-events:auto;transition:transform 0.15s;background:#000;color-scheme:dark;';
                iframe.setAttribute('allowfullscreen', 'true');
                /* Permissions du cadre (js/lecteurdirect.js, PERMISSIONS_CADRE) : plein écran,
                   lecture automatique, présentation, déchiffrement par le navigateur
                   (encrypted-media : un lecteur ClearKey ou Widevine se tait sans elle),
                   image dans l'image. */
                iframe.setAttribute('allow', PERMISSIONS_CADRE);
                /* Aucun attribut `sandbox` : retiré le 5 septembre 2026 sur demande répétée de
                   l'utilisateur (« Sandbox detected, please remove sandbox attributes »). Le test
                   « aucune iframe de lecteur ne porte d'attribut sandbox » le verrouille. */
                container.appendChild(iframe);
                if (!estLecteurOfficiel(finalUrl)) demanderNettoyage(iframe);

                s._posedAt = Date.now(); // pour reconnaître une sortie forcée (pagehide juste après)
                s._poseeUrl = url;     // … et l'adresse posée à cet instant (sautManuelEstEchec)
                if (estMediaDirecte(finalUrl)) {
                    iframe = versVideoSiDirect(iframe, finalUrl, container);
                } else {
                    poserChargement(container, 'Chargement de ' + (getDomain(finalUrl) || 'la vidéo') + '…');
                    iframe.addEventListener('load', function() { retirerChargement(cell); }, { once: true });
                    iframe.src = finalUrl;
                    if (!estLecteurOfficiel(finalUrl)) poserTampon();
                }

                s._playing = false;
                armerBasculeAuto(s, parseInt(cell.dataset.index, 10), url);

                cell.addEventListener('mousedown', function() { iframe.style.pointerEvents = 'none'; });
                cell.addEventListener('mouseup', function() { if (window.draggedMvIdx == null) iframe.style.pointerEvents = 'auto'; });
                cell.addEventListener('mouseleave', function() { if (window.draggedMvIdx == null) iframe.style.pointerEvents = 'auto'; });

                iframe.style.transform = s.cropped ? 'scale(1.15)' : 'scale(1)';
            });
        }

        // Use CSS flex/grid order to reorder elements without removing them from the DOM
        cell.style.order = idx;

        cell.dataset.index = idx;


        // Update styling/gridRow
        if (!document.getElementById('mv-container').classList.contains('mv-pip')) {
            cell.style.width = '100%';
            cell.style.height = '100%';
            // Enable horizontal resize only on elements that represent a column boundary
            cell.style.resize = 'horizontal'; cell.style.paddingRight = '8px';
            cell.style.overflow = 'hidden';

            var colIndex = 0;


            if (layout === 'focus' && count >= 2) {
                if (idx === 0) {
                    cell.style.gridRow = 'span ' + (count - 1);
                    cell.style.gridColumn = '1';
                    colIndex = 0;
                } else {
                    cell.style.gridRow = 'auto';
                    cell.style.gridColumn = '2';
                    colIndex = 1;
                    cell.style.resize = 'none'; cell.style.paddingRight = '0'; // Only resize main focus col
                }
            } else if (layout === 'auto' && count === 3 && idx === 0) {
                cell.style.gridRow = 'span 2';
                cell.style.gridColumn = '1'; // Force column 1
                colIndex = 0;
            } else {
                cell.style.gridRow = 'auto';

                if (layout === 'horizontal') {
                    cell.style.gridColumn = 'auto';
                    colIndex = idx;
                    if (idx === count - 1) { cell.style.resize = 'none'; cell.style.paddingRight = '0'; } // No need to resize last col
                } else if (layout === 'vertical') {
                    cell.style.gridColumn = '1';
                    colIndex = 0;
                    cell.style.resize = 'none'; cell.style.paddingRight = '0'; // Only one column, no horizontal resizing
                } else {
                    // Standard auto mode (usually 2 cols)
                    if (count === 3) {
                        cell.style.gridColumn = '2';
                        colIndex = 1;
                    } else {
                        colIndex = (idx % 2 === 0) ? 0 : 1;
                        cell.style.gridColumn = 'auto';
                    }
                    if (colIndex === 1 || count === 1) { cell.style.resize = 'none'; cell.style.paddingRight = '0'; }
                }
            }
            // Assign col index for tracking
            cell.dataset.col = colIndex.toString();

            // Reset inline width from previous resizes so CSS Grid takes over
            cell.style.width = '';

            // Attach observer to detect resizing and update the grid template
            if (!cell._hasResizeObserver && cell.style.resize !== 'none') {
                cell._hasResizeObserver = new ResizeObserver(function(entries) {
                    var isPip = document.getElementById('mv-container').classList.contains('mv-pip');
                    if (isPip) return;

                    for (var i = 0; i < entries.length; i++) {
                        var target = entries[i].target;
                        // Only react if width was injected via user resizing
                        if (target.style.width && target.style.width !== '' && target.style.width !== '100%') {
                            var w = target.offsetWidth;
                            var gridWidth = grid.offsetWidth;

                            // Convert pixel width to fractional unit (fr)
                            var fraction = w / gridWidth;
                            // Ensure fraction stays within bounds (5% to 95%)
                            fraction = Math.max(0.05, Math.min(0.95, fraction));

                            var colIdx = parseInt(target.dataset.col);
                            if (!isNaN(colIdx)) {
                                grid._customCols[colIdx] = fraction.toFixed(3); // Store as fr
                                // clear the inline width so the grid template enforces it
                                target.style.width = '';

                                // Calculate total custom fr applied to other columns (for horizontal)
                                var usedFr = 0;
                                for (var c in grid._customCols) {
                                    if (parseInt(c) !== colIdx) usedFr += parseFloat(grid._customCols[c] || 0);
                                }


                                // Re-apply grid template proportionally
                                if (layout === 'focus' && count >= 2) {
                                    grid.style.gridTemplateColumns = grid._customCols[0] + 'fr ' + (1 - fraction).toFixed(3) + 'fr';
                                } else if (layout === 'horizontal') {
                                    var template = '';
                                    var remainingFr = 1 - usedFr - fraction;
                                    if (remainingFr < 0.05 * count) remainingFr = 0.05 * count; // Clamp remaining to minimum
                                    var remainingCols = count - Object.keys(grid._customCols).length;

                                    for (var j = 0; j < count; j++) {
                                        if (grid._customCols[j]) {
                                            template += grid._customCols[j] + 'fr ';
                                        } else {
                                            template += (remainingCols > 0 ? (remainingFr / remainingCols).toFixed(3) : 0) + 'fr ';
                                        }
                                    }
                                    grid.style.gridTemplateColumns = template.trim();
                                } else {
                                    // Default 2 cols (auto, count >= 2)
                                    grid.style.gridTemplateColumns = grid._customCols[0] + 'fr ' + (1 - fraction).toFixed(3) + 'fr';
                                }                            }
                        }
                    }
                });
                cell._hasResizeObserver.observe(cell);
            } else if (cell.style.resize === 'none' && cell._hasResizeObserver) {
                cell._hasResizeObserver.disconnect();
                cell._hasResizeObserver = null;
            }

        } else {
            // Force pure vertical in PiP mode
            cell.style.width = '100%';
            cell.style.height = '100%';
            cell.style.resize = 'none'; cell.style.paddingRight = '0';
            cell.style.gridRow = 'auto';
            cell.style.gridColumn = '1';
        }
        // Make cell clickable for focus logic
        cell.onmousedown = function(e) {
            if (!e.target.closest('.mv-hdr')) {
                focusStream(idx);
            }
        };

        // Update drag/drop indices as they can change
        cell.ondragstart = function(e) {
            e.dataTransfer.setData('text/plain', idx.toString());
            window.draggedMvIdx = idx;
            cell.style.opacity = '0.5';
            pointeursDesCadres('none');
        };
        cell.ondragend = function(e) {
            cell.style.opacity = '1';
            cell.draggable = false;
            window.draggedMvIdx = null;
            pointeursDesCadres('auto');
            saveMultivisionState();
            updateMultivisionLayout();
        };
        cell.ondragenter = function(e) {
            e.preventDefault();
            var fromIdx = window.draggedMvIdx;
            var toIdx = idx;
            /* D'un écran à l'autre, l'échange attend le dépôt : chaque passage au-dessus
               d'une tuile la changerait de fenêtre, donc rechargerait sa vidéo. */
            if (fromIdx !== null && fromIdx !== undefined && !estMemeFenetre(fromIdx, cell)) return;
            if (fromIdx !== null && fromIdx !== undefined && fromIdx !== toIdx && !isNaN(fromIdx)) {
                var temp = mvFlux[fromIdx];
                mvFlux[fromIdx] = mvFlux[toIdx];
                mvFlux[toIdx] = temp;
                window.draggedMvIdx = toIdx; // Update tracked index after swap

                if (activeMvIdx === fromIdx) {
                    activeMvIdx = toIdx;
                } else if (activeMvIdx === toIdx) {
                    activeMvIdx = fromIdx;
                }

                saveMultivisionState();
                updateMultivisionLayout();
                applyMvFocusStyling();
                applyMvAudioState();
            }
        };
        cell.ondragover = function(e) {
            e.preventDefault();
            // Optional: visual indicator here if wanted
        };
        cell.ondragleave = function(e) {
            // No action needed
        };
        cell.ondrop = function(e) {
            e.preventDefault();
            // Dans une même fenêtre, l'échange est déjà fait au survol (dragenter).
            var fromIdx = window.draggedMvIdx;
            if (fromIdx === null || fromIdx === undefined || isNaN(fromIdx) || estMemeFenetre(fromIdx, cell)) return;
            /* D'un écran à l'autre : la tuile déposée et la tuile visée échangent leurs
               places. La tuile glissée change de document, donc son `dragend` peut ne
               jamais venir : on remet l'état du glisser ici. */
            window.draggedMvIdx = null;
            pointeursDesCadres('auto');
            toutesLesCellules().forEach(function(c) { c.style.opacity = '1'; c.draggable = false; });
            echangerTuiles(fromIdx, parseInt(cell.dataset.index, 10));
        };

        // Update header HTML
        var hdr = cell.querySelector('.mv-hdr');
        /* La sonde du flux direct part dès la pose de chaque tuile, pas seulement quand
           on la choisit : ▶ Direct est prêt dans la barre au moment où on y arrive. */
        cell.classList.toggle('mv-direct-dispo', directDisponible(s));
        var svgDrag = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>';
        var svgClose = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';

        /* Les boutons d'une tuile sont pour la souris et le doigt (tabindex -1) : à la
           télécommande, le focus reste dans la barre, où sont les mêmes gestes, au lieu
           de sauter en haut de chaque tuile (js/tv-navigation.js les ignore). */
        var hdrHtml = '<div class="mv-hdr-left">'
            + '<div class="mv-drag-handle" role="button" tabindex="-1" aria-label="Déplacer" title="Glisser pour déplacer" onmousedown="this.closest(\'.mv-cell\').draggable=true;">' + svgDrag + '</div>'
            /* « Pas de doublon de menu dans le haut du multiview ; même chose pour le
               titre » (25 octobre 2026) : le nom du match, sa source et le menu ⋮ sont
               dans la barre (la pastille de la vidéo, ⋮ de la vidéo choisie). Le haut de
               la tuile ne garde que son numéro, qui la relie à sa pastille, dès deux
               vidéos. */
            + (mvFlux.length >= 2 ? '<div class="mv-stream-number" title="Touche ' + (idx + 1) + '">' + (idx + 1) + '</div>' : '')
            + '</div>';

        /* En mode câble, l'échappatoire est à portée de pouce : suspendre les gestes de
           cette tuile pour cliquer dans la page du site (lancer la lecture, accepter un
           avis), puis les reprendre. Le double appui sur le calque fait la même chose. */
        var boutonGestes = modeCable
            ? '<button type="button" tabindex="-1" class="mv-hdr-btn mv-cable-btn' + (s._gestesSuspendus ? '' : ' on') + '" title="' + (s._gestesSuspendus ? 'Reprendre les gestes de zapping' : 'Suspendre les gestes tant qu\'on travaille dans la page (un simple appui les rend quatre secondes)') + '" aria-label="Gestes de zapping" onclick="basculerGestesTuile(' + idx + '); event.stopPropagation();">' + (s._gestesSuspendus ? '🖐' : '📺') + '</button>'
            : '';

        /* ⇄ et ✕ seulement sur le second écran (deux fenêtres), qui n'a pas la barre : dans
           la page, ils doublaient « Échanger avec la vidéo principale » et « Fermer cette
           vidéo » du menu ⋮ de la barre (ouvrirMenuTuile), qui a tout le reste (« tous
           les doublons », 25 octobre 2026). */
        var surSecondEcran = !!grid2 && idx > 0;
        var boutonEchange = surSecondEcran
            ? '<button type="button" tabindex="-1" class="mv-hdr-btn mv-swap-btn" title="Échanger avec la vidéo principale" aria-label="Échanger avec la vidéo principale" onclick="mettreSurEcranPrincipal(' + idx + '); event.stopPropagation();">⇄ <span class="mv-hdr-lb">Principal</span></button>'
            : '';
        var controlsHtml = '<div class="mv-hdr-right">'
            + boutonEchange
            + boutonGestes
            + (surSecondEcran ? '<button type="button" tabindex="-1" class="mv-hdr-btn mv-close-btn" title="Fermer cette vidéo" aria-label="Fermer cette vidéo" onclick="removeFromMultivision(' + idx + '); event.stopPropagation();">' + svgClose + '</button>' : '')
            + '</div>';

        hdr.innerHTML = hdrHtml + controlsHtml;
        applyMvFit(cell, s);

        // Update URL/Src if changed (for existing cells)
        if (s._currentUrl !== s.url) {
            var videoContainer = cell.querySelector('.mv-video-container');
            if (videoContainer) {
                if (typeof fallbackToIframe === 'function') fallbackToIframe(s.url, videoContainer, cell, s);
                s._currentUrl = s.url;
            }
        } else {
            // Update crop transform
            var media = cell.querySelector('.mv-media');
            if (media) {
                media.id = 'mv-iframe-' + idx;
                if (s.cropped) {
                    media.style.transform = 'scale(1.15)';
                } else {
                    media.style.transform = 'scale(1)';
                }
            }
        }
    });

    if (grid2) poserSurDeuxEcrans(grid, grid2, placement2, count);
    // La frontière est celle des écrans : pas de poignée pour la déplacer.
    if (etire) Array.prototype.forEach.call(grid.children, function(c) { if (c.classList.contains('mv-cell')) { c.style.resize = 'none'; c.style.paddingRight = '0'; } });

    // Remove cells that are no longer in mvFlux
    existingCells.forEach(function(cell) {
        var cellId = cell.getAttribute('data-internal-id');
        if (!mvFlux.find(function(s) { return s._internalId === cellId; })) {
            detruireLecteursDe(cell);
            cell.remove();
        }
    });

    if (activeMvIdx === null || activeMvIdx >= mvFlux.length) {
        activeMvIdx = mvFlux.length > 0 ? mvFlux.length - 1 : null;
    }

    majSurfacesCable();
    applyMvFocusStyling();
    applyMvAudioState();
}

/* Range chaque tuile sur son écran, après la disposition ordinaire qu'on écrase : la
   page n'a plus qu'une tuile, la seconde grille a les autres. Une tuile ne change de
   fenêtre que si elle n'y est pas déjà — le déplacement recharge son iframe — et une
   vidéo directe y est reposée (`_currentUrl` effacé), son lecteur hls n'y survivant pas. */
function poserSurDeuxEcrans(grid, grid2, placement2, count) {
    grid.style.gridTemplateColumns = '1fr';
    grid.style.gridTemplateRows = '1fr';
    var aReposer = false;
    mvFlux.forEach(function(s, idx) {
        var cell = null;
        [grid, grid2].forEach(function(g) {
            Array.prototype.forEach.call(g.children, function(c) { if (c.getAttribute('data-internal-id') === s._internalId) cell = c; });
        });
        if (!cell) return;
        var cible = ecranDeTuile(idx) === 1 ? grid : grid2;
        if (cell.parentNode !== cible) {
            cible.appendChild(cell);
            if (s.mode === 'direct') { s._currentUrl = null; aReposer = true; }
            else reveillerApresDeplacement(s, cell);
        }
        var place = idx === 0 ? { ligne: '1', colonne: '1' } : (placement2.places[idx - 1] || { ligne: 'auto', colonne: 'auto' });
        cell.style.gridRow = place.ligne;
        cell.style.gridColumn = place.colonne;
        cell.style.resize = 'none';
        cell.style.paddingRight = '0';
        cell.style.width = '100%';
        cell.style.height = '100%';
    });
    if (aReposer) setTimeout(updateMultivisionLayout, 0);
}

/* Une tuile qui change de fenêtre RECHARGE sa page (le navigateur l'impose). « Le switch
   est lent et clunky » (4 octobre 2026) : la tuile gardait `_playing` à vrai, si bien que
   le signal « joue » de la page rechargée ne déclenchait rien — ni le son de la vidéo
   qui arrive devant, ni la pastille, ni la reprise si elle ne repartait pas. On la traite
   donc comme un chargement neuf de la MÊME source, et on relance la lecture dès que la
   page est chargée (`mv_clean` + `mv_play`) au lieu d'attendre un clic. */
function reveillerApresDeplacement(s, cell) {
    s._playing = false;
    couperMinuteur(s, 'reprise');
    rafraichirPastille(mvFlux.indexOf(s));
    var fr = cell.querySelector('iframe.mv-iframe');
    if (!fr) return;
    var url = s._currentUrl;
    fr.addEventListener('load', function relance() {
        fr.removeEventListener('load', relance);
        var i = mvFlux.indexOf(s);
        if (i >= 0 && s._currentUrl === url) relancerLectureTuile(i);
    });
    var idx = mvFlux.indexOf(s);
    if (idx >= 0 && url) armerBasculeAuto(s, idx, url);
}

/* Le lien tel que le match le connaît, retrouvé par son adresse.

   Une entrée du Multivision ne porte que { url, name, mid } : c'est tout ce que
   `addToMultivision` reçoit, depuis la fiche comme depuis le sélecteur de flux. Or la
   décision de chargement (fallbackToIframe) lit `s.playerUrl` et `s.topLevel` sur cette
   entrée — des champs qui n'y ont jamais été copiés. Le lecteur extrait par le scraper
   horaire (data/streams.json, champ `playerUrl`) et la mesure « refuse l'iframe »
   (`topLevel`) n'atteignaient donc jamais la tuile : la page de match était chargée
   telle quelle, et le navigateur affichait son refus. Relevé sur le cache du
   6 septembre 2026 : 511 liens portaient les deux champs, 100 matchs n'avaient QUE ce
   type de lien — pour eux le Multivision ne montrait rien.

   On retrouve donc le lien dans le match (par `mid`, sinon dans toute la grille) au
   moment de charger la tuile, plutôt que de recopier les champs à l'ajout : une entrée
   restaurée du stockage local, ou dont l'adresse a changé par le sélecteur, reste juste. */
export function lienDuMatchPourFlux(s, url) {
    var cible = url || (s && s.url);
    if (!cible) return null;
    var liste = (S && Array.isArray(S.matches)) ? S.matches : [];
    function chercher(m) {
        var L = (m && m.streamLinks) || [];
        for (var i = 0; i < L.length; i++) { if (L[i] && L[i].url === cible) return L[i]; }
        return null;
    }
    var lien = null;
    if (s && s.mid !== undefined && s.mid !== null) {
        for (var k = 0; k < liste.length && !lien; k++) {
            if (String(liste[k].id) === String(s.mid)) lien = chercher(liste[k]);
        }
    }
    for (var j = 0; j < liste.length && !lien; j++) lien = chercher(liste[j]);
    return lien;
}

/* Liens jouables d'un match, dans l'ordre où la tuile les essaie. */
function liensDuMatch(mid) {
    var liste = (S && Array.isArray(S.matches)) ? S.matches : [];
    var m = null;
    for (var k = 0; k < liste.length; k++) { if (String(liste[k].id) === String(mid)) { m = liste[k]; break; } }
    if (!m || !Array.isArray(m.streamLinks)) return [];
    var classes = sortFluxLinks(m.streamLinks.filter(function(l) { return !!(l && l.url); }));
    if (!modeCable) return classes;
    /* Mode câble : la liste des sources est celle qui peut JOUER, flux que l'application
       lit elle-même en tête (voir liensCable, js/cable.js). Un seul endroit à filtrer :
       tout ce qui change de source passe par ici (⏭, geste horizontal, bascule
       automatique, pastille « source k/n »). Si le filtre ne laisse rien, on rend la
       liste complète — mieux vaut une source douteuse que pas de source. */
    var jouables = liensCable(classes, optionsCable());
    return jouables.length ? jouables : classes;
}

/* Position du flux d'une tuile parmi les liens de son match : { k, n } (1-based), ou null. */
export function positionDuFlux(s) {
    if (!s || s.mid === undefined || s.mid === null) return null;
    var L = liensDuMatch(s.mid);
    if (L.length < 2) return null;
    var k = -1;
    for (var i = 0; i < L.length; i++) { if (L[i].url === s.url) { k = i; break; } }
    return { k: k + 1, n: L.length };
}

/* Passe la tuile `idx` à la source suivante de son match.

   C'est le cœur du nouveau mécanisme : on ne prétend plus deviner d'avance quel lien
   jouera. La tuile essaie le mieux classé, et si rien ne vient — le script utilisateur
   le voit, ou l'utilisateur le voit — elle passe au suivant. `raison` = 'auto' quand
   c'est la tuile qui décide, après 30 s sans vidéo. */
export function nextFluxForTile(idx, raison) {
    var s = mvFlux[idx];
    if (!s) return false;
    var L = liensDuMatch(s.mid);
    var suivant = nextLinkAfter(L, s.url);
    if (!suivant) { if (raison !== 'auto') showToast('Aucune autre source pour ce match.'); return false; }
    if (raison === 'auto') notePlayability(lienDuMatchPourFlux(s, s.url) || { url: s.url }, 'none');
    /* Un ⏭ sur une source qui n'a rien montré apprend aussi à l'appareil, script
       utilisateur ou pas (sautManuelEstEchec, js/playability.js). */
    else if (s._poseeUrl === s.url && sautManuelEstEchec({
        aJoue: s._playing || s._playNoted || s._aJoueUrl === s.url,
        depuisMs: s._posedAt ? Date.now() - s._posedAt : NaN
    })) notePlayability(lienDuMatchPourFlux(s, s.url) || { url: s.url }, 'none');
    s._autoTried = (s._autoTried | 0) + (raison === 'auto' ? 1 : 0);
    /* Tout ce qu'une tuile oublie en changeant d'adresse est décidé au même endroit
       (`poserLienSurTuile`, mode câble) : la lecture observée, le manifeste vu passer,
       le mode direct, et la marque de sortie forcée — qui visait l'adresse d'AVANT et
       empêchait sinon le chargement de la suivante. */
    poserLienSurTuile(s, suivant.url);
    saveMultivisionState();
    updateMultivisionLayout();
    var pos = positionDuFlux(s);
    showToast((raison === 'auto' ? 'Aucune vidéo : source suivante' : 'Source suivante') + (pos ? ' (' + pos.k + '/' + pos.n + ')' : '') + ' — ' + getDomain(tileTarget(suivant)));
    return true;
}

/* Les minuteurs d'une tuile vivent ICI, pas sur la tuile : `saveMultivisionState`
   sérialise `mvFlux` en JSON, et un handle de minuteur n'est un nombre que dans un
   navigateur — ailleurs (Node, donc les tests) c'est un objet circulaire, et
   l'enregistrement de l'état mourrait dessus. Même règle que `rappelsLecture`.

   Rangés par TUILE et non par index : fermer une tuile décale toutes celles de droite,
   et un minuteur indexé agirait alors sur la voisine — ou serait jeté avec l'index qu'il
   croyait tenir. L'index se relit au moment d'agir ; une tuile fermée n'en a plus, et
   son minuteur se tait. Une tuile a au plus un minuteur de chaque sorte. */
var minuteursTuile = new Map();
function couperMinuteur(s, nom) {
    var m = minuteursTuile.get(s);
    if (!m || !m[nom]) return;
    clearTimeout(m[nom]);
    delete m[nom];
    if (!Object.keys(m).length) minuteursTuile.delete(s);
}
function armerMinuteur(s, nom, fn, delai) {
    couperMinuteur(s, nom);
    var m = minuteursTuile.get(s);
    if (!m) { m = {}; minuteursTuile.set(s, m); }
    m[nom] = setTimeout(function() {
        couperMinuteur(s, nom);
        var idx = mvFlux.indexOf(s);
        if (idx < 0) return; // tuile fermée entre-temps
        fn(idx);
    }, delai);
}

/* Combien de fois cette adresse a déjà été chargée dans cette tuile. Le compteur
   appartient à l'ADRESSE, pas à la tuile : changer de source rend ses essais entiers à
   la suivante sans que `poserLienSurTuile` ait à le savoir, et une adresse retrouvée
   plus tard repart à zéro. */
function compterEssai(s, url) {
    if (s._essaisUrl !== url) { s._essaisUrl = url; s._essais = 0; s._reprises = 0; s._fenetreReprise = 0; }
    s._essais = (s._essais | 0) + 1;
    return s._essais;
}

/* Le script utilisateur, quand il est installé, dit à la tuile si une vidéo joue. Sans
   nouvelle au bout de sa patience, la tuile RECHARGE la même source ; si le silence dure
   encore après ce second essai, alors seulement elle passe à la suivante — au plus une
   fois par lien, pour ne pas tourner en rond. Sans le script, aucun signal ne peut
   venir : on ne fait rien seul, le bouton ⏭ reste à portée.

   Le rechargement est la réponse à « trop vite à switch de sources quand ça bugge, au
   lieu de tenter de recharger » (19 septembre 2026) : le compte et la décision sont dans
   `actionSansVideo` (js/playability.js), avec la raison. Une tuile SEULE sur son match
   arme aussi son minuteur — elle n'a nulle part où aller, mais elle a le droit d'être
   rechargée, ce que l'ancienne borne `L.length < 2` lui refusait.

   30 s pour un lien inconnu ; 90 s pour un lien qui joue d'ordinaire (voir `patienceMs`,
   js/playability.js) : embed.st met souvent plus de 30 s à démarrer, et la tuile le
   quittait juste avant. */
var DELAI_SANS_VIDEO_MS = 30000;
var DELAI_REDEMARRAGE_MS = 45000;
var DELAI_HOTE_LENT_MS = 90000;
function armerBasculeAuto(s, idx, url) {
    couperMinuteur(s, 'auto');
    /* Un lecteur officiel ne dit jamais « joue » : sans cette ligne, la tuile le quittait
       au bout de 30 s pour le suivant, en boucle. Voir estLecteurOfficiel (js/esports.js). */
    if (estLecteurOfficiel(url)) return;
    var pont = (typeof getBridgeStatus === 'function') ? getBridgeStatus() : null;
    if (!pont || !pont.available) return;
    var L = liensDuMatch(s.mid);
    var lien = lienDuMatchPourFlux(s, url) || { url: url };
    var ledger = playLedger();
    var essais = compterEssai(s, url);
    /* Le second essai ne rachète PAS la longue patience : le premier l'a déjà donnée à
       l'hôte lent. Sans cette ligne, embed.st coûtait 180 s à lui seul (20 septembre). */
    /* Une source qui a déjà joué ici et qu'on recharge après un arrêt : elle a droit à la
       patience d'un redémarrage, pas à la patience courte d'un second essai. */
    var aJoue = !!url && s._aJoueUrl === url;
    var delai = aJoue ? Math.max(DELAI_REDEMARRAGE_MS, patienceMs(lien, ledger, DELAI_SANS_VIDEO_MS, DELAI_HOTE_LENT_MS))
        : essais > 1 ? DELAI_SANS_VIDEO_MS : patienceMs(lien, ledger, DELAI_SANS_VIDEO_MS, DELAI_HOTE_LENT_MS);
    /* Combien d'essais cette source-ci mérite (essaisPourSource, js/playability.js) : la
       tuile qui PARCOURT déjà la liste, et l'hôte connu pour ne pas jouer, n'en ont qu'un. */
    var essaisMax = essaisPourSource(lien, ledger, (s._autoTried | 0) > 0);
    armerMinuteur(s, 'auto', function(place) {
        /* La tuile a pu changer de source depuis (⏭, geste, sélecteur) : l'adresse
           surveillée est celle qui a armé le minuteur, pas celle qui est là. */
        if (s._playing || s._currentUrl !== url) return;
        var reste = L.length > 1 && (s._autoTried | 0) < BASCULES_AUTO_MAX && (s._autoTried | 0) < L.length - 1;
        var action = actionSansVideo(essais, reste, essaisMax, aJoue);
        if (action === 'recharger') {
            showToast('Aucune vidéo : on recharge la source (essai ' + (essais + 1) + '/' + essaisMax + ')');
            rechargerTuile(place);
            return;
        }
        if (action === 'suivante') { nextFluxForTile(place, 'auto'); return; }
        if ((s._autoTried | 0) >= BASCULES_AUTO_MAX && L.length > 1) showToast('On reste sur cette source. ⏭ pour en essayer une autre');
        else if (!reste) showToast('Plus d\'autre source pour ce match');
    }, delai);
}

/* Un flux qui S'ARRÊTE après avoir joué n'est pas une source qui ne marche pas : c'est
   presque toujours la même source qui a hoqueté — segment manquant, pair perdu, réseau
   qui bouge. Le script utilisateur signale un simple ré-tampon comme un arrêt, donc on
   laisse d'abord `DELAI_REPRISE_MS` à la vidéo pour revenir seule (le signal `video_state`
   à `true` coupe le minuteur), puis on RECHARGE la même source.

   Jamais de changement de source ici : abandonner un lien qui vient de jouer pour un
   inconnu, c'est exactement ce que l'utilisateur reprochait. Et jamais de rechargement
   quand c'est LUI qui a mis en pause — `arretMeriteRechargement` (js/playability.js)
   lit la cause donnée par le script, ou à défaut le dernier clic vu dans le cadre. */
/* 25 s, et non plus 12 (30 septembre 2026) : un ré-tampon de ces sites dure souvent plus
   de dix secondes, et recharger la page PENDANT que la vidéo se rattrape la coupait net —
   « c'est normal que ça arrive des fois, faut pas que ça plante ». */
var DELAI_REPRISE_MS = 25000;
var FENETRE_GESTE_MS = 20000;
export function armerRepriseTuile(s, signal) {
    couperMinuteur(s, 'reprise');
    var pont = (typeof getBridgeStatus === 'function') ? getBridgeStatus() : null;
    if (!pont || !pont.available) return false;
    if (!arretMeriteRechargement({
        cause: signal && signal.cause,
        gesteIlYaMs: s._dernierGeste ? Date.now() - s._dernierGeste : null,
        fenetreGeste: FENETRE_GESTE_MS
    })) return false;
    /* Deux rechargements automatiques par dix minutes (budgetReprise). Après, on laisse
       le lecteur revenir seul : recharger encore couperait le flux. */
    var age = s._fenetreReprise ? Date.now() - s._fenetreReprise : null;
    var b = budgetReprise(s._reprises, age);
    if (!b.autorisee) return false;
    if (!s._fenetreReprise || (typeof age === 'number' && age >= FENETRE_REPRISE_MS)) s._fenetreReprise = Date.now();
    s._reprises = b.reprises;
    var url = s._currentUrl;
    armerMinuteur(s, 'reprise', function(place) {
        if (s._playing || s._currentUrl !== url) return;
        showToast('Flux interrompu : on recharge la même source');
        rechargerTuile(place);
    }, DELAI_REPRISE_MS);
    return true;
}

/* « ● source k/n · direct · 2,4 Mb/s » : ce que la tuile essaie, et si ça joue. */
function libelleSource(s) {
    var pos = positionDuFlux(s);
    var mesureTuile = formaterMesure(s._mesure || mesurePour(safeStorageGetJSON('debits', {}) || {}, s.url));
    return (s._playing ? '● ' : '') + (pos ? 'source ' + pos.k + '/' + pos.n : getDomain(tileTarget(lienDuMatchPourFlux(s, s.url) || { url: s.url }))) + (s.mode === 'direct' ? ' · direct' : '') + (mesureTuile ? ' · ' + mesureTuile : '');
}

/* Met à jour la source d'une tuile (sa pastille dans la barre) sans re-rendre la cellule. */
function rafraichirPastille(idx) {
    var s = mvFlux[idx];
    var cell = celluleDeTuile(idx);
    if (!s || !cell) return;
    cell.classList.toggle('mv-direct-dispo', directDisponible(s));
    majBarreVideos();
}

/* CE QUE LA COUCHE NATIVE ANDROID A VU PASSER.
   -------------------------------------------
   Sur ordinateur, c'est `multiview-cleaner.user.js` qui voit le manifeste : il tourne
   DANS la page du lecteur et le renvoie par `postMessage`, si bien que `e.source`
   désigne la tuile sans ambiguïté (voir indexDeTuilePour, juste en dessous).

   Sur Android, rien ne peut tourner dans cette page : aucun navigateur mobile
   n'injecte de script dans une iframe d'origine croisée. Mais la WebView, elle, voit
   toutes les requêtes — l'application Android les intercepte déjà pour écarter les
   régies (BloqueurWebViewClient.java), et un manifeste y passe comme le reste.

   Elle ne peut pas pour autant se faire passer pour la fenêtre émettrice. Elle appelle
   donc cette fonction-ci, avec la PAGE d'où la requête est partie — son en-tête
   `Referer`. C'est ce qui remplace `e.source`.

   L'appariement est délibérément prudent : l'adresse exacte d'abord, l'hôte ensuite, et
   RIEN si deux tuiles partagent cet hôte. Poser un manifeste sur la mauvaise tuile lui
   ferait jouer un autre match — pire que de ne rien poser. */
export function mediaVuParAndroid(pageUrl, mediaUrl) {
    if (!estManifeste(mediaUrl)) return false;
    var page = String(pageUrl || '');
    if (!page) return false;

    var hote = '';
    try { hote = new URL(page).hostname.replace(/^www\./, ''); } catch (e) { return false; }

    var exact = -1, parHote = [], i;
    for (i = 0; i < mvFlux.length; i++) {
        var s = mvFlux[i];
        if (!s || !s.url) continue;
        if (s.url === page) { exact = i; break; }
        var h = '';
        try { h = new URL(s.url).hostname.replace(/^www\./, ''); } catch (e) { continue; }
        if (h === hote) parHote.push(i);
    }
    var idx = exact >= 0 ? exact : (parHote.length === 1 ? parHote[0] : -1);

    /* Le repli qui fait marcher le cas réel. Le `Referer` d'un manifeste est souvent la
       page IMBRIQUÉE du lecteur (la tuile charge streame.center, qui embarque
       edgestream3.pro, dont part la requête) : ni l'adresse ni l'hôte de la tuile ne
       correspondent alors. Mais sur un téléphone on regarde UN match — quand il n'y a
       qu'une tuile, il n'y a pas d'ambiguïté à lever.
       Au-delà d'une tuile, on s'abstient : poser le manifeste sur la mauvaise ferait
       jouer un autre match, ce qui est pire que de ne rien poser. */
    if (idx < 0 && mvFlux.length === 1 && mvFlux[0] && mvFlux[0].url) idx = 0;
    if (idx < 0) return false;

    var t = mvFlux[idx];
    if (t._media) return false;          // le premier vu est le manifeste maître
    t._media = { url: mediaUrl, pageUrl: page, at: Date.now() };
    safeStorageSetJSON('direct_media', retenirMediaDirect(registreDirect(), t.url, t._media));
    saveMultivisionState();
    rafraichirPastille(idx);
    return true;
}

/* Quel index de tuile a envoyé ce message ? Le script tourne aussi dans les cadres
   imbriqués du lecteur : on remonte les parents jusqu'à l'iframe de la tuile. */
function indexDeTuilePour(source) {
    var w = source;
    for (var k = 0; k < 8 && w; k++) {
        for (var i = 0; i < mvFlux.length; i++) {
            var fr = cadreDeTuile(i);
            if (fr && fr.contentWindow === w) return i;
        }
        var parent = null;
        try { parent = w.parent; } catch (e) { parent = null; }
        if (!parent || parent === w) break;
        w = parent;
    }
    return -1;
}

/* Les matchs affichés dans les tuiles continuent d'être relus tant qu'on regarde.

   Suite de « meilleure mise à jour des streams à même la page » (6 septembre 2026) : la
   fiche ouverte se relit déjà chaque minute. Mais quand on ferme la fiche et qu'on ne
   garde que le Multivision — le cas normal quand on regarde vraiment — plus rien ne
   relisait, et la tuile restait avec la liste de sources qu'elle avait au moment où on l'a
   posée. Or c'est précisément quand un flux lâche qu'il faut avoir OÙ ALLER : le bouton
   « source suivante » ne vaut que par la longueur de sa liste.

   Cadence plus lente que la fiche (trois minutes) : on suit jusqu'à quatre matchs à la
   fois, et une tuile qui joue n'a pas besoin d'une liste fraîche à la minute. Un seul
   minuteur, armé quand une tuile existe et coupé quand il n'en reste plus. Rien n'est
   redessiné : seule la pastille « source k/n » est mise à jour, pour ne pas interrompre
   une vidéo en cours de lecture. */
var rafraichissementTuiles = null;
function matchDeLaTuile(mid) {
    var liste = (S && Array.isArray(S.matches)) ? S.matches : [];
    for (var i = 0; i < liste.length; i++) { if (String(liste[i].id) === String(mid)) return liste[i]; }
    return null;
}
export function arreterRafraichissementTuiles() {
    if (rafraichissementTuiles) { clearInterval(rafraichissementTuiles); rafraichissementTuiles = null; }
}
export function armerRafraichissementTuiles() {
    if (rafraichissementTuiles) return; // déjà armé : une tuile de plus ne relance rien
    rafraichissementTuiles = setInterval(function() {
        if (!mvFlux.length) { arreterRafraichissementTuiles(); return; }
        var vus = {};
        mvFlux.forEach(function(s, idx) {
            if (s.mid === undefined || s.mid === null || vus[s.mid]) return;
            vus[s.mid] = true;
            var m = matchDeLaTuile(s.mid);
            if (!m || m._relectureEnCours || !doitRafraichirTuile(m)) return;
            m._relectureEnCours = true;
            var avant = compterFluxUtiles(m);
            m.pageLueA = Date.now();
            scrapeMatchFlux(m, true, true).then(function() {
                m._relectureEnCours = false;
                if (compterFluxUtiles(m) > avant) rafraichirPastille(idx);
            }).catch(function() { m._relectureEnCours = false; });
        });
    }, INTERVALLE_TUILE_MS);
}

export function addToMultivision(url, name, mid) {
    mid = getOriginalMatchId(mid);
    /* Mode câble : une seule vidéo. Choisir un match ailleurs dans l'application CHANGE
       de chaîne au lieu d'ajouter une tuile — sans quoi le mode perdrait sa promesse au
       premier match choisi dans le Guide. */
    if (modeCable && mvFlux.length) {
        var s0 = mvFlux[0];
        s0.mid = mid;
        s0.name = name;
        s0._autoTried = 0;
        poserLienSurTuile(s0, url);
        activeMvIdx = 0;
        saveMultivisionState();
        updateMultivisionLayout();
        applyMvFocusStyling();
        applyMvAudioState();
        armerRafraichissementTuiles();
        var mvcCable = document.getElementById('mv-container');
        if (mvcCable && mvcCable.style.display === 'none') toggleMultiview();
        relancerLectureTuile(0);
        annoncerCable(0);
        showToast('📺 ' + name);
        return;
    }
    if(mvFlux.length >= 4) {
        showToast('Maximum 4 streams en Multivision.');
        return;
    }
    mvFlux.push({url: url, name: name, mid: mid, cropped: false, _autoTried: 0});
    /* La première vidéo du mode câble prend, elle aussi, le flux direct connu : elle
       passait à côté de `poserLienSurTuile`, et seul le premier zapping le trouvait. */
    if (modeCable || surTeleAndroid()) poserLienSurTuile(mvFlux[mvFlux.length - 1], url);

    // Make the newly added stream the active one (unmuted and focused)
    activeMvIdx = mvFlux.length - 1;

    saveMultivisionState();
    updateMultivisionLayout();
    applyMvFocusStyling();
    applyMvAudioState();
    armerRafraichissementTuiles();

    // Auto-open multiview if it's the first flux added
    var mvc = document.getElementById('mv-container');
    if(mvc && mvc.style.display === 'none') {
        toggleMultiview();
    }
    showToast('Ajouté au Multivision: ' + name);
}

/* ══ MODE CÂBLE (ZAPPING) ════════════════════════════════════════════════════════
   « Mode bonus style câble : le swipe vertical change le match qui joue, le swipe
   horizontal change le stream. »

   Le lecteur savait déjà tout faire, mais chaque geste demandait de viser un bouton :
   changer de match, c'était réduire le lecteur, retrouver la carte, rouvrir la fiche,
   choisir un lien. Devant une vidéo, sur un téléphone, c'est trop cher. Ici, deux
   gestes suffisent, et ils rangent chaque chose sur son axe :

     ↑ ↓   la chaîne — un AUTRE match, celui d'à côté parmi les matchs en direct qui ont
           un lien (`chainesDuCable`) ;
     ← →   la source — le MÊME match, un autre flux, dans l'ordre où la tuile les essaie.

   Ce que ce mode NE fait pas : il ne touche ni à la liste des tuiles, ni aux
   dispositions, ni au son. Il remplace le contenu d'UNE tuile — celle sous le doigt —
   comme le faisaient déjà le sélecteur de flux et le bouton ⏭, par les mêmes chemins.
   On peut donc l'allumer et l'éteindre sans rien perdre.

   La décision qui a demandé le plus de soin est la SURFACE qui écoute. Une tuile est une
   iframe d'une autre origine : un `touchstart` fait dedans ne nous parvient jamais. Le
   mode pose donc un calque transparent par-dessus la vidéo (`.mv-cable-surface`), et ce
   calque prend les clics — dont celui qui lance la lecture sur certains sites. D'où
   l'échappatoire, dite par le message d'allumage et par le bouton 📺/🖐 de l'en-tête de
   tuile : un double appui sur la vidéo, ou ce bouton, suspend les gestes pour cette
   tuile le temps de cliquer dans la page ; un nouveau double appui les reprend. Sans cette sortie, allumer le mode câble rendrait
   muettes les pages qui exigent un clic, et personne ne comprendrait pourquoi. */

export var modeCable = false;
try { modeCable = (localStorage.getItem('mode_cable') === '1'); } catch (e) { modeCable = false; }

/* Fenêtre d'avance retenue pour les chaînes : ce que l'onglet Live montre déjà
   (« en direct, ou dans l'heure »). Un match qui commence dans dix minutes est une
   chaîne légitime — le décodeur affichait aussi les chaînes qui n'avaient pas commencé. */
var CABLE_AVANCE_MIN = 60;

/* Tout ce que le mode câble doit savoir du monde extérieur, en un seul endroit : ce qui
   est en direct, ce qui commence bientôt, ce qui est BLOQUÉ (hôte qui refuse d'être
   encadré, lien observé bloqué, adresse qui a fait sortir la page) et ce que
   l'application sait jouer elle-même. `js/cable.js` ne connaît rien de tout cela : il
   reçoit des prédicats. */
export function optionsCable() {
    var registre = getEmbedRegistry();
    var bloques = (registre && registre.blocked) || {};
    var ledger = playLedger();
    var sortie = safeStorageGetJSON(CLE_SORTIE, null);
    var sorties = (sortie && Array.isArray(sortie.urls) && sortie.at
        && (Date.now() - sortie.at) >= 0 && (Date.now() - sortie.at) <= VALIDITE_SORTIE_MS) ? sortie.urls : [];
    var direct = registreDirect();
    var o = {
        estEnDirect: function(m) { return isLiveNow(m); },
        bientot: function(m) { return startsWithin(m, CABLE_AVANCE_MIN); },
        estBloque: function(url) { return !!bloques[hostOfUrl(tileTarget({ url: url }))]; },
        aFaitSortir: function(url) { return sorties.indexOf(url) >= 0; },
        estMedia: function(url) { return estMediaDirecte(url) || !!mediaDirectPour(direct, url); },
        score: function(lien) { return playabilityScore(lien, ledger); }
    };
    o.lienOk = function(lien) { return lienJouable(lien, o); };
    return o;
}

export function chainesDuCable() {
    return chainesDisponibles((S && S.matches) || [], optionsCable());
}

/* Pose une adresse sur une tuile : c'est le seul endroit qui sait ce qu'il faut oublier
   en changeant de flux. Une tuile garde de son lien précédent l'observation de lecture
   (`_playing`), le manifeste vu passer (`_media`), le compte des bascules automatiques
   et la marque de sortie forcée — quatre choses qui, laissées en place, décrivent une
   page qui n'est plus là. */
function poserLienSurTuile(s, url) {
    s._playing = false;
    s._playNoted = false;
    s._media = null;
    s._sortieForcee = false;
    s.mode = 'page';
    s.url = url;
    /* « Lecture automatique des lecteurs » (12 septembre 2026). Quand l'application sait
       jouer ce flux ELLE-MÊME — une adresse `.m3u8`/`.mp4`, ou un manifeste déjà vu pour
       cette page — le mode câble le lui demande : son `<video>` porte `autoplay`, `muted`
       et `playsinline`, donc il démarre sans clic et sans script utilisateur. Pour une
       page, c'est `relancerLectureTuile` qui demande, faute de pouvoir agir dedans. */
    /* Sur la télé Android aussi (26 octobre 2026, « je veux qu'un max de streams
       marchent ») : la page DaddyLive, en tête de la plupart des matchs, ouvre 180 à 385
       cadres de régie — trop pour un Chromecast —, alors que son flux direct est connu
       (semé depuis la vérification du serveur, `media`). On part sur le flux ; refusé, la
       tuile revient d'elle-même à la page (poserDirect), et un direct qui a échoué deux
       fois pour ce lien n'est plus tenté d'office (aProposer). */
    var connu = mediaDirectPour(registreDirect(), url);
    if ((modeCable || surTeleAndroid()) && (estMediaDirecte(url) || (connu && aProposer(connu)))) s.mode = 'direct';
}

/* Trois rappels, à 1,2 s d'intervalle : le lecteur d'un site apparaît souvent APRÈS le
   chargement, et un seul appel arriverait trop tôt. `mv_clean` relance la recherche du
   lecteur, `mv_play` lance la vidéo, `mv_unmute` (par applyMvAudioState) donne le son à
   la tuile qu'on regarde — et, dans le script utilisateur, le clic qu'attend un lecteur
   en pause. Une tuile qui joue déjà ne reçoit plus rien. */
export var RAPPELS_LECTURE = 3;
export var DELAI_RAPPEL_LECTURE_MS = 1200;
/* Les minuteurs de rappel vivent ICI, pas sur la tuile : `saveMultivisionState`
   sérialise les tuiles, et un handle de minuteur n'est un nombre que dans un
   navigateur — ailleurs (Node, donc les tests) c'est un objet circulaire, et
   l'enregistrement de l'état mourait dessus. */
var rappelsLecture = {};
export function relancerLectureTuile(idx) {
    var s = mvFlux[idx];
    if (!s) return false;
    var envoyer = function() {
        var el = cadreDeTuile(idx);
        if (!el) return;
        if (el.tagName === 'VIDEO') {
            try {
                var p = el.play();
                if (p && typeof p.catch === 'function') p.catch(function() {
                    el.muted = true;
                    try { var q = el.play(); if (q && q.catch) q.catch(function() {}); } catch (e) {}
                });
            } catch (e) {}
            return;
        }
        if (!el.contentWindow) return;
        try {
            posterATuile(el, 'mv_clean');
            posterATuile(el, 'mv_play');
        } catch (e) {}
    };
    envoyer();
    var n = 0;
    if (rappelsLecture[idx]) clearInterval(rappelsLecture[idx]);
    rappelsLecture[idx] = setInterval(function() {
        if (++n >= RAPPELS_LECTURE || s._playing || mvFlux[idx] !== s) {
            clearInterval(rappelsLecture[idx]);
            delete rappelsLecture[idx];
        }
        if (!s._playing) envoyer();
    }, DELAI_RAPPEL_LECTURE_MS);
    applyMvAudioState();
    return true;
}

/* Chaîne suivante (`sens` = +1) ou précédente (-1) pour la tuile `idx`. */
export function zapperChaine(idx, sens) {
    var s = mvFlux[idx];
    if (!s) return false;
    var chaines = chainesDuCable();
    if (!chaines.length) { showToast('Aucun match en direct avec un lien : rien à zapper.'); return false; }
    var m = chaineVoisine(chaines, s.mid, sens);
    if (!m) { showToast('Une seule chaîne pour l\'instant.'); return false; }
    var liens = liensDuMatch(m.id);
    if (!liens.length) return false;
    s.mid = String(m.id);
    s.name = (m.homeTeam && m.awayTeam) ? (m.homeTeam + ' vs ' + m.awayTeam) : (m.name || getDomain(liens[0].url));
    s._autoTried = 0;
    poserLienSurTuile(s, liens[0].url);
    saveMultivisionState();
    updateMultivisionLayout();
    armerRafraichissementTuiles();
    relancerLectureTuile(idx);
    annoncerCable(idx);
    return true;
}

/* Source suivante (+1) ou précédente (-1) du match de la tuile. Le sens avant emprunte
   le chemin du bouton ⏭ (`nextFluxForTile`), pour qu'il n'y ait qu'une façon d'avancer. */
export function changerSourceTuile(idx, sens) {
    var s = mvFlux[idx];
    if (!s) return false;
    if (sens >= 0) {
        var avance = nextFluxForTile(idx);
        if (avance) { relancerLectureTuile(idx); annoncerCable(idx); }
        return avance;
    }
    var L = liensDuMatch(s.mid);
    var precedent = lienVoisin(L, s.url, -1);
    if (!precedent) { showToast('Aucune autre source pour ce match.'); return false; }
    poserLienSurTuile(s, precedent.url);
    saveMultivisionState();
    updateMultivisionLayout();
    relancerLectureTuile(idx);
    annoncerCable(idx);
    return true;
}

/* Le geste, une fois lu, devient l'une des deux actions. */
export function gesteCable(idx, direction) {
    var action = actionDuGeste(direction);
    if (!action) return false;
    /* Une tuile dont les gestes sont suspendus ne zappe pas, et le calque effacé n'y
       suffit pas : le clavier passe par ici aussi, et « suspendu » doit vouloir dire la
       même chose quel que soit le chemin. */
    if (mvFlux[idx] && mvFlux[idx]._gestesSuspendus) return false;
    if (typeof window.resetMvIdleTimer === 'function') window.resetMvIdleTimer();
    return action.axe === 'chaine' ? zapperChaine(idx, action.sens) : changerSourceTuile(idx, action.sens);
}

/* ── L'incrustation, comme celle du décodeur ─────────────────────────────────
   Numéro de chaîne, match, ligue ou score, source utilisée. Deux secondes et demie,
   puis elle s'efface : c'est une confirmation, pas un bandeau. En mode câble seulement :
   hors de lui, ⏮ ⏭ ou LT / RT changent la source sans faire paraître le décodeur
   (« le modal de changement de poste de câble apparaît… quand je change de stream »,
   25 octobre 2026). */
var OSD_MS = 2500;
export function annoncerCable(idx, note) {
    if (!modeCable) return null;
    var s = mvFlux[idx];
    var cell = celluleDeTuile(idx);
    if (!s || !cell) return null;
    var chaines = chainesDuCable();
    var pos = positionDuFlux(s);
    var e = etiquetteChaine(matchDeLaTuile(s.mid) || { name: s.name }, indexDeChaine(chaines, s.mid) + 1, chaines.length, pos ? { k: pos.k, n: pos.n } : null);
    var osd = cell.querySelector('.mv-cable-osd');
    if (!osd) {
        osd = cell.ownerDocument.createElement('div');
        osd.className = 'mv-cable-osd';
        osd.style.cssText = 'position:absolute;left:12px;right:12px;bottom:12px;z-index:7;pointer-events:none;'
            + 'background:rgba(8,8,10,0.82);border:1px solid rgba(255,255,255,0.18);border-radius:10px;'
            + 'padding:10px 12px;color:#fff;backdrop-filter:blur(8px);opacity:0;transition:opacity 0.18s;';
        cell.appendChild(osd);
    }
    osd.innerHTML = (e.numero ? '<div style="font-size:11px;letter-spacing:1px;opacity:0.7;">' + esc(e.numero) + '</div>' : '')
        + '<div style="font-weight:700;font-size:14px;">' + esc(e.titre) + '</div>'
        + (e.details ? '<div style="font-size:12px;opacity:0.75;">' + esc(e.details) + '</div>' : '')
        + (note ? '<div style="font-size:12px;opacity:0.75;">' + esc(note) + '</div>' : '');
    osd.style.opacity = '1';
    if (osd._minuteur) clearTimeout(osd._minuteur);
    osd._minuteur = setTimeout(function() { osd.style.opacity = '0'; }, OSD_MS);
    return e;
}

/* ── La surface qui écoute ───────────────────────────────────────────────────
   Posée une seule fois par tuile, affichée seulement en mode câble. Elle lit le doigt
   (`touch`) comme la souris (`pointer`), pour que le mode serve aussi au bureau. */
function poserSurfaceCable(cell, idx) {
    if (cell.querySelector('.mv-cable-surface')) return;
    var doc = cell.ownerDocument;
    var surface = doc.createElement('div');
    surface.className = 'mv-cable-surface';
    surface.setAttribute('aria-hidden', 'true');
    surface.style.cssText = 'position:absolute;inset:0;z-index:6;display:none;touch-action:none;cursor:grab;';
    cell.appendChild(surface);

    var x0 = 0, y0 = 0, t0 = 0, actif = false, dernierAppui = 0;

    var debut = function(x, y) { x0 = x; y0 = y; t0 = Date.now(); actif = true; };
    var fin = function(x, y) {
        if (!actif) return;
        actif = false;
        var i = parseInt(cell.dataset.index, 10);
        if (isNaN(i)) i = idx;
        var direction = detecterGeste(x - x0, y - y0, Date.now() - t0);
        if (direction) { gesteCable(i, direction); return; }
        /* Pas un geste : un appui. Il RÉVEILLE les commandes, rappelle où on en est, et
           rend les clics à la page pour quatre secondes — le temps de toucher le bouton
           de lecture d'un site qui l'exige — puis le calque revient tout seul.

           C'était un double appui jusqu'ici, qui suspendait les gestes jusqu'à ce qu'on
           pense à les reprendre. « Aucun blocage » (12 septembre 2026) : ni un geste à
           connaître, ni un état à défaire. Le bouton ✋ de l'en-tête reste pour une
           suspension longue, quand on veut vraiment travailler dans la page du site. */
        var maintenant = Date.now();
        dernierAppui = maintenant;
        if (typeof window.resetMvIdleTimer === 'function') window.resetMvIdleTimer();
        rendreLesClics(i);
        annoncerCable(i, '✋ clics rendus à la page');
    };

    surface.addEventListener('touchstart', function(e) {
        if (!e.touches || !e.touches.length) return;
        debut(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    surface.addEventListener('touchend', function(e) {
        var t = (e.changedTouches && e.changedTouches[0]) || null;
        if (t) fin(t.clientX, t.clientY);
    });
    surface.addEventListener('touchcancel', function() { actif = false; });
    surface.addEventListener('mousedown', function(e) { debut(e.clientX, e.clientY); e.preventDefault(); });
    surface.addEventListener('mouseup', function(e) { fin(e.clientX, e.clientY); });
    surface.addEventListener('mouseleave', function() { actif = false; });
}

/* Rend les clics à la page pour quelques secondes : le calque s'efface, puis revient
   tout seul. C'est la réponse à un appui qui n'était pas un geste — le cas du site qui
   exige un clic pour démarrer — et elle ne laisse aucun état derrière elle. */
export var PASSAGE_CLICS_MS = 4000;
var minuteursClics = {};   // hors des tuiles : voir rappelsLecture
export function rendreLesClics(idx) {
    var s = mvFlux[idx];
    if (!s) return false;
    s._passeClics = Date.now() + PASSAGE_CLICS_MS;
    majSurfacesCable();
    if (minuteursClics[idx]) clearTimeout(minuteursClics[idx]);
    minuteursClics[idx] = setTimeout(function() {
        delete minuteursClics[idx];
        s._passeClics = 0;
        majSurfacesCable();
    }, PASSAGE_CLICS_MS);
    return true;
}

/* Suspend ou reprend les gestes d'une tuile : le calque s'efface, la page du site
   redevient cliquable. Par tuile, parce qu'on ne suspend que celle où l'on veut cliquer. */
export function basculerGestesTuile(idx) {
    var s = mvFlux[idx];
    if (!s) return false;
    s._gestesSuspendus = !s._gestesSuspendus;
    majSurfacesCable();
    showToast(s._gestesSuspendus
        ? 'Gestes suspendus sur cette vidéo — la page du site répond de nouveau.'
        : 'Gestes de zapping repris.');
    return !s._gestesSuspendus;
}

/* Affiche ou masque les calques selon l'état du mode et des tuiles. Appelé à chaque
   rendu de la grille, à chaque bascule du mode et de la suspension. */
export function majSurfacesCable() {
    var grille = grilleDuLecteur() || document;
    var cells = grille.querySelectorAll ? grille.querySelectorAll('.mv-cell') : [];
    for (var i = 0; i < cells.length; i++) {
        var idx = parseInt(cells[i].dataset.index, 10);
        var s = isNaN(idx) ? null : mvFlux[idx];
        var surface = cells[i].querySelector('.mv-cable-surface');
        if (!surface) continue;
        var passe = !!(s && s._passeClics && s._passeClics > Date.now());
        surface.style.display = (modeCable && s && !s._gestesSuspendus && !passe) ? 'block' : 'none';
    }
}

/* ── Une seule vidéo ─────────────────────────────────────────────────────────
   « Le câble, ça devrait être un mode spécifique, un seul vidéo » (12 septembre 2026).
   Le mode n'est plus un réglage posé sur la grille : il la RÉDUIT à la tuile qu'on
   regarde, comme un téléviseur n'a qu'un écran. Les autres sont mises de côté — pas
   fermées — et reviennent telles quelles en sortant du mode, y compris après un
   rechargement (elles sont enregistrées avec l'état du lecteur). */
var fluxHorsCable = [];

function reduireAUneVideo() {
    if (mvFlux.length <= 1) { activeMvIdx = mvFlux.length ? 0 : null; return 0; }
    var garde = (activeMvIdx !== null && activeMvIdx < mvFlux.length) ? activeMvIdx : 0;
    var reste = mvFlux[garde];
    fluxHorsCable = mvFlux.filter(function(f, i) { return i !== garde; });
    mvFlux.length = 0;
    mvFlux.push(reste);
    activeMvIdx = 0;
    return fluxHorsCable.length;
}

function rendreLesVideosMisesDeCote() {
    if (!fluxHorsCable.length) return 0;
    var n = 0;
    fluxHorsCable.forEach(function(f) { if (mvFlux.length < 4) { mvFlux.push(f); n++; } });
    fluxHorsCable = [];
    return n;
}

export function videosMisesDeCote() { return fluxHorsCable.length; }

export function setModeCable(v) {
    var avant = modeCable;
    modeCable = !!v;
    try { localStorage.setItem('mode_cable', modeCable ? '1' : '0'); } catch (e) {}
    var mvc = document.getElementById('mv-container');
    if (mvc) mvc.classList.toggle('mv-cable', modeCable);
    var bouge = 0;
    if (modeCable && !avant) bouge = reduireAUneVideo();
    if (!modeCable && avant) bouge = rendreLesVideosMisesDeCote();
    if (!modeCable) mvFlux.forEach(function(s, i) {
        s._gestesSuspendus = false;
        s._passeClics = 0;
        if (minuteursClics[i]) { clearTimeout(minuteursClics[i]); delete minuteursClics[i]; }
    });
    if (bouge) saveMultivisionState();
    updateMultivisionLayout();
    if (modeCable) { applyMvFocusStyling(); applyMvAudioState(); }
    return modeCable;
}

export function toggleModeCable() {
    fermerMenus();
    var misesDeCote = mvFlux.length > 1 ? mvFlux.length - 1 : 0;
    var actif = setModeCable(!modeCable);
    showToast(actif
        ? '📺 Mode câble : une seule vidéo. ↑↓ change de match, ←→ change de source. Un appui rend les clics à la page.'
            + (misesDeCote ? ' ' + misesDeCote + ' vidéo(s) mise(s) de côté, rendue(s) en sortant.' : '')
        : 'Mode câble désactivé.');
    if (actif && mvFlux.length) {
        relancerLectureTuile(0);
        annoncerCable(0);
    }
    return actif;
}

/* ══ MENUS DU LECTEUR ET REPLI VERS LE SITE ══════════════════════════════════════
   Demande du 6 septembre 2026 : « le dropdown des options par-dessus le multiview »,
   « un bouton pour revenir au lecteur de la page originale ». Les menus sont bâtis par
   js/mv-menu.js et posés au niveau du document ; ici, seulement leur contenu. */

/* Recharge la tuile par le même chemin que sa pose initiale (fallbackToIframe via
   updateMultivisionLayout), mode direct compris — plutôt que de vider et remettre `src`. */
export function rechargerTuile(idx) {
    var s = mvFlux[idx];
    if (!s) return;
    s._currentUrl = null;
    s._playing = false;
    updateMultivisionLayout();
}

export function fermerToutesLesVideos() {
    while (mvFlux.length) removeFromMultivision(mvFlux.length - 1);
}

export function ouvrirMenuTuile(idx, bouton, event) {
    if (event) { event.stopPropagation(); event.preventDefault(); }
    var s = mvFlux[idx];
    if (!s) return;
    var pos = positionDuFlux(s);
    var dom = getDomain(s.url);
    var pref = domainPrefs[dom] || 0;
    var fitInfo = MV_FIT_MODES[s.fit || 'stretch'] || MV_FIT_MODES.stretch;
    var media = s._media || mediaDirectPour(registreDirect(), s.url);
    var midTexte = (s.mid !== undefined && s.mid !== null) ? String(s.mid) : '';
    /* Menus regroupés en sections, libellés courts, et ce que fait l'entrée en
       `detail` sous le libellé (10 octobre 2026, « les menus, surtout sur mobile, c'est
       pas super affordant et efficace ») : les parenthèses allongeaient les libellés
       jusqu'à deux lignes, et rien ne séparait réparer, arranger et régler. */
    var empile = window.innerHeight > window.innerWidth;
    ouvrirMenu(bouton, [
        { titre: 'Si la vidéo ne joue pas' },
        s.mid ? { icon: '🔁', label: 'Choisir une autre source', detail: 'La liste des liens du match', onSelect: function() { showFluxSelector(idx, s.mid); } } : null,
        { icon: '↻', label: 'Recharger la vidéo', onSelect: function() { rechargerTuile(idx); } },
        /* « Pas de doublons » (25 octobre 2026) : « Source suivante » et « Lire le flux
           direct » / « Revenir à la page du site » sont ⏭ et ▶ Direct de la barre ;
           « Infos et statistiques » est ⚙ Réglages → Scores et statistiques (les stats du
           match de la vidéo choisie, que focusStream met à jour). */
        { titre: 'Cette tuile' },
        { icon: fitInfo.icon, label: 'Cadrage de l\'image', detail: 'Actuellement : ' + fitInfo.label + ' (étiré → ajusté → rempli)', onSelect: function() { cycleMvFit(idx); } },
        (idx > 0 && (deuxEcransActif() || mvLayout === 'ecrans')) ? { icon: '🖥', label: 'Échanger avec la vidéo principale', onSelect: function() { mettreSurEcranPrincipal(idx); } } : null,
        idx > 0 ? { icon: empile ? '▲' : '◀', label: empile ? 'Monter' : 'Déplacer à gauche', onSelect: function() { moveMultiviewStream(idx, 'left'); } } : null,
        idx < mvFlux.length - 1 ? { icon: empile ? '▼' : '▶', label: empile ? 'Descendre' : 'Déplacer à droite', onSelect: function() { moveMultiviewStream(idx, 'right'); } } : null,
        { titre: 'Le site ' + dom },
        { icon: '⭐', label: 'Préférer ce site', detail: 'Ses liens passent en tête pour tous les matchs', actif: pref === 1, onSelect: function() { toggleDomainPref(dom, 'fav', midTexte); updateMultivisionLayout(); } },
        { icon: '👎', label: 'Éviter ce site', detail: 'Ses liens passent en dernier', actif: pref === -1, onSelect: function() { toggleDomainPref(dom, 'dep', midTexte); updateMultivisionLayout(); } },
        { sep: true },
        { icon: '✕', label: 'Fermer cette vidéo', danger: true, onSelect: function() { removeFromMultivision(idx); } }
    ], { label: s.name || ('Vidéo ' + (idx + 1)) });
}

export function ouvrirMenuDisposition(bouton, event) {
    if (event) { event.stopPropagation(); event.preventDefault(); }
    var choisir = function(l) { return function() { setMvLayout(l); saveMultivisionState(); updateMultivisionLayout(); }; };
    /* En portrait, deux vidéos ou plus s'empilent quoi qu'on choisisse (dispositionEffective) :
       on le dit au lieu de laisser croire que le choix n'a rien fait. */
    var portrait = window.innerHeight > window.innerWidth && mvFlux.length >= 2;
    var mobile = window.innerWidth <= 768;
    var pip = ('documentPictureInPicture' in window);
    ouvrirMenu(bouton, [
        portrait ? { titre: 'En portrait, les vidéos s\'empilent ; le choix vaut à l\'horizontale' } : null,
        { icon: '⊞', label: 'Automatique', detail: 'Selon le nombre de vidéos', actif: mvLayout === 'auto', onSelect: choisir('auto') },
        { icon: '⭐', label: 'Une grande, les autres à côté', detail: 'La vidéo 1 en grand', actif: mvLayout === 'focus', onSelect: choisir('focus') },
        { icon: '☰', label: 'Les unes sous les autres', actif: mvLayout === 'vertical', onSelect: choisir('vertical') },
        { icon: '⫴', label: 'Côte à côte', actif: mvLayout === 'horizontal', onSelect: choisir('horizontal') },
        /* « Fenêtre détachée et deux écrans dans le sous-menu de disposition seulement »
           (25 octobre 2026) : ils étaient aussi sous ⚙ Réglages, « Autres fenêtres ». */
        (pip || !mobile) ? { titre: 'Autres fenêtres' } : null,
        pip ? { icon: '🖼', label: 'Fenêtre détachée', detail: mvFlux.length >= 2 ? 'La vidéo 1 reste ici, les autres s\'empilent dans une petite fenêtre' : 'La vidéo dans une petite fenêtre, par-dessus le reste', actif: !!docPiPWindow || (deuxEcransActif() && secondEcranPiP), onSelect: function() { toggleDocumentPiP(); } } : null,
        !mobile ? { icon: '🖥', label: 'Deux écrans', detail: 'Une fenêtre étirée sur deux moniteurs ; échange sans recharger', actif: mvLayout === 'ecrans', onSelect: function() { if (mvLayout !== 'ecrans') toggleEcransEtire(); } } : null,
        !mobile ? { icon: '🗗', label: 'Deux écrans : deux fenêtres', detail: 'Plein écran sur chacun ; un échange recharge les deux vidéos', actif: deuxEcransActif() && !secondEcranPiP, onSelect: function() { toggleDeuxEcrans(); } } : null
    ], { label: 'Disposition des vidéos' });
}

export function ouvrirMenuBarre(bouton, event) {
    if (event) { event.stopPropagation(); event.preventDefault(); }
    /* La disposition est un sous-menu des réglages (25 octobre 2026 : « envoyer mode câble,
       bloquer les redirections, disposition, son automatique dans les settings ») : la
       barre n'a plus son bouton. Le sous-menu s'ouvre sous le même bouton ⚙. */
    ouvrirMenu(bouton, [
        { titre: 'Affichage' },
        { icon: '⊞', label: 'Disposition', detail: 'Comment les vidéos se partagent l\'écran ; autres fenêtres', onSelect: function() { ouvrirMenuDisposition(bouton); } },
        { icon: '⤢', label: 'Cadrage de toutes les images', detail: 'étiré → ajusté → rempli', onSelect: function() { cycleMvFitAll(); } },
        { icon: '🎬', label: 'Mode cinéma', detail: 'Le lecteur seul, sans la navigation', onSelect: function() { toggleTheaterMode(document.getElementById('mv-grid-wrapper')); } },
        { icon: '📊', label: 'Scores et statistiques', detail: 'Un panneau des matchs en cours', actif: mvGameModeActive, onSelect: function() { toggleMvGameMode(); } },
        { titre: 'Lecture' },
        { icon: '📺', label: 'Mode câble', detail: 'Une seule vidéo ; glisser ↑↓ change de match, ←→ de source', actif: modeCable, onSelect: function() { toggleModeCable(); } },
        { icon: sonAuto ? '🔊' : '🔇', label: 'Son automatique', detail: 'La vidéo regardée prend le son dès qu\'elle joue', actif: sonAuto, onSelect: function() { toggleSonAuto(); } },
        { icon: '🛡', label: 'Bloquer les redirections', detail: 'Demande « Quitter le site ? » si une vidéo tente d\'emmener l\'onglet', actif: gardeSortie, onSelect: function() { toggleGardeSortie(); } },
        mvFlux.length ? { sep: true } : null,
        mvFlux.length ? { icon: '✕', label: 'Fermer toutes les vidéos', danger: true, onSelect: fermerToutesLesVideos } : null
    ], { label: 'Réglages du lecteur' });
}

export function removeFromMultivision(idx) {
    fermerMenus();
    mvFlux.splice(idx, 1);
    if (!mvFlux.length) arreterRafraichissementTuiles();

    if (activeMvIdx === idx) {
        activeMvIdx = mvFlux.length > 0 ? 0 : null;
    } else if (activeMvIdx > idx) {
        activeMvIdx--;
    }

    saveMultivisionState();
    updateMultivisionLayout();
    applyMvFocusStyling();
    applyMvAudioState();
    // Do not auto-close multiview when empty, keep the empty state visible
}

export function toggleMultiview() {
    var mvc = document.getElementById('mv-container');
    var epg = document.getElementById('epg');

    // Clear pending actions when manually toggling multiview state
    window.multiviewPendingAction = null;
    if(!mvc || !epg) return;

    if(mvc.style.display === 'none') {
        // Open Multivision full screen
        poserPleinCadre(mvc);
        epg.style.paddingRight = '0';
        mvc.style.display = 'flex';
        epg.style.display = 'none';
        syncNavState('player');

        var optionsPage = document.getElementById('options-page');
        if (optionsPage) optionsPage.style.display = 'none';
        var logsPage = document.getElementById('logs-page');
        if (logsPage) logsPage.style.display = 'none';
        var scriptPage = document.getElementById('script-page');
        if (scriptPage) scriptPage.style.display = 'none';

        updateMultivisionLayout();
        reveillerCommandes();
    } else if (!mvc.classList.contains('mv-pip')) {
        // Full screen -> Switch to PiP
        toggleMultiviewPip();
    } else {
        // PiP -> Return to Full Screen
        toggleMultiviewPip(); // This will remove pip class and restore full view
    }
}

/* Quitte le mode Cinéma s'il est actif, et RÉTABLIT le défilement de la page.

   Le mode Cinéma pose `document.body.style.overflow = 'hidden'` pour éviter deux barres
   de défilement. Seul le bouton « Quitter » le rendait. Or on peut quitter le lecteur
   par ailleurs — l'onglet Live, le Guide, Options, le bouton du bas — et la page restait
   alors DÉFINITIVEMENT non défilante : la grille du jour ne bougeait plus, sans que rien
   ne dise pourquoi, jusqu'au rechargement. C'est le défaut du lecteur qui se voit le
   plus loin de lui. Un seul point de sortie, appelé aussi par les bascules de vue. */
export function quitterModeCinema() {
    var actif = false;
    var candidats = [grilleDuLecteur(), document.getElementById('mv-grid-wrapper'), document.getElementById('mv-grid')];
    for (var i = 0; i < candidats.length; i++) {
        if (candidats[i] && candidats[i].classList.contains('mv-theater')) { candidats[i].classList.remove('mv-theater'); actif = true; }
    }
    var btn = document.getElementById('mv-close-theater');
    if (btn) { btn.remove(); actif = true; }
    /* Rendu sans condition : si la page ne défile plus, c'est nous, et c'est à nous de
       le défaire — y compris quand la classe a disparu par un autre chemin. */
    if (document.body && document.body.style.overflow === 'hidden') document.body.style.overflow = '';
    return actif;
}

export function toggleTheaterMode(elem) {
  elem = elem || grilleDuLecteur() || document.getElementById('mv-grid-wrapper');
  if (!elem) return;

  if (elem.classList.contains('mv-theater')) {
      quitterModeCinema();
  } else {
      elem.classList.add('mv-theater');
      // Hide body overflow to avoid double scrollbars
      document.body.style.overflow = 'hidden';

      var closeBtn = document.getElementById('mv-close-theater');
      if(!closeBtn) {
          closeBtn = document.createElement('button');
          closeBtn.id = 'mv-close-theater';
          closeBtn.className = 'theater-close-btn';
          closeBtn.innerHTML = '<span class="ic ic-close"></span>';
          closeBtn.title = 'Quitter le mode Cinéma';
          closeBtn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999999;background:rgba(0,0,0,0.8);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:20px;padding:8px 16px;cursor:pointer;backdrop-filter:blur(5px);font-weight:bold;box-shadow:0 4px 12px rgba(0,0,0,0.5);opacity:1;';
          closeBtn.onclick = function() { toggleTheaterMode(elem); };
          elem.appendChild(closeBtn);
      }
  }
}

export function toggleFullscreen(elem) {
  elem = elem || document.documentElement;
  if (!document.fullscreenElement && !document.mozFullScreenElement &&
    !document.webkitFullscreenElement && !document.msFullscreenElement) {

    // Si c'est la grille Multiview qui passe en plein écran, on cache la barre d'outils
    if (elem.id === 'mv-grid' || elem.id === 'mv-grid-wrapper') {
        elem.classList.add('mv-fullscreen');
        var closeFsBtn = document.getElementById('mv-close-fs');
        if(!closeFsBtn) {
            closeFsBtn = document.createElement('button');
            closeFsBtn.id = 'mv-close-fs';
            closeFsBtn.innerHTML = '<span class="ic ic-close" style="background-color: currentColor; display: inline-block; width: 24px; height: 24px;"></span>';
            closeFsBtn.style.cssText = 'position:fixed; top:10px; left:50%; transform:translateX(-50%); z-index:99999; background:rgba(255,0,0,0.8); color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:50%; width: 44px; height: 44px; display:flex; align-items:center; justify-content:center; cursor:pointer; backdrop-filter:blur(5px); box-shadow:0 4px 12px rgba(0,0,0,0.5); opacity:0; transition:opacity 0.15s;';
            closeFsBtn.onclick = function() { toggleFullscreen(); };
            elem.appendChild(closeFsBtn);

            // Auto hide
            var fsTimer;
            elem.addEventListener('mousemove', function() {
                if (document.fullscreenElement) {
                    closeFsBtn.style.opacity = '1';
                    clearTimeout(fsTimer);
                    fsTimer = setTimeout(function(){ closeFsBtn.style.opacity = '0'; }, 3000);
                }
            });
        }
    }

    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    } else if (elem.mozRequestFullScreen) {
      elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
    }
  } else {
    // Restaurer le state si on quitte le plein écran de la grille
    quitterPleinEcranLecteur();

    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
}

/* Sortie du plein écran par Échap, par le geste du système, ou par le bouton du
   navigateur : le nettoyage ne visait que `#mv-grid`, alors que la barre du lecteur
   demande le plein écran sur `#mv-grid-WRAPPER` (c'est l'élément que le bouton
   « ⛶ Plein écran » passe à `toggleFullscreen`, et celui que la fonction marque).
   Quitter par Échap laissait donc `.mv-fullscreen` posée sur la grille — qui reste
   étalée sur tout l'écran, par-dessus le guide — et le bouton rouge de sortie collé en
   haut de la page, sans plus rien à fermer. On nettoie les deux, et la fenêtre détachée
   au passage (`grilleDuLecteur`). */
export function quitterPleinEcranLecteur() {
    var vus = [];
    [grilleDuLecteur(), document.getElementById('mv-grid-wrapper'), document.getElementById('mv-grid')].forEach(function(g) {
        if (g && vus.indexOf(g) < 0) { vus.push(g); g.classList.remove('mv-fullscreen'); }
    });
    var closeFsBtn = document.getElementById('mv-close-fs');
    if (closeFsBtn) closeFsBtn.remove();
}

['fullscreenchange', 'webkitfullscreenchange'].forEach(function(ev) {
    document.addEventListener(ev, function() {
        if (document.fullscreenElement || document.webkitFullscreenElement) return;
        quitterPleinEcranLecteur();
    });
});

/* ══ DOCUMENT PICTURE-IN-PICTURE ═══════════ */
var docPiPWindow = null;

export async function toggleDocumentPiP() {
    if (!('documentPictureInPicture' in window)) {
        showToast('Votre navigateur ne supporte pas le Document PiP.');
        return;
    }

    var mvContainer = document.getElementById('mv-container');

    if (!mvContainer) return;

    if (deuxEcransActif()) { fermerDeuxEcrans(); return; }
    /* Deux vidéos ou plus : la fenêtre détachée devient le second écran — la vidéo 1
       reste dans la page, les autres s'y empilent, une par-dessus l'autre (« au moins,
       fait que la fenêtre détachée soit trois streams un par-dessus l'autre », 4 octobre
       2026). Une seule vidéo : elle part entière, comme avant. */
    if (!docPiPWindow && mvFlux.length >= 2 && !modeCable) {
        fermerMenus();
        quitterModeCinema();
        try {
            var fenPiP = await window.documentPictureInPicture.requestWindow({ width: 480, height: 270 * Math.min(3, mvFlux.length - 1) });
            preparerSecondEcran(fenPiP, false);
        } catch (e) {
            console.error('Failed to open Document PiP window', e);
            showToast('Erreur lors de l\'ouverture de la fenêtre détachée.');
        }
        return;
    }
    if (docPiPWindow) {
        // If already in PiP, closing the window will trigger the pagehide event and restore the UI
        docPiPWindow.close();
        return;
    }

    var gridWrapper = document.getElementById('mv-grid-wrapper');
    if (!gridWrapper) return;

    try {
        // Open the PiP window
        docPiPWindow = await window.documentPictureInPicture.requestWindow({
            width: 800,
            height: 450
        });

        copierFeuillesDeStyle(docPiPWindow.document);
        /* Les tuiles y ont pour parent la fenêtre détachée : leurs messages lui
           arrivent, et le script n'obéit qu'à elle. */
        brancherFenetreDeTuiles(docPiPWindow);

        // Add root styles to match main window
        docPiPWindow.document.body.style.cssText = 'margin: 0; padding: 0; background: #000; overflow: hidden; display: flex; flex-direction: column; width: 100vw; height: 100vh;';
        docPiPWindow.document.documentElement.style.cssText = document.documentElement.style.cssText;

        // Create a placeholder in the main window
        var placeholder = document.createElement('div');
        placeholder.id = 'mv-pip-placeholder';
        placeholder.style.cssText = 'flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--muted); text-align:center; padding:20px;';
        placeholder.innerHTML = '<div style="font-size:48px; margin-bottom:16px;">🖼️</div>' +
                                '<div style="font-size:18px; font-weight:bold; color:#fff; margin-bottom:8px;">Multivision détaché</div>' +
                                '<div style="margin-bottom:20px;">Les streams sont actuellement en cours de lecture dans une fenêtre flottante.</div>' +
                                '<button class="btn p" onclick="toggleDocumentPiP()">Restaurer la vue</button>';

        /* Un menu ouvert appartient au document qu'on s'apprête à vider : il partirait
           avec, et `menuOuvert` resterait pointé sur un nœud détaché — le clic suivant
           sur le même bouton l'aurait alors « refermé » au lieu de l'ouvrir. */
        fermerMenus();
        quitterModeCinema();

        // Move the grid to the PiP window
        docPiPWindow.document.body.appendChild(gridWrapper);

        /* Le repos suit la grille. Sans ces écouteurs, aucun geste fait DANS la fenêtre
           détachée ne réarmait le compte à rebours — et les en-têtes de tuiles restaient
           posés sur la vidéo. */
        docPiPWindow.document.addEventListener('mousemove', window.resetMvIdleTimer);
        docPiPWindow.document.addEventListener('click', window.resetMvIdleTimer);
        docPiPWindow.document.addEventListener('touchstart', window.resetMvIdleTimer, { passive: true });
        if (typeof window.resetMvIdleTimer === 'function') window.resetMvIdleTimer();

        // Add the placeholder to the main container
        mvContainer.appendChild(placeholder);

        // Add class to container to hide other things if needed
        mvContainer.classList.add('mv-doc-pip-active');

        // Handle PiP window close
        docPiPWindow.addEventListener('pagehide', function() {
            fermerMenus();   // même raison, dans l'autre sens
            // Remove placeholder
            var p = document.getElementById('mv-pip-placeholder');
            if (p) p.remove();

            // Move grid back to main window
            mvContainer.appendChild(gridWrapper);

            mvContainer.classList.remove('mv-doc-pip-active');
            docPiPWindow = null;
            /* Les vidéos rapportées rechargent : elles repartent comme un chargement neuf,
               et la grille est redessinée (des vidéos ont pu être ajoutées ou fermées
               pendant le détachement). */
            mvFlux.forEach(function(s, i) {
                var c = celluleDeTuile(i);
                if (!c) return;
                if (s.mode === 'direct') s._currentUrl = null;
                else reveillerApresDeplacement(s, c);
            });
            updateMultivisionLayout();
            applyMvAudioState();
            // La grille est revenue dans la page : ses commandes redeviennent visibles.
            if (typeof window.resetMvIdleTimer === 'function') window.resetMvIdleTimer();
        });

    } catch (e) {
        console.error('Failed to open Document PiP window', e);
        showToast('Erreur lors de l\'ouverture de la fenêtre détachée.');
    }
}


/* ══ OPEN FLUX (MULTIVISION) ═══════════ */
export function openFlux(e, eu, en, mid, isPage){
  mid = getOriginalMatchId(mid);
  if(e) e.preventDefault();
  var url=decodeURIComponent(eu), name=decodeURIComponent(en);

  var m = S.matchMap.get(String(mid));
  var matchName = m ? (m.homeTeam + ' vs ' + m.awayTeam) : name;

  /* `isPage` (lien classé « page » par le registre d'intégrabilité, cf.
     js/extractors.js) a longtemps ouvert un nouvel onglet automatiquement ici.
     Sur certains navigateurs mobiles, ce window.open() n'aboutissait qu'à un
     onglet vide — le blocage du site apparaît une fois DANS l'iframe, jamais au
     moment où le navigateur ouvre l'onglet lui-même, donc rien ne garantit que
     l'ouverture externe fonctionne mieux que l'iframe. Tout passe désormais par
     le Multivision comme n'importe quel autre flux, y compris les liens « page » :
     le badge « onglet » (js/ui.js: renderFluxItem) et le bouton dédié ↗ à côté de
     chaque flux restent le moyen explicite de sortir de l'application pour qui le
     souhaite, mais ce n'est plus jamais automatique. */

  if (window.multiviewPendingAction) {
      var action = window.multiviewPendingAction;

      if(action.type === 'replace' && action.replaceIdx !== undefined) {
          mvFlux[action.replaceIdx].url = url;
          mvFlux[action.replaceIdx].name = matchName;
          mvFlux[action.replaceIdx].mid = mid;
          saveMultivisionState(); updateMultivisionLayout();
      } else {
          addToMultivision(url, matchName, mid);
      }

      window.multiviewPendingAction = null;
      closeMod();
      if(document.getElementById('mv-container') && document.getElementById('mv-container').classList.contains('mv-pip')){
          toggleMultiviewPip();
      }
      return;
  }

  // Close modal if open
  var mbg = document.getElementById('mbg');
  if(mbg) mbg.classList.remove('open');

  addToMultivision(url, matchName, mid);
}

export function applyBgStyle() {
  if (!userPrefs) return; // voir initPrefs : cycle d'imports ui <-> multiview
  var s = userPrefs.bgStyle || 'gradient';

  // Icon Pack
  document.body.setAttribute('data-icon-pack', userPrefs.iconPack || 'standard');

  var c1 = userPrefs.c1 || '#000000';
  var c2 = userPrefs.c2 || '#111111';
  var c3 = userPrefs.c3 || '#222222';
  var blurVal = userPrefs.bgBlur || 0;
  var darkenVal = userPrefs.bgDarken || 0;

  document.documentElement.style.setProperty('--bg', c1);

  // Use a dedicated background container
  var appBg = document.getElementById('app-bg-container');
  if(!appBg) {
      appBg = document.createElement('div');
      appBg.id = 'app-bg-container';
      appBg.style.position = 'fixed';
      appBg.style.top = '0';
      appBg.style.left = '0';
      appBg.style.width = '100vw';
      appBg.style.height = '100vh';
      appBg.style.zIndex = '-3';
      appBg.style.pointerEvents = 'none';
      document.body.appendChild(appBg);
  }

  // Clear body background styles to avoid interference
  document.body.style.background = 'transparent';
  document.body.style.backgroundColor = 'transparent';

  appBg.style.backgroundColor = '';
  appBg.style.backgroundBlendMode = '';

  // Handle Blur and Darken via a dynamic pseudo-element or overlay
  var bgModifier = document.getElementById('bg-modifier-overlay');
  if(!bgModifier) {
      bgModifier = document.createElement('div');
      bgModifier.id = 'bg-modifier-overlay';
      bgModifier.style.position = 'fixed';
      bgModifier.style.top = '0';
      bgModifier.style.left = '0';
      bgModifier.style.width = '100vw';
      bgModifier.style.height = '100vh';
      bgModifier.style.pointerEvents = 'none';
      bgModifier.style.zIndex = '-1'; // just above the app-bg-container and behind content
      document.body.appendChild(bgModifier);
  }

  bgModifier.style.backdropFilter = blurVal > 0 ? 'blur(' + (blurVal / 5) + 'px)' : 'none';
  bgModifier.style.webkitBackdropFilter = blurVal > 0 ? 'blur(' + (blurVal / 5) + 'px)' : 'none';
  bgModifier.style.backgroundColor = darkenVal > 0 ? 'rgba(0, 0, 0, ' + (darkenVal / 100) + ')' : 'transparent';

  var fallbackBaseColor = userPrefs.removeBlack ? c1 : '#000';

  if (s === 'solid') {
    appBg.style.background = c1;
  } else if (s === 'gradient') {
    appBg.style.background = 'radial-gradient(circle at top right, ' + c2 + ' 0%, ' + c1 + ' 60%, ' + c3 + ' 100%)';
  } else if (s === 'grid') {
    appBg.style.backgroundColor = c1;
    appBg.style.backgroundImage = 'radial-gradient(' + c2 + ' 1px, transparent 1px)';
    appBg.style.backgroundSize = '24px 24px';
    appBg.style.backgroundPosition = '0 0';
  } else if (s === 'mesh_flou_1') {
    appBg.style.background = 'radial-gradient(at 20% 20%, '+c1+' 0, transparent 40%), radial-gradient(at 80% 10%, '+c2+' 0, transparent 40%), radial-gradient(at 90% 80%, '+c3+' 0, transparent 50%), radial-gradient(at 10% 90%, '+c1+' 0, transparent 40%)';
    appBg.style.backgroundColor = fallbackBaseColor;
  } else if (s === 'mesh_random') {
    var p1x = Math.floor(Math.random() * 100); var p1y = Math.floor(Math.random() * 100);
    var p2x = Math.floor(Math.random() * 100); var p2y = Math.floor(Math.random() * 100);
    var p3x = Math.floor(Math.random() * 100); var p3y = Math.floor(Math.random() * 100);
    var p4x = Math.floor(Math.random() * 100); var p4y = Math.floor(Math.random() * 100);
    appBg.style.background = 'radial-gradient(at '+p1x+'% '+p1y+'%, '+c1+' 0, transparent 50%), radial-gradient(at '+p2x+'% '+p2y+'%, '+c2+' 0, transparent 50%), radial-gradient(at '+p3x+'% '+p3y+'%, '+c3+' 0, transparent 50%), radial-gradient(at '+p4x+'% '+p4y+'%, '+c1+' 0, transparent 50%)';
    appBg.style.backgroundColor = fallbackBaseColor;
  } else if (s === 'mesh_diagonal') {
    appBg.style.background = 'radial-gradient(at 0% 0%, '+c1+' 0, transparent 60%), radial-gradient(at 50% 50%, '+c2+' 0, transparent 60%), radial-gradient(at 100% 100%, '+c3+' 0, transparent 60%), radial-gradient(at 100% 0%, '+c2+' 0, transparent 50%)';
    appBg.style.backgroundColor = fallbackBaseColor;
  } else if (s === 'mesh_center') {
    appBg.style.background = 'radial-gradient(at 50% 50%, '+c1+' 0, transparent 40%), radial-gradient(at 30% 70%, '+c2+' 0, transparent 50%), radial-gradient(at 70% 30%, '+c3+' 0, transparent 50%), radial-gradient(at 10% 10%, '+c1+' 0, transparent 20%)';
    appBg.style.backgroundColor = fallbackBaseColor;
  } else if (s === 'mesh_corner') {
    appBg.style.background = 'radial-gradient(at 0% 0%, '+c1+' 0, transparent 30%), radial-gradient(at 100% 0%, '+c2+' 0, transparent 30%), radial-gradient(at 100% 100%, '+c3+' 0, transparent 30%), radial-gradient(at 0% 100%, '+c1+' 0, transparent 30%)';
    appBg.style.backgroundColor = fallbackBaseColor;
  } else if (s === 'glow') {
    appBg.style.background = 'radial-gradient(circle at top left, '+c2+' 0%, transparent 40%), radial-gradient(circle at bottom right, '+c3+' 0%, transparent 40%), '+c1;
  } else if (s === 'aurora') {
    appBg.style.background = 'linear-gradient(to bottom, '+c1+', '+c1+'), radial-gradient(ellipse at top left, '+c2+' 0%, transparent 50%), radial-gradient(ellipse at top right, '+c3+' 0%, transparent 50%), radial-gradient(ellipse at bottom center, '+c2+' 0%, transparent 50%)';
    appBg.style.backgroundBlendMode = 'screen, screen, screen, normal';
    appBg.style.backgroundColor = c1;
  } else {
    appBg.style.background = c1 + ' radial-gradient(circle at 50% -20%, rgba(255,255,255,0.05) 0%, transparent 70%)';
  }
}

export function initPrefs() {
  /* `userPrefs` vient de js/ui.js, qui participe au cycle d'imports
     ui -> multiview -> ui : selon le module par lequel on entre dans le graphe, ce
     module-ci peut être évalué avant que ui.js n'ait initialisé `userPrefs`, et
     `initPrefs()` — appelé au chargement de ce fichier — plantait alors sur un
     `undefined`. En production, main.js est le point d'entrée et l'ordre est bon ;
     ailleurs (script serveur, test qui importe js/config.js), il ne l'était pas. */
  if (!userPrefs) return;
  var saved = safeStorageGetJSON('user_prefs');
  if (saved) { Object.assign(userPrefs, saved); }

  if(document.getElementById('pref-bg-darken')) document.getElementById('pref-bg-darken').value = userPrefs.bgDarken || 0;

  applyBgStyle();

  // Accent Color
  var accent = userPrefs.accent || '#0a84ff';
  document.documentElement.style.setProperty('--accent', accent);


  // Special UI Effects overlay
  var effectOverlay = document.getElementById('ui-effect-overlay');
  if(!effectOverlay) {
      effectOverlay = document.createElement('div');
      effectOverlay.id = 'ui-effect-overlay';
      effectOverlay.style.position = 'fixed';
      effectOverlay.style.top = '0';
      effectOverlay.style.left = '0';
      effectOverlay.style.width = '100vw';
      effectOverlay.style.height = '100vh';
      effectOverlay.style.pointerEvents = 'none';
      effectOverlay.style.zIndex = '9999';
      document.body.appendChild(effectOverlay);
  }

  effectOverlay.style.background = 'none';
  effectOverlay.style.backdropFilter = 'none';
  effectOverlay.style.boxShadow = 'none';
  effectOverlay.style.animation = 'none';
  effectOverlay.innerHTML = '';
  document.body.classList.remove('neon-glow-effect', 'glassmorphism-effect');

  var effects = userPrefs.uiEffects || [];
  // Migrate old setting if needed
  if (userPrefs.uiEffect && userPrefs.uiEffect !== 'none') {
      if (!effects.includes(userPrefs.uiEffect)) {
          effects.push(userPrefs.uiEffect);
      }
      delete userPrefs.uiEffect;
  }

  var overlayBgs = [];

  if (effects.includes('glassmorphism')) {
      document.body.classList.add('glassmorphism-effect');
      overlayBgs.push('url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' opacity=\'0.05\'/%3E%3C/svg%3E")');
  }
  if (effects.includes('neon_glow')) {
      document.body.classList.add('neon-glow-effect');
  }

  if (overlayBgs.length > 0) {
      effectOverlay.style.background = overlayBgs.join(', ');
  }


  // Btn Shape and Custom Button Styles
  var br = '12px';
  var btnBg = 'rgba(255,255,255,0.05)';
  var btnBorder = '1px solid rgba(255,255,255,0.15)';
  var btnShadow = '0 4px 10px rgba(0,0,0,0.3)';
  var btnBlur = 'blur(12px)';
  var cr = '16px';

  if(userPrefs.btnShape === 'square') { br = '4px'; cr = '8px'; }
  else if(userPrefs.btnShape === 'pill') br = '24px';
  else if(userPrefs.btnShape === 'soft') {
      br = '16px';
      cr = '16px';
      btnBg = 'rgba(255,255,255,0.08)';
      btnBorder = '1px solid rgba(255,255,255,0.05)';
      btnShadow = '0 2px 8px rgba(0,0,0,0.1)';
  }
  else if(userPrefs.btnShape === 'ghost') {
      br = '8px';
      cr = '12px';
      btnBg = 'transparent';
      btnBorder = '1px solid rgba(255,255,255,0.3)';
      btnShadow = 'none';
      btnBlur = 'none';
  }
  else if(userPrefs.btnShape === 'apple') {
      br = '18px';
      cr = '20px';
      btnBg = 'rgba(255,255,255,0.1)';
      btnBorder = '1px solid rgba(255,255,255,0.2)';
      btnBlur = 'blur(20px)';
      btnShadow = '0 8px 24px rgba(0,0,0,0.15)';
  } else if(userPrefs.btnShape === 'windows') {
      br = '4px';
      cr = '8px';
      btnBg = 'rgba(255,255,255,0.05)';
      btnBorder = '1px solid rgba(255,255,255,0.1)';
      btnBlur = 'blur(30px)';
  } else if(userPrefs.btnShape === 'steam') {
      br = '2px';
      cr = '4px';
      btnBg = 'linear-gradient(to bottom, #3a3f44, #272b30)';
      btnBorder = '1px solid #1a1c1f';
      btnShadow = 'inset 0 1px 0 rgba(255,255,255,0.1)';
  }

  document.documentElement.style.setProperty('--radius-btn', br);
  document.documentElement.style.setProperty('--btn-bg', btnBg);
  document.documentElement.style.setProperty('--btn-border', btnBorder);
  document.documentElement.style.setProperty('--btn-shadow', btnShadow);
  document.documentElement.style.setProperty('--btn-blur', btnBlur);
  document.documentElement.style.setProperty('--radius-card', cr);

  document.documentElement.style.setProperty('--card-opacity', (userPrefs.cardOpacity || 15) / 100);

  // Match Card Styles
  var cStyle = userPrefs.cardStyle || 'glass';
  var cardBorder = 'none';
  var cardBgOpac = (userPrefs.cardOpacity || 15) / 100;
  var cardShadow = '0 8px 20px rgba(0,0,0,0.5)';

  if (cStyle === 'solid') {
      cardBgOpac = Math.max(cardBgOpac, 0.8); // Ensure it's mostly solid
      document.documentElement.style.setProperty('--card-opacity', cardBgOpac);
      cardShadow = '0 4px 12px rgba(0,0,0,0.3)';
  } else if (cStyle === 'bordered') {
      cardBorder = '1px solid rgba(255,255,255,0.1)';
      cardShadow = 'none';
      document.documentElement.style.setProperty('--card-opacity', Math.min(cardBgOpac, 0.1)); // Very light bg
  } else if (cStyle === 'elevated') {
      cardBorder = '1px solid rgba(255,255,255,0.05)';
      cardShadow = '0 10px 30px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.1)';
  }

  document.documentElement.style.setProperty('--card-border', cardBorder);
  document.documentElement.style.setProperty('--card-shadow', cardShadow);


  // Nav Layout Styles
  // Removed dynamic JS nav layout injection to rely on CSS media queries for responsiveness.

  // Toggle Button Styles
  var tStyle = userPrefs.toggleStyle || 'default';
  var tGlow = 'none';
  var tBg = 'rgba(255,255,255,0.2)';
  var tBorder = '1px solid var(--accent)';

  if (tStyle === 'solid') {
      tBg = 'var(--accent)';
      tBorder = '1px solid var(--accent)';
      tGlow = '0 4px 12px rgba(0,0,0,0.5)';
  } else if (tStyle === 'underlined') {
      tBg = 'rgba(255,255,255,0.05)';
      tBorder = 'none';
      tGlow = 'inset 0 -3px 0 var(--accent)';
  } else if (tStyle === 'dot') {
      tBg = 'transparent';
      tBorder = 'none';
      tGlow = 'inset 0 -4px 0 -2px var(--accent)'; // Simulate a dot using inset shadow trick or just a subtle bottom border
  }

  document.documentElement.style.setProperty('--toggle-glow', tGlow);
  document.documentElement.style.setProperty('--toggle-bg-active', tBg);
  document.documentElement.style.setProperty('--toggle-border-active', tBorder);

  // Hover Effects
  var hoverStyle = userPrefs.hoverStyle || 'default';
  var hTransform = 'translateY(-1px)';
  var hShadow = 'none';
  var hBrightness = 'brightness(1.1)';

  if (hoverStyle === 'float') {
      hTransform = 'translateY(-3px)';
      hShadow = '0 10px 20px rgba(0,0,0,0.6)';
  } else if (hoverStyle === 'glow') {
      hShadow = '0 0 15px var(--accent)';
      hBrightness = 'brightness(1.3)';
  } else if (hoverStyle === 'scale') {
      hTransform = 'scale(1.05)';
      hShadow = '0 5px 15px rgba(0,0,0,0.4)';
  } else if (hoverStyle === 'none') {
      hTransform = 'none';
      hBrightness = 'none';
  }

  document.documentElement.style.setProperty('--btn-hover-transform', hTransform);
  document.documentElement.style.setProperty('--btn-hover-shadow', hShadow);
  document.documentElement.style.setProperty('--btn-hover-brightness', hBrightness);

  // Header Style
  var hStyle = userPrefs.hdrStyle || 'transparent';
  var hBg = 'transparent';
  var hBlur = 'blur(0px)';
  var hShadow = 'none';
  var hBorder = 'none';

  if (hStyle === 'glass') {
      hBg = 'rgba(10, 10, 12, 0.65)';
      hBlur = 'blur(20px)';
      hBorder = '1px solid rgba(255,255,255,0.05)';
  } else if (hStyle === 'solid') {
      hBg = 'var(--bg)';
      hBorder = '1px solid var(--border)';
  } else if (hStyle === 'floating') {
      hBg = 'rgba(20,20,22,0.85)';
      hBlur = 'blur(15px)';
      hShadow = '0 10px 30px rgba(0,0,0,0.8)';
      hBorder = '1px solid rgba(255,255,255,0.1)';
  }

  document.documentElement.style.setProperty('--hdr-bg', hBg);
  document.documentElement.style.setProperty('--hdr-blur', hBlur);
  document.documentElement.style.setProperty('--hdr-shadow', hShadow);
  document.documentElement.style.setProperty('--hdr-border', hBorder);


  // Update DOM selectors
  var selBgStyle = document.getElementById('pref-bg-style');
  var selC1 = document.getElementById('pref-c1');
  var selC2 = document.getElementById('pref-c2');
  var selC3 = document.getElementById('pref-c3');
  var selCard = document.getElementById('pref-card-color');
  var selCardStyle = document.getElementById('pref-card-style');
  var selBtn = document.getElementById('pref-btn-shape');
  var selAccentColor = document.getElementById('pref-accent-color');
  var selOpacity = document.getElementById('pref-card-opacity');

  if(selBgStyle) selBgStyle.value = userPrefs.bgStyle || 'gradient';
  if(selC1) {
      selC1.value = userPrefs.c1 || '#000000';
      var hexC1 = document.getElementById('hex-c1');
      if(hexC1) hexC1.textContent = selC1.value;
  }
  if(selC2) {
      selC2.value = userPrefs.c2 || '#111111';
      var hexC2 = document.getElementById('hex-c2');
      if(hexC2) hexC2.textContent = selC2.value;
  }
  if(selCard) selCard.value = userPrefs.cardColor || 'gradient-45';
  if(selC3) {
      selC3.value = userPrefs.c3 || '#222222';
      var hexC3 = document.getElementById('hex-c3');
      if(hexC3) hexC3.textContent = selC3.value;
  }

  if(selCardStyle) selCardStyle.value = userPrefs.cardStyle || 'glass';
  var selCardShape = document.getElementById('pref-card-shape');
  if(selCardShape) selCardShape.value = userPrefs.cardShape || 'auto';
  ['live', 'guide'].forEach(function(v) {
      var sel = document.getElementById('pref-disposition-' + v);
      var cle = v === 'guide' ? 'dispositionGuide' : 'dispositionLive';
      if(sel) sel.value = userPrefs[cle] || userPrefs.disposition || 'actuelle';
  });
  if(selBtn) selBtn.value = userPrefs.btnShape || 'rounded';
  if(selAccentColor) {
      selAccentColor.value = userPrefs.accent || '#0a84ff';
      var hexAccent = document.getElementById('hex-accent-color');
      if(hexAccent) hexAccent.textContent = selAccentColor.value;
  }
  if(selOpacity) selOpacity.value = userPrefs.cardOpacity || 15;

  var cbRemoveBlack = document.getElementById('pref-remove-black');
  if(cbRemoveBlack) cbRemoveBlack.checked = !!userPrefs.removeBlack;

  var selHover = document.getElementById('pref-hover-style');
  if(selHover) selHover.value = userPrefs.hoverStyle || 'default';
  var selToggle = document.getElementById('pref-toggle-style');
  if(selToggle) selToggle.value = userPrefs.toggleStyle || 'default';
  var selHdr = document.getElementById('pref-hdr-style');
  if(selHdr) selHdr.value = userPrefs.hdrStyle || 'transparent';

  var cbDeepResolve = document.getElementById('pref-deep-resolve');
  if(cbDeepResolve) cbDeepResolve.checked = !!userPrefs.deepResolve;

  var effectsContainer = document.getElementById('pref-ui-effects-container');
  if(effectsContainer) {
      var checkboxes = effectsContainer.querySelectorAll('input[type="checkbox"]');
      var effects = userPrefs.uiEffects || [];
      // migrate if needed
      if (userPrefs.uiEffect && userPrefs.uiEffect !== 'none') {
          if (!effects.includes(userPrefs.uiEffect)) {
              effects.push(userPrefs.uiEffect);
          }
      }
      checkboxes.forEach(cb => {
          cb.checked = effects.includes(cb.value);
      });

      var glassCb = document.getElementById('pref-glassmorphism');
      if (glassCb) {
          glassCb.checked = effects.includes('glassmorphism');
      }
  }
}

export function applyUserPrefs() {
  var bgStyleSel = document.getElementById('pref-bg-style');
  var c1Sel = document.getElementById('pref-c1');
  var c2Sel = document.getElementById('pref-c2');
  var c3Sel = document.getElementById('pref-c3');
  var cardSel = document.getElementById('pref-card-color');
  var cardStyleSel = document.getElementById('pref-card-style');
  var btnSel = document.getElementById('pref-btn-shape');
  var accentColorSel = document.getElementById('pref-accent-color');
  var opacSel = document.getElementById('pref-card-opacity');
  var effectsContainer = document.getElementById('pref-ui-effects-container');
  var removeBlackCb = document.getElementById('pref-remove-black');
  var deepResolveCb = document.getElementById('pref-deep-resolve');

  if(bgStyleSel) userPrefs.bgStyle = bgStyleSel.value;
  if(c1Sel) userPrefs.c1 = c1Sel.value;
  if(c2Sel) userPrefs.c2 = c2Sel.value;
  if(c3Sel) userPrefs.c3 = c3Sel.value;
  if(cardSel) userPrefs.cardColor = cardSel.value;
  userPrefs.cardStyle = 'glass';
  var cardShapeSel = document.getElementById('pref-card-shape');
  if(cardShapeSel) userPrefs.cardShape = cardShapeSel.value;
  var dispLive = document.getElementById('pref-disposition-live');
  var dispGuide = document.getElementById('pref-disposition-guide');
  if(dispLive) userPrefs.dispositionLive = dispLive.value;
  if(dispGuide) userPrefs.dispositionGuide = dispGuide.value;
  if(dispLive && dispGuide) delete userPrefs.disposition;
  if(btnSel) userPrefs.btnShape = btnSel.value;
  if(accentColorSel) userPrefs.accent = accentColorSel.value;
  var hoverSel = document.getElementById('pref-hover-style');
  if(hoverSel) userPrefs.hoverStyle = hoverSel.value;
  var toggleSel = document.getElementById('pref-toggle-style');
  if(toggleSel) userPrefs.toggleStyle = toggleSel.value;
  var hdrSel = document.getElementById('pref-hdr-style');
  if(hdrSel) userPrefs.hdrStyle = hdrSel.value;
  userPrefs.cardOpacity = '15';

  var darkenSel = document.getElementById('pref-bg-darken');
  if(darkenSel) userPrefs.bgDarken = darkenSel.value;

  if(removeBlackCb) userPrefs.removeBlack = removeBlackCb.checked;
  if(deepResolveCb) userPrefs.deepResolve = deepResolveCb.checked;

  if(effectsContainer) {
      var checkboxes = effectsContainer.querySelectorAll('input[type="checkbox"]');
      var activeEffects = [];
      checkboxes.forEach(cb => {
          if(cb.checked) activeEffects.push(cb.value);
      });

      var glassCb = document.getElementById('pref-glassmorphism');
      if (glassCb && glassCb.checked) {
          activeEffects.push('glassmorphism');
      }

      userPrefs.uiEffects = activeEffects;
  }

  safeStorageSetJSON('user_prefs', userPrefs);
  initPrefs();
  setTimeout(function() { buildEPG(S.matches); }, 0); // Rebuild to apply card colors
  showToast('Préférences sauvegardées');
}

export function markCustomTheme() {
  // when a user changes a color manually, we save
  applyUserPrefs();
}

export function applyUserBgStyleOnly() {
  applyUserPrefs();
}


export const PALETTES = [
    // Épuré & Dashboards (Tailwind/Vercel/GitHub inspired)
    { id: 'midnight', name: 'Minuit', c1: '#0f172a', c2: '#1e293b', c3: '#334155', accent: '#38bdf8' },
    { id: 'vercel', name: 'Vercel', c1: '#000000', c2: '#111111', c3: '#333333', accent: '#ffffff' },
    { id: 'github_dark', name: 'Code Sombre', c1: '#0d1117', c2: '#161b22', c3: '#21262d', accent: '#58a6ff' },
    { id: 'minimal_light', name: 'Minimal Clair', c1: '#f8fafc', c2: '#f1f5f9', c3: '#e2e8f0', accent: '#0f172a' },
    { id: 'slate', name: 'Ardoise', c1: '#1e293b', c2: '#334155', c3: '#475569', accent: '#cbd5e1' },
    { id: 'zinc', name: 'Zinc', c1: '#18181b', c2: '#27272a', c3: '#3f3f46', accent: '#f4f4f5' },

    // Steam & Tech (Material / Interfaces)
    { id: 'steam', name: 'Steam', c1: '#171a21', c2: '#1b2838', c3: '#2a475e', accent: '#66c0f4' },
    { id: 'macos_dark', name: 'macOS Sombre', c1: '#1c1c1e', c2: '#2c2c2e', c3: '#3a3a3c', accent: '#0a84ff' },
    { id: 'win_fluent', name: 'Windows 11', c1: '#202020', c2: '#282828', c3: '#333333', accent: '#60cdff' },

    // Nature & Éléments (Couleurs douces, Material HIG)
    { id: 'ocean', name: 'Océan', c1: '#0c4a6e', c2: '#075985', c3: '#0369a1', accent: '#38bdf8' },
    { id: 'forest', name: 'Forêt', c1: '#064e3b', c2: '#065f46', c3: '#047857', accent: '#34d399' },
    { id: 'nordic', name: 'Nordique', c1: '#2e3440', c2: '#3b4252', c3: '#434c5e', accent: '#88c0d0' },
    { id: 'sand', name: 'Sable', c1: '#451a03', c2: '#78350f', c3: '#92400e', accent: '#fbbf24' },

    // Vibrants maîtrisés (Accents forts sur fond très sombre)
    { id: 'cyberpunk', name: 'Cyberpunk', c1: '#09090b', c2: '#18181b', c3: '#27272a', accent: '#e11d48' },
    { id: 'aurora', name: 'Aurore', c1: '#022c22', c2: '#064e3b', c3: '#065f46', accent: '#10b981' },
    { id: 'sunset', name: 'Crépuscule', c1: '#2e1065', c2: '#4c1d95', c3: '#5b21b6', accent: '#f43f5e' },

    // Multi-teintes Vibrantes (Idéal pour les maillages)
    { id: 'synthwave', name: 'Synthwave', c1: '#2e0249', c2: '#570a57', c3: '#a91079', accent: '#f806cc' },
    { id: 'northern_lights', name: 'Aurore Boréale', c1: '#013a20', c2: '#0b8a53', c3: '#18c985', accent: '#a1ffce' },
    { id: 'neon_city', name: 'Ville Néon', c1: '#0a043c', c2: '#03506f', c3: '#bb1010', accent: '#ffe400' },
    { id: 'deep_ocean', name: 'Océan Profond', c1: '#03001c', c2: '#301e67', c3: '#5b8fb9', accent: '#b6eada' },
    { id: 'sunset_vibes', name: 'Coucher de Soleil', c1: '#3f0071', c2: '#fb2576', c3: '#ff6c00', accent: '#f7c04a' },
    { id: 'toxic_glow', name: 'Lueur Toxique', c1: '#111d13', c2: '#2a4d14', c3: '#72b01d', accent: '#e2f7ce' },
    { id: 'galactic', name: 'Galactique', c1: '#1b1a17', c2: '#1f1e2c', c3: '#6a0dad', accent: '#ffd700' },
    { id: 'miami_vice', name: 'Miami Vice', c1: '#120052', c2: '#7f00ff', c3: '#e100ff', accent: '#00f2fe' },
    { id: 'lava_lamp', name: 'Lampe à Lave', c1: '#2b0000', c2: '#800000', c3: '#ff4500', accent: '#ff8c00' },
    { id: 'frozen_berry', name: 'Baie Givrée', c1: '#18122B', c2: '#393053', c3: '#635985', accent: '#d2d0eb' },
    { id: 'neon_nights', name: 'Nuits Néon', c1: '#0b0033', c2: '#3700b3', c3: '#b300ff', accent: '#00e5ff' },
    { id: 'tropical_breeze', name: 'Brise Tropicale', c1: '#004d40', c2: '#00796b', c3: '#009688', accent: '#ffc107' },
    { id: 'desert_dune', name: 'Dune du Désert', c1: '#4a3b32', c2: '#8b5a2b', c3: '#cd853f', accent: '#ffdead' },
    { id: 'candy_pop', name: 'Pop Bonbon', c1: '#4a0e4e', c2: '#81176b', c3: '#b62a83', accent: '#f55c9b' },
    { id: 'emerald_dream', name: 'Rêve Émeraude', c1: '#01200f', c2: '#044a26', c3: '#0b8244', accent: '#50c878' },
    { id: 'royal_amethyst', name: 'Améthyste Royale', c1: '#2a004f', c2: '#4c007d', c3: '#7a00ba', accent: '#c68cff' },
    { id: 'fiery_comet', name: 'Comète Enflammée', c1: '#3d0c02', c2: '#8c1c04', c3: '#d93608', accent: '#ffcc00' },
    { id: 'aqua_marine', name: 'Aqua Marine', c1: '#00293b', c2: '#005470', c3: '#0083a3', accent: '#00e6e6' },
    { id: 'golden_hour', name: 'Heure Dorée', c1: '#4d2b00', c2: '#995a00', c3: '#e68a00', accent: '#ffe066' },
    { id: 'mystic_forest', name: 'Forêt Mystique', c1: '#0c2e1f', c2: '#1b5e3f', c3: '#2d9362', accent: '#9cedb4' }

];

export function buildSwatches() {
    var container = document.querySelector('.swatches-container');
    if (!container) return;

    container.innerHTML = '';

    // Convert PALETTES object to an array and add favTeams
    var palettesToRender = [];

    // Add dynamic palettes for favorite teams
    if (typeof favTeams !== 'undefined') {
        Object.keys(favTeams).forEach(function(teamName) {
            if (favTeams[teamName] === 1) {
                /* getTeamColors (js/db.js, et non config.js) renvoyait une seule couleur
                   pour 25 équipes : la palette de ces favoris était silencieusement
                   ignorée. teamColorPair complète toujours la paire. */
                var colors = teamColorPair(teamName);
                if (colors && colors.length >= 2) {
                    var c1 = colors[0];
                    var accent = colors[1];
                    // Create darker shades for gradient from c1
                    var c2 = c1;
                    var c3 = c1;

                    // Simple heuristic to create gradients if they are hex
                    if (c1.startsWith('#') && c1.length === 7) {
                        var r = parseInt(c1.substring(1,3), 16);
                        var g = parseInt(c1.substring(3,5), 16);
                        var b = parseInt(c1.substring(5,7), 16);

                        c2 = '#' + Math.max(0, r-30).toString(16).padStart(2,'0') + Math.max(0, g-30).toString(16).padStart(2,'0') + Math.max(0, b-30).toString(16).padStart(2,'0');
                        c3 = '#' + Math.max(0, r-60).toString(16).padStart(2,'0') + Math.max(0, g-60).toString(16).padStart(2,'0') + Math.max(0, b-60).toString(16).padStart(2,'0');
                    }

                    palettesToRender.push({
                        name: '⭐️ ' + esc(teamName),
                        c1: c1,
                        c2: c2,
                        c3: c3,
                        accent: accent
                    });
                }
            }
        });
    }

    // Add predefined palettes
    PALETTES.forEach(function(p) { palettesToRender.push(p); });

    palettesToRender.forEach(function(p) {
        var swatch = document.createElement('div');
        swatch.className = 'swatch-item';
        swatch.title = p.name;
        swatch.style.width = '32px';
        swatch.style.height = '32px';
        swatch.style.borderRadius = '50%';
        swatch.style.cursor = 'pointer';
        swatch.style.border = '2px solid ' + p.accent;
        swatch.style.background = 'linear-gradient(135deg, ' + p.c1 + ' 0%, ' + p.c2 + ' 50%, ' + p.c3 + ' 100%)';
        swatch.style.boxShadow = '0 2px 4px rgba(0,0,0,0.5)';
        swatch.style.transition = 'transform 0.2s, box-shadow 0.2s';

        swatch.onmouseenter = function() {
            swatch.style.transform = 'scale(1.15)';
            swatch.style.boxShadow = '0 0 8px ' + p.accent;
        };
        swatch.onmouseleave = function() {
            swatch.style.transform = 'scale(1)';
            swatch.style.boxShadow = '0 2px 4px rgba(0,0,0,0.5)';
        };

        swatch.onclick = function() {
            document.getElementById('pref-c1').value = p.c1.length === 7 ? p.c1 : '#000000';
            document.getElementById('pref-c2').value = p.c2.length === 7 ? p.c2 : '#111111';
            document.getElementById('pref-c3').value = p.c3.length === 7 ? p.c3 : '#222222';
            document.getElementById('pref-accent-color').value = p.accent.length === 7 ? p.accent : '#0a84ff';

            var hexC1 = document.getElementById('hex-c1');
            if(hexC1) hexC1.textContent = p.c1;
            var hexC2 = document.getElementById('hex-c2');
            if(hexC2) hexC2.textContent = p.c2;
            var hexC3 = document.getElementById('hex-c3');
            if(hexC3) hexC3.textContent = p.c3;
            var hexAccent = document.getElementById('hex-accent-color');
            if(hexAccent) hexAccent.textContent = p.accent;

            markCustomTheme();
        };

        container.appendChild(swatch);
    });
}


/* Mise à jour forcée de l'application installée (« Ajouter bouton actualiser pour
   version pwa ? », 8 septembre 2026).

   Installée sur l'écran d'accueil, l'application est servie par son service worker. Une
   version publiée peut donc mettre du temps à la remplacer — et c'est précisément le cas
   qu'on soupçonnait quand un appareil ne montrait pas la même chose qu'un autre. Rien ne
   permettait de forcer : recharger la page ne suffit pas, puisque c'est le service worker
   qui répond.

   Ce bouton désinstalle le service worker, vide TOUS ses caches, puis recharge sur une
   adresse neuve pour que le cache HTTP ne réponde pas non plus. Le service worker se
   réinstalle seul au chargement suivant (index.html l'enregistre).

   Ce qui est GARDÉ : le stockage local — préférences, favoris, calendrier du jour, liens
   retenus. On met à jour le code, on n'efface pas les réglages de l'utilisateur. */
export function viderCachesApplication() {
    var bilan = { serviceWorkers: 0, caches: 0 };
    var taches = [];
    try {
        if (typeof navigator !== 'undefined' && navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
            taches.push(navigator.serviceWorker.getRegistrations()
                .then(function(regs) {
                    bilan.serviceWorkers = regs.length;
                    return Promise.all(regs.map(function(r) { return r.unregister(); }));
                })
                .catch(function() {}));
        }
    } catch (e) {}
    try {
        if (typeof caches !== 'undefined' && caches.keys) {
            taches.push(caches.keys()
                .then(function(noms) {
                    bilan.caches = noms.length;
                    return Promise.all(noms.map(function(nom) { return caches.delete(nom); }));
                })
                .catch(function() {}));
        }
    } catch (e) {}
    return Promise.all(taches).then(function() { return bilan; });
}

export function mettreAJourApplication() {
    showToast('Mise à jour de l\'application…');
    /* Dans l'APK, qui sert le site en ligne (25 octobre 2026) : pas de service worker,
       mais le cache HTTP de la WebView, que seul Android peut vider (viderCache,
       LecteurNatifPlugin). Un APK plus ancien n'a pas la méthode : on passe outre. */
    var natif = pluginNatif();
    var cacheNatif = (natif && typeof natif.viderCache === 'function')
        ? Promise.resolve().then(function() { return natif.viderCache(); }).catch(function() {})
        : Promise.resolve();
    return Promise.all([viderCachesApplication(), cacheNatif]).then(function(r) {
        var bilan = r[0];
        lg('Mise à jour', bilan.serviceWorkers + ' service worker(s) retiré(s), ' + bilan.caches + ' cache(s) vidé(s)');
        /* Adresse neuve : sans cela le cache HTTP peut resservir la même page et le bouton
           semblerait ne rien faire. `replace` pour ne pas empiler d'historique. */
        autoriserSortie();
        try {
            var base = String(location.pathname || '/').replace(/[?#].*$/, '');
            location.replace(base + '?maj=' + Date.now());
        } catch (e) { try { location.reload(); } catch (e2) {} }
        return bilan;
    });
}

/* Version du code embarquée dans le paquet servi : à garder en phase avec `CACHE_NAME`
   (sw.js). Affichée dans la page Logs pour reconnaître un appareil qui tourne encore sur
   une copie plus ancienne servie par son service worker. */
export var VERSION_APP = 'sports-guide-v87';

/* Ce que CET appareil-ci arrive à lire (7 septembre 2026).

   « Selon le device, ça voit ou non les scores et les streams. » Les trois sources ne
   viennent pas du même endroit et n'échouent pas ensemble : le calendrier (scores, états)
   vient de data/schedule.json ou d'un appel DIRECT à ESPN ; les liens viennent de
   data/streams.json. Un appareil peut avoir l'un sans l'autre — un bloqueur qui filtre
   site.api.espn.com, un réseau qui coupe un téléchargement — et rien ne le disait. Ces
   trois lignes se comparent d'un appareil à l'autre sans rien deviner. */
export function diagnosticAppareilHtml() {
    var ligne = function(nom, etat, detail) {
        var couleur = etat === 'ok' ? '#34c759' : (etat === 'warn' ? '#ffcc00' : 'var(--red)');
        var icone = etat === 'ok' ? '✅' : (etat === 'warn' ? '⚠️' : '❌');
        return '<div style="display:flex; justify-content:space-between; gap:10px; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.05);">' +
               '<span style="display:flex; align-items:center; gap:8px;"><span>' + icone + '</span><b>' + esc(nom) + '</b></span>' +
               '<span style="color:' + couleur + '; font-size:12px; text-align:right;">' + esc(detail) + '</span></div>';
    };

    var cal = (typeof window !== 'undefined' && window.calendrierInfo) || null;
    var html = '<div style="margin-bottom:10px;"><div style="font-weight:700; margin-bottom:4px;">Cet appareil</div>';
    if (!cal) html += ligne('Calendrier (scores, états)', 'warn', 'pas encore chargé');
    else html += ligne('Calendrier (scores, états)', /périmé/.test(cal.source) ? 'ko' : 'ok',
                       cal.count + ' matchs · ' + cal.source + (cal.ageMin ? ' · ' + cal.ageMin + ' min' : ''));

    var espn = (typeof window !== 'undefined' && window.espnInfo) || null;
    if (!espn || !espn.tentatives) html += ligne('ESPN (appel direct)', 'warn', 'aucun appel encore');
    else if (espn.echecs >= espn.tentatives) html += ligne('ESPN (appel direct)', 'ko', 'injoignable · ' + espn.echecs + '/' + espn.tentatives + ' en échec' + (espn.derniereErreur ? ' · ' + espn.derniereErreur : ''));
    else html += ligne('ESPN (appel direct)', espn.echecs ? 'warn' : 'ok', (espn.tentatives - espn.echecs) + '/' + espn.tentatives + ' réponses');

    var err = (typeof window !== 'undefined' && window.prefetchedStreamsError) || null;
    var info = (typeof window !== 'undefined' && window.prefetchedStreamsInfo) || null;
    if (err) html += ligne('Liens (data/streams.json)', 'ko', 'illisible · ' + err);
    else if (info) {
        /* Verte tant que le cache est frais, AVERTISSEMENT au-delà de 45 min : affichée en
           vert quel que soit l'âge, cette ligne a laissé passer 45 h de panne sans que
           personne ne la lise comme un problème (js/rattrapage.js). */
        var etatCache = etatCacheServeur(info, { erreur: !!window.prefetchedStreamsError });
        html += ligne('Liens (data/streams.json)', etatCache.niveau === 'ok' ? 'ok' : 'warn',
            info.count + ' matchs · généré il y a ' + ageEnClair(info.ageMin)
            + (etatCache.niveau === 'perime' ? ' — le serveur ne publie plus' : (etatCache.niveau === 'vieux' ? ' — un passage manqué' : '')));
    }
    else html += ligne('Liens (data/streams.json)', 'warn', 'pas encore chargé');

    /* Les trois sources peuvent être vertes et les cartes rester vides : ce qui manque
       alors est la FUSION, l'étape qui rattache les liens aux matchs de la grille. Sans
       cette ligne, on ne pouvait pas distinguer « les liens ne sont pas arrivés » de
       « ils sont là mais ne se rattachent pas ». */
    var fus = (typeof window !== 'undefined' && window.fusionInfo) || null;
    if (!fus) html += ligne('Fusion (liens ↔ matchs)', 'warn', 'pas encore faite');
    else if (!fus.avecLiens) html += ligne('Fusion (liens ↔ matchs)', 'ko', 'aucun des ' + fus.grille + ' matchs n\'a reçu de lien');
    else html += ligne('Fusion (liens ↔ matchs)', 'ok', fus.avecLiens + ' matchs sur ' + fus.grille + ' ont des liens' + (fus.ms ? ' · ' + (fus.ms >= 1000 ? (fus.ms / 1000).toFixed(1) + ' s' : fus.ms + ' ms') : ''));

    /* Un stockage local plein est invisible : les écritures ne prennent pas, les lectures
       rendent une version ancienne. Sur téléphone la limite est de quelques mégaoctets. */
    var st = (typeof window !== 'undefined' && window.stockageInfo) || null;
    var ko = tailleStockageKo();
    /* Plein, il se vide de ses caches refaisables avant de refuser (safeStorageSet) : la
       ligne dit lesquels sont partis et ce qui pèse le plus. */
    var gros = plusGrossesCles(3).filter(function(c) { return c[1] >= 50; })
        .map(function(c) { return c[0] + ' ' + c[1] + ' Ko'; }).join(', ');
    var liberees = (st && st.liberees && st.liberees.length) ? ' · caches vidés pour faire de la place : ' + st.liberees.join(', ') : '';
    if (st && st.echecs) html += ligne('Stockage local', 'ko', st.echecs + ' écriture(s) refusée(s) · ' + st.derniereErreur + ' · ' + (ko === null ? '?' : ko) + ' Ko' + liberees + (gros ? ' · ' + gros : ''));
    else html += ligne('Stockage local', 'ok', (ko === null ? 'illisible' : ko + ' Ko utilisés') + liberees + (gros ? ' · ' + gros : ''));

    /* Quelle version du code tourne ICI : un service worker peut servir une copie plus
       ancienne que celle qui est publiée, et deux appareils ne montrent alors pas la
       même application. */
    var sw = 'sans service worker';
    try { if (navigator.serviceWorker && navigator.serviceWorker.controller) sw = 'service worker actif'; } catch (e) {}
    html += ligne('Version', 'ok', VERSION_APP + ' · ' + sw);
    /* Le script de nettoyage qui tourne ICI, et s'il est le dernier : le blocage du recul
       de l'onglet n'existe que depuis la 1.17, et Tampermonkey peut garder l'ancienne des
       jours (18 octobre 2026). */
    var prot = etatProtection(typeof window !== 'undefined' ? window : {}, getBridgeStatus());
    if (prot.type === 'extension') html += ligne('Extension de nettoyage', prot.aJour ? 'ok' : 'warn', prot.aJour ? prot.version + ' (à jour)'
        : prot.version + ' — la ' + VERSION_EXTENSION + ' est sortie : Plus → 🧩 Script → Télécharger l\'extension, remplacer le dossier, puis ↻ dans chrome://extensions');
    else if (prot.type === 'script') html += ligne('Script de nettoyage', prot.aJour ? 'ok' : 'warn', prot.aJour ? prot.version + ' (à jour)'
        : prot.version + ' — la ' + VERSION_SCRIPT + ' est sortie : Plus → 🧩 Script → Installer le script, puis accepter la mise à jour dans Tampermonkey');
    else html += ligne('Script de nettoyage', 'warn', 'absent — Plus → 🧩 Script');
    /* Le mode direct, vu d'ici : combien de manifestes répondent, et pourquoi les autres
       non (18 octobre 2026, « le direct marche jamais »). */
    var sondes = Object.keys(sondesDirect).map(function(k) { return sondesDirect[k]; }).filter(function(x) { return x && !x.enCours; });
    if (sondes.length) {
        var bons = sondes.filter(function(x) { return x.ok; }).length;
        var raisons = {};
        sondes.forEach(function(x) { if (!x.ok) raisons[x.raison || '?'] = (raisons[x.raison || '?'] || 0) + 1; });
        var detail = Object.keys(raisons).map(function(r) { return raisons[r] + ' × ' + r; }).join(', ');
        html += ligne('Flux directs', bons ? 'ok' : 'warn', bons + ' sur ' + sondes.length + ' répondent' + (detail ? ' · refusés : ' + detail : ''));
    }
    /* Ce que CET appareil a appris (fusionAppareil, js/playability.js) : les hôtes jugés
       morts ici passent derrière tout le reste, et ça ne se voyait nulle part (26 octobre
       2026, « le pourcentage de streams qui marchent est vraiment plus bas »). */
    var registreLocal = safeStorageGetJSON('play_ledger', {}) || {};
    var hotesLocaux = Object.keys(registreLocal);
    if (hotesLocaux.length) {
        var fusion = playLedger();
        var morts = hotesLocaux.filter(function(h) { return fusion[h] && fusion[h].appareilMort; });
        var anciens = hotesLocaux.filter(function(h) { var e = registreLocal[h]; return !(e && typeof e.at === 'number' && Date.now() - e.at < OUBLI_APPAREIL_MS); }).length;
        html += ligne('Registre de l\'appareil', morts.length > hotesLocaux.length / 2 ? 'warn' : 'ok',
            hotesLocaux.length + ' hôte(s) éprouvé(s) ici · ' + morts.length + ' jugé(s) mort(s) ici (classés en bas pendant 24 h)'
            + (morts.length ? ' : ' + morts.slice(0, 5).map(esc).join(', ') + (morts.length > 5 ? '…' : '') : '')
            + (anciens ? ' · ' + anciens + ' sans essai depuis 24 h (plus de veto)' : ''));
    }
    /* La garde contre les redirections, coupée par le menu ⚙ Réglages du lecteur, ne se voyait nulle
       part ailleurs (18 octobre 2026). */
    html += ligne('Garde « Quitter le site ? »', gardeSortie ? 'ok' : 'ko',
        gardeSortie ? 'active' : 'coupée — Lecteur → ⚙ Réglages → 🛡 Bloquer les redirections des sites');
    html += '<div style="display:flex; justify-content:flex-end; padding-top:8px;">'
          + '<button class="btn xs" onclick="mettreAJourApplication()" '
          + 'title="Retire le service worker, vide ses caches et recharge. Les réglages, favoris et liens gardés en local ne sont pas touchés.">'
          + '↻ Mettre à jour l\'application</button></div>';

    return html + '</div>' + sortiesHtml(safeStorageGetJSON(CLE_SORTIES, []) || [], esc);
}

/* Dans l'APK : le journal de l'appareil (js/tele.js, Journal.java), demandé au natif à
   chaque affichage de la page Logs et posé en tête. Ailleurs, rien. */
function remplirDiagnosticAndroid(container) {
    var natif = pluginNatif();
    if (!natif || typeof natif.diagnostic !== 'function' || !container) return;
    var place = document.createElement('div');
    place.className = 'diag-android-place';
    container.insertBefore(place, container.firstChild);
    Promise.resolve(natif.diagnostic()).then(function(d) {
        place.innerHTML = diagnosticAndroidHtml(d, esc);
    }).catch(function(e) {
        place.textContent = 'Journal Android illisible : ' + (e && e.message || e);
    });
}

export function renderSourcesStatus() {
    var container = document.getElementById('sources-status-container');
    if (!container) return;
    if (sourcesStatus.length === 0) {
        container.innerHTML = diagnosticAppareilHtml() + '<div style="color: var(--muted2); text-align: center;">Aucune donnée (Scraping en attente...)</div>';
        remplirDiagnosticAndroid(container);
        return;
    }

    var html = diagnosticAppareilHtml();
    sourcesStatus.forEach(function(s) {
        var icon = s.status === 'success' ? '✅' : (s.status === 'warning' ? '⚠️' : '❌');
        var color = s.status === 'success' ? '#34c759' : (s.status === 'warning' ? '#ffcc00' : 'var(--red)');

        html += '<div style="display:flex; justify-content:space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 4px 0;">' +
                  '<div style="display:flex; align-items:center; gap: 8px;">' +
                      '<span style="font-size: 14px;">' + icon + '</span>' +
                      '<span style="font-weight: bold; color: var(--text);">' + esc(s.name) + '</span>' +
                      '<button class="btn o" title="Investigate" style="padding: 2px 6px; font-size: 11px; margin-left: 4px;" onclick="window.openInvestigatorModal(); window.investigateUrl(\'https://' + escJs(s.name) + '\');">🕵️</button>' +
                  '</div>' +
                  '<div style="display:flex; align-items:center; gap: 10px; font-size: 12px;">' +
                      '<span style="color: ' + color + ';">' + esc(s.message) + '</span>' +
                      '<span style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; color: var(--muted);">' + esc(s.matchCount) + ' matchs</span>' +
                      '<span style="color: var(--muted2); font-size: 10px; width: 50px; text-align:right;">' + esc(s.time) + '</span>' +
                  '</div>' +
                '</div>';
    });
    container.innerHTML = html;
    remplirDiagnosticAndroid(container);
}

export function exportDebugLogs() {
    try {
        var exportData = {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            sourcesStatus: sourcesStatus,
            scrapeLogs: scrapeLogs,
            manualLogs: manualStreamLogs,
            proxies: PROXIES ? PROXIES.map(function(p) { return p.id || p.toString(); }) : [],
            proxyHealth: (typeof window.getProxyHealth === 'function') ? window.getProxyHealth() : null
        };

        var jsonString = JSON.stringify(exportData, null, 2);
        var blob = new Blob([jsonString], {type: "application/json"});
        var url = URL.createObjectURL(blob);

        var a = document.createElement('a');
        a.href = url;
        a.download = 'jmtv-debug-logs-' + new Date().toISOString().slice(0,10) + '.json';
        document.body.appendChild(a);
        a.click();

        setTimeout(function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            window.showToast("Logs exportés avec succès !");
        }, 100);
    } catch (e) {
        window.showToast("Erreur lors de l'exportation des logs.");
        console.error("Export error:", e);
    }
}

export function renderScrapeLogs() {
    renderSourcesStatus();
    if (typeof window.renderDomainStats === 'function') window.renderDomainStats();
    var container = document.getElementById('scrape-logs-container');
    if(!container) return;
    if(scrapeLogs.length === 0) {
        container.innerHTML = '<div style="color: var(--muted2); text-align: center; padding: 10px;">Aucun log récent.</div>';
        return;
    }
    var html = '';
    scrapeLogs.forEach(function(log) {
        var color = log.status === 'error' ? 'var(--red)' : (log.status === 'success' ? '#34c759' : 'var(--text)');
        var icon = log.status === 'error' ? '❌' : (log.status === 'success' ? '✅' : 'ℹ️');

        var errorDisplay = '';
        if (log.error) {
            if (log.error.indexOf('\n') !== -1 || log.error.indexOf('=== DIAGNOSTIC LOG ===') !== -1) {
                // If the error message is multiline or a specific debug log, use pre for formatting and add a copy button
                var textColor = log.status === 'success' ? 'var(--text)' : 'var(--red)';
                errorDisplay = '<pre style="color:' + textColor + '; font-size: 11px; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px; overflow-x: auto; white-space: pre-wrap;">' + esc(log.error) + '</pre>' +
                               '<button class="btn o" style="font-size: 10px; padding: 2px 6px; align-self: flex-start;" onclick="window.copyToClipboard(\'' + escJs(log.error) + '\').then(function(){ window.showToast(\'Log copié !\'); }).catch(function(){ window.showToast(\'Erreur copie\'); });">📋 Copier le log</button>';
            } else {
                var singleColor = log.status === 'success' ? 'var(--text)' : 'var(--red)';
                errorDisplay = '<div style="color:' + singleColor + '; font-size: 11px;">' + esc(log.error) + '</div>';
            }
        }

        html += '<div style="display:flex; flex-direction:column; gap:4px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px; margin-bottom: 8px;">' +
                  '<div style="display:flex; justify-content:space-between;">' +
                      '<span style="color:var(--muted);">' + esc(log.time) + '</span>' +
                      '<span style="color:' + color + ';">' + icon + ' ' + esc(log.status.toUpperCase()) + '</span>' +
                  '</div>' +
                  '<div style="word-break: break-all; color: #a1a1aa; font-weight: 500;">' + esc(log.url) + '</div>' +
                  errorDisplay +
                '</div>';
    });
    container.innerHTML = html;

    var manualContainer = document.getElementById('manual-logs-container');
    if(!manualContainer) return;
    if(manualStreamLogs.length === 0) {
        manualContainer.innerHTML = '<div style="color: var(--muted2); text-align: center; padding: 10px;">Aucun diagnostic récent.</div>';
        return;
    }
    var manualHtml = '';
    manualStreamLogs.forEach(function(log) {
        var color = log.status === 'error' ? 'var(--red)' : (log.status === 'success' ? '#34c759' : 'var(--text)');
        var icon = log.status === 'error' ? '❌' : (log.status === 'success' ? '✅' : 'ℹ️');

        var errorDisplay = '';
        if (log.error) {
            if (log.error.indexOf('\n') !== -1 || log.error.indexOf('===') !== -1) {
                var textColor = log.status === 'success' ? 'var(--text)' : 'var(--red)';
                errorDisplay = '<pre style="color:' + textColor + '; font-size: 11px; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px; overflow-x: auto; white-space: pre-wrap;">' + esc(log.error) + '</pre>' +
                               '<button class="btn o" style="font-size: 10px; padding: 2px 6px; align-self: flex-start;" onclick="window.copyToClipboard(\'' + escJs(log.error) + '\').then(function(){ window.showToast(\'Log copié !\'); }).catch(function(){ window.showToast(\'Erreur copie\'); });">📋 Copier le log</button>';
            } else {
                var singleColor = log.status === 'success' ? 'var(--text)' : 'var(--red)';
                errorDisplay = '<div style="color:' + singleColor + '; font-size: 11px;">' + esc(log.error) + '</div>';
            }
        }

        manualHtml += '<div style="display:flex; flex-direction:column; gap:4px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px; margin-bottom: 8px;">' +
                  '<div style="display:flex; justify-content:space-between;">' +
                      '<span style="color:var(--muted);">' + esc(log.time) + '</span>' +
                      '<span style="color:' + color + ';">' + icon + ' ' + esc(log.status.toUpperCase()) + '</span>' +
                  '</div>' +
                  '<div style="color: #fff; font-weight: bold;">' + esc(log.matchName) + '</div>' +
                  '<div style="word-break: break-all; color: #a1a1aa; font-weight: 500;">' + esc(log.url) + '</div>' +
                  errorDisplay +
                '</div>';
    });
    manualContainer.innerHTML = manualHtml;
}

export function openOptionsPage() {
    showPage('options-page');
    if (document.getElementById('options-page')) {
        buildSwatches();

        initPrefs();
        initProxySettings();
    }
}

/* ── Réglages réseau (proxy personnalisé, clés API) ─────────────────────── */
export function initProxySettings() {
    var st = (typeof window.getProxySettings === 'function') ? window.getProxySettings() : {};
    var a = document.getElementById('pref-custom-proxy'); if (a) a.value = st.customProxy || '';
    var b = document.getElementById('pref-cors-sh-key'); if (b) b.value = st.corsShKey || '';
    var c = document.getElementById('pref-corsproxy-io-key'); if (c) c.value = st.corsProxyIoKey || '';
    renderProxyStatus();
}

export function renderProxyStatus() {
    var el = document.getElementById('proxy-status');
    if (!el) return;
    var list = window.PROXIES || [];
    var health = (typeof window.getProxyHealth === 'function') ? window.getProxyHealth() : {};
    var parts = list.filter(function(p) { return !p.direct; }).map(function(p) {
        var h = health[p.id];
        var state = '⚪';
        if (h && h.lastOk && (!h.lastFail || h.lastOk >= h.lastFail)) state = '🟢';
        else if (h && h.lastFail) state = (Date.now() - h.lastFail < 3 * 60 * 1000) ? '🔴' : '🟠';
        return state + ' ' + esc(p.label || p.id);
    });
    var info = window.prefetchedStreamsInfo;
    var pre = 'Cache serveur : indisponible. ';
    if (info && info.generatedAt) {
        var srcOk = (info.sources || []).filter(function(s) { return s && s.ok; }).length;
        var srcAll = (info.sources || []).length;
        var streams = 0;
        (window.prefetchedStreamMatches || []).forEach(function(m) { streams += (m.streamLinks || []).length; });
        pre = 'Cache serveur : ' + info.count + ' matchs, ' + streams + ' liens, ' + srcOk + '/' + srcAll + ' sources, généré il y a ' + info.ageMin + ' min. ';
    }
    /* État du pont d'affichage : c'est lui qui décide si une page non intégrable pourra
       être reconstruite dans le Multivision plutôt qu'ouverte en onglet (js/embed-bridge.js). */
    var b = getBridgeStatus();
    var bridgeTxt = b.available
        ? '🎩 Pont script utilisateur : actif (v' + esc(String(b.version)) + ') — les pages non intégrables sont reconstruites.'
        : '🎩 Pont script utilisateur : absent — repli sur les proxys CORS pour les pages non intégrables.';

    el.innerHTML = pre + 'Proxys : ' + (parts.join(' · ') || 'aucun') + '<br>' + bridgeTxt;
}

/* Ouvre la page GitHub Actions du workflow horaire : le bouton « Run workflow » y lance
   un calcul immédiat de data/streams.json (le site étant statique, l'app ne peut pas
   appeler l'API GitHub sans jeton). */
export function openStreamsWorkflow() {
    var url = window.STREAMS_WORKFLOW_URL || 'https://github.com/ouellettejeanphilippe-source/footy/actions/workflows/scrape_streams.yml';
    window.open(url, '_blank', 'noopener');
    showToast('Sur GitHub : « Run workflow », puis revenez et cliquez « Recharger les liens serveur » (≈ 2 min).');
}

/* Relit data/streams.json tout de suite (sans attendre la tranche de 5 min) et refusionne
   les liens dans la grille. */
export function reloadPrefetchedStreams() {
    var btn = document.getElementById('btn-reload-prefetched');
    if (btn) btn.disabled = true;
    var before = window.prefetchedStreamsInfo ? window.prefetchedStreamsInfo.generatedAt : null;
    return loadPrefetchedStreams(true).then(function(list) {
        var info = window.prefetchedStreamsInfo || {};
        renderProxyStatus();
        if (!info.generatedAt) showToast('Cache serveur indisponible pour le moment.');
        else if (before && info.generatedAt === before) showToast('Cache serveur inchangé (généré il y a ' + info.ageMin + ' min). Le workflow tourne encore ?');
        else showToast('Liens serveur rechargés : ' + list.length + ' matchs (il y a ' + info.ageMin + ' min).');
        return loadAll(true, false);
    }).catch(function(e) {
        showToast('Rechargement impossible : ' + (e && e.message ? e.message : e));
    }).then(function() { if (btn) btn.disabled = false; });
}

export function saveProxySettings() {
    var read = function(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
    var custom = read('pref-custom-proxy');
    if (custom && !/^https?:\/\//i.test(custom)) { showToast('Le proxy doit commencer par http(s)://'); return; }
    try {
        localStorage.setItem('custom_proxy_url', custom);
        localStorage.setItem('cors_sh_api_key', read('pref-cors-sh-key'));
        localStorage.setItem('corsproxy_io_api_key', read('pref-corsproxy-io-key'));
    } catch (e) {}
    if (typeof window.rebuildProxies === 'function') window.rebuildProxies();
    if (typeof window.resetProxyHealth === 'function') window.resetProxyHealth();
    renderProxyStatus();
    showToast('Réglages réseau enregistrés. Nouvelle recherche de streams...');
    loadAll(true, true);
}

export function openLogsPage() {
    showPage('logs-page');
    if (document.getElementById('logs-page')) {
        renderScrapeLogs();
    }
}

export function openScriptPage() {
    showPage('script-page');
}

// Kept for backward compatibility if called elsewhere, though shouldn't be needed



initPrefs(); // Run once on load


/* La fenêtre du guide d'installation des scripts. Elle reprend le contenu de la page
   Plus → 🧩 Script (#guide-installation, index.html) : « garder vieux guide plutôt que
   nouveau » (13 octobre 2026). */
export function installTampermonkey() {
    var existing = document.getElementById('tm-modal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'tm-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'Installation des scripts');
    modal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);z-index:9999;background:rgba(20,20,20,0.97);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:20px;backdrop-filter:blur(15px);display:flex;flex-direction:column;gap:14px;max-height:85vh;overflow-y:auto;box-shadow:0 15px 40px rgba(0,0,0,0.8);width:92%;max-width:620px;-webkit-overflow-scrolling:touch;color:#fff;';

    var closeBtn = document.createElement('div');
    closeBtn.innerHTML = '<span class="ic ic-close"></span>';
    closeBtn.style.cssText = 'position:absolute;top:12px;right:12px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.1);border-radius:50%;cursor:pointer;color:#fff;font-size:14px;';
    closeBtn.onclick = function() { modal.remove(); };
    modal.appendChild(closeBtn);

    var title = document.createElement('h2');
    title.style.cssText = 'margin:0;padding-right:40px;font-size:18px;font-weight:bold;';
    title.textContent = '🧩 Installation des Scripts';
    modal.appendChild(title);

    var guide = document.getElementById('guide-installation');
    var contenu = document.createElement('div');
    contenu.className = 'stack prose';
    contenu.innerHTML = guide ? guide.innerHTML : '';
    modal.appendChild(contenu);

    document.body.appendChild(modal);

    setTimeout(function() {
        var closeListener = function(e) {
            if (!document.body.contains(modal)) { document.removeEventListener('click', closeListener); return; }
            /* Un clic de programme (le lien du zip, posé hors de la fenêtre) ne la ferme pas :
               on la refermait au moment même où le téléchargement partait. */
            if (e.isTrusted && !modal.contains(e.target)) {
                modal.remove();
                document.removeEventListener('click', closeListener);
            }
        };
        document.addEventListener('click', closeListener);
    }, 10);
}

/* Au démarrage : la fenêtre s'ouvre une fois, et seulement si rien ne protège encore
   les lecteurs, après avoir laissé au script ou à l'extension le temps de s'annoncer. */
export function proposerGuideAuDemarrage() {
    return waitForBridge(1500).then(function() {
        var vu = safeStorageGet('hasSeenScriptModal');
        var etat = etatProtection(window, getBridgeStatus());
        if (!doitProposerGuide(vu, etat)) return false;
        safeStorageSet('hasSeenScriptModal', GUIDE_VU);
        installTampermonkey();
        return true;
    });
}

export function installerScriptUtilisateur() {
    autoriserSortie();
    window.location.href = './multiview-cleaner.user.js';
}

/* Les commandes du lecteur sont-elles effacées (appliquerRepos) ? */
export function commandesCachees() {
    var barre = document.getElementById('mv-toolbar');
    return !!(barre && barre.classList.contains('mv-cachee'));
}

/* Les commandes reviennent : si le focus n'y est pas déjà, ⏭ (la source suivante) ;
   sans vidéo, « + Ajouter ». */
export function focaliserCommandes() {
    var barre = document.getElementById('mv-toolbar');
    if (!barre || barre.contains(document.activeElement)) return;
    var b = document.getElementById('mv-src-next');
    if (!b || b.disabled) b = barre.querySelector('.mv-tb-btn.primary');
    if (b) b.focus();
}

/* ⏮ ⏭ de la barre : la source de la vidéo active. */
export function changerSourceActive(sens) {
    if (!mvFlux.length) { showToast('Aucune vidéo dans le lecteur : + Ajouter.'); return false; }
    return changerSourceTuile(tuileActive(), sens);
}

/* Les gestes de la barre sur la vidéo choisie : les mêmes que ceux de son menu ⋮. */
export function choisirVideo(idx) {
    if (idx < 0 || idx >= mvFlux.length) return;
    focusStream(idx);
}
export function ouvrirMenuVideoActive(bouton, event) {
    if (!mvFlux.length) { if (event) event.stopPropagation(); showToast('Aucune vidéo dans le lecteur : + Ajouter.'); return; }
    ouvrirMenuTuile(tuileActive(), bouton, event);
}
export function basculerDirectActif() {
    if (mvFlux.length) toggleDirectMode(tuileActive());
}

/* Le côté gauche de la barre : une pastille par vidéo, la choisie en blanc, avec le nom
   du match (comme le titre d'un film) et sa source. Les pastilles ne sont refaites que
   si les vidéos changent ; sinon, seulement l'état — le focus de la télécommande, posé
   sur une pastille, y reste. */
function majBarreVideos() {
    var zone = document.getElementById('mv-bar-videos');
    if (!zone) return;
    var actif = tuileActive();
    var signature = mvFlux.map(function(s) { return s._internalId + '|' + (s.name || ''); }).join('§');
    if (zone._signature !== signature) {
        var focusSur = zone.contains(document.activeElement) ? document.activeElement.getAttribute('data-idx') : null;
        zone.innerHTML = mvFlux.length
            ? mvFlux.map(function(s, i) {
                var nom = s.name || getDomain(s.url) || ('Vidéo ' + (i + 1));
                return '<button type="button" class="mv-chip" data-idx="' + i + '" onclick="choisirVideo(' + i + ')" title="' + esc(nom) + (i < 4 ? ' — touche ' + (i + 1) : '') + '">'
                    + '<span class="mv-chip-n" aria-hidden="true">' + (i + 1) + '</span>'
                    + '<span class="mv-chip-txt"><span class="mv-chip-nom">' + esc(nom) + '</span><span class="mv-chip-etat"></span></span>'
                    + '</button>';
            }).join('')
            : '<span class="mv-title">Lecteur — aucune vidéo</span>';
        zone._signature = signature;
        if (focusSur !== null) {
            var b = zone.querySelector('.mv-chip[data-idx="' + focusSur + '"]');
            if (b) b.focus();
        }
    }
    zone.classList.toggle('mv-bar-videos-nombreuses', mvFlux.length >= 3);
    Array.prototype.forEach.call(zone.querySelectorAll('.mv-chip'), function(b) {
        var i = parseInt(b.getAttribute('data-idx'), 10);
        var choisie = i === actif;
        b.classList.toggle('actif', choisie);
        b.setAttribute('aria-pressed', choisie ? 'true' : 'false');
        var etat = b.querySelector('.mv-chip-etat');
        var s = mvFlux[i];
        if (etat && s) {
            etat.textContent = choisie ? libelleSource(s) : '';
            etat.classList.toggle('joue', !!s._playing);
        }
    });
    var s = mvFlux[actif];
    var direct = document.getElementById('mv-bar-direct');
    if (direct) {
        var dispo = !!(s && (s.mode === 'direct' || (celluleDeTuile(actif) && celluleDeTuile(actif).classList.contains('mv-direct-dispo'))));
        direct.hidden = !dispo;
        direct.classList.toggle('on', !!(s && s.mode === 'direct'));
        var lb = direct.querySelector('.mv-tb-lb');
        var ic = direct.querySelector('.mv-tb-ic');
        if (lb) lb.textContent = (s && s.mode === 'direct') ? 'Page du site' : 'Direct';
        if (ic) ic.textContent = (s && s.mode === 'direct') ? '🖼' : '▶';
    }
    ['mv-src-prev', 'mv-src-next', 'mv-bar-video-menu'].forEach(function(id) {
        var b = document.getElementById(id);
        if (b) b.disabled = !s;
    });
}

/* ── La manette (js/manette.js) ────────────────────────────────────────────────
   La manette est la télécommande, plus quelques boutons : les flèches passent par les
   mêmes écouteurs que le clavier et la télécommande (navigation du mode TV, mode câble
   du lecteur), A clique ce qui a le focus, B est le Retour de la télécommande
   (window.retourTele). Le reste agit sur la tuile active du lecteur. */
var manetteBranchee = null;
function tuileActive() {
    return (activeMvIdx !== null && activeMvIdx < mvFlux.length) ? activeMvIdx : 0;
}
function conteneurQuiDefile(el) {
    for (var n = el; n && n !== document.body && n.nodeType === 1; n = n.parentElement) {
        var oy = getComputedStyle(n).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) return n;
    }
    var epg = document.getElementById('epg');
    if (epg && epg.offsetParent && epg.scrollHeight > epg.clientHeight) return epg;
    return document.scrollingElement || document.documentElement;
}
export function brancherManetteApplication() {
    if (manetteBranchee || typeof window === 'undefined' || !window.navigator || typeof window.navigator.getGamepads !== 'function') return manetteBranchee;
    var lecteurVisible = function() { return document.body.getAttribute('data-view') === 'player'; };
    /* Les commandes du lecteur étaient-elles effacées avant ce bouton ? Alors A et les
       flèches ne font que les montrer, comme la première touche du clavier. */
    var commandesEtaientCachees = false;
    manetteBranchee = brancherManette({
        win: window,
        /* Une horloge monotone : une heure système qui saute (ou figée par un test) ne doit
           ni répéter une flèche ni confondre deux appuis éloignés. */
        maintenant: function() { return performance.now(); },
        contexte: function() { return { lecteur: lecteurVisible(), modeCable: modeCable }; },
        aide: function(texte) { showToast(texte); },
        actions: {
            eveil: function() {
                if (typeof window.activerNavigationManette === 'function') window.activerNavigationManette();
                commandesEtaientCachees = lecteurVisible() && commandesCachees();
                if (lecteurVisible() && typeof window.resetMvIdleTimer === 'function') window.resetMvIdleTimer();
            },
            fleche: function(direction) {
                if (commandesEtaientCachees && !modeCable) { focaliserCommandes(); return; }
                var cle = { haut: 'ArrowUp', bas: 'ArrowDown', gauche: 'ArrowLeft', droite: 'ArrowRight' }[direction];
                var cible = document.activeElement || document.body;
                cible.dispatchEvent(new KeyboardEvent('keydown', { key: cle, code: cle, bubbles: true, cancelable: true }));
            },
            /* Un élément devenu invisible (un bouton du lecteur, une fois le lecteur
               quitté) ne se clique pas : la flèche ramène le focus sur la page. */
            ok: function() {
                if (commandesEtaientCachees) { focaliserCommandes(); return; }
                var el = document.activeElement;
                var visible = el && el !== document.body && el.getClientRects().length > 0;
                if (!visible) { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true, cancelable: true })); return; }
                if (el.tagName === 'SELECT') { try { el.showPicker(); } catch (e) {} return; }
                if (typeof el.click === 'function') el.click();
            },
            retour: function() { if (typeof window.retourTele === 'function') window.retourTele(); },
            lecteur: function() { if (typeof window.openMultiviewTab === 'function') window.openMultiviewTab(); },
            live: function() { applyFilter('live'); },
            menu: function() { if (typeof window.toggleMenu === 'function') window.toggleMenu(); },
            /* Live ← Guide → Lecteur, sans boucler ; le bouton de la vue prend le focus. */
            vue: function(sens) {
                var ordre = ['live', 'all', 'player'];
                var i = ordre.indexOf(document.body.getAttribute('data-view'));
                var suivante = ordre[Math.min(Math.max((i < 0 ? 0 : i) + sens, 0), ordre.length - 1)];
                if (suivante === 'player') { if (typeof window.openMultiviewTab === 'function') window.openMultiviewTab(); }
                else applyFilter(suivante);
                var bouton = document.getElementById(suivante === 'player' ? 'mv-toggle-btn' : 'filter-' + suivante);
                if (bouton && bouton.getClientRects().length) bouton.focus();
            },
            tuile: function(sens) { if (mvFlux.length) focusStream(tuileVoisine(activeMvIdx, mvFlux.length, sens)); },
            chaine: function(sens) {
                var i = tuileActive();
                if (mvFlux[i] && !mvFlux[i]._gestesSuspendus) zapperChaine(i, sens);
            },
            source: function(sens) { if (mvFlux.length) changerSourceTuile(tuileActive(), sens); },
            /* Un bouton de manette ne compte pas toujours comme un geste, et le navigateur
               refuse alors le plein écran. Le mode Cinéma (plein cadre dans la page) ne
               demande rien : c'est lui sans activation. */
            pleinEcran: function() {
                var w = document.getElementById('mv-grid-wrapper');
                if (!w) return;
                if (document.fullscreenElement || document.webkitFullscreenElement) { toggleFullscreen(w); return; }
                if (w.classList.contains('mv-theater')) { toggleTheaterMode(w); return; }
                var actif = !!(navigator.userActivation && navigator.userActivation.isActive);
                if (actif) toggleFullscreen(w); else toggleTheaterMode(w);
            },
            modeCable: function() {
                var actif = setModeCable(!modeCable);
                showToast(actif ? '📺 Mode câble : une vidéo, LB/RB change de match' : '▦ Mode câble coupé : toutes les vidéos');
            },
            defiler: function(dy) {
                var c = conteneurQuiDefile(document.activeElement);
                if (c) c.scrollBy(0, Math.round(dy * 22));
            }
        }
    });
    return manetteBranchee;
}

/* Le bouton du panneau Chrome du guide (index.html). */
export function telechargerExtensionGuide() {
    return telechargerExtension().then(function(nom) {
        showToast('⬇ ' + nom + ' : décompresser, puis « Charger l\'extension non empaquetée »');
        return nom;
    }, function(e) {
        showToast('Téléchargement de l\'extension impossible : ' + (e && e.message ? e.message : e));
        return null;
    });
}






/* ══ SCRAPER INVESTIGATOR ══════════════ */
export var investigatorSequence = [];
export var investigatorCurrentUrl = '';

export function openInvestigatorModal() {
    var modal = document.getElementById('investigator-modal');
    if (modal) {
        modal.style.display = 'flex';
        investigatorClearSequence();
    }
}

export function investigatorClearSequence() {
    investigatorSequence = [];
    investigatorCurrentUrl = '';
    document.getElementById('investigator-url').value = '';
    document.getElementById('investigator-content').innerHTML = '<div style="color: rgba(255,255,255,0.5); text-align: center; margin-top: 40px;">Entrez une URL pour commencer l\'investigation du DOM.</div>';
    renderInvestigatorSequence();
}

function renderInvestigatorSequence() {
    var seqContainer = document.getElementById('investigator-sequence');
    if (!seqContainer) return;

    if (investigatorSequence.length === 0) {
        seqContainer.innerHTML = '<div style="color: rgba(255,255,255,0.5);">Aucune action (Démarrez l\'analyse)</div>';
        return;
    }

    var html = '';
    investigatorSequence.forEach(function(step, idx) {
        var actionText = step.type === 'click_link' ? '🔗 Clic lien: ' + esc(step.textMatch || step.href) : '📺 Sélection iframe (Index ' + step.iframeIndex + ')';
        html += '<div style="background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 4px; border-left: 2px solid #ffcc00; font-size: 11px;">' +
                   '<span style="opacity: 0.6; margin-right: 8px;">Étape ' + (idx+1) + '</span>' + actionText +
                '</div>';
    });
    seqContainer.innerHTML = html;
}

export function investigateUrl(url) {
    if (!url || !url.startsWith('http')) {
        showToast('URL invalide (doit commencer par http)');
        return;
    }

    investigatorCurrentUrl = url;
    document.getElementById('investigator-url').value = url;
    document.getElementById('investigator-content').innerHTML = '<div style="color: var(--muted); text-align: center;">Chargement de ' + esc(url) + '...</div>';

    fetchPage(url).then(function(html) {
        renderInvestigatorDom(html, url);
    }).catch(function(e) {
        document.getElementById('investigator-content').innerHTML = '<div style="color: var(--red); text-align: center;">Erreur de chargement: ' + esc(e.message) + '</div>';
    });
}

export function renderInvestigatorDom(html, baseUrl) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var container = document.getElementById('investigator-content');

    var outHtml = '<div style="margin-bottom: 12px; font-size: 14px; font-weight: bold;">Éléments interactifs trouvés sur la page :</div>';

    // Find all links that look like stream links or overlays
    var links = doc.querySelectorAll('a[href]');
    var validLinks = [];
    for (var i=0; i<links.length; i++) {
        var h = links[i].getAttribute('href');
        if (!h || h.startsWith('javascript') || h === '#') continue;
        validLinks.push(links[i]);
    }

    if (validLinks.length > 0) {
        outHtml += '<div style="margin-bottom: 8px; color: #a1a1aa; font-weight: bold;">Liens (<a>)</div>';
        outHtml += '<div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 16px;">';
        validLinks.forEach(function(link) {
            var href = link.getAttribute('href');
            var text = link.textContent.replace(/\s+/g, ' ').trim() || '(Lien sans texte)';
            outHtml += '<div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 4px; border-left: 2px solid #0a84ff;">' +
                          '<div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%;">' +
                              '<div style="font-weight: bold; color: #fff;">' + esc(text) + '</div>' +
                              '<div style="font-size: 10px; color: #a1a1aa;">' + esc(href) + '</div>' +
                          '</div>' +
                          '<button class="btn o" style="font-size: 11px; padding: 4px 8px;" onclick="window.investigatorClickLink(\'' + escJs(href) + '\', \'' + escJs(text) + '\')">Simuler Clic</button>' +
                       '</div>';
        });
        outHtml += '</div>';
    }

    // Find iframes (the ultimate goal usually)
    var iframes = doc.querySelectorAll('iframe');
    if (iframes.length > 0) {
        outHtml += '<div style="margin-bottom: 8px; color: #ffcc00; font-weight: bold;">Lecteurs Vidéo (<iframe>)</div>';
        outHtml += '<div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 16px;">';
        [].forEach.call(iframes, function(ifr, idx) {
            var src = ifr.getAttribute('src') || '(Pas de src)';
            outHtml += '<div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,165,0,0.1); padding: 8px; border-radius: 4px; border-left: 2px solid #ffcc00;">' +
                          '<div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%;">' +
                              '<div style="font-weight: bold; color: #ffcc00;">Iframe #' + idx + '</div>' +
                              '<div style="font-size: 10px; color: #a1a1aa;">' + esc(src) + '</div>' +
                          '</div>' +
                          '<button class="btn g" style="font-size: 11px; padding: 4px 8px;" onclick="window.investigatorSelectIframe(' + idx + ')">Sélectionner Lecteur</button>' +
                       '</div>';
        });
        outHtml += '</div>';
    }

    if (validLinks.length === 0 && iframes.length === 0) {
        outHtml += '<div style="color: var(--muted); text-align: center; padding: 20px;">Aucun lien ni iframe pertinent trouvé.</div>';
    }

    container.innerHTML = outHtml;
}

export function investigatorClickLink(href, textMatch) {
    investigatorSequence.push({
        type: 'click_link',
        href: href,
        textMatch: textMatch
    });
    renderInvestigatorSequence();

    // Navigate to next page
    var fullUrl = typeof resolveUrl === 'function' ? resolveUrl(href, investigatorCurrentUrl) : (href.startsWith('http') ? href : new URL(href, investigatorCurrentUrl).href);
    investigateUrl(fullUrl);
}

export function investigatorSelectIframe(iframeIndex) {
    investigatorSequence.push({
        type: 'iframe_select',
        iframeIndex: iframeIndex
    });
    renderInvestigatorSequence();
    showToast('Iframe sélectionnée. N\'oubliez pas de sauvegarder.');
}

export function investigatorSaveRules() {
    if (investigatorSequence.length === 0) {
        showToast('La séquence est vide.');
        return;
    }

    var domain = getDomain(investigatorCurrentUrl);
    if (!domain) {
        showToast('Impossible de déterminer le domaine.');
        return;
    }

    var customRules = safeStorageGetJSON('custom_scraper_rules', {});
    customRules[domain] = {
        updatedAt: Date.now(),
        steps: investigatorSequence
    };
    safeStorageSetJSON('custom_scraper_rules', customRules);

    showToast('Règles sauvegardées pour ' + domain);
    document.getElementById('investigator-modal').style.display = 'none';
}

// Global bindings for HTML compatibility

window.openInvestigatorModal = openInvestigatorModal;
window.investigatorClearSequence = investigatorClearSequence;
window.investigateUrl = investigateUrl;
window.investigatorClickLink = investigatorClickLink;
window.investigatorSelectIframe = investigatorSelectIframe;
window.investigatorSaveRules = investigatorSaveRules;

window.mvGameModeActive = mvGameModeActive;
window.mvGameModeInterval = mvGameModeInterval;
window.gmCurrentTab = gmCurrentTab;
window.gmPinnedMatches = gmPinnedMatches;
window.globalStatsInterval = globalStatsInterval;
window.activeMvStatsCards = activeMvStatsCards;
window.toggleMvGameMode = toggleMvGameMode;
window.switchGmTab = switchGmTab;
window.toggleGmPinMatch = toggleGmPinMatch;
window.updateGmScoresTab = updateGmScoresTab;
window.updateGmCurrentTab = updateGmCurrentTab;
window.closePinnedStats = closePinnedStats;
window.openPinnedStats = openPinnedStats;
window.updateMvGameModeStats = updateMvGameModeStats;
window.mvFlux = mvFlux;
window.showFluxSelector = showFluxSelector;
window.showMatchSelector = showMatchSelector;
window.toggleMultiviewPip = toggleMultiviewPip;
window.setupMultivisionUI = setupMultivisionUI;
window.moveMultiviewStream = moveMultiviewStream;
window.saveMultivisionState = saveMultivisionState;
window.restoreMultivisionState = restoreMultivisionState;
window.mvLayout = mvLayout;
window.setMvLayout = setMvLayout;
window.activeMvIdx = activeMvIdx;
window.focusStream = focusStream;
window.applyMvFocusStyling = applyMvFocusStyling;
window.applyMvAudioState = applyMvAudioState;
window.updateMultivisionLayout = updateMultivisionLayout;
window.addToMultivision = addToMultivision;
window.lienDuMatchPourFlux = lienDuMatchPourFlux;
window.nextFluxForTile = nextFluxForTile;
window.toggleModeCable = toggleModeCable;
window.toggleSonAuto = toggleSonAuto;
window.toggleGardeSortie = toggleGardeSortie;
window.gardeSortieArmee = gardeSortieArmee;
window.autoriserSortie = autoriserSortie;
window.basculerGestesTuile = basculerGestesTuile;
window.zapperChaine = zapperChaine;
window.changerSourceTuile = changerSourceTuile;
window.positionDuFlux = positionDuFlux;
window.removeFromMultivision = removeFromMultivision;
window.ouvrirMenuTuile = ouvrirMenuTuile;
window.ouvrirMenuDisposition = ouvrirMenuDisposition;
window.ouvrirMenuBarre = ouvrirMenuBarre;
window.chargerQuandMeme = chargerQuandMeme;
window.diagnosticAppareilHtml = diagnosticAppareilHtml;
window.mettreAJourApplication = mettreAJourApplication;
window.viderCachesApplication = viderCachesApplication;
window.rechargerTuile = rechargerTuile;
window.fermerToutesLesVideos = fermerToutesLesVideos;
window.toggleMultiview = toggleMultiview;
window.toggleDocumentPiP = toggleDocumentPiP;
window.toggleDeuxEcrans = toggleDeuxEcrans;
window.toggleEcransEtire = toggleEcransEtire;
window.mettreSurEcranPrincipal = mettreSurEcranPrincipal;
window.toggleTheaterMode = toggleTheaterMode;
window.quitterModeCinema = quitterModeCinema;
window.quitterPleinEcranLecteur = quitterPleinEcranLecteur;
window.toggleFullscreen = toggleFullscreen;
window.openFlux = openFlux;
window.toggleDirectMode = toggleDirectMode;
/* Appelée par la couche native Android (BloqueurWebViewClient.java) quand elle voit
   passer un manifeste. C'est le seul chemin possible là-bas : aucun script ne peut
   tourner dans l'iframe du lecteur. */
window.mediaVuParAndroid = mediaVuParAndroid;
window.applyBgStyle = applyBgStyle;
window.initPrefs = initPrefs;
window.applyUserPrefs = applyUserPrefs;
window.markCustomTheme = markCustomTheme;
window.applyUserBgStyleOnly = applyUserBgStyleOnly;
window.PALETTES = PALETTES;
window.buildSwatches = buildSwatches;
window.renderSourcesStatus = renderSourcesStatus;
window.initProxySettings = initProxySettings;
window.renderProxyStatus = renderProxyStatus;
window.openStreamsWorkflow = openStreamsWorkflow;
window.reloadPrefetchedStreams = reloadPrefetchedStreams;
window.saveProxySettings = saveProxySettings;
window.renderScrapeLogs = renderScrapeLogs;
window.exportDebugLogs = exportDebugLogs;
window.openOptionsPage = openOptionsPage;
window.openLogsPage = openLogsPage;
window.openScriptPage = openScriptPage;
window.installTampermonkey = installTampermonkey;
window.installerScriptUtilisateur = installerScriptUtilisateur;
window.telechargerExtension = telechargerExtensionGuide;
window.changerSourceActive = changerSourceActive;
window.choisirVideo = choisirVideo;
window.ouvrirMenuVideoActive = ouvrirMenuVideoActive;
window.basculerDirectActif = basculerDirectActif;

export function exportSettings() {
    var settings = {
        user_prefs: userPrefs,
        fav_teams: favTeams,
        custom_lg_order: customLgOrder
    };
    var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(settings, null, 2));
    var downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "multivision_settings.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    showToast("Paramètres exportés !");
}

export function importSettings(event) {
    var file = event.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(e) {
        try {
            var imported = JSON.parse(e.target.result);

            if (imported.user_prefs) {
                Object.assign(userPrefs, imported.user_prefs);
                safeStorageSetJSON('user_prefs', userPrefs);
            }
            if (imported.fav_teams) {
                // Clear existing properties and assign new ones
                for (var key in favTeams) {
                  if (favTeams.hasOwnProperty(key)) {
                      delete favTeams[key];
                  }
                }
                Object.assign(favTeams, imported.fav_teams);
                safeStorageSetJSON('fav_teams', favTeams);
            }
            if (imported.custom_lg_order) {
                setCustomLgOrder(imported.custom_lg_order);
            }

            initPrefs();
            setTimeout(function() { buildEPG(S.matches); }, 0);
            showToast("Paramètres importés avec succès !");

            // Re-apply visual preferences if needed
            if (imported.user_prefs) {
                applyUserPrefs();
            }

        } catch (err) {
            console.error("Erreur d'importation", err);
            showToast("Erreur: fichier invalide");
        }
        event.target.value = ''; // Reset input
    };
    reader.readAsText(file);
}

window.exportSettings = exportSettings;
window.importSettings = importSettings;

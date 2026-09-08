import { fetchPage } from './utils.js';
import { DEFAULT_LEAGUES, OTHER_LEAGUES, teamColorPair } from './db.js';
import { PROXIES } from './config.js';
import { S, favTeams, sourcesStatus, scrapeLogs, manualStreamLogs, customLgOrder, setCustomLgOrder } from './state.js';
import { esc, showToast, escJs, applyFilter, resolveStreamUrl, safeStorageGetJSON, safeStorageSetJSON, showPage, syncNavState, tailleStockageKo } from './utils.js';
import { fetchGameStats, renderScorersHtml, formatStatLabel } from './api.js';
import { getOriginalMatchId, QI, QC, userPrefs, closeMod, buildEPG } from './ui.js';
import { sortFluxLinks, getDomain, openGlobalStatsFromMatch, domainPrefs, toggleDomainPref, notePlayability, playLedger } from './config.js';
import { nextLinkAfter, hostOfUrl, tileTarget, patienceMs } from './playability.js';
import { estManifeste, retenirMediaDirect, mediaDirectPour, noterEchecDirect, aProposer } from './directmedia.js';
import { noterMesure, mesurePour, formaterMesure } from './debit.js';
import { scrapeMatchFlux, compterFluxUtiles, doitRafraichirTuile, INTERVALLE_TUILE_MS } from './scrapers.js';
import { loadAll, loadPrefetchedStreams } from './main.js';
import { initEmbedBridge, getBridgeStatus } from './embed-bridge.js';
import { ouvrirMenu, fermerMenus } from './mv-menu.js';

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
        try { if (iframe.contentWindow) iframe.contentWindow.postMessage('mv_clean', '*'); } catch (e) {}
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
var CHARGEMENT_HLS = null;
export function estMediaDirecte(url) {
    return /\.(m3u8|mp4|webm|mov|m4v)(\?|#|$)/i.test(String(url || ''));
}
function chargerHlsJs() {
    if (window.Hls) return Promise.resolve(window.Hls);
    if (CHARGEMENT_HLS) return CHARGEMENT_HLS;
    CHARGEMENT_HLS = new Promise(function(resolve, reject) {
        var s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.17/hls.min.js';
        s.onload = function() { resolve(window.Hls); };
        s.onerror = function() { reject(new Error('hls.js indisponible')); };
        document.head.appendChild(s);
    });
    return CHARGEMENT_HLS;
}
/* Rend un `<video>` prêt à jouer `url`, avec les mêmes classe et style que
   l'iframe qu'il remplace — la mise en page (taille, recadrage, glisser-déposer)
   ne fait ainsi aucune différence entre les deux. */
function creerLecteurVideo(url, surEchec) {
    var video = document.createElement('video');
    var echec = function(raison) { if (typeof surEchec === 'function') surEchec(raison); };
    video.addEventListener('error', function() {
        var code = video.error && video.error.code;
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

    var estM3u8 = /\.m3u8(\?|#|$)/i.test(url);
    if (estM3u8 && !video.canPlayType('application/vnd.apple.mpegurl')) {
        chargerHlsJs().then(function(Hls) {
            if (Hls && Hls.isSupported()) {
                var hls = new Hls();
                /* Une erreur FATALE (manifeste refusé : CORS, 403, adresse expirée ; ou
                   média illisible) est remontée à l'appelant, qui décide (le mode direct
                   revient à la page). Les erreurs non fatales, hls.js les rattrape seul. */
                hls.on(Hls.Events.ERROR, function(ev, d) {
                    if (!d || !d.fatal) return;
                    var code = d.response && d.response.code;
                    echec(String(d.details || d.type || 'hls') + (code ? ' HTTP ' + code : ''));
                });
                hls.loadSource(url);
                hls.attachMedia(video);
                video._hls = hls; // pour destruction propre (voir plus bas)
            } else {
                video.src = url; // dernier recours : certains navigateurs y arrivent quand même
            }
        }).catch(function() { video.src = url; });
    } else {
        video.src = url; // HLS nativement supporté (Safari/iOS), ou format progressif (mp4, webm…)
    }
    return video;
}
/* ─── Mode direct : la deuxième façon d'utiliser un lien (voir js/directmedia.js) ───
   La tuile joue dans son propre <video> le manifeste que le script utilisateur a vu
   passer pendant que la page jouait, sans la page. Si rien ne joue dans les 25 s, ou si
   hls.js rapporte une erreur fatale (CORS, 403, adresse expirée), la tuile revient
   d'elle-même au mode page, retient l'échec, et le dit. */
var DELAI_DIRECT_MS = 25000;
function registreDirect() { return safeStorageGetJSON('direct_media', {}) || {}; }
function poserDirect(media, url, container, cell, s) {
    container.innerHTML = '';
    s._currentUrl = url;
    s._playing = false;
    var idx = parseInt(cell.dataset.index, 10);
    var fini = false;
    var revenir = function(raison) {
        if (fini) return;
        fini = true;
        if (s._currentUrl !== url || s.mode !== 'direct') return;
        safeStorageSetJSON('direct_media', noterEchecDirect(registreDirect(), url));
        s.mode = 'page';
        s._currentUrl = null;
        s._playing = false;
        showToast('Direct refusé (' + raison + ') : retour à la page');
        saveMultivisionState();
        updateMultivisionLayout();
    };
    var video = creerLecteurVideo(media.url, revenir);
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
    var video = creerLecteurVideo(url);
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
export var currentGlobalStatsMatchId = null;
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
    window.addEventListener('pagehide', function() {
        var urls = suspectsDeSortie(mvFlux, Date.now());
        if (urls.length) safeStorageSetJSON(CLE_SORTIE, { urls: urls, at: Date.now() });
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
    container.innerHTML = '';
    var box = document.createElement('div');
    box.className = 'mv-sortie-forcee';
    box.innerHTML = '<div class="mv-sortie-titre">Ce site a fait sortir la page du lecteur</div>'
        + '<div class="mv-sortie-texte">' + esc(getDomain(s.url)) + ' a redirigé toute la fenêtre vers lui la dernière fois. La tuile n\'a pas été rechargée pour éviter la boucle.</div>'
        + '<div class="mv-sortie-actions">'
        + '<button type="button" class="btn o" onclick="ouvrirPageOriginale(' + idx + '); event.stopPropagation();">↗ Ouvrir sur le site</button>'
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

            var btn = document.createElement('div');
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
                                '<button title="Prioriser ce domaine" aria-label="Prioriser ce domaine" onclick="' + favEv + '" style="width:28px; height:28px; border-radius:8px; background:' + (pref === 1 ? 'var(--accent)' : 'rgba(255,255,255,0.05)') + '; border:none; color:' + (pref === 1 ? '#fff' : 'var(--muted)') + '; cursor:pointer; font-size:12px; transition:all 0.15s; display:flex; align-items:center; justify-content:center;">⭐</button>' +
                                '<button title="Déprioriser ce domaine" aria-label="Déprioriser ce domaine" onclick="' + depEv + '" style="width:28px; height:28px; border-radius:8px; background:' + (pref === -1 ? 'var(--red)' : 'rgba(255,255,255,0.05)') + '; border:none; color:' + (pref === -1 ? '#fff' : 'var(--muted)') + '; cursor:pointer; font-size:12px; transition:all 0.15s; display:flex; align-items:center; justify-content:center;">👎</button>' +
                            '</div>';

            streamsContainer.appendChild(btn);
        });
        selector.appendChild(streamsContainer);
    }

    // Section 2: Other Live Matches
    var titleMatches = document.createElement('div');
    titleMatches.style.cssText = 'font-size:11px;font-weight:bold;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;margin-top:8px;';
    titleMatches.textContent = 'Remplacer par un autre match';
    selector.appendChild(titleMatches);

    var matchesContainer = document.createElement('div');
    matchesContainer.style.cssText = 'display:flex;flex-direction:column;gap:6px;';


    var availableMatches = S.matches.filter(function(x) {
        return x.streamsLoaded && compterFluxUtiles(x) > 0 && String(x.id) !== String(mid);
    });

    availableMatches.sort(function(a, b) {
        var f1 = (favTeams[a.homeTeam] || favTeams[a.awayTeam]) ? -1 : 0;
        var f2 = (favTeams[b.homeTeam] || favTeams[b.awayTeam]) ? -1 : 0;
        if (f1 !== f2) return f1 - f2;

        if (a.status === 'live' && b.status !== 'live') return -1;
        if (a.status !== 'live' && b.status === 'live') return 1;
        return a.startTime.localeCompare(b.startTime);
    });


    if (availableMatches.length === 0) {
        var empty = document.createElement('div');
        empty.style.cssText = 'padding:10px;text-align:center;color:var(--muted);font-size:12px;background:rgba(255,255,255,0.02);border-radius:8px;';
        empty.innerHTML = 'Aucun autre match avec flux disponible.';
        matchesContainer.appendChild(empty);
    } else {
        availableMatches.forEach(function(sm) {
            // Already in multiview?
            var alreadyIn = mvFlux.some(function(ms) { return String(ms.mid) === String(sm.id); });

            var btn = document.createElement('div');
            btn.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px;min-height:44px;border-radius:8px;cursor:pointer;transition:all 0.15s;background:rgba(255,255,255,0.05);' + (alreadyIn ? 'opacity:0.5;pointer-events:none;' : '');

            btn.onmouseenter = function() { if(!alreadyIn) this.style.background = 'rgba(255,255,255,0.1)'; };
            btn.onmouseleave = function() { if(!alreadyIn) this.style.background = 'rgba(255,255,255,0.05)'; };

            var thumb = '<div style="width:36px; height:36px; border-radius:4px; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; font-size:16px;">' + (sm.flag || '⚽') + '</div>';
            if(sm.homeLogo) {
                thumb = '<div style="width:36px; height:36px; border-radius:4px; background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; overflow:hidden; padding:2px;flex-shrink:0;">'
                  +'<img src="'+esc(sm.homeLogo)+'" style="max-width:100%; max-height:100%; object-fit:contain;" onerror="this.style.display=\\\'none\\\'">'
                +'</div>';
            }

            var score = sm.score ? '<div style="font-size:13px; font-weight:bold; color:var(--accent); display:flex; flex-direction:column; align-items:center; justify-content:center; background:rgba(0,0,0,0.3); padding:4px 8px; border-radius:4px;flex-shrink:0;"><span>'+esc(sm.score[0])+'</span><span>'+esc(sm.score[1])+'</span></div>' : '';

            btn.innerHTML = thumb +
                '<div style="flex:1; overflow:hidden;">' +
                    '<div style="font-size:10px; color:var(--red); font-weight:bold; margin-bottom:2px;">🔴 '+(sm.minute?esc(sm.minute)+"'":'EN DIRECT')+' <span style="color:var(--muted); font-weight:normal; margin-left:4px;">'+esc(sm.flag)+' '+esc(sm.league)+'</span></div>' +
                    '<div style="font-size:12px; font-weight:bold; color:#fff; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">'+esc(sm.homeTeam)+'</div>' +
                    '<div style="font-size:12px; font-weight:bold; color:#fff; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">'+esc(sm.awayTeam)+'</div>' +
                '</div>' + score + (alreadyIn ? '<div style="font-size:10px;background:rgba(255,255,255,0.2);color:#fff;padding:2px 4px;border-radius:4px;margin-left:4px;">AJOUTÉ</div>' : '');

            btn.onclick = function(e) {
                e.stopPropagation();
                if(sm.streamsLoaded && compterFluxUtiles(sm) > 0) {
                    var sortedSmLinks = sortFluxLinks(sm.streamLinks);
                    mvFlux[idx].url = sortedSmLinks[0].url;
                    mvFlux[idx].name = sm.homeTeam + ' vs ' + sm.awayTeam;
                    mvFlux[idx].mid = sm.id;
                    saveMultivisionState(); updateMultivisionLayout();
                    selector.remove();
                } else {
                    // Si pas chargé
                    showToast('Chargement des streams...');
                    scrapeMatchFlux(sm).then(function() {
                        sm.streamsLoaded = true;
                        if(sm.streamLinks && sm.streamLinks.length > 0) {
                            var sortedSmLinks = sortFluxLinks(sm.streamLinks);
                            mvFlux[idx].url = sortedSmLinks[0].url;
                            mvFlux[idx].name = sm.homeTeam + ' vs ' + sm.awayTeam;
                            mvFlux[idx].mid = sm.id;
                            saveMultivisionState(); updateMultivisionLayout();
                        } else {
                            showToast('Aucun flux trouvé pour ce match.');
                        }
                        selector.remove();
                    }).catch(function() {
                        showToast('Erreur lors du chargement des streams.');
                        selector.remove();
                    });
                }
            };

            matchesContainer.appendChild(btn);
        });
    }
    selector.appendChild(matchesContainer);

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
    } else {
        // Switch to PIP mode
        fermerMenus();
        mvc.classList.add('mv-pip');
        epg.style.display = 'flex';
        syncNavState(S.filter || 'live');

        var mode = localStorage.getItem('multiviewPipMode') || 'sidebar';
        applyPipModeStyles(mode);
    }
}

// Ensure resize events also apply the correct PIP mode styling if resizing while in PIP
window.addEventListener('resize', function() {
    var mvc = document.getElementById('mv-container');
    var epg = document.getElementById('epg');
    if(mvc && mvc.classList.contains('mv-pip')) {
        if(window.innerWidth <= 768) {
            mvc.style.display = 'none';
            if(epg) epg.style.paddingRight = '0';
        } else {
            mvc.style.display = 'flex';
            if(epg) epg.style.paddingRight = mvc.offsetWidth + 'px';
        }
    }

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

export function setupMultivisionUI() {
    if(document.getElementById('mv-container')) return;

    // Create Multivision Container

    var pipStyles = document.createElement('style');
    pipStyles.textContent = `
      #mv-container:not(.mv-pip) .only-pip { display: none !important; }
      #mv-container.mv-pip .hide-pip { display: none !important; }
      #mv-container.mv-pip #mv-toolbar { cursor: move; }
      #mv-container.mv-pip #mv-drag-handle { cursor: move; }
    `;
    document.head.appendChild(pipStyles);

    var mvContainer = document.createElement('div');

    mvContainer.id = 'mv-container';
    poserPleinCadre(mvContainer);
    mvContainer.style.display = 'none';

    var mvToolbar = document.createElement('div');
    mvToolbar.id = 'mv-toolbar';

  window.applyPipModeStyles = function(mode) {
      var mvc = document.getElementById('mv-container');
      var epg = document.getElementById('epg');
      var btnMin = document.getElementById('mv-minimize-btn');
      if(!mvc || !epg) return;

      var isMobile = window.innerWidth <= 768;
      mvc.classList.remove('mv-full');
      fermerMenus();

      // Reset common styles first
      mvc.style.resize = 'none';
      mvc.style.boxShadow = 'none';
      mvc.style.borderRadius = '0';
      mvc.style.direction = 'ltr';
      mvc.style.minHeight = '0';
      mvc.style.minWidth = '0';

      if(btnMin) btnMin.innerHTML = '➖';

      if (mode === 'sidebar') {
          if(isMobile) {
              mvc.style.cssText = 'display:none;';
              epg.style.paddingRight = '0';
          } else {
              mvc.style.cssText = 'position:fixed;right:0;top:var(--hdr-height, 70px);bottom:0;width:350px;background:var(--bg, rgba(10,10,12,0.95));backdrop-filter:blur(10px);z-index:999;display:flex;flex-direction:column;border-left:1px solid rgba(255,255,255,0.1);box-shadow:-5px 0 30px rgba(0,0,0,0.5);overflow:hidden;resize:horizontal;direction:rtl;min-width:250px;max-width:60vw;';
              // epg padding is handled by resize observer, but we set it here as fallback
              epg.style.paddingRight = mvc.offsetWidth + 'px';
          }
      } else if (mode === 'floating') {
          var rectStr = localStorage.getItem('multiviewFloatingRect');
          var rect = rectStr ? JSON.parse(rectStr) : {width: 400, height: 300, right: 20, bottom: 20};

          mvc.style.cssText = 'position:fixed;background:var(--bg, rgba(10,10,12,0.95));backdrop-filter:blur(10px);z-index:9999;display:flex;flex-direction:column;border:1px solid rgba(255,255,255,0.1);box-shadow:0 10px 30px rgba(0,0,0,0.5);overflow:hidden;resize:both;direction:ltr;border-radius:8px;min-width:250px;min-height:150px;';

          if(rect.top !== undefined && rect.left !== undefined) {
              mvc.style.top = rect.top + 'px';
              mvc.style.left = rect.left + 'px';
              mvc.style.right = 'auto';
              mvc.style.bottom = 'auto';
          } else {
              mvc.style.right = (rect.right || 20) + 'px';
              mvc.style.bottom = (rect.bottom || 20) + 'px';
              mvc.style.top = 'auto';
              mvc.style.left = 'auto';
          }

          mvc.style.width = (rect.width || 400) + 'px';
          mvc.style.height = (rect.height || 300) + 'px';

          epg.style.paddingRight = '0';
      } else if (mode === 'minimized') {
          var rectStr = localStorage.getItem('multiviewMinimizedRect');
          var rect = rectStr ? JSON.parse(rectStr) : {width: 300, right: 20, bottom: 20};

          mvc.style.cssText = 'position:fixed;background:var(--bg2, rgba(20,20,24,0.95));backdrop-filter:blur(10px);z-index:9999;display:flex;flex-direction:column;border:1px solid rgba(255,255,255,0.2);box-shadow:0 4px 12px rgba(0,0,0,0.5);overflow:hidden;resize:none;direction:ltr;border-radius:8px;';

          if(rect.top !== undefined && rect.left !== undefined) {
              mvc.style.top = rect.top + 'px';
              mvc.style.left = rect.left + 'px';
              mvc.style.right = 'auto';
              mvc.style.bottom = 'auto';
          } else {
              mvc.style.right = (rect.right || 20) + 'px';
              mvc.style.bottom = (rect.bottom || 20) + 'px';
              mvc.style.top = 'auto';
              mvc.style.left = 'auto';
          }

          mvc.style.width = (rect.width || 300) + 'px';
          mvc.style.height = '44px'; // Height of toolbar

          epg.style.paddingRight = '0';
          if(btnMin) btnMin.innerHTML = '🗖';
      }

      updateMultivisionLayout();
  };

  window.setMvPipMode = function(mode) {
      if (!document.getElementById('mv-container').classList.contains('mv-pip')) {
          toggleMultiviewPip();
      }
      localStorage.setItem('multiviewPipMode', mode);
      applyPipModeStyles(mode);
  };

  window.toggleMinimizePip = function(e) {
      if(e) { e.stopPropagation(); e.preventDefault(); }
      var currentMode = localStorage.getItem('multiviewPipMode') || 'sidebar';
      if(currentMode === 'minimized') {
          // Restore to previous non-minimized mode
          var prevMode = localStorage.getItem('multiviewPipPrevMode') || 'sidebar';
          setMvPipMode(prevMode);
      } else {
          localStorage.setItem('multiviewPipPrevMode', currentMode);
          setMvPipMode('minimized');
      }
  };

  /* Barre du lecteur : quatre gestes, nommés en clair, et tout le reste sous « Plus ».
     Les anciens menus déroulants posés dans la barre (disposition, modes PiP) passaient
     sous les tuiles ; ils s'ouvrent désormais par-dessus tout (js/mv-menu.js). */
  var mvToolbarHtml = '<span class="mv-title" id="mv-drag-handle">Lecteur</span>'
      + '<div class="sp"></div>'
      + '<div id="mv-actions-menu" class="mv-actions">'
      + '<button type="button" class="mv-tb-btn primary" onclick="showMatchSelector(event)" title="Choisir un match à ajouter"><span class="mv-tb-ic" aria-hidden="true">➕</span><span class="mv-tb-lb">Ajouter</span></button>'
      + '<button type="button" class="mv-tb-btn hide-pip" id="mv-layout-toggle-btn" onclick="ouvrirMenuDisposition(this, event)" aria-haspopup="menu" aria-expanded="false" title="Disposition des vidéos"><span class="mv-tb-ic" aria-hidden="true">⊞</span><span class="mv-tb-lb">Disposition</span></button>'
      + '<button type="button" class="mv-tb-btn hide-pip" onclick="toggleFullscreen(document.getElementById(\'mv-grid-wrapper\'))" title="Plein écran"><span class="mv-tb-ic" aria-hidden="true">⛶</span><span class="mv-tb-lb">Plein écran</span></button>'
      + '<button type="button" class="mv-tb-btn only-pip" onclick="toggleMultiviewPip()" title="Agrandir le lecteur"><span class="mv-tb-ic" aria-hidden="true">⤢</span><span class="mv-tb-lb">Agrandir</span></button>'
      + '<button type="button" class="mv-tb-btn" id="mv-more-btn" onclick="ouvrirMenuBarre(this, event)" aria-haspopup="menu" aria-expanded="false" title="Plus d\'options"><span class="mv-tb-ic" aria-hidden="true">⋯</span><span class="mv-tb-lb">Plus</span></button>'
      + '<button type="button" class="mv-tb-btn only-pip" id="mv-minimize-btn" onclick="toggleMinimizePip(event)" aria-label="Réduire" title="Réduire">➖</button>'
      + '</div>';

    mvToolbar.innerHTML = mvToolbarHtml;


    // Make toolbar draggable for floating/minimized modes
    var isDragging = false;
    var dragStartX, dragStartY;
    var initialLeft, initialTop;

    function startDrag(e) {
        if(e.target.closest('button') || e.target.closest('.mv-actions')) return; // Don't drag on buttons

        var mvc = document.getElementById('mv-container');
        if(!mvc || !mvc.classList.contains('mv-pip')) return;

        var currentMode = localStorage.getItem('multiviewPipMode') || 'sidebar';
        if(currentMode === 'sidebar') return; // Cannot drag sidebar

        isDragging = true;

        // Support both mouse and touch events
        var clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        var clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

        dragStartX = clientX;
        dragStartY = clientY;

        var rect = mvc.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        // Convert right/bottom positioning to top/left for smooth dragging
        mvc.style.right = 'auto';
        mvc.style.bottom = 'auto';
        mvc.style.left = initialLeft + 'px';
        mvc.style.top = initialTop + 'px';

        if (e.type.includes('mouse')) {
            e.preventDefault(); // Prevent text selection only for mouse (breaks touch scrolling if not careful, though here we want to drag the whole pip window)
        }
    }

    function doDrag(e) {
        if(!isDragging) return;

        var clientX = e.type.includes('mouse') ? e.clientX : (e.touches ? e.touches[0].clientX : dragStartX);
        var clientY = e.type.includes('mouse') ? e.clientY : (e.touches ? e.touches[0].clientY : dragStartY);

        var mvc = document.getElementById('mv-container');
        var dx = clientX - dragStartX;
        var dy = clientY - dragStartY;

        var newLeft = initialLeft + dx;
        var newTop = initialTop + dy;

        // Keep within window bounds
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - mvc.offsetWidth));
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - mvc.offsetHeight));

        mvc.style.left = newLeft + 'px';
        mvc.style.top = newTop + 'px';

        // Prevent default to avoid scrolling while dragging
        if (e.cancelable) e.preventDefault();
    }

    function endDrag() {
        if(isDragging) {
            isDragging = false;
            var mvc = document.getElementById('mv-container');
            if(!mvc) return;
            var currentMode = localStorage.getItem('multiviewPipMode') || 'sidebar';
            var rect = mvc.getBoundingClientRect();

            var saveObj = {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
            };

            if(currentMode === 'floating') {
                localStorage.setItem('multiviewFloatingRect', JSON.stringify(saveObj));
            } else if(currentMode === 'minimized') {
                localStorage.setItem('multiviewMinimizedRect', JSON.stringify(saveObj));
            }
        }
    }

    mvToolbar.addEventListener('mousedown', startDrag);
    mvToolbar.addEventListener('touchstart', startDrag, { passive: false });

    document.addEventListener('mousemove', doDrag);
    document.addEventListener('touchmove', doDrag, { passive: false });

    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchend', endDrag);

    // Add resize observer for floating mode to save size
    const mvResizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            var mvc = document.getElementById('mv-container');
            if(!mvc || !mvc.classList.contains('mv-pip')) continue;

            var currentMode = localStorage.getItem('multiviewPipMode') || 'sidebar';
            if(currentMode === 'floating') {
                var rect = mvc.getBoundingClientRect();
                var saveObj = {
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height
                };
                localStorage.setItem('multiviewFloatingRect', JSON.stringify(saveObj));
            }
        }
    });

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
            mvFlux.forEach(function(s, idx) {
                var iframe = document.getElementById('mv-iframe-' + idx);
                if (iframe && iframe.contentWindow === e.source) {
                    if (activeMvIdx !== idx) {
                        focusStream(idx);
                    }
                }
            });
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
                if (s._autoTimer) { clearTimeout(s._autoTimer); s._autoTimer = null; }
                if (!s._playNoted) { s._playNoted = true; notePlayability(lienDuMatchPourFlux(s, s.url) || { url: s.url }, 'plays'); }
            } else if (!joue && s._playing) {
                s._playing = false;
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
    mvResizeObserver.observe(mvContainer);

    // Dynamically adjust epg padding when PiP sidebar is resized
    if (window.ResizeObserver) {
        new ResizeObserver(function(entries) {
            var mvc = document.getElementById('mv-container');
            if (mvc && mvc.classList.contains('mv-pip') && mvc.style.display !== 'none' && window.innerWidth > 768) {
                var currentMode = localStorage.getItem('multiviewPipMode') || 'sidebar';
                var epg = document.getElementById('epg');
                if (epg) {
                    if (currentMode === 'sidebar') {
                        epg.style.paddingRight = mvc.offsetWidth + 'px';
                    } else {
                        epg.style.paddingRight = '0px';
                    }
                }
            }
        }).observe(mvContainer);
    }
 restoreMultivisionState();


    if (!window._mvKeydownAttached) {
        window.addEventListener('keydown', function(e) {
            var mvc = document.getElementById('mv-container');
            if (!mvc || mvc.style.display === 'none') return;

            var activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
            if (activeTag === 'input' || activeTag === 'textarea') return;

            var key = e.key;
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
window.resetMvIdleTimer = function() {
        var tb = document.getElementById('mv-toolbar');
        if (tb) { tb.style.opacity = '1'; tb.style.pointerEvents = 'auto'; }
        mvContainer.style.cursor = 'default';

        var hdrs = mvContainer.querySelectorAll('.mv-hdr');
        hdrs.forEach(function(h) { h.style.opacity = '1'; h.style.pointerEvents = 'auto'; });

        var overlays = mvContainer.querySelectorAll('.mv-idle-overlay');
        overlays.forEach(function(o) { o.style.display = 'none'; });

        clearTimeout(window.mvIdleTimer);
        window.mvIdleTimer = setTimeout(function() {
            var mvc = document.getElementById('mv-container');
            if (mvc && !mvc.classList.contains('mv-pip')) {
                var tb = document.getElementById('mv-toolbar');
                if (tb) { tb.style.opacity = '0'; tb.style.pointerEvents = 'none'; }
                mvc.style.cursor = 'none';

                var latestHdrs = mvc.querySelectorAll('.mv-hdr');
                latestHdrs.forEach(function(h) { h.style.opacity = '0'; h.style.pointerEvents = 'none'; });

                var latestOverlays = mvc.querySelectorAll('.mv-idle-overlay');
                latestOverlays.forEach(function(o) { o.style.display = 'block'; o.style.pointerEvents = 'auto'; });
            }
        }, 3000);
    }

    mvContainer.addEventListener('mousemove', window.resetMvIdleTimer);
    mvContainer.addEventListener('click', window.resetMvIdleTimer);
    mvContainer.addEventListener('touchstart', window.resetMvIdleTimer, {passive: true});

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
    safeStorageSetJSON('mv_state', { flux: mvFlux, layout: mvLayout });
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
                setTimeout(function() {
                    updateMultivisionLayout();
                }, 500);
            }
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
    var cells = document.querySelectorAll('.mv-cell');
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
        var iframe = document.getElementById('mv-iframe-' + idx);
        if (iframe && iframe.tagName === 'VIDEO') { iframe.muted = (idx !== targetIdx); return; }
        if (iframe && iframe.contentWindow) {
            if (idx === targetIdx) {
                iframe.contentWindow.postMessage('mv_unmute', '*');
            } else {
                iframe.contentWindow.postMessage('mv_mute', '*');
            }
        }
    });
}


/* Disposition réellement rendue. En portrait (téléphone, tablette debout), deux tuiles
   côte à côte font deux bandes de la largeur d'un pouce : on les empile, quel que soit le
   choix retenu — qui reste intact et reprend en paysage. */
function dispositionEffective(count) {
    if (count >= 2 && window.innerHeight > window.innerWidth) return 'vertical';
    return mvLayout;
}

export function updateMultivisionLayout() {
    var grid = document.getElementById('mv-grid');
    if(!grid) return;

    var count = mvFlux.length;
    var layout = dispositionEffective(count);

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
            var children = Array.from(grid.children);
            children.forEach(function(child) {
                if (child.id !== 'mv-empty-msg') {
                    grid.removeChild(child);
                }
            });
        }
        return;
    } else if (emptyMsg) {
        emptyMsg.remove();
    }

    var mvc = document.getElementById('mv-container');

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
    var existingCells = Array.from(grid.children).filter(function(child) {
        return child.hasAttribute('data-internal-id');
    });

    // Create or update cells
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

            overlay.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                window.resetMvIdleTimer();
            });
            overlay.addEventListener('touchstart', function(e) {
                e.stopPropagation();
                window.resetMvIdleTimer();
            }, {passive: true});

            fallbackToIframe(s.url, videoContainer, cell, s);
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
            container.innerHTML = '';
            s._currentUrl = url;
            if (s._sortieForcee) { poserAvertissementSortie(container, cell, s); return; }
            resolveStreamUrl(url).then(function(finalUrl) {
                if (s._currentUrl !== url) return;
                container.innerHTML = '';

                var iframe = document.createElement('iframe');
                iframe.className = 'mv-media mv-iframe';
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
                iframe.setAttribute('allow', 'fullscreen; autoplay; presentation');
                /* Aucun attribut `sandbox` : retiré le 5 septembre 2026 sur demande répétée de
                   l'utilisateur (« Sandbox detected, please remove sandbox attributes »). Le test
                   « aucune iframe de lecteur ne porte d'attribut sandbox » le verrouille. */
                container.appendChild(iframe);
                demanderNettoyage(iframe);

                s._posedAt = Date.now(); // pour reconnaître une sortie forcée (pagehide juste après)
                if (estMediaDirecte(finalUrl)) {
                    iframe = versVideoSiDirect(iframe, finalUrl, container);
                } else {
                    iframe.src = finalUrl;
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
            document.querySelectorAll('.mv-iframe').forEach(function(iframe) {
                iframe.style.pointerEvents = 'none';
            });
        };
        cell.ondragend = function(e) {
            cell.style.opacity = '1';
            cell.draggable = false;
            window.draggedMvIdx = null;
            document.querySelectorAll('.mv-iframe').forEach(function(iframe) {
                iframe.style.pointerEvents = 'auto';
            });
            saveMultivisionState();
            updateMultivisionLayout();
        };
        cell.ondragenter = function(e) {
            e.preventDefault();
            var fromIdx = window.draggedMvIdx;
            var toIdx = idx;
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
            // Swapping already handled in dragenter
        };

        // Update header HTML
        var hdr = cell.querySelector('.mv-hdr');
        var domain = s.url ? getDomain(s.url) : 'Flux';

        /* « source k/n · ● » et ⏭ : la tuile dit quelle source elle essaie, si une vidéo
           joue (● vert, signalé par le script utilisateur), et passe à la suivante d'un
           clic. C'est ce qui remplace la devinette d'avant : on essaie, on voit, on passe. */
        var pos = positionDuFlux(s);
        var libellePastille = (s._playing ? '● ' : '') + (pos ? 'source ' + pos.k + '/' + pos.n : domain);
        var pastilleSource = '<div class="mv-source-pill' + (s._playing ? ' joue' : '') + '" title="' + (s._playing ? 'Vidéo en lecture' : 'Aucune vidéo confirmée pour l\'instant') + '">' + esc(libellePastille) + '</div>'
            + (pos ? '<button type="button" class="mv-hdr-btn mv-next-source" title="Essayer la source suivante" aria-label="Source suivante" onclick="nextFluxForTile(' + idx + '); event.stopPropagation();">⏭</button>' : '')
            /* « ▶ direct » / « 🖼 page » : la deuxième façon d'utiliser le lien, dès que le
               script a vu passer le manifeste vidéo de la page (rafraichirPastille l'affiche). */
            + '<button type="button" class="mv-hdr-btn mv-direct-btn' + (s.mode === 'direct' ? ' on' : '') + '" title="Basculer entre la page du site et le flux direct" aria-label="Mode direct" style="display:' + ((s._media || mediaDirectPour(registreDirect(), s.url)) ? 'inline-flex' : 'none') + ';" onclick="toggleDirectMode(' + idx + '); event.stopPropagation();">' + (s.mode === 'direct' ? '🖼 page' : '▶ direct') + '</button>';
        var svgDrag = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>';
        var svgMenu = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>';
        var svgClose = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';

        var fitMode = s.fit || 'stretch';
        var fitInfo = MV_FIT_MODES[fitMode] || MV_FIT_MODES.stretch;
        var boutonFit = '<button type="button" class="mv-hdr-btn mv-fit-btn' + (fitMode === 'stretch' ? '' : ' on') + '" title="Ajustement de l\'image : ' + fitInfo.label + ' — cliquer pour changer" aria-label="Ajustement : ' + fitInfo.label + '" onclick="cycleMvFit(' + idx + ');event.stopPropagation();">' + fitInfo.icon + ' <span class="mv-hdr-lb">' + fitInfo.label + '</span></button>';

        var hdrHtml = '<div class="mv-hdr-left">'
            + '<div class="mv-drag-handle" role="button" tabindex="0" aria-label="Déplacer" title="Glisser pour déplacer" onmousedown="this.closest(\'.mv-cell\').draggable=true;">' + svgDrag + '</div>'
            + '<div class="mv-stream-number" title="Touche ' + (idx + 1) + '">' + (idx + 1) + '</div>'
            + pastilleSource + boutonFit
            + '</div>';

        /* Trois boutons toujours visibles, nommés : « Site » (la page originale dans un
           nouvel onglet — le repli quand la vidéo ne joue pas ici), le menu, la croix.
           Le reste des actions vit dans le menu flottant (ouvrirMenuTuile). */
        var controlsHtml = '<div class="mv-hdr-right">'
            + '<button type="button" class="mv-hdr-btn mv-site-btn" title="La vidéo ne joue pas ici ? Ouvrir la page du site dans un nouvel onglet" aria-label="Ouvrir sur le site" onclick="ouvrirPageOriginale(' + idx + '); event.stopPropagation();">↗ <span class="mv-hdr-lb">Site</span></button>'
            + '<button type="button" class="mv-hdr-btn mv-tile-menu-btn" title="Options de cette vidéo" aria-label="Options de cette vidéo" aria-haspopup="menu" aria-expanded="false" onclick="ouvrirMenuTuile(' + idx + ', this, event);">' + svgMenu + '</button>'
            + '<button type="button" class="mv-hdr-btn mv-close-btn" title="Fermer cette vidéo" aria-label="Fermer cette vidéo" onclick="removeFromMultivision(' + idx + '); event.stopPropagation();">' + svgClose + '</button>'
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

    // Remove cells that are no longer in mvFlux
    existingCells.forEach(function(cell) {
        var cellId = cell.getAttribute('data-internal-id');
        if (!mvFlux.find(function(s) { return s._internalId === cellId; })) {
            cell.remove();
        }
    });

    if (activeMvIdx === null || activeMvIdx >= mvFlux.length) {
        activeMvIdx = mvFlux.length > 0 ? mvFlux.length - 1 : null;
    }

    applyMvFocusStyling();
    applyMvAudioState();
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
    return sortFluxLinks(m.streamLinks.filter(function(l) { return !!(l && l.url); }));
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
    s._autoTried = (s._autoTried | 0) + (raison === 'auto' ? 1 : 0);
    s._playing = false;
    s._playNoted = false;
    s._media = null;
    s.mode = 'page';
    s.url = suivant.url;
    saveMultivisionState();
    updateMultivisionLayout();
    var pos = positionDuFlux(s);
    showToast((raison === 'auto' ? 'Aucune vidéo : source suivante' : 'Source suivante') + (pos ? ' (' + pos.k + '/' + pos.n + ')' : '') + ' — ' + getDomain(tileTarget(suivant)));
    return true;
}

/* Le script utilisateur, quand il est installé, dit à la tuile si une vidéo joue. Sans
   nouvelle dans les 30 s, et s'il reste des sources, la tuile passe à la suivante —
   au plus une fois par lien, pour ne pas tourner en rond. Sans le script, aucun signal
   ne peut venir : on ne bascule pas seul, le bouton ⏭ reste à portée.

   30 s pour un lien inconnu ; 90 s pour un lien qui joue d'ordinaire (voir `patienceMs`,
   js/playability.js) : embed.st met souvent plus de 30 s à démarrer, et la tuile le
   quittait juste avant. */
var DELAI_SANS_VIDEO_MS = 30000;
var DELAI_HOTE_LENT_MS = 90000;
function armerBasculeAuto(s, idx, url) {
    if (s._autoTimer) { clearTimeout(s._autoTimer); s._autoTimer = null; }
    var pont = (typeof getBridgeStatus === 'function') ? getBridgeStatus() : null;
    if (!pont || !pont.available) return;
    var L = liensDuMatch(s.mid);
    if (L.length < 2) return;
    var lien = lienDuMatchPourFlux(s, url) || { url: url };
    var delai = patienceMs(lien, playLedger(), DELAI_SANS_VIDEO_MS, DELAI_HOTE_LENT_MS);
    s._autoTimer = setTimeout(function() {
        s._autoTimer = null;
        if (s._playing || s._currentUrl !== url) return;
        if ((s._autoTried | 0) >= L.length - 1) return;
        nextFluxForTile(idx, 'auto');
    }, delai);
}

/* Met à jour la pastille « source k/n · ● » d'une tuile sans re-rendre la cellule. */
function rafraichirPastille(idx) {
    var s = mvFlux[idx];
    var cell = document.querySelector('.mv-cell[data-index="' + idx + '"]');
    var pill = cell && cell.querySelector('.mv-source-pill');
    if (!s || !pill) return;
    var pos = positionDuFlux(s);
    var mesureTuile = formaterMesure(s._mesure || mesurePour(safeStorageGetJSON('debits', {}) || {}, s.url));
    pill.textContent = (s._playing ? '● ' : '') + (pos ? 'source ' + pos.k + '/' + pos.n : getDomain(tileTarget(lienDuMatchPourFlux(s, s.url) || { url: s.url }))) + (s.mode === 'direct' ? ' · direct' : '') + (mesureTuile ? ' · ' + mesureTuile : '');
    pill.classList.toggle('joue', !!s._playing);
    pill.title = s._playing ? 'Vidéo en lecture' + (s.mode === 'direct' ? ' (flux direct)' : ' (vu par le script utilisateur)') : 'Aucune vidéo confirmée pour l\'instant';
    var btnDirect = cell.querySelector('.mv-direct-btn');
    if (btnDirect) {
        btnDirect.style.display = (s._media || mediaDirectPour(registreDirect(), s.url)) ? 'inline-flex' : 'none';
        btnDirect.textContent = s.mode === 'direct' ? '🖼 page' : '▶ direct';
        btnDirect.classList.toggle('on', s.mode === 'direct');
    }
}

/* Quel index de tuile a envoyé ce message ? Le script tourne aussi dans les cadres
   imbriqués du lecteur : on remonte les parents jusqu'à l'iframe de la tuile. */
function indexDeTuilePour(source) {
    var w = source;
    for (var k = 0; k < 8 && w; k++) {
        for (var i = 0; i < mvFlux.length; i++) {
            var fr = document.getElementById('mv-iframe-' + i);
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
    if(mvFlux.length >= 4) {
        showToast('Maximum 4 streams en Multivision.');
        return;
    }
    mvFlux.push({url: url, name: name, mid: mid, cropped: false, _autoTried: 0});

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

/* ══ MENUS DU LECTEUR ET REPLI VERS LE SITE ══════════════════════════════════════
   Demande du 6 septembre 2026 : « le dropdown des options par-dessus le multiview »,
   « un bouton pour revenir au lecteur de la page originale ». Les menus sont bâtis par
   js/mv-menu.js et posés au niveau du document ; ici, seulement leur contenu. */

/* Le repli : la page du site telle quelle, dans un nouvel onglet. Quand une vidéo ne
   joue pas dans la tuile (cadre refusé, lecture automatique bloquée, lecteur qui exige
   un cookie), le lecteur du site, lui, joue toujours. */
export function ouvrirPageOriginale(idx) {
    var s = mvFlux[idx];
    if (!s || !s.url) return;
    var w = null;
    try { w = window.open(s.url, '_blank', 'noopener'); } catch (e) { w = null; }
    showToast(w === null && !('ontouchstart' in window) ? 'Le navigateur a bloqué l\'ouverture : autorisez les fenêtres pour ce site.' : 'Page du site ouverte dans un nouvel onglet');
}

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
    ouvrirMenu(bouton, [
        { titre: s.name || dom },
        { icon: '↗', label: 'Ouvrir sur le site (nouvel onglet)', title: 'Si la vidéo ne joue pas ici, le lecteur du site, lui, joue', onSelect: function() { ouvrirPageOriginale(idx); } },
        pos ? { icon: '⏭', label: 'Source suivante (' + pos.k + '/' + pos.n + ')', onSelect: function() { nextFluxForTile(idx); } } : null,
        s.mid ? { icon: '🔁', label: 'Choisir une autre source', onSelect: function() { showFluxSelector(idx, s.mid); } } : null,
        { icon: '🏟', label: 'Changer de match', onSelect: function() { showMatchSelector(null, idx); } },
        { icon: '↻', label: 'Recharger la vidéo', onSelect: function() { rechargerTuile(idx); } },
        s.mid ? { icon: '📊', label: 'Infos et statistiques', onSelect: function() { openGlobalStatsFromMatch(s.mid); } } : null,
        { sep: true },
        { icon: fitInfo.icon, label: 'Image : ' + fitInfo.label + ' (changer)', onSelect: function() { cycleMvFit(idx); } },
        media ? { icon: s.mode === 'direct' ? '🖼' : '▶', label: s.mode === 'direct' ? 'Revenir à la page du site' : 'Lire le flux direct', onSelect: function() { toggleDirectMode(idx); } } : null,
        idx > 0 ? { icon: '◀', label: 'Déplacer à gauche', onSelect: function() { moveMultiviewStream(idx, 'left'); } } : null,
        idx < mvFlux.length - 1 ? { icon: '▶', label: 'Déplacer à droite', onSelect: function() { moveMultiviewStream(idx, 'right'); } } : null,
        { sep: true },
        { icon: '⭐', label: 'Préférer ce site (' + dom + ')', actif: pref === 1, onSelect: function() { toggleDomainPref(dom, 'fav', midTexte); updateMultivisionLayout(); } },
        { icon: '👎', label: 'Éviter ce site', actif: pref === -1, onSelect: function() { toggleDomainPref(dom, 'dep', midTexte); updateMultivisionLayout(); } },
        { sep: true },
        { icon: '✕', label: 'Fermer cette vidéo', danger: true, onSelect: function() { removeFromMultivision(idx); } }
    ], { label: 'Options de la vidéo ' + (idx + 1) });
}

export function ouvrirMenuDisposition(bouton, event) {
    if (event) { event.stopPropagation(); event.preventDefault(); }
    var choisir = function(l) { return function() { setMvLayout(l); saveMultivisionState(); updateMultivisionLayout(); }; };
    ouvrirMenu(bouton, [
        { titre: 'Disposition des vidéos' },
        { icon: '⊞', label: 'Automatique', actif: mvLayout === 'auto', onSelect: choisir('auto') },
        { icon: '⭐', label: 'Une grande, les autres à côté', actif: mvLayout === 'focus', onSelect: choisir('focus') },
        { icon: '⊟', label: 'Les unes sous les autres', actif: mvLayout === 'vertical', onSelect: choisir('vertical') },
        { icon: '⊟', label: 'Côte à côte', actif: mvLayout === 'horizontal', onSelect: choisir('horizontal') }
    ], { label: 'Disposition' });
}

export function ouvrirMenuBarre(bouton, event) {
    if (event) { event.stopPropagation(); event.preventDefault(); }
    var mvc = document.getElementById('mv-container');
    var enPip = !!(mvc && mvc.classList.contains('mv-pip'));
    var modePip = localStorage.getItem('multiviewPipMode') || 'sidebar';
    var mobile = window.innerWidth <= 768;
    ouvrirMenu(bouton, [
        { icon: '⤢', label: 'Ajuster toutes les images', title: 'étiré → ajusté → rempli', onSelect: function() { cycleMvFitAll(); } },
        { icon: '🎬', label: 'Mode cinéma', onSelect: function() { toggleTheaterMode(document.getElementById('mv-grid-wrapper')); } },
        { icon: '📊', label: 'Scores et statistiques', actif: mvGameModeActive, onSelect: function() { toggleMvGameMode(); } },
        ('documentPictureInPicture' in window) ? { icon: '🖼', label: 'Fenêtre détachée', onSelect: function() { toggleDocumentPiP(); } } : null,
        { sep: true },
        (!enPip && !mobile) ? { icon: '◫', label: 'Réduire dans un coin', onSelect: function() { toggleMultiviewPip(); } } : null,
        enPip ? { icon: '⤢', label: 'Agrandir', onSelect: function() { toggleMultiviewPip(); } } : null,
        enPip ? { icon: '◫', label: 'Panneau latéral', actif: modePip === 'sidebar', onSelect: function() { window.setMvPipMode('sidebar'); } } : null,
        enPip ? { icon: '🗗', label: 'Fenêtre flottante', actif: modePip === 'floating', onSelect: function() { window.setMvPipMode('floating'); } } : null,
        mvFlux.length ? { sep: true } : null,
        mvFlux.length ? { icon: '✕', label: 'Fermer toutes les vidéos', danger: true, onSelect: fermerToutesLesVideos } : null
    ], { label: 'Plus d\'options' });
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
    } else if (!mvc.classList.contains('mv-pip')) {
        // Full screen -> Switch to PiP
        toggleMultiviewPip();
    } else {
        // PiP -> Return to Full Screen
        toggleMultiviewPip(); // This will remove pip class and restore full view
    }
}

export function toggleTheaterMode(elem) {
  elem = elem || document.getElementById('mv-grid-wrapper');
  if (!elem) return;

  if (elem.classList.contains('mv-theater')) {
      elem.classList.remove('mv-theater');
      var closeBtn = document.getElementById('mv-close-theater');
      if(closeBtn) closeBtn.remove();
      // Restore overflow
      document.body.style.overflow = '';
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
    var grid = document.getElementById('mv-grid-wrapper');
    if (!grid) grid = document.getElementById('mv-grid'); // Fallback

    if (grid && grid.classList.contains('mv-fullscreen')) {
        grid.classList.remove('mv-fullscreen');
        var closeFsBtn = document.getElementById('mv-close-fs');
        if(closeFsBtn) closeFsBtn.remove();
    }

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

// Ensure the button disappears if we exit fullscreen via ESC key
document.addEventListener("fullscreenchange", function() {
    if (!document.fullscreenElement) {
        var grid = document.getElementById('mv-grid');
        if (grid && grid.classList.contains('mv-fullscreen')) {
            grid.classList.remove('mv-fullscreen');
            var closeFsBtn = document.getElementById('mv-close-fs');
            if(closeFsBtn) closeFsBtn.remove();
        }
    }
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

        // Copy styles to the new window
        var styleSheets = document.styleSheets;
        for (var i = 0; i < styleSheets.length; i++) {
            var styleSheet = styleSheets[i];
            try {
                if (styleSheet.href) {
                    var newLinkEl = document.createElement('link');
                    newLinkEl.rel = 'stylesheet';
                    newLinkEl.href = styleSheet.href;
                    docPiPWindow.document.head.appendChild(newLinkEl);
                } else if (styleSheet.ownerNode && styleSheet.ownerNode.innerText) {
                    var newStyleEl = document.createElement('style');
                    newStyleEl.textContent = styleSheet.ownerNode.innerText;
                    docPiPWindow.document.head.appendChild(newStyleEl);
                }
            } catch (e) {
                console.warn('Failed to copy stylesheet', e);
            }
        }

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

        // Move the grid to the PiP window
        docPiPWindow.document.body.appendChild(gridWrapper);

        // Add the placeholder to the main container
        mvContainer.appendChild(placeholder);

        // Add class to container to hide other things if needed
        mvContainer.classList.add('mv-doc-pip-active');

        // Handle PiP window close
        docPiPWindow.addEventListener('pagehide', function() {
            // Remove placeholder
            var p = document.getElementById('mv-pip-placeholder');
            if (p) p.remove();

            // Move grid back to main window
            mvContainer.appendChild(gridWrapper);

            mvContainer.classList.remove('mv-doc-pip-active');
            docPiPWindow = null;
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
    return viderCachesApplication().then(function(bilan) {
        lg('Mise à jour', bilan.serviceWorkers + ' service worker(s) retiré(s), ' + bilan.caches + ' cache(s) vidé(s)');
        /* Adresse neuve : sans cela le cache HTTP peut resservir la même page et le bouton
           semblerait ne rien faire. `replace` pour ne pas empiler d'historique. */
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
export var VERSION_APP = 'sports-guide-v14';

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
    else if (info) html += ligne('Liens (data/streams.json)', 'ok', info.count + ' matchs · généré il y a ' + info.ageMin + ' min');
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
    if (st && st.echecs) html += ligne('Stockage local', 'ko', st.echecs + ' écriture(s) refusée(s) · ' + st.derniereErreur + ' · ' + (ko === null ? '?' : ko) + ' Ko');
    else html += ligne('Stockage local', 'ok', (ko === null ? 'illisible' : ko + ' Ko utilisés'));

    /* Quelle version du code tourne ICI : un service worker peut servir une copie plus
       ancienne que celle qui est publiée, et deux appareils ne montrent alors pas la
       même application. */
    var sw = 'sans service worker';
    try { if (navigator.serviceWorker && navigator.serviceWorker.controller) sw = 'service worker actif'; } catch (e) {}
    html += ligne('Version', 'ok', VERSION_APP + ' · ' + sw);
    html += '<div style="display:flex; justify-content:flex-end; padding-top:8px;">'
          + '<button class="btn xs" onclick="mettreAJourApplication()" '
          + 'title="Retire le service worker, vide ses caches et recharge. Les réglages, favoris et liens gardés en local ne sont pas touchés.">'
          + '↻ Mettre à jour l\'application</button></div>';

    return html + '</div>';
}

export function renderSourcesStatus() {
    var container = document.getElementById('sources-status-container');
    if (!container) return;
    if (sourcesStatus.length === 0) {
        container.innerHTML = diagnosticAppareilHtml() + '<div style="color: var(--muted2); text-align: center;">Aucune donnée (Scraping en attente...)</div>';
        return;
    }

    var html = diagnosticAppareilHtml();
    sourcesStatus.forEach(function(s) {
        var icon = s.status === 'success' ? '✅' : (s.status === 'warning' ? '⚠️' : '❌');
        var color = s.status === 'success' ? '#34c759' : (s.status === 'warning' ? '#ffcc00' : 'var(--red)');

        html += '<div style="display:flex; justify-content:space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 4px 0;">' +
                  '<div style="display:flex; align-items:center; gap: 8px;">' +
                      '<span style="font-size: 14px;">' + icon + '</span>' +
                      '<a href="https://' + esc(s.name) + '" target="_blank" style="font-weight: bold; color: var(--text); text-decoration: none; border-bottom: 1px dotted var(--muted);">' + esc(s.name) + '</a>' +
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


export function installTampermonkey() {
    var existing = document.getElementById('tm-modal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'tm-modal';
    modal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);z-index:9999;background:rgba(20,20,20,0.95);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:20px;backdrop-filter:blur(15px);display:flex;flex-direction:column;gap:16px;max-height:80vh;overflow-y:auto;box-shadow:0 15px 40px rgba(0,0,0,0.8);width:90%;max-width:500px;-webkit-overflow-scrolling:touch;color:#fff;';

    var closeBtn = document.createElement('div');
    closeBtn.innerHTML = '<span class="ic ic-close"></span>';
    closeBtn.style.cssText = 'position:absolute;top:12px;right:12px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.1);border-radius:50%;cursor:pointer;color:#fff;font-size:14px;';
    closeBtn.onclick = function() { modal.remove(); };
    modal.appendChild(closeBtn);

    var title = document.createElement('h2');
    title.style.cssText = 'margin:0;font-size:18px;font-weight:bold;display:flex;align-items:center;gap:8px;';
    title.innerHTML = '🧩 Installation des Scripts';
    modal.appendChild(title);

    var contentDiv = document.createElement('div');
    contentDiv.style.cssText = 'font-size:14px;line-height:1.5;color:#ddd;display:flex;flex-direction:column;gap:12px;';

    contentDiv.innerHTML = `        <div style="background:rgba(255,113,57,0.08);padding:12px;border-radius:8px;border:1px solid rgba(255,113,57,0.35);">
            <div style="font-weight:bold;margin-bottom:8px;color:var(--text);font-size:15px;">🦊 Firefox : ce qui bloque les tuiles, et comment l'ouvrir</div>
            <p style="margin-bottom:8px;color:var(--muted);">La tuile charge la page du match telle quelle et le script ne garde que la vidéo. Sur Chrome ça joue ; Firefox, lui, bloque à trois endroits. Chacun se règle.</p>
            <ol style="margin:0 0 8px 18px;padding:0;color:#ddd;font-size:13px;line-height:1.6;">
                <li><strong>Pages qui refusent l'iframe</strong> (« Firefox ne peut pas ouvrir cette page… intégrée par un autre site ») : installer l'extension <a href="https://addons.mozilla.org/fr/firefox/addon/ignore-x-frame-options-header/" target="_blank" style="color:var(--accent);">Ignore X-Frame-Options Header</a>, qui retire l'en-tête qui l'interdit.</li>
                <li><strong>Lecture automatique et en arrière-plan</strong> : dans <code>about:config</code>, mettre <code>media.autoplay.default</code> à <code>0</code>, <code>media.autoplay.blocking_policy</code> à <code>0</code>, et <code>media.block-autoplay-until-in-foreground</code> à <code>false</code> — sinon une tuile ne démarre qu'après un clic, et seulement dans l'onglet au premier plan.</li>
                <li><strong>Protection contre le pistage</strong> : elle coupe les cookies et le stockage des lecteurs encadrés, que plusieurs exigent. Cliquer le bouclier à gauche de l'adresse et désactiver la protection <em>pour ce site</em> (l'application), qui contient toutes les tuiles.</li>
            </ol>
            <p style="margin:0;color:var(--muted);font-size:12px;">Après ces trois réglages, recharger l'application. Si une tuile reste vide, son bouton ⏭ passe à la source suivante.</p>
        </div>

        <p>Pour profiter pleinement du Multivision sans publicités et avec le lecteur vidéo isolé, vous devez installer notre script utilisateur.</p>

        <div style="background:rgba(255,255,255,0.05);padding:12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1); margin-bottom: 8px;">
            <strong style="color:var(--accent);">🦊 Recommandation : Firefox + uBlock Origin</strong>
            <p style="margin-top:4px;font-size:13px;">Nous recommandons fortement d'utiliser Firefox. Bien que le script fonctionne sur Chrome, le bloqueur de publicités uBlock Origin y est beaucoup moins efficace en raison des récentes restrictions de Manifest V3 par Google.</p>
        </div>

        <div style="background:rgba(255,255,255,0.05);padding:12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);">
            <strong style="color:#4285F4;">🌍 Navigateurs Chrome / Chromium (Edge, Brave, Opera)</strong>
            <p style="margin-top:4px;font-size:13px;">Vous pouvez également utiliser le script sur les navigateurs basés sur Chromium. Assurez-vous d'installer les extensions appropriées depuis le Chrome Web Store.</p>
        </div>

        <ol style="padding-left:20px;margin:0;display:flex;flex-direction:column;gap:8px; margin-top: 8px;">
            <li>Installez l'extension <strong>Tampermonkey</strong> sur votre navigateur :
                <a href="https://addons.mozilla.org/fr/firefox/addon/tampermonkey/" target="_blank" style="color:var(--accent);">Firefox</a> |
                <a href="https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo" target="_blank" style="color:#4285F4;">Chrome</a>
            </li>
            <li>Installez l'extension <strong>uBlock Origin</strong> :
                <a href="https://addons.mozilla.org/fr/firefox/addon/ublock-origin/" target="_blank" style="color:var(--accent);">Firefox</a> |
                <a href="https://chrome.google.com/webstore/detail/ublock-origin/cjpalhdlnbpafiamejdnhcphjbkeiagm" target="_blank" style="color:#4285F4;">Chrome</a>
            </li>
            <li>Cliquez sur le bouton ci-dessous pour installer le script de nettoyage Multivision.</li>
        </ol>
    `;
    modal.appendChild(contentDiv);

    var btn = document.createElement('button');
    btn.className = 'btn g';
    btn.style.cssText = 'padding:12px;font-size:16px;font-weight:bold;justify-content:center;margin-top:8px;';
    btn.innerHTML = 'Installer le Script Multivision';
    btn.onclick = function() {
        window.location.href = './multiview-cleaner.user.js';
    };
    modal.appendChild(btn);

    document.body.appendChild(modal);

    setTimeout(function() {
        var closeListener = function(e) {
            if (!modal.contains(e.target)) {
                modal.remove();
                document.removeEventListener('click', closeListener);
            }
        };
        document.addEventListener('click', closeListener);
    }, 10);
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
window.currentGlobalStatsMatchId = currentGlobalStatsMatchId;
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
window.positionDuFlux = positionDuFlux;
window.removeFromMultivision = removeFromMultivision;
window.ouvrirMenuTuile = ouvrirMenuTuile;
window.ouvrirMenuDisposition = ouvrirMenuDisposition;
window.ouvrirMenuBarre = ouvrirMenuBarre;
window.ouvrirPageOriginale = ouvrirPageOriginale;
window.chargerQuandMeme = chargerQuandMeme;
window.diagnosticAppareilHtml = diagnosticAppareilHtml;
window.mettreAJourApplication = mettreAJourApplication;
window.viderCachesApplication = viderCachesApplication;
window.rechargerTuile = rechargerTuile;
window.fermerToutesLesVideos = fermerToutesLesVideos;
window.toggleMultiview = toggleMultiview;
window.toggleDocumentPiP = toggleDocumentPiP;
window.toggleTheaterMode = toggleTheaterMode;
window.toggleFullscreen = toggleFullscreen;
window.openFlux = openFlux;
window.toggleDirectMode = toggleDirectMode;
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

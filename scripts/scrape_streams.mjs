/*
  Pré-calcul des liens de streams côté serveur (GitHub Actions, toutes les heures).

  Réutilise EXACTEMENT les parseurs du client (js/scrapers.js) grâce à un DOM
  simulé (jsdom), puis écrit data/streams.json :
    {
      generatedAt, date,
      sources: [{ id, url, ok, matches, streams, error }],
      matches:  [{ source, league, homeTeam, awayTeam, startTime, matchDate, status, matchUrl, streamLinks:[...] }]
    }
  Le client (js/main.js -> loadPrefetchedStreams) fusionne ce fichier dans la grille
  avant même d'essayer les proxys CORS : les liens restent disponibles quand les proxys
  publics sont hors service.

  Usage : node scripts/scrape_streams.mjs [--no-subpages] [--limit N]
*/
import fs from 'fs';
import { JSDOM } from 'jsdom';

const args = process.argv.slice(2);
const NO_SUBPAGES = args.includes('--no-subpages');
const LIMIT = (() => { const i = args.indexOf('--limit'); return i >= 0 ? parseInt(args[i + 1], 10) : 400; })();

// ── DOM simulé pour pouvoir importer les modules du client ─────────────────
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://ouellettejeanphilippe-source.github.io/footy/' });
const w = dom.window;
w.__NO_AUTOSTART__ = true;
for (const k of ['window', 'document', 'DOMParser', 'localStorage', 'navigator', 'HTMLElement', 'Event', 'CustomEvent', 'location', 'history', 'getComputedStyle']) {
    Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
}
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));

// Le client passe par des proxys CORS ; ici on court-circuite : fetch direct avec un
// User-Agent de navigateur, en dépliant l'URL cible quand un proxy est demandé.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const realFetch = globalThis.fetch;
function unwrapProxyUrl(u) {
    const m = /^https?:\/\/[^/]+\/(?:\?|raw\?url=|get\?url=|v1\/proxy\?quest=)?(https?(?::|%3A).*)$/i.exec(u);
    if (m) { try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; } }
    return u;
}
// Referer = racine du site visé : certaines pages (ex. onhockey.tv/schedule_table.php) répondent 403 sans lui.
function refererFor(target) {
    try { const o = new URL(target).origin; return o + '/'; } catch (e) { return undefined; }
}
const fetchStats = { ok: 0, fail: 0, byStatus: {} };
globalThis.fetch = async (u, init) => {
    const target = unwrapProxyUrl(String(u));
    const headers = Object.assign({ 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8' }, (init && init.headers) || {});
    const ref = refererFor(target);
    if (ref && !headers.Referer) headers.Referer = ref;
    try {
        const r = await realFetch(target, Object.assign({}, init, { headers, redirect: 'follow' }));
        if (r.ok) fetchStats.ok++; else { fetchStats.fail++; fetchStats.byStatus[r.status] = (fetchStats.byStatus[r.status] || 0) + 1; }
        return r;
    } catch (e) {
        fetchStats.fail++; fetchStats.byStatus.network = (fetchStats.byStatus.network || 0) + 1;
        throw e;
    }
};

// scrapers.js en premier : il fixe un ordre d'évaluation des modules (circulaires) qui
// n'exécute pas les initialisations d'interface au chargement.
const scrapers = await import('../js/scrapers.js');
const config = await import('../js/config.js');
const utils = await import('../js/utils.js');
const match = await import('../js/match.js');

const { SCRAPERS_CONFIG, getSourceCandidates, applySourceUrl, getSourcePages, getEstDateStrFromDate, isMatchPageBlocked, SOURCE_VAR_NAMES, SOURCE_MIRRORS, reorderCandidates, shouldPromoteSource } = config;
const { fetchPage } = utils;

const parsers = {
    footybite: scrapers.parseFootybite,
    mlbbite: scrapers.parseMlbbite,
    sportsurge: scrapers.parseSportsurge,
    buffstreams: scrapers.parseBuffstreams,
    streameast: scrapers.parseStreameast,
    onhockey: scrapers.parseOnHockey,
    vipleague: scrapers.parseVipleague,
    methstreams: scrapers.parseMethstreams,
    streamed: scrapers.parseStreamed
};

function hostOf(u) { try { return new URL(u).hostname.replace(/^(www|v2)\./, ''); } catch (e) { return String(u || ''); } }

const today = getEstDateStrFromDate(new Date());
const sourcesReport = [];
let all = [];

/* domains.json est la surcharge VIVANTE des adresses de sources : le navigateur la lit
   au démarrage depuis raw.githubusercontent.com. Le script serveur, lui, partait de la
   liste figée de js/config.js et ignorait ce fichier — il ne testait donc jamais
   l'adresse réellement en service, et la promotion des miroirs ci-dessous n'aurait
   comparé que des valeurs sans jamais les éprouver. On applique le fichier d'abord,
   exactement comme le fait fetchRemoteConfig côté navigateur. */
function applyDomainsFile() {
    let d;
    try { d = JSON.parse(fs.readFileSync('domains.json', 'utf8')); }
    catch (e) { console.log('domains.json absent ou illisible, on garde les adresses de config.js'); return; }

    for (const [id, key] of Object.entries(SOURCE_VAR_NAMES)) {
        if (d[key]) applySourceUrl(id, d[key]);
    }
    if (d.MIRRORS && typeof d.MIRRORS === 'object') {
        for (const [id, list] of Object.entries(d.MIRRORS)) {
            if (Array.isArray(list) && list.length) SOURCE_MIRRORS[id] = list.slice();
        }
    }
}
applyDomainsFile();

/* Ce qu'on a appris cette fois-ci sur la joignabilité de chaque source : l'adresse qui
   a répondu, et celles qui ont échoué avant elle. Sert à réécrire domains.json en fin
   d'exécution (voir « Promotion des miroirs »). */
const mirrorFindings = {};

async function fetchWithMirrors(id, skip) {
    const candidates = getSourceCandidates(id);
    const errs = [];
    const dead = [];
    for (const url of candidates) {
        // Adresses déjà éprouvées et stériles lors de cette exécution : inutile d'y revenir.
        if (skip && skip.includes(url)) { dead.push(url); continue; }
        try {
            const html = await fetchPage(url, { force: true });
            applySourceUrl(id, url);
            mirrorFindings[id] = { winner: url, dead: dead.slice(), candidates: candidates.slice() };
            return { html, url };
        } catch (e) {
            dead.push(url);
            errs.push(url + ' -> ' + String(e && e.message ? e.message : e).split('\n')[0]);
        }
    }
    mirrorFindings[id] = { winner: null, dead: dead.slice(), candidates: candidates.slice() };
    throw new Error(errs.join(' | '));
}

/* Lit une source à une adresse donnée : accueil, sous-pages, puis analyse. */
async function readSourceAt(sc, home) {
    const pages = getSourcePages(sc, null).filter((pg) => pg.url !== home.url);
    const htmls = sc.homepageHasMatches === false ? [] : [home];
    for (const pg of pages) {
        try { htmls.push({ url: pg.url, html: await fetchPage(pg.url, { force: true }) }); }
        catch (e) { console.log(`  [${sc.id}] sous-page KO ${pg.url}: ${String(e && e.message ? e.message : e).split('\n')[0]}`); }
    }
    let list = [];
    for (const pg of htmls) {
        try { list = match.mergeMatches(list, parsers[sc.id](pg.html, pg.url) || []); }
        catch (e) { console.log(`  [${sc.id}] parse KO ${pg.url}: ${e.message}`); }
    }
    return { list, pages: htmls.length };
}

// ── 1. Pages d'accueil + sous-pages par sport : découverte des matchs ──────
for (const sc of SCRAPERS_CONFIG) {
    const t0 = Date.now();
    const rep = { id: sc.id, url: sc.url, ok: false, matches: 0, streams: 0, pages: 0, error: null, ms: 0 };
    try {
        /* On juge une adresse sur les MATCHS qu'elle livre, pas sur son code HTTP. Un
           domaine expiré puis racheté répond 200 : s'arrêter au premier succès HTTP
           faisait retenir cette page de parking et n'essayait jamais le miroir vivant,
           la source produisant alors 0 match en silence — exactement la panne qu'on
           cherche à détecter. On passe donc au candidat suivant tant qu'aucun match ne
           sort. Une source en bonne santé livre dès le premier et ne paie rien de plus ;
           seule une source en panne coûte des essais supplémentaires, ce qui est
           précisément le moment où on veut les payer. */
        let home = null, read = null, sterile = [];
        while (true) {
            home = await fetchWithMirrors(sc.id, sterile);
            read = await readSourceAt(sc, home);
            if (read.list.length) break;
            sterile.push(home.url);
            const reste = getSourceCandidates(sc.id).filter((u) => !sterile.includes(u));
            if (!reste.length) break;
            console.log(`  [${sc.id}] ${home.url} repond mais ne livre aucun match : on essaie un miroir`);
        }
        rep.url = home.url;
        if (read.list.length) mirrorFindings[sc.id].winner = home.url;
        else if (mirrorFindings[sc.id]) mirrorFindings[sc.id].winner = null;
        const list = read.list;
        list.forEach((m) => { m.source = m.source || sc.id; if (!m.matchDate) m.matchDate = today; });
        rep.ok = read.pages > 0;
        rep.pages = read.pages;
        rep.matches = list.length;
        all = match.mergeMatches(all, list);
        console.log(`[${sc.id}] ${home.url} (${read.pages} pages) -> ${list.length} matchs`);
    } catch (e) {
        rep.error = String(e && e.message ? e.message : e).slice(0, 300);
        console.log(`[${sc.id}] ECHEC ${rep.error}`);
    }
    rep.ms = Date.now() - t0;
    sourcesReport.push(rep);
}

// ── 2. Pages de match : extraction des flux (concurrence limitée) ──────────
all = all.filter((m) => m && m.matchUrl && (m.homeTeam || m.awayTeam));
if (!NO_SUBPAGES) {
    // Priorité : matchs en direct, puis à venir ; les terminés en dernier
    const rank = (m) => (m.status === 'live' ? 0 : m.status === 'finished' ? 2 : 1);
    all.sort((a, b) => rank(a) - rank(b));
    const queue = all.slice(0, LIMIT);
    const CONCURRENCY = 6;
    let idx = 0, done = 0;

    /* Plusieurs matchs peuvent partager la même page de match : c'est le cas
       normal d'OnHockey depuis que ses matchs pointent vers schedule_table.php
       (sa seule grille) plutôt que vers l'accueil du site. Sans ce cache, chaque
       match relançait sa propre requête `force: true` vers la même adresse — 24
       requêtes identiques en quelques secondes, qui se faisaient elles-mêmes
       ralentir/bloquer (429) par le site. Une entrée par URL, partagée par tous
       les matchs qui la citent. */
    const pageHtmlCache = new Map();
    function fetchPageOnce(u) {
        if (!pageHtmlCache.has(u)) pageHtmlCache.set(u, fetchPage(u, { force: true }));
        return pageHtmlCache.get(u);
    }

    async function worker() {
        while (idx < queue.length) {
            const m = queue[idx++];
            const urls = [m.matchUrl].concat(Array.isArray(m.altUrls) ? m.altUrls : [])
                .filter((u) => u && !SCRAPERS_CONFIG.some((sc) => sc.url === u)) // pages d'accueil (ex. OnHockey) déjà traitées
                .filter((u) => {
                    // Hôtes qui refusent systématiquement serveurs et proxys (voir js/config.js) :
                    // on ne télécharge pas leur page, mais on garde le lien, ouvrable par
                    // l'utilisateur depuis son navigateur.
                    if (!isMatchPageBlocked(u)) return true;
                    m.streamLinks = (m.streamLinks || []).concat(scrapers.matchPageFallbackLink(u, m.streamLinks));
                    return false;
                });
            m.pagesTried = urls.length; m.pagesOk = 0; m.scrapeError = null;
            for (const u of urls) {
                try {
                    const html = await fetchPageOnce(u);
                    m.pagesOk++;
                    let srcId = m.source;
                    try { const host = new URL(u).hostname; const sc = SCRAPERS_CONFIG.find((c) => host.indexOf(new URL(c.url).hostname.replace(/^(www|v2|app)\./, '')) >= 0); if (sc) srcId = sc.id; } catch (e) {}
                    const ctx = Object.assign({}, m, { matchUrl: u, source: srcId, streamLinks: [] });
                    const links = scrapers.extractStreamLinks(html, ctx) || [];
                    /* `srcId` (calculé juste au-dessus) est le domaine réellement visité pour
                       CETTE page — `m.source` reste le site qui a DÉCOUVERT le match dans la
                       grille, souvent différent quand `u` est un altUrl. Un lien trouvé sur
                       une page buffstreams attachée à un match découvert par footybite doit
                       porter "buffstreams", pas "footybite" : sinon chaque source qui fusionne
                       dans une autre voit ses liens crédités à la mauvaise source. */
                    const clean = links
                        .filter((l) => l && l.url)
                        .map((l) => ({ name: l.name, quality: l.quality, lang: l.lang, url: l.url, icon: l.icon, site: l.site, channel: l.channel, source: l.source || srcId, topLevel: !!l.topLevel }));
                    m.streamLinks = (m.streamLinks || []).concat(clean.filter((c) => !(m.streamLinks || []).some((e) => e.url === c.url)));
                } catch (e) {
                    const err = String(e && e.message ? e.message : e).split('\n')[0].slice(0, 120);
                    m.scrapeError = (m.scrapeError ? m.scrapeError + ' | ' : '') + hostOf(u) + ': ' + err;
                }
            }
            // Entonnoir commun (js/scrapers.js) : faux liens, doublons réels, provenance.
            m.streamLinks = scrapers.finalizeStreamLinks(m.streamLinks || []);

            // Les liens de repli "Page du match sur X" (quand une page n'expose aucun lecteur) : un seul
            // par site, et seulement si aucun vrai lecteur n'a été trouvé. Les autres liens topLevel
            // (pages de miroirs Streameast, ouvertes dans un onglet) sont toujours conservés.
            const isFallback = (l) => l.topLevel && /^Page du match/.test(l.name || '');
            const real = (m.streamLinks || []).filter((l) => !l.topLevel);
            if (real.length) m.streamLinks = (m.streamLinks || []).filter((l) => !isFallback(l));
            else {
                const seenHosts = {};
                m.streamLinks = (m.streamLinks || []).filter((l) => { if (!isFallback(l)) return true; const h = hostOf(l.url); if (seenHosts[h]) return false; seenHosts[h] = true; return true; });
            }
            done++;
            if (done % 25 === 0) console.log(`  ... ${done}/${queue.length} pages de match`);
        }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

/* Compter par `m.source` (la source qui a DÉCOUVERT le match) donnait 0 pour
   toute source dont les matchs fusionnent dans l'entrée d'une autre — le cas
   normal dès que deux sites listent le même match, puisque mergeMatches ne
   garde qu'une entrée. Une source pouvait ainsi lire "0 flux" alors que ses
   liens étaient bien là, simplement comptés sous le nom d'une autre. Chaque
   lien porte son propre `source` (site qui l'a réellement fourni) : c'est sur
   ce champ qu'il faut compter, pas sur le match qui l'héberge. */
const linksBySource = {};
for (const m of all) for (const l of (m.streamLinks || [])) {
    if (l.topLevel) continue;
    const s = l.source || 'inconnu';
    linksBySource[s] = (linksBySource[s] || 0) + 1;
}
for (const rep of sourcesReport) {
    const mine = all.filter((m) => m.source === rep.id);
    rep.streams = linksBySource[rep.id] || 0;
    rep.matchPagesOk = mine.reduce((n, m) => n + (m.pagesOk || 0), 0);
    rep.matchPagesFail = mine.reduce((n, m) => n + Math.max(0, (m.pagesTried || 0) - (m.pagesOk || 0)), 0);
    const firstErr = mine.map((m) => m.scrapeError).find(Boolean);
    if (firstErr && !rep.error) rep.error = 'pages de match: ' + firstErr.slice(0, 200);
}
// Flux par hôte de lecteur (diagnostic : voir d'un coup d'œil quels fournisseurs répondent)
const playerHosts = {};
for (const m of all) for (const l of (m.streamLinks || [])) { const h = hostOf(l.url); playerHosts[h] = (playerHosts[h] || 0) + 1; }

/* ── Politique d'intégration, lue à la source ──────────────────────────────
   Le client ne peut pas savoir si une adresse s'affichera dans une <iframe> :
   c'est le serveur distant qui le décide (X-Frame-Options, CSP frame-ancestors),
   et un navigateur ne laisse pas lire ces en-têtes depuis la page. Ici, si :
   on interroge chaque hôte de lecteur une fois et on publie le verdict. Le client
   sait alors AVANT d'afficher quoi que ce soit s'il doit intégrer le lecteur ou
   ouvrir un onglet — c'est ce qui supprime l'écran « … ne peut pas ouvrir cette
   page » au lieu de le rattraper après coup. */
function readFramePolicy(headers) {
    const xfo = String(headers.get('x-frame-options') || '').toLowerCase().trim();
    if (xfo.includes('deny') || xfo.includes('sameorigin')) return { embeddable: false, reason: 'X-Frame-Options: ' + xfo };
    const csp = String(headers.get('content-security-policy') || '');
    const fa = /frame-ancestors([^;]*)/i.exec(csp);
    if (fa) {
        const value = fa[1].trim().toLowerCase();
        if (!value || value === "'none'") return { embeddable: false, reason: 'frame-ancestors: ' + (value || "'none'") };
        if (!value.includes('*') && !value.includes('https:')) return { embeddable: false, reason: 'frame-ancestors: ' + value.slice(0, 60) };
    }
    return { embeddable: true, reason: xfo || fa ? 'en-têtes permissifs' : 'aucun en-tête restrictif' };
}

const hostPolicy = {};
const hostsToProbe = Object.keys(playerHosts).filter(Boolean);
await Promise.all(hostsToProbe.map(async (host) => {
    // On interroge une adresse réellement observée pour cet hôte : certains
    // serveurs ne posent leurs en-têtes que sur les chemins de lecteur.
    let sample = null;
    for (const m of all) for (const l of (m.streamLinks || [])) { if (!sample && hostOf(l.url) === host) sample = l.url; }
    if (!sample) return;
    try {
        const r = await realFetch(sample, { headers: { 'User-Agent': UA }, redirect: 'follow' });
        const p = readFramePolicy(r.headers);
        hostPolicy[host] = { embeddable: p.embeddable, reason: p.reason, status: r.status };
        try { if (r.body && r.body.cancel) await r.body.cancel(); } catch (e) {}
    } catch (e) {
        hostPolicy[host] = { embeddable: null, reason: 'injoignable : ' + String(e && e.message ? e.message : e).slice(0, 60) };
    }
}));

/* Un lien dont l'hôte refuse l'intégration est marqué `topLevel` dès le fichier :
   l'interface l'ouvrira dans un onglet sans jamais tenter l'iframe. */
let markedNonEmbeddable = 0;
for (const m of all) {
    for (const l of (m.streamLinks || [])) {
        const pol = hostPolicy[hostOf(l.url)];
        if (pol && pol.embeddable === false && !l.topLevel) { l.topLevel = true; markedNonEmbeddable++; }
    }
}

/* ── Extraction des lecteurs, ICI plutôt que dans le navigateur ────────────
   Le Multivision savait déjà extraire le lecteur d'une page qui refuse l'iframe —
   l'extracteur (js/extractors.js) fonctionne, vérifié sur les pages réelles. Ce qui ne
   fonctionnait pas, c'est le TRANSPORT : pour lire la page, le navigateur doit passer
   par le script utilisateur ou par un proxy CORS public. Relevé le 4 septembre 2026 sur
   la même cible, depuis un serveur, donc sans CORS en cause :

     allorigins (raw)   HTTP 400
     allorigins (json)  HTTP 522
     codetabs           HTTP 522
     proxy.cors.sh      HTTP 200 — le seul debout

   Trois transports sur quatre étaient morts. Sans le script utilisateur installé, il ne
   restait qu'un canal, et l'extraction échouait « toujours ».

   Ici, rien de tout cela : Node ne connaît pas la politique d'origine croisée. On
   télécharge chaque page de flux et on écrit l'adresse du lecteur dans le fichier. Le
   navigateur n'a alors plus rien à télécharger ni à extraire — il charge directement le
   lecteur. Le tour de passe-passe côté client reste en place pour les liens ajoutés à la
   main et pour ceux que cette passe n'a pas résolus.

   Mesuré sur le cache du 4 septembre : 120 liens en 21,6 s à concurrence 10, dont 34
   livrent un lecteur intégrable. Borné en nombre et en temps pour rester dans l'heure. */
const EXTRACT_CONCURRENCE = 12;
const EXTRACT_MAX_LIENS = 700;
const EXTRACT_TIMEOUT_MS = 12000;

const extractors = await import('../js/extractors.js');

const liensAResoudre = [];
{
    const vus = new Set();
    for (const m of all) for (const l of (m.streamLinks || [])) {
        if (!l.url || vus.has(l.url)) continue;
        vus.add(l.url);
        liensAResoudre.push(l.url);
    }
}
const lecteurParLien = {};
let extraitsOk = 0, extraitsVides = 0, extraitsErr = 0;
{
    const cible = liensAResoudre.slice(0, EXTRACT_MAX_LIENS);
    let curseur = 0;
    const t0 = Date.now();
    async function ouvrier() {
        while (curseur < cible.length) {
            const u = cible[curseur++];
            try {
                const r = await realFetch(u, {
                    headers: { 'User-Agent': UA, 'Referer': refererFor(u) },
                    redirect: 'follow',
                    signal: AbortSignal.timeout(EXTRACT_TIMEOUT_MS)
                });
                const html = await r.text();
                const cands = extractors.extractPlayers(html, u, { limit: 6 }) || [];
                /* Même exigence que pickEmbeddablePlayer côté client : intégrable, et sur
                   un autre hôte que la page — sinon on ne fait que réécrire l'adresse
                   qu'on avait déjà. */
                const hote = hostOf(u);
                const gagnant = cands.find((c) => c.kind === 'embed' && hostOf(c.url) !== hote);
                if (gagnant) { lecteurParLien[u] = gagnant.url; extraitsOk++; }
                else extraitsVides++;
            } catch (e) { extraitsErr++; }
        }
    }
    await Promise.all(Array.from({ length: EXTRACT_CONCURRENCE }, ouvrier));
    console.log(`Lecteurs extraits : ${extraitsOk}/${cible.length} liens sondés `
        + `(${extraitsVides} sans lecteur, ${extraitsErr} injoignables) en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

// ── 3. Écriture ───────────────────────────────────────────────────────────
const out = {
    generatedAt: new Date().toISOString(),
    date: today,
    fetch: fetchStats,
    playerHosts: Object.fromEntries(Object.entries(playerHosts).sort((a, b) => b[1] - a[1]).slice(0, 40)),
    hostPolicy: hostPolicy,
    sources: sourcesReport,
    matches: all.map((m) => ({
        source: m.source,
        league: m.league || '',
        homeTeam: m.homeTeam || '',
        awayTeam: m.awayTeam || '',
        startTime: m.startTime || '00:00',
        matchDate: m.matchDate || today,
        status: m.status || 'upcoming',
        matchUrl: m.matchUrl,
        altUrls: Array.isArray(m.altUrls) ? m.altUrls : [],
        scrapeError: m.scrapeError || null,
        streamLinks: (m.streamLinks || []).map((l) => Object.assign({ name: l.name, quality: l.quality, lang: l.lang, url: l.url, icon: l.icon, source: l.source || m.source },
            l.site ? { site: l.site } : {}, l.channel ? { channel: l.channel } : {}, l.topLevel ? { topLevel: true } : {},
            lecteurParLien[l.url] ? { playerUrl: lecteurParLien[l.url] } : {}))
    }))
};
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/streams.json', JSON.stringify(out, null, 1));
const totalStreams = out.matches.reduce((n, m) => n + m.streamLinks.filter((l) => !l.topLevel).length, 0);
console.log(`\ndata/streams.json : ${out.matches.length} matchs, ${totalStreams} flux, sources OK : ${sourcesReport.filter((s) => s.ok).map((s) => s.id).join(', ') || 'aucune'}`);
console.log('Pages de match : ' + sourcesReport.map((s) => `${s.id} ${s.matchPagesOk || 0}/${(s.matchPagesOk || 0) + (s.matchPagesFail || 0)}`).join(', '));
console.log('Requêtes : ' + JSON.stringify(fetchStats) + ' | lecteurs : ' + JSON.stringify(out.playerHosts));
const refuse = Object.entries(hostPolicy).filter(([, p]) => p.embeddable === false).map(([h]) => h);
console.log(`Integration : ${Object.keys(hostPolicy).length} hotes sondes, ${refuse.length} refusent l'iframe` + (refuse.length ? ' (' + refuse.join(', ') + ')' : '') + `, ${markedNonEmbeddable} liens marques onglet`);
/* ══ PROMOTION DES MIROIRS ══════════════════════════════════════════════════
   `fetchWithMirrors` bascule déjà sur un miroir vivant quand le domaine principal ne
   répond plus — mais seulement pour l'exécution en cours. Rien n'était écrit, si bien
   que le lancement suivant réessayait le domaine mort en premier et repayait son délai
   d'attente ; et le navigateur de l'utilisateur, qui lit domains.json au démarrage,
   continuait de partir sur la mauvaise adresse jusqu'à ce que quelqu'un la corrige à la
   main. Ces domaines changent plusieurs fois par saison : c'est la principale cause de
   panne silencieuse d'une source.

   On réécrit donc domains.json avec ce qui a été constaté. Deux garde-fous :

   1. **Aucune adresse n'est inventée.** On se contente de RÉORDONNER les candidats déjà
      connus (URL courante + miroirs déclarés). Le script ne part pas à la découverte de
      nouveaux domaines, et ne peut donc pas se faire détourner vers un site arbitraire.
   2. **Répondre ne suffit pas : il faut avoir livré des matchs.** Un domaine expiré puis
      racheté rend un 200 avec une page de parking ; le promouvoir sur ce seul critère
      remplacerait une source morte par une source morte, en effaçant au passage le
      miroir qui marchait. On exige donc `matches > 0`.

   Le miroir déchu n'est pas supprimé : il repasse simplement derrière, car ces domaines
   reviennent souvent. */
function updateDomainsFile() {
    let current;
    try { current = JSON.parse(fs.readFileSync('domains.json', 'utf8')); }
    catch (e) { console.log('domains.json illisible, promotion des miroirs ignorée : ' + e.message); return; }

    const before = JSON.stringify(current);
    current.MIRRORS = current.MIRRORS || {};
    const promus = [];

    for (const rep of sourcesReport) {
        const found = mirrorFindings[rep.id];
        if (!shouldPromoteSource(rep, found)) continue;   // garde-fous 1 et 2

        const key = SOURCE_VAR_NAMES[rep.id];
        if (!key) continue;

        // Gagnant en tête, morts en queue (voir reorderCandidates, js/config.js).
        const ordered = reorderCandidates(found.winner, found.candidates, found.dead);
        const ancien = current[key];
        current[key] = found.winner;
        current.MIRRORS[rep.id] = ordered;

        if (ancien !== found.winner) {
            promus.push(`${rep.id} : ${ancien || '(absent)'} -> ${found.winner} (${rep.matches} matchs)`);
        }
    }

    const after = JSON.stringify(current);
    if (after === before) return;
    fs.writeFileSync('domains.json', JSON.stringify(current, null, 2) + '\n');
    if (promus.length) console.log('domains.json mis a jour :\n  ' + promus.join('\n  '));
    else console.log('domains.json mis a jour (miroirs reordonnes)');
}
updateDomainsFile();

process.exit(0);

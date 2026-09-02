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

const { SCRAPERS_CONFIG, getSourceCandidates, applySourceUrl, getSourcePages, getEstDateStrFromDate } = config;
const { fetchPage } = utils;

const parsers = {
    footybite: scrapers.parseFootybite,
    mlbbite: scrapers.parseMlbbite,
    sportsurge: scrapers.parseSportsurge,
    buffstreams: scrapers.parseBuffstreams,
    streameast: scrapers.parseStreameast,
    onhockey: scrapers.parseOnHockey,
    vipleague: scrapers.parseVipleague,
    methstreams: scrapers.parseMethstreams
};

function hostOf(u) { try { return new URL(u).hostname.replace(/^(www|v2)\./, ''); } catch (e) { return String(u || ''); } }

const today = getEstDateStrFromDate(new Date());
const sourcesReport = [];
let all = [];

async function fetchWithMirrors(id) {
    const candidates = getSourceCandidates(id);
    const errs = [];
    for (const url of candidates) {
        try {
            const html = await fetchPage(url, { force: true });
            applySourceUrl(id, url);
            return { html, url };
        } catch (e) {
            errs.push(url + ' -> ' + String(e && e.message ? e.message : e).split('\n')[0]);
        }
    }
    throw new Error(errs.join(' | '));
}

// ── 1. Pages d'accueil + sous-pages par sport : découverte des matchs ──────
for (const sc of SCRAPERS_CONFIG) {
    const t0 = Date.now();
    const rep = { id: sc.id, url: sc.url, ok: false, matches: 0, streams: 0, pages: 0, error: null, ms: 0 };
    try {
        const home = await fetchWithMirrors(sc.id);
        rep.url = home.url;
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
        list.forEach((m) => { m.source = m.source || sc.id; if (!m.matchDate) m.matchDate = today; });
        rep.ok = htmls.length > 0;
        rep.pages = htmls.length;
        rep.matches = list.length;
        all = match.mergeMatches(all, list);
        console.log(`[${sc.id}] ${home.url} (${htmls.length} pages) -> ${list.length} matchs`);
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
    async function worker() {
        while (idx < queue.length) {
            const m = queue[idx++];
            const urls = [m.matchUrl].concat(Array.isArray(m.altUrls) ? m.altUrls : [])
                .filter((u) => u && !SCRAPERS_CONFIG.some((sc) => sc.url === u)); // pages d'accueil (ex. OnHockey) déjà traitées
            m.pagesTried = urls.length; m.pagesOk = 0; m.scrapeError = null;
            for (const u of urls) {
                try {
                    const html = await fetchPage(u, { force: true });
                    m.pagesOk++;
                    let srcId = m.source;
                    try { const host = new URL(u).hostname; const sc = SCRAPERS_CONFIG.find((c) => host.indexOf(new URL(c.url).hostname.replace(/^(www|v2|app)\./, '')) >= 0); if (sc) srcId = sc.id; } catch (e) {}
                    const ctx = Object.assign({}, m, { matchUrl: u, source: srcId, streamLinks: [] });
                    const links = scrapers.extractStreamLinks(html, ctx) || [];
                    const clean = links
                        .filter((l) => l && l.url)
                        .map((l) => ({ name: l.name, quality: l.quality, lang: l.lang, url: l.url, icon: l.icon, source: l.source || m.source, topLevel: !!l.topLevel }));
                    m.streamLinks = (m.streamLinks || []).concat(clean.filter((c) => !(m.streamLinks || []).some((e) => e.url === c.url)));
                } catch (e) {
                    const err = String(e && e.message ? e.message : e).split('\n')[0].slice(0, 120);
                    m.scrapeError = (m.scrapeError ? m.scrapeError + ' | ' : '') + hostOf(u) + ': ' + err;
                }
            }
            // Les liens "Page du match sur X" (repli quand la page n'expose aucun lecteur) : un seul par site,
            // et seulement si aucun vrai lecteur n'a été trouvé.
            const real = (m.streamLinks || []).filter((l) => !l.topLevel);
            if (real.length) m.streamLinks = real;
            else {
                const seenHosts = {};
                m.streamLinks = (m.streamLinks || []).filter((l) => { const h = hostOf(l.url); if (seenHosts[h]) return false; seenHosts[h] = true; return true; });
            }
            done++;
            if (done % 25 === 0) console.log(`  ... ${done}/${queue.length} pages de match`);
        }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

for (const rep of sourcesReport) {
    const mine = all.filter((m) => m.source === rep.id);
    rep.streams = mine.reduce((n, m) => n + ((m.streamLinks || []).filter((l) => !l.topLevel).length), 0);
    rep.matchPagesOk = mine.reduce((n, m) => n + (m.pagesOk || 0), 0);
    rep.matchPagesFail = mine.reduce((n, m) => n + Math.max(0, (m.pagesTried || 0) - (m.pagesOk || 0)), 0);
    const firstErr = mine.map((m) => m.scrapeError).find(Boolean);
    if (firstErr && !rep.error) rep.error = 'pages de match: ' + firstErr.slice(0, 200);
}
// Flux par hôte de lecteur (diagnostic : voir d'un coup d'œil quels fournisseurs répondent)
const playerHosts = {};
for (const m of all) for (const l of (m.streamLinks || [])) { const h = hostOf(l.url); playerHosts[h] = (playerHosts[h] || 0) + 1; }

// ── 3. Écriture ───────────────────────────────────────────────────────────
const out = {
    generatedAt: new Date().toISOString(),
    date: today,
    fetch: fetchStats,
    playerHosts: Object.fromEntries(Object.entries(playerHosts).sort((a, b) => b[1] - a[1]).slice(0, 40)),
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
        streamLinks: (m.streamLinks || []).map((l) => Object.assign({ name: l.name, quality: l.quality, lang: l.lang, url: l.url, icon: l.icon, source: l.source || m.source }, l.topLevel ? { topLevel: true } : {}))
    }))
};
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/streams.json', JSON.stringify(out, null, 1));
const totalStreams = out.matches.reduce((n, m) => n + m.streamLinks.filter((l) => !l.topLevel).length, 0);
console.log(`\ndata/streams.json : ${out.matches.length} matchs, ${totalStreams} flux, sources OK : ${sourcesReport.filter((s) => s.ok).map((s) => s.id).join(', ') || 'aucune'}`);
console.log('Pages de match : ' + sourcesReport.map((s) => `${s.id} ${s.matchPagesOk || 0}/${(s.matchPagesOk || 0) + (s.matchPagesFail || 0)}`).join(', '));
console.log('Requêtes : ' + JSON.stringify(fetchStats) + ' | lecteurs : ' + JSON.stringify(out.playerHosts));
process.exit(0);

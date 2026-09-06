/*
  Vérification observée des lecteurs (GitHub Actions, après scrape_streams.mjs).

  Charge, dans un vrai Chromium sans tête, les lecteurs des matchs en direct ou imminents
  — encadrés dans une iframe comme dans une tuile du Multivision — et note ce qui se
  passe : trafic vidéo (manifeste, segments), élément <video> avec des données, cadre
  refusé par le navigateur. Le verdict est écrit sur chaque lien éprouvé (`verified`,
  `verifiedAt`) et cumulé par hôte (`hostPlay`) dans data/streams.json ; le navigateur de
  l'utilisateur classe ensuite les liens d'après ces observations (js/playability.js).

  Pourquoi un navigateur, et pas le moteur d'extraction : le 6 septembre 2026, sur les
  1 237 cibles de tuile du cache, presque toutes étaient des pages intermédiaires, des
  pages anti-adblock ou des hôtes morts — rien de tout cela ne se lit dans le HTML ni dans
  les en-têtes, et pendant des semaines le Multivision a servi ces liens en premier.

  Ne fait jamais échouer le passage : sans navigateur, sans réseau ou hors budget, le
  fichier est laissé tel quel et la raison est écrite dans le journal.

  Usage : node scripts/verify_players.mjs [--budget-ms N] [--total N]
*/
import fs from 'fs';
import { JSDOM } from 'jsdom';

const args = process.argv.slice(2);
const arg = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? Number(args[i + 1]) : dflt; };
const BUDGET_MS = arg('--budget-ms', 5 * 60 * 1000);
const TOTAL = arg('--total', 150);
const PER_MATCH = 3, PER_HOST = 4, CONCURRENCY = 4, WATCH_MS = 12000, NAV_TIMEOUT_MS = 20000;
const IMMINENT_MIN = 120;

// ── DOM simulé : nécessaire pour importer js/config.js (heure de l'Est) ───────
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://ouellettejeanphilippe-source.github.io/footy/' });
const w = dom.window;
w.__NO_AUTOSTART__ = true;
for (const k of ['window', 'document', 'DOMParser', 'localStorage', 'navigator', 'HTMLElement', 'Event', 'CustomEvent', 'location', 'history', 'getComputedStyle']) {
    Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
}
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

await import('../js/scrapers.js');   // fixe l'ordre d'évaluation des modules circulaires
const config = await import('../js/config.js');
const play = await import('../js/playability.js');

function log(s) { console.log(s); }

let data;
try { data = JSON.parse(fs.readFileSync('data/streams.json', 'utf8')); }
catch (e) { log('verify_players : data/streams.json illisible (' + e.message + '), rien à vérifier'); process.exit(0); }
if (!data || !Array.isArray(data.matches)) { log('verify_players : format inattendu, rien à vérifier'); process.exit(0); }

let chromium;
try { ({ chromium } = await import('playwright')); }
catch (e) { log('verify_players : Playwright indisponible (' + e.message.split('\n')[0] + '), vérification sautée'); process.exit(0); }

// ── Cibles ────────────────────────────────────────────────────────────────────
const now = new Date();
for (const m of data.matches) {
    const mn = config.minutesUntilStart(m, now);
    if (m.status === 'live') m.rank = 0;
    else if (m.status === 'finished') m.rank = 3;
    else if (mn !== null && mn <= IMMINENT_MIN && mn > -config.LIVE_MAX_DURATION_MIN) m.rank = 1;
    else m.rank = 2;
}
const targets = play.pickTargets(data.matches, { perMatch: PER_MATCH, perHost: PER_HOST, total: TOTAL })
    .filter((t) => data.matches[t.matchIndex].rank <= 1);
for (const m of data.matches) delete m.rank;
log(`verify_players : ${targets.length} cibles (matchs en direct ou a moins de ${IMMINENT_MIN} min), budget ${Math.round(BUDGET_MS / 60000)} min`);
if (!targets.length) process.exit(0);

// ── Observation ───────────────────────────────────────────────────────────────
const PROBE_ORIGIN = 'https://guide-des-sports.local';
const probeHtml = (target) => '<!doctype html><html><body style="margin:0;background:#000">'
    + '<iframe id="f" src="' + target.replace(/"/g, '&quot;') + '" style="width:100vw;height:100vh;border:0" allow="autoplay; fullscreen"></iframe>'
    + '</body></html>';

let browser;
try {
    browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio', '--no-sandbox'] });
} catch (e) { log('verify_players : impossible de lancer Chromium (' + e.message.split('\n')[0] + '), vérification sautée'); process.exit(0); }

const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
    locale: 'en-US'
});
await context.route(PROBE_ORIGIN + '/**', (route) => {
    const u = new URL(route.request().url());
    const target = decodeURIComponent(u.searchParams.get('u') || '');
    route.fulfill({ status: 200, contentType: 'text/html', body: probeHtml(target) });
});

async function observe(target) {
    const page = await context.newPage();
    const obs = { mediaRequests: 0, videoReady: false, frameError: false, status: 0, sample: '' };
    page.on('request', (r) => {
        const u = r.url();
        if (u.startsWith(PROBE_ORIGIN)) return;   // la page de sonde elle-même n'est pas de la vidéo
        if (play.isMediaRequest(u)) { obs.mediaRequests++; if (!obs.sample) obs.sample = u.slice(0, 100); }
    });
    page.on('response', (r) => { if (r.url() === target || r.url().replace(/\/$/, '') === target.replace(/\/$/, '')) obs.status = r.status(); });
    try {
        await page.goto(PROBE_ORIGIN + '/probe.html?u=' + encodeURIComponent(target), { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
        await page.waitForTimeout(WATCH_MS);
        for (const f of page.frames()) {
            if (f === page.mainFrame()) continue;
            if (/^chrome-error:/.test(f.url())) { obs.frameError = true; continue; }
            try {
                const v = await f.evaluate(() => Array.from(document.querySelectorAll('video')).map((x) => ({ rs: x.readyState, t: x.currentTime, src: !!(x.currentSrc || x.src) })));
                if (v.some((x) => x.rs >= 2 || x.t > 0)) obs.videoReady = true;
            } catch (e) { /* cadre inaccessible : on ne conclut rien */ }
        }
        const frames = page.frames();
        if (frames.length <= 1 && obs.mediaRequests === 0) obs.frameError = true;   // l'iframe n'a jamais produit de document
    } catch (e) {
        obs.error = String(e.message || e).split('\n')[0].slice(0, 80);
    } finally {
        try { await page.close(); } catch (e) {}
    }
    return obs;
}

const t0 = Date.now();
let cursor = 0, done = 0, horsBudget = 0;
const compte = { plays: 0, blocked: 0, none: 0 };
const ledger = play.mergeLedgers(data.hostPlay || {}, {});
const parHote = {};

async function worker() {
    while (cursor < targets.length) {
        if (Date.now() - t0 > BUDGET_MS) { horsBudget += targets.length - cursor; cursor = targets.length; break; }
        const t = targets[cursor++];
        const obs = await observe(t.target);
        const verdict = play.verdictFromObservation(obs);
        compte[verdict]++;
        const link = data.matches[t.matchIndex].streamLinks[t.linkIndex];
        link.verified = verdict;
        link.verifiedAt = new Date().toISOString();
        play.recordObservation(ledger, t.host, verdict);
        parHote[t.host] = parHote[t.host] || { plays: 0, tested: 0 };
        parHote[t.host].tested++;
        if (verdict === 'plays') parHote[t.host].plays++;
        done++;
        if (verdict === 'plays' || done <= 10) log(`  ${verdict.padEnd(7)} ${t.host.padEnd(30)} ${obs.sample || (obs.error ? 'err: ' + obs.error : '')}`);
    }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
try { await browser.close(); } catch (e) {}

// ── Écriture ──────────────────────────────────────────────────────────────────
data.hostPlay = ledger;
data.verifiedAt = new Date().toISOString();
fs.writeFileSync('data/streams.json', JSON.stringify(data, null, 1));

const resume = Object.entries(parHote).sort((a, b) => b[1].tested - a[1].tested).slice(0, 15)
    .map(([h, c]) => `${h} ${c.plays}/${c.tested}`).join(', ');
log(`verify_players : ${done} cibles observees en ${((Date.now() - t0) / 1000).toFixed(0)} s — joue ${compte.plays}, rien ${compte.none}, bloque ${compte.blocked}`
    + (horsBudget ? ` — ${horsBudget} laissees de cote, budget epuise` : ''));
log('  par hote : ' + resume);
process.exit(0);

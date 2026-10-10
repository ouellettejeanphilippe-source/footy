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
const REHAB_MAX = 6;   // témoins d'hôtes écartés éprouvés par passage

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
const media = await import('../js/directmedia.js');   // estManifeste : un manifeste, pas un segment
const tv = await import('../js/tvliste.js');           // data/tv.json, la liste de l'appli Android TV
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

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
/* Les hôtes écartés du fichier (ecarterLiensMorts, js/playability.js) ne sont plus dans
   aucun match : sans ces cibles, ils ne seraient plus jamais chargés et ne pourraient
   jamais revenir. Un témoin par hôte, quelques-uns par passage, à tour de rôle. */
const rehab = data.hostPlayCritere === play.CRITERE_VERDICT ? play.ciblesDeRehabilitation(data.hotesEcartes, REHAB_MAX) : [];
targets.push(...rehab);
log(`verify_players : ${targets.length} cibles (matchs en direct ou a moins de ${IMMINENT_MIN} min${rehab.length ? `, dont ${rehab.length} temoins d'hotes ecartes` : ''}), budget ${Math.round(BUDGET_MS / 60000)} min`);
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
    userAgent: USER_AGENT,
    locale: 'en-US'
});
await context.route(PROBE_ORIGIN + '/**', (route) => {
    const u = new URL(route.request().url());
    const target = decodeURIComponent(u.searchParams.get('u') || '');
    route.fulfill({ status: 200, contentType: 'text/html', body: probeHtml(target) });
});

async function observe(target) {
    const page = await context.newPage();
    const obs = {
        mediaRequests: 0,   // demandé   — diagnostic seulement
        mediaOk: 0,         // ARRIVÉ    — c'est lui qui décide (voir verdictFromObservation)
        mediaEchecs: 0,     // demandé, refusé (403, 404, 5xx)
        videoReady: false,
        frameError: false,
        status: 0,
        sample: '',
        media: '',          // l'adresse du manifeste, ENTIÈRE : le mode direct s'en sert
        mediaReferer: '',   // la page qui l'a demandé : l'appli TV le renvoie (tv/README.md)
    };
    page.on('request', (r) => {
        const u = r.url();
        if (u.startsWith(PROBE_ORIGIN)) return;   // la page de sonde elle-même n'est pas de la vidéo
        if (play.isMediaRequest(u)) { obs.mediaRequests++; if (!obs.sample) obs.sample = u.slice(0, 100); }
    });
    /* Les RÉPONSES, et pas seulement les requêtes. C'est l'écart entre les deux qui
       était invisible : un lecteur qui demande un manifeste et n'obtient rien valait
       « joue ». On ne lit que les en-têtes — lire un corps ici serait asynchrone et
       ferait manquer les réponses arrivées pendant l'attente. */
    page.on('response', (r) => {
        const u = r.url();
        if (u === target || u.replace(/\/$/, '') === target.replace(/\/$/, '')) obs.status = r.status();
        if (u.startsWith(PROBE_ORIGIN) || !play.isMediaRequest(u)) return;
        const st = r.status();
        if (st < 200 || st >= 300) { obs.mediaEchecs++; return; }
        obs.mediaOk++;
        /* L'adresse du manifeste, gardée ENTIÈRE. Elle était tronquée à 100
           caractères et ne servait qu'au journal — alors que `js/directmedia.js`
           sait jouer un manifeste sans charger la page du site, et qu'il ne
           l'apprenait jusqu'ici qu'une fois l'utilisateur déjà en train de
           regarder. Mesuré sur un passage : 29 des 36 adresses observées n'ont ni
           jeton ni expiration, donc restent jouables le temps de l'événement. */
        if (!obs.media && media.estManifeste(u)) {
            obs.media = u;
            /* Le `Referer` de la requête, c'est-à-dire le cadre IMBRIQUÉ du lecteur, rarement
               la page du lien. La plupart des CDN refusent le manifeste sans lui (dlive.sx :
               403 sans, 200 avec, 10 octobre 2026). Un navigateur ne peut pas le poser ;
               l'appli Android TV, si (tv/README.md). */
            try { obs.mediaReferer = r.request().headers()['referer'] || ''; } catch (e) {}
        }
    });
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
/* LE REGISTRE REPART DE ZÉRO QUAND LA RÈGLE DU VERDICT A CHANGÉ.

   Les compteurs de `hostPlay` sont des verdicts additionnés. Gagnés sous une règle
   fausse, ils sont faux : embed.st portait 24 sur 24 « joue » parce qu'une requête
   vidéo partie suffisait, alors que rien n'arrivait. Les garder, c'est garder en
   tête du classement exactement les hôtes qu'on vient d'apprendre à reconnaître —
   et `recordObservation` ne les dilue qu'à moitié tous les `cap` essais, donc il
   faudrait des semaines pour que le passé faux cesse de peser.

   Mieux vaut un registre vide, qu'un passage suffit à regarnir, qu'un registre
   confiant et faux. */
const critereStocke = data.hostPlayCritere | 0;
let ledger;
if (critereStocke !== play.CRITERE_VERDICT) {
    log(`verify_players : le critère du verdict est passé de v${critereStocke || 1} à v${play.CRITERE_VERDICT} — le registre repart de zéro (${Object.keys(data.hostPlay || {}).length} hôtes écartés).`);
    ledger = {};
    // Les verdicts déjà posés sur les liens ont été gagnés sous l'ancienne règle.
    for (const m of data.matches) {
        for (const l of (m.streamLinks || [])) {
            delete l.verified; delete l.verifiedAt; delete l.media; delete l.mediaAt; delete l.mediaReferer;
        }
    }
} else {
    ledger = play.mergeLedgers(data.hostPlay || {}, {});
}
/* Le même registre, par SOURCE (l'agrégateur qui a fourni le lien) : il classe les liens
   dont l'hôte n'a jamais été éprouvé (reputationLien, js/playability.js). Remis à zéro
   avec l'autre quand la règle du verdict change. */
let ledgerSources = critereStocke !== play.CRITERE_VERDICT ? {} : play.mergeLedgers(data.sourcePlay || {}, {});
// Premier passage : amorcé sur ce que le registre des hôtes dit déjà des liens de chaque source.
if (!Object.keys(ledgerSources).length) ledgerSources = play.reputationParSource(data.matches, ledger);
const parHote = {};

async function worker() {
    while (cursor < targets.length) {
        if (Date.now() - t0 > BUDGET_MS) { horsBudget += targets.length - cursor; cursor = targets.length; break; }
        const t = targets[cursor++];
        const obs = await observe(t.target);
        const verdict = play.verdictFromObservation(obs);
        compte[verdict]++;
        if (t.ecarte) {
            // Témoin d'un hôte écarté : aucun lien publié à marquer, seulement le registre.
            data.hotesEcartes[t.host].essaiAt = new Date().toISOString();
            data.hotesEcartes[t.host].verdict = verdict;
        } else {
            const link = data.matches[t.matchIndex].streamLinks[t.linkIndex];
            if (link.source) play.recordObservation(ledgerSources, String(link.source), verdict);
            link.verified = verdict;
            link.verifiedAt = new Date().toISOString();
            /* L'adresse du flux, quand on l'a vue arriver : elle permet au mode direct
               (js/directmedia.js) d'être disponible dès la PREMIÈRE ouverture, au lieu
               d'attendre que l'utilisateur ait déjà regardé la page pour l'apprendre. */
            if (verdict === 'plays' && obs.media) {
                link.media = obs.media;
                link.mediaAt = link.verifiedAt;
                if (obs.mediaReferer) link.mediaReferer = obs.mediaReferer; else delete link.mediaReferer;
            } else {
                delete link.media; delete link.mediaAt; delete link.mediaReferer;
            }
        }
        play.recordObservation(ledger, t.host, verdict);
        parHote[t.host] = parHote[t.host] || { plays: 0, tested: 0 };
        parHote[t.host].tested++;
        if (verdict === 'plays') parHote[t.host].plays++;
        done++;
        /* Le journal dit maintenant DEMANDÉ/ARRIVÉ, parce que c'est l'écart entre les
           deux qui était le défaut : un « 6/0 » se lit tout de suite comme un lecteur
           qui réclame de la vidéo sans en recevoir — et c'était compté « joue ». */
        if (verdict === 'plays' || done <= 10 || (obs.mediaRequests | 0) > 0) {
            log(`  ${verdict.padEnd(7)} ${t.host.padEnd(28)} demandé ${String(obs.mediaRequests).padStart(3)} / arrivé ${String(obs.mediaOk).padStart(3)}`
                + ((obs.mediaEchecs | 0) ? ` / refusé ${obs.mediaEchecs}` : '')
                + '  ' + (obs.media || obs.sample || (obs.error ? 'err: ' + obs.error : '')));
        }
    }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
try { await browser.close(); } catch (e) {}

// ── Écriture ──────────────────────────────────────────────────────────────────
data.hostPlay = ledger;
data.sourcePlay = ledgerSources;
// La règle sous laquelle CE registre a été gagné. Un passage qui lira une autre
// valeur repartira de zéro plutôt que de faire confiance à des compteurs anciens.
data.hostPlayCritere = play.CRITERE_VERDICT;
data.verifiedAt = new Date().toISOString();
fs.writeFileSync('data/streams.json', JSON.stringify(data, null, 1));
const listeTv = tv.listeTv(data, { agent: USER_AGENT });
fs.writeFileSync('data/tv.json', JSON.stringify(listeTv));
log(`verify_players : data/tv.json, ${listeTv.matchs.length} matchs jouables sur la télé`);

const resume = Object.entries(parHote).sort((a, b) => b[1].tested - a[1].tested).slice(0, 15)
    .map(([h, c]) => `${h} ${c.plays}/${c.tested}`).join(', ');
log(`verify_players : ${done} cibles observees en ${((Date.now() - t0) / 1000).toFixed(0)} s — joue ${compte.plays}, rien ${compte.none}, bloque ${compte.blocked}`
    + (horsBudget ? ` — ${horsBudget} laissees de cote, budget epuise` : ''));
log('  par hote : ' + resume);
process.exit(0);

/*
  Sonde un ou plusieurs domaines : à quelle source ils ressemblent, combien de matchs ils
  listent, et quels lecteurs portent leurs pages de match.

  Usage :
    node scripts/sonder_domaine.mjs <domaine|adresse>... [--source <id>] [--matchs N] [--ajouter]

    --source <id>   lire le domaine comme cette source (footybite, sportsurge, streamed…),
                    au lieu de la deviner d'après son nom
    --matchs N      nombre de pages de match à ouvrir (3 par défaut, 0 pour aucune)
    --ajouter       inscrire le domaine dans les miroirs de sa source (domains.json), en
                    dernier, s'il a livré des matchs avec un parseur dédié ou le repli

  Exemple : node scripts/sonder_domaine.mjs methstreams.st streamed.st --ajouter

  Le script ne promeut rien : un miroir ajouté passe derrière les autres, et c'est le
  passage suivant de scrape_streams.mjs qui le met en tête s'il livre (shouldPromoteSource).
  Il réutilise les parseurs du client dans un DOM jsdom, comme scrape_streams.mjs, avec un
  fetch direct (User-Agent de navigateur, Referer). Les décisions vivent dans js/sondage.js.
*/
import fs from 'fs';
import { JSDOM } from 'jsdom';

const args = process.argv.slice(2);
const valeur = (nom) => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : undefined; };
const SOURCE = valeur('--source');
const N_MATCHS = valeur('--matchs') !== undefined ? Math.max(0, parseInt(valeur('--matchs'), 10) || 0) : 3;
const AJOUTER = args.includes('--ajouter');
const adresses = args.filter((a, i) => !a.startsWith('--') && !['--source', '--matchs'].includes(args[i - 1]));
if (!adresses.length) {
    console.log('Usage : node scripts/sonder_domaine.mjs <domaine|adresse>... [--source <id>] [--matchs N] [--ajouter]');
    process.exit(1);
}

// ── DOM simulé pour importer les modules du client (voir scrape_streams.mjs) ──
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://ouellettejeanphilippe-source.github.io/footy/' });
const w = dom.window;
w.__NO_AUTOSTART__ = true;
for (const k of ['window', 'document', 'DOMParser', 'localStorage', 'navigator', 'HTMLElement', 'Event', 'CustomEvent', 'location', 'history', 'getComputedStyle']) {
    Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
}
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const realFetch = globalThis.fetch;
function unwrapProxyUrl(u) {
    const m = /^https?:\/\/[^/]+\/(?:\?|raw\?url=|get\?url=|v1\/proxy\?quest=)?(https?(?::|%3A).*)$/i.exec(u);
    if (m) { try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; } }
    return u;
}
globalThis.fetch = async (u, init) => {
    const target = unwrapProxyUrl(String(u));
    let ref; try { ref = new URL(target).origin + '/'; } catch (e) {}
    const headers = Object.assign({ 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8' },
        ref ? { Referer: ref } : {}, (init && init.headers) || {});
    return realFetch(target, Object.assign({}, init, { headers, redirect: 'follow', signal: AbortSignal.timeout(20000) }));
};

const scrapers = await import('../js/scrapers.js');   // en premier : ordre des modules circulaires
const config = await import('../js/config.js');
const utils = await import('../js/utils.js');
const match = await import('../js/match.js');
const sondage = await import('../js/sondage.js');
const { inspectPageContent } = await import('../js/fetcher.js');

const parsers = scrapers.PARSEURS;
const IDS = config.SCRAPERS_CONFIG.map((sc) => sc.id);

let ledger = {};
try { ledger = JSON.parse(fs.readFileSync('data/streams.json', 'utf8')).hostPlay || {}; } catch (e) {}
const court = (e) => String(e && e.message ? e.message : e).split('\n')[0].slice(0, 120);

/* Accueil brut, sans passer par fetchPage : on veut le statut, l'adresse finale et le
   titre même quand la page est une erreur ou un parking — c'est ce qu'on vient voir. */
async function lireAccueil(url) {
    const r = await globalThis.fetch(url);
    const html = await r.text();
    const titre = (/<title[^>]*>([^<]*)<\/title>/i.exec(html) || [])[1] || '';
    return { status: r.status, url: r.url || url, html, titre: titre.trim().slice(0, 80) };
}

/* Lecture d'une source à une adresse : accueil, sous-pages, parseur puis repli générique,
   comme readSourceAt (scrape_streams.mjs). */
async function lireCommeSource(id, adresse, accueil) {
    config.applySourceUrl(id, adresse);
    const sc = config.SCRAPERS_CONFIG.find((s) => s.id === id);
    const pages = config.getSourcePages(sc, null, accueil.html).filter((p) => p.url !== adresse);
    const htmls = sc.homepageHasMatches === false ? [] : [{ url: adresse, html: accueil.html }];
    const echecs = [];
    for (const p of pages) {
        try { htmls.push({ url: p.url, html: await utils.fetchPage(p.url, { force: true, soft404: true }) }); }
        catch (e) { echecs.push(p.url); }
    }
    let liste = [], generique = false;
    for (const p of htmls) {
        const r = scrapers.analyserPageDeListe(parsers[id], p.html, p.url, id);
        if (r.generique) generique = true;
        liste = match.mergeMatches(liste, sondage.matchsDuDomaine(r.liste, new URL(adresse).hostname));
    }
    return { id, adresse, matchs: liste.length, liste, generique, pages: htmls.length, echecs: echecs.length };
}

async function liensDuMatch(m, id, adresseSource) {
    /* ppv, daddylive : les lecteurs viennent avec la grille, et le match pointe vers
       l'adresse de la source, que le script serveur ne relit pas page par page. */
    const deja = scrapers.finalizeStreamLinks(m.streamLinks || []);
    if (m.matchUrl === adresseSource) return deja;
    const html = await utils.fetchPage(m.matchUrl, { force: true });
    const ctx = Object.assign({}, m, { source: id, streamLinks: [] });
    return scrapers.finalizeStreamLinks(deja.concat(scrapers.extractStreamLinks(html, ctx) || []));
}

const bilan = [];
for (const brut of adresses) {
    const url = sondage.normaliserAdresse(brut);
    console.log('\n══ ' + brut + (url && url !== brut ? '  (' + url + ')' : ''));
    if (!url) { console.log('   adresse illisible'); bilan.push({ brut, verdict: 'adresse illisible' }); continue; }

    let accueil;
    try { accueil = await lireAccueil(url); }
    catch (e) { console.log('   injoignable : ' + court(e)); bilan.push({ brut, verdict: 'injoignable' }); continue; }
    const hote = new URL(accueil.url).hostname;
    const canon = config.canonicalOrigin(accueil.html);
    const page = inspectPageContent(accueil.html);
    console.log(`   HTTP ${accueil.status}  ${accueil.url}${accueil.url !== url ? '  (redirigé)' : ''}  ${Math.round(accueil.html.length / 1024)} Ko`);
    if (accueil.titre) console.log('   titre : ' + accueil.titre);
    if (canon && canon !== new URL(accueil.url).origin) console.log('   se déclare sur : ' + canon);
    if (page && page.reason) console.log('   page suspecte : ' + page.reason);

    // Sources candidates : celle demandée, sinon d'après le nom, sinon toutes (accueil seul).
    let candidats = SOURCE ? [SOURCE] : sondage.devinerSources(hote, IDS);
    const connue = config.sourceIdPourHote(hote);
    if (!SOURCE && connue && !candidats.includes(connue)) candidats.unshift(connue);
    const aveugle = !candidats.length;
    if (aveugle) candidats = IDS;

    const lectures = [];
    for (const id of candidats) {
        if (!parsers[id]) { console.log(`   [${id}] source inconnue`); continue; }
        const sc = config.SCRAPERS_CONFIG.find((s) => s.id === id);
        const adresse = sondage.adressePourSource(url, sc.url);
        try {
            const acc = adresse === accueil.url ? accueil : await lireAccueil(adresse);
            // À l'aveugle, on n'ouvre pas les sous-pages de onze sources : l'accueil seul.
            const r = aveugle
                ? (() => { const a = scrapers.analyserPageDeListe(parsers[id], acc.html, adresse, id); const l = sondage.matchsDuDomaine(a.liste, hote); return { id, adresse, matchs: l.length, liste: l, generique: a.generique, pages: 1, echecs: 0 }; })()
                : await lireCommeSource(id, adresse, acc);
            lectures.push(r);
            // À l'aveugle, le repli générique rend la même chose sous chaque nom : une ligne suffit (le bilan « → »).
            if (!aveugle || (r.matchs && !r.generique)) console.log(`   [${id}] ${r.matchs} matchs${r.generique ? ' (repli générique)' : ''} sur ${r.pages} page(s)${r.echecs ? `, ${r.echecs} sous-page(s) en échec` : ''}`);
        } catch (e) { console.log(`   [${id}] ${adresse} : ${court(e)}`); }
    }
    const meilleure = sondage.meilleureLecture(lectures);
    if (!meilleure) {
        // Aucune grille : peut-être un site par chaînes (lecteurs sur l'accueil même).
        const surAccueil = scrapers.finalizeStreamLinks(scrapers.extractStreamLinks(accueil.html, { matchUrl: accueil.url, source: '', streamLinks: [] }) || []);
        console.log(`   → aucune grille de matchs lisible${aveugle ? ' par les parseurs existants' : ''}.`
            + (surAccueil.length >= 3 ? ` ${surAccueil.length} lecteur(s) sur l'accueil : site par chaînes, à écrire comme nouvelle source.` : '')
            + (aveugle ? ' Essayer --source <id> si le site appartient à une source connue.' : ''));
        bilan.push({ brut, verdict: aveugle ? 'inconnu, aucune grille' : 'aucun match', hote });
        continue;
    }
    console.log(aveugle
        ? `   → site inconnu, lisible par le parseur de « ${meilleure.id} »${meilleure.generique ? ' (repli générique)' : ''} : ${meilleure.matchs} matchs. Nouvelle source à déclarer (SCRAPERS_CONFIG), pas un miroir.`
        : `   → se lit comme « ${meilleure.id} » : ${meilleure.matchs} matchs${meilleure.generique ? ' (repli générique : parseur à revoir)' : ''}`);

    // Pages de match : en direct d'abord, puis l'ordre de la grille.
    const choisis = meilleure.liste.filter((m) => m.matchUrl)
        .sort((a, b) => (a.status === 'live' ? 0 : 1) - (b.status === 'live' ? 0 : 1)).slice(0, N_MATCHS);
    let tous = [];
    for (const m of choisis) {
        try {
            const liens = await liensDuMatch(m, meilleure.id, meilleure.adresse);
            tous = tous.concat(liens);
            console.log(`   · ${m.homeTeam} vs ${m.awayTeam} (${m.status || '?'}) — ${liens.length} lien(s)  ${m.matchUrl}`);
            liens.slice(0, 8).forEach((l) => console.log(`       ${l.topLevel ? 'onglet' : 'cadre '}  ${(l.name || '').slice(0, 24).padEnd(24)} ${l.url.slice(0, 110)}`));
            if (liens.length > 8) console.log(`       … ${liens.length - 8} de plus`);
        } catch (e) { console.log(`   · ${m.homeTeam} vs ${m.awayTeam} : page illisible (${court(e)})`); }
    }
    if (tous.length) {
        console.log('   lecteurs par hôte (registre de data/streams.json : lectures/essais) :');
        sondage.resumerLiens(tous, ledger).slice(0, 12).forEach((r) =>
            console.log(`       ${r.hote.padEnd(32)} ${String(r.liens).padStart(3)} lien(s)${r.onglet ? `, ${r.onglet} en onglet` : ''}${r.registre ? `  registre ${r.registre}` : '  inconnu au registre'}`));
    }

    const entree = { brut, verdict: aveugle ? 'nouvelle source ? (' + meilleure.id + ')' : meilleure.id, matchs: meilleure.matchs, liens: tous.length, hote, adresse: meilleure.adresse };
    if (aveugle) {
        // Un site qui n'a pas le nom d'une source n'en devient pas le miroir par hasard de gabarit.
        if (AJOUTER) console.log('   domains.json : rien ajouté, source non reconnue (préciser --source <id> si c\'est bien un miroir)');
    } else if (AJOUTER) {
        const d = JSON.parse(fs.readFileSync('domains.json', 'utf8'));
        const r = sondage.ajouterMiroir(d, meilleure.id, meilleure.adresse, config.SOURCE_MIRRORS[meilleure.id]);
        if (r.ajoute) { fs.writeFileSync('domains.json', JSON.stringify(r.domains, null, 2) + '\n'); console.log(`   domains.json : ${meilleure.adresse} ajouté aux miroirs de ${meilleure.id}`); }
        else console.log(`   domains.json : ${meilleure.adresse} déjà parmi les miroirs de ${meilleure.id}`);
        entree.ajoute = r.ajoute;
    } else {
        console.log(`   pour l'ajouter : node scripts/sonder_domaine.mjs ${brut} --source ${meilleure.id} --ajouter`);
    }
    bilan.push(entree);
}

if (bilan.length > 1) {
    console.log('\n══ Bilan');
    bilan.forEach((b) => console.log(`   ${b.brut.padEnd(28)} ${String(b.verdict).padEnd(24)} ${b.matchs != null ? b.matchs + ' matchs, ' + b.liens + ' liens' : ''}${b.ajoute ? '  (ajouté)' : ''}`));
}
process.exit(0);

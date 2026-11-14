#!/usr/bin/env node
/* Remet chaque équipe de js/teams.js dans sa ligue du moment (14 novembre 2026, « en profiter
   pour mettre à jour ligues et équipes »).

   La base rangeait un club sous la compétition où il avait été ramassé : 92 clubs anglais sous
   « league cup », 126 sous « la liga,copa del rey », 64 sous « dfb pokal », aucun sous
   « premier league » ni « bundesliga ». Favoris groupait donc Arsenal sous « LEAGUE CUP », et
   `leagueFromPairing` (js/db.js) déduisait une coupe de deux clubs d'un même championnat.

   Ce script lit chez ESPN les équipes de chaque championnat de LIGUES (premières divisions,
   puis secondes), retrouve chacune dans la base (par son logo ESPN, sinon par son nom), lui
   donne sa ligue, et ajoute celles qui manquent (promus, expansions). Il ne retire rien et ne
   renomme rien : les alias et les couleurs existants sont gardés. Une ligne non touchée reste
   octet pour octet la même.

   Usage : node scripts/maj_equipes.mjs [--essai]     (--essai : dit ce qui changerait, n'écrit rien)
   À relancer à chaque début de saison. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FICHIER = path.join(racine, 'js', 'teams.js');

/* La ligue telle que l'application la nomme (js/db.js, js/api.js), et son chemin ESPN. L'ordre
   compte : une équipe trouvée dans une ligue n'est plus cherchée dans les suivantes. */
export const LIGUES = [
    ['premier league', 'soccer/eng.1'], ['la liga', 'soccer/esp.1'], ['serie a', 'soccer/ita.1'],
    ['bundesliga', 'soccer/ger.1'], ['ligue 1', 'soccer/fra.1'], ['eredivisie', 'soccer/ned.1'],
    ['primeira liga', 'soccer/por.1'], ['mls', 'soccer/usa.1'], ['saudi pro league', 'soccer/ksa.1'],
    ['nwsl', 'soccer/usa.nwsl'],
    ['championship', 'soccer/eng.2'], ['la liga 2', 'soccer/esp.2'], ['2. bundesliga', 'soccer/ger.2'],
    ['serie b', 'soccer/ita.2'], ['ligue 2', 'soccer/fra.2'],
    ['nhl', 'hockey/nhl'], ['nba', 'basketball/nba'], ['wnba', 'basketball/wnba'],
    ['mlb', 'baseball/mlb'], ['nfl', 'football/nfl'], ['cfl', 'football/cfl']
];

/* Minuscules, sans accent ni ponctuation : la clé de comparaison de deux noms. */
export function cle(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
}

/* Le logo ESPN réduit à ce qui l'identifie : « soccer/359 », « nhl/mtl ». '' pour un autre logo. */
export function idLogo(url) {
    const m = /espncdn\.com\/i\/teamlogos\/([a-z-]+)\/500\/(?:scoreboard\/)?([a-z0-9_-]+)\.png/i.exec(String(url || ''));
    return m ? (m[1] + '/' + m[2]).toLowerCase() : '';
}

/* Une équipe ESPN réduite à ce qu'on en garde. */
export function equipeEspn(t) {
    const logos = (t && t.logos) || [];
    const logo = (logos.find((l) => /\/500\//.test(l.href) && !/dark/.test(l.href)) || logos[0] || {}).href || '';
    const couleurs = [t.color, t.alternateColor].filter((c) => /^[0-9a-f]{6}$/i.test(String(c || ''))).map((c) => '#' + c.toLowerCase());
    return { nom: t.displayName || t.name || '', court: t.shortDisplayName || '', surnom: t.name || '', logo: logo, couleurs: couleurs };
}

/* Applique les listes ESPN à la base. `base` : { clé: entrée } (TEAM_DATA) ; `listes` :
   [{ ligue, equipes: [equipeEspn] }]. Rend { modifiees: { clé: entrée }, ajoutees: { clé: entrée },
   journal: [lignes] } sans toucher à `base`. */
export function fusionner(base, listes) {
    const parLogo = {}, parNom = {}, alias = {};
    Object.keys(base).forEach((k) => {
        const e = base[k];
        const id = idLogo(e.logo);
        if (id && !parLogo[id]) parLogo[id] = k;
        /* Le nom, et le nom sans espace : « Ottawa Redblacks » et « Ottawa Red Blacks ». */
        [k, e.name].forEach((n) => { const c = cle(n); if (c && !parNom[c]) parNom[c] = k; const s = c.replace(/ /g, ''); if (s && !parNom[s]) parNom[s] = k; });
        (e.aliases || []).forEach((a) => { const c = cle(a); if (c) (alias[c] = alias[c] || []).push(k); });
    });
    const modifiees = {}, ajoutees = {}, journal = [], prises = {};
    listes.forEach((liste) => {
        liste.equipes.forEach((q) => {
            /* « TBD Home », « TBD Away » : des cases d'attente d'ESPN, pas des équipes. */
            if (!q.nom || /^TBD\b/i.test(q.nom)) return;
            const id = idLogo(q.logo);
            let k = parNom[cle(q.nom)] || parNom[cle(q.nom).replace(/ /g, '')] || parNom[cle(q.court)] || '';
            /* Par le logo, seulement si un mot du nom le confirme : la base porte des logos faux
               (Panama avait celui de Benevento, relevé le 14 novembre 2026). */
            if (!k && id && parLogo[id]) {
                const e0 = base[parLogo[id]];
                const mots = (s) => cle(s).split(' ').filter((m) => m.length >= 3);
                const connus = [parLogo[id], e0.name].concat(e0.aliases || []).reduce((a, s) => a.concat(mots(s)), []);
                if ([q.nom, q.court, q.surnom].some((s) => mots(s).some((m) => connus.indexOf(m) >= 0))) k = parLogo[id];
                else journal.push('? logo partagé, noms sans rapport : ' + q.nom + ' / ' + e0.name + ' (logo ignoré)');
            }
            /* Par alias, seulement s'il ne désigne qu'une équipe, et du même sport d'après son logo. */
            if (!k) {
                const c = alias[cle(q.nom)] || [];
                if (c.length === 1 && (!idLogo(base[c[0]].logo) || idLogo(base[c[0]].logo).split('/')[0] === id.split('/')[0])) k = c[0];
            }
            if (k && prises[k]) return;               // déjà placée par une ligue précédente
            if (k) {
                prises[k] = true;
                const e = base[k];
                const avant = Array.isArray(e.league) ? e.league.join(',') : e.league;
                const sansLogo = !e.logo || /ui-avatars\.com/.test(e.logo);
                if (avant === liste.ligue && !(sansLogo && q.logo)) return;
                const n = Object.assign({}, e, { league: liste.ligue });
                if (sansLogo && q.logo) n.logo = q.logo;
                modifiees[k] = n;
                if (avant !== liste.ligue) journal.push(e.name + ' : ' + avant + ' → ' + liste.ligue);
                return;
            }
            const nk = q.nom.toLowerCase();
            if (base[nk] || ajoutees[nk]) return;
            /* Alias d'une nouvelle équipe : son nom et son nom court, sans rien prendre à une autre. */
            const noms = [q.nom, q.court].map((x) => String(x || '').toLowerCase()).filter(Boolean);
            const al = [];
            noms.concat(noms.map(cle)).forEach((a) => { if (a && al.indexOf(a) < 0 && !alias[cle(a)] && !(parNom[cle(a)])) al.push(a); });
            ajoutees[nk] = { name: q.nom, league: liste.ligue, colors: q.couleurs.length ? q.couleurs : ['#444444'], logo: q.logo, aliases: al };
            parNom[cle(q.nom)] = nk;
            al.forEach((a) => { alias[cle(a)] = [nk]; });
            journal.push('+ ' + q.nom + ' (' + liste.ligue + ')');
        });
    });
    /* Celles qui portent encore une ligue relue sans figurer dans sa liste n'y sont plus
       (reléguées plus bas que ce qu'on lit) : la ligue leur est retirée. Il leur reste leurs
       autres étiquettes (« copa del rey »), sinon « Autres ». */
    const relues = {};
    listes.forEach((l) => { relues[l.ligue] = true; });
    Object.keys(base).forEach((k) => {
        if (prises[k] || modifiees[k]) return;
        const e = base[k];
        const avant = Array.isArray(e.league) ? e.league : [e.league];
        if (!avant.some((l) => relues[l])) return;
        const reste = avant.filter((l) => !relues[l]);
        modifiees[k] = Object.assign({}, e, { league: reste.length > 1 ? reste : (reste[0] || 'Autres') });
        journal.push('− ' + e.name + ' : ' + avant.join(',') + ' → ' + (reste.join(',') || 'Autres'));
    });
    return { modifiees, ajoutees, journal };
}

/* Réécrit le texte de js/teams.js : les lignes des équipes modifiées, et les nouvelles avant
   l'accolade finale. Les autres lignes ne bougent pas. */
export function reecrire(texte, modifiees, ajoutees) {
    const ligne = (k, e) => "  '" + k.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "': " + JSON.stringify(e) + ',';
    const lignes = texte.split('\n').map((l) => {
        const m = /^  '((?:[^'\\]|\\.)*)': \{/.exec(l);
        if (!m) return l;
        const k = m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
        return modifiees[k] ? ligne(k, modifiees[k]) : l;
    });
    const fin = lignes.lastIndexOf('};');
    if (fin < 0) throw new Error('js/teams.js : accolade finale introuvable');
    let debut = fin;
    while (debut > 0 && !lignes[debut - 1].trim()) debut--;
    const nouvelles = Object.keys(ajoutees).map((k) => ligne(k, ajoutees[k]));
    return lignes.slice(0, debut).concat(nouvelles, lignes.slice(debut)).join('\n');
}

async function principal() {
    const essai = process.argv.includes('--essai');
    const { TEAM_DATA } = await import(FICHIER);
    const listes = [];
    for (const [ligue, chemin] of LIGUES) {
        try {
            const r = await fetch('https://site.api.espn.com/apis/site/v2/sports/' + chemin + '/teams?limit=500', { signal: AbortSignal.timeout(25000) });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const j = await r.json();
            const equipes = (((j.sports || [])[0] || {}).leagues || [])[0].teams.map((x) => equipeEspn(x.team));
            /* Une liste trop courte est une réponse abîmée : on n'y touche pas. */
            if (equipes.length < 8) throw new Error(equipes.length + ' équipes seulement');
            listes.push({ ligue, chemin, equipes });
            console.log(ligue + ' : ' + equipes.length + ' équipes');
        } catch (e) { console.warn('⚠ ' + ligue + ' (' + chemin + ') : ' + (e && e.message ? e.message : e) + ' — ligue laissée telle quelle'); }
    }
    if (!listes.length) { console.error('Aucune ligue lue : rien n\'est écrit.'); process.exit(1); }
    const { modifiees, ajoutees, journal } = fusionner(TEAM_DATA, listes);
    journal.forEach((l) => console.log('  ' + l));
    console.log(Object.keys(modifiees).length + ' équipes modifiées, ' + Object.keys(ajoutees).length + ' ajoutées.');
    if (essai) return;
    fs.writeFileSync(FICHIER, reecrire(fs.readFileSync(FICHIER, 'utf8'), modifiees, ajoutees));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await principal();

/* La page Favoris, pour s'y retrouver (14 novembre 2026, « faire page favori pour meilleure
   navigation »).

   Avant : deux listes sans rapport, côte à côte — toutes les équipes de toutes les ligues à
   la file (plus de 800 lignes), et toutes les ligues de tous les sports. Maintenant, comme
   les Réglages : une colonne de rubriques (« Mes favoris », puis un sport par ligne), et à
   droite les ligues du sport choisi, chacune avec ses réglages et ses équipes dessous.

   Ici, ce qui se calcule sans la page : le modèle (sports → ligues → équipes) et la
   recherche d'une équipe. Le rendu est dans js/main.js (`renderFavPage`). Sans import. */

/* `o` : { ligues: [clés, dans l'ordre choisi], equipes: [{ name, league }], sportDe(ligue),
   niveauDe(ligue), sports: [noms, dans l'ordre du Live], favoris: { nom: 1 } }.
   Rend { favoris: [noms], sports: [{ nom, favoris, ligues: [{ cle, niveau, equipes: [noms], favoris }] }] }.
   Une ligue qui n'est dans aucune liste mais qui porte des équipes est gardée, à la fin de
   son sport ; un sport sans ligue n'apparaît pas. */
export function modeleFavoris(o) {
    var x = o || {};
    var favoris = x.favoris || {};
    var parLigue = {}, ordre = [];
    (x.ligues || []).forEach(function(l) { var k = String(l || '').toUpperCase(); if (k && !parLigue[k]) { parLigue[k] = {}; ordre.push(k); } });
    (x.equipes || []).forEach(function(e) {
        if (!e || !e.name) return;
        var k = String(e.league || 'AUTRES').toUpperCase();
        if (!parLigue[k]) { parLigue[k] = {}; ordre.push(k); }
        parLigue[k][e.name] = true;
    });
    var trier = function(noms) { return noms.sort(function(a, b) { return a.localeCompare(b); }); };
    var parSport = {};
    ordre.forEach(function(k) {
        var sp = x.sportDe ? x.sportDe(k) : 'Sport';
        var equipes = trier(Object.keys(parLigue[k]));
        (parSport[sp] = parSport[sp] || []).push({
            cle: k, niveau: x.niveauDe ? x.niveauDe(k) : 'main', equipes: equipes,
            favoris: equipes.filter(function(n) { return favoris[n] === 1; }).length
        });
    });
    var noms = (x.sports || []).filter(function(s) { return parSport[s]; });
    Object.keys(parSport).forEach(function(s) { if (noms.indexOf(s) < 0) noms.push(s); });
    return {
        favoris: trier(Object.keys(favoris).filter(function(n) { return favoris[n] === 1; })),
        sports: noms.map(function(s) {
            return { nom: s, ligues: parSport[s], favoris: parSport[s].reduce(function(t, l) { return t + l.favoris; }, 0) };
        })
    };
}

/* Les équipes dont le nom ou un alias contient la recherche : [{ nom, ligue, sport }], une
   fois chacune (sa première ligue), dans l'ordre des sports. `norm` : normName de js/db.js ;
   `aliasDe(nom)` : ses alias, en une chaîne. Rien pour une recherche vide. */
export function chercherEquipes(modele, q, norm, aliasDe, max) {
    var n = norm || function(s) { return String(s || '').toLowerCase(); };
    var cherche = n(q);
    if (!cherche) return [];
    var vus = {}, sortie = [];
    ((modele && modele.sports) || []).forEach(function(sp) {
        sp.ligues.forEach(function(l) {
            l.equipes.forEach(function(nom) {
                if (vus[nom]) return;
                var foin = n(nom) + ' ' + String(aliasDe ? aliasDe(nom) : '').toLowerCase();
                if (foin.indexOf(cherche) < 0) return;
                vus[nom] = true;
                sortie.push({ nom: nom, ligue: l.cle, sport: sp.nom });
            });
        });
    });
    return sortie.slice(0, max || 60);
}

/* Les équipes d'une ligue sont-elles montrées d'office ? Celles d'une ligue principale, tant
   que la liste reste lisible ; le choix de l'utilisateur (`choix` : true = repliée,
   false = dépliée) l'emporte. */
export var EQUIPES_MAX_OUVERTES = 40;
export function liguesOuverte(ligue, choix) {
    if (choix === true) return false;
    if (choix === false) return true;
    return !!ligue && ligue.niveau === 'main' && ligue.equipes.length > 0 && ligue.equipes.length <= EQUIPES_MAX_OUVERTES;
}

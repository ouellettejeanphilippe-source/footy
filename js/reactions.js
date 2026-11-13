/* Les réactions des gens pendant un match (13 novembre 2026, « avoir un genre Twitter en direct,
   les commentaires des gens »).

   X refuse d'être encadré (`X-Frame-Options`, comme sa recherche) et ses widgets n'ont pas de
   recherche : rien ne peut s'afficher DANS la page. Ce qui marche : la recherche en direct de X
   (`f=live`, les plus récents d'abord), déjà remplie avec les équipes du match, dans une fenêtre
   étroite posée contre le bord droit de l'écran. Elle porte la session X du navigateur : connecté
   d'avance, on lit tout et on peut répondre.

   Ordinateur seulement : sur téléphone et dans l'APK, `window.open` ne pose pas de fenêtre à côté.

   Module sans import : `js/ui.js` (la fiche) et `js/multiview.js` (la barre du lecteur) le câblent. */

export var LARGEUR_REACTIONS = 440;
export var NOM_FENETRE_REACTIONS = 'footy_reactions_x';

/* Le second « nom » d'une course ou d'une séance n'est pas une équipe (`Race`, `FP1`, `Qualifying`). */
function estSeance(nom) {
    return /^(race|fp\d?|qual|sprint|practice)/i.test(nom);
}

function propre(nom) {
    return String(nom == null ? '' : nom).replace(/["“”«»]/g, ' ').replace(/\s+/g, ' ').trim();
}

/* Les noms à chercher : les deux équipes, ou le seul nom d'un événement (course, gala). */
export function equipesAChercher(m) {
    if (!m) return [];
    var dom = propre(m.homeTeam), vis = propre(m.awayTeam);
    var noms = [];
    if (dom) noms.push(dom);
    if (vis && !estSeance(vis) && vis.toLowerCase() !== dom.toLowerCase()) noms.push(vis);
    return noms;
}

/* La requête : chaque nom entre guillemets, l'un OU l'autre (un message ne cite souvent
   qu'une des deux équipes). Vide quand le match n'a pas de nom. */
export function requeteReactions(m, fiches) {
    var termes = equipesAChercher(m).map(function(n) { return '"' + n + '"'; });
    /* « Y a des hashtags généralement sur X et Bluesky » (13 novembre 2026) : le mot-clic de chaque
       équipe (#Canadiens, #MapleLeafs) s'ajoute aux noms, X comprend `OR`. */
    (fiches || []).forEach(function(f) { var t = motCliqueDEquipe(f); if (t && termes.indexOf(t) < 0) termes.push(t); });
    return termes.join(' OR ');
}

/* Le mot-clic d'un nom : « Maple Leafs » → #MapleLeafs. '' pour un nom trop court ou sans lettre. */
export function motCliqueDeNom(nom) {
    var s = String(nom == null ? '' : nom).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '');
    return s.length >= 3 && /[A-Za-z]/.test(s) ? '#' + s : '';
}
/* Le mot-clic d'une équipe : celui de son surnom, sinon de son nom. */
export function motCliqueDEquipe(fiche) {
    var f = fiche || {};
    return motCliqueDeNom(f.surnom) || motCliqueDeNom(f.nom);
}

/* L'adresse de la recherche en direct de X, ou '' sans requête. */
export function adresseReactionsX(m, fiches) {
    var q = requeteReactions(m, fiches);
    return q ? 'https://x.com/search?q=' + encodeURIComponent(q) + '&f=live' : '';
}

/* Les `features` de `window.open` : une colonne contre le bord droit de l'écran, sur toute sa
   hauteur. Sans mesures d'écran, une fenêtre de la même largeur que le navigateur place. */
export function optionsFenetreReactions(ecran) {
    var e = ecran || {};
    var l = Number(e.availWidth), h = Number(e.availHeight);
    if (!(l > 0) || !(h > 0)) return 'popup=yes,width=' + LARGEUR_REACTIONS + ',height=800';
    var largeur = Math.min(LARGEUR_REACTIONS, l);
    var gauche = (Number(e.availLeft) || 0) + l - largeur;
    return 'popup=yes,left=' + gauche + ',top=' + (Number(e.availTop) || 0)
        + ',width=' + largeur + ',height=' + h;
}

/* Une fenêtre à côté n'a de sens que sur un ordinateur (souris, pas l'APK ni la télé). */
export function reactionsPossibles(w) {
    if (!w || typeof w.open !== 'function') return false;
    if (w.__ANDROID_TV__ || w.Capacitor) return false;
    try { return !!(w.matchMedia && w.matchMedia('(any-hover: hover) and (any-pointer: fine)').matches); } catch (e) { return false; }
}

/* Ouvre (ou réutilise, par son nom) la fenêtre des réactions du match. Rend 'ouverte',
   'bloquee' (le navigateur a refusé la fenêtre) ou 'rien' (match sans nom). */
export function ouvrirReactionsX(m, w, fiches) {
    var adresse = adresseReactionsX(m, fiches);
    if (!adresse || !w || typeof w.open !== 'function') return 'rien';
    var f = null;
    try { f = w.open(adresse, NOM_FENETRE_REACTIONS, optionsFenetreReactions(w.screen)); } catch (e) { f = null; }
    if (!f) return 'bloquee';
    try { f.focus(); } catch (e) {}
    return 'ouverte';
}

/* ── Le fil en direct (13 novembre 2026, « j'aimerais fil en direct ») ─────────────────────────
   Mesuré hors de l'application le 13 novembre 2026 : la recherche publique de Bluesky
   (`api.bsky.app/xrpc/app.bsky.feed.searchPosts`, sans compte, `Access-Control-Allow-Origin: *`)
   répond au navigateur, environ un message par minute pour une équipe de la LNH qui joue ;
   `public.api.bsky.app` refuse (403), Reddit aussi (403 sans compte), X n'a pas d'accès gratuit.
   La recherche ne comprend pas `OR` (les deux mots sont exigés) : une requête par équipe, sur son
   surnom (« Canadiens », « Stars »), puis un tri de pertinence, parce qu'un surnom est souvent
   un mot courant. */

export var API_BLUESKY = 'https://api.bsky.app/xrpc/app.bsky.feed.searchPosts';
export var INTERVALLE_FIL_MS = 20000;
export var FIL_MAX = 80;

export function sansAccent(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/* Ce qu'on cherche pour une équipe : son surnom quand la base en a un, sinon son nom entier
   entre guillemets. `fiche` : { nom, surnom, ville, alias }. */
export function termeDeRecherche(fiche) {
    var f = fiche || {};
    var surnom = propre(f.surnom), nom = propre(f.nom);
    if (surnom) return surnom;
    return nom ? '"' + nom + '"' : '';
}

/* Les mots qui désignent une équipe dans un message : surnom, ville, alias, nom entier. */
export function jetonsDEquipe(fiche, sansVille) {
    var f = fiche || {}, vus = {}, liste = [];
    /* `sansVille` : pour reconnaître un mot-clic d'équipe. #Philadelphia ou #Montreal parlent de
       la ville, pas du match (mesuré : #philadelphia ramenait de l'immobilier). */
    [f.surnom, sansVille ? '' : f.ville, f.nom].concat(f.alias || []).forEach(function(x) {
        var j = sansAccent(propre(x));
        if (j.length >= 3 && !vus[j]) { vus[j] = 1; liste.push(j); }
    });
    return liste;
}

function echappeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function citeLUn(texte, jetons) {
    return jetons.some(function(j) { return new RegExp('(^|[^a-z0-9])' + echappeRegex(j) + '([^a-z0-9]|$)').test(texte); });
}
function motCliqueDe(texte, jetons) {
    var tags = texte.match(/#[a-z0-9_]+/g) || [];
    return tags.some(function(t) { return jetons.some(function(j) { return j.length >= 4 && t.indexOf(j.replace(/\s+/g, '')) > 0; }); });
}

/* Un message parle-t-il du match ? Oui s'il cite les DEUX équipes, ou porte un mot-clic d'une
   des deux (#Habs, #GoHabsGo), ou cite une équipe et la ligue. Un événement à un seul nom
   (course, gala) n'a pas de tri : la requête est déjà son nom entier. */
export function estPertinent(texte, jetonsDom, jetonsVis, ligue, tagsDom, tagsVis) {
    var dom = jetonsDom || [], vis = jetonsVis || [];
    if (!dom.length || !vis.length) return true;
    var t = sansAccent(texte);
    var d = citeLUn(t, dom), v = citeLUn(t, vis);
    if (d && v) return true;
    if (motCliqueDe(t, tagsDom || dom) || motCliqueDe(t, tagsVis || vis)) return true;
    var l = sansAccent(propre(ligue));
    return !!((d || v) && l.length >= 3 && citeLUn(t, [l]));
}

/* Les mots-clics que les gens mettent vraiment (mesuré le 13 novembre 2026, Canadiens–Bruins :
   #GoHabsGo 62 messages à l'heure, #Habs 26, #Canadiens 13) ne se devinent pas d'un nom : on les
   apprend des messages reçus. Rend les `max` mots-clics les plus fréquents qui contiennent un mot
   de l'équipe (#GoHabsGo contient « habs »), vus au moins deux fois, sans ceux de `connus`. */
export function motsCliquesFrequents(posts, jetons, max, connus, jetonsAdverses) {
    var compte = {}, deja = {};
    (connus || []).forEach(function(c) { deja[sansAccent(c)] = 1; });
    (posts || []).forEach(function(p) {
        var vus = {};
        var texte = sansAccent(p && p.texte);
        /* Appris seulement d'un message qui cite aussi l'adversaire : #NYJets contient « jets »
           mais ne se trouve jamais à côté des Stars. */
        if (jetonsAdverses && jetonsAdverses.length && !citeLUn(texte, jetonsAdverses) && !motCliqueDe(texte, jetonsAdverses)) return;
        (texte.match(/#[a-z0-9_]+/g) || []).forEach(function(t) {
            if (vus[t] || deja[t] || t.length > 30) return;
            vus[t] = 1;
            if (!(jetons || []).some(function(j) { return j.length >= 4 && t.indexOf(j.replace(/\s+/g, '')) > 0; })) return;
            compte[t] = (compte[t] || 0) + 1;
        });
    });
    return Object.keys(compte).filter(function(t) { return compte[t] >= 2; })
        .sort(function(a, b) { return compte[b] - compte[a] || (a < b ? -1 : 1); })
        .slice(0, max || 2);
}

export function adresseBluesky(terme, limite) {
    return terme ? API_BLUESKY + '?q=' + encodeURIComponent(terme) + '&sort=latest&limit=' + (limite || 40) : '';
}

/* La réponse de Bluesky en messages { id, auteur, pseudo, texte, date }. Un message étiqueté
   par la modération (contenu sensible) ou sans texte n'est pas gardé. */
export function lireBluesky(json) {
    var posts = json && Array.isArray(json.posts) ? json.posts : [];
    var liste = [];
    posts.forEach(function(p) {
        if (!p || typeof p.uri !== 'string' || !p.record || typeof p.record.text !== 'string') return;
        var texte = p.record.text.replace(/\s+/g, ' ').trim();
        if (!texte) return;
        if ((Array.isArray(p.labels) && p.labels.length) || (p.author && Array.isArray(p.author.labels) && p.author.labels.length)) return;
        var date = Date.parse(p.record.createdAt || p.indexedAt || '');
        if (!isFinite(date)) return;
        var a = p.author || {};
        liste.push({ id: p.uri, auteur: propre(a.displayName) || propre(a.handle) || 'Anonyme', pseudo: propre(a.handle), texte: texte.slice(0, 600), date: date });
    });
    return liste;
}

/* Le fil : sans doublon, les plus récents d'abord, `max` messages au plus. Un message daté
   du futur (horloge de l'auteur) est ramené à maintenant, sinon il resterait en tête. */
export function fusionnerFil(actuel, nouveaux, max, maintenant) {
    var vus = {}, liste = [];
    (nouveaux || []).concat(actuel || []).forEach(function(p) {
        if (!p || vus[p.id]) return;
        vus[p.id] = 1;
        liste.push(maintenant && p.date > maintenant ? Object.assign({}, p, { date: maintenant }) : p);
    });
    liste.sort(function(a, b) { return b.date - a.date; });
    return liste.slice(0, max || FIL_MAX);
}

export function ageCourt(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return 'à l\'instant';
    if (s < 3600) return Math.floor(s / 60) + ' min';
    if (s < 86400) return Math.floor(s / 3600) + ' h';
    return Math.floor(s / 86400) + ' j';
}

/* Le fil en HTML : du texte seulement, ni lien ni image (rien ne part vers un autre site). */
export function filHtml(posts, esc, maintenant) {
    if (!posts || !posts.length) return '<div class="fil-vide">Personne n\'en parle pour l\'instant. Le fil se remplit tout seul.</div>';
    return posts.map(function(p) {
        return '<div class="fil-msg"><div class="fil-tete"><span class="fil-auteur">' + esc(p.auteur) + '</span>'
            + '<span class="fil-age">' + esc(ageCourt(maintenant - p.date)) + '</span></div>'
            + '<div class="fil-texte">' + esc(p.texte) + '</div></div>';
    }).join('');
}

/* Les termes cherchés pour une équipe : son surnom, son mot-clic, et les mots-clics appris des
   messages précédents (`appris`, deux au plus). */
export function termesDEquipe(fiche, appris) {
    var liste = [], vus = {};
    [termeDeRecherche(fiche), motCliqueDEquipe(fiche)].concat((appris || []).slice(0, 2)).forEach(function(t) {
        var k = sansAccent(t);
        if (t && !vus[k]) { vus[k] = 1; liste.push(t); }
    });
    return liste;
}

/* Lit le fil d'un match : pour chaque équipe, une requête par terme (`termesDEquipe`), en
   parallèle ; une qui échoue n'empêche pas les autres. Rend { posts, erreur, motsCliques, termes } :
   `erreur` seulement quand AUCUNE requête n'a répondu ; `motsCliques` = par équipe, ceux appris
   de cette lecture, à repasser en `appris` à la suivante. */
export function chargerFil(fiches, ligue, lire, appris) {
    var liste = (fiches || []).filter(function(f) { return termeDeRecherche(f); });
    if (!liste.length || typeof lire !== 'function') return Promise.resolve({ posts: [], erreur: true, motsCliques: [], termes: [] });
    var jetons = liste.map(function(f) { return jetonsDEquipe(f); });
    var tags = liste.map(function(f) { return jetonsDEquipe(f, true); });
    var deux = liste.length >= 2;
    var termes = [];
    liste.forEach(function(f, i) {
        (deux ? termesDEquipe(f, appris && appris[i]) : [termeDeRecherche(f)]).forEach(function(t) { if (termes.indexOf(t) < 0) termes.push(t); });
    });
    return Promise.all(termes.map(function(t) {
        return Promise.resolve().then(function() { return lire(adresseBluesky(t), { signal: AbortSignal.timeout(8000) }); })
            .then(function(r) { if (!r || !r.ok) throw new Error('refus'); return r.json(); })
            .then(lireBluesky)
            .catch(function() { return null; });
    })).then(function(reponses) {
        var recus = reponses.filter(Boolean);
        var posts = [].concat.apply([], recus).filter(function(p) {
            return !deux || estPertinent(p.texte, jetons[0], jetons[1], ligue, tags[0], tags[1]);
        });
        posts = fusionnerFil([], posts);
        return { posts: posts, erreur: !recus.length, termes: termes,
            motsCliques: deux ? liste.map(function(f, i) { return motsCliquesFrequents(posts, tags[i], 2, [motCliqueDEquipe(f)], jetons[1 - i]); }) : [] };
    });
}

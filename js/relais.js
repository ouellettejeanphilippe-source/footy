/* Relais pour les sites qui refusent les centres de données.

   OnHockey répond 403 à tout le script serveur depuis le 9 septembre 2026 au moins :
   chaque passage du cache porte « https://onhockey.tv/ -> direct: HTTP 403 », zéro
   match. Ce n'est ni l'agent ni le Referer : la même requête Node, mêmes en-têtes,
   rend 200 depuis une autre adresse (vérifié le 12 octobre 2026). C'est Cloudflare qui
   refuse les adresses des machines de GitHub Actions. Depuis un navigateur, l'accès
   direct est de toute façon fermé (CORS) et Jina, sans Referer, ne reçoit que « You
   are not allowed to access this page directly » de `schedule_table.php`.

   Le lecteur de Jina accepte un Referer (`X-Referer`, permis au pré-vol CORS) et
   sort par ses propres adresses : la grille revient entière. Mais seulement en
   Markdown : en HTML, il ne rend que le premier `<script>` de ce fragment de page sans
   `<html>` (948 octets sur 15 Ko). On demande donc le Markdown et on le remet dans la
   forme que lit `parseOnHockey` (js/scrapers.js) : une `tbody` par ligue, une
   `tr.game` par match, ses lecteurs dans `.gamelinks`. Mesuré le 12 octobre : 24
   matchs, les mêmes que par l'accès direct, avec les mêmes lecteurs.

   Le relais ne passe qu'APRÈS l'accès direct : si GitHub redevient le bienvenu, rien
   ne change. Module sans import, utilisé par `fetchPage` (js/utils.js, via le
   transport Jina de js/fetcher.js) et par le `fetch` du script serveur. */

var JINA = 'https://r.jina.ai/';

function hoteDe(url) {
    var m = /^https?:\/\/([^\/?#:]+)/i.exec(String(url || ''));
    return m ? m[1].toLowerCase().replace(/^www\./, '') : '';
}

function origineDe(url) {
    var m = /^(https?:\/\/[^\/?#]+)/i.exec(String(url || ''));
    return m ? m[1] : '';
}

function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* Le corps utile d'une réponse Markdown de Jina : après « Markdown Content: ». Une
   erreur de Jina est du JSON (`{"code":422,…}`) : on la refuse, pour que l'appelant
   compte un échec plutôt qu'une grille vide. */
export function corpsMarkdownJina(texte) {
    var s = String(texte || '');
    var d = s.trim();
    if (d.charAt(0) === '{' && /"(code|status)"\s*:\s*\d/.test(d.slice(0, 200))) throw new Error('jina : ' + d.slice(0, 80));
    var i = s.indexOf('Markdown Content:');
    return i >= 0 ? s.slice(i + 'Markdown Content:'.length) : s;
}

var LIEN_MD = /\[([^\]]*)\]\((\S+?)(?:\s+"([^"]*)")?\)/g;

/* Une ligne de Markdown en HTML : liens en `<a>`, le reste en texte (« French: »
   devant un lien est la catégorie que lit `parseOnHockey`). */
function ligneEnHtml(ligne) {
    var sortie = '', dernier = 0, m;
    LIEN_MD.lastIndex = 0;
    while ((m = LIEN_MD.exec(ligne))) {
        if (m.index > dernier) sortie += esc(ligne.slice(dernier, m.index));
        sortie += '<a href="' + esc(m[2]) + '"' + (m[3] ? ' title="' + esc(m[3]) + '"' : '') + '>' + esc(m[1]) + '</a>';
        dernier = m.index + m[0].length;
    }
    if (dernier < ligne.length) sortie += esc(ligne.slice(dernier));
    return sortie;
}

/* La grille d'OnHockey (schedule_table.php) rendue en Markdown par Jina :

       **QMJHL**[standings](https://onhockey.tv/standings_lr.php?channel=Canada/QMJHL)
       18:00 Drummondville - Saint John
       [mtchor](https://onhockey.tv/np_stream400.php?channel=//…)[mtchor](…)
       23:00 Ottawa - New Jersey Devils
        live stream will be available closer to the game time

   remise en HTML de la même forme que l'original. Une page qui n'est pas la grille
   (l'accueil, un refus) revient en `<pre>` : lisible, sans match. */
export function grilleOnHockeyDepuisMarkdown(texte) {
    var lignes = corpsMarkdownJina(texte).split(/\r?\n/);
    var ligues = [], ligue = null, jeu = null;
    function nouvelleLigue(nom) { ligue = { nom: nom, jeux: [] }; ligues.push(ligue); }
    lignes.forEach(function(brute) {
        var ligne = brute.replace(/\s+$/, '');
        if (!ligne.trim()) return;
        var tete = /^\s*\*\*(.+?)\*\*/.exec(ligne);
        if (tete) { nouvelleLigue(tete[1].trim()); jeu = null; return; }
        var heure = /^\s*(\d{1,2}):(\d{2})\s+(.+)$/.exec(ligne);
        if (heure) {
            if (!ligue) nouvelleLigue('Hockey');
            jeu = { h: heure[1], mn: heure[2], equipes: heure[3].trim(), notes: [], liens: [] };
            ligue.jeux.push(jeu);
            return;
        }
        if (!jeu) return;
        LIEN_MD.lastIndex = 0;
        if (LIEN_MD.test(ligne)) jeu.liens.push(ligneEnHtml(ligne.trim()));
        else jeu.notes.push(esc(ligne.trim()));
    });
    var jeux = ligues.reduce(function(n, l) { return n + l.jeux.length; }, 0);
    if (!jeux) return '<html><body><pre>' + esc(lignes.join('\n')) + '</pre></body></html>';
    var html = "<table id='gametable'>";
    ligues.forEach(function(l) {
        if (!l.jeux.length) return;
        html += '<tbody><tr><td></td><td><b>' + esc(l.nom) + '</b></td><td></td></tr>';
        l.jeux.forEach(function(j) {
            html += "<tr class='game'><td><text class='game_hour'>" + esc(j.h) + '</text>:' + esc(j.mn) + '</td><td>'
                + esc(j.equipes) + (j.notes.length ? ' ' + j.notes.join(' ') : '')
                + "<div class='gamelinks'>" + j.liens.join('\n') + '</div></td><td></td></tr>';
        });
        html += '</tbody>';
    });
    return html + '</table>';
}

/* Hôte → conversion du Markdown. Un hôte n'y entre que s'il refuse le serveur ET que
   sa page passe par Jina avec le Referer de son propre site. */
var HOTES_RELAYES = {
    'onhockey.tv': grilleOnHockeyDepuisMarkdown
};

/* La requête de relais pour `url`, ou null si son hôte n'en a pas. */
export function relaisPour(url) {
    var convertir = HOTES_RELAYES[hoteDe(url)];
    if (!convertir) return null;
    return {
        url: JINA + url,
        headers: { 'X-Return-Format': 'markdown', 'X-Referer': origineDe(url) + '/' },
        convertir: convertir
    };
}

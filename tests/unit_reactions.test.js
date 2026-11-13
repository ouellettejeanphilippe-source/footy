/* « Avoir un genre Twitter en direct, les commentaires des gens » (13 novembre 2026, js/reactions.js) :
   la recherche en direct de X sur les équipes du match, dans une fenêtre à côté. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const racine = path.join(__dirname, '..');
let R;
test.before(async () => { R = await import(path.join(racine, 'js', 'reactions.js')); });

test('la requête cite les deux équipes, l\'une OU l\'autre', () => {
  const m = { homeTeam: 'Montreal Canadiens', awayTeam: 'Boston Bruins' };
  assert.strictEqual(R.requeteReactions(m), '"Montreal Canadiens" OR "Boston Bruins"');
});

test('une course ou une séance n\'a qu\'un nom ; un match sans nom n\'a pas de requête', () => {
  assert.strictEqual(R.requeteReactions({ homeTeam: 'Las Vegas Grand Prix', awayTeam: 'Race' }), '"Las Vegas Grand Prix"');
  assert.strictEqual(R.requeteReactions({ homeTeam: 'Las Vegas Grand Prix', awayTeam: 'FP2' }), '"Las Vegas Grand Prix"');
  assert.strictEqual(R.requeteReactions({ homeTeam: 'WWE Raw', awayTeam: '' }), '"WWE Raw"');
  assert.strictEqual(R.requeteReactions({ homeTeam: 'UFC 300', awayTeam: 'ufc 300' }), '"UFC 300"', 'pas deux fois le même nom');
  assert.strictEqual(R.requeteReactions({}), '');
  assert.strictEqual(R.requeteReactions(null), '');
  assert.strictEqual(R.adresseReactionsX(null), '');
});

test('l\'adresse est la recherche en direct de x.com, requête encodée ; un guillemet du nom ne casse rien', () => {
  const a = R.adresseReactionsX({ homeTeam: 'Paris Saint-Germain', awayTeam: 'Olympique "OM" & Marseille' });
  const u = new URL(a);
  assert.strictEqual(u.origin, 'https://x.com');
  assert.strictEqual(u.pathname, '/search');
  assert.strictEqual(u.searchParams.get('f'), 'live', 'les plus récents d\'abord');
  assert.strictEqual(u.searchParams.get('q'), '"Paris Saint-Germain" OR "Olympique OM & Marseille"');
  assert.strictEqual(Array.from(u.searchParams.keys()).length, 2, 'le & du nom ne crée pas de paramètre');
});

test('la fenêtre est une colonne contre le bord droit de l\'écran', () => {
  assert.strictEqual(R.optionsFenetreReactions({ availLeft: 0, availTop: 25, availWidth: 1920, availHeight: 1055 }),
    'popup=yes,left=1480,top=25,width=440,height=1055');
  assert.strictEqual(R.optionsFenetreReactions({ availLeft: 1920, availTop: 0, availWidth: 2560, availHeight: 1440 }),
    'popup=yes,left=4040,top=0,width=440,height=1440', 'second écran : ses coordonnées');
  assert.strictEqual(R.optionsFenetreReactions(null), 'popup=yes,width=440,height=800');
  assert.match(R.optionsFenetreReactions({ availWidth: 360, availHeight: 700 }), /left=0,.*width=360/);
});

test('ordinateur seulement : ni APK, ni télé, ni écran tactile sans souris', () => {
  const souris = { open() {}, matchMedia: () => ({ matches: true }) };
  assert.strictEqual(R.reactionsPossibles(souris), true);
  assert.strictEqual(R.reactionsPossibles(Object.assign({}, souris, { Capacitor: {} })), false);
  assert.strictEqual(R.reactionsPossibles(Object.assign({}, souris, { __ANDROID_TV__: true })), false);
  assert.strictEqual(R.reactionsPossibles({ open() {}, matchMedia: () => ({ matches: false }) }), false);
  assert.strictEqual(R.reactionsPossibles(null), false);
});

test('ouvrirReactionsX : une fenêtre nommée, réutilisée ; un refus du navigateur est dit', () => {
  const appels = [];
  let focus = 0;
  const w = { screen: { availLeft: 0, availTop: 0, availWidth: 1000, availHeight: 600 },
    open(...a) { appels.push(a); return { focus() { focus++; } }; } };
  const m = { homeTeam: 'Arsenal', awayTeam: 'Chelsea' };
  assert.strictEqual(R.ouvrirReactionsX(m, w), 'ouverte');
  assert.deepStrictEqual(appels[0], [R.adresseReactionsX(m), R.NOM_FENETRE_REACTIONS, 'popup=yes,left=560,top=0,width=440,height=600']);
  assert.strictEqual(focus, 1);
  assert.strictEqual(R.ouvrirReactionsX(m, { open: () => null }), 'bloquee');
  assert.strictEqual(R.ouvrirReactionsX(m, { open: () => { throw new Error('refus'); } }), 'bloquee');
  assert.strictEqual(R.ouvrirReactionsX({}, w), 'rien');
  assert.strictEqual(appels.length, 1, 'rien d\'ouvert pour un match sans nom');
});

test('branchement : module sans import, précaché, bouton dans la barre du lecteur', () => {
  const src = fs.readFileSync(path.join(racine, 'js', 'reactions.js'), 'utf8');
  assert.ok(!/^\s*import\s/m.test(src), 'sans import');
  assert.ok(fs.readFileSync(path.join(racine, 'sw.js'), 'utf8').includes("'./js/reactions.js'"), 'dans APP_SHELL');
  const mv = fs.readFileSync(path.join(racine, 'js', 'multiview.js'), 'utf8');
  assert.ok(mv.includes('id="mv-bar-reactions"') && mv.includes('window.reactionsDuLecteur = reactionsDuLecteur'));
});

/* ── Le fil en direct (« j'aimerais fil en direct ») : Bluesky, une requête par équipe. ── */
const habs = { nom: 'Montreal Canadiens', surnom: 'Canadiens', ville: 'Montreal', alias: ['habs', 'mtl', 'mc'] };
const bruins = { nom: 'Boston Bruins', surnom: 'Bruins', ville: 'Boston', alias: ['bos'] };
const post = (uri, texte, date, plus) => Object.assign({ uri, record: { text: texte, createdAt: new Date(date).toISOString() }, author: { handle: 'a.bsky.social', displayName: 'Alex' } }, plus || {});

test('le terme cherché est le surnom, sinon le nom entier entre guillemets', () => {
  assert.strictEqual(R.termeDeRecherche(habs), 'Canadiens');
  assert.strictEqual(R.termeDeRecherche({ nom: 'Las Vegas Grand Prix' }), '"Las Vegas Grand Prix"');
  assert.strictEqual(R.termeDeRecherche({}), '');
  const u = new URL(R.adresseBluesky('Canadiens'));
  assert.strictEqual(u.origin + u.pathname, R.API_BLUESKY);
  assert.strictEqual(u.searchParams.get('q'), 'Canadiens');
  assert.strictEqual(u.searchParams.get('sort'), 'latest');
});

test('estPertinent : les deux équipes, ou un mot-clic d\'équipe, ou une équipe et la ligue', () => {
  const d = R.jetonsDEquipe(habs), v = R.jetonsDEquipe(bruins);
  assert.ok(d.includes('habs') && d.includes('montreal') && !d.includes('mc'), 'alias de deux lettres écarté');
  assert.strictEqual(R.estPertinent('Bruins were starting to swarm but the Habs get out of it', d, v, 'NHL'), true);
  assert.strictEqual(R.estPertinent('Incredible first period from Fowler #gohabsgo', d, v, 'NHL'), true);
  assert.strictEqual(R.estPertinent('Quel match des Canadiens ce soir en NHL', d, v, 'NHL'), true);
  assert.strictEqual(R.estPertinent('Les Canadiens paient trop d\'impôts', d, v, 'NHL'), false, 'un surnom est aussi un mot courant');
  assert.strictEqual(R.estPertinent('Montréal sous la neige', d, v, 'NHL'), false);
  assert.strictEqual(R.estPertinent('Bruinsmania', d, v, 'NHL'), false, 'mot entier seulement');
  assert.strictEqual(R.estPertinent('n\'importe quoi', d, [], 'F1'), true, 'un seul nom : pas de tri');
});

test('lireBluesky : texte aplati, messages étiquetés, vides ou sans date écartés', () => {
  const liste = R.lireBluesky({ posts: [
    post('at://1', 'But  de\nSuzuki !', 1000),
    post('at://2', 'contenu sensible', 2000, { labels: [{ val: 'porn' }] }),
    post('at://3', '   ', 3000),
    { uri: 'at://4', record: { text: 'sans date' } },
    post('at://5', 'auteur étiqueté', 5000, { author: { handle: 'x', labels: [{ val: 'spam' }] } }),
    null
  ] });
  assert.deepStrictEqual(liste, [{ id: 'at://1', auteur: 'Alex', pseudo: 'a.bsky.social', texte: 'But de Suzuki !', date: 1000 }]);
  assert.deepStrictEqual(R.lireBluesky(null), []);
  assert.deepStrictEqual(R.lireBluesky({ posts: 'non' }), []);
});

test('fusionnerFil : sans doublon, récents d\'abord, borné, le futur ramené à maintenant', () => {
  const a = { id: 'a', date: 100 }, b = { id: 'b', date: 300 }, c = { id: 'c', date: 200 }, futur = { id: 'f', date: 9999 };
  assert.deepStrictEqual(R.fusionnerFil([a, b], [c, b]).map((p) => p.id), ['b', 'c', 'a']);
  assert.deepStrictEqual(R.fusionnerFil([a, b], [c], 2).map((p) => p.id), ['b', 'c']);
  assert.strictEqual(R.fusionnerFil([a], [futur], 10, 500)[0].date, 500);
});

test('filHtml : du texte échappé, ni lien ni image ; l\'âge en clair', () => {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = R.filHtml([{ id: '1', auteur: '<b>Al</b>', texte: 'voir https://x.test <img src=x onerror=1>', date: 0 }], esc, 125000);
  assert.ok(!/<a\b|<img\b|<b>/.test(html), html);
  assert.ok(html.includes('2 min') && html.includes('&lt;img'));
  assert.match(R.filHtml([], esc, 0), /fil-vide/);
  assert.strictEqual(R.ageCourt(5000), 'à l\'instant');
  assert.strictEqual(R.ageCourt(2 * 3600e3), '2 h');
});

test('chargerFil : le surnom et le mot-clic de chaque équipe, tri de pertinence, une panne partielle ne vide pas le fil', async () => {
  const demandes = [];
  const lire = (u) => {
    const q = new URL(u).searchParams.get('q');
    demandes.push(q);
    if (q === 'Bruins') return Promise.reject(new Error('panne'));
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ posts: [
      post('at://1', 'Habs 2, Bruins 0', 2000), post('at://2', 'Les Canadiens votent', 3000), post('at://3', '#GoHabsGo', 1000)] }) });
  };
  const r = await R.chargerFil([habs, bruins], 'NHL', lire);
  assert.deepStrictEqual(demandes.sort(), ['#Bruins', '#Canadiens', 'Bruins', 'Canadiens'], 'le surnom et le mot-clic de chaque équipe');
  assert.deepStrictEqual(r.termes, ['Canadiens', '#Canadiens', 'Bruins', '#Bruins']);
  assert.deepStrictEqual(r.posts.map((p) => p.id), ['at://1', 'at://3']);
  assert.strictEqual(r.erreur, false);
  const tout = await R.chargerFil([habs, bruins], 'NHL', () => Promise.resolve({ ok: false }));
  assert.deepStrictEqual([tout.posts, tout.erreur], [[], true]);
  const course = await R.chargerFil([{ nom: 'Las Vegas Grand Prix' }], 'F1', () => Promise.resolve({ ok: true, json: () => Promise.resolve({ posts: [post('at://9', 'Quel départ', 1)] }) }));
  assert.strictEqual(course.posts.length, 1, 'un seul nom : tout est gardé');
});

test('le panneau du lecteur : stats relues chaque minute, barre arrêtée au bord du panneau', () => {
  const mv = fs.readFileSync(path.join(racine, 'js', 'multiview.js'), 'utf8');
  assert.match(mv, /INTERVALLE_STATS_MS = 60000/);
  assert.ok(!/setInterval\(updateGmCurrentTab, 300000\)/.test(mv));
  assert.match(fs.readFileSync(path.join(racine, 'js', 'config.js'), 'utf8'), /\}, 60000\)\);/);
  assert.match(fs.readFileSync(path.join(racine, 'styles.css'), 'utf8'), /mv-panneau[^{]*#mv-toolbar \{ right: 350px; \}/);
});

/* ── « Y a des hashtags généralement sur X et Bluesky » : chercher par mots-clics. ── */
test('le mot-clic d\'une équipe vient de son surnom ; X le reçoit en plus des noms', () => {
  assert.strictEqual(R.motCliqueDeNom('Maple Leafs'), '#MapleLeafs');
  assert.strictEqual(R.motCliqueDeNom('Montréal'), '#Montreal');
  assert.strictEqual(R.motCliqueDeNom('76ers'), '#76ers');
  assert.strictEqual(R.motCliqueDeNom('FC'), '', 'trop court');
  assert.strictEqual(R.motCliqueDeNom('1904'), '', 'un mot-clic sans lettre n\'en est pas un');
  assert.strictEqual(R.motCliqueDEquipe({ nom: 'Arsenal' }), '#Arsenal');
  const m = { homeTeam: 'Montreal Canadiens', awayTeam: 'Toronto Maple Leafs' };
  const leafs = { nom: 'Toronto Maple Leafs', surnom: 'Maple Leafs', ville: 'Toronto', alias: ['leafs'] };
  assert.strictEqual(R.requeteReactions(m, [habs, leafs]), '"Montreal Canadiens" OR "Toronto Maple Leafs" OR #Canadiens OR #MapleLeafs');
  assert.strictEqual(new URL(R.adresseReactionsX(m, [habs, leafs])).searchParams.get('q'), R.requeteReactions(m, [habs, leafs]));
  assert.strictEqual(R.requeteReactions(m), '"Montreal Canadiens" OR "Toronto Maple Leafs"', 'sans fiche : les noms seuls');
});

test('les mots-clics des partisans s\'apprennent des messages, pas d\'un nom', () => {
  const tags = R.jetonsDEquipe(habs, true), bru = R.jetonsDEquipe(bruins);
  const p = (texte) => ({ texte });
  const posts = [p('But ! #GoHabsGo contre les Bruins'), p('#gohabsgo #Habs 2 #Bruins 0'), p('#Habs mènent, Bruins dominés'),
    p('#GoHabsGo sans adversaire cité'), p('#HabsFans Bruins, vu une fois'), p('#Montreal Bruins'), p('#Montreal encore, Bruins')];
  assert.deepStrictEqual(R.motsCliquesFrequents(posts, tags, 2, ['#Canadiens'], bru), ['#gohabsgo', '#habs']);
  assert.deepStrictEqual(R.motsCliquesFrequents(posts, tags, 2, ['#Canadiens', '#GoHabsGo'], bru), ['#habs'], 'les connus ne reviennent pas');
  assert.deepStrictEqual(R.motsCliquesFrequents([p('#NYJets gagnent'), p('#nyjets encore')], ['jets'], 2, [], ['stars']), [], 'jamais à côté de l\'adversaire : une autre équipe');
  assert.ok(!tags.includes('montreal') && R.jetonsDEquipe(habs).includes('montreal'), 'la ville cite l\'équipe, mais #Montreal n\'est pas son mot-clic');
  assert.strictEqual(R.estPertinent('Immobilier à vendre #Montreal', R.jetonsDEquipe(habs), bru, 'NHL', tags, R.jetonsDEquipe(bruins, true)), false);
  assert.deepStrictEqual(R.termesDEquipe(habs, ['#gohabsgo', '#habs', '#troisieme']), ['Canadiens', '#Canadiens', '#gohabsgo', '#habs'], 'deux appris au plus');
  assert.deepStrictEqual(R.termesDEquipe({ nom: 'Arsenal', surnom: 'Arsenal' }, ['#arsenal']), ['Arsenal', '#Arsenal'], 'sans doublon, casse ignorée');
});

test('chargerFil repasse les mots-clics appris à la lecture suivante', async () => {
  const demandes = [];
  const lire = (u) => { const q = new URL(u).searchParams.get('q'); demandes.push(q);
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ posts: q === 'Canadiens' ? [post('at://1', '#GoHabsGo Bruins menés', 2000), post('at://2', 'Bruins battus #gohabsgo', 3000)] : [] }) }); };
  const r = await R.chargerFil([habs, bruins], 'NHL', lire);
  assert.deepStrictEqual(r.motsCliques, [['#gohabsgo'], []]);
  demandes.length = 0;
  await R.chargerFil([habs, bruins], 'NHL', lire, r.motsCliques);
  assert.ok(demandes.includes('#gohabsgo'), demandes.join(' '));
  assert.strictEqual(demandes.length, 5);
});

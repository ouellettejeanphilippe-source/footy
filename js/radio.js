/* La radio d'un match (31 octobre 2026).

   « Pour chaque match, un lien vers une station TuneIn, iHeartRadio et cie qui le diffuse ? »

   CE QUI EST SÛR, ET CE QUI NE L'EST PAS. Aucune source ouverte ne dit « cette station
   diffuse ce match » : ESPN ne donne presque jamais la radio (un seul diffuseur de type
   « Radio » national sur une cinquantaine de matchs lus), TuneIn et iHeartRadio n'ont pas
   d'API de programmation. Ce module ne prétend donc que ce qu'il a vérifié, et le dit :
   - STATIONS_TUNEIN : la station TuneIn propre à une équipe. Relevé exact le 31 octobre
     2026 (recherche `opml.radiotime.com`, puis fiche de chaque station) : les 32 équipes de
     la LNH ont la leur (« Live stream every … game »), une station par équipe, qui diffuse
     ses matchs ; la NBA, la NFL, la MLB et la MLS n'en ont aucune (relevé fait, rien trouvé).
   - RADIOS_OFFICIELLES : les stations officielles d'une équipe connues d'ailleurs que de
     TuneIn (la fiche TuneIn existe, la station est vérifiée vivante ; qu'elle diffuse les
     matchs de l'équipe vient de ce que l'équipe publie, pas d'une donnée lisible ici).
   - Pour tous les autres matchs : une RECHERCHE TuneIn et iHeartRadio par équipe, étiquetée
     « chercher », jamais « diffuse ».

   Pour ajouter une équipe : vérifier la station (`https://opml.radiotime.com/Describe.ashx?
   render=json&id=<id>`), l'inscrire ici, et compléter tests/unit_radio.test.js.

   SANS IMPORT : lu par js/ui.js (fiche du match). */

/* Nom d'équipe → identifiant de la station TuneIn de l'équipe (`guide_id`). */
export var STATIONS_TUNEIN = {
  'anaheim ducks': 's137347',
  'boston bruins': 's137387',
  'buffalo sabres': 's137345',
  'calgary flames': 's149880',
  'carolina hurricanes': 's149882',
  'chicago blackhawks': 's137388',
  'colorado avalanche': 's149866',
  'columbus blue jackets': 's149869',
  'dallas stars': 's149881',
  'detroit red wings': 's137351',
  'edmonton oilers': 's149877',
  'florida panthers': 's149873',
  'los angeles kings': 's137394',
  'minnesota wild': 's149867',
  'montreal canadiens': 's137385',
  'nashville predators': 's137348',
  'new jersey devils': 's149887',
  'new york islanders': 's149875',
  'new york rangers': 's137341',
  'ottawa senators': 's149879',
  'philadelphia flyers': 's137344',
  'pittsburgh penguins': 's137342',
  'san jose sharks': 's137393',
  'seattle kraken': 's310026',
  'st louis blues': 's149872',
  'tampa bay lightning': 's137343',
  'toronto maple leafs': 's149876',
  'utah mammoth': 's137352',
  'vancouver canucks': 's137392',
  'vegas golden knights': 's296301',
  'washington capitals': 's137340',
  'winnipeg jets': 's257147'
};

/* Stations officielles connues par ailleurs, en plus de celle de l'équipe. */
export var RADIOS_OFFICIELLES = {
  'montreal canadiens': [
    { nom: 'TSN 690 (anglais)', tunein: 's12472' },
    { nom: '98,5 FM (français)', tunein: 's12468' }
  ]
};

/* « St. Louis Blues » et « St Louis Blues » sont la même clé ; les accents tombent. */
export function cleEquipe(nom) {
  return String(nom == null ? '' : nom).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

/* La page d'une station TuneIn ; TuneIn complète lui-même le nom dans l'adresse. */
export function lienStationTuneIn(id) { return 'https://tunein.com/radio/' + encodeURIComponent(id) + '/'; }
export function rechercheTuneIn(q) { return 'https://tunein.com/search/?query=' + encodeURIComponent(q); }
export function rechercheIHeart(q) { return 'https://www.iheart.com/search/?q=' + encodeURIComponent(q); }

/* Les stations connues d'une équipe : [{ nom, url, source }], la station de l'équipe
   d'abord, ses stations officielles ensuite, sans doublon d'identifiant. */
export function stationsDeLEquipe(nomEquipe) {
  var cle = cleEquipe(nomEquipe);
  var vues = {}, liste = [];
  function ajouter(nom, id) {
    if (!id || vues[id]) return;
    vues[id] = true;
    liste.push({ nom: nom, url: lienStationTuneIn(id), source: 'TuneIn' });
  }
  if (STATIONS_TUNEIN[cle]) ajouter('Station de l’équipe', STATIONS_TUNEIN[cle]);
  (RADIOS_OFFICIELLES[cle] || []).forEach(function(s) { ajouter(s.nom, s.tunein); });
  return liste;
}

/* Ce que la fiche montre pour un match :
   { equipes: [{ equipe, stations: [...], recherches: [{ source, url }] }, ...] }
   Une entrée par équipe (domicile puis visiteur), jamais deux fois la même. Les
   recherches y sont toujours : c'est ce qui donne un lien à CHAQUE match. */
export function radiosDuMatch(m) {
  var noms = [m && m.homeTeam, m && m.awayTeam].filter(function(n) { return n && String(n).trim(); });
  var vus = {};
  var equipes = [];
  noms.forEach(function(nom) {
    var cle = cleEquipe(nom);
    if (!cle || vus[cle]) return;
    vus[cle] = true;
    equipes.push({
      equipe: String(nom),
      stations: stationsDeLEquipe(nom),
      recherches: [
        { source: 'TuneIn', url: rechercheTuneIn(nom) },
        { source: 'iHeartRadio', url: rechercheIHeart(nom) }
      ]
    });
  });
  return { equipes: equipes };
}

function lien(url, texte, classe, ico) {
  return '<a class="' + classe + '" href="' + url + '" target="_blank" rel="noopener noreferrer">' + (ico || '') + '<span>' + texte + '</span></a>';
}

/* Le HTML de la section « Radio » de la fiche. `esc` échappe le texte ; `icone`
   rend un tracé (js/icones.js). '' quand le match n'a aucune équipe. */
export function radioHtml(r, esc, icone) {
  if (!r || !r.equipes || !r.equipes.length) return '';
  var ico = icone ? icone('radio') : '';
  var out = '<div class="fiche-radio-tete">' + ico + '<span class="fiche-radio-titre">Radio</span></div>';
  var avecStation = r.equipes.some(function(e) { return e.stations.length; });
  r.equipes.forEach(function(e) {
    out += '<div class="fiche-radio-ligne"><span class="fiche-radio-equipe">' + esc(e.equipe) + '</span><span class="fiche-radio-liens">';
    e.stations.forEach(function(s) {
      out += lien(esc(s.url), esc(s.nom) + ' · ' + esc(s.source), 'radio-station', ico);
    });
    e.recherches.forEach(function(s) {
      out += lien(esc(s.url), 'Chercher sur ' + esc(s.source), 'radio-recherche', '');
    });
    out += '</span></div>';
  });
  out += '<div class="fiche-radio-note">' + (avecStation
    ? 'Les stations ci-dessus sont celles des équipes ; « Chercher » ouvre une recherche, sans garantie que la station diffuse ce match.'
    : 'Aucune station d’équipe connue pour ce match : « Chercher » ouvre une recherche par équipe, sans garantie qu’une station le diffuse.') + '</div>';
  return out;
}

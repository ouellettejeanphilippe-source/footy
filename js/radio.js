/* La radio d'un match (31 octobre 2026).

   « Pour chaque match, un lien vers une station TuneIn, iHeartRadio et cie qui le diffuse ? »,
   puis « Tu peux intégrer d'autres radios oui, cherche qui fait quoi ».

   CE QUI EST SÛR, ET CE QUI NE L'EST PAS. Aucune source ouverte ne dit « cette station
   diffuse ce match » : ESPN ne donne presque jamais la radio (un seul diffuseur « Radio »
   national sur une cinquantaine de matchs lus), TuneIn et iHeartRadio n'ont pas d'API de
   programmation. Ce module n'affirme donc que des stations d'ÉQUIPE, et le dit :
   - STATIONS_TUNEIN : la station TuneIn propre à une équipe de la LNH (relevé exact, 32 sur
     32 : « Live stream every … game »).
   - RADIOS_EQUIPES : les stations officielles d'une équipe (NFL, LCF, NBA, MLB, MLS, NWSL,
     LHJMQ, Canadiens), d'après les pages des équipes, des ligues et des stations, relevées
     le 31 octobre 2026. Une station n'y est inscrite que si l'annuaire de TuneIn et/ou
     d'iHeartRadio la connaît avec le MÊME indicatif ET la MÊME fréquence (STATIONS). Le
     registre ne garde que ce que les deux annuaires confirment : Sportsnet 590 (Blue Jays,
     Raptors), WTMJ, WBAL, KZNS, etc. n'y sont pas, faute de lien vérifiable.
   - RADIOS_LIGUES : un diffuseur de championnat (talkSPORT pour la Premier League : une
     partie des matchs seulement ; la BBC n'a pas de station chez TuneIn et se limite au
     Royaume-Uni en ligne).
   - Pour tous les matchs : une RECHERCHE TuneIn et iHeartRadio par équipe, étiquetée
     « Chercher », jamais « diffuse ».
   Les accords de diffusion changent chaque saison : une station qui change de propriétaire
   reste ici jusqu'à ce que quelqu'un la corrige (tests/unit_radio.test.js garde le registre
   cohérent ; la liste des lignes écartées est au WORKLOG).

   Pour ajouter une équipe : vérifier la station (TuneIn : `https://opml.radiotime.com/
   Describe.ashx?render=json&id=<id>` ; iHeartRadio : `https://us.api.iheart.com/api/v2/
   content/liveStations?callLetters=<indicatif>`, ou `ca.api` pour le Canada), l'inscrire
   dans STATIONS puis dans RADIOS_EQUIPES, et compléter le test.

   SANS IMPORT : lu par js/ui.js (fiche du match). */

/* LNH : nom d'équipe normalisé → identifiant de la station TuneIn de l'équipe (`guide_id`). */
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

/* Registre des stations (clé : indicatif + fréquence), vérifiées le 31 octobre 2026 chez TuneIn
   (`guide_id`) et/ou iHeartRadio (`id`) : indicatif ET fréquence concordent. */
export var STATIONS = {
  kmvp987: { nom: 'Arizona Sports 98.7', ind: 'KMVP', freq: '98.7', lang: 'en', tunein: null, iheart: 11724 },
  wzgc929: { nom: '92.9 The Game', ind: 'WZGC', freq: '92.9', lang: 'en', tunein: null, iheart: 10795 },
  wiyy979: { nom: '98 Rock', ind: 'WIYY', freq: '97.9', lang: 'en', tunein: 's29726', iheart: null },
  wgrf969: { nom: '97 Rock', ind: 'WGRF', freq: '96.9', lang: 'en', tunein: 's29132', iheart: 5355 },
  wrfx997: { nom: '99.7 The Fox', ind: 'WRFX', freq: '99.7', lang: 'en', tunein: null, iheart: 1613 },
  wmvp1000: { nom: 'ESPN 1000', ind: 'WMVP', freq: '1000', lang: 'en', tunein: null, iheart: 7907 },
  wviv935: { nom: 'Latino Mix 93.5', ind: 'WVIV', freq: '93.5', lang: 'es', tunein: null, iheart: 5183 },
  wlw700: { nom: 'WLW 700', ind: 'WLW', freq: '700', lang: 'en', tunein: null, iheart: 1713 },
  webn1027: { nom: '102.7 WEBN', ind: 'WEBN', freq: '102.7', lang: 'en', tunein: null, iheart: 1701 },
  wcky1530: { nom: 'ESPN 1530', ind: 'WCKY', freq: '1530', lang: 'en', tunein: null, iheart: 1697 },
  wkrk923: { nom: '92.3 The Fan', ind: 'WKRK', freq: '92.3', lang: 'en', tunein: null, iheart: 10821 },
  wncx985: { nom: '98.5 WNCX', ind: 'WNCX', freq: '98.5', lang: 'en', tunein: null, iheart: 10855 },
  krld1053: { nom: '105.3 The Fan', ind: 'KRLD', freq: '105.3', lang: 'en', tunein: null, iheart: 10840 },
  koa850: { nom: 'KOA 850', ind: 'KOA', freq: '850', lang: 'en', tunein: null, iheart: 389 },
  wxyt971: { nom: '97.1 The Ticket', ind: 'WXYT', freq: '97.1', lang: 'en', tunein: null, iheart: 10827 },
  writ957: { nom: '95.7 BIG FM', ind: 'WRIT', freq: '95.7', lang: 'en', tunein: null, iheart: 2689 },
  kilt1003: { nom: '100.3 The Bull', ind: 'KILT', freq: '100.3', lang: 'en', tunein: null, iheart: 10861 },
  klol1011: { nom: 'Mega 101', ind: 'KLOL', freq: '101.1', lang: 'es', tunein: null, iheart: 10878 },
  wlhk971: { nom: 'Hank FM 97.1', ind: 'WLHK', freq: '97.1', lang: 'en', tunein: 's28558', iheart: 6058 },
  komp923: { nom: 'KOMP 92.3', ind: 'KOMP', freq: '92.3', lang: 'en', tunein: 's34516', iheart: 11813 },
  krlv920: { nom: 'Raider Nation Radio 920', ind: 'KRLV', freq: '920', lang: 'en', tunein: 's31612', iheart: 11833 },
  keno1460: { nom: 'Deportes Vegas 1460', ind: 'KENO', freq: '1460', lang: 'es', tunein: 's32481', iheart: 11815 },
  kfi640: { nom: 'KFI 640', ind: 'KFI', freq: '640', lang: 'en', tunein: null, iheart: 177 },
  kspn710: { nom: 'ESPN LA 710', ind: 'KSPN', freq: '710', lang: 'en', tunein: 's32301', iheart: 7906 },
  kwkw1330: { nom: 'Tu Liga Radio 1330', ind: 'KWKW', freq: '1330', lang: 'es', tunein: 's26289', iheart: 11798 },
  wbgg1059: { nom: 'Big 105.9', ind: 'WBGG', freq: '105.9', lang: 'en', tunein: null, iheart: 557 },
  winz940: { nom: 'Fox Sports 940', ind: 'WINZ', freq: '940', lang: 'en', tunein: null, iheart: 565 },
  kfxn1003: { nom: 'KFAN 100.3', ind: 'KFXN', freq: '100.3', lang: 'en', tunein: null, iheart: 1209 },
  wbz985: { nom: '98.5 The Sports Hub', ind: 'WBZ', freq: '98.5', lang: 'en', tunein: 's27533', iheart: 8808 },
  wwl870: { nom: 'WWL 870', ind: 'WWL', freq: '870', lang: 'en', tunein: 's23790', iheart: 10981 },
  wfan660: { nom: 'WFAN 660', ind: 'WFAN', freq: '660', lang: 'en', tunein: null, iheart: 10930 },
  wado1280: { nom: 'WADO 1280', ind: 'WADO', freq: '1280', lang: 'es', tunein: null, iheart: 5172 },
  waxq1043: { nom: 'Q104.3', ind: 'WAXQ', freq: '104.3', lang: 'en', tunein: null, iheart: 1465 },
  wip941: { nom: '94 WIP', ind: 'WIP', freq: '94.1', lang: 'en', tunein: null, iheart: 10934 },
  wdve1025: { nom: '102.5 WDVE', ind: 'WDVE', freq: '102.5', lang: 'en', tunein: null, iheart: 2017 },
  wbgg970: { nom: 'Fox Sports 970', ind: 'WBGG', freq: '970', lang: 'en', tunein: null, iheart: 2013 },
  knbr680: { nom: 'KNBR 680', ind: 'KNBR', freq: '680', lang: 'en', tunein: null, iheart: 5530 },
  ksan1077: { nom: '107.7 The Bone', ind: 'KSAN', freq: '107.7', lang: 'en', tunein: null, iheart: 5529 },
  kiro710: { nom: 'Seattle Sports 710', ind: 'KIRO', freq: '710', lang: 'en', tunein: null, iheart: 11726 },
  kiro973: { nom: 'KIRO 97.3', ind: 'KIRO', freq: '97.3', lang: 'en', tunein: null, iheart: 11719 },
  wxtb979: { nom: '98 Rock', ind: 'WXTB', freq: '97.9', lang: 'en', tunein: null, iheart: 697 },
  wgfx1045: { nom: '104.5 The Zone', ind: 'WGFX', freq: '104.5', lang: 'en', tunein: null, iheart: 5453 },
  wbig1003: { nom: 'BIG 100', ind: 'WBIG', freq: '100.3', lang: 'en', tunein: null, iheart: 2505 },
  cknw730: { nom: '730 CKNW', ind: 'CKNW', freq: '730', lang: 'en', tunein: null, iheart: 10319 },
  chqr770: { nom: 'QR Calgary 770', ind: 'CHQR', freq: '770', lang: 'en', tunein: 's31172', iheart: 10296 },
  ched880: { nom: '880 CHED', ind: 'CHED', freq: '880', lang: 'en', tunein: 's11767', iheart: 10316 },
  ckrm620: { nom: '620 CKRM', ind: 'CKRM', freq: '620', lang: 'en', tunein: 's31244', iheart: null },
  cjob680: { nom: '680 CJOB', ind: 'CJOB', freq: '680', lang: 'en', tunein: 's31221', iheart: 10299 },
  cfgo1200: { nom: 'TSN 1200', ind: 'CFGO', freq: '1200', lang: 'en', tunein: 's12321', iheart: 7503 },
  ckgm690: { nom: 'TSN 690', ind: 'CKGM', freq: '690', lang: 'en', tunein: 's12472', iheart: 7450 },
  cjpx995: { nom: '99,5 Montréal', ind: 'CJPX', freq: '99.5', lang: 'fr', tunein: 's43899', iheart: null },
  wfnz927: { nom: '92.7 WFNZ', ind: 'WFNZ', freq: '92.7', lang: 'en', tunein: null, iheart: 6742 },
  wscr670: { nom: '670 The Score', ind: 'WSCR', freq: '670', lang: 'en', tunein: null, iheart: 10835 },
  wtam1100: { nom: 'WTAM 1100', ind: 'WTAM', freq: '1100', lang: 'en', tunein: null, iheart: 1749 },
  wmms1007: { nom: '100.7 WMMS', ind: 'WMMS', freq: '100.7', lang: 'en', tunein: null, iheart: 1741 },
  kgmz957: { nom: '95.7 The Game', ind: 'KGMZ', freq: '95.7', lang: 'en', tunein: null, iheart: 11116 },
  kbme790: { nom: 'SportsTalk 790', ind: 'KBME', freq: '790', lang: 'en', tunein: null, iheart: 2257 },
  klac570: { nom: '570 KLAC', ind: 'KLAC', freq: '570', lang: 'en', tunein: null, iheart: 189 },
  wmfs929: { nom: 'ESPN 92.9', ind: 'WMFS', freq: '92.9', lang: 'en', tunein: null, iheart: 10914 },
  wcco830: { nom: 'WCCO 830', ind: 'WCCO', freq: '830', lang: 'en', tunein: 's27781', iheart: 10946 },
  whsq880: { nom: 'ESPN 880', ind: 'WHSQ', freq: '880', lang: 'en', tunein: null, iheart: 7905 },
  wwls981: { nom: '98.1 The Sports Animal', ind: 'WWLS', freq: '98.1', lang: 'en', tunein: null, iheart: 5511 },
  wpen975: { nom: '97.5 The Fanatic', ind: 'WPEN', freq: '97.5', lang: 'en', tunein: null, iheart: 5295 },
  kpoj620: { nom: 'Rip City Radio 620', ind: 'KPOJ', freq: '620', lang: 'en', tunein: null, iheart: 1965 },
  woai1200: { nom: 'WOAI 1200', ind: 'WOAI', freq: '1200', lang: 'en', tunein: null, iheart: 2361 },
  chum1050: { nom: 'TSN 1050', ind: 'CHUM', freq: '1050', lang: 'en', tunein: null, iheart: 7495 },
  wjfk1067: { nom: '106.7 The Fan', ind: 'WJFK', freq: '106.7', lang: 'en', tunein: null, iheart: 11153 },
  kste650: { nom: 'Talk 650', ind: 'KSTE', freq: '650', lang: 'en', tunein: null, iheart: 229 },
  wcnn680: { nom: '680 The Fan', ind: 'WCNN', freq: '680', lang: 'en', tunein: 's27965', iheart: null },
  weei937: { nom: 'WEEI 93.7', ind: 'WEEI', freq: '93.7', lang: 'en', tunein: null, iheart: 10790 },
  klaa830: { nom: 'AM 830 KLAA', ind: 'KLAA', freq: '830', lang: 'en', tunein: 's34679', iheart: null },
  ktnq1020: { nom: '1020 KTNQ', ind: 'KTNQ', freq: '1020', lang: 'es', tunein: null, iheart: 5268 },
  kdka1020: { nom: 'KDKA 1020', ind: 'KDKA', freq: '1020', lang: 'en', tunein: 's32311', iheart: 11003 },
  kwfn973: { nom: '97.3 The Fan', ind: 'KWFN', freq: '97.3', lang: 'en', tunein: 's26670', iheart: 11112 },
  kmox1120: { nom: 'KMOX 1120', ind: 'KMOX', freq: '1120', lang: 'en', tunein: null, iheart: 11121 },
  wls890: { nom: 'WLS 890', ind: 'WLS', freq: '890', lang: 'en', tunein: 's30777', iheart: 5366 },
  wxzx1057: { nom: 'Alternative 105.7', ind: 'WXZX', freq: '105.7', lang: 'en', tunein: null, iheart: 2946 },
  kfwb980: { nom: 'La Mera Mera 980', ind: 'KFWB', freq: '980', lang: 'es', tunein: 's32744', iheart: 11795 },
  wzrm977: { nom: 'Rumba 97.7', ind: 'WZRM', freq: '97.7', lang: 'es', tunein: null, iheart: 7731 },
  ksl1160: { nom: 'KSL 1160', ind: 'KSL', freq: '1160', lang: 'en', tunein: null, iheart: 11706 },
  ksfo810: { nom: '810 KSFO', ind: 'KSFO', freq: '810', lang: 'en', tunein: null, iheart: 5343 },
  kzsf1370: { nom: 'La Kaliente 1370', ind: 'KZSF', freq: '1370', lang: 'es', tunein: 's26855', iheart: null },
  kjr950: { nom: 'SportsRadio 950 KJR', ind: 'KJR', freq: '950', lang: 'en', tunein: null, iheart: 2565 },
  whb810: { nom: 'Sports Radio 810 WHB', ind: 'WHB', freq: '810', lang: 'en', tunein: 's29237', iheart: null },
  kgb760: { nom: 'San Diego Sports 760', ind: 'KGB', freq: '760', lang: 'en', tunein: null, iheart: 8528 },
  chmp985: { nom: '98,5 FM', ind: 'CHMP', freq: '98.5', lang: 'fr', tunein: 's12468', iheart: null },
  chlc971: { nom: 'CHLC 97,1', ind: 'CHLC', freq: '97.1', lang: 'fr', tunein: 's24768', iheart: null },
  cfyx933: { nom: 'FM 93', ind: 'CFYX', freq: '93.3', lang: 'fr', tunein: 's108556', iheart: null },
  chun983: { nom: 'CHUN-FM 98,3', ind: 'CHUN', freq: '98.3', lang: 'fr', tunein: 's95721', iheart: null },
  cjcb1270: { nom: 'CJCB 1270', ind: 'CJCB', freq: '1270', lang: 'en', tunein: 's12207', iheart: null }
};

/* Équipe (nom normalisé par `cleEquipe`) → clés de STATIONS, la station phare d'abord. */
export var RADIOS_EQUIPES = {
  'arizona cardinals': ['kmvp987'],
  'atlanta falcons': ['wzgc929'],
  'baltimore ravens': ['wiyy979'],
  'buffalo bills': ['wgrf969'],
  'carolina panthers': ['wrfx997'],
  'chicago bears': ['wmvp1000', 'wviv935'],
  'cincinnati bengals': ['wlw700', 'webn1027', 'wcky1530'],
  'cleveland browns': ['wkrk923', 'wncx985'],
  'dallas cowboys': ['krld1053'],
  'denver broncos': ['koa850'],
  'detroit lions': ['wxyt971'],
  'green bay packers': ['writ957'],
  'houston texans': ['kilt1003', 'klol1011'],
  'indianapolis colts': ['wlhk971'],
  'las vegas raiders': ['komp923', 'krlv920', 'keno1460'],
  'los angeles chargers': ['kfi640'],
  'los angeles rams': ['kspn710', 'kwkw1330'],
  'miami dolphins': ['wbgg1059', 'winz940'],
  'minnesota vikings': ['kfxn1003'],
  'new england patriots': ['wbz985'],
  'new orleans saints': ['wwl870'],
  'new york giants': ['wfan660', 'wado1280'],
  'new york jets': ['waxq1043'],
  'philadelphia eagles': ['wip941'],
  'pittsburgh steelers': ['wdve1025', 'wbgg970'],
  'san francisco 49ers': ['knbr680', 'ksan1077'],
  'seattle seahawks': ['kiro710', 'kiro973'],
  'tampa bay buccaneers': ['wxtb979'],
  'tennessee titans': ['wgfx1045'],
  'washington commanders': ['wbig1003'],
  'bc lions': ['cknw730'],
  'calgary stampeders': ['chqr770'],
  'edmonton elks': ['ched880'],
  'saskatchewan roughriders': ['ckrm620'],
  'winnipeg blue bombers': ['cjob680'],
  'ottawa redblacks': ['cfgo1200'],
  'montreal alouettes': ['ckgm690', 'cjpx995'],
  'atlanta hawks': ['wzgc929'],
  'boston celtics': ['wbz985'],
  'brooklyn nets': ['wfan660'],
  'charlotte hornets': ['wfnz927'],
  'chicago bulls': ['wscr670'],
  'cleveland cavaliers': ['wtam1100', 'wmms1007'],
  'dallas mavericks': ['krld1053'],
  'detroit pistons': ['wxyt971'],
  'golden state warriors': ['kgmz957'],
  'houston rockets': ['kbme790'],
  'la clippers': ['klac570', 'kwkw1330'],
  'los angeles lakers': ['kspn710'],
  'memphis grizzlies': ['wmfs929'],
  'minnesota timberwolves': ['wcco830'],
  'new orleans pelicans': ['wwl870'],
  'new york knicks': ['whsq880'],
  'oklahoma city thunder': ['wwls981'],
  'philadelphia 76ers': ['wpen975'],
  'phoenix suns': ['kmvp987'],
  'portland trail blazers': ['kpoj620'],
  'san antonio spurs': ['woai1200'],
  'toronto raptors': ['chum1050'],
  'washington wizards': ['wjfk1067'],
  'arizona diamondbacks': ['kmvp987'],
  'athletics': ['kste650'],
  'atlanta braves': ['wcnn680'],
  'baltimore orioles': ['wiyy979'],
  'boston red sox': ['weei937'],
  'chicago cubs': ['wscr670'],
  'chicago white sox': ['wmvp1000'],
  'cincinnati reds': ['wlw700'],
  'cleveland guardians': ['wtam1100'],
  'colorado rockies': ['koa850'],
  'detroit tigers': ['wxyt971'],
  'houston astros': ['kbme790'],
  'los angeles angels': ['klaa830'],
  'los angeles dodgers': ['klac570', 'ktnq1020'],
  'minnesota twins': ['wcco830'],
  'new york yankees': ['wfan660', 'wado1280'],
  'philadelphia phillies': ['wip941'],
  'pittsburgh pirates': ['kdka1020'],
  'san diego padres': ['kwfn973'],
  'san francisco giants': ['knbr680'],
  'seattle mariners': ['kiro710'],
  'st louis cardinals': ['kmox1120'],
  'texas rangers': ['krld1053'],
  'washington nationals': ['wjfk1067'],
  'atlanta united fc': ['wzgc929'],
  'charlotte fc': ['wfnz927'],
  'chicago fire fc': ['wls890'],
  'columbus crew': ['wxzx1057'],
  'fc cincinnati': ['wcky1530'],
  'lafc': ['kspn710', 'kfwb980'],
  'new england revolution': ['wbz985', 'wzrm977'],
  'nashville sc': ['wgfx1045'],
  'real salt lake': ['ksl1160'],
  'san jose earthquakes': ['ksfo810', 'kzsf1370'],
  'seattle sounders fc': ['kjr950'],
  'sporting kansas city': ['whb810'],
  'san diego fc': ['kgb760'],
  'vancouver whitecaps': ['cknw730'],
  'cf montreal': ['ckgm690'],
  'philadelphia union': ['wpen975'],
  'seattle reign fc': ['kjr950'],
  'montreal canadiens': ['ckgm690', 'chmp985'],
  'baie comeau drakkar': ['chlc971'],
  'rimouski oceanic': ['cfyx933'],
  'rouyn noranda huskies': ['chun983'],
  'cape breton eagles': ['cjcb1270']
};

/* Diffuseurs de championnat : championnat normalisé (`cleEquipe` du nom de ligue) → clés de
   STATIONS. Aucune garantie que la station diffuse CE match : elle en diffuse une partie. */
export var RADIOS_LIGUES = {
  'premier league': ['talksport1089']
};
STATIONS.talksport1089 = { nom: 'talkSPORT', ind: 'talkSPORT', freq: '1089', lang: 'en', tunein: 's17077', iheart: null };

var LANGUES = { fr: ' (français)', es: ' (espagnol)', en: '' };

/* « St. Louis Blues » et « St Louis Blues » sont la même clé ; les accents tombent. */
export function cleEquipe(nom) {
  return String(nom == null ? '' : nom).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

/* La page d'une station TuneIn ; TuneIn complète lui-même le nom dans l'adresse. */
export function lienStationTuneIn(id) { return 'https://tunein.com/radio/' + encodeURIComponent(id) + '/'; }
/* Idem chez iHeartRadio, qui redirige `/live/<id>/` vers la page de la station. */
export function lienStationIHeart(id) { return 'https://www.iheart.com/live/' + encodeURIComponent(id) + '/'; }

/* Les liens d'une station du registre : un par annuaire qui la connaît (TuneIn, iHeartRadio),
   puis sa page d'écoute officielle (`site`) quand elle n'est dans aucun des deux. */
export function liensDeStation(cleStation) {
  var s = STATIONS[cleStation];
  if (!s) return [];
  var nom = s.nom + (LANGUES[s.lang] || '');
  var liens = [];
  if (s.tunein) liens.push({ nom: nom, url: lienStationTuneIn(s.tunein), source: 'TuneIn' });
  if (s.iheart) liens.push({ nom: nom, url: lienStationIHeart(s.iheart), source: 'iHeartRadio' });
  /* La page d'écoute officielle de la station, pour celles que ni TuneIn ni iHeartRadio n'ont. */
  if (s.site) liens.push({ nom: nom, url: s.site, source: 'Site de la station' });
  return liens;
}

/* Les stations connues d'une équipe : [{ nom, url, source }], la station de l'équipe chez
   TuneIn d'abord (LNH), puis ses stations officielles, sans doublon. */
export function stationsDeLEquipe(nomEquipe) {
  var cle = cleEquipe(nomEquipe);
  var vues = {}, liste = [];
  function ajouter(l) { if (!vues[l.url]) { vues[l.url] = true; liste.push(l); } }
  if (STATIONS_TUNEIN[cle]) ajouter({ nom: 'Station de l\u2019équipe', url: lienStationTuneIn(STATIONS_TUNEIN[cle]), source: 'TuneIn' });
  (RADIOS_EQUIPES[cle] || []).forEach(function(k) { liensDeStation(k).forEach(ajouter); });
  return liste;
}

/* Les stations d'un championnat (RADIOS_LIGUES). */
export function stationsDeLaLigue(nomLigue) {
  var vues = {}, liste = [];
  (RADIOS_LIGUES[cleEquipe(nomLigue)] || []).forEach(function(k) {
    liensDeStation(k).forEach(function(l) { if (!vues[l.url]) { vues[l.url] = true; liste.push(l); } });
  });
  return liste;
}

/* Ce que la fiche montre pour un match :
   { equipes: [{ equipe, stations: [...] }, ...], ligue: { nom, stations } ou null }
   Une entrée par équipe (domicile puis visiteur), jamais deux fois la même. Plus de
   « recherche » de repli (31 octobre 2026, « au lieu de chercher, trouve les stations
   officielles ») : une équipe sans station connue n'a pas de lien, et la fiche le dit. */
export function radiosDuMatch(m) {
  var noms = [m && m.homeTeam, m && m.awayTeam].filter(function(n) { return n && String(n).trim(); });
  var vus = {};
  var equipes = [];
  noms.forEach(function(nom) {
    var cle = cleEquipe(nom);
    if (!cle || vus[cle]) return;
    vus[cle] = true;
    equipes.push({ equipe: String(nom), stations: stationsDeLEquipe(nom) });
  });
  var stLigue = m && m.league ? stationsDeLaLigue(m.league) : [];
  return { equipes: equipes, ligue: stLigue.length ? { nom: String(m.league), stations: stLigue } : null };
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
  var avecStation = r.equipes.some(function(e) { return e.stations.length; }) || !!(r.ligue && r.ligue.stations.length);
  function chips(stations) {
    return stations.map(function(s) { return lien(esc(s.url), esc(s.nom) + ' · ' + esc(s.source), 'radio-station', ico); }).join('');
  }
  r.equipes.forEach(function(e) {
    out += '<div class="fiche-radio-ligne"><span class="fiche-radio-equipe">' + esc(e.equipe) + '</span><span class="fiche-radio-liens">';
    out += e.stations.length ? chips(e.stations) : '<span class="radio-aucune">Aucune station officielle connue</span>';
    out += '</span></div>';
  });
  if (r.ligue && r.ligue.stations.length) {
    out += '<div class="fiche-radio-ligne"><span class="fiche-radio-equipe">' + esc(r.ligue.nom) + '</span><span class="fiche-radio-liens">' + chips(r.ligue.stations) + '</span></div>';
  }
  if (avecStation && r.ligue && r.ligue.stations.length) {
    out += '<div class="fiche-radio-note">Le championnat n\u2019en diffuse qu\u2019une partie des matchs : la station ci-dessus peut ne pas avoir celui-ci.</div>';
  }
  return out;
}

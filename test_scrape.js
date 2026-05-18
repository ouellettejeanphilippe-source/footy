global.window = {};
var TEAM_DATA = {
  'afc bournemouth': {"name":"AFC Bournemouth","league":"league cup","colors":["#f42727","#0000CC"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/349.png","aliases":["ab","bournemouth","bou"],"city":"AFC Bournemouth","teamName":"AFC Bournemouth"},
  'arsenal': {"name":"Arsenal","league":"league cup","colors":["#e20520","#003399"],"aliases":["ars","gunners"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/359.png","city":"Arsenal","teamName":"Arsenal"},
  'aston villa': {"name":"Aston Villa","league":"league cup","colors":["#660e36","#333333"],"aliases":["avl","av","aston","ast"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/362.png","city":"Aston","teamName":"Villa"},
  'brentford': {"name":"Brentford","league":"league cup","colors":["#f42727","#f8ced9"],"aliases":["bre","bren"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/337.png","city":"Brentford","teamName":"Brentford"},
  'brighton & hove albion': {"name":"Brighton & Hove Albion","league":"league cup","colors":["#0606fa","#ffdd00"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/331.png","aliases":["b&ha","brighton","hove","brightonhove","brighton hove","bri"],"city":"Brighton & Hove Albion","teamName":"Brighton & Hove Albion"},
  'burnley': {"name":"Burnley","league":"league cup","colors":["#6C1D45","#00FFFF"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/379.png","aliases":["bur","burn"],"city":"Burnley","teamName":"Burnley"},
  'chelsea': {"name":"Chelsea","league":"league cup","colors":["#144992","#FFFFFF"],"aliases":["che","chel"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/363.png","city":"Chelsea","teamName":"Chelsea"},
  'crystal palace': {"name":"Crystal Palace","league":"league cup","colors":["#0202fb","#ffdd00"],"aliases":["cry","cp","crystal"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/384.png","city":"Crystal","teamName":"Palace"},
  'everton': {"name":"Everton","league":"league cup","colors":["#0606fa","#132257"],"aliases":["eve","ever"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/368.png","city":"Everton","teamName":"Everton"},
  'fulham': {"name":"Fulham","league":"league cup","colors":["#ffffff","#00CC00"],"aliases":["ful","fulh"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/370.png","city":"Fulham","teamName":"Fulham"},
  'leeds united': {"name":"Leeds United","league":"league cup","colors":["#ffffff","#0000FF"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/357.png","aliases":["lu","leeds","lee"],"city":"Leeds","teamName":"United"},
  'liverpool': {"name":"Liverpool","league":"league cup","colors":["#d11317","#FFFFFF"],"aliases":["liv","live"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/364.png","city":"Liverpool","teamName":"Liverpool"},
  'manchester city': {"name":"Manchester City","league":"league cup","colors":["#99c5ea","#000000"],"aliases":["man city","mci","mc","manchester","man"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/382.png","city":"Manchester","teamName":"City"},
  'manchester united': {"name":"Manchester United","league":"league cup","colors":["#da020e","#FFFFFF"],"aliases":["man utd","man united","mun","mu","manchester","man"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/360.png","city":"Manchester","teamName":"United"},
  'newcastle united': {"name":"Newcastle United","league":"league cup","colors":["#000000","#ffffff"],"aliases":["newcastle","new","nu"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/361.png","city":"Newcastle","teamName":"United"},
  'nottingham forest': {"name":"Nottingham Forest","league":"league cup","colors":["#c8102e","#132257"],"aliases":["nottm forest","nfo","nf","nottingham","not"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/393.png","city":"Nottingham","teamName":"Forest"},
  'sunderland': {"name":"Sunderland","league":"league cup","colors":["#EB172B","#87cced"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/366.png","aliases":["sun","sund"],"city":"Sunderland","teamName":"Sunderland"},
  'tottenham hotspur': {"name":"Tottenham Hotspur","league":"league cup","colors":["#ffffff","#000000"],"aliases":["spurs","tottenham","tot","th"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/367.png","city":"Tottenham Hotspur","teamName":"Tottenham Hotspur"},
  'west ham united': {"name":"West Ham United","league":"league cup","colors":["#7c2c3b","#F1E7E0"],"aliases":["whu","west ham","west","ham","westham","wes"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/371.png","city":"West Ham","teamName":"United"},
  'wolverhampton wanderers': {"name":"Wolverhampton Wanderers","league":"league cup","colors":["#fdb913","#32A8DD"],"aliases":["wolves","wol","wolverhampton","ww"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/380.png","city":"Wolverhampton","teamName":"Wanderers"},
  'alavés': {"name":"Alavés","league":["la liga", "copa del rey"],"colors":["#0000ff","#c3c3c3"],"aliases":["ala","deportivo alaves"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/96.png","city":"Alavés","teamName":"Alavés"},
  'athletic club': {"name":"Athletic Club","league":["la liga", "copa del rey"],"colors":["#C8142F","#0000ff"],"aliases":["ath","athletic bilbao"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/93.png","city":"Athletic Club","teamName":"Athletic Club"},
  'atlético madrid': {"name":"Atlético Madrid","league":["la liga", "copa del rey"],"colors":["#ca3624","#000099"],"aliases":["atletico","atl madrid","atm","am","atl"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/1068.png","city":"Atlético Madrid","teamName":"Atlético Madrid"},
  'barcelona': {"name":"Barcelona","league":["la liga", "copa del rey"],"colors":["#990000","#FCE38A"],"aliases":["barca","fc barcelona","bar"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/83.png","city":"Barcelona","teamName":"Barcelona"},
  'celta vigo': {"name":"Celta Vigo","league":["la liga", "copa del rey"],"colors":["#6cace4","#004996"],"aliases":["cel","cv","celta","vigo","celtavigo"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/85.png","city":"Celta","teamName":"Vigo"},
  'elche': {"name":"Elche","league":["la liga", "copa del rey"],"colors":["#ffffff","#288A00"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/3751.png","aliases":["elc","elch"],"city":"Elche","teamName":"Elche"},
  'espanyol': {"name":"Espanyol","league":["la liga", "copa del rey"],"colors":["#3366CC","#C8142F"],"aliases":["esp","espa"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/88.png","city":"Espanyol","teamName":"Espanyol"},
  'getafe': {"name":"Getafe","league":["la liga", "copa del rey"],"colors":["#0000ff","#C8142F"],"aliases":["get","geta"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/2922.png","city":"Getafe","teamName":"Getafe"},
  'girona': {"name":"Girona","league":["la liga", "copa del rey"],"colors":["#C60000","#004996"],"aliases":["gir","giro"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/9812.png","city":"Girona","teamName":"Girona"},
  'levante': {"name":"Levante","league":["la liga", "copa del rey"],"colors":["#C8142F","#000000"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/1538.png","aliases":["lev","leva"],"city":"Levante","teamName":"Levante"},
  'mallorca': {"name":"Mallorca","league":["la liga", "copa del rey"],"colors":["#C8142F","#ccff00"],"aliases":["mal","rcd mallorca"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/84.png","city":"Mallorca","teamName":"Mallorca"},
  'osasuna': {"name":"Osasuna","league":["la liga", "copa del rey"],"colors":["#cd0000","#ffffff"],"aliases":["osa","osas"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/97.png","city":"Osasuna","teamName":"Osasuna"},
  'rayo vallecano': {"name":"Rayo Vallecano","league":["la liga", "copa del rey"],"colors":["#ffffff","#cd0000"],"aliases":["ray","rayo","rv","vallecano","rayovallecano"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/101.png","city":"Rayo Vallecano","teamName":"Rayo Vallecano"},
  'real betis': {"name":"Real Betis","league":["la liga", "copa del rey"],"colors":["#288A00","#ccff00"],"aliases":["bet","betis","rb"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/244.png","city":"Real","teamName":"Betis"},
  'real madrid': {"name":"Real Madrid","league":["la liga", "copa del rey"],"colors":["#ffffff","#00529F"],"aliases":["rma","rm","rea"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/86.png","city":"Real","teamName":"Madrid"},
  'real oviedo': {"name":"Real Oviedo","league":["la liga", "copa del rey"],"colors":["#000000","#000000"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/92.png","aliases":["ro","oviedo","ovi"],"city":"Real","teamName":"Oviedo"},
  'real sociedad': {"name":"Real Sociedad","league":["la liga", "copa del rey"],"colors":["#3366CC","#ffdd00"],"aliases":["rso","rs","sociedad","soc"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/89.png","city":"Real","teamName":"Sociedad"},
  'sevilla': {"name":"Sevilla","league":["la liga", "copa del rey"],"colors":["#ffffff","#d81022"],"aliases":["sev","sevi"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/243.png","city":"Sevilla","teamName":"Sevilla"},
  'valencia': {"name":"Valencia","league":["la liga", "copa del rey"],"colors":["#ffffff","#004996"],"aliases":["val","vale"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/94.png","city":"Valencia","teamName":"Valencia"},
  'villarreal': {"name":"Villarreal","league":["la liga", "copa del rey"],"colors":["#ffff00","#6cace4"],"aliases":["vil","vill"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/102.png","city":"Villarreal","teamName":"Villarreal"},
  'ac milan': {"name":"AC Milan","league":"serie a","colors":["#e4002b","#ffffff"],"aliases":["milan","am","mil"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/103.png","city":"Milan","teamName":"AC"},
  'as roma': {"name":"AS Roma","league":"europa league","colors":["#990a2c","#eae9e7"],"aliases":["rom","ar","roma"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/104.png","city":"Roma","teamName":"AS"},
  'atalanta': {"name":"Atalanta","league":"champions league","colors":["#1157bf","#ffffff"],"aliases":["ata","atal"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/105.png","city":"Atalanta","teamName":"Atalanta"},
  'bologna': {"name":"Bologna","league":"europa league","colors":["#04043d","#ffffff"],"aliases":["bol","bolo"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/107.png","city":"Bologna","teamName":"Bologna"},
  'cagliari': {"name":"Cagliari","league":"serie a","colors":["#282846","#ffffff"],"aliases":["cag","cagl"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/2925.png","city":"Cagliari","teamName":"Cagliari"},
  'como': {"name":"Como","league":"serie a","colors":["#3933FF","#FFFFFF"],"aliases":["com","coo"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/2572.png","city":"Como","teamName":"Como"},
  'cremonese': {"name":"Cremonese","league":"serie a","colors":["#FF0000","#ffffff"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/4050.png","aliases":["cre","crem"],"city":"Cremonese","teamName":"Cremonese"},
  'fiorentina': {"name":"Fiorentina","league":"conference league","colors":["#4c1d84","#ffffff"],"aliases":["fio","fior"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/109.png","city":"Fiorentina","teamName":"Fiorentina"},
  'genoa': {"name":"Genoa","league":"serie a","colors":["#08305d","#ffffff"],"aliases":["gen","geno"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/3263.png","city":"Genoa","teamName":"Genoa"},
  'hellas verona': {"name":"Hellas Verona","league":"serie a","colors":["#00239c","#ffffff"],"aliases":["ver","hv","hellas","verona","hellasverona","hel"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/119.png","city":"Hellas Verona","teamName":"Hellas Verona"},
  'internazionale': {"name":"Internazionale","league":"champions league","colors":["#00239c","#ffffff"],"aliases":["inter","inter milan","int"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/110.png","city":"Internazionale","teamName":"Internazionale"},
  'juventus': {"name":"Juventus","league":"champions league","colors":["#000000","#ffef32"],"aliases":["juve","juv"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/111.png","city":"Juventus","teamName":"Juventus"},
  'lazio': {"name":"Lazio","league":"serie a","colors":["#74bde7","#ffef32"],"aliases":["laz","lazi"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/112.png","city":"Lazio","teamName":"Lazio"},
  'lecce': {"name":"Lecce","league":"serie a","colors":["#e4002b","#08305d"],"aliases":["lec","lecc"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/113.png","city":"Lecce","teamName":"Lecce"},
  'napoli': {"name":"Napoli","league":"champions league","colors":["#0677d2","#ffffff"],"aliases":["nap","napo"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/114.png","city":"Napoli","teamName":"Napoli"},
  'parma': {"name":"Parma","league":"serie a","colors":["#19161D","#ffdd30"],"aliases":["par","parm"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/115.png","city":"Parma","teamName":"Parma"},
  'pisa': {"name":"Pisa","league":"serie a","colors":["#1a1a1a","#1a1a1a"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/3956.png","aliases":["pis","pia"],"city":"Pisa","teamName":"Pisa"},
  'sassuolo': {"name":"Sassuolo","league":"serie a","colors":["#0fa653","#000000"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/3997.png","aliases":["sas","sass"],"city":"Sassuolo","teamName":"Sassuolo"},
  'torino': {"name":"Torino","league":"serie a","colors":["#9f0000","#ffffff"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/239.png","aliases":["tor","tori"],"city":"Torino","teamName":"Torino"},
  'udinese': {"name":"Udinese","league":"serie a","colors":["#19161D","#ffef32"],"aliases":["udi","udin"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/118.png","city":"Udinese","teamName":"Udinese"},
  '1. fc heidenheim 1846': {"name":"1. FC Heidenheim 1846","league":"dfb pokal","colors":["#DA0308","#003399"],"aliases":["fch","heidenheim","1fh1","1846","heidenheim1846","heidenheim 1846","hei"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/6418.png","city":"1. FC Heidenheim 1846","teamName":"1. FC Heidenheim 1846"},
  '1. fc union berlin': {"name":"1. FC Union Berlin","league":"dfb pokal","colors":["#DA0308","#d4d4d4"],"aliases":["fcu","union berlin","1fub","union","berlin","unionberlin","uni"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/598.png","city":"1. FC Union Berlin","teamName":"1. FC Union Berlin"},
  'bayer leverkusen': {"name":"Bayer Leverkusen","league":"dfb pokal","colors":["#DA0308","#f9fbfc"],"aliases":["bayer","b04","leverkusen","bl","bayerleverkusen","bay"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/131.png","city":"Bayer","teamName":"Leverkusen"},
  'bayern munich': {"name":"Bayern Munich","league":"dfb pokal","colors":["#dc052d","#1a1a1a"],"aliases":["bayern","fcb","bayern munchen","bm","munich","bayernmunich","bay"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/132.png","city":"Bayern","teamName":"Munich"},
  'borussia dortmund': {"name":"Borussia Dortmund","league":"dfb pokal","colors":["#ffee00","#272726"],"aliases":["bvb","dortmund","bd","borussia","borussiadortmund","bor"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/124.png","city":"Borussia","teamName":"Dortmund"},
  'borussia mönchengladbach': {"name":"Borussia Mönchengladbach","league":"dfb pokal","colors":["#ffffff","#03915c"],"aliases":["bmg","gladbach","bm","borussia","monchengladbach","borussiamonchengladbach","bor"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/268.png","city":"Borussia","teamName":"Mönchengladbach"},
  'eintracht frankfurt': {"name":"Eintracht Frankfurt","league":"dfb pokal","colors":["#ffffff","#272726"],"aliases":["sge","frankfurt","ef","eintracht","eintrachtfrankfurt","ein"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/125.png","city":"Eintracht","teamName":"Frankfurt"},
  'fc augsburg': {"name":"FC Augsburg","league":"dfb pokal","colors":["#ffffff","#03915c"],"aliases":["fca","augsburg","fa","aug"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/3841.png","city":"FC","teamName":"Augsburg"},
  'fc cologne': {"name":"FC Cologne","league":"dfb pokal","colors":["#ffffff","#DA0308"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/122.png","aliases":["cologne","col"],"city":"FC","teamName":"Cologne"},
  'hamburg sv': {"name":"Hamburg SV","league":"dfb pokal","colors":["#1a26af","#1a1a1a"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/127.png","aliases":["hs","hamburg","ham"],"city":"Hamburg SV","teamName":"Hamburg SV"},
  'mainz': {"name":"Mainz","league":"dfb pokal","colors":["#DA0308","#000055"],"aliases":["m05","mai"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/2950.png","city":"Mainz","teamName":"Mainz"},
  'rb leipzig': {"name":"RB Leipzig","league":"dfb pokal","colors":["#ffffff","#740c14"],"aliases":["rbl","leipzig","rl","lei"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/11420.png","city":"RB Leipzig","teamName":"RB Leipzig"},
  'sc freiburg': {"name":"SC Freiburg","league":"dfb pokal","colors":["#DA0308","#ffffff"],"aliases":["scf","freiburg","sf","fre"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/126.png","city":"SC Freiburg","teamName":"SC Freiburg"},
  'st. pauli': {"name":"St. Pauli","league":"dfb pokal","colors":["#442e23","#ffffff"],"aliases":["stp","sp","pauli","pau"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/270.png","city":"St. Pauli","teamName":"St. Pauli"},
  'tsg hoffenheim': {"name":"TSG Hoffenheim","league":"dfb pokal","colors":["#003399","#000055"],"aliases":["tsg","hoffenheim","th","tsghoffenheim"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/7911.png","city":"TSG Hoffenheim","teamName":"TSG Hoffenheim"},
  'vfb stuttgart': {"name":"VfB Stuttgart","league":"dfb pokal","colors":["#ffffff","#DA0308"],"aliases":["vfb","stuttgart","vs","vfbstuttgart"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/134.png","city":"VfB Stuttgart","teamName":"VfB Stuttgart"},
  'vfl wolfsburg': {"name":"VfL Wolfsburg","league":"dfb pokal","colors":["#81f733","#1a1a1a"],"aliases":["wob","wolfsburg","vw","vfl","vflwolfsburg"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/138.png","city":"VfL Wolfsburg","teamName":"VfL Wolfsburg"},
  'werder bremen': {"name":"Werder Bremen","league":"dfb pokal","colors":["#03915c","#ffffff"],"aliases":["svw","bremen","wb","werder","werderbremen","wer"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/137.png","city":"Werder Bremen","teamName":"Werder Bremen"},
  'aj auxerre': {"name":"AJ Auxerre","league":"ligue 1","colors":["#ffffff","#1a1a1a"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/172.png","aliases":["aa","auxerre","aux"],"city":"AJ Auxerre","teamName":"AJ Auxerre"},
  'as monaco': {"name":"AS Monaco","league":"champions league","colors":["#E91514","#004c37"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/174.png","aliases":["am","monaco","mon"],"city":"Monaco","teamName":"AS"},
  'angers': {"name":"Angers","league":"ligue 1","colors":["#1a1a1a","#ffffff"],"aliases":["sco angers","ang"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/7868.png","city":"Angers","teamName":"Angers"},
  'brest': {"name":"Brest","league":"ligue 1","colors":["#ef2f24","#ffffff"],"aliases":["stade brestois","sb29","bre"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/6997.png","city":"Brest","teamName":"Brest"},
  'le havre ac': {"name":"Le Havre AC","league":"ligue 1","colors":["#011F68","#ededed"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/3236.png","aliases":["lha","havre","hav"],"city":"AC","teamName":"Le Havre"},
  'lens': {"name":"Lens","league":"ligue 1","colors":["#E91514","#004c37"],"aliases":["rc lens","len"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/175.png","city":"Lens","teamName":"Lens"},
  'lille': {"name":"Lille","league":"europa league","colors":["#c2051b","#e2d3d7"],"aliases":["lille osc","losca lille","losc","lil"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/166.png","city":"Lille","teamName":"Lille"},
  'lorient': {"name":"Lorient","league":"ligue 1","colors":["#f46100","#1a1a1a"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/273.png","aliases":["lor","lori"],"city":"Lorient","teamName":"Lorient"},
  'lyon': {"name":"Lyon","league":"europa league","colors":["#ffffff","#1a1a1a"],"aliases":["ol","olympique lyonnais","lyo"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/167.png","city":"Lyon","teamName":"Lyon"},
  'marseille': {"name":"Marseille","league":"champions league","colors":["#ffffff","#011F68"],"aliases":["om","olympique marseille","olympique de marseille","mar"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/176.png","city":"Marseille","teamName":"Marseille"},
  'metz': {"name":"Metz","league":"ligue 1","colors":["#8C3140","#e6c168"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/177.png","aliases":["met","mez"],"city":"Metz","teamName":"Metz"},
  'nantes': {"name":"Nantes","league":"ligue 1","colors":["#ffff00","#011F68"],"aliases":["fc nantes","nan"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/165.png","city":"Nantes","teamName":"Nantes"},
  'nice': {"name":"Nice","league":"europa league","colors":["#ef2f24","#e2d3d7"],"aliases":["ogc nice","nic"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/2502.png","city":"Nice","teamName":"Nice"},
  'paris fc': {"name":"Paris FC","league":"ligue 1","colors":["#000000","#000000"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/6851.png","aliases":["pf","paris","par"],"city":"Paris","teamName":"FC"},
  'paris saint-germain': {"name":"Paris Saint-Germain","league":"champions league","colors":["#011F68","#ffffff"],"aliases":["psg","paris sg","parissaintgermain","paris","ps","saintgermain","par"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/160.png","city":"Paris","teamName":"Saint-Germain"},
  'stade rennais': {"name":"Stade Rennais","league":"ligue 1","colors":["#ef2f24","#ffffff"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/169.png","aliases":["sr","stade","rennais","staderennais","sta"],"city":"Stade Rennais","teamName":"Stade Rennais"},
  'strasbourg': {"name":"Strasbourg","league":"conference league","colors":["#0000bf","#ffffff"],"aliases":["rc strasbourg","str"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/180.png","city":"Strasbourg","teamName":"Strasbourg"},
  'toulouse': {"name":"Toulouse","league":"ligue 1","colors":["#560080","#ffff00"],"aliases":["tfc","tou"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/179.png","city":"Toulouse","teamName":"Toulouse"},
  'ajax amsterdam': {"name":"Ajax Amsterdam","league":"eredivisie","colors":["#DF1B27","#4d6286"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/139.png","aliases":["aa","ajax","amsterdam","ajaxamsterdam","aja"],"city":"Ajax","teamName":"Amsterdam"},
  'benfica': {"name":"Benfica","league":"primeira liga","colors":["#ca281d","#1a1a1a"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/1929.png","aliases":["ben","benf"],"city":"Benfica","teamName":"Benfica"},
  'bodo/glimt': {"name":"Bodo/Glimt","league":"champions league","colors":["#FCEE33","#ffffff"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/2980.png","aliases":["bod","bodo"],"city":"Bodo/Glimt","teamName":"Bodo/Glimt"},
  'club brugge': {"name":"Club Brugge","league":"champions league","colors":["#0081ff","#ffffff"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/570.png","aliases":["cb","brugge","bru"],"city":"Club Brugge","teamName":"Club Brugge"},
  'f.c. københavn': {"name":"F.C. København","league":"champions league","colors":["#ffffff","#1a1a1a"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/909.png","aliases":["fk","kbenhavn","kbe"],"city":"F.C. København","teamName":"F.C. København"},
  'fk qarabag': {"name":"FK Qarabag","league":"champions league","colors":["#000000","#ffffff"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/10414.png","aliases":["fq","qarabag","qar"],"city":"FK Qarabag","teamName":"FK Qarabag"},
  'galatasaray': {"name":"Galatasaray","league":"champions league","colors":["#aa0031","#ffffff"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/432.png","aliases":["gal","gala"],"city":"Galatasaray","teamName":"Galatasaray"},
  'kairat almaty': {"name":"Kairat Almaty","league":"champions league","colors":["#FCEE33","#81c0ff"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/2528.png","aliases":["ka","kairat","almaty","kairatalmaty","kai"],"city":"Kairat Almaty","teamName":"Kairat Almaty"},
  'olympiacos': {"name":"Olympiacos","league":"champions league","colors":["#d01729","#0202fb"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/435.png","aliases":["oly","olym"],"city":"Olympiacos","teamName":"Olympiacos"},
  'psv eindhoven': {"name":"PSV Eindhoven","league":"eredivisie","colors":["#ef2f24","#000000"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/148.png","aliases":["pe","psv","eindhoven","psveindhoven"],"city":"PSV","teamName":"Eindhoven"},
  'pafos': {"name":"Pafos","league":"champions league","colors":["#82c0fe","#003399"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/22281.png","aliases":["paf","pafo"],"city":"Pafos","teamName":"Pafos"},
  'slavia prague': {"name":"Slavia Prague","league":"champions league","colors":["#dc1f26","#81c0ff"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/494.png","aliases":["sp","slavia","prague","slaviaprague","sla"],"city":"Slavia Prague","teamName":"Slavia Prague"},
  'sporting cp': {"name":"Sporting CP","league":"primeira liga","colors":["#008127","#ffffff"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/2250.png","aliases":["spo","spor","sportingcp"],"city":"Sporting","teamName":"CP"},
  'union st.-gilloise': {"name":"Union St.-Gilloise","league":"champions league","colors":["#FCEE33","#ffffff"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/5807.png","aliases":["us","union","stgilloise","unionstgilloise","uni"],"city":"Union St.-Gilloise","teamName":"Union St.-Gilloise"},
  'braga': {"name":"Braga","league":"primeira liga","colors":["#de1f26","#2b6a36"],"aliases":["bra","brag"],"logo":"https://ui-avatars.com/api/?name=Braga&background=de1f26&color=2b6a36&size=200&font-size=0.4","city":"Braga","teamName":"Braga"},
  'celtic': {"name":"Celtic","league":"europa league","colors":["#009921","#f9e900"],"aliases":["cel","celt"],"logo":"https://ui-avatars.com/api/?name=Celtic&background=009921&color=f9e900&size=200&font-size=0.4","city":"Celtic","teamName":"Celtic"},
  'dinamo zagreb': {"name":"Dinamo Zagreb","league":"europa league","colors":["#0000bb","#ccff00"],"aliases":["dz","dinamo","zagreb","dinamozagreb","din"],"logo":"https://ui-avatars.com/api/?name=Dinamo%20Zagreb&background=0000bb&color=ccff00&size=200&font-size=0.4","city":"Dinamo Zagreb","teamName":"Dinamo Zagreb"},
  'fc basel': {"name":"FC Basel","league":"europa league","colors":["#C8142F","#ffffff"],"aliases":["fb","basel","bas"],"logo":"https://ui-avatars.com/api/?name=FC%20Basel&background=C8142F&color=ffffff&size=200&font-size=0.4","city":"FC","teamName":"Basel"},
  'fc midtjylland': {"name":"FC Midtjylland","league":"europa league","colors":["#000000","#ff0900"],"aliases":["fm","midtjylland","mid"],"logo":"https://ui-avatars.com/api/?name=FC%20Midtjylland&background=000000&color=ff0900&size=200&font-size=0.4","city":"FC","teamName":"Midtjylland"},
  'fc porto': {"name":"FC Porto","league":"primeira liga","colors":["#0000dd","#ffa000"],"aliases":["fp","porto","por"],"logo":"https://ui-avatars.com/api/?name=FC%20Porto&background=0000dd&color=ffa000&size=200&font-size=0.4","city":"Porto","teamName":"FC"},
  'fc utrecht': {"name":"FC Utrecht","league":"eredivisie","colors":["#F31522","#1a316b"],"logo":"https://upload.wikimedia.org/wikipedia/commons/5/5d/Logo_FC_Utrecht.svg","aliases":["fu","utrecht","utr"],"city":"FC","teamName":"Utrecht"},
  'fcsb': {"name":"FCSB","league":"europa league","colors":["#0000dd","#dc1f26"],"logo":"https://upload.wikimedia.org/wikipedia/commons/7/78/Fcsb-logo.svg","aliases":["fcs","fcb"],"city":"FCSB","teamName":"FCSB"},
  'fenerbahce': {"name":"Fenerbahce","league":"europa league","colors":["#ffff00","#ffffff"],"aliases":["fen","fene"],"logo":"https://ui-avatars.com/api/?name=Fenerbahce&background=ffff00&color=ffffff&size=200&font-size=0.4","city":"Fenerbahce","teamName":"Fenerbahce"},
  'ferencvaros': {"name":"Ferencvaros","league":"europa league","colors":["#239B56","#000000"],"aliases":["fer","fere"],"logo":"https://ui-avatars.com/api/?name=Ferencvaros&background=239B56&color=000000&size=200&font-size=0.4","city":"Ferencvaros","teamName":"Ferencvaros"},
  'feyenoord rotterdam': {"name":"Feyenoord Rotterdam","league":"eredivisie","colors":["#ef2f24","#000000"],"aliases":["fr","feyenoord","rotterdam","feyenoordrotterdam","fey"],"logo":"https://ui-avatars.com/api/?name=Feyenoord%20Rotterdam&background=ef2f24&color=000000&size=200&font-size=0.4","city":"Feyenoord","teamName":"Rotterdam"},
  'go ahead eagles': {"name":"Go Ahead Eagles","league":"eredivisie","colors":["#F80017","#8f0058"],"aliases":["gae","ahead","eagles","aheadeagles","ahead eagles","ahe"],"logo":"https://ui-avatars.com/api/?name=Go%20Ahead%20Eagles&background=F80017&color=8f0058&size=200&font-size=0.4","city":"Go Ahead Eagles","teamName":"Go Ahead Eagles"},
  'ludogorets razgrad': {"name":"Ludogorets Razgrad","league":"europa league","colors":["#008000","#ffffff"],"aliases":["lr","ludogorets","razgrad","ludogoretsrazgrad","lud"],"logo":"https://ui-avatars.com/api/?name=Ludogorets%20Razgrad&background=008000&color=ffffff&size=200&font-size=0.4","city":"Ludogorets Razgrad","teamName":"Ludogorets Razgrad"},
  'maccabi tel-aviv': {"name":"Maccabi Tel-Aviv","league":"europa league","colors":["#ffff00","#020202"],"aliases":["mt","maccabi","telaviv","maccabitelaviv","mac"],"logo":"https://ui-avatars.com/api/?name=Maccabi%20Tel-Aviv&background=ffff00&color=020202&size=200&font-size=0.4","city":"Maccabi Tel-Aviv","teamName":"Maccabi Tel-Aviv"},
  'malmö ff': {"name":"Malmö FF","league":"europa league","colors":["#5699eb","#052a87"],"aliases":["mf","malmo","mal"],"logo":"https://ui-avatars.com/api/?name=Malm%C3%B6%20FF&background=5699eb&color=052a87&size=200&font-size=0.4","city":"Malmö FF","teamName":"Malmö FF"},
  'paok salonika': {"name":"PAOK Salonika","league":"europa league","colors":["#000000","#ffffff"],"aliases":["ps","paok","salonika","paoksalonika","pao"],"logo":"https://ui-avatars.com/api/?name=PAOK%20Salonika&background=000000&color=ffffff&size=200&font-size=0.4","city":"PAOK Salonika","teamName":"PAOK Salonika"},
  'panathinaikos': {"name":"Panathinaikos","league":"europa league","colors":["#2b6a36","#ffffff"],"aliases":["pan","pana"],"logo":"https://ui-avatars.com/api/?name=Panathinaikos&background=2b6a36&color=ffffff&size=200&font-size=0.4","city":"Panathinaikos","teamName":"Panathinaikos"},
  'rb salzburg': {"name":"RB Salzburg","league":"europa league","colors":["#d82c3a","#052a87"],"aliases":["rs","salzburg","sal"],"logo":"https://ui-avatars.com/api/?name=RB%20Salzburg&background=d82c3a&color=052a87&size=200&font-size=0.4","city":"RB Salzburg","teamName":"RB Salzburg"},
  'racing genk': {"name":"Racing Genk","league":"europa league","colors":["#0000ff","#cccccc"],"aliases":["rg","racing","genk","racinggenk","rac"],"logo":"https://ui-avatars.com/api/?name=Racing%20Genk&background=0000ff&color=cccccc&size=200&font-size=0.4","city":"Racing Genk","teamName":"Racing Genk"},
  'rangers': {"name":"Rangers","league":"europa league","colors":["#0046ff","#ffffff"],"aliases":["ran","rang"],"logo":"https://ui-avatars.com/api/?name=Rangers&background=0046ff&color=ffffff&size=200&font-size=0.4","city":"Rangers","teamName":"Rangers"},
  'red star belgrade': {"name":"Red Star Belgrade","league":"europa league","colors":["#FF0000","#0000dd"],"logo":"https://upload.wikimedia.org/wikipedia/en/c/c2/Red_Star_Belgrade_crest.svg","aliases":["rsb","red","star","belgrade"],"city":"Red Star Belgrade","teamName":"Red Star Belgrade"},
  'sk brann': {"name":"SK Brann","league":"europa league","colors":["#FF0000","#32CD32"],"aliases":["sb","brann","bra"],"logo":"https://ui-avatars.com/api/?name=SK%20Brann&background=FF0000&color=32CD32&size=200&font-size=0.4","city":"SK Brann","teamName":"SK Brann"},
  'sk sturm graz': {"name":"SK Sturm Graz","league":"europa league","colors":["#ffffff","#000000"],"logo":"https://upload.wikimedia.org/wikipedia/en/9/91/SK_Sturm_Graz_logo.svg","aliases":["ssg","sturm","graz","sturmgraz","sturm graz","stu"],"city":"SK Sturm Graz","teamName":"SK Sturm Graz"},
  'viktoria plzen': {"name":"Viktoria Plzen","league":"europa league","colors":["#0000dd","#000000"],"aliases":["vp","viktoria","plzen","viktoriaplzen","vik"],"logo":"https://ui-avatars.com/api/?name=Viktoria%20Plzen&background=0000dd&color=000000&size=200&font-size=0.4","city":"Viktoria Plzen","teamName":"Viktoria Plzen"},
  'young boys': {"name":"Young Boys","league":"europa league","colors":["#ffdd00","#FFFFFF"],"aliases":["yb","young","boys","youngboys","you"],"logo":"https://ui-avatars.com/api/?name=Young%20Boys&background=ffdd00&color=FFFFFF&size=200&font-size=0.4","city":"Young Boys","teamName":"Young Boys"},
  'aek athens': {"name":"AEK Athens","league":"conference league","colors":["#ffff00","#000000"],"aliases":["aa","aek","athens","aekathens"],"logo":"https://ui-avatars.com/api/?name=AEK%20Athens&background=ffff00&color=000000&size=200&font-size=0.4","city":"AEK Athens","teamName":"AEK Athens"},
  'aek larnaca': {"name":"AEK Larnaca","league":"conference league","colors":["#FDE100","#008741"],"aliases":["al","aek","larnaca","aeklarnaca"],"logo":"https://ui-avatars.com/api/?name=AEK%20Larnaca&background=FDE100&color=008741&size=200&font-size=0.4","city":"AEK Larnaca","teamName":"AEK Larnaca"},
  'az alkmaar': {"name":"AZ Alkmaar","league":"eredivisie","colors":["#ef2f24","#ffffff"],"aliases":["aa","alkmaar","alk"],"logo":"https://ui-avatars.com/api/?name=AZ%20Alkmaar&background=ef2f24&color=ffffff&size=200&font-size=0.4","city":"AZ Alkmaar","teamName":"AZ Alkmaar"},
  'aberdeen': {"name":"Aberdeen","league":"conference league","colors":["#C8142F","#f9e900"],"aliases":["abe","aber"],"logo":"https://ui-avatars.com/api/?name=Aberdeen&background=C8142F&color=f9e900&size=200&font-size=0.4","city":"Aberdeen","teamName":"Aberdeen"},
  'bk häcken': {"name":"BK Häcken","league":"conference league","colors":["#000000","#f7ee09"],"aliases":["bh","hacken","hac"],"logo":"https://ui-avatars.com/api/?name=BK%20H%C3%A4cken&background=000000&color=f7ee09&size=200&font-size=0.4","city":"BK Häcken","teamName":"BK Häcken"},
  'breidablik': {"name":"Breidablik","league":"conference league","colors":["#000000","#000000"],"aliases":["bre","brei"],"logo":"https://ui-avatars.com/api/?name=Breidablik&background=000000&color=000000&size=200&font-size=0.4","city":"Breidablik","teamName":"Breidablik"},
  'csu craiova': {"name":"CSU Craiova","league":"conference league","colors":["#000000","#C60000"],"aliases":["cc","csu","craiova","csucraiova"],"logo":"https://ui-avatars.com/api/?name=CSU%20Craiova&background=000000&color=C60000&size=200&font-size=0.4","city":"CSU Craiova","teamName":"CSU Craiova"},
  'drita gjilan': {"name":"Drita Gjilan","league":"conference league","colors":["#000000","#C60000"],"aliases":["dg","drita","gjilan","dritagjilan","dri"],"logo":"https://ui-avatars.com/api/?name=Drita%20Gjilan&background=000000&color=C60000&size=200&font-size=0.4","city":"Drita Gjilan","teamName":"Drita Gjilan"},
  'dynamo kyiv': {"name":"Dynamo Kyiv","league":"conference league","colors":["#ffffff","#0000bf"],"aliases":["dk","dynamo","kyiv","dynamokyiv","dyn"],"logo":"https://ui-avatars.com/api/?name=Dynamo%20Kyiv&background=ffffff&color=0000bf&size=200&font-size=0.4","city":"Dynamo Kyiv","teamName":"Dynamo Kyiv"},
  'fc noah': {"name":"FC Noah","league":"conference league","colors":["#000000","#ffffff"],"aliases":["fn","noah","noa"],"logo":"https://ui-avatars.com/api/?name=FC%20Noah&background=000000&color=ffffff&size=200&font-size=0.4","city":"FC","teamName":"Noah"},
  'hamrun spartans': {"name":"Hamrun Spartans","league":"conference league","colors":["#C60000","#000000"],"aliases":["hs","hamrun","spartans","hamrunspartans","ham"],"logo":"https://ui-avatars.com/api/?name=Hamrun%20Spartans&background=C60000&color=000000&size=200&font-size=0.4","city":"Hamrun Spartans","teamName":"Hamrun Spartans"},
  'jagiellonia bialystok': {"name":"Jagiellonia Bialystok","league":"conference league","colors":["#000000","#C60000"],"aliases":["jb","jagiellonia","bialystok","jagielloniabialystok","jag"],"logo":"https://ui-avatars.com/api/?name=Jagiellonia%20Bialystok&background=000000&color=C60000&size=200&font-size=0.4","city":"Jagiellonia Bialystok","teamName":"Jagiellonia Bialystok"},
  'kf shkëndija': {"name":"KF Shkëndija","league":"conference league","colors":["#E91514","#000000"],"logo":"https://upload.wikimedia.org/wikipedia/commons/2/29/KF_Shk%C3%ABndija_Logo.svg","aliases":["ks","shkendija","shk"],"city":"KF Shkëndija","teamName":"KF Shkëndija"},
  'kups kuopio': {"name":"KuPS Kuopio","league":"conference league","colors":["#000000","#000000"],"aliases":["kk","kups","kuopio","kupskuopio","kup"],"logo":"https://ui-avatars.com/api/?name=KuPS%20Kuopio&background=000000&color=000000&size=200&font-size=0.4","city":"KuPS Kuopio","teamName":"KuPS Kuopio"},
  'lausanne sports': {"name":"Lausanne Sports","league":"conference league","colors":["#000099","#C60000"],"aliases":["ls","lausanne","sports","lausannesports","lau"],"logo":"https://ui-avatars.com/api/?name=Lausanne%20Sports&background=000099&color=C60000&size=200&font-size=0.4","city":"Lausanne Sports","teamName":"Lausanne Sports"},
  'lech poznan': {"name":"Lech Poznan","league":"conference league","colors":["#000000","#000000"],"aliases":["lp","lech","poznan","lechpoznan","lec"],"logo":"https://ui-avatars.com/api/?name=Lech%20Poznan&background=000000&color=000000&size=200&font-size=0.4","city":"Lech Poznan","teamName":"Lech Poznan"},
  'legia warsaw': {"name":"Legia Warsaw","league":"conference league","colors":["#2b6a36","#ffffff"],"logo":"https://upload.wikimedia.org/wikipedia/en/6/6d/Legia_Warsaw_logo.svg","aliases":["lw","legia","warsaw","legiawarsaw","leg"],"city":"Legia Warsaw","teamName":"Legia Warsaw"},
  'lincoln red imps': {"name":"Lincoln Red Imps","league":"conference league","colors":["#C60000","#ffffff"],"aliases":["lri","lincoln","red","imps","lin"],"logo":"https://ui-avatars.com/api/?name=Lincoln%20Red%20Imps&background=C60000&color=ffffff&size=200&font-size=0.4","city":"Lincoln","teamName":"Red Imps"},
  'nk celje': {"name":"NK Celje","league":"conference league","colors":["#000099","#ff6600"],"aliases":["nc","celje","cel"],"logo":"https://ui-avatars.com/api/?name=NK%20Celje&background=000099&color=ff6600&size=200&font-size=0.4","city":"NK Celje","teamName":"NK Celje"},
  'omonia nicosia': {"name":"Omonia Nicosia","league":"conference league","colors":["#025719","#ffffff"],"aliases":["on","omonia","nicosia","omonianicosia","omo"],"logo":"https://ui-avatars.com/api/?name=Omonia%20Nicosia&background=025719&color=ffffff&size=200&font-size=0.4","city":"Omonia Nicosia","teamName":"Omonia Nicosia"},
  'raków czestochowa': {"name":"Raków Czestochowa","league":"conference league","colors":["#EE2E24","#164BA0"],"aliases":["rakow","czestochowa","rakowczestochowa","rak"],"logo":"https://ui-avatars.com/api/?name=Rak%C3%B3w%20Czestochowa&background=EE2E24&color=164BA0&size=200&font-size=0.4","city":"Raków Czestochowa","teamName":"Raków Czestochowa"},
  'rapid vienna': {"name":"Rapid Vienna","league":"conference league","colors":["#2b6a36","#dc1f26"],"aliases":["rv","rapid","vienna","rapidvienna","rap"],"logo":"https://ui-avatars.com/api/?name=Rapid%20Vienna&background=2b6a36&color=dc1f26&size=200&font-size=0.4","city":"Rapid Vienna","teamName":"Rapid Vienna"},
  'rijeka': {"name":"Rijeka","league":"conference league","colors":["#42BEFD","#000000"],"aliases":["rij","rije"],"logo":"https://ui-avatars.com/api/?name=Rijeka&background=42BEFD&color=000000&size=200&font-size=0.4","city":"Rijeka","teamName":"Rijeka"},
  'samsunspor': {"name":"Samsunspor","league":"conference league","colors":["#000000","#C60000"],"aliases":["sam","sams"],"logo":"https://ui-avatars.com/api/?name=Samsunspor&background=000000&color=C60000&size=200&font-size=0.4","city":"Samsunspor","teamName":"Samsunspor"},
  'shakhtar donetsk': {"name":"Shakhtar Donetsk","league":"conference league","colors":["#ff5900","#1a1a1a"],"aliases":["sd","shakhtar","donetsk","shakhtardonetsk","sha"],"logo":"https://ui-avatars.com/api/?name=Shakhtar%20Donetsk&background=ff5900&color=1a1a1a&size=200&font-size=0.4","city":"Shakhtar Donetsk","teamName":"Shakhtar Donetsk"},
  'shamrock rovers': {"name":"Shamrock Rovers","league":"conference league","colors":["#288A00","#000000"],"aliases":["sr","shamrock","sha"],"logo":"https://ui-avatars.com/api/?name=Shamrock%20Rovers&background=288A00&color=000000&size=200&font-size=0.4","city":"Shamrock Rovers","teamName":"Shamrock Rovers"},
  'shelbourne': {"name":"Shelbourne","league":"conference league","colors":["#000000","#C60000"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/20297.png","aliases":["she","shel"],"city":"Shelbourne","teamName":"Shelbourne"},
  'sigma olomouc': {"name":"Sigma Olomouc","league":"conference league","colors":["#000000","#000000"],"aliases":["so","sigma","olomouc","sigmaolomouc","sig"],"logo":"https://ui-avatars.com/api/?name=Sigma%20Olomouc&background=000000&color=000000&size=200&font-size=0.4","city":"Sigma Olomouc","teamName":"Sigma Olomouc"},
  'slovan bratislava': {"name":"Slovan Bratislava","league":"conference league","colors":["#81c0ff","#1a1a1a"],"aliases":["sb","slovan","bratislava","slovanbratislava","slo"],"logo":"https://ui-avatars.com/api/?name=Slovan%20Bratislava&background=81c0ff&color=1a1a1a&size=200&font-size=0.4","city":"Slovan Bratislava","teamName":"Slovan Bratislava"},
  'sparta prague': {"name":"Sparta Prague","league":"conference league","colors":["#791b29","#ffffff"],"aliases":["sp","sparta","prague","spartaprague","spa"],"logo":"https://ui-avatars.com/api/?name=Sparta%20Prague&background=791b29&color=ffffff&size=200&font-size=0.4","city":"Sparta Prague","teamName":"Sparta Prague"},
  'zrinjski mostar': {"name":"Zrinjski Mostar","league":"conference league","colors":["#000000","#000000"],"aliases":["zm","zrinjski","mostar","zrinjskimostar","zri"],"logo":"https://ui-avatars.com/api/?name=Zrinjski%20Mostar&background=000000&color=000000&size=200&font-size=0.4","city":"Zrinjski Mostar","teamName":"Zrinjski Mostar"},
  'atlanta united fc': {"name":"Atlanta United FC","league":"mls","colors":["#9d2235","#aa9767"],"aliases":["atlanta united","auf","atlanta","atl"],"logo":"https://ui-avatars.com/api/?name=Atlanta%20United%20FC&background=9d2235&color=aa9767&size=200&font-size=0.4","city":"Atlanta","teamName":"United FC"},
  'austin fc': {"name":"Austin FC","league":"mls","colors":["#00b140","#000000"],"aliases":["austin","af","aus"],"logo":"https://ui-avatars.com/api/?name=Austin%20FC&background=00b140&color=000000&size=200&font-size=0.4","city":"Austin","teamName":"FC"},
  'cf montréal': {"name":"CF Montréal","league":"mls","colors":["#003da6","#c1c5c8"],"aliases":["cm"],"logo":"https://ui-avatars.com/api/?name=CF%20Montr%C3%A9al&background=003da6&color=c1c5c8&size=200&font-size=0.4","city":"Montréal","teamName":"CF"},
  'charlotte fc': {"name":"Charlotte FC","league":"mls","colors":["#0085ca","#000000"],"aliases":["charlotte","cha"],"logo":"https://ui-avatars.com/api/?name=Charlotte%20FC&background=0085ca&color=000000&size=200&font-size=0.4","city":"Charlotte","teamName":"FC"},
  'chicago fire fc': {"name":"Chicago Fire FC","league":"mls","colors":["#7ccdef","#ff0000"],"aliases":["chicago fire","cff","chicago","fire","chicagofire","chi"],"logo":"https://ui-avatars.com/api/?name=Chicago%20Fire%20FC&background=7ccdef&color=ff0000&size=200&font-size=0.4","city":"Chicago","teamName":"Fire FC"},
  'colorado rapids': {"name":"Colorado Rapids","league":"mls","colors":["#8a2432","#8ab7e9"],"aliases":["colorado","cr","rapids","coloradorapids","col"],"logo":"https://ui-avatars.com/api/?name=Colorado%20Rapids&background=8a2432&color=8ab7e9&size=200&font-size=0.4","city":"Colorado","teamName":"Rapids"},
  'columbus crew': {"name":"Columbus Crew","league":"mls","colors":["#000000","#fedd00"],"aliases":["columbus","cc","crew","columbuscrew","col"],"logo":"https://ui-avatars.com/api/?name=Columbus%20Crew&background=000000&color=fedd00&size=200&font-size=0.4","city":"Columbus","teamName":"Crew"},
  'd.c. united': {"name":"D.C. United","league":"mls","colors":["#000000","#d61018"],"aliases":["du","dcunited"],"logo":"https://ui-avatars.com/api/?name=D.C.%20United&background=000000&color=d61018&size=200&font-size=0.4","city":"D.C. United","teamName":"D.C. United"},
  'fc cincinnati': {"name":"FC Cincinnati","league":"mls","colors":["#003087","#fe5000"],"aliases":["cincinnati","cin"],"logo":"https://ui-avatars.com/api/?name=FC%20Cincinnati&background=003087&color=fe5000&size=200&font-size=0.4","city":"Cincinnati","teamName":"FC"},
  'fc dallas': {"name":"FC Dallas","league":"mls","colors":["#c6093b","#001f5b"],"aliases":["dallas","fd","dal"],"logo":"https://ui-avatars.com/api/?name=FC%20Dallas&background=c6093b&color=001f5b&size=200&font-size=0.4","city":"Dallas","teamName":"FC"},
  'houston dynamo fc': {"name":"Houston Dynamo FC","league":"mls","colors":["#ff6b00","#101820"],"aliases":["houston dynamo","hdf","houston","dynamo","houstondynamo","hou"],"logo":"https://ui-avatars.com/api/?name=Houston%20Dynamo%20FC&background=ff6b00&color=101820&size=200&font-size=0.4","city":"Houston","teamName":"Dynamo FC"},
  'inter miami cf': {"name":"Inter Miami CF","league":"mls","colors":["#231f20","#f7b5cd"],"aliases":["inter miami","miami","imc","inter","intermiami","int"],"logo":"https://ui-avatars.com/api/?name=Inter%20Miami%20CF&background=231f20&color=f7b5cd&size=200&font-size=0.4","city":"Inter","teamName":"Miami CF"},
  'la galaxy': {"name":"LA Galaxy","league":"mls","colors":["#00235d","#ffffff"],"aliases":["galaxy","lag","lg","gal"],"logo":"https://ui-avatars.com/api/?name=LA%20Galaxy&background=00235d&color=ffffff&size=200&font-size=0.4","city":"LA Galaxy","teamName":"LA Galaxy"},
  'lafc': {"name":"LAFC","league":"mls","colors":["#000000","#c7a36f"],"aliases":["laf","lac"],"logo":"https://ui-avatars.com/api/?name=LAFC&background=000000&color=c7a36f&size=200&font-size=0.4","city":"LAFC","teamName":"LAFC"},
  'minnesota united fc': {"name":"Minnesota United FC","league":"mls","colors":["#000000","#9bcde4"],"aliases":["minnesota united","muf","minnesota","min"],"logo":"https://ui-avatars.com/api/?name=Minnesota%20United%20FC&background=000000&color=9bcde4&size=200&font-size=0.4","city":"Minnesota","teamName":"United FC"},
  'nashville sc': {"name":"Nashville SC","league":"mls","colors":["#ece83a","#1f1646"],"aliases":["nashville","ns","nas"],"logo":"https://ui-avatars.com/api/?name=Nashville%20SC&background=ece83a&color=1f1646&size=200&font-size=0.4","city":"Nashville","teamName":"SC"},
  'new england revolution': {"name":"New England Revolution","league":"mls","colors":["#022166","#ce0e2d"],"aliases":["new england","ner","new","england","revolution"],"logo":"https://ui-avatars.com/api/?name=New%20England%20Revolution&background=022166&color=ce0e2d&size=200&font-size=0.4","city":"New England","teamName":"Revolution"},
  'new york city fc': {"name":"New York City FC","league":"mls","colors":["#9fd2ff","#000229"],"aliases":["nycfc","nycf","new","york","newyork","new york"],"logo":"https://ui-avatars.com/api/?name=New%20York%20City%20FC&background=9fd2ff&color=000229&size=200&font-size=0.4","city":"New York","teamName":"City FC"},
  'orlando city sc': {"name":"Orlando City SC","league":"mls","colors":["#60269e","#f0d283"],"aliases":["orlando city","ocs","orlando","orl"],"logo":"https://ui-avatars.com/api/?name=Orlando%20City%20SC&background=60269e&color=f0d283&size=200&font-size=0.4","city":"Orlando","teamName":"City SC"},
  'philadelphia union': {"name":"Philadelphia Union","league":"mls","colors":["#051f31","#e0d0a6"],"aliases":["philadelphia","pu","union","philadelphiaunion","phi"],"logo":"https://ui-avatars.com/api/?name=Philadelphia%20Union&background=051f31&color=e0d0a6&size=200&font-size=0.4","city":"Philadelphia","teamName":"Union"},
  'portland timbers': {"name":"Portland Timbers","league":"mls","colors":["#2c5234","#c99700"],"aliases":["portland","pt","timbers","portlandtimbers","por"],"logo":"https://ui-avatars.com/api/?name=Portland%20Timbers&background=2c5234&color=c99700&size=200&font-size=0.4","city":"Portland","teamName":"Timbers"},
  'real salt lake': {"name":"Real Salt Lake","league":"mls","colors":["#a32035","#daa900"],"aliases":["rsl","salt lake","salt","lake","saltlake","sal"],"logo":"https://ui-avatars.com/api/?name=Real%20Salt%20Lake&background=a32035&color=daa900&size=200&font-size=0.4","city":"Salt Lake","teamName":"Real"},
  'red bull new york': {"name":"Red Bull New York","league":"mls","colors":["#ba0c2f","#ffc72c"],"aliases":["red bulls","nyrb","rbny","red","bull","new","york"],"logo":"https://ui-avatars.com/api/?name=Red%20Bull%20New%20York&background=ba0c2f&color=ffc72c&size=200&font-size=0.4","city":"New York","teamName":"Red Bull"},
  'san diego fc': {"name":"San Diego FC","league":"mls","colors":["#697a7C","#F89E1A"],"aliases":["sdf","san","diego","sandiego","san diego"],"logo":"https://ui-avatars.com/api/?name=San%20Diego%20FC&background=697a7C&color=F89E1A&size=200&font-size=0.4","city":"San","teamName":"Diego FC"},
  'san jose earthquakes': {"name":"San Jose Earthquakes","league":"mls","colors":["#003da6","#ffffff"],"aliases":["san jose","sje","san","jose","earthquakes"],"logo":"https://ui-avatars.com/api/?name=San%20Jose%20Earthquakes&background=003da6&color=ffffff&size=200&font-size=0.4","city":"San Jose","teamName":"Earthquakes"},
  'seattle sounders fc': {"name":"Seattle Sounders FC","league":"mls","colors":["#2dc84d","#0033a0"],"aliases":["seattle sounders","ssf","seattle","sounders","seattlesounders","sea"],"logo":"https://ui-avatars.com/api/?name=Seattle%20Sounders%20FC&background=2dc84d&color=0033a0&size=200&font-size=0.4","city":"Seattle","teamName":"Sounders FC"},
  'sporting kansas city': {"name":"Sporting Kansas City","league":"mls","colors":["#a7c6ed","#0a2240"],"aliases":["sporting kc","skc","kansas","kan"],"logo":"https://ui-avatars.com/api/?name=Sporting%20Kansas%20City&background=a7c6ed&color=0a2240&size=200&font-size=0.4","city":"Kansas City","teamName":"Sporting"},
  'st. louis city sc': {"name":"St. Louis CITY SC","league":"mls","colors":["#ec1458","#001544"],"aliases":["st louis","slcs","louis","lou"],"logo":"https://ui-avatars.com/api/?name=St.%20Louis%20CITY%20SC&background=ec1458&color=001544&size=200&font-size=0.4","city":"St. Louis","teamName":"CITY SC"},
  'toronto fc': {"name":"Toronto FC","league":"mls","colors":["#aa182c","#a2a9ad"],"aliases":["toronto","tf","tor"],"logo":"https://ui-avatars.com/api/?name=Toronto%20FC&background=aa182c&color=a2a9ad&size=200&font-size=0.4","city":"Toronto","teamName":"FC"},
  'vancouver whitecaps': {"name":"Vancouver Whitecaps","league":"mls","colors":["#ffffff","#12284c"],"aliases":["whitecaps","vw","vancouver","vancouverwhitecaps","van"],"logo":"https://ui-avatars.com/api/?name=Vancouver%20Whitecaps&background=ffffff&color=12284c&size=200&font-size=0.4","city":"Vancouver","teamName":"Whitecaps"},
  'excelsior': {"name":"Excelsior","league":"eredivisie","colors":["#000000","#b41226"],"aliases":["exc","exce"],"logo":"https://ui-avatars.com/api/?name=Excelsior&background=000000&color=b41226&size=200&font-size=0.4","city":"Excelsior","teamName":"Excelsior"},
  'fc groningen': {"name":"FC Groningen","league":"eredivisie","colors":["#ffffff","#30565c"],"aliases":["fg","groningen","gro"],"logo":"https://ui-avatars.com/api/?name=FC%20Groningen&background=ffffff&color=30565c&size=200&font-size=0.4","city":"FC","teamName":"Groningen"},
  'fc twente': {"name":"FC Twente","league":"eredivisie","colors":["#F31522","#9df9f7"],"aliases":["ft","twente","twe"],"logo":"https://ui-avatars.com/api/?name=FC%20Twente&background=F31522&color=9df9f7&size=200&font-size=0.4","city":"FC","teamName":"Twente"},
  'fc volendam': {"name":"FC Volendam","league":"eredivisie","colors":["#F7AA25","#9de1ff"],"aliases":["fv","volendam","vol"],"logo":"https://ui-avatars.com/api/?name=FC%20Volendam&background=F7AA25&color=9de1ff&size=200&font-size=0.4","city":"FC","teamName":"Volendam"},
  'fortuna sittard': {"name":"Fortuna Sittard","league":"eredivisie","colors":["#FCEE33","#ffffff"],"aliases":["fs","fortuna","sittard","fortunasittard","for"],"logo":"https://ui-avatars.com/api/?name=Fortuna%20Sittard&background=FCEE33&color=ffffff&size=200&font-size=0.4","city":"Fortuna Sittard","teamName":"Fortuna Sittard"},
  'heerenveen': {"name":"Heerenveen","league":"eredivisie","colors":["#003eff","#1a316b"],"aliases":["hee","heer"],"logo":"https://ui-avatars.com/api/?name=Heerenveen&background=003eff&color=1a316b&size=200&font-size=0.4","city":"Heerenveen","teamName":"Heerenveen"},
  'heracles almelo': {"name":"Heracles Almelo","league":"eredivisie","colors":["#000000","#ffffff"],"aliases":["ha","heracles","almelo","heraclesalmelo","her"],"logo":"https://ui-avatars.com/api/?name=Heracles%20Almelo&background=000000&color=ffffff&size=200&font-size=0.4","city":"Heracles Almelo","teamName":"Heracles Almelo"},
  'nac breda': {"name":"NAC Breda","league":"eredivisie","colors":["#FCEE33","#ffffff"],"aliases":["nb","nac","breda","nacbreda"],"logo":"https://ui-avatars.com/api/?name=NAC%20Breda&background=FCEE33&color=ffffff&size=200&font-size=0.4","city":"NAC Breda","teamName":"NAC Breda"},
  'nec nijmegen': {"name":"NEC Nijmegen","league":"eredivisie","colors":["#ef2f24","#84aee7"],"aliases":["nn","nec","nijmegen","necnijmegen"],"logo":"https://ui-avatars.com/api/?name=NEC%20Nijmegen&background=ef2f24&color=84aee7&size=200&font-size=0.4","city":"NEC Nijmegen","teamName":"NEC Nijmegen"},
  'pec zwolle': {"name":"PEC Zwolle","league":"eredivisie","colors":["#0000d4","#000000"],"aliases":["pz","pec","zwolle","peczwolle"],"logo":"https://ui-avatars.com/api/?name=PEC%20Zwolle&background=0000d4&color=000000&size=200&font-size=0.4","city":"PEC Zwolle","teamName":"PEC Zwolle"},
  'sparta rotterdam': {"name":"Sparta Rotterdam","league":"eredivisie","colors":["#F31522","#84aee7"],"aliases":["sr","sparta","rotterdam","spartarotterdam","spa"],"logo":"https://ui-avatars.com/api/?name=Sparta%20Rotterdam&background=F31522&color=84aee7&size=200&font-size=0.4","city":"Sparta Rotterdam","teamName":"Sparta Rotterdam"},
  'telstar': {"name":"Telstar","league":"eredivisie","colors":["#C60000","#FCEE33"],"aliases":["tel","tels"],"logo":"https://ui-avatars.com/api/?name=Telstar&background=C60000&color=FCEE33&size=200&font-size=0.4","city":"Telstar","teamName":"Telstar"},
  'avs': {"name":"AVS","league":"primeira liga","colors":["#C60000","#FFFFFF"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/22064.png","aliases":["avs futebol sad","avs fs"],"city":"AVS","teamName":"AVS"},
  'alverca': {"name":"Alverca","league":"primeira liga","colors":["#0047AB","#C60000"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/21613.png","aliases":["alv","alve"],"city":"Alverca","teamName":"Alverca"},
  'arouca': {"name":"Arouca","league":"primeira liga","colors":["#ffea01","#293dc2"],"aliases":["aro","arou"],"logo":"https://ui-avatars.com/api/?name=Arouca&background=ffea01&color=293dc2&size=200&font-size=0.4","city":"Arouca","teamName":"Arouca"},
  'c.d. nacional': {"name":"C.D. Nacional","league":"primeira liga","colors":["#000000","#000099"],"aliases":["cn","nacional","nac"],"logo":"https://ui-avatars.com/api/?name=C.D.%20Nacional&background=000000&color=000099&size=200&font-size=0.4","city":"C.D. Nacional","teamName":"C.D. Nacional"},
  'casa pia': {"name":"Casa Pia","league":"primeira liga","colors":["#000000","#C60000"],"aliases":["cp","casa","pia","casapia","cas"],"logo":"https://ui-avatars.com/api/?name=Casa%20Pia&background=000000&color=C60000&size=200&font-size=0.4","city":"Casa Pia","teamName":"Casa Pia"},
  'estoril': {"name":"Estoril","league":"primeira liga","colors":["#ffea01","#293dc2"],"aliases":["est","esto"],"logo":"https://ui-avatars.com/api/?name=Estoril&background=ffea01&color=293dc2&size=200&font-size=0.4","city":"Estoril","teamName":"Estoril"},
  'estrela': {"name":"Estrela","league":"primeira liga","colors":["#3B8132","#DE0A26"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/21610.png","aliases":["est","estr"],"city":"Estrela","teamName":"Estrela"},
  'fc famalicao': {"name":"FC Famalicao","league":"primeira liga","colors":["#FFFFFF","#183760"],"aliases":["ff","famalicao","fam"],"logo":"https://ui-avatars.com/api/?name=FC%20Famalicao&background=FFFFFF&color=183760&size=200&font-size=0.4","city":"FC","teamName":"Famalicao"},
  'gil vicente': {"name":"Gil Vicente","league":"primeira liga","colors":["#de1f26","#FFFFFF"],"aliases":["gv","gil","vicente","gilvicente"],"logo":"https://ui-avatars.com/api/?name=Gil%20Vicente&background=de1f26&color=FFFFFF&size=200&font-size=0.4","city":"Gil Vicente","teamName":"Gil Vicente"},
  'moreirense': {"name":"Moreirense","league":"primeira liga","colors":["#288A00","#000000"],"aliases":["mor","more"],"logo":"https://ui-avatars.com/api/?name=Moreirense&background=288A00&color=000000&size=200&font-size=0.4","city":"Moreirense","teamName":"Moreirense"},
  'rio ave': {"name":"Rio Ave","league":"primeira liga","colors":["#3b8649","#FF621A"],"aliases":["ra","rio","ave","rioave"],"logo":"https://ui-avatars.com/api/?name=Rio%20Ave&background=3b8649&color=FF621A&size=200&font-size=0.4","city":"Rio Ave","teamName":"Rio Ave"},
  'santa clara': {"name":"Santa Clara","league":"primeira liga","colors":["#C60000","#ddbf64"],"aliases":["santa","clara","santaclara","san"],"logo":"https://ui-avatars.com/api/?name=Santa%20Clara&background=C60000&color=ddbf64&size=200&font-size=0.4","city":"Santa Clara","teamName":"Santa Clara"},
  'tondela': {"name":"Tondela","league":"primeira liga","colors":["#ffea01","#293dc2"],"aliases":["ton","tond"],"logo":"https://ui-avatars.com/api/?name=Tondela&background=ffea01&color=293dc2&size=200&font-size=0.4","city":"Tondela","teamName":"Tondela"},
  'vitória de guimaraes': {"name":"Vitória de Guimaraes","league":"primeira liga","colors":["#ffffff","#000000"],"aliases":["vdg","vitoria","guimaraes","vitoriaguimaraes","vitoria guimaraes","vit"],"logo":"https://ui-avatars.com/api/?name=Vit%C3%B3ria%20de%20Guimaraes&background=ffffff&color=000000&size=200&font-size=0.4","city":"Vitória de Guimaraes","teamName":"Vitória de Guimaraes"},
  'albania': {"name":"Albania","league":"nations league","colors":["#E70000","#ffffff"],"aliases":["alb","alba"],"logo":"https://ui-avatars.com/api/?name=Albania&background=E70000&color=ffffff&size=200&font-size=0.4","city":"Albania","teamName":"Albania"},
  'andorra': {"name":"Andorra","league":"nations league","colors":["#E70000","#0000cd"],"aliases":["and","ando"],"logo":"https://ui-avatars.com/api/?name=Andorra&background=E70000&color=0000cd&size=200&font-size=0.4","city":"Andorra","teamName":"Andorra"},
  'armenia': {"name":"Armenia","league":"nations league","colors":["#DE2400","#ffffff"],"aliases":["arm","arme"],"logo":"https://ui-avatars.com/api/?name=Armenia&background=DE2400&color=ffffff&size=200&font-size=0.4","city":"Armenia","teamName":"Armenia"},
  'austria': {"name":"Austria","league":"nations league","colors":["#d72b2c","#ffffff"],"aliases":["aus","aust"],"logo":"https://ui-avatars.com/api/?name=Austria&background=d72b2c&color=ffffff&size=200&font-size=0.4","city":"Austria","teamName":"Austria"},
  'azerbaijan': {"name":"Azerbaijan","league":"nations league","colors":["#2D4AB0","#ffffff"],"aliases":["aze","azer"],"logo":"https://ui-avatars.com/api/?name=Azerbaijan&background=2D4AB0&color=ffffff&size=200&font-size=0.4","city":"Azerbaijan","teamName":"Azerbaijan"},
  'belarus': {"name":"Belarus","league":"nations league","colors":["#ffffff","#E70000"],"aliases":["bel","bela"],"logo":"https://ui-avatars.com/api/?name=Belarus&background=ffffff&color=E70000&size=200&font-size=0.4","city":"Belarus","teamName":"Belarus"},
  'belgium': {"name":"Belgium","league":"world cup","colors":["#ef3340","#d7e9f6"],"aliases":["bel","belg"],"logo":"https://ui-avatars.com/api/?name=Belgium&background=ef3340&color=d7e9f6&size=200&font-size=0.4","city":"Belgium","teamName":"Belgium"},
  'bosnia-herzegovina': {"name":"Bosnia-Herzegovina","league":"nations league","colors":["#112855","#ffffff"],"aliases":["bos","bosn"],"logo":"https://ui-avatars.com/api/?name=Bosnia-Herzegovina&background=112855&color=ffffff&size=200&font-size=0.4","city":"Bosnia-Herzegovina","teamName":"Bosnia-Herzegovina"},
  'bulgaria': {"name":"Bulgaria","league":"nations league","colors":["#d62612","#ffffff"],"aliases":["bul","bulg"],"logo":"https://ui-avatars.com/api/?name=Bulgaria&background=d62612&color=ffffff&size=200&font-size=0.4","city":"Bulgaria","teamName":"Bulgaria"},
  'croatia': {"name":"Croatia","league":"world cup","colors":["#ff0000","#0c2fff"],"aliases":["cro","croa"],"logo":"https://ui-avatars.com/api/?name=Croatia&background=ff0000&color=0c2fff&size=200&font-size=0.4","city":"Croatia","teamName":"Croatia"},
  'cyprus': {"name":"Cyprus","league":"nations league","colors":["#195ccd","#ffffff"],"aliases":["cyp","cypr"],"logo":"https://ui-avatars.com/api/?name=Cyprus&background=195ccd&color=ffffff&size=200&font-size=0.4","city":"Cyprus","teamName":"Cyprus"},
  'czechia': {"name":"Czechia","league":"nations league","colors":["#d7141a","#ffffff"],"aliases":["cze","czec"],"logo":"https://ui-avatars.com/api/?name=Czechia&background=d7141a&color=ffffff&size=200&font-size=0.4","city":"Czechia","teamName":"Czechia"},
  'denmark': {"name":"Denmark","league":"nations league","colors":["#d02a3e","#ffffff"],"aliases":["den","denm"],"logo":"https://ui-avatars.com/api/?name=Denmark&background=d02a3e&color=ffffff&size=200&font-size=0.4","city":"Denmark","teamName":"Denmark"},
  'england': {"name":"England","league":"world cup","colors":["#ffffff","#4a2942"],"aliases":["eng","engl"],"logo":"https://ui-avatars.com/api/?name=England&background=ffffff&color=4a2942&size=200&font-size=0.4","city":"England","teamName":"England"},
  'estonia': {"name":"Estonia","league":"nations league","colors":["#195ccd","#ffffff"],"aliases":["est","esto"],"logo":"https://ui-avatars.com/api/?name=Estonia&background=195ccd&color=ffffff&size=200&font-size=0.4","city":"Estonia","teamName":"Estonia"},
  'faroe islands': {"name":"Faroe Islands","league":"nations league","colors":["#ffffff","#195ccd"],"aliases":["fi","faroe","islands","faroeislands","far"],"logo":"https://ui-avatars.com/api/?name=Faroe%20Islands&background=ffffff&color=195ccd&size=200&font-size=0.4","city":"Faroe Islands","teamName":"Faroe Islands"},
  'finland': {"name":"Finland","league":"nations league","colors":["#003580","#ffffff"],"aliases":["fin","finl"],"logo":"https://ui-avatars.com/api/?name=Finland&background=003580&color=ffffff&size=200&font-size=0.4","city":"Finland","teamName":"Finland"},
  'france': {"name":"France","league":"world cup","colors":["#0c2fff","#ffffff"],"aliases":["fra","fran"],"logo":"https://ui-avatars.com/api/?name=France&background=0c2fff&color=ffffff&size=200&font-size=0.4","city":"France","teamName":"France"},
  'georgia': {"name":"Georgia","league":"nations league","colors":["#ffffff","#4a2942"],"aliases":["geo","geor"],"logo":"https://ui-avatars.com/api/?name=Georgia&background=ffffff&color=4a2942&size=200&font-size=0.4","city":"Georgia","teamName":"Georgia"},
  'germany': {"name":"Germany","league":"world cup","colors":["#000000","#db41a9"],"aliases":["ger","germ"],"logo":"https://ui-avatars.com/api/?name=Germany&background=000000&color=db41a9&size=200&font-size=0.4","city":"Germany","teamName":"Germany"},
  'gibraltar': {"name":"Gibraltar","league":"nations league","colors":["#DE2918","#ffffff"],"aliases":["gib","gibr"],"logo":"https://ui-avatars.com/api/?name=Gibraltar&background=DE2918&color=ffffff&size=200&font-size=0.4","city":"Gibraltar","teamName":"Gibraltar"},
  'greece': {"name":"Greece","league":"nations league","colors":["#295da8","#ffffff"],"aliases":["gre","gree"],"logo":"https://ui-avatars.com/api/?name=Greece&background=295da8&color=ffffff&size=200&font-size=0.4","city":"Greece","teamName":"Greece"},
  'hungary': {"name":"Hungary","league":"nations league","colors":["#ce2029","#ffffff"],"aliases":["hun","hung"],"logo":"https://ui-avatars.com/api/?name=Hungary&background=ce2029&color=ffffff&size=200&font-size=0.4","city":"Hungary","teamName":"Hungary"},
  'iceland': {"name":"Iceland","league":"nations league","colors":["#0c2fff","#ffffff"],"aliases":["ice","icel"],"logo":"https://ui-avatars.com/api/?name=Iceland&background=0c2fff&color=ffffff&size=200&font-size=0.4","city":"Iceland","teamName":"Iceland"},
  'israel': {"name":"Israel","league":"nations league","colors":["#2f4fa2","#ffffff"],"aliases":["isr","isra"],"logo":"https://ui-avatars.com/api/?name=Israel&background=2f4fa2&color=ffffff&size=200&font-size=0.4","city":"Israel","teamName":"Israel"},
  'italy': {"name":"Italy","league":"world cup","colors":["#103cd6","#ffffff"],"aliases":["ita","ital"],"logo":"https://ui-avatars.com/api/?name=Italy&background=103cd6&color=ffffff&size=200&font-size=0.4","city":"Italy","teamName":"Italy"},
  'kazakhstan': {"name":"Kazakhstan","league":"nations league","colors":["#00abc2","#ffec2d"],"aliases":["kaz","kaza"],"logo":"https://ui-avatars.com/api/?name=Kazakhstan&background=00abc2&color=ffec2d&size=200&font-size=0.4","city":"Kazakhstan","teamName":"Kazakhstan"},
  'kosovo': {"name":"Kosovo","league":"nations league","colors":["#0000cd","#ffec00"],"logo":"https://a.espncdn.com/i/teamlogos/countries/500/kosovo.png","aliases":["kos","koso"],"city":"Kosovo","teamName":"Kosovo"},
  'latvia': {"name":"Latvia","league":"nations league","colors":["#992242","#ffffff"],"aliases":["lat","latv"],"logo":"https://ui-avatars.com/api/?name=Latvia&background=992242&color=ffffff&size=200&font-size=0.4","city":"Latvia","teamName":"Latvia"},
  'liechtenstein': {"name":"Liechtenstein","league":"nations league","colors":["#0000cd","#E70000"],"aliases":["lie","liec"],"logo":"https://ui-avatars.com/api/?name=Liechtenstein&background=0000cd&color=E70000&size=200&font-size=0.4","city":"Liechtenstein","teamName":"Liechtenstein"},
  'lithuania': {"name":"Lithuania","league":"nations league","colors":["#ffe400","#DE2918"],"aliases":["lit","lith"],"logo":"https://ui-avatars.com/api/?name=Lithuania&background=ffe400&color=DE2918&size=200&font-size=0.4","city":"Lithuania","teamName":"Lithuania"},
  'luxembourg': {"name":"Luxembourg","league":"nations league","colors":["#E70000","#ffffff"],"aliases":["lux","luxe"],"logo":"https://ui-avatars.com/api/?name=Luxembourg&background=E70000&color=ffffff&size=200&font-size=0.4","city":"Luxembourg","teamName":"Luxembourg"},
  'malta': {"name":"Malta","league":"nations league","colors":["#DE2400","#ffffff"],"aliases":["mal","malt"],"logo":"https://ui-avatars.com/api/?name=Malta&background=DE2400&color=ffffff&size=200&font-size=0.4","city":"Malta","teamName":"Malta"},
  'moldova': {"name":"Moldova","league":"nations league","colors":["#0046ae","#ffd200"],"aliases":["mol","mold"],"logo":"https://ui-avatars.com/api/?name=Moldova&background=0046ae&color=ffd200&size=200&font-size=0.4","city":"Moldova","teamName":"Moldova"},
  'montenegro': {"name":"Montenegro","league":"nations league","colors":["#E70000","#ffffff"],"aliases":["mont"],"logo":"https://ui-avatars.com/api/?name=Montenegro&background=E70000&color=ffffff&size=200&font-size=0.4","city":"Montenegro","teamName":"Montenegro"},
  'netherlands': {"name":"Netherlands","league":"world cup","colors":["#fb5d00","#010080"],"aliases":["net","neth"],"logo":"https://ui-avatars.com/api/?name=Netherlands&background=fb5d00&color=010080&size=200&font-size=0.4","city":"Netherlands","teamName":"Netherlands"},
  'north macedonia': {"name":"North Macedonia","league":"nations league","colors":["#E70000","#ddddea"],"aliases":["nm","macedonia","mac"],"logo":"https://ui-avatars.com/api/?name=North%20Macedonia&background=E70000&color=ddddea&size=200&font-size=0.4","city":"North Macedonia","teamName":"North Macedonia"},
  'northern ireland': {"name":"Northern Ireland","league":"nations league","colors":["#cc0000","#ffffff"],"aliases":["ni","northern","ireland","northernireland","nor"],"logo":"https://ui-avatars.com/api/?name=Northern%20Ireland&background=cc0000&color=ffffff&size=200&font-size=0.4","city":"Northern Ireland","teamName":"Northern Ireland"},
  'norway': {"name":"Norway","league":"nations league","colors":["#ef2b2d","#002868"],"aliases":["nor","norw"],"logo":"https://ui-avatars.com/api/?name=Norway&background=ef2b2d&color=002868&size=200&font-size=0.4","city":"Norway","teamName":"Norway"},
  'poland': {"name":"Poland","league":"nations league","colors":["#ffffff","#dc143c"],"aliases":["pol","pola"],"logo":"https://ui-avatars.com/api/?name=Poland&background=ffffff&color=dc143c&size=200&font-size=0.4","city":"Poland","teamName":"Poland"},
  'portugal': {"name":"Portugal","league":"world cup","colors":["#da291c","#d7e9f6"],"aliases":["por","port"],"logo":"https://ui-avatars.com/api/?name=Portugal&background=da291c&color=d7e9f6&size=200&font-size=0.4","city":"Portugal","teamName":"Portugal"},
  'republic of ireland': {"name":"Republic of Ireland","league":"nations league","colors":["#049a64","#f58241"],"aliases":["roi","republic","ireland","republicireland","republic ireland","rep"],"logo":"https://ui-avatars.com/api/?name=Republic%20of%20Ireland&background=049a64&color=f58241&size=200&font-size=0.4","city":"Republic of Ireland","teamName":"Republic of Ireland"},
  'romania': {"name":"Romania","league":"nations league","colors":["#fcd116","#ce1126"],"aliases":["rom","roma"],"logo":"https://ui-avatars.com/api/?name=Romania&background=fcd116&color=ce1126&size=200&font-size=0.4","city":"Romania","teamName":"Romania"},
  'san marino': {"name":"San Marino","league":"nations league","colors":["#00bfff","#ffffff"],"aliases":["sm","san","marino","sanmarino"],"logo":"https://ui-avatars.com/api/?name=San%20Marino&background=00bfff&color=ffffff&size=200&font-size=0.4","city":"San","teamName":"Marino"},
  'scotland': {"name":"Scotland","league":"nations league","colors":["#1a2d69","#dcf5f7"],"aliases":["sco","scot"],"logo":"https://ui-avatars.com/api/?name=Scotland&background=1a2d69&color=dcf5f7&size=200&font-size=0.4","city":"Scotland","teamName":"Scotland"},
  'serbia': {"name":"Serbia","league":"nations league","colors":["#E70000","#ffffff"],"aliases":["ser","serb"],"logo":"https://ui-avatars.com/api/?name=Serbia&background=E70000&color=ffffff&size=200&font-size=0.4","city":"Serbia","teamName":"Serbia"},
  'slovakia': {"name":"Slovakia","league":"nations league","colors":["#0c2fff","#ffffff"],"aliases":["slo","slov"],"logo":"https://ui-avatars.com/api/?name=Slovakia&background=0c2fff&color=ffffff&size=200&font-size=0.4","city":"Slovakia","teamName":"Slovakia"},
  'slovenia': {"name":"Slovenia","league":"nations league","colors":["#ffffff","#0c2fff"],"aliases":["slo","slov"],"logo":"https://ui-avatars.com/api/?name=Slovenia&background=ffffff&color=0c2fff&size=200&font-size=0.4","city":"Slovenia","teamName":"Slovenia"},
  'spain': {"name":"Spain","league":"world cup","colors":["#c60b1e","#f1ff91"],"aliases":["spa","spai"],"logo":"https://ui-avatars.com/api/?name=Spain&background=c60b1e&color=f1ff91&size=200&font-size=0.4","city":"Spain","teamName":"Spain"},
  'sweden': {"name":"Sweden","league":"nations league","colors":["#fecb00","#006aa7"],"aliases":["swe","swed"],"logo":"https://ui-avatars.com/api/?name=Sweden&background=fecb00&color=006aa7&size=200&font-size=0.4","city":"Sweden","teamName":"Sweden"},
  'switzerland': {"name":"Switzerland","league":"nations league","colors":["#d72b2c","#ffffff"],"aliases":["swi","swit"],"logo":"https://ui-avatars.com/api/?name=Switzerland&background=d72b2c&color=ffffff&size=200&font-size=0.4","city":"Switzerland","teamName":"Switzerland"},
  'türkiye': {"name":"Türkiye","league":"nations league","colors":["#ffffff","#ef3340"],"aliases":["tur","turk"],"logo":"https://ui-avatars.com/api/?name=T%C3%BCrkiye&background=ffffff&color=ef3340&size=200&font-size=0.4","city":"Türkiye","teamName":"Türkiye"},
  'ukraine': {"name":"Ukraine","league":"nations league","colors":["#fede00","#0c2fff"],"aliases":["ukr","ukra"],"logo":"https://ui-avatars.com/api/?name=Ukraine&background=fede00&color=0c2fff&size=200&font-size=0.4","city":"Ukraine","teamName":"Ukraine"},
  'wales': {"name":"Wales","league":"nations league","colors":["#E70000","#174A3F"],"aliases":["wal","wale"],"logo":"https://ui-avatars.com/api/?name=Wales&background=E70000&color=174A3F&size=200&font-size=0.4","city":"Wales","teamName":"Wales"},
  'afc telford united': {"name":"AFC Telford United","league":"fa cup","colors":["#000000","#FFFFFF"],"aliases":["atu","telford","tel"],"logo":"https://ui-avatars.com/api/?name=AFC%20Telford%20United&background=000000&color=FFFFFF&size=200&font-size=0.4","city":"AFC Telford United","teamName":"AFC Telford United"},
  'afc totton': {"name":"AFC Totton","league":"fa cup","colors":["#000000","#000000"],"aliases":["at","totton","tot"],"logo":"https://ui-avatars.com/api/?name=AFC%20Totton&background=000000&color=000000&size=200&font-size=0.4","city":"AFC Totton","teamName":"AFC Totton"},
  'afc wimbledon': {"name":"AFC Wimbledon","league":"league cup","colors":["#0000d4","#ffff00"],"aliases":["aw","wimbledon","wim"],"logo":"https://ui-avatars.com/api/?name=AFC%20Wimbledon&background=0000d4&color=ffff00&size=200&font-size=0.4","city":"AFC Wimbledon","teamName":"AFC Wimbledon"},
  'accrington stanley': {"name":"Accrington Stanley","league":"league cup","colors":["#C8142F","#5CBFEB"],"aliases":["accrington","stanley","accringtonstanley","acc"],"logo":"https://ui-avatars.com/api/?name=Accrington%20Stanley&background=C8142F&color=5CBFEB&size=200&font-size=0.4","city":"Accrington Stanley","teamName":"Accrington Stanley"},
  'aldershot town': {"name":"Aldershot Town","league":"fa cup","colors":["#C8142F","#cdff00"],"aliases":["at","aldershot","ald"],"logo":"https://ui-avatars.com/api/?name=Aldershot%20Town&background=C8142F&color=cdff00&size=200&font-size=0.4","city":"Aldershot Town","teamName":"Aldershot Town"},
  'altrincham': {"name":"Altrincham","league":"fa cup","colors":["#C8142F","#cdcdcd"],"aliases":["alt","altr"],"logo":"https://ui-avatars.com/api/?name=Altrincham&background=C8142F&color=cdcdcd&size=200&font-size=0.4","city":"Altrincham","teamName":"Altrincham"},
  'barnet': {"name":"Barnet","league":"league cup","colors":["#fe7a00","#ffffff"],"aliases":["bar","barn"],"logo":"https://ui-avatars.com/api/?name=Barnet&background=fe7a00&color=ffffff&size=200&font-size=0.4","city":"Barnet","teamName":"Barnet"},
  'barnsley': {"name":"Barnsley","league":"league cup","colors":["#f42727","#065035"],"aliases":["bar","barn"],"logo":"https://ui-avatars.com/api/?name=Barnsley&background=f42727&color=065035&size=200&font-size=0.4","city":"Barnsley","teamName":"Barnsley"},
  'barrow': {"name":"Barrow","league":"league cup","colors":["#ffffff","#deb887"],"aliases":["bar","barr"],"logo":"https://ui-avatars.com/api/?name=Barrow&background=ffffff&color=deb887&size=200&font-size=0.4","city":"Barrow","teamName":"Barrow"},
  'birmingham city': {"name":"Birmingham City","league":"league cup","colors":["#0000fa","#fe5442"],"aliases":["bc","birmingham","bir"],"logo":"https://ui-avatars.com/api/?name=Birmingham%20City&background=0000fa&color=fe5442&size=200&font-size=0.4","city":"Birmingham","teamName":"City"},
  'blackburn rovers': {"name":"Blackburn Rovers","league":"league cup","colors":["#0000fa","#1a1a1a"],"aliases":["br","blackburn","bla"],"logo":"https://ui-avatars.com/api/?name=Blackburn%20Rovers&background=0000fa&color=1a1a1a&size=200&font-size=0.4","city":"Blackburn Rovers","teamName":"Blackburn Rovers"},
  'blackpool': {"name":"Blackpool","league":"league cup","colors":["#F5A12D","#ffffff"],"aliases":["bla","blac"],"logo":"https://ui-avatars.com/api/?name=Blackpool&background=F5A12D&color=ffffff&size=200&font-size=0.4","city":"Blackpool","teamName":"Blackpool"},
  'bolton wanderers': {"name":"Bolton Wanderers","league":"league cup","colors":["#ffffff","#1a1a1a"],"aliases":["bw","bolton","bol"],"logo":"https://ui-avatars.com/api/?name=Bolton%20Wanderers&background=ffffff&color=1a1a1a&size=200&font-size=0.4","city":"Bolton Wanderers","teamName":"Bolton Wanderers"},
  'boreham wood': {"name":"Boreham Wood","league":"fa cup","colors":["#ffffff","#aeeaff"],"aliases":["bw","boreham","wood","borehamwood","bor"],"logo":"https://ui-avatars.com/api/?name=Boreham%20Wood&background=ffffff&color=aeeaff&size=200&font-size=0.4","city":"Boreham Wood","teamName":"Boreham Wood"},
  'brackley town': {"name":"Brackley Town","league":"fa cup","colors":["#C60000","#ffff00"],"aliases":["bt","brackley","bra"],"logo":"https://ui-avatars.com/api/?name=Brackley%20Town&background=C60000&color=ffff00&size=200&font-size=0.4","city":"Brackley Town","teamName":"Brackley Town"},
  'bradford city': {"name":"Bradford City","league":"league cup","colors":["#890000","#ffffff"],"aliases":["bc","bradford","bra"],"logo":"https://ui-avatars.com/api/?name=Bradford%20City&background=890000&color=ffffff&size=200&font-size=0.4","city":"Bradford","teamName":"City"},
  'braintree town': {"name":"Braintree Town","league":"fa cup","colors":["#FF6600","#000099"],"aliases":["bt","braintree","bra"],"logo":"https://ui-avatars.com/api/?name=Braintree%20Town&background=FF6600&color=000099&size=200&font-size=0.4","city":"Braintree Town","teamName":"Braintree Town"},
  'bristol city': {"name":"Bristol City","league":"league cup","colors":["#f42727","#ffffff"],"aliases":["bc","bristol","bri"],"logo":"https://ui-avatars.com/api/?name=Bristol%20City&background=f42727&color=ffffff&size=200&font-size=0.4","city":"Bristol","teamName":"City"},
  'bristol rovers': {"name":"Bristol Rovers","league":"league cup","colors":["#000099","#425679"],"aliases":["br","bristol","bri"],"logo":"https://ui-avatars.com/api/?name=Bristol%20Rovers&background=000099&color=425679&size=200&font-size=0.4","city":"Bristol","teamName":"Rovers"},
  'bromley': {"name":"Bromley","league":"league cup","colors":["#ffffff","#C60000"],"aliases":["bro","brom"],"logo":"https://ui-avatars.com/api/?name=Bromley&background=ffffff&color=C60000&size=200&font-size=0.4","city":"Bromley","teamName":"Bromley"},
  'burton albion': {"name":"Burton Albion","league":"league cup","colors":["#ffff00","#ffffff"],"aliases":["ba","burton","bur"],"logo":"https://ui-avatars.com/api/?name=Burton%20Albion&background=ffff00&color=ffffff&size=200&font-size=0.4","city":"Burton Albion","teamName":"Burton Albion"},
  'buxton': {"name":"Buxton","league":"fa cup","colors":["#000080","#964B00"],"aliases":["bux","buxt"],"logo":"https://ui-avatars.com/api/?name=Buxton&background=000080&color=964B00&size=200&font-size=0.4","city":"Buxton","teamName":"Buxton"},
  'cambridge united': {"name":"Cambridge United","league":"league cup","colors":["#FECD32","#82dbf5"],"aliases":["cu","cambridge","cam"],"logo":"https://ui-avatars.com/api/?name=Cambridge%20United&background=FECD32&color=82dbf5&size=200&font-size=0.4","city":"Cambridge United","teamName":"Cambridge United"},
  'cardiff city': {"name":"Cardiff City","league":"league cup","colors":["#0000fa","#c6d4db"],"aliases":["cc","cardiff","car"],"logo":"https://ui-avatars.com/api/?name=Cardiff%20City&background=0000fa&color=c6d4db&size=200&font-size=0.4","city":"Cardiff","teamName":"City"},
  'carlisle united': {"name":"Carlisle United","league":"fa cup","colors":["#0e00f7","#b0ffe1"],"aliases":["cu","carlisle","car"],"logo":"https://ui-avatars.com/api/?name=Carlisle%20United&background=0e00f7&color=b0ffe1&size=200&font-size=0.4","city":"Carlisle United","teamName":"Carlisle United"},
  'charlton athletic': {"name":"Charlton Athletic","league":"league cup","colors":["#C8142F","#020202"],"aliases":["ca","charlton","cha"],"logo":"https://ui-avatars.com/api/?name=Charlton%20Athletic&background=C8142F&color=020202&size=200&font-size=0.4","city":"Charlton Athletic","teamName":"Charlton Athletic"},
  'chatham town': {"name":"Chatham Town","league":"fa cup","colors":["#C60000","#ffffff"],"aliases":["ct","chatham","cha"],"logo":"https://ui-avatars.com/api/?name=Chatham%20Town&background=C60000&color=ffffff&size=200&font-size=0.4","city":"Chatham Town","teamName":"Chatham Town"},
  'chelmsford': {"name":"Chelmsford","league":"fa cup","colors":["#800000","#FFFFFF"],"aliases":["che","chel"],"logo":"https://ui-avatars.com/api/?name=Chelmsford&background=800000&color=FFFFFF&size=200&font-size=0.4","city":"Chelmsford","teamName":"Chelmsford"},
  'cheltenham town': {"name":"Cheltenham Town","league":"league cup","colors":["#C8142F","#82dbf5"],"aliases":["ct","cheltenham","che"],"logo":"https://ui-avatars.com/api/?name=Cheltenham%20Town&background=C8142F&color=82dbf5&size=200&font-size=0.4","city":"Cheltenham Town","teamName":"Cheltenham Town"},
  'chester fc': {"name":"Chester FC","league":"fa cup","colors":["#2D55B7","#C60000"],"aliases":["chester","che"],"logo":"https://ui-avatars.com/api/?name=Chester%20FC&background=2D55B7&color=C60000&size=200&font-size=0.4","city":"FC","teamName":"Chester"},
  'chesterfield': {"name":"Chesterfield","league":"league cup","colors":["#000099","#1a1a1a"],"aliases":["che","ches"],"logo":"https://ui-avatars.com/api/?name=Chesterfield&background=000099&color=1a1a1a&size=200&font-size=0.4","city":"Chesterfield","teamName":"Chesterfield"},
  'colchester united': {"name":"Colchester United","league":"league cup","colors":["#0e00f7","#1a1a1a"],"aliases":["cu","colchester","col"],"logo":"https://ui-avatars.com/api/?name=Colchester%20United&background=0e00f7&color=1a1a1a&size=200&font-size=0.4","city":"Colchester United","teamName":"Colchester United"},
  'coventry city': {"name":"Coventry City","league":"league cup","colors":["#87cced","#ffffff"],"aliases":["cc","coventry","cov"],"logo":"https://ui-avatars.com/api/?name=Coventry%20City&background=87cced&color=ffffff&size=200&font-size=0.4","city":"Coventry","teamName":"City"},
  'crawley town': {"name":"Crawley Town","league":"league cup","colors":["#C8142F","#ffffff"],"aliases":["ct","crawley","cra"],"logo":"https://ui-avatars.com/api/?name=Crawley%20Town&background=C8142F&color=ffffff&size=200&font-size=0.4","city":"Crawley Town","teamName":"Crawley Town"},
  'crewe alexandra': {"name":"Crewe Alexandra","league":"league cup","colors":["#C8142F","#FECD32"],"aliases":["ca","crewe","alexandra","crewealexandra","cre"],"logo":"https://ui-avatars.com/api/?name=Crewe%20Alexandra&background=C8142F&color=FECD32&size=200&font-size=0.4","city":"Crewe Alexandra","teamName":"Crewe Alexandra"},
  'derby county': {"name":"Derby County","league":"league cup","colors":["#ffffff","#abebc5"],"aliases":["dc","derby","der"],"logo":"https://ui-avatars.com/api/?name=Derby%20County&background=ffffff&color=abebc5&size=200&font-size=0.4","city":"Derby County","teamName":"Derby County"},
  'doncaster rovers': {"name":"Doncaster Rovers","league":"league cup","colors":["#C8142F","#000099"],"aliases":["dr","doncaster","don"],"logo":"https://ui-avatars.com/api/?name=Doncaster%20Rovers&background=C8142F&color=000099&size=200&font-size=0.4","city":"Doncaster Rovers","teamName":"Doncaster Rovers"},
  'eastleigh': {"name":"Eastleigh","league":"fa cup","colors":["#0000FF","#e1e1e1"],"aliases":["eas","east"],"logo":"https://ui-avatars.com/api/?name=Eastleigh&background=0000FF&color=e1e1e1&size=200&font-size=0.4","city":"Eastleigh","teamName":"Eastleigh"},
  'ebbsfleet united': {"name":"Ebbsfleet United","league":"fa cup","colors":["#C8142F","#0000FF"],"aliases":["eu","ebbsfleet","ebb"],"logo":"https://ui-avatars.com/api/?name=Ebbsfleet%20United&background=C8142F&color=0000FF&size=200&font-size=0.4","city":"Ebbsfleet United","teamName":"Ebbsfleet United"},
  'exeter city': {"name":"Exeter City","league":"league cup","colors":["#C8142F","#ffff00"],"aliases":["ec","exeter","exe"],"logo":"https://ui-avatars.com/api/?name=Exeter%20City&background=C8142F&color=ffff00&size=200&font-size=0.4","city":"Exeter","teamName":"City"},
  'fc halifax town': {"name":"FC Halifax Town","league":"fa cup","colors":["#0000FF","#b9ff4d"],"aliases":["fht","halifax","hal"],"logo":"https://ui-avatars.com/api/?name=FC%20Halifax%20Town&background=0000FF&color=b9ff4d&size=200&font-size=0.4","city":"FC","teamName":"Halifax Town"},
  'fleetwood town': {"name":"Fleetwood Town","league":"league cup","colors":["#C8142F","#ffff00"],"aliases":["ft","fleetwood","fle"],"logo":"https://ui-avatars.com/api/?name=Fleetwood%20Town&background=C8142F&color=ffff00&size=200&font-size=0.4","city":"Fleetwood Town","teamName":"Fleetwood Town"},
  'forest green rovers': {"name":"Forest Green Rovers","league":"fa cup","colors":["#aeff2b","#1a1a1a"],"aliases":["fgr","green","gre"],"logo":"https://ui-avatars.com/api/?name=Forest%20Green%20Rovers&background=aeff2b&color=1a1a1a&size=200&font-size=0.4","city":"Forest Green Rovers","teamName":"Forest Green Rovers"},
  'gainsborough trinity': {"name":"Gainsborough Trinity","league":"fa cup","colors":["#000000","#C60000"],"aliases":["gt","gainsborough","trinity","gainsboroughtrinity","gai"],"logo":"https://ui-avatars.com/api/?name=Gainsborough%20Trinity&background=000000&color=C60000&size=200&font-size=0.4","city":"Gainsborough Trinity","teamName":"Gainsborough Trinity"},
  'gateshead': {"name":"Gateshead","league":"fa cup","colors":["#ffffff","#00fa9a"],"aliases":["gat","gate"],"logo":"https://ui-avatars.com/api/?name=Gateshead&background=ffffff&color=00fa9a&size=200&font-size=0.4","city":"Gateshead","teamName":"Gateshead"},
  'gillingham': {"name":"Gillingham","league":"league cup","colors":["#000099","#C60000"],"aliases":["gil","gill"],"logo":"https://ui-avatars.com/api/?name=Gillingham&background=000099&color=C60000&size=200&font-size=0.4","city":"Gillingham","teamName":"Gillingham"},
  'grimsby town': {"name":"Grimsby Town","league":"league cup","colors":["#1a1a1a","#0e00f7"],"aliases":["gt","grimsby","gri"],"logo":"https://ui-avatars.com/api/?name=Grimsby%20Town&background=1a1a1a&color=0e00f7&size=200&font-size=0.4","city":"Grimsby Town","teamName":"Grimsby Town"},
  'harrogate town': {"name":"Harrogate Town","league":"league cup","colors":["#ffff00","#aeeaff"],"aliases":["ht","harrogate","har"],"logo":"https://ui-avatars.com/api/?name=Harrogate%20Town&background=ffff00&color=aeeaff&size=200&font-size=0.4","city":"Harrogate Town","teamName":"Harrogate Town"},
  'hemel hempstead town': {"name":"Hemel Hempstead Town","league":"fa cup","colors":["#000000","#000000"],"aliases":["hht","hemel","hempstead","hemelhempstead","hemel hempstead","hem"],"logo":"https://ui-avatars.com/api/?name=Hemel%20Hempstead%20Town&background=000000&color=000000&size=200&font-size=0.4","city":"Hemel Hempstead Town","teamName":"Hemel Hempstead Town"},
  'huddersfield town': {"name":"Huddersfield Town","league":"league cup","colors":["#0074d0","#f4e874"],"aliases":["ht","huddersfield","hud"],"logo":"https://ui-avatars.com/api/?name=Huddersfield%20Town&background=0074d0&color=f4e874&size=200&font-size=0.4","city":"Huddersfield Town","teamName":"Huddersfield Town"},
  'hull city': {"name":"Hull City","league":"league cup","colors":["#f28800","#ffffff"],"aliases":["hull","hul"],"logo":"https://ui-avatars.com/api/?name=Hull%20City&background=f28800&color=ffffff&size=200&font-size=0.4","city":"Hull","teamName":"City"},
  'ipswich town': {"name":"Ipswich Town","league":"league cup","colors":["#0000fa","#cd1937"],"aliases":["ips","ipswich","it"],"logo":"https://ui-avatars.com/api/?name=Ipswich%20Town&background=0000fa&color=cd1937&size=200&font-size=0.4","city":"Ipswich Town","teamName":"Ipswich Town"},
  'leicester city': {"name":"Leicester City","league":"league cup","colors":["#0202fb","#000000"],"aliases":["lei","leicester","lc"],"logo":"https://ui-avatars.com/api/?name=Leicester%20City&background=0202fb&color=000000&size=200&font-size=0.4","city":"Leicester","teamName":"City"},
  'leyton orient': {"name":"Leyton Orient","league":"league cup","colors":["#C8142F","#0e00f7"],"aliases":["lo","leyton","orient","leytonorient","ley"],"logo":"https://ui-avatars.com/api/?name=Leyton%20Orient&background=C8142F&color=0e00f7&size=200&font-size=0.4","city":"Leyton Orient","teamName":"Leyton Orient"},
  'lincoln city': {"name":"Lincoln City","league":"league cup","colors":["#C8142F","#c6d4db"],"aliases":["lc","lincoln","lin"],"logo":"https://ui-avatars.com/api/?name=Lincoln%20City&background=C8142F&color=c6d4db&size=200&font-size=0.4","city":"Lincoln","teamName":"City"},
  'luton town': {"name":"Luton Town","league":"league cup","colors":["#ff4f00","#1D428A"],"aliases":["lt","luton","lut"],"logo":"https://ui-avatars.com/api/?name=Luton%20Town&background=ff4f00&color=1D428A&size=200&font-size=0.4","city":"Luton Town","teamName":"Luton Town"},
  'macclesfield fc': {"name":"Macclesfield FC","league":"fa cup","colors":["#01153E","#ffffff"],"aliases":["mf","macclesfield","mac"],"logo":"https://ui-avatars.com/api/?name=Macclesfield%20FC&background=01153E&color=ffffff&size=200&font-size=0.4","city":"FC","teamName":"Macclesfield"},
  'maldon & tiptree': {"name":"Maldon & Tiptree","league":"fa cup","colors":["#C60000","#FECD32"],"aliases":["m&t","maldon","tiptree","maldontiptree","maldon tiptree","mal"],"logo":"https://ui-avatars.com/api/?name=Maldon%20%26%20Tiptree&background=C60000&color=FECD32&size=200&font-size=0.4","city":"Maldon & Tiptree","teamName":"Maldon & Tiptree"},
  'mansfield town': {"name":"Mansfield Town","league":"league cup","colors":["#FECD32","#1a1a1a"],"aliases":["mt","mansfield","man"],"logo":"https://ui-avatars.com/api/?name=Mansfield%20Town&background=FECD32&color=1a1a1a&size=200&font-size=0.4","city":"Mansfield Town","teamName":"Mansfield Town"},
  'middlesbrough': {"name":"Middlesbrough","league":"league cup","colors":["#f42727","#87cced"],"aliases":["mid","midd"],"logo":"https://ui-avatars.com/api/?name=Middlesbrough&background=f42727&color=87cced&size=200&font-size=0.4","city":"Middlesbrough","teamName":"Middlesbrough"},
  'millwall': {"name":"Millwall","league":"league cup","colors":["#091453","#007066"],"aliases":["mil","mill"],"logo":"https://ui-avatars.com/api/?name=Millwall&background=091453&color=007066&size=200&font-size=0.4","city":"Millwall","teamName":"Millwall"},
  'milton keynes dons': {"name":"Milton Keynes Dons","league":"league cup","colors":["#ffffff","#ff4f00"],"aliases":["mkd","milton","keynes","dons","mil"],"logo":"https://ui-avatars.com/api/?name=Milton%20Keynes%20Dons&background=ffffff&color=ff4f00&size=200&font-size=0.4","city":"Milton Keynes Dons","teamName":"Milton Keynes Dons"},
  'newport county': {"name":"Newport County","league":"league cup","colors":["#FECD32","#cdcdcd"],"aliases":["nc","newport","new"],"logo":"https://ui-avatars.com/api/?name=Newport%20County&background=FECD32&color=cdcdcd&size=200&font-size=0.4","city":"Newport County","teamName":"Newport County"},
  'northampton town': {"name":"Northampton Town","league":"league cup","colors":["#8E003B","#1a1a1a"],"aliases":["nt","northampton","nor"],"logo":"https://ui-avatars.com/api/?name=Northampton%20Town&background=8E003B&color=1a1a1a&size=200&font-size=0.4","city":"Northampton Town","teamName":"Northampton Town"},
  'norwich city': {"name":"Norwich City","league":"league cup","colors":["#ffff00","#1D428A"],"aliases":["nc","norwich","nor"],"logo":"https://ui-avatars.com/api/?name=Norwich%20City&background=ffff00&color=1D428A&size=200&font-size=0.4","city":"Norwich","teamName":"City"},
  'notts county': {"name":"Notts County","league":"league cup","colors":["#1a1a1a","#378464"],"aliases":["nc","notts","not"],"logo":"https://ui-avatars.com/api/?name=Notts%20County&background=1a1a1a&color=378464&size=200&font-size=0.4","city":"Notts County","teamName":"Notts County"},
  'oldham athletic': {"name":"Oldham Athletic","league":"league cup","colors":["#0e00f7","#F7AA25"],"aliases":["oa","oldham","old"],"logo":"https://ui-avatars.com/api/?name=Oldham%20Athletic&background=0e00f7&color=F7AA25&size=200&font-size=0.4","city":"Oldham Athletic","teamName":"Oldham Athletic"},
  'oxford united': {"name":"Oxford United","league":"league cup","colors":["#ffff00","#ffffff"],"aliases":["ou","oxford","oxf"],"logo":"https://ui-avatars.com/api/?name=Oxford%20United&background=ffff00&color=ffffff&size=200&font-size=0.4","city":"Oxford United","teamName":"Oxford United"},
  'peterborough united': {"name":"Peterborough United","league":"league cup","colors":["#0000fa","#ebebeb"],"aliases":["pu","peterborough","pet"],"logo":"https://ui-avatars.com/api/?name=Peterborough%20United&background=0000fa&color=ebebeb&size=200&font-size=0.4","city":"Peterborough United","teamName":"Peterborough United"},
  'plymouth argyle': {"name":"Plymouth Argyle","league":"league cup","colors":["#003e00","#ffffff"],"aliases":["pa","plymouth","ply"],"logo":"https://ui-avatars.com/api/?name=Plymouth%20Argyle&background=003e00&color=ffffff&size=200&font-size=0.4","city":"Plymouth Argyle","teamName":"Plymouth Argyle"},
  'port vale': {"name":"Port Vale","league":"league cup","colors":["#ffffff","#FECD32"],"aliases":["pv","port","vale","portvale","por"],"logo":"https://ui-avatars.com/api/?name=Port%20Vale&background=ffffff&color=FECD32&size=200&font-size=0.4","city":"Port Vale","teamName":"Port Vale"},
  'portsmouth': {"name":"Portsmouth","league":"league cup","colors":["#0000fa","#1a1a1a"],"aliases":["por","port"],"logo":"https://ui-avatars.com/api/?name=Portsmouth&background=0000fa&color=1a1a1a&size=200&font-size=0.4","city":"Portsmouth","teamName":"Portsmouth"},
  'preston north end': {"name":"Preston North End","league":"league cup","colors":["#ffffff","#87cced"],"aliases":["pne","preston","pre"],"logo":"https://ui-avatars.com/api/?name=Preston%20North%20End&background=ffffff&color=87cced&size=200&font-size=0.4","city":"Preston North End","teamName":"Preston North End"},
  'queens park rangers': {"name":"Queens Park Rangers","league":"league cup","colors":["#0000d4","#1a1a1a"],"aliases":["qpr","queens","park","rangers","que"],"logo":"https://ui-avatars.com/api/?name=Queens%20Park%20Rangers&background=0000d4&color=1a1a1a&size=200&font-size=0.4","city":"Queens Park Rangers","teamName":"Queens Park Rangers"},
  'reading': {"name":"Reading","league":"league cup","colors":["#0000fa","#e4c8de"],"aliases":["rea","read"],"logo":"https://ui-avatars.com/api/?name=Reading&background=0000fa&color=e4c8de&size=200&font-size=0.4","city":"Reading","teamName":"Reading"},
  'rotherham united': {"name":"Rotherham United","league":"league cup","colors":["#f42727","#1a1a1a"],"aliases":["ru","rotherham","rot"],"logo":"https://ui-avatars.com/api/?name=Rotherham%20United&background=f42727&color=1a1a1a&size=200&font-size=0.4","city":"Rotherham United","teamName":"Rotherham United"},
  'salford city': {"name":"Salford City","league":"league cup","colors":["#C8142F","#ffffff"],"aliases":["salford","sal"],"logo":"https://ui-avatars.com/api/?name=Salford%20City&background=C8142F&color=ffffff&size=200&font-size=0.4","city":"Salford","teamName":"City"},
  'scunthorpe united': {"name":"Scunthorpe United","league":"fa cup","colors":["#82dbf5","#228b22"],"aliases":["su","scunthorpe","scu"],"logo":"https://ui-avatars.com/api/?name=Scunthorpe%20United&background=82dbf5&color=228b22&size=200&font-size=0.4","city":"Scunthorpe United","teamName":"Scunthorpe United"},
  'sheffield united': {"name":"Sheffield United","league":"league cup","colors":["#f42727","#1D428A"],"aliases":["su","sheffield","she"],"logo":"https://ui-avatars.com/api/?name=Sheffield%20United&background=f42727&color=1D428A&size=200&font-size=0.4","city":"Sheffield","teamName":"United"},
  'sheffield wednesday': {"name":"Sheffield Wednesday","league":"league cup","colors":["#0000ff","#ff4f00"],"aliases":["sw","sheffield","she"],"logo":"https://ui-avatars.com/api/?name=Sheffield%20Wednesday&background=0000ff&color=ff4f00&size=200&font-size=0.4","city":"Sheffield","teamName":"Wednesday"},
  'shrewsbury town': {"name":"Shrewsbury Town","league":"league cup","colors":["#0000fa","#29088a"],"aliases":["st","shrewsbury","shr"],"logo":"https://ui-avatars.com/api/?name=Shrewsbury%20Town&background=0000fa&color=29088a&size=200&font-size=0.4","city":"Shrewsbury Town","teamName":"Shrewsbury Town"},
  'slough town': {"name":"Slough Town","league":"fa cup","colors":["#000000","#000000"],"aliases":["st","slough","slo"],"logo":"https://ui-avatars.com/api/?name=Slough%20Town&background=000000&color=000000&size=200&font-size=0.4","city":"Slough Town","teamName":"Slough Town"},
  'south shields': {"name":"South Shields","league":"fa cup","colors":["#000000","#C60000"],"aliases":["ss","south","shields","southshields","sou"],"logo":"https://ui-avatars.com/api/?name=South%20Shields&background=000000&color=C60000&size=200&font-size=0.4","city":"South Shields","teamName":"South Shields"},
  'southampton': {"name":"Southampton","league":"league cup","colors":["#ED1A3B","#f1ee13"],"aliases":["sou","sout"],"logo":"https://ui-avatars.com/api/?name=Southampton&background=ED1A3B&color=f1ee13&size=200&font-size=0.4","city":"Southampton","teamName":"Southampton"},
  'southend united': {"name":"Southend United","league":"fa cup","colors":["#000099","#ffde00"],"aliases":["su","southend","sou"],"logo":"https://ui-avatars.com/api/?name=Southend%20United&background=000099&color=ffde00&size=200&font-size=0.4","city":"Southend United","teamName":"Southend United"},
  'spennymoor town': {"name":"Spennymoor Town","league":"fa cup","colors":["#000000","#C60000"],"aliases":["st","spennymoor","spe"],"logo":"https://ui-avatars.com/api/?name=Spennymoor%20Town&background=000000&color=C60000&size=200&font-size=0.4","city":"Spennymoor Town","teamName":"Spennymoor Town"},
  'st albans city': {"name":"St Albans City","league":"fa cup","colors":["#000000","#C60000"],"aliases":["sac","albans","alb"],"logo":"https://ui-avatars.com/api/?name=St%20Albans%20City&background=000000&color=C60000&size=200&font-size=0.4","city":"St Albans","teamName":"City"},
  'stevenage': {"name":"Stevenage","league":"league cup","colors":["#ffffff","#091453"],"aliases":["ste","stev"],"logo":"https://ui-avatars.com/api/?name=Stevenage&background=ffffff&color=091453&size=200&font-size=0.4","city":"Stevenage","teamName":"Stevenage"},
  'stockport county': {"name":"Stockport County","league":"league cup","colors":["#0000FF","#ffffff"],"aliases":["stockport","sto"],"logo":"https://ui-avatars.com/api/?name=Stockport%20County&background=0000FF&color=ffffff&size=200&font-size=0.4","city":"Stockport County","teamName":"Stockport County"},
  'stoke city': {"name":"Stoke City","league":"league cup","colors":["#f42727","#1a1a1a"],"aliases":["stoke","sto"],"logo":"https://ui-avatars.com/api/?name=Stoke%20City&background=f42727&color=1a1a1a&size=200&font-size=0.4","city":"Stoke","teamName":"City"},
  'sutton united': {"name":"Sutton United","league":"fa cup","colors":["#ffd700","#ffffff"],"aliases":["su","sutton","sut"],"logo":"https://ui-avatars.com/api/?name=Sutton%20United&background=ffd700&color=ffffff&size=200&font-size=0.4","city":"Sutton United","teamName":"Sutton United"},
  'swansea city': {"name":"Swansea City","league":"league cup","colors":["#ffffff","#1D428A"],"aliases":["swansea","swa"],"logo":"https://ui-avatars.com/api/?name=Swansea%20City&background=ffffff&color=1D428A&size=200&font-size=0.4","city":"Swansea","teamName":"City"},
  'swindon town': {"name":"Swindon Town","league":"league cup","colors":["#C8142F","#cdcdcd"],"aliases":["st","swindon","swi"],"logo":"https://ui-avatars.com/api/?name=Swindon%20Town&background=C8142F&color=cdcdcd&size=200&font-size=0.4","city":"Swindon Town","teamName":"Swindon Town"},
  'tamworth': {"name":"Tamworth","league":"fa cup","colors":["#C8142F","#000000"],"aliases":["tam","tamw"],"logo":"https://ui-avatars.com/api/?name=Tamworth&background=C8142F&color=000000&size=200&font-size=0.4","city":"Tamworth","teamName":"Tamworth"},
  'tranmere rovers': {"name":"Tranmere Rovers","league":"league cup","colors":["#ffffff","#4c00b3"],"aliases":["tr","tranmere","tra"],"logo":"https://ui-avatars.com/api/?name=Tranmere%20Rovers&background=ffffff&color=4c00b3&size=200&font-size=0.4","city":"Tranmere Rovers","teamName":"Tranmere Rovers"},
  'walsall': {"name":"Walsall","league":"league cup","colors":["#C8142F","#74f544"],"aliases":["wal","wals"],"logo":"https://ui-avatars.com/api/?name=Walsall&background=C8142F&color=74f544&size=200&font-size=0.4","city":"Walsall","teamName":"Walsall"},
  'watford': {"name":"Watford","league":"league cup","colors":["#ffff00","#1D428A"],"aliases":["wat","watf"],"logo":"https://ui-avatars.com/api/?name=Watford&background=ffff00&color=1D428A&size=200&font-size=0.4","city":"Watford","teamName":"Watford"},
  'wealdstone': {"name":"Wealdstone","league":"fa cup","colors":["#000000","#000000"],"aliases":["wea","weal"],"logo":"https://ui-avatars.com/api/?name=Wealdstone&background=000000&color=000000&size=200&font-size=0.4","city":"Wealdstone","teamName":"Wealdstone"},
  'west bromwich albion': {"name":"West Bromwich Albion","league":"league cup","colors":["#091453","#ffff00"],"aliases":["wba","west","bromwich","westbromwich","west bromwich","wes"],"logo":"https://ui-avatars.com/api/?name=West%20Bromwich%20Albion&background=091453&color=ffff00&size=200&font-size=0.4","city":"West Bromwich Albion","teamName":"West Bromwich Albion"},
  'weston-super-mare': {"name":"Weston-super-Mare","league":"fa cup","colors":["#000000","#C60000"],"aliases":["wes","west"],"logo":"https://ui-avatars.com/api/?name=Weston-super-Mare&background=000000&color=C60000&size=200&font-size=0.4","city":"Weston-super-Mare","teamName":"Weston-super-Mare"},
  'wigan athletic': {"name":"Wigan Athletic","league":"league cup","colors":["#0000fa","#1a1a1a"],"aliases":["wa","wigan","wig"],"logo":"https://ui-avatars.com/api/?name=Wigan%20Athletic&background=0000fa&color=1a1a1a&size=200&font-size=0.4","city":"Wigan Athletic","teamName":"Wigan Athletic"},
  'wrexham': {"name":"Wrexham","league":"league cup","colors":["#C8142F","#ffffff"],"aliases":["wre","wrex"],"logo":"https://ui-avatars.com/api/?name=Wrexham&background=C8142F&color=ffffff&size=200&font-size=0.4","city":"Wrexham","teamName":"Wrexham"},
  'wycombe wanderers': {"name":"Wycombe Wanderers","league":"league cup","colors":["#4cb8e5","#ffff00"],"aliases":["ww","wycombe","wyc"],"logo":"https://ui-avatars.com/api/?name=Wycombe%20Wanderers&background=4cb8e5&color=ffff00&size=200&font-size=0.4","city":"Wycombe Wanderers","teamName":"Wycombe Wanderers"},
  'york city': {"name":"York City","league":"fa cup","colors":["#C8142F","#C60000"],"aliases":["yc","york","yor"],"logo":"https://ui-avatars.com/api/?name=York%20City&background=C8142F&color=C60000&size=200&font-size=0.4","city":"York","teamName":"City"},
  'albacete': {"name":"Albacete","league":["la liga", "copa del rey"],"colors":["#BC0814","#C60000"],"aliases":["alb","alba"],"logo":"https://ui-avatars.com/api/?name=Albacete&background=BC0814&color=C60000&size=200&font-size=0.4","city":"Albacete","teamName":"Albacete"},
  'alberite': {"name":"Alberite","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["alb","albe"],"logo":"https://ui-avatars.com/api/?name=Alberite&background=000000&color=C60000&size=200&font-size=0.4","city":"Alberite","teamName":"Alberite"},
  'alcalá': {"name":"Alcalá","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["alc","alca"],"logo":"https://ui-avatars.com/api/?name=Alcal%C3%A1&background=000000&color=C60000&size=200&font-size=0.4","city":"Alcalá","teamName":"Alcalá"},
  'almería': {"name":"Almería","league":["la liga", "copa del rey"],"colors":["#C8142F","#1a1a1a"],"aliases":["alm","alme"],"logo":"https://ui-avatars.com/api/?name=Almer%C3%ADa&background=C8142F&color=1a1a1a&size=200&font-size=0.4","city":"Almería","teamName":"Almería"},
  'antequera cf': {"name":"Antequera CF","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["antequera","ant"],"logo":"https://ui-avatars.com/api/?name=Antequera%20CF&background=000000&color=C60000&size=200&font-size=0.4","city":"Antequera CF","teamName":"Antequera CF"},
  'arenas club': {"name":"Arenas Club","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["arenas","are"],"logo":"https://ui-avatars.com/api/?name=Arenas%20Club&background=000000&color=C60000&size=200&font-size=0.4","city":"Arenas Club","teamName":"Arenas Club"},
  'atletico astorga': {"name":"Atletico Astorga","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["aa","atletico","astorga","atleticoastorga","atl"],"logo":"https://ui-avatars.com/api/?name=Atletico%20Astorga&background=000000&color=C60000&size=200&font-size=0.4","city":"Atletico","teamName":"Astorga"},
  'atlètic lleida': {"name":"Atlètic Lleida","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["al","atletic","lleida","atleticlleida","atl"],"logo":"https://ui-avatars.com/api/?name=Atl%C3%A8tic%20Lleida&background=000000&color=C60000&size=200&font-size=0.4","city":"Atlètic Lleida","teamName":"Atlètic Lleida"},
  'atlètic sant just': {"name":"Atlètic Sant Just","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["asj","atletic","sant","just","atl"],"logo":"https://ui-avatars.com/api/?name=Atl%C3%A8tic%20Sant%20Just&background=000000&color=C60000&size=200&font-size=0.4","city":"Atlètic Sant Just","teamName":"Atlètic Sant Just"},
  'atlético baleares': {"name":"Atlético Baleares","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["ab","atletico","baleares","atleticobaleares","atl"],"logo":"https://ui-avatars.com/api/?name=Atl%C3%A9tico%20Baleares&background=000000&color=C60000&size=200&font-size=0.4","city":"Atlético Baleares","teamName":"Atlético Baleares"},
  'atlético calatayud': {"name":"Atlético Calatayud","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["atletico","calatayud","atleticocalatayud","atl"],"logo":"https://ui-avatars.com/api/?name=Atl%C3%A9tico%20Calatayud&background=000000&color=C60000&size=200&font-size=0.4","city":"Atlético Calatayud","teamName":"Atlético Calatayud"},
  'atlético melilla': {"name":"Atlético Melilla","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["am","atletico","melilla","atleticomelilla","atl"],"logo":"https://ui-avatars.com/api/?name=Atl%C3%A9tico%20Melilla&background=000000&color=C60000&size=200&font-size=0.4","city":"Atlético Melilla","teamName":"Atlético Melilla"},
  'atlético tordesillas': {"name":"Atlético Tordesillas","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["at","atletico","tordesillas","atleticotordesillas","atl"],"logo":"https://ui-avatars.com/api/?name=Atl%C3%A9tico%20Tordesillas&background=000000&color=C60000&size=200&font-size=0.4","city":"Atlético Tordesillas","teamName":"Atlético Tordesillas"},
  'azuaga': {"name":"Azuaga","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["azu","azua"],"logo":"https://ui-avatars.com/api/?name=Azuaga&background=000000&color=C60000&size=200&font-size=0.4","city":"Azuaga","teamName":"Azuaga"},
  'betis cf': {"name":"Betis CF","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["bc","betis","bet"],"logo":"https://ui-avatars.com/api/?name=Betis%20CF&background=000000&color=C60000&size=200&font-size=0.4","city":"Betis CF","teamName":"Betis CF"},
  'burgos': {"name":"Burgos","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["bur","burg"],"logo":"https://ui-avatars.com/api/?name=Burgos&background=000000&color=C60000&size=200&font-size=0.4","city":"Burgos","teamName":"Burgos"},
  'cd artistico navalcarnero': {"name":"CD Artistico Navalcarnero","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["can","artistico","navalcarnero","artisticonavalcarnero","artistico navalcarnero","art"],"logo":"https://ui-avatars.com/api/?name=CD%20Artistico%20Navalcarnero&background=000000&color=C60000&size=200&font-size=0.4","city":"CD Artistico Navalcarnero","teamName":"CD Artistico Navalcarnero"},
  'cd ebro': {"name":"CD Ebro","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["ce","ebro","ebr"],"logo":"https://ui-avatars.com/api/?name=CD%20Ebro&background=000000&color=C60000&size=200&font-size=0.4","city":"CD Ebro","teamName":"CD Ebro"},
  'cd estepona': {"name":"CD Estepona","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["ce","estepona","est"],"logo":"https://ui-avatars.com/api/?name=CD%20Estepona&background=000000&color=C60000&size=200&font-size=0.4","city":"CD Estepona","teamName":"CD Estepona"},
  'cd extremadura': {"name":"CD Extremadura","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["ce","extremadura","ext"],"logo":"https://ui-avatars.com/api/?name=CD%20Extremadura&background=000000&color=C60000&size=200&font-size=0.4","city":"CD Extremadura","teamName":"CD Extremadura"},
  'cd guadalajara': {"name":"CD Guadalajara","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["cg","guadalajara","gua"],"logo":"https://ui-avatars.com/api/?name=CD%20Guadalajara&background=000000&color=C60000&size=200&font-size=0.4","city":"CD Guadalajara","teamName":"CD Guadalajara"},
  'cd sabadell': {"name":"CD Sabadell","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["cs","sabadell","sab"],"logo":"https://ui-avatars.com/api/?name=CD%20Sabadell&background=000000&color=C60000&size=200&font-size=0.4","city":"CD Sabadell","teamName":"CD Sabadell"},
  'ce europa': {"name":"CE Europa","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["ce","europa","eur"],"logo":"https://ui-avatars.com/api/?name=CE%20Europa&background=000000&color=C60000&size=200&font-size=0.4","city":"CE Europa","teamName":"CE Europa"},
  'ce sant jordi': {"name":"CE Sant Jordi","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["csj","sant","jordi","santjordi","sant jordi","san"],"logo":"https://ui-avatars.com/api/?name=CE%20Sant%20Jordi&background=000000&color=C60000&size=200&font-size=0.4","city":"CE Sant Jordi","teamName":"CE Sant Jordi"},
  'cacereno': {"name":"Cacereno","league":["la liga", "copa del rey"],"colors":["#000000","#000000"],"aliases":["cac","cace"],"logo":"https://ui-avatars.com/api/?name=Cacereno&background=000000&color=000000&size=200&font-size=0.4","city":"Cacereno","teamName":"Cacereno"},
  'campanario': {"name":"Campanario","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["cam","camp"],"logo":"https://ui-avatars.com/api/?name=Campanario&background=000000&color=C60000&size=200&font-size=0.4","city":"Campanario","teamName":"Campanario"},
  'castellón': {"name":"Castellón","league":["la liga", "copa del rey"],"colors":["#000000","#000000"],"aliases":["cas","cast"],"logo":"https://ui-avatars.com/api/?name=Castell%C3%B3n&background=000000&color=000000&size=200&font-size=0.4","city":"Castellón","teamName":"Castellón"},
  'caudal deportivo': {"name":"Caudal Deportivo","league":["la liga", "copa del rey"],"colors":["#000000","#000000"],"aliases":["cd","caudal","deportivo","caudaldeportivo","cau"],"logo":"https://ui-avatars.com/api/?name=Caudal%20Deportivo&background=000000&color=000000&size=200&font-size=0.4","city":"Caudal Deportivo","teamName":"Caudal Deportivo"},
  'ceuta': {"name":"Ceuta","league":["la liga", "copa del rey"],"colors":["#000000","#000000"],"aliases":["ceu","ceut"],"logo":"https://ui-avatars.com/api/?name=Ceuta&background=000000&color=000000&size=200&font-size=0.4","city":"Ceuta","teamName":"Ceuta"},
  'cieza': {"name":"Cieza","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["cie","ciez"],"logo":"https://ui-avatars.com/api/?name=Cieza&background=000000&color=C60000&size=200&font-size=0.4","city":"Cieza","teamName":"Cieza"},
  'club atlético antoniano': {"name":"Club Atlético Antoniano","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["caa","atletico","antoniano","atleticoantoniano","atletico antoniano","atl"],"logo":"https://ui-avatars.com/api/?name=Club%20Atl%C3%A9tico%20Antoniano&background=000000&color=C60000&size=200&font-size=0.4","city":"Club Atlético Antoniano","teamName":"Club Atlético Antoniano"},
  'constancia': {"name":"Constancia","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["con","cons"],"logo":"https://ui-avatars.com/api/?name=Constancia&background=000000&color=C60000&size=200&font-size=0.4","city":"Constancia","teamName":"Constancia"},
  'cultural leonesa': {"name":"Cultural Leonesa","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["cl","cultural","leonesa","culturalleonesa","cul"],"logo":"https://ui-avatars.com/api/?name=Cultural%20Leonesa&background=000000&color=C60000&size=200&font-size=0.4","city":"Cultural Leonesa","teamName":"Cultural Leonesa"},
  'cádiz': {"name":"Cádiz","league":["la liga", "copa del rey"],"colors":["#ffff00","#1a1a1a"],"aliases":["cad","cadi"],"logo":"https://ui-avatars.com/api/?name=C%C3%A1diz&background=ffff00&color=1a1a1a&size=200&font-size=0.4","city":"Cádiz","teamName":"Cádiz"},
  'córdoba': {"name":"Córdoba","league":["la liga", "copa del rey"],"colors":["#288A00","#1a1a1a"],"aliases":["cor","cord"],"logo":"https://ui-avatars.com/api/?name=C%C3%B3rdoba&background=288A00&color=1a1a1a&size=200&font-size=0.4","city":"Córdoba","teamName":"Córdoba"},
  'deportivo la coruña': {"name":"Deportivo La Coruña","league":["la liga", "copa del rey"],"colors":["#3366CC","#b9e8f0"],"aliases":["dlc","deportivo","coruna","deportivocoruna","deportivo coruna","dep"],"logo":"https://ui-avatars.com/api/?name=Deportivo%20La%20Coru%C3%B1a&background=3366CC&color=b9e8f0&size=200&font-size=0.4","city":"Deportivo La Coruña","teamName":"Deportivo La Coruña"},
  'egüés': {"name":"Egüés","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["egu","egue"],"logo":"https://ui-avatars.com/api/?name=Eg%C3%BC%C3%A9s&background=000000&color=C60000&size=200&font-size=0.4","city":"Egüés","teamName":"Egüés"},
  'eibar': {"name":"Eibar","league":["la liga", "copa del rey"],"colors":["#c00000","#000099"],"aliases":["eib","eiba"],"logo":"https://ui-avatars.com/api/?name=Eibar&background=c00000&color=000099&size=200&font-size=0.4","city":"Eibar","teamName":"Eibar"},
  'eldense': {"name":"Eldense","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["eld","elde"],"logo":"https://ui-avatars.com/api/?name=Eldense&background=000000&color=C60000&size=200&font-size=0.4","city":"Eldense","teamName":"Eldense"},
  'fc andorra': {"name":"FC Andorra","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["fa","andorra","and"],"logo":"https://ui-avatars.com/api/?name=FC%20Andorra&background=000000&color=C60000&size=200&font-size=0.4","city":"FC","teamName":"Andorra"},
  'fc cartagena': {"name":"FC Cartagena","league":["la liga", "copa del rey"],"colors":["#000000","#000000"],"aliases":["cartagena","car"],"logo":"https://ui-avatars.com/api/?name=FC%20Cartagena&background=000000&color=000000&size=200&font-size=0.4","city":"FC","teamName":"Cartagena"},
  'getxo': {"name":"Getxo","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["get","getx"],"logo":"https://ui-avatars.com/api/?name=Getxo&background=000000&color=C60000&size=200&font-size=0.4","city":"Getxo","teamName":"Getxo"},
  'gimnàstic de tarragona': {"name":"Gimnàstic de Tarragona","league":["la liga", "copa del rey"],"colors":["#EF2000","#000000"],"aliases":["gdt","gimnastic","tarragona","gimnastictarragona","gimnastic tarragona","gim"],"logo":"https://ui-avatars.com/api/?name=Gimn%C3%A0stic%20de%20Tarragona&background=EF2000&color=000000&size=200&font-size=0.4","city":"Gimnàstic de Tarragona","teamName":"Gimnàstic de Tarragona"},
  'granada': {"name":"Granada","league":["la liga", "copa del rey"],"colors":["#C8142F","#3366CC"],"aliases":["gra","gran"],"logo":"https://ui-avatars.com/api/?name=Granada&background=C8142F&color=3366CC&size=200&font-size=0.4","city":"Granada","teamName":"Granada"},
  'huesca': {"name":"Huesca","league":["la liga", "copa del rey"],"colors":["#000099","#C60000"],"aliases":["hue","hues"],"logo":"https://ui-avatars.com/api/?name=Huesca&background=000099&color=C60000&size=200&font-size=0.4","city":"Huesca","teamName":"Huesca"},
  'inter de valdemoro': {"name":"Inter de Valdemoro","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["idv","inter","valdemoro","intervaldemoro","inter valdemoro","int"],"logo":"https://ui-avatars.com/api/?name=Inter%20de%20Valdemoro&background=000000&color=C60000&size=200&font-size=0.4","city":"Inter","teamName":"de Valdemoro"},
  'juventud torremolinos': {"name":"Juventud Torremolinos","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["jt","juventud","torremolinos","juventudtorremolinos","juv"],"logo":"https://ui-avatars.com/api/?name=Juventud%20Torremolinos&background=000000&color=C60000&size=200&font-size=0.4","city":"Juventud Torremolinos","teamName":"Juventud Torremolinos"},
  'la unión atlético': {"name":"La Unión Atlético","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["lua","union","atletico","unionatletico","union atletico","uni"],"logo":"https://ui-avatars.com/api/?name=La%20Uni%C3%B3n%20Atl%C3%A9tico&background=000000&color=C60000&size=200&font-size=0.4","city":"La Unión Atlético","teamName":"La Unión Atlético"},
  'langreo': {"name":"Langreo","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["lan","lang"],"logo":"https://ui-avatars.com/api/?name=Langreo&background=000000&color=C60000&size=200&font-size=0.4","city":"Langreo","teamName":"Langreo"},
  'las palmas': {"name":"Las Palmas","league":["la liga", "copa del rey"],"colors":["#ffff00","#3366CC"],"aliases":["lpa","lp","las","palmas","laspalmas"],"logo":"https://ui-avatars.com/api/?name=Las%20Palmas&background=ffff00&color=3366CC&size=200&font-size=0.4","city":"Las Palmas","teamName":"Las Palmas"},
  'leganés': {"name":"Leganés","league":["la liga", "copa del rey"],"colors":["#6cace4","#32cd32"],"aliases":["leg","cd leganes"],"logo":"https://ui-avatars.com/api/?name=Legan%C3%A9s&background=6cace4&color=32cd32&size=200&font-size=0.4","city":"Leganés","teamName":"Leganés"},
  'lorca deportiva': {"name":"Lorca Deportiva","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["ld","lorca","deportiva","lorcadeportiva","lor"],"logo":"https://ui-avatars.com/api/?name=Lorca%20Deportiva&background=000000&color=C60000&size=200&font-size=0.4","city":"Lorca Deportiva","teamName":"Lorca Deportiva"},
  'lourdes': {"name":"Lourdes","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["lou","lour"],"logo":"https://ui-avatars.com/api/?name=Lourdes&background=000000&color=C60000&size=200&font-size=0.4","city":"Lourdes","teamName":"Lourdes"},
  'lucena cf': {"name":"Lucena CF","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["lc","lucena","luc"],"logo":"https://ui-avatars.com/api/?name=Lucena%20CF&background=000000&color=C60000&size=200&font-size=0.4","city":"Lucena CF","teamName":"Lucena CF"},
  'manises cf': {"name":"Manises CF","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["mc","manises","man"],"logo":"https://ui-avatars.com/api/?name=Manises%20CF&background=000000&color=C60000&size=200&font-size=0.4","city":"Manises CF","teamName":"Manises CF"},
  'maracena': {"name":"Maracena","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["mar","mara"],"logo":"https://ui-avatars.com/api/?name=Maracena&background=000000&color=C60000&size=200&font-size=0.4","city":"Maracena","teamName":"Maracena"},
  'mirandés': {"name":"Mirandés","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["mir","mira"],"logo":"https://ui-avatars.com/api/?name=Mirand%C3%A9s&background=000000&color=C60000&size=200&font-size=0.4","city":"Mirandés","teamName":"Mirandés"},
  'mutilvera': {"name":"Mutilvera","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["mut","muti"],"logo":"https://ui-avatars.com/api/?name=Mutilvera&background=000000&color=C60000&size=200&font-size=0.4","city":"Mutilvera","teamName":"Mutilvera"},
  'málaga': {"name":"Málaga","league":["la liga", "copa del rey"],"colors":["#b9e8f0","#ffff00"],"aliases":["mal","mala"],"logo":"https://ui-avatars.com/api/?name=M%C3%A1laga&background=b9e8f0&color=ffff00&size=200&font-size=0.4","city":"Málaga","teamName":"Málaga"},
  'mérida': {"name":"Mérida","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["mer","meri"],"logo":"https://ui-avatars.com/api/?name=M%C3%A9rida&background=000000&color=C60000&size=200&font-size=0.4","city":"Mérida","teamName":"Mérida"},
  'naxara': {"name":"Naxara","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["nax","naxa"],"logo":"https://ui-avatars.com/api/?name=Naxara&background=000000&color=C60000&size=200&font-size=0.4","city":"Naxara","teamName":"Naxara"},
  'negreira': {"name":"Negreira","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["neg","negr"],"logo":"https://ui-avatars.com/api/?name=Negreira&background=000000&color=C60000&size=200&font-size=0.4","city":"Negreira","teamName":"Negreira"},
  'numancia': {"name":"Numancia","league":["la liga", "copa del rey"],"colors":["#C42A32","#1a1a1a"],"aliases":["num","numa"],"logo":"https://ui-avatars.com/api/?name=Numancia&background=C42A32&color=1a1a1a&size=200&font-size=0.4","city":"Numancia","teamName":"Numancia"},
  'orihuela': {"name":"Orihuela","league":["la liga", "copa del rey"],"colors":["#000000","#000000"],"aliases":["ori","orih"],"logo":"https://ui-avatars.com/api/?name=Orihuela&background=000000&color=000000&size=200&font-size=0.4","city":"Orihuela","teamName":"Orihuela"},
  'ourense cf': {"name":"Ourense CF","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["oc","ourense","our"],"logo":"https://ui-avatars.com/api/?name=Ourense%20CF&background=000000&color=C60000&size=200&font-size=0.4","city":"Ourense CF","teamName":"Ourense CF"},
  'palma del río': {"name":"Palma del Río","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["pdr","palma","del","rio","pal"],"logo":"https://ui-avatars.com/api/?name=Palma%20del%20R%C3%ADo&background=000000&color=C60000&size=200&font-size=0.4","city":"Palma del Río","teamName":"Palma del Río"},
  'poblense': {"name":"Poblense","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["pob","pobl"],"logo":"https://ui-avatars.com/api/?name=Poblense&background=000000&color=C60000&size=200&font-size=0.4","city":"Poblense","teamName":"Poblense"},
  'ponferradina': {"name":"Ponferradina","league":["la liga", "copa del rey"],"colors":["#000000","#000000"],"aliases":["pon","ponf"],"logo":"https://ui-avatars.com/api/?name=Ponferradina&background=000000&color=000000&size=200&font-size=0.4","city":"Ponferradina","teamName":"Ponferradina"},
  'pontevedra': {"name":"Pontevedra","league":["la liga", "copa del rey"],"colors":["#000000","#000000"],"aliases":["pon","pont"],"logo":"https://ui-avatars.com/api/?name=Pontevedra&background=000000&color=000000&size=200&font-size=0.4","city":"Pontevedra","teamName":"Pontevedra"},
  'portugalete': {"name":"Portugalete","league":["la liga", "copa del rey"],"colors":["#000000","#000000"],"aliases":["por","port"],"logo":"https://ui-avatars.com/api/?name=Portugalete&background=000000&color=000000&size=200&font-size=0.4","city":"Portugalete","teamName":"Portugalete"},
  'puente genil': {"name":"Puente Genil","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["pg","puente","genil","puentegenil","pue"],"logo":"https://ui-avatars.com/api/?name=Puente%20Genil&background=000000&color=C60000&size=200&font-size=0.4","city":"Puente Genil","teamName":"Puente Genil"},
  'puerto de vega': {"name":"Puerto De Vega","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["pdv","puerto","vega","puertovega","puerto vega","pue"],"logo":"https://ui-avatars.com/api/?name=Puerto%20De%20Vega&background=000000&color=C60000&size=200&font-size=0.4","city":"Puerto De Vega","teamName":"Puerto De Vega"},
  'quintanar del rey': {"name":"Quintanar del Rey","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["qdr","quintanar","del","rey","qui"],"logo":"https://ui-avatars.com/api/?name=Quintanar%20del%20Rey&background=000000&color=C60000&size=200&font-size=0.4","city":"Quintanar del Rey","teamName":"Quintanar del Rey"},
  'racing ferrol': {"name":"Racing Ferrol","league":["la liga", "copa del rey"],"colors":["#000000","#000000"],"aliases":["rf","racing","ferrol","racingferrol","rac"],"logo":"https://ui-avatars.com/api/?name=Racing%20Ferrol&background=000000&color=000000&size=200&font-size=0.4","city":"Racing Ferrol","teamName":"Racing Ferrol"},
  'racing santander': {"name":"Racing Santander","league":["la liga", "copa del rey"],"colors":["#3B6C1A","#0EB214"],"aliases":["rs","racing","santander","racingsantander","rac"],"logo":"https://ui-avatars.com/api/?name=Racing%20Santander&background=3B6C1A&color=0EB214&size=200&font-size=0.4","city":"Racing Santander","teamName":"Racing Santander"},
  'rayo majadahonda': {"name":"Rayo Majadahonda","league":["la liga", "copa del rey"],"colors":["#000000","#000000"],"aliases":["rm","rayo","majadahonda","rayomajadahonda","ray"],"logo":"https://ui-avatars.com/api/?name=Rayo%20Majadahonda&background=000000&color=000000&size=200&font-size=0.4","city":"Rayo Majadahonda","teamName":"Rayo Majadahonda"},
  'real aviles industrial': {"name":"Real Aviles Industrial","league":["la liga", "copa del rey"],"colors":["#000000","#000000"],"aliases":["rai","aviles","industrial","avilesindustrial","aviles industrial","avi"],"logo":"https://ui-avatars.com/api/?name=Real%20Aviles%20Industrial&background=000000&color=000000&size=200&font-size=0.4","city":"Real","teamName":"Aviles Industrial"},
  'real jaen cf': {"name":"Real Jaen CF","league":["la liga", "copa del rey"],"colors":["#000000","#000000"],"aliases":["rjc","jaen","jae"],"logo":"https://ui-avatars.com/api/?name=Real%20Jaen%20CF&background=000000&color=000000&size=200&font-size=0.4","city":"Real","teamName":"Jaen CF"},
  'real murcia': {"name":"Real Murcia","league":["la liga", "copa del rey"],"colors":["#C8142F","#C8142F"],"aliases":["rm","murcia","mur"],"logo":"https://ui-avatars.com/api/?name=Real%20Murcia&background=C8142F&color=C8142F&size=200&font-size=0.4","city":"Real","teamName":"Murcia"},
  'real valladolid': {"name":"Real Valladolid","league":["la liga", "copa del rey"],"colors":["#7a2d9d","#ffffff"],"aliases":["rv","valladolid","val"],"logo":"https://ui-avatars.com/api/?name=Real%20Valladolid&background=7a2d9d&color=ffffff&size=200&font-size=0.4","city":"Real","teamName":"Valladolid"},
  'real zaragoza': {"name":"Real Zaragoza","league":["la liga", "copa del rey"],"colors":["#000099","#1a1a1a"],"aliases":["rz","zaragoza","zar"],"logo":"https://ui-avatars.com/api/?name=Real%20Zaragoza&background=000099&color=1a1a1a&size=200&font-size=0.4","city":"Real","teamName":"Zaragoza"},
  'real ávila': {"name":"Real Ávila","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["ra","avila","avi"],"logo":"https://ui-avatars.com/api/?name=Real%20%C3%81vila&background=000000&color=C60000&size=200&font-size=0.4","city":"Real","teamName":"Ávila"},
  'reddis': {"name":"Reddis","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["red","redd"],"logo":"https://ui-avatars.com/api/?name=Reddis&background=000000&color=C60000&size=200&font-size=0.4","city":"Reddis","teamName":"Reddis"},
  'roda': {"name":"Roda","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["rod","roa"],"logo":"https://ui-avatars.com/api/?name=Roda&background=000000&color=C60000&size=200&font-size=0.4","city":"Roda","teamName":"Roda"},
  'sd logroñés': {"name":"SD Logroñés","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["sl","logrones","log"],"logo":"https://ui-avatars.com/api/?name=SD%20Logro%C3%B1%C3%A9s&background=000000&color=C60000&size=200&font-size=0.4","city":"SD Logroñés","teamName":"SD Logroñés"},
  'sant andreu': {"name":"Sant Andreu","league":["la liga", "copa del rey"],"colors":["#000000","#000000"],"aliases":["sa","sant","andreu","santandreu","san"],"logo":"https://ui-avatars.com/api/?name=Sant%20Andreu&background=000000&color=000000&size=200&font-size=0.4","city":"Sant Andreu","teamName":"Sant Andreu"},
  'sporting ceuta': {"name":"Sporting Ceuta","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["ceuta","ceu"],"logo":"https://ui-avatars.com/api/?name=Sporting%20Ceuta&background=000000&color=C60000&size=200&font-size=0.4","city":"Sporting","teamName":"Ceuta"},
  'sporting gijón': {"name":"Sporting Gijón","league":["la liga", "copa del rey"],"colors":["#C8142F","#1a1a1a"],"aliases":["sg","gijon","gij"],"logo":"https://ui-avatars.com/api/?name=Sporting%20Gij%C3%B3n&background=C8142F&color=1a1a1a&size=200&font-size=0.4","city":"Sporting","teamName":"Gijón"},
  'sámano': {"name":"Sámano","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["sam","sama"],"logo":"https://ui-avatars.com/api/?name=S%C3%A1mano&background=000000&color=C60000&size=200&font-size=0.4","city":"Sámano","teamName":"Sámano"},
  'talavera': {"name":"Talavera","league":["la liga", "copa del rey"],"colors":["#000000","#000000"],"aliases":["tal","tala"],"logo":"https://ui-avatars.com/api/?name=Talavera&background=000000&color=000000&size=200&font-size=0.4","city":"Talavera","teamName":"Talavera"},
  'tarazona': {"name":"Tarazona","league":["la liga", "copa del rey"],"colors":["#000000","#000000"],"aliases":["tar","tara"],"logo":"https://ui-avatars.com/api/?name=Tarazona&background=000000&color=000000&size=200&font-size=0.4","city":"Tarazona","teamName":"Tarazona"},
  'tenerife': {"name":"Tenerife","league":["la liga", "copa del rey"],"colors":["#008bc4","#1a1a1a"],"aliases":["ten","tene"],"logo":"https://ui-avatars.com/api/?name=Tenerife&background=008bc4&color=1a1a1a&size=200&font-size=0.4","city":"Tenerife","teamName":"Tenerife"},
  'teruel': {"name":"Teruel","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["ter","teru"],"logo":"https://ui-avatars.com/api/?name=Teruel&background=000000&color=C60000&size=200&font-size=0.4","city":"Teruel","teamName":"Teruel"},
  'textil escudo': {"name":"Textil Escudo","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["te","textil","escudo","textilescudo","tex"],"logo":"https://ui-avatars.com/api/?name=Textil%20Escudo&background=000000&color=C60000&size=200&font-size=0.4","city":"Textil Escudo","teamName":"Textil Escudo"},
  'toledo': {"name":"Toledo","league":["la liga", "copa del rey"],"colors":["#009A44","#FFFFFF"],"aliases":["tol","tole"],"logo":"https://ui-avatars.com/api/?name=Toledo&background=009A44&color=FFFFFF&size=200&font-size=0.4","city":"Toledo","teamName":"Toledo"},
  'torrent': {"name":"Torrent","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["tor","torr"],"logo":"https://ui-avatars.com/api/?name=Torrent&background=000000&color=C60000&size=200&font-size=0.4","city":"Torrent","teamName":"Torrent"},
  'tropezón': {"name":"Tropezón","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["tro","trop"],"logo":"https://ui-avatars.com/api/?name=Tropez%C3%B3n&background=000000&color=C60000&size=200&font-size=0.4","city":"Tropezón","teamName":"Tropezón"},
  'ucam murcia': {"name":"UCAM Murcia","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["um","ucam","murcia","ucammurcia","uca"],"logo":"https://ui-avatars.com/api/?name=UCAM%20Murcia&background=000000&color=C60000&size=200&font-size=0.4","city":"UCAM Murcia","teamName":"UCAM Murcia"},
  'ud ibiza': {"name":"UD Ibiza","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["ui","ibiza","ibi"],"logo":"https://ui-avatars.com/api/?name=UD%20Ibiza&background=000000&color=C60000&size=200&font-size=0.4","city":"UD Ibiza","teamName":"UD Ibiza"},
  'ud logroñés': {"name":"UD Logroñés","league":["la liga", "copa del rey"],"colors":["#C60000","#000000"],"aliases":["ul","logrones","log"],"logo":"https://ui-avatars.com/api/?name=UD%20Logro%C3%B1%C3%A9s&background=C60000&color=000000&size=200&font-size=0.4","city":"UD Logroñés","teamName":"UD Logroñés"},
  'ud ourense': {"name":"UD Ourense","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["uo","ourense","our"],"logo":"https://ui-avatars.com/api/?name=UD%20Ourense&background=000000&color=C60000&size=200&font-size=0.4","city":"UD Ourense","teamName":"UD Ourense"},
  'ud san fernando': {"name":"UD San Fernando","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["usf","san","fernando","sanfernando","san fernando"],"logo":"https://ui-avatars.com/api/?name=UD%20San%20Fernando&background=000000&color=C60000&size=200&font-size=0.4","city":"UD San Fernando","teamName":"UD San Fernando"},
  'universitario fc': {"name":"Universitario FC","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["uf","universitario","uni"],"logo":"https://ui-avatars.com/api/?name=Universitario%20FC&background=000000&color=C60000&size=200&font-size=0.4","city":"FC","teamName":"Universitario"},
  'unión deportiva los garres': {"name":"Unión Deportiva Los Garres","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["udlg","union","deportiva","los","garres","uni"],"logo":"https://ui-avatars.com/api/?name=Uni%C3%B3n%20Deportiva%20Los%20Garres&background=000000&color=C60000&size=200&font-size=0.4","city":"Unión Deportiva Los Garres","teamName":"Unión Deportiva Los Garres"},
  'utebo': {"name":"Utebo","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["ute","uteb"],"logo":"https://ui-avatars.com/api/?name=Utebo&background=000000&color=C60000&size=200&font-size=0.4","city":"Utebo","teamName":"Utebo"},
  'yuncos': {"name":"Yuncos","league":["la liga", "copa del rey"],"colors":["#000000","#C60000"],"aliases":["yun","yunc"],"logo":"https://ui-avatars.com/api/?name=Yuncos&background=000000&color=C60000&size=200&font-size=0.4","city":"Yuncos","teamName":"Yuncos"},
  '1. fc lokomotive leipzig': {"name":"1. FC Lokomotive Leipzig","league":"dfb pokal","colors":["#000000","#C60000"],"aliases":["1fll","lokomotive","leipzig","lokomotiveleipzig","lokomotive leipzig","lok"],"logo":"https://ui-avatars.com/api/?name=1.%20FC%20Lokomotive%20Leipzig&background=000000&color=C60000&size=200&font-size=0.4","city":"1. FC Lokomotive Leipzig","teamName":"1. FC Lokomotive Leipzig"},
  '1. fc magdeburg': {"name":"1. FC Magdeburg","league":"dfb pokal","colors":["#0068B2","#ffffff"],"aliases":["1fm","magdeburg","mag"],"logo":"https://ui-avatars.com/api/?name=1.%20FC%20Magdeburg&background=0068B2&color=ffffff&size=200&font-size=0.4","city":"1. FC Magdeburg","teamName":"1. FC Magdeburg"},
  '1. fc nürnberg': {"name":"1. FC Nürnberg","league":"dfb pokal","colors":["#9f0000","#1a1a1a"],"aliases":["1fn","nurnberg","nur"],"logo":"https://ui-avatars.com/api/?name=1.%20FC%20N%C3%BCrnberg&background=9f0000&color=1a1a1a&size=200&font-size=0.4","city":"1. FC Nürnberg","teamName":"1. FC Nürnberg"},
  '1. fc schweinfurt 05': {"name":"1. FC Schweinfurt 05","league":"dfb pokal","colors":["#000000","#C60000"],"aliases":["1fs0","schweinfurt","sch"],"logo":"https://ui-avatars.com/api/?name=1.%20FC%20Schweinfurt%2005&background=000000&color=C60000&size=200&font-size=0.4","city":"1. FC Schweinfurt 05","teamName":"1. FC Schweinfurt 05"},
  'arminia bielefeld': {"name":"Arminia Bielefeld","league":"dfb pokal","colors":["#00599f","#2c2d37"],"aliases":["ab","arminia","bielefeld","arminiabielefeld","arm"],"logo":"https://ui-avatars.com/api/?name=Arminia%20Bielefeld&background=00599f&color=2c2d37&size=200&font-size=0.4","city":"Arminia Bielefeld","teamName":"Arminia Bielefeld"},
  'bfc dynamo berlin': {"name":"BFC Dynamo Berlin","league":"dfb pokal","colors":["#000000","#C60000"],"aliases":["bdb","bfc","dynamo","berlin"],"logo":"https://ui-avatars.com/api/?name=BFC%20Dynamo%20Berlin&background=000000&color=C60000&size=200&font-size=0.4","city":"BFC Dynamo Berlin","teamName":"BFC Dynamo Berlin"},
  'bahlinger sc 1929': {"name":"Bahlinger SC 1929","league":"dfb pokal","colors":["#000000","#000000"],"aliases":["bs1","bahlinger","1929","bahlinger1929","bahlinger 1929","bah"],"logo":"https://ui-avatars.com/api/?name=Bahlinger%20SC%201929&background=000000&color=000000&size=200&font-size=0.4","city":"Bahlinger SC 1929","teamName":"Bahlinger SC 1929"},
  'dynamo dresden': {"name":"Dynamo Dresden","league":"dfb pokal","colors":["#f2a71d","#962807"],"aliases":["dd","dynamo","dresden","dynamodresden","dyn"],"logo":"https://ui-avatars.com/api/?name=Dynamo%20Dresden&background=f2a71d&color=962807&size=200&font-size=0.4","city":"Dynamo Dresden","teamName":"Dynamo Dresden"},
  'energie cottbus': {"name":"Energie Cottbus","league":"dfb pokal","colors":["#cc0000","#ffff00"],"aliases":["ec","energie","cottbus","energiecottbus","ene"],"logo":"https://ui-avatars.com/api/?name=Energie%20Cottbus&background=cc0000&color=ffff00&size=200&font-size=0.4","city":"Energie Cottbus","teamName":"Energie Cottbus"},
  'fc 08 homburg': {"name":"FC 08 Homburg","league":"dfb pokal","colors":["#000000","#000000"],"aliases":["f0h","homburg","hom"],"logo":"https://ui-avatars.com/api/?name=FC%2008%20Homburg&background=000000&color=000000&size=200&font-size=0.4","city":"FC","teamName":"08 Homburg"},
  'fc eintracht norderstedt': {"name":"FC Eintracht Norderstedt","league":"dfb pokal","colors":["#000000","#C60000"],"aliases":["fen","eintracht","norderstedt","eintrachtnorderstedt","eintracht norderstedt","ein"],"logo":"https://ui-avatars.com/api/?name=FC%20Eintracht%20Norderstedt&background=000000&color=C60000&size=200&font-size=0.4","city":"FC","teamName":"Eintracht Norderstedt"},
  'fc gütersloh 2000': {"name":"FC Gütersloh 2000","league":"dfb pokal","colors":["#000000","#C60000"],"aliases":["fg2","gutersloh","2000","gutersloh2000","gutersloh 2000","gut"],"logo":"https://ui-avatars.com/api/?name=FC%20G%C3%BCtersloh%202000&background=000000&color=C60000&size=200&font-size=0.4","city":"FC","teamName":"Gütersloh 2000"},
  'fk pirmasens': {"name":"FK Pirmasens","league":"dfb pokal","colors":["#000000","#000000"],"aliases":["fp","pirmasens","pir"],"logo":"https://ui-avatars.com/api/?name=FK%20Pirmasens&background=000000&color=000000&size=200&font-size=0.4","city":"FK Pirmasens","teamName":"FK Pirmasens"},
  'fv engers 07': {"name":"FV Engers 07","league":"dfb pokal","colors":["#000000","#C60000"],"aliases":["fe0","engers","eng"],"logo":"https://ui-avatars.com/api/?name=FV%20Engers%2007&background=000000&color=C60000&size=200&font-size=0.4","city":"FV Engers 07","teamName":"FV Engers 07"},
  'fv illertissen': {"name":"FV Illertissen","league":"dfb pokal","colors":["#000000","#C60000"],"aliases":["fi","illertissen","ill"],"logo":"https://ui-avatars.com/api/?name=FV%20Illertissen&background=000000&color=C60000&size=200&font-size=0.4","city":"FV Illertissen","teamName":"FV Illertissen"},
  'fortuna düsseldorf': {"name":"Fortuna Düsseldorf","league":"dfb pokal","colors":["#ffffff","#1a1a1a"],"aliases":["fd","fortuna","dusseldorf","fortunadusseldorf","for"],"logo":"https://ui-avatars.com/api/?name=Fortuna%20D%C3%BCsseldorf&background=ffffff&color=1a1a1a&size=200&font-size=0.4","city":"Fortuna Düsseldorf","teamName":"Fortuna Düsseldorf"},
  'hallescher fc': {"name":"Hallescher FC","league":"dfb pokal","colors":["#1a1a1a","#1a1a1a"],"aliases":["hf","hallescher","hal"],"logo":"https://ui-avatars.com/api/?name=Hallescher%20FC&background=1a1a1a&color=1a1a1a&size=200&font-size=0.4","city":"FC","teamName":"Hallescher"},
  'hannover 96': {"name":"Hannover 96","league":"dfb pokal","colors":["#179D33","#1a1a1a"],"aliases":["h9","hannover","han"],"logo":"https://ui-avatars.com/api/?name=Hannover%2096&background=179D33&color=1a1a1a&size=200&font-size=0.4","city":"Hannover 96","teamName":"Hannover 96"},
  'hansa rostock': {"name":"Hansa Rostock","league":"dfb pokal","colors":["#324CBA","#C60000"],"aliases":["hr","hansa","rostock","hansarostock","han"],"logo":"https://ui-avatars.com/api/?name=Hansa%20Rostock&background=324CBA&color=C60000&size=200&font-size=0.4","city":"Hansa Rostock","teamName":"Hansa Rostock"},
  'hemelingen': {"name":"Hemelingen","league":"dfb pokal","colors":["#000000","#C60000"],"aliases":["hem","heme"],"logo":"https://ui-avatars.com/api/?name=Hemelingen&background=000000&color=C60000&size=200&font-size=0.4","city":"Hemelingen","teamName":"Hemelingen"},
  'hertha berlin': {"name":"Hertha Berlin","league":"dfb pokal","colors":["#0000dd","#091453"],"aliases":["hb","hertha","berlin","herthaberlin","her"],"logo":"https://ui-avatars.com/api/?name=Hertha%20Berlin&background=0000dd&color=091453&size=200&font-size=0.4","city":"Hertha Berlin","teamName":"Hertha Berlin"},
  'holstein kiel': {"name":"Holstein Kiel","league":"dfb pokal","colors":["#0754ba","#f9fbfc"],"aliases":["ksv","kiel","hk","holstein","holsteinkiel","hol"],"logo":"https://ui-avatars.com/api/?name=Holstein%20Kiel&background=0754ba&color=f9fbfc&size=200&font-size=0.4","city":"Holstein Kiel","teamName":"Holstein Kiel"},
  'kaiserslautern': {"name":"Kaiserslautern","league":"dfb pokal","colors":["#8C273D","#1a1a1a"],"aliases":["kai","kais"],"logo":"https://ui-avatars.com/api/?name=Kaiserslautern&background=8C273D&color=1a1a1a&size=200&font-size=0.4","city":"Kaiserslautern","teamName":"Kaiserslautern"},
  'karlsruher sc': {"name":"Karlsruher SC","league":"dfb pokal","colors":["#2563B8","#2563B8"],"aliases":["ks","karlsruher","kar"],"logo":"https://ui-avatars.com/api/?name=Karlsruher%20SC&background=2563B8&color=2563B8&size=200&font-size=0.4","city":"Karlsruher SC","teamName":"Karlsruher SC"},
  'lohne': {"name":"Lohne","league":"dfb pokal","colors":["#000000","#C60000"],"aliases":["loh","lohn"],"logo":"https://ui-avatars.com/api/?name=Lohne&background=000000&color=C60000&size=200&font-size=0.4","city":"Lohne","teamName":"Lohne"},
  'preußen münster': {"name":"Preußen Münster","league":"dfb pokal","colors":["#000000","#C60000"],"aliases":["pm","preuen","munster","preuenmunster","pre"],"logo":"https://ui-avatars.com/api/?name=Preu%C3%9Fen%20M%C3%BCnster&background=000000&color=C60000&size=200&font-size=0.4","city":"Preußen Münster","teamName":"Preußen Münster"},
  'rsv eintracht': {"name":"RSV Eintracht","league":"dfb pokal","colors":["#000000","#C60000"],"aliases":["re","rsv","eintracht","rsveintracht"],"logo":"https://ui-avatars.com/api/?name=RSV%20Eintracht&background=000000&color=C60000&size=200&font-size=0.4","city":"Eintracht","teamName":"RSV"},
  'rot-weiss essen': {"name":"Rot-Weiss Essen","league":"dfb pokal","colors":["#000000","#C60000"],"aliases":["re","rotweiss","essen","rotweissessen","rot"],"logo":"https://ui-avatars.com/api/?name=Rot-Weiss%20Essen&background=000000&color=C60000&size=200&font-size=0.4","city":"Rot-Weiss Essen","teamName":"Rot-Weiss Essen"},
  'sc paderborn 07': {"name":"SC Paderborn 07","league":"dfb pokal","colors":["#0000dd","#ffffff"],"aliases":["sp0","paderborn","pad"],"logo":"https://ui-avatars.com/api/?name=SC%20Paderborn%2007&background=0000dd&color=ffffff&size=200&font-size=0.4","city":"SC Paderborn 07","teamName":"SC Paderborn 07"},
  'sg sonnenhof großaspach': {"name":"SG Sonnenhof Großaspach","league":"dfb pokal","colors":["#000000","#000000"],"aliases":["ssg","sonnenhof","groaspach","sonnenhofgroaspach","sonnenhof groaspach","son"],"logo":"https://ui-avatars.com/api/?name=SG%20Sonnenhof%20Gro%C3%9Faspach&background=000000&color=000000&size=200&font-size=0.4","city":"SG Sonnenhof Großaspach","teamName":"SG Sonnenhof Großaspach"},
  'ssv jahn regensburg': {"name":"SSV Jahn Regensburg","league":"dfb pokal","colors":["#ce1b0e","#f9f9f9"],"aliases":["sjr","ssv","jahn","regensburg"],"logo":"https://ui-avatars.com/api/?name=SSV%20Jahn%20Regensburg&background=ce1b0e&color=f9f9f9&size=200&font-size=0.4","city":"SSV Jahn Regensburg","teamName":"SSV Jahn Regensburg"},
  'ssv ulm 1846': {"name":"SSV Ulm 1846","league":"dfb pokal","colors":["#000000","#C60000"],"aliases":["su1","ssv","ulm","1846"],"logo":"https://ui-avatars.com/api/?name=SSV%20Ulm%201846&background=000000&color=C60000&size=200&font-size=0.4","city":"SSV Ulm 1846","teamName":"SSV Ulm 1846"},
  'sv 07 elversberg': {"name":"SV 07 Elversberg","league":"dfb pokal","colors":["#000000","#C60000"],"aliases":["s0e","elversberg","elv"],"logo":"https://ui-avatars.com/api/?name=SV%2007%20Elversberg&background=000000&color=C60000&size=200&font-size=0.4","city":"SV 07 Elversberg","teamName":"SV 07 Elversberg"},
  'sv atlas delmenhorst': {"name":"SV Atlas Delmenhorst","league":"dfb pokal","colors":["#000000","#C60000"],"aliases":["sad","atlas","delmenhorst","atlasdelmenhorst","atlas delmenhorst","atl"],"logo":"https://ui-avatars.com/api/?name=SV%20Atlas%20Delmenhorst&background=000000&color=C60000&size=200&font-size=0.4","city":"SV Atlas Delmenhorst","teamName":"SV Atlas Delmenhorst"},
  'sv darmstadt 98': {"name":"SV Darmstadt 98","league":"dfb pokal","colors":["#003399","#fafafc"],"aliases":["sd9","darmstadt","dar"],"logo":"https://ui-avatars.com/api/?name=SV%20Darmstadt%2098&background=003399&color=fafafc&size=200&font-size=0.4","city":"SV Darmstadt 98","teamName":"SV Darmstadt 98"},
  'sv sandhausen': {"name":"SV Sandhausen","league":"dfb pokal","colors":["#1a1a1a","#fafafc"],"aliases":["ss","sandhausen","san"],"logo":"https://ui-avatars.com/api/?name=SV%20Sandhausen&background=1a1a1a&color=fafafc&size=200&font-size=0.4","city":"SV Sandhausen","teamName":"SV Sandhausen"},
  'sv wehen wiesbaden': {"name":"SV Wehen Wiesbaden","league":"dfb pokal","colors":["#000000","#000000"],"aliases":["sww","wehen","wiesbaden","wehenwiesbaden","wehen wiesbaden","weh"],"logo":"https://ui-avatars.com/api/?name=SV%20Wehen%20Wiesbaden&background=000000&color=000000&size=200&font-size=0.4","city":"SV Wehen Wiesbaden","teamName":"SV Wehen Wiesbaden"},
  'saarbrücken': {"name":"Saarbrücken","league":"dfb pokal","colors":["#000000","#C60000"],"aliases":["saa","saar"],"logo":"https://ui-avatars.com/api/?name=Saarbr%C3%BCcken&background=000000&color=C60000&size=200&font-size=0.4","city":"Saarbrücken","teamName":"Saarbrücken"},
  'schalke 04': {"name":"Schalke 04","league":"dfb pokal","colors":["#0000dd","#ffffff"],"aliases":["s0","schalke","sch"],"logo":"https://ui-avatars.com/api/?name=Schalke%2004&background=0000dd&color=ffffff&size=200&font-size=0.4","city":"Schalke 04","teamName":"Schalke 04"},
  'spvgg greuther fürth': {"name":"SpVgg Greuther Fürth","league":"dfb pokal","colors":["#288A00","#1a1a1a"],"aliases":["sgf","spvgg","greuther","furth","spv"],"logo":"https://ui-avatars.com/api/?name=SpVgg%20Greuther%20F%C3%BCrth&background=288A00&color=1a1a1a&size=200&font-size=0.4","city":"SpVgg Greuther Fürth","teamName":"SpVgg Greuther Fürth"},
  'sportfreunde lotte': {"name":"Sportfreunde Lotte","league":"dfb pokal","colors":["#0000dd","#0000dd"],"aliases":["sl","sportfreunde","lotte","sportfreundelotte","spo"],"logo":"https://ui-avatars.com/api/?name=Sportfreunde%20Lotte&background=0000dd&color=0000dd&size=200&font-size=0.4","city":"Sportfreunde Lotte","teamName":"Sportfreunde Lotte"},
  'tsv eintracht braunschweig': {"name":"TSV Eintracht Braunschweig","league":"dfb pokal","colors":["#ffde16","#1a1a1a"],"aliases":["teb","tsv","eintracht","braunschweig"],"logo":"https://ui-avatars.com/api/?name=TSV%20Eintracht%20Braunschweig&background=ffde16&color=1a1a1a&size=200&font-size=0.4","city":"TSV Eintracht Braunschweig","teamName":"TSV Eintracht Braunschweig"},
  'vfb lübeck': {"name":"VfB Lübeck","league":"dfb pokal","colors":["#000000","#C60000"],"aliases":["vl","vfb","lubeck","vfblubeck"],"logo":"https://ui-avatars.com/api/?name=VfB%20L%C3%BCbeck&background=000000&color=C60000&size=200&font-size=0.4","city":"VfB Lübeck","teamName":"VfB Lübeck"},
  'vfl bochum': {"name":"VfL Bochum","league":"dfb pokal","colors":["#000055","#aac4f2"],"aliases":["boc","bochum","vb","vfl","vflbochum"],"logo":"https://ui-avatars.com/api/?name=VfL%20Bochum&background=000055&color=aac4f2&size=200&font-size=0.4","city":"VfL Bochum","teamName":"VfL Bochum"},
  'viktoria köln': {"name":"Viktoria Köln","league":"dfb pokal","colors":["#000000","#C60000"],"aliases":["vk","viktoria","koln","viktoriakoln","vik"],"logo":"https://ui-avatars.com/api/?name=Viktoria%20K%C3%B6ln&background=000000&color=C60000&size=200&font-size=0.4","city":"Viktoria Köln","teamName":"Viktoria Köln"},
  'zfc meuselwitz': {"name":"ZFC Meuselwitz","league":"dfb pokal","colors":["#000000","#000000"],"aliases":["zm","zfc","meuselwitz","zfcmeuselwitz"],"logo":"https://ui-avatars.com/api/?name=ZFC%20Meuselwitz&background=000000&color=000000&size=200&font-size=0.4","city":"ZFC Meuselwitz","teamName":"ZFC Meuselwitz"},
  'al ahli': {"name":"Al Ahli","league":"saudi pro league","colors":["#078543","#193b67"],"aliases":["aa","ahli","ahl"],"logo":"https://ui-avatars.com/api/?name=Al%20Ahli&background=078543&color=193b67&size=200&font-size=0.4","city":"Al Ahli","teamName":"Al Ahli"},
  'al ettifaq': {"name":"Al Ettifaq","league":"saudi pro league","colors":["#00b32c","#E40010"],"aliases":["ae","ettifaq","ett"],"logo":"https://ui-avatars.com/api/?name=Al%20Ettifaq&background=00b32c&color=E40010&size=200&font-size=0.4","city":"Al Ettifaq","teamName":"Al Ettifaq"},
  'al fateh': {"name":"Al Fateh","league":"saudi pro league","colors":["#26ba09","#0999ba"],"aliases":["af","fateh","fat"],"logo":"https://ui-avatars.com/api/?name=Al%20Fateh&background=26ba09&color=0999ba&size=200&font-size=0.4","city":"Al Fateh","teamName":"Al Fateh"},
  'al fayha': {"name":"Al Fayha","league":"saudi pro league","colors":["#fa8228","#0000FF"],"aliases":["af","fayha","fay"],"logo":"https://ui-avatars.com/api/?name=Al%20Fayha&background=fa8228&color=0000FF&size=200&font-size=0.4","city":"Al Fayha","teamName":"Al Fayha"},
  'al hazem': {"name":"Al Hazem","league":"saudi pro league","colors":["#ffd700","#cccccc"],"aliases":["ah","hazem","haz"],"logo":"https://ui-avatars.com/api/?name=Al%20Hazem&background=ffd700&color=cccccc&size=200&font-size=0.4","city":"Al Hazem","teamName":"Al Hazem"},
  'al hilal': {"name":"Al Hilal","league":"saudi pro league","colors":["#1c31ce","#e3e4ed"],"aliases":["ah","hilal","hil"],"logo":"https://ui-avatars.com/api/?name=Al%20Hilal&background=1c31ce&color=e3e4ed&size=200&font-size=0.4","city":"Al Hilal","teamName":"Al Hilal"},
  'al ittihad': {"name":"Al Ittihad","league":"saudi pro league","colors":["#ffff00","#000000"],"aliases":["ai","ittihad","itt"],"logo":"https://ui-avatars.com/api/?name=Al%20Ittihad&background=ffff00&color=000000&size=200&font-size=0.4","city":"Al Ittihad","teamName":"Al Ittihad"},
  'al khaleej': {"name":"Al Khaleej","league":"saudi pro league","colors":["#196F3D","#FFEE58"],"aliases":["ak","khaleej","kha"],"logo":"https://ui-avatars.com/api/?name=Al%20Khaleej&background=196F3D&color=FFEE58&size=200&font-size=0.4","city":"Al Khaleej","teamName":"Al Khaleej"},
  'al kholood': {"name":"Al Kholood","league":"saudi pro league","colors":["#008000","#C60000"],"aliases":["ak","kholood","kho"],"logo":"https://ui-avatars.com/api/?name=Al%20Kholood&background=008000&color=C60000&size=200&font-size=0.4","city":"Al Kholood","teamName":"Al Kholood"},
  'al najma': {"name":"Al Najma","league":"saudi pro league","colors":["#015617","#000000"],"aliases":["an","najma","naj"],"logo":"https://ui-avatars.com/api/?name=Al%20Najma&background=015617&color=000000&size=200&font-size=0.4","city":"Al Najma","teamName":"Al Najma"},
  'al nassr': {"name":"Al Nassr","league":"saudi pro league","colors":["#f7f316","#1c31ce"],"aliases":["an","nassr","nas"],"logo":"https://ui-avatars.com/api/?name=Al%20Nassr&background=f7f316&color=1c31ce&size=200&font-size=0.4","city":"Al Nassr","teamName":"Al Nassr"},
  'al okhdood': {"name":"Al Okhdood","league":"saudi pro league","colors":["#87CEEB","#000000"],"aliases":["ao","okhdood","okh"],"logo":"https://ui-avatars.com/api/?name=Al%20Okhdood&background=87CEEB&color=000000&size=200&font-size=0.4","city":"Al Okhdood","teamName":"Al Okhdood"},
  'al qadsiah': {"name":"Al Qadsiah","league":"saudi pro league","colors":["#ffd700","#C60000"],"aliases":["aq","qadsiah","qad"],"logo":"https://ui-avatars.com/api/?name=Al%20Qadsiah&background=ffd700&color=C60000&size=200&font-size=0.4","city":"Al Qadsiah","teamName":"Al Qadsiah"},
  'al riyadh': {"name":"Al Riyadh","league":"saudi pro league","colors":["#000000","#C60000"],"aliases":["ar","riyadh","riy"],"logo":"https://ui-avatars.com/api/?name=Al%20Riyadh&background=000000&color=C60000&size=200&font-size=0.4","city":"Al Riyadh","teamName":"Al Riyadh"},
  'al shabab': {"name":"Al Shabab","league":"saudi pro league","colors":["#FFAC1C","#ffffff"],"aliases":["shabab","sha"],"logo":"https://ui-avatars.com/api/?name=Al%20Shabab&background=FFAC1C&color=ffffff&size=200&font-size=0.4","city":"Al Shabab","teamName":"Al Shabab"},
  'al taawoun': {"name":"Al Taawoun","league":"saudi pro league","colors":["#eef209","#000000"],"aliases":["at","taawoun","taa"],"logo":"https://ui-avatars.com/api/?name=Al%20Taawoun&background=eef209&color=000000&size=200&font-size=0.4","city":"Al Taawoun","teamName":"Al Taawoun"},
  'damac': {"name":"Damac","league":"saudi pro league","colors":["#C60000","#FFBF00"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/21828.png","aliases":["dam","dama"],"city":"Damac","teamName":"Damac"},
  'neom sc': {"name":"Neom SC","league":"saudi pro league","colors":["#259EEE","#FF9300"],"aliases":["ns","neom","neo"],"logo":"https://ui-avatars.com/api/?name=Neom%20SC&background=259EEE&color=FF9300&size=200&font-size=0.4","city":"Neom SC","teamName":"Neom SC"},
  'atlanta hawks': {"name":"Atlanta Hawks","league":"nba","colors":["#c8102e","#fdb927"],"aliases":["hawks","ah","atlanta","atlantahawks","atlhaw","atl"],"logo":"https://a.espncdn.com/i/teamlogos/nba/500/atl.png","city":"Atlanta","teamName":"Hawks"},
  'boston celtics': {"name":"Boston Celtics","league":"nba","colors":["#008348","#ffffff"],"aliases":["bos","celtics","bc","boston","bostonceltics","boscel"],"logo":"https://a.espncdn.com/i/teamlogos/nba/500/bos.png","city":"Boston","teamName":"Celtics"},
  'brooklyn nets': {"name":"Brooklyn Nets","league":"nba","colors":["#000000","#ffffff"],"aliases":["bkn","nets","bn","brooklyn","brooklynnets","bronet","bro"],"logo":"https://a.espncdn.com/i/teamlogos/nba/500/bkn.png","city":"Brooklyn Nets","teamName":"Brooklyn Nets"},
  'charlotte hornets': {"name":"Charlotte Hornets","league":"nba","colors":["#008ca8","#1d1060"],"aliases":["cha","hornets","ch","charlotte","charlottehornets","chahor"],"logo":"https://a.espncdn.com/i/teamlogos/nba/500/cha.png","city":"Charlotte","teamName":"Hornets"},
  'chicago bulls': {"name":"Chicago Bulls","league":"nba","colors":["#ce1141","#000000"],"aliases":["bulls","cb","chicago","chicagobulls","chibul","chi"],"logo":"https://a.espncdn.com/i/teamlogos/nba/500/chi.png","city":"Chicago","teamName":"Bulls"},
  'cleveland cavaliers': {"name":"Cleveland Cavaliers","league":"nba","colors":["#860038","#bc945c"],"aliases":["cavs","cc","cleveland","cavaliers","clevelandcavaliers","clecav","cle"],"logo":"https://a.espncdn.com/i/teamlogos/nba/500/cle.png","city":"Cleveland","teamName":"Cavaliers"},
  'dallas mavericks': {"name":"Dallas Mavericks","league":"nba","colors":["#0064b1","#bbc4ca"],"aliases":["mavs","dm","dallas","mavericks","dallasmavericks","dalmav","dal"],"logo":"https://a.espncdn.com/i/teamlogos/nba/500/dal.png","city":"Dallas","teamName":"Mavericks"},
  'denver nuggets': {"name":"Denver Nuggets","league":"nba","colors":["#0e2240","#fec524"],"aliases":["nuggets","dn","denver","denvernuggets","dennug","den"],"logo":"https://a.espncdn.com/i/teamlogos/nba/500/den.png","city":"Denver","teamName":"Nuggets"},
  'detroit pistons': {"name":"Detroit Pistons","league":"nba","colors":["#1d428a","#c8102e"],"aliases":["pistons","dp","detroit","detroitpistons","detpis","det"],"logo":"https://a.espncdn.com/i/teamlogos/nba/500/det.png","city":"Detroit","teamName":"Pistons"},
  'golden state warriors': {"name":"Golden State Warriors","league":"nba","colors":["#fdb927","#1d428a"],"aliases":["gsw","warriors","golden","state","golden state","golwar","gol"],"logo":"https://a.espncdn.com/i/teamlogos/nba/500/gs.png","city":"Golden State","teamName":"Warriors"},
  'houston rockets': {"name":"Houston Rockets","league":"nba","colors":["#ce1141","#000000"],"aliases":["rockets","hr","houston","houstonrockets","houroc","hou"],"logo":"https://a.espncdn.com/i/teamlogos/nba/500/hou.png","city":"Houston","teamName":"Rockets"},
  'indiana pacers': {"name":"Indiana Pacers","league":"nba","colors":["#0c2340","#ffd520"],"aliases":["pacers","ip","indiana","indianapacers","indpac","ind"],"logo":"https://a.espncdn.com/i/teamlogos/nba/500/ind.png","city":"Indiana Pacers","teamName":"Indiana Pacers"},
  'la clippers': {"name":"LA Clippers","league":"nba","colors":["#12173f","#c8102e"],"aliases":["clippers","lc","la","cli"],"logo":"https://a.espncdn.com/i/teamlogos/nba/500/lac.png","city":"LA Clippers","teamName":"LA Clippers"},
  'los angeles lakers': {"name":"Los Angeles Lakers","league":"nba","colors":["#552583","#fdb927"],"aliases":["lal","lakers","los","angeles","los angeles","loslak"],"logo":"https://a.espncdn.com/i/teamlogos/nba/500/lal.png","city":"Los Angeles","teamName":"Lakers"},
  'memphis grizzlies': {"name":"Memphis Grizzlies","league":"nba","colors":["#5d76a9","#12173f"],"aliases":["mem","grizzlies","mg","memphis","memphisgrizzlies","memgri"],"logo":"https://a.espncdn.com/i/teamlogos/nba/500/mem.png","city":"Memphis Grizzlies","teamName":"Memphis Grizzlies"},
  'miami heat': {"name":"Miami Heat","league":"nba","colors":["#98002e","#000000"],"aliases":["heat","mh","miami","miamiheat","miahea","mia"],"logo":"https://a.espncdn.com/i/teamlogos/nba/500/mia.png","city":"Miami","teamName":"Heat"},
  'milwaukee bucks': {"name":"Milwaukee Bucks","league":"nba","colors":["#00471b","#eee1c6"],"aliases":["mil","bucks","mb","milwaukee","milwaukeebucks","milbuc"],"logo":"https://a.espncdn.com/i/teamlogos/nba/500/mil.png","city":"Milwaukee Bucks","teamName":"Milwaukee Bucks"},
  'minnesota timberwolves': {"name":"Minnesota Timberwolves","league":"nba","colors":["#266092","#79bc43"],"aliases":["t-wolves","timberwolves","mt","minnesota","minnesotatimberwolves","mintim","min"],"logo":"https://a.espncdn.com/i/teamlogos/nba/500/min.png","city":"Minnesota","teamName":"Timberwolves"},
  'new orleans pelicans': {"name":"New Orleans Pelicans","league":"nba","colors":["#0a2240","#b4975a"],"aliases":["nop","pelicans","new","orleans","new orleans","newpel"],"logo":"https://a.espncdn.com/i/teamlogos/nba/500/no.png","city":"New Orleans","teamName":"Pelicans"},
  'new york knicks': {"name":"New York Knicks","league":"nba","colors":["#1d428a","#f58426"],"aliases":["nyk","knicks","new","york","new york","newkni"],"logo":"https://a.espncdn.com/i/teamlogos/nba/500/ny.png","city":"New York","teamName":"Knicks"},
  'oklahoma city thunder': {"name":"Oklahoma City Thunder","league":"nba","colors":["#007ac1","#ef3b24"],"aliases":["okc","thunder","oct","oklahoma","oklahomathunder","oklahoma thunder","oklahoma city","oklthu","okl"],"logo":"https://a.espncdn.com/i/teamlogos/nba/500/okc.png","city":"Oklahoma City","teamName":"Thunder"},
  'orlando magic': {"name":"Orlando Magic","league":"nba","colors":["#0150b5","#9ca0a3"],"aliases":["orl","magic","om","orlando","orlandomagic","orlmag"],"logo":"https://a.espncdn.com/i/teamlogos/nba/500/orl.png","city":"Orlando","teamName":"Magic"},
  'philadelphia 76ers': {"name":"Philadelphia 76ers","league":"nba","colors":["#1d428a","#e01234"],"aliases":["sixers","76ers","p7","philadelphia","philadelphia76ers","phi76e","phi"],"logo":"https://a.espncdn.com/i/teamlogos/nba/500/phi.png","city":"Philadelphia","teamName":"76ers"},
  'phoenix suns': {"name":"Phoenix Suns","league":"nba","colors":["#29127a","#e56020"],"aliases":["phx","suns","ps","phoenix","phoenixsuns","phosun","pho"],"logo":"https://a.espncdn.com/i/teamlogos/nba/500/phx.png","city":"Phoenix Suns","teamName":"Phoenix Suns"},
  'portland trail blazers': {"name":"Portland Trail Blazers","league":"nba","colors":["#e03a3e","#000000"],"aliases":["blazers","por","ptb","portland","trail","portland trail","porbla"],"logo":"https://a.espncdn.com/i/teamlogos/nba/500/por.png","city":"Portland","teamName":"Trail Blazers"},
  'sacramento kings': {"name":"Sacramento Kings","league":"nba","colors":["#5a2d81","#6a7a82"],"aliases":["kings","sac","sk","sacramento","sacramentokings","sackin"],"logo":"https://a.espncdn.com/i/teamlogos/nba/500/sac.png","city":"Sacramento Kings","teamName":"Sacramento Kings"},
  'san antonio spurs': {"name":"San Antonio Spurs","league":"nba","colors":["#000000","#c4ced4"],"aliases":["spurs","sas","san","antonio","san antonio","sanspu"],"logo":"https://a.espncdn.com/i/teamlogos/nba/500/sa.png","city":"San Antonio","teamName":"Spurs"},
  'toronto raptors': {"name":"Toronto Raptors","league":"nba","colors":["#d91244","#000000"],"aliases":["tor","raptors","tr","toronto","torontoraptors","torrap"],"logo":"https://a.espncdn.com/i/teamlogos/nba/500/tor.png","city":"Toronto","teamName":"Raptors"},
  'utah jazz': {"name":"Utah Jazz","league":"nba","colors":["#4e008e","#79a3dc"],"aliases":["uta","jazz","uj","utah","utahjazz","utajaz"],"logo":"https://a.espncdn.com/i/teamlogos/nba/500/utah.png","city":"Utah Jazz","teamName":"Utah Jazz"},
  'washington wizards': {"name":"Washington Wizards","league":"nba","colors":["#e31837","#002b5c"],"aliases":["wizards","ww","washington","washingtonwizards","waswiz","was"],"logo":"https://a.espncdn.com/i/teamlogos/nba/500/wsh.png","city":"Washington","teamName":"Wizards"},
  'anaheim ducks': {"name":"Anaheim Ducks","league":"nhl","colors":["#fc4c02","#000000"],"aliases":["ana","ducks","ad","anaheim","anaheimducks","anaduc"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/ana.png","city":"Anaheim","teamName":"Ducks"},
  'boston bruins': {"name":"Boston Bruins","league":"nhl","colors":["#231f20","#fdb71a"],"aliases":["bruins","bos bruins","bb","boston","bostonbruins","bosbru","bos"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/bos.png","city":"Boston","teamName":"Bruins"},
  'buffalo sabres': {"name":"Buffalo Sabres","league":"nhl","colors":["#00468b","#fdb71a"],"aliases":["sabres","buf sabres","bs","buffalo","buffalosabres","bufsab","buf"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/buf.png","city":"Buffalo","teamName":"Sabres"},
  'calgary flames': {"name":"Calgary Flames","league":"nhl","colors":["#dd1a32","#000000"],"aliases":["cgy","flames","calgary","calgaryflames","calfla","cal"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/cgy.png","city":"Calgary","teamName":"Flames"},
  'carolina hurricanes': {"name":"Carolina Hurricanes","league":"nhl","colors":["#e30426","#000000"],"aliases":["canes","car hurricanes","hurricanes","ch","carolina","carolinahurricanes","carhur","car"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/car.png","city":"Carolina","teamName":"Hurricanes"},
  'chicago blackhawks': {"name":"Chicago Blackhawks","league":"nhl","colors":["#e31937","#000000"],"aliases":["blackhawks","cb","chicago","chicagoblackhawks","chibla","chi"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/chi.png","city":"Chicago","teamName":"Blackhawks"},
  'colorado avalanche': {"name":"Colorado Avalanche","league":"nhl","colors":["#860038","#005ea3"],"aliases":["avs","col avalanche","col","avalanche","ca","colorado","coloradoavalanche","colava"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/col.png","city":"Colorado","teamName":"Avalanche"},
  'columbus blue jackets': {"name":"Columbus Blue Jackets","league":"nhl","colors":["#002d62","#e31937"],"aliases":["jackets","cbj","blue jackets","columbus","blue","columbus blue","coljac","col"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/cbj.png","city":"Columbus","teamName":"Blue Jackets"},
  'dallas stars': {"name":"Dallas Stars","league":"nhl","colors":["#20864c","#000000"],"aliases":["dal stars","stars","ds","dallas","dallasstars","dalsta","dal"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/dal.png","city":"Dallas","teamName":"Stars"},
  'detroit red wings': {"name":"Detroit Red Wings","league":"nhl","colors":["#e30526","#ffffff"],"aliases":["wings","det red wings","red wings","drw","detroit","red","detroit red","detwin","det"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/det.png","city":"Detroit","teamName":"Red Wings"},
  'edmonton oilers': {"name":"Edmonton Oilers","league":"nhl","colors":["#00205b","#ff4c00"],"aliases":["edm","edm oilers","oilers","eo","edmonton","edmontonoilers","edmoil"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/edm.png","city":"Edmonton","teamName":"Oilers"},
  'florida panthers': {"name":"Florida Panthers","league":"nhl","colors":["#e51937","#002d62"],"aliases":["fla panthers","fla","fp","florida","panthers","floridapanthers","flopan","flo"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/fla.png","city":"Florida","teamName":"Panthers"},
  'los angeles kings': {"name":"Los Angeles Kings","league":"nhl","colors":["#121212","#a2aaad"],"aliases":["lak","la kings","los","angeles","kings","los angeles","loskin"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/la.png","city":"Los Angeles","teamName":"Kings"},
  'minnesota wild': {"name":"Minnesota Wild","league":"nhl","colors":["#124734","#ae122a"],"aliases":["wild","min wild","mw","minnesota","minnesotawild","minwil","min"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/min.png","city":"Minnesota","teamName":"Wild"},
  'montreal canadiens': {"name":"Montreal Canadiens","league":"nhl","colors":["#c41230","#013a81"],"aliases":["canadeins","habs","mtl","canadiens de montreal","canadiens","mc","montrealcanadiens","moncan"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/mtl.png","city":"Montreal","teamName":"Canadiens"},
  'nashville predators': {"name":"Nashville Predators","league":"nhl","colors":["#fdba31","#002d62"],"aliases":["preds","nsh predators","nsh","predators","np","nashville","nashvillepredators","naspre","nas"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/nsh.png","city":"Nashville","teamName":"Predators"},
  'new jersey devils': {"name":"New Jersey Devils","league":"nhl","colors":["#e30b2b","#000000"],"aliases":["njd","nj devils","devils","new","jersey","new jersey","newdev"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/nj.png","city":"New Jersey","teamName":"Devils"},
  'new york islanders': {"name":"New York Islanders","league":"nhl","colors":["#00529b","#f47d31"],"aliases":["nyi","ny islanders","new","york","islanders","new york","newisl"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/nyi.png","city":"New York","teamName":"Islanders"},
  'new york rangers': {"name":"New York Rangers","league":"nhl","colors":["#0056ae","#e51937"],"aliases":["nyr","ny rangers","new","york","rangers","new york","newran"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/nyr.png","city":"New York","teamName":"Rangers"},
  'ottawa senators': {"name":"Ottawa Senators","league":"nhl","colors":["#dd1a32","#b79257"],"aliases":["ott","senators","os","ottawa","ottawasenators","ottsen"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/ott.png","city":"Ottawa","teamName":"Senators"},
  'philadelphia flyers': {"name":"Philadelphia Flyers","league":"nhl","colors":["#fe5823","#000000"],"aliases":["phi","phi flyers","flyers","pf","philadelphia","philadelphiaflyers","phifly"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/phi.png","city":"Philadelphia","teamName":"Flyers"},
  'pittsburgh penguins': {"name":"Pittsburgh Penguins","league":"nhl","colors":["#000000","#fdb71a"],"aliases":["pit","pens","pit penguins","penguins","pp","pittsburgh","pittsburghpenguins","pitpen"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/pit.png","city":"Pittsburgh","teamName":"Penguins"},
  'san jose sharks': {"name":"San Jose Sharks","league":"nhl","colors":["#00788a","#070707"],"aliases":["sjs","sj sharks","sharks","san","jose","san jose","sansha"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/sj.png","city":"San Jose","teamName":"Sharks"},
  'seattle kraken': {"name":"Seattle Kraken","league":"nhl","colors":["#000d33","#a3dce4"],"aliases":["kraken","sk","seattle","seattlekraken","seakra","sea"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/sea.png","city":"Seattle","teamName":"Kraken"},
  'st. louis blues': {"name":"St. Louis Blues","league":"nhl","colors":["#0070b9","#fdb71a"],"aliases":["stl","blues","slb","louis","louisblues","louis blues","st louis","st blu","lou"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/stl.png","city":"St. Louis","teamName":"Blues"},
  'tampa bay lightning': {"name":"Tampa Bay Lightning","league":"nhl","colors":["#003e7e","#ffffff"],"aliases":["tb","tampa bay","lightning","tb lightning","tbl","tampa","bay","tamlig","tam"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/tb.png","city":"Tampa Bay","teamName":"Lightning"},
  'toronto maple leafs': {"name":"Toronto Maple Leafs","league":"nhl","colors":["#003e7e","#ffffff"],"aliases":["tor","leafs","maple leafs","tor maple leafs","tml","toronto","maple","toronto maple","torlea"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/tor.png","city":"Toronto","teamName":"Maple Leafs"},
  'utah mammoth': {"name":"Utah Mammoth","league":"nhl","colors":["#000000","#7ab2e1"],"aliases":["utah","mammoth","um","utahmammoth","utamam","uta"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/utah.png","city":"Utah Mammoth","teamName":"Utah Mammoth"},
  'vancouver canucks': {"name":"Vancouver Canucks","league":"nhl","colors":["#003e7e","#008752"],"aliases":["van","van canucks","canucks","vc","vancouver","vancouvercanucks","vancan"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/van.png","city":"Vancouver","teamName":"Canucks"},
  'vegas golden knights': {"name":"Vegas Golden Knights","league":"nhl","colors":["#344043","#b4975a"],"aliases":["vgk","golden knights","vegas","golden","knights","vegas golden","vegkni","veg"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/vgk.png","city":"Vegas","teamName":"Golden Knights"},
  'washington capitals': {"name":"Washington Capitals","league":"nhl","colors":["#d71830","#0b1f41"],"aliases":["wsh","caps","wsh capitals","capitals","wc","washington","washingtoncapitals","wascap","was"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/wsh.png","city":"Washington","teamName":"Capitals"},
  'winnipeg jets': {"name":"Winnipeg Jets","league":"nhl","colors":["#002d62","#c41230"],"aliases":["wpg","wj","winnipeg","jets","winnipegjets","winjet","win"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/wpg.png","city":"Winnipeg","teamName":"Jets"},
  'arizona cardinals': {"name":"Arizona Cardinals","league":"nfl","colors":["#a40227","#ffffff"],"aliases":["ari","arizona","cardinals","arizonacardinals","aricar"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/ari.png","city":"Arizona","teamName":"Cardinals"},
  'atlanta falcons': {"name":"Atlanta Falcons","league":"nfl","colors":["#a71930","#000000"],"aliases":["atl","falcons","af","atlanta","atlantafalcons","atlfal"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/atl.png","city":"Atlanta","teamName":"Falcons"},
  'baltimore ravens': {"name":"Baltimore Ravens","league":"nfl","colors":["#29126f","#000000"],"aliases":["bal","ravens","br","baltimore","baltimoreravens","balrav"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/bal.png","city":"Baltimore","teamName":"Ravens"},
  'buffalo bills': {"name":"Buffalo Bills","league":"nfl","colors":["#00338d","#d50a0a"],"aliases":["buf","bills","bb","buffalo","buffalobills","bufbil"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/buf.png","city":"Buffalo","teamName":"Bills"},
  'carolina panthers': {"name":"Carolina Panthers","league":"nfl","colors":["#0085ca","#000000"],"aliases":["car","panthers","cp","carolina","carolinapanthers","carpan"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/car.png","city":"Carolina","teamName":"Panthers"},
  'chicago bears': {"name":"Chicago Bears","league":"nfl","colors":["#0b1c3a","#e64100"],"aliases":["chi","bears","cb","chicago","chicagobears","chibea"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/chi.png","city":"Chicago","teamName":"Bears"},
  'cincinnati bengals': {"name":"Cincinnati Bengals","league":"nfl","colors":["#fb4f14","#000000"],"aliases":["cin","bengals","cb","cincinnati","cincinnatibengals","cinben"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/cin.png","city":"Cincinnati","teamName":"Bengals"},
  'cleveland browns': {"name":"Cleveland Browns","league":"nfl","colors":["#472a08","#ff3c00"],"aliases":["cle","browns","cb","cleveland","clevelandbrowns","clebro"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/cle.png","city":"Cleveland","teamName":"Browns"},
  'dallas cowboys': {"name":"Dallas Cowboys","league":"nfl","colors":["#002a5c","#b0b7bc"],"aliases":["dal","cowboys","dc","dallas","dallascowboys","dalcow"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/dal.png","city":"Dallas","teamName":"Cowboys"},
  'denver broncos': {"name":"Denver Broncos","league":"nfl","colors":["#0a2343","#fc4c02"],"aliases":["den","broncos","db","denver","denverbroncos","denbro"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/den.png","city":"Denver","teamName":"Broncos"},
  'detroit lions': {"name":"Detroit Lions","league":"nfl","colors":["#0076b6","#bbbbbb"],"aliases":["det","lions","dl","detroit","detroitlions","detlio"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/det.png","city":"Detroit","teamName":"Lions"},
  'green bay packers': {"name":"Green Bay Packers","league":"nfl","colors":["#204e32","#ffb612"],"aliases":["gb","packers","gbp","green","bay","green bay","grepac","gre"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/gb.png","city":"Green Bay","teamName":"Packers"},
  'houston texans': {"name":"Houston Texans","league":"nfl","colors":["#00143f","#c41230"],"aliases":["hou","texans","ht","houston","houstontexans","houtex"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/hou.png","city":"Houston","teamName":"Texans"},
  'indianapolis colts': {"name":"Indianapolis Colts","league":"nfl","colors":["#003b75","#ffffff"],"aliases":["ind","colts","ic","indianapolis","indianapoliscolts","indcol"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/ind.png","city":"Indianapolis","teamName":"Colts"},
  'jacksonville jaguars': {"name":"Jacksonville Jaguars","league":"nfl","colors":["#007487","#d7a22a"],"aliases":["jags","jax","jaguars","jj","jacksonville","jacksonvillejaguars","jacjag","jac"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/jax.png","city":"Jacksonville","teamName":"Jaguars"},
  'kansas city chiefs': {"name":"Kansas City Chiefs","league":"nfl","colors":["#e31837","#ffb612"],"aliases":["kc","chiefs","kcc","kansas","kansaschiefs","kansas chiefs","kansas city","kanchi","kan"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/kc.png","city":"Kansas City","teamName":"Chiefs"},
  'las vegas raiders': {"name":"Las Vegas Raiders","league":"nfl","colors":["#000000","#a5acaf"],"aliases":["lv","raiders","lvr","las","vegas","las vegas","lasrai"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/lv.png","city":"Las Vegas","teamName":"Raiders"},
  'los angeles chargers': {"name":"Los Angeles Chargers","league":"nfl","colors":["#0080c6","#ffc20e"],"aliases":["lac","chargers","los","angeles","los angeles","loscha"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/lac.png","city":"Los Angeles","teamName":"Chargers"},
  'los angeles rams': {"name":"Los Angeles Rams","league":"nfl","colors":["#003594","#ffd100"],"aliases":["lar","rams","los","angeles","los angeles","losram"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/lar.png","city":"Los Angeles","teamName":"Rams"},
  'miami dolphins': {"name":"Miami Dolphins","league":"nfl","colors":["#008e97","#fc4c02"],"aliases":["mia","dolphins","md","miami","miamidolphins","miadol"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/mia.png","city":"Miami","teamName":"Dolphins"},
  'minnesota vikings': {"name":"Minnesota Vikings","league":"nfl","colors":["#4f2683","#ffc62f"],"aliases":["min","vikings","mv","minnesota","minnesotavikings","minvik"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/min.png","city":"Minnesota","teamName":"Vikings"},
  'new england patriots': {"name":"New England Patriots","league":"nfl","colors":["#002a5c","#c60c30"],"aliases":["pats","ne","patriots","nep","new","england","new england","newpat"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/ne.png","city":"New England","teamName":"Patriots"},
  'new orleans saints': {"name":"New Orleans Saints","league":"nfl","colors":["#d3bc8d","#000000"],"aliases":["no","saints","nos","new","orleans","new orleans","newsai"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/no.png","city":"New Orleans","teamName":"Saints"},
  'new york giants': {"name":"New York Giants","league":"nfl","colors":["#003c7f","#c9243f"],"aliases":["nyg","new","york","giants","new york","newgia"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png","city":"New York","teamName":"Giants"},
  'new york jets': {"name":"New York Jets","league":"nfl","colors":["#115740","#ffffff"],"aliases":["jets","nyj","new","york","new york","newjet"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/nyj.png","city":"New York","teamName":"Jets"},
  'philadelphia eagles': {"name":"Philadelphia Eagles","league":"nfl","colors":["#06424d","#000000"],"aliases":["phi","pe","philadelphia","eagles","philadelphiaeagles","phieag"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/phi.png","city":"Philadelphia","teamName":"Eagles"},
  'pittsburgh steelers': {"name":"Pittsburgh Steelers","league":"nfl","colors":["#000000","#ffb612"],"aliases":["pit","steelers","ps","pittsburgh","pittsburghsteelers","pitste"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/pit.png","city":"Pittsburgh","teamName":"Steelers"},
  'san francisco 49ers': {"name":"San Francisco 49ers","league":"nfl","colors":["#aa0000","#b3995d"],"aliases":["niners","49ers","sf","sf4","san","francisco","san francisco","san49e"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/sf.png","city":"San Francisco","teamName":"49ers"},
  'seattle seahawks': {"name":"Seattle Seahawks","league":"nfl","colors":["#002a5c","#69be28"],"aliases":["sea","seahawks","ss","seattle","seattleseahawks","seasea"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/sea.png","city":"Seattle","teamName":"Seahawks"},
  'tampa bay buccaneers': {"name":"Tampa Bay Buccaneers","league":"nfl","colors":["#bd1c36","#3e3a35"],"aliases":["bucs","tb","buccaneers","tbb","tampa","bay","tampa bay","tambuc","tam"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/tb.png","city":"Tampa Bay","teamName":"Buccaneers"},
  'tennessee titans': {"name":"Tennessee Titans","league":"nfl","colors":["#4495d2","#001532"],"aliases":["ten","titans","tt","tennessee","tennesseetitans","tentit"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/ten.png","city":"Tennessee Titans","teamName":"Tennessee Titans"},
  'washington commanders': {"name":"Washington Commanders","league":"nfl","colors":["#5a1414","#ffb612"],"aliases":["was","commanders","wc","washington","washingtoncommanders","wascom"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png","city":"Washington","teamName":"Commanders"},
  'arizona diamondbacks': {"name":"Arizona Diamondbacks","league":"mlb","colors":["#aa182c","#000000"],"aliases":["d-backs","diamondbacks","ari diamondbacks","dbacks","ad","arizona","arizonadiamondbacks","aridia","ari"],"logo":"https://a.espncdn.com/i/teamlogos/mlb/500/ari.png","city":"Arizona","teamName":"Diamondbacks"},
  'athletics': {"name":"Athletics","league":"mlb","colors":["#003831","#efb21e"],"aliases":["oak athletics","ath"],"logo":"https://a.espncdn.com/i/teamlogos/mlb/500/ath.png","city":"Athletics","teamName":"Athletics"},
  'atlanta braves': {"name":"Atlanta Braves","league":"mlb","colors":["#0c2340","#ba0c2f"],"aliases":["atl braves","braves","ab","atlanta","atlantabraves","atlbra","atl"],"logo":"https://a.espncdn.com/i/teamlogos/mlb/500/atl.png","city":"Atlanta","teamName":"Braves"},
  'baltimore orioles': {"name":"Baltimore Orioles","league":"mlb","colors":["#df4601","#000000"],"aliases":["bal orioles","orioles","bo","baltimore","baltimoreorioles","balori","bal"],"logo":"https://a.espncdn.com/i/teamlogos/mlb/500/bal.png","city":"Baltimore","teamName":"Orioles"},
  'boston red sox': {"name":"Boston Red Sox","league":"mlb","colors":["#0d2b56","#bd3039"],"aliases":["sox","bos red sox","brs","boston","red","boston red","bossox","bos"],"logo":"https://a.espncdn.com/i/teamlogos/mlb/500/bos.png","city":"Boston","teamName":"Red Sox"},
  'chicago cubs': {"name":"Chicago Cubs","league":"mlb","colors":["#0e3386","#cc3433"],"aliases":["chi cubs","cubs","cc","chicago","chicagocubs","chicub","chi"],"logo":"https://a.espncdn.com/i/teamlogos/mlb/500/chc.png","city":"Chicago","teamName":"Cubs"},
  'chicago white sox': {"name":"Chicago White Sox","league":"mlb","colors":["#000000","#c4ced4"],"aliases":["chi white sox","white sox","cws","chicago","white","sox","chicago white","chisox","chi"],"logo":"https://a.espncdn.com/i/teamlogos/mlb/500/chw.png","city":"Chicago","teamName":"White Sox"},
  'cincinnati reds': {"name":"Cincinnati Reds","league":"mlb","colors":["#c6011f","#ffffff"],"aliases":["cin reds","reds","cr","cincinnati","cincinnatireds","cinred","cin"],"logo":"https://a.espncdn.com/i/teamlogos/mlb/500/cin.png","city":"Cincinnati","teamName":"Reds"},
  'cleveland guardians': {"name":"Cleveland Guardians","league":"mlb","colors":["#002b5c","#e31937"],"aliases":["cle guardians","guardians","cg","cleveland","clevelandguardians","clegua","cle"],"logo":"https://a.espncdn.com/i/teamlogos/mlb/500/cle.png","city":"Cleveland","teamName":"Guardians"},
  'colorado rockies': {"name":"Colorado Rockies","league":"mlb","colors":["#33006f","#000000"],"aliases":["col rockies","rockies","cr","colorado","coloradorockies","colroc","col"],"logo":"https://a.espncdn.com/i/teamlogos/mlb/500/col.png","city":"Colorado","teamName":"Rockies"},
  'detroit tigers': {"name":"Detroit Tigers","league":"mlb","colors":["#0a2240","#ff4713"],"aliases":["det tigers","tigers","dt","detroit","detroittigers","dettig","det"],"logo":"https://a.espncdn.com/i/teamlogos/mlb/500/det.png","city":"Detroit","teamName":"Tigers"},
  'houston astros': {"name":"Houston Astros","league":"mlb","colors":["#002d62","#eb6e1f"],"aliases":["hou astros","astros","ha","houston","houstonastros","houast","hou"],"logo":"https://a.espncdn.com/i/teamlogos/mlb/500/hou.png","city":"Houston","teamName":"Astros"},
  'kansas city royals': {"name":"Kansas City Royals","league":"mlb","colors":["#004687","#7ab2dd"],"aliases":["kc royals","royals","kcr","kansas","kansasroyals","kansas royals","kansas city","kanroy","kan"],"logo":"https://a.espncdn.com/i/teamlogos/mlb/500/kc.png","city":"Kansas City","teamName":"Royals"},
  'los angeles angels': {"name":"Los Angeles Angels","league":"mlb","colors":["#ba0021","#c4ced4"],"aliases":["la angels","angels","laa","los","angeles","los angeles","losang"],"logo":"https://a.espncdn.com/i/teamlogos/mlb/500/laa.png","city":"Los Angeles","teamName":"Angels"},
  'los angeles dodgers': {"name":"Los Angeles Dodgers","league":"mlb","colors":["#005a9c","#ffffff"],"aliases":["la dodgers","dodgers","lad","los","angeles","los angeles","losdod"],"logo":"https://a.espncdn.com/i/teamlogos/mlb/500/lad.png","city":"Los Angeles","teamName":"Dodgers"},
  'miami marlins': {"name":"Miami Marlins","league":"mlb","colors":["#00a3e0","#000000"],"aliases":["mia marlins","marlins","mm","miami","miamimarlins","miamar","mia"],"logo":"https://a.espncdn.com/i/teamlogos/mlb/500/mia.png","city":"Miami","teamName":"Marlins"},
  'milwaukee brewers': {"name":"Milwaukee Brewers","league":"mlb","colors":["#13294b","#ffc72c"],"aliases":["mil brewers","brewers","mb","milwaukee","milwaukeebrewers","milbre","mil"],"logo":"https://a.espncdn.com/i/teamlogos/mlb/500/mil.png","city":"Milwaukee Brewers","teamName":"Milwaukee Brewers"},
  'minnesota twins': {"name":"Minnesota Twins","league":"mlb","colors":["#031f40","#e20e32"],"aliases":["min twins","twins","mt","minnesota","minnesotatwins","mintwi","min"],"logo":"https://a.espncdn.com/i/teamlogos/mlb/500/min.png","city":"Minnesota","teamName":"Twins"},
  'new york mets': {"name":"New York Mets","league":"mlb","colors":["#002d72","#ff5910"],"aliases":["ny mets","mets","nym","new","york","new york","newmet"],"logo":"https://a.espncdn.com/i/teamlogos/mlb/500/nym.png","city":"New York","teamName":"Mets"},
  'new york yankees': {"name":"New York Yankees","league":"mlb","colors":["#132448","#c4ced4"],"aliases":["yanks","ny yankees","yankees","nyy","new","york","new york","newyan"],"logo":"https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png","city":"New York","teamName":"Yankees"},
  'philadelphia phillies': {"name":"Philadelphia Phillies","league":"mlb","colors":["#e81828","#003278"],"aliases":["phi phillies","phillies","pp","philadelphia","philadelphiaphillies","phiphi","phi"],"logo":"https://a.espncdn.com/i/teamlogos/mlb/500/phi.png","city":"Philadelphia","teamName":"Phillies"},
  'pittsburgh pirates': {"name":"Pittsburgh Pirates","league":"mlb","colors":["#000000","#fdb827"],"aliases":["pit pirates","pirates","pp","pittsburgh","pittsburghpirates","pitpir","pit"],"logo":"https://a.espncdn.com/i/teamlogos/mlb/500/pit.png","city":"Pittsburgh","teamName":"Pirates"},
  'san diego padres': {"name":"San Diego Padres","league":"mlb","colors":["#2f241d","#ffc425"],"aliases":["sd padres","padres","sdp","san","diego","san diego","sanpad"],"logo":"https://a.espncdn.com/i/teamlogos/mlb/500/sd.png","city":"San","teamName":"Diego Padres"},
  'san francisco giants': {"name":"San Francisco Giants","league":"mlb","colors":["#000000","#fd5a1e"],"aliases":["sf giants","giants","sfg","san","francisco","san francisco","sangia"],"logo":"https://a.espncdn.com/i/teamlogos/mlb/500/sf.png","city":"San Francisco","teamName":"Giants"},
  'seattle mariners': {"name":"Seattle Mariners","league":"mlb","colors":["#005c5c","#0c2c56"],"aliases":["sea mariners","mariners","sm","seattle","seattlemariners","seamar","sea"],"logo":"https://a.espncdn.com/i/teamlogos/mlb/500/sea.png","city":"Seattle","teamName":"Mariners"},
  'st. louis cardinals': {"name":"St. Louis Cardinals","league":"mlb","colors":["#be0a14","#001541"],"aliases":["stl cardinals","cardinals","slc","louis","louiscardinals","louis cardinals","st louis","st car","lou"],"logo":"https://a.espncdn.com/i/teamlogos/mlb/500/stl.png","city":"St. Louis","teamName":"Cardinals"},
  'tampa bay rays': {"name":"Tampa Bay Rays","league":"mlb","colors":["#092c5c","#8fbce6"],"aliases":["tb rays","rays","tbr","tampa","bay","tampa bay","tamray","tam"],"logo":"https://a.espncdn.com/i/teamlogos/mlb/500/tb.png","city":"Tampa Bay","teamName":"Rays"},
  'texas rangers': {"name":"Texas Rangers","league":"mlb","colors":["#003278","#c0111f"],"aliases":["tex rangers","rangers","tr","texas","texasrangers","texran","tex"],"logo":"https://a.espncdn.com/i/teamlogos/mlb/500/tex.png","city":"Texas Rangers","teamName":"Texas Rangers"},
  'toronto blue jays': {"name":"Toronto Blue Jays","league":"mlb","colors":["#134a8e","#6cace5"],"aliases":["tor blue jays","blue jays","tbj","toronto","blue","jays","toronto blue","torjay","tor"],"logo":"https://a.espncdn.com/i/teamlogos/mlb/500/tor.png","city":"Toronto","teamName":"Blue Jays"},
  'washington nationals': {"name":"Washington Nationals","league":"mlb","colors":["#ab0003","#11225b"],"aliases":["wsh nationals","nationals","wn","washington","washingtonnationals","wasnat","was"],"logo":"https://a.espncdn.com/i/teamlogos/mlb/500/wsh.png","city":"Washington","teamName":"Nationals"},
  'alpine': {"name":"Alpine","league":"f1","colors":["#FFF500","#ffffff"],"aliases":["alp","alpi"],"logo":"https://ui-avatars.com/api/?name=Alpine&background=FFF500&color=ffffff&size=200&font-size=0.4","city":"Alpine","teamName":"Alpine"},
  'aston martin': {"name":"Aston Martin","league":"f1","colors":["#006F62","#ffffff"],"aliases":["amr","am","aston","martin","astonmartin","ast"],"logo":"https://ui-avatars.com/api/?name=Aston%20Martin&background=006F62&color=ffffff&size=200&font-size=0.4","city":"Aston","teamName":"Martin"},
  'ferrari': {"name":"Ferrari","league":"f1","colors":["#DC0000","#ffffff"],"aliases":["scuderia ferrari","fer"],"logo":"https://ui-avatars.com/api/?name=Ferrari&background=DC0000&color=ffffff&size=200&font-size=0.4","city":"Ferrari","teamName":"Ferrari"},
  'haas': {"name":"Haas","league":"f1","colors":["#5A5A5A","#ffffff"],"aliases":["haas f1","haa"],"logo":"https://ui-avatars.com/api/?name=Haas&background=5A5A5A&color=ffffff&size=200&font-size=0.4","city":"Haas","teamName":"Haas"},
  'mclaren': {"name":"McLaren","league":"f1","colors":["#FF8700","#ffffff"],"aliases":["mcl","mcla"],"logo":"https://ui-avatars.com/api/?name=McLaren&background=FF8700&color=ffffff&size=200&font-size=0.4","city":"McLaren","teamName":"McLaren"},
  'mercedes': {"name":"Mercedes","league":"f1","colors":["#00D2BE","#ffffff"],"aliases":["mercedes amg","mer"],"logo":"https://a.espncdn.com/i/teamlogos/soccer/500/21500.png","city":"Mercedes","teamName":"Mercedes"},
  'racing bulls': {"name":"Racing Bulls","league":"f1","colors":["#6692FF","#ffffff"],"aliases":["visa cash app rb","vcarb","rb","racing","bulls","racingbulls","rac"],"logo":"https://ui-avatars.com/api/?name=Racing%20Bulls&background=6692FF&color=ffffff&size=200&font-size=0.4","city":"Racing Bulls","teamName":"Racing Bulls"},
  'red bull': {"name":"Red Bull","league":"f1","colors":["#00327D","#ffffff"],"aliases":["red bull racing","rbr","rb","red","bull","redbull"],"logo":"https://ui-avatars.com/api/?name=Red%20Bull&background=00327D&color=ffffff&size=200&font-size=0.4","city":"Red Bull","teamName":"Red Bull"},
  'williams': {"name":"Williams","league":"f1","colors":["#FFFFFF","#ffffff"],"aliases":["wil","will"],"logo":"https://ui-avatars.com/api/?name=Williams&background=FFFFFF&color=ffffff&size=200&font-size=0.4","city":"Williams","teamName":"Williams"},
  'boston fleet': {"name":"Boston Fleet","league":"pwhl","colors":["#1B4332","#B9E28C"],"aliases":["boston pwhl","bf","boston","fleet","bostonfleet","bosfle","bos"],"logo":"https://upload.wikimedia.org/wikipedia/en/2/27/Boston_Fleet_logo.svg","city":"Boston","teamName":"Fleet"},
  'minnesota frost': {"name":"Minnesota Frost","league":"pwhl","colors":["#3B225D","#9A85B8"],"aliases":["minnesota pwhl","mf","minnesota","frost","minnesotafrost","minfro","min"],"logo":"https://upload.wikimedia.org/wikipedia/en/5/5a/Minnesota_Frost_logo.svg","city":"Minnesota","teamName":"Frost"},
  'montréal victoire': {"name":"Montréal Victoire","league":"pwhl","colors":["#6C1A31","#E3C1B4"],"aliases":["montreal pwhl","mv","victoire","montrealvictoire","monvic"],"logo":"https://upload.wikimedia.org/wikipedia/en/c/cd/Montreal_Victoire_logo.svg","city":"Montréal","teamName":"Victoire"},
  'new york sirens': {"name":"New York Sirens","league":"pwhl","colors":["#195861","#ECA921"],"aliases":["new york pwhl","nys","new","york","sirens","new york","newsir"],"logo":"https://upload.wikimedia.org/wikipedia/en/1/1a/New_York_Sirens_logo.svg","city":"New York","teamName":"Sirens"},
  'ottawa charge': {"name":"Ottawa Charge","league":"pwhl","colors":["#C2002F","#FFC107"],"aliases":["ottawa pwhl","oc","ottawa","charge","ottawacharge","ottcha","ott"],"logo":"https://upload.wikimedia.org/wikipedia/en/a/ad/Ottawa_Charge_logo.svg","city":"Ottawa","teamName":"Charge"},
  'toronto sceptres': {"name":"Toronto Sceptres","league":"pwhl","colors":["#0033A0","#FFC72C"],"aliases":["toronto pwhl","ts","toronto","sceptres","torontosceptres","torsce","tor"],"logo":"https://upload.wikimedia.org/wikipedia/en/4/4b/Toronto_Sceptres_logo.svg","city":"Toronto","teamName":"Sceptres"},
  'seattle': {"name":"Seattle","league":"pwhl","colors":["#00314A","#7EC3E4"],"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/sea.png","aliases":["sea","seat"],"city":"Seattle","teamName":"Seattle"},
  'vancouver': {"name":"Vancouver","league":"pwhl","colors":["#450849","#EC145A"],"logo":"https://a.espncdn.com/i/teamlogos/nhl/500/van.png","aliases":["van","vanc"],"city":"Vancouver","teamName":"Vancouver"},
  'acadie-bathurst titan': {"name":"Acadie-Bathurst Titan","league":"lhjmq","colors":["#D0202E","#F6B221"],"aliases":["acadie bathurst","titan","at","acadiebathurst","acadiebathursttitan","aca"],"logo":"https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/acadiebathursttitan.png","city":"Acadie-Bathurst Titan","teamName":"Acadie-Bathurst Titan"},
  'baie-comeau drakkar': {"name":"Baie-Comeau Drakkar","league":"lhjmq","colors":["#D51820","#FFCD00"],"aliases":["drakkar","bd","baiecomeau","baiecomeaudrakkar","bai"],"logo":"https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/baiecomeaudrakkar.png","city":"Baie-Comeau Drakkar","teamName":"Baie-Comeau Drakkar"},
  'blainville-boisbriand armada': {"name":"Blainville-Boisbriand Armada","league":"lhjmq","colors":["#000000","#FFFFFF"],"aliases":["armada","ba","blainvilleboisbriand","blainvilleboisbriandarmada","bla"],"logo":"https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/blainvilleboisbriandarmada.png","city":"Blainville-Boisbriand Armada","teamName":"Blainville-Boisbriand Armada"},
  'cape breton eagles': {"name":"Cape Breton Eagles","league":"lhjmq","colors":["#000000","#FDBA31"],"aliases":["eagles","cape breton","cbe","cape","breton","cap"],"logo":"https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/capebretoneagles.png","city":"Cape Breton Eagles","teamName":"Cape Breton Eagles"},
  'charlottetown islanders': {"name":"Charlottetown Islanders","league":"lhjmq","colors":["#000000","#C4A052"],"aliases":["islanders","ci","charlottetown","charlottetownislanders","cha"],"logo":"https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/charlottetownislanders.png","city":"Charlottetown Islanders","teamName":"Charlottetown Islanders"},
  'chicoutimi saguenéens': {"name":"Chicoutimi Saguenéens","league":"lhjmq","colors":["#002147","#A0C6EB"],"aliases":["sagueneens","saguenéens","cs","chicoutimi","chicoutimisagueneens","chi"],"logo":"https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/chicoutimisaguenens.png","city":"Chicoutimi Saguenéens","teamName":"Chicoutimi Saguenéens"},
  'drummondville voltigeurs': {"name":"Drummondville Voltigeurs","league":"lhjmq","colors":["#E31837","#000000"],"aliases":["voltigeurs","dv","drummondville","drummondvillevoltigeurs","dru"],"logo":"https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/drummondvillevoltigeurs.png","city":"Drummondville Voltigeurs","teamName":"Drummondville Voltigeurs"},
  'gatineau olympiques': {"name":"Gatineau Olympiques","league":"lhjmq","colors":["#000000","#B0B2B5"],"aliases":["olympiques","go","gatineau","gatineauolympiques","gat"],"logo":"https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/gatineauolympiques.png","city":"Gatineau Olympiques","teamName":"Gatineau Olympiques"},
  'halifax mooseheads': {"name":"Halifax Mooseheads","league":"lhjmq","colors":["#004C2E","#CF152D"],"aliases":["mooseheads","hm","halifax","halifaxmooseheads","hal"],"logo":"https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/halifaxmooseheads.png","city":"Halifax Mooseheads","teamName":"Halifax Mooseheads"},
  'moncton wildcats': {"name":"Moncton Wildcats","league":"lhjmq","colors":["#000000","#F2A900"],"aliases":["wildcats","mw","moncton","monctonwildcats"],"logo":"https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/monctonwildcats.png","city":"Moncton Wildcats","teamName":"Moncton Wildcats"},
  'québec remparts': {"name":"Québec Remparts","league":"lhjmq","colors":["#E31837","#000000"],"aliases":["remparts","qr","quebec","quebecremparts","que"],"logo":"https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/qubecremparts.png","city":"Québec Remparts","teamName":"Québec Remparts"},
  'rimouski océanic': {"name":"Rimouski Océanic","league":"lhjmq","colors":["#00205B","#FFFFFF"],"aliases":["oceanic","océanic","ro","rimouski","rimouskioceanic","rim"],"logo":"https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/rimouskiocanic.png","city":"Rimouski Océanic","teamName":"Rimouski Océanic"},
  'rouyn-noranda huskies': {"name":"Rouyn-Noranda Huskies","league":"lhjmq","colors":["#C8102E","#000000"],"aliases":["huskies","rh","rouynnoranda","rouynnorandahuskies","rou"],"logo":"https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/rouynnorandahuskies.png","city":"Rouyn-Noranda Huskies","teamName":"Rouyn-Noranda Huskies"},
  'saint john sea dogs': {"name":"Saint John Sea Dogs","league":"lhjmq","colors":["#003E7E","#000000"],"aliases":["sea dogs","sjsd","saint","john","sea","dogs","sai"],"logo":"https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/saintjohnseadogs.png","city":"Saint John Sea Dogs","teamName":"Saint John Sea Dogs"},
  'shawinigan cataractes': {"name":"Shawinigan Cataractes","league":"lhjmq","colors":["#003A70","#FFC72C"],"aliases":["cataractes","shawinigan","shawinigancataractes","sha"],"logo":"https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/shawinigancataractes.png","city":"Shawinigan Cataractes","teamName":"Shawinigan Cataractes"},
  'sherbrooke phoenix': {"name":"Sherbrooke Phoenix","league":"lhjmq","colors":["#002D62","#E4B61C"],"aliases":["phoenix","sp","sherbrooke","sherbrookephoenix","she"],"logo":"https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/sherbrookephoenix.png","city":"Sherbrooke Phoenix","teamName":"Sherbrooke Phoenix"},
  'victoriaville tigres': {"name":"Victoriaville Tigres","league":"lhjmq","colors":["#000000","#FFD100"],"aliases":["tigres","vt","victoriaville","victoriavilletigres","vic"],"logo":"https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/victoriavilletigres.png","city":"Victoriaville Tigres","teamName":"Victoriaville Tigres"},
  'argentina': {"name":"Argentina","league":"world cup","colors":["#43A1D5","#ffffff"],"aliases":["arg","arge"],"logo":"https://ui-avatars.com/api/?name=Argentina&background=43A1D5&color=ffffff&size=200&font-size=0.4","city":"Argentina","teamName":"Argentina"},
  'brazil': {"name":"Brazil","league":"world cup","colors":["#FEDF00","#009b3a"],"aliases":["bra","braz"],"logo":"https://ui-avatars.com/api/?name=Brazil&background=FEDF00&color=009b3a&size=200&font-size=0.4","city":"Brazil","teamName":"Brazil"},
  'usa': {"name":"USA","league":"world cup","colors":["#002868","#bf0a30"],"logo":"https://a.espncdn.com/i/teamlogos/countries/500/usa.png","aliases":["us","united states"],"city":"USA","teamName":"USA"},
  'mexico': {"name":"Mexico","league":"world cup","colors":["#006847","#ce1126"],"aliases":["mex","mexi"],"logo":"https://ui-avatars.com/api/?name=Mexico&background=006847&color=ce1126&size=200&font-size=0.4","city":"Mexico","teamName":"Mexico"},
  'canada': {"name":"Canada","league":"world cup","colors":["#ff0000","#ffffff"],"aliases":["can","cana"],"logo":"https://ui-avatars.com/api/?name=Canada&background=ff0000&color=ffffff&size=200&font-size=0.4","city":"Canada","teamName":"Canada"},
  'japan': {"name":"Japan","league":"world cup","colors":["#00008b","#ffffff"],"aliases":["jap","japa"],"logo":"https://ui-avatars.com/api/?name=Japan&background=00008b&color=ffffff&size=200&font-size=0.4","city":"Japan","teamName":"Japan"},
  'morocco': {"name":"Morocco","league":"world cup","colors":["#c1272d","#006233"],"aliases":["mor","moro"],"logo":"https://ui-avatars.com/api/?name=Morocco&background=c1272d&color=006233&size=200&font-size=0.4","city":"Morocco","teamName":"Morocco"},
  'senegal': {"name":"Senegal","league":"world cup","colors":["#00853f","#fdef42"],"aliases":["sen","sene"],"logo":"https://ui-avatars.com/api/?name=Senegal&background=00853f&color=fdef42&size=200&font-size=0.4","city":"Senegal","teamName":"Senegal"},
  'bc lions': {"name":"BC Lions","league":"cfl","colors":["#F15A24","#000000"],"aliases":["bc","lions","bl","lio"],"logo":"https://ui-avatars.com/api/?name=BC%20Lions&background=F15A24&color=000000&size=200&font-size=0.4","city":"BC Lions","teamName":"BC Lions"},
  'calgary stampeders': {"name":"Calgary Stampeders","league":"cfl","colors":["#ED1B24","#000000"],"aliases":["cgy","stampeders","cs","calgary","calgarystampeders","calsta","cal"],"logo":"https://ui-avatars.com/api/?name=Calgary%20Stampeders&background=ED1B24&color=000000&size=200&font-size=0.4","city":"Calgary","teamName":"Stampeders"},
  'edmonton elks': {"name":"Edmonton Elks","league":"cfl","colors":["#235F33","#FFB81C"],"aliases":["edm","elks","ee","edmonton","edmontonelks","edmelk"],"logo":"https://ui-avatars.com/api/?name=Edmonton%20Elks&background=235F33&color=FFB81C&size=200&font-size=0.4","city":"Edmonton","teamName":"Elks"},
  'saskatchewan roughriders': {"name":"Saskatchewan Roughriders","league":"cfl","colors":["#006341","#FFFFFF"],"aliases":["ssk","roughriders","sr","saskatchewan","saskatchewanroughriders","sasrou","sas"],"logo":"https://ui-avatars.com/api/?name=Saskatchewan%20Roughriders&background=006341&color=FFFFFF&size=200&font-size=0.4","city":"Saskatchewan Roughriders","teamName":"Saskatchewan Roughriders"},
  'winnipeg blue bombers': {"name":"Winnipeg Blue Bombers","league":"cfl","colors":["#002B5C","#B5985A"],"aliases":["wpg","blue bombers","wbb","winnipeg","blue","bombers","winnipeg blue","winbom","win"],"logo":"https://ui-avatars.com/api/?name=Winnipeg%20Blue%20Bombers&background=002B5C&color=B5985A&size=200&font-size=0.4","city":"Winnipeg","teamName":"Blue Bombers"},
  'hamilton tiger-cats': {"name":"Hamilton Tiger-Cats","league":"cfl","colors":["#FFB81C","#000000"],"aliases":["ham","tiger-cats","ht","hamilton","tigercats","hamiltontigercats","hamtig"],"logo":"https://ui-avatars.com/api/?name=Hamilton%20Tiger-Cats&background=FFB81C&color=000000&size=200&font-size=0.4","city":"Hamilton Tiger-Cats","teamName":"Hamilton Tiger-Cats"},
  'toronto argonauts': {"name":"Toronto Argonauts","league":"cfl","colors":["#00205B","#60A6DA"],"aliases":["tor","argonauts","argos","ta","toronto","torontoargonauts","torarg"],"logo":"https://ui-avatars.com/api/?name=Toronto%20Argonauts&background=00205B&color=60A6DA&size=200&font-size=0.4","city":"Toronto","teamName":"Argonauts"},
  'ottawa redblacks': {"name":"Ottawa Redblacks","league":"cfl","colors":["#D11241","#000000"],"aliases":["ott","redblacks","or","ottawa","ottawaredblacks","ottred"],"logo":"https://ui-avatars.com/api/?name=Ottawa%20Redblacks&background=D11241&color=000000&size=200&font-size=0.4","city":"Ottawa","teamName":"Redblacks"},
  'montreal alouettes': {"name":"Montreal Alouettes","league":"cfl","colors":["#002A5C","#E21A22"],"aliases":["mtl","alouettes","ma","montrealalouettes","monalo"],"logo":"https://ui-avatars.com/api/?name=Montreal%20Alouettes&background=002A5C&color=E21A22&size=200&font-size=0.4","city":"Montreal","teamName":"Alouettes"},
  'blue jays': {"name":"Blue Jays","league":"Autres","colors":["#134a8e","#1d2d5c"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Blue%20Jays&background=134a8e&color=1d2d5c&size=200&font-size=0.4","city":"Blue Jays","teamName":"Blue Jays"},
  'parissaintgermain': {"name":"Parissaintgermain","league":"Autres","colors":["#004170","#da291c"],"aliases":["psg","paris sg"],"logo":"https://ui-avatars.com/api/?name=Parissaintgermain&background=004170&color=da291c&size=200&font-size=0.4","city":"Parissaintgermain","teamName":"Parissaintgermain"},
  'monaco': {"name":"Monaco","league":"Autres","colors":["#E3001B","#FFFFFF"],"aliases":["as monaco","asm"],"logo":"https://ui-avatars.com/api/?name=Monaco&background=E3001B&color=FFFFFF&size=200&font-size=0.4","city":"Monaco","teamName":"Monaco"},
  'rennes': {"name":"Rennes","league":"Autres","colors":["#E2001A","#000000"],"aliases":["stade rennais"],"logo":"https://ui-avatars.com/api/?name=Rennes&background=E2001A&color=000000&size=200&font-size=0.4","city":"Rennes","teamName":"Rennes"},
  'montpellier': {"name":"Montpellier","league":"Autres","colors":["#011F68","#ffffff"],"aliases":["mhsc"],"logo":"https://ui-avatars.com/api/?name=Montpellier&background=011F68&color=ffffff&size=200&font-size=0.4","city":"Montpellier","teamName":"Montpellier"},
  'reims': {"name":"Reims","league":"Autres","colors":["#ED1C24","#FFFFFF"],"aliases":["stade de reims"],"logo":"https://ui-avatars.com/api/?name=Reims&background=ED1C24&color=FFFFFF&size=200&font-size=0.4","city":"Reims","teamName":"Reims"},
  'auxerre': {"name":"Auxerre","league":"Autres","colors":["#FFFFFF","#004170"],"aliases":["aja"],"logo":"https://ui-avatars.com/api/?name=Auxerre&background=FFFFFF&color=004170&size=200&font-size=0.4","city":"Auxerre","teamName":"Auxerre"},
  'le havre': {"name":"Le Havre","league":"Autres","colors":["#00BFFF","#000000"],"aliases":["hac"],"logo":"https://ui-avatars.com/api/?name=Le%20Havre&background=00BFFF&color=000000&size=200&font-size=0.4","city":"Le Havre","teamName":"Le Havre"},
  'saint-étienne': {"name":"Saint-Étienne","league":"Autres","colors":["#51cc5f","#ffffff"],"aliases":["asse","st etienne","saint etienne"],"logo":"https://ui-avatars.com/api/?name=Saint-%C3%89tienne&background=51cc5f&color=ffffff&size=200&font-size=0.4","city":"Saint-Étienne","teamName":"Saint-Étienne"},
  'or foreurs': {"name":"Or Foreurs","league":"Autres","colors":["#00573F","#FFC72C"],"logo":"https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/valdorforeurs.png","aliases":[],"city":"Or Foreurs","teamName":"Or Foreurs"},
  'as le gosier': {"name":"As Le Gosier","league":"Autres","colors":["#00008B","#C60000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=As%20Le%20Gosier&background=00008B&color=C60000&size=200&font-size=0.4","city":"AS","teamName":"Le Gosier"},
  'as nancy lorraine': {"name":"As Nancy Lorraine","league":"Autres","colors":["#ef2f24","#0000bf"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=As%20Nancy%20Lorraine&background=ef2f24&color=0000bf&size=200&font-size=0.4","city":"AS","teamName":"Nancy Lorraine"},
  'arcachon': {"name":"Arcachon","league":"Autres","colors":["#000000","#C60000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Arcachon&background=000000&color=C60000&size=200&font-size=0.4","city":"Arcachon","teamName":"Arcachon"},
  'avranches': {"name":"Avranches","league":"Autres","colors":["#000000","#000000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Avranches&background=000000&color=000000&size=200&font-size=0.4","city":"Avranches","teamName":"Avranches"},
  'bastia': {"name":"Bastia","league":"Autres","colors":["#0000bf","#fafafc"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Bastia&background=0000bf&color=fafafc&size=200&font-size=0.4","city":"Bastia","teamName":"Bastia"},
  'bayeux': {"name":"Bayeux","league":"Autres","colors":["#000000","#C60000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Bayeux&background=000000&color=C60000&size=200&font-size=0.4","city":"Bayeux","teamName":"Bayeux"},
  'biesheim': {"name":"Biesheim","league":"Autres","colors":["#000000","#C60000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Biesheim&background=000000&color=C60000&size=200&font-size=0.4","city":"Biesheim","teamName":"Biesheim"},
  'blois foot 41': {"name":"Blois Foot 41","league":"Autres","colors":["#000000","#C60000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Blois%20Foot%2041&background=000000&color=C60000&size=200&font-size=0.4","city":"Blois Foot 41","teamName":"Blois Foot 41"},
  'bordeaux': {"name":"Bordeaux","league":"Autres","colors":["#011F68","#ffffff"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Bordeaux&background=011F68&color=ffffff&size=200&font-size=0.4","city":"Bordeaux","teamName":"Bordeaux"},
  'bourg-peronnas': {"name":"Bourg-Peronnas","league":"Autres","colors":["#000000","#C60000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Bourg-Peronnas&background=000000&color=C60000&size=200&font-size=0.4","city":"Bourg-Peronnas","teamName":"Bourg-Peronnas"},
  'canet roussillon fc': {"name":"Canet Roussillon Fc","league":"Autres","colors":["#000000","#C60000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Canet%20Roussillon%20Fc&background=000000&color=C60000&size=200&font-size=0.4","city":"FC","teamName":"Canet Roussillon"},
  'chantilly': {"name":"Chantilly","league":"Autres","colors":["#000000","#C60000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Chantilly&background=000000&color=C60000&size=200&font-size=0.4","city":"Chantilly","teamName":"Chantilly"},
  'concarneau': {"name":"Concarneau","league":"Autres","colors":["#000000","#000000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Concarneau&background=000000&color=000000&size=200&font-size=0.4","city":"Concarneau","teamName":"Concarneau"},
  'dieppe': {"name":"Dieppe","league":"Autres","colors":["#000000","#C60000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Dieppe&background=000000&color=C60000&size=200&font-size=0.4","city":"Dieppe","teamName":"Dieppe"},
  'dunkerque': {"name":"Dunkerque","league":"Autres","colors":["#005a9c","#000000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Dunkerque&background=005a9c&color=000000&size=200&font-size=0.4","city":"Dunkerque","teamName":"Dunkerque"},
  'fc freyming': {"name":"Fc Freyming","league":"Autres","colors":["#FFAC1C","#000000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Fc%20Freyming&background=FFAC1C&color=000000&size=200&font-size=0.4","city":"FC","teamName":"Freyming"},
  'fc istres': {"name":"Fc Istres","league":"Autres","colors":["#452BB3","#C60000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Fc%20Istres&background=452BB3&color=C60000&size=200&font-size=0.4","city":"FC","teamName":"Istres"},
  'fc périgny': {"name":"Fc Périgny","league":"Autres","colors":["#000000","#C60000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Fc%20P%C3%A9rigny&background=000000&color=C60000&size=200&font-size=0.4","city":"FC","teamName":"Périgny"},
  'feignies': {"name":"Feignies","league":"Autres","colors":["#000000","#000000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Feignies&background=000000&color=000000&size=200&font-size=0.4","city":"Feignies","teamName":"Feignies"},
  'fontenay foot': {"name":"Fontenay Foot","league":"Autres","colors":["#000000","#C60000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Fontenay%20Foot&background=000000&color=C60000&size=200&font-size=0.4","city":"Fontenay Foot","teamName":"Fontenay Foot"},
  'gsi pontivy': {"name":"Gsi Pontivy","league":"Autres","colors":["#000000","#C60000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Gsi%20Pontivy&background=000000&color=C60000&size=200&font-size=0.4","city":"Gsi Pontivy","teamName":"Gsi Pontivy"},
  'grenoble': {"name":"Grenoble","league":"Autres","colors":["#005da3","#000000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Grenoble&background=005da3&color=000000&size=200&font-size=0.4","city":"Grenoble","teamName":"Grenoble"},
  'guingamp': {"name":"Guingamp","league":"Autres","colors":["#ef2f24","#1a1a1a"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Guingamp&background=ef2f24&color=1a1a1a&size=200&font-size=0.4","city":"Guingamp","teamName":"Guingamp"},
  'hauts lyonnais': {"name":"Hauts Lyonnais","league":"Autres","colors":["#000000","#C60000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Hauts%20Lyonnais&background=000000&color=C60000&size=200&font-size=0.4","city":"Hauts Lyonnais","teamName":"Hauts Lyonnais"},
  'ic croix': {"name":"Ic Croix","league":"Autres","colors":["#000000","#C60000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Ic%20Croix&background=000000&color=C60000&size=200&font-size=0.4","city":"Ic Croix","teamName":"Ic Croix"},
  'le mans': {"name":"Le Mans","league":"Autres","colors":["#d62b11","#d62b11"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Le%20Mans&background=d62b11&color=d62b11&size=200&font-size=0.4","city":"Le Mans","teamName":"Le Mans"},
  'le puy': {"name":"Le Puy","league":"Autres","colors":["#000000","#C60000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Le%20Puy&background=000000&color=C60000&size=200&font-size=0.4","city":"Le Puy","teamName":"Le Puy"},
  'les herbiers': {"name":"Les Herbiers","league":"Autres","colors":["#000000","#C60000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Les%20Herbiers&background=000000&color=C60000&size=200&font-size=0.4","city":"Les Herbiers","teamName":"Les Herbiers"},
  'les sables': {"name":"Les Sables","league":"Autres","colors":["#00008B","#C60000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Les%20Sables&background=00008B&color=C60000&size=200&font-size=0.4","city":"Les Sables","teamName":"Les Sables"},
  'lyon-duchère': {"name":"Lyon-Duchère","league":"Autres","colors":["#000000","#C60000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Lyon-Duch%C3%A8re&background=000000&color=C60000&size=200&font-size=0.4","city":"Lyon-Duchère","teamName":"Lyon-Duchère"},
  'montreuil fc': {"name":"Montreuil Fc","league":"Autres","colors":["#4cbb17","#000000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Montreuil%20Fc&background=4cbb17&color=000000&size=200&font-size=0.4","city":"FC","teamName":"Montreuil"},
  'olympique marcquois': {"name":"Olympique Marcquois","league":"Autres","colors":["#000000","#C60000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Olympique%20Marcquois&background=000000&color=C60000&size=200&font-size=0.4","city":"Olympique Marcquois","teamName":"Olympique Marcquois"},
  'orléans': {"name":"Orléans","league":"Autres","colors":["#000000","#C60000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Orl%C3%A9ans&background=000000&color=C60000&size=200&font-size=0.4","city":"Orléans","teamName":"Orléans"},
  'etape': {"name":"Etape","league":"Autres","colors":["#000000","#C60000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Etape&background=000000&color=C60000&size=200&font-size=0.4","city":"Etape","teamName":"Etape"},
  'sc amiens': {"name":"Sc Amiens","league":"Autres","colors":["#ffffff","#1a1a1a"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Sc%20Amiens&background=ffffff&color=1a1a1a&size=200&font-size=0.4","city":"Sc Amiens","teamName":"Sc Amiens"},
  'saint-cyr collonges': {"name":"Saint-Cyr Collonges","league":"Autres","colors":["#000000","#C60000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Saint-Cyr%20Collonges&background=000000&color=C60000&size=200&font-size=0.4","city":"Saint-Cyr Collonges","teamName":"Saint-Cyr Collonges"},
  'sochaux': {"name":"Sochaux","league":"Autres","colors":["#ffff00","#000040"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Sochaux&background=ffff00&color=000040&size=200&font-size=0.4","city":"Sochaux","teamName":"Sochaux"},
  'sport athlétique mérignacais': {"name":"Sport Athlétique Mérignacais","league":"Autres","colors":["#000000","#C60000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Sport%20Athl%C3%A9tique%20M%C3%A9rignacais&background=000000&color=C60000&size=200&font-size=0.4","city":"Sport Athlétique Mérignacais","teamName":"Sport Athlétique Mérignacais"},
  'stade béthunois': {"name":"Stade Béthunois","league":"Autres","colors":["#000000","#C60000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Stade%20B%C3%A9thunois&background=000000&color=C60000&size=200&font-size=0.4","city":"Stade Béthunois","teamName":"Stade Béthunois"},
  'stade laval': {"name":"Stade Laval","league":"Autres","colors":["#1a1a1a","#1a1a1a"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Stade%20Laval&background=1a1a1a&color=1a1a1a&size=200&font-size=0.4","city":"Stade Laval","teamName":"Stade Laval"},
  'stade de reims': {"name":"Stade De Reims","league":"Autres","colors":["#ef2f24","#0000bf"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Stade%20De%20Reims&background=ef2f24&color=0000bf&size=200&font-size=0.4","city":"Stade De Reims","teamName":"Stade De Reims"},
  'tbd away': {"name":"Tbd Away","league":"Autres","colors":["#000000","#C60000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Tbd%20Away&background=000000&color=C60000&size=200&font-size=0.4","city":"Tbd Away","teamName":"Tbd Away"},
  'troyes': {"name":"Troyes","league":"Autres","colors":["#0000bf","#fafafc"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Troyes&background=0000bf&color=fafafc&size=200&font-size=0.4","city":"Troyes","teamName":"Troyes"},
  'us chauvigny': {"name":"Us Chauvigny","league":"Autres","colors":["#000000","#C60000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Us%20Chauvigny&background=000000&color=C60000&size=200&font-size=0.4","city":"Us Chauvigny","teamName":"Us Chauvigny"},
  'us lusitanos saint-maur': {"name":"Us Lusitanos Saint-Maur","league":"Autres","colors":["#000000","#C60000"],"aliases":[],"logo":"https://ui-avatars.com/api/?name=Us%20Lusitanos%20Saint-Maur&background=000000&color=C60000&size=200&font-size=0.4","city":"Us Lusitanos Saint-Maur","teamName":"Us Lusitanos Saint-Maur"},
};




var STATIC_TEAMS = [];
var TEAM_COLORS = {};
var TEAM_ALIASES = {};
var NORM_TEAM_KEYS = {};

for (var key in TEAM_DATA) {
    var data = TEAM_DATA[key];
    if (data.name && data.league) {
        if (Array.isArray(data.league)) {
            data.league.forEach(function(lg) {
                STATIC_TEAMS.push({ name: data.name, league: lg });
            });
        } else {
            STATIC_TEAMS.push({ name: data.name, league: data.league });
        }
    }
    if (data.colors) {
        TEAM_COLORS[data.name.toLowerCase()] = data.colors;
        TEAM_COLORS[key] = data.colors;
    }
    if (data.aliases) {
        data.aliases.forEach(function(alias) {
            TEAM_ALIASES[alias] = key;
        });
    }
}
var LGC = {
  'champions league':'#f59e0b','europa league':'#ea580c','conference league':'#84cc16',
  'premier league':'#7c3aed','ligue 1':'#2563eb','la liga':'#dc2626',
  'bundesliga':'#b91c1c','serie a':'#059669','eredivisie':'#f97316',
  'primeira liga':'#15803d','mls':'#1e40af','fa cup':'#9333ea',
  'copa del rey':'#b45309','nations league':'#6d28d9','world cup':'#0891b2',
  'nba':'#17408b','nhl':'#000000','nfl':'#013369','mlb':'#002d72'
};
var FLAGS = {
  'england':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','france':'🇫🇷','spain':'🇪🇸','germany':'🇩🇪','italy':'🇮🇹',
  'netherlands':'🇳🇱','portugal':'🇵🇹','turkey':'🇹🇷','usa':'🇺🇸','brazil':'🇧🇷',
  'argentina':'🇦🇷','europe':'🌍','world':'🌐','scotland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','belgium':'🇧🇪',
};
function lgColor(n){
  var l=(n||'').toLowerCase();
  for(var k in LGC){ if(l.indexOf(k)>=0) return LGC[k]; }
  var h=[].reduce.call(n||'X',function(a,c){return a+c.charCodeAt(0);},0);
  return 'hsl('+[200,240,280,320,150,180,210][h%7]+',55%,30%)';
}
function lgFlag(n){
  var l=(n||'').toLowerCase();
  for(var k in FLAGS){ if(l.indexOf(k)>=0) return FLAGS[k]; }
  if(l.indexOf('mlb') >= 0 || l.indexOf('baseball') >= 0) return '⚾';
  if(l.indexOf('nfl') >= 0 || l.indexOf('american football') >= 0 || l.indexOf('cfl') >= 0) return '🏈';
  if(l.indexOf('nba') >= 0 || l.indexOf('basketball') >= 0) return '🏀';
  if(l.indexOf('nhl') >= 0 || l.indexOf('hockey') >= 0 || l.indexOf('pwhl') >= 0 || l.indexOf('qmjhl') >= 0 || l.indexOf('lhjmq') >= 0) return '🏒';
  if(l.indexOf('f1') >= 0 || l.indexOf('formula 1') >= 0 || l.indexOf('indycar') >= 0 || l.indexOf('indy') >= 0) return '🏎️';
  if(l.indexOf('motogp') >= 0 || l.indexOf('moto gp') >= 0) return '🏍️';
  if(l.indexOf('wwe') >= 0 || l.indexOf('wrestling') >= 0 || l.indexOf('ufc') >= 0 || l.indexOf('mma') >= 0 || l.indexOf('boxing') >= 0) return '🥊';
  if(l.indexOf('tennis') >= 0) return '🎾';
  if(l.indexOf('rugby') >= 0) return '🏉';
  if(l.indexOf('golf') >= 0) return '⛳';
  if(l.indexOf('cricket') >= 0) return '🏏';
  if(l.indexOf('volleyball') >= 0) return '🏐';
  if(l.indexOf('darts') >= 0) return '🎯';
  if(l.indexOf('snooker') >= 0) return '🎱';
  if(l.indexOf('cycling') >= 0 || l.indexOf('tour de france') >= 0) return '🚴';
  return '⚽';
}



function getTeamColors(teamName) {
    if (!teamName) return ['#333333', '#ffffff'];
    var lowerName = teamName.toLowerCase().trim();
    if (TEAM_DATA[lowerName] && TEAM_DATA[lowerName].colors) {
        return TEAM_DATA[lowerName].colors;
    }

    var norm = normName(teamName);
    if (NORM_TEAM_KEYS[norm]) {
        var realKey = NORM_TEAM_KEYS[norm];
        if (TEAM_DATA[realKey] && TEAM_DATA[realKey].colors) {
            return TEAM_DATA[realKey].colors;
        }
    }

    var aliasKey = TEAM_ALIASES[lowerName] || TEAM_ALIASES[norm];
    if (aliasKey && TEAM_DATA[aliasKey] && TEAM_DATA[aliasKey].colors) {
        return TEAM_DATA[aliasKey].colors;
    }

    for (var key in TEAM_DATA) {
        var normKey = normName(key);
        if (normKey.length > 0 && norm.length > 0 && (norm === normKey || norm.includes(normKey) || normKey.includes(norm))) {
            if (TEAM_DATA[key] && TEAM_DATA[key].colors) {
                return TEAM_DATA[key].colors;
            }
        }
    }

    var hash = 0;
    for (var i = 0; i < norm.length; i++) hash = norm.charCodeAt(i) + ((hash << 5) - hash);
    var hue = Math.abs(hash % 360);
    return ['hsl('+hue+', 60%, 30%)', '#ffffff'];
}

var LEAGUE_ALIASES = {
  'formula 1': 'f1',
  'formula1': 'f1',
  'f1': 'f1',
  'nba': 'nba',
  'national basketball association': 'nba',
  'nhl': 'nhl',
  'national hockey league': 'nhl',
  'ligue nationale de hockey': 'nhl',
  'nfl': 'nfl',
  'national football league': 'nfl',
  'mlb': 'mlb',
  'cfl': 'cfl',
  'canadian football league': 'cfl',
  'major league baseball': 'mlb',
  'mls': 'mls',
  'major league soccer': 'mls',
  'pl': 'premier league',
  'premier league anglaise': 'premier league',
  'epl': 'premier league',
  'champions league': 'uefa champions league',
  'ligue des champions': 'uefa champions league',
  'ldc': 'uefa champions league',
  'europa league': 'uefa europa league',
  'ligue europa': 'uefa europa league',
  'conference league': 'uefa europa conference league',
  'europa conference league': 'uefa europa conference league',
  'ligue europa conference': 'uefa europa conference league',
  'efl cup': 'league cup',
  'carabao cup': 'league cup',
  'nations league': 'uefa nations league',
  'ligue des nations': 'uefa nations league',
  'german bundesliga': 'bundesliga',
  'english premier league': 'premier league',
  'french ligue 1': 'ligue 1',
  'spanish laliga': 'la liga',
  'italian serie a': 'serie a',
  'pwhl': 'pwhl',
  'professional womens hockey league': 'pwhl',
  'lhjmq': 'lhjmq',
  'qmjhl': 'lhjmq',
  'quebec maritimes junior hockey league': 'lhjmq',
  'ligue de hockey junior maritimes quebec': 'lhjmq',
  'indycar': 'indycar',
  'indy car': 'indycar',
  'motogp': 'motogp',
  'moto gp': 'motogp',
  'wwe': 'wwe'
};
var DEFAULT_LEAGUES = {
    'CHAMPIONS LEAGUE': { icon: '⚽' },
    'NHL': { icon: '🏒' },
    'PWHL': { icon: '🏒' },
    'F1': { icon: '🏎️' },
    'NBA': { icon: '🏀' },
    'MLB': { icon: '⚾' },
    'PREMIER LEAGUE': { icon: '⚽' },
    'LIGUE 1': { icon: '⚽' },
    'NFL': { icon: '🏈' },
    'LA LIGA': { icon: '⚽' },
    'SERIE A': { icon: '⚽' },
    'BUNDESLIGA': { icon: '⚽' },
    'EUROPA LEAGUE': { icon: '⚽' },
    'CONFERENCE LEAGUE': { icon: '⚽' },
    'EREDIVISIE': { icon: '⚽' },
    'PRIMEIRA LIGA': { icon: '⚽' },
    'NATIONS LEAGUE': { icon: '⚽' },
    'FA CUP': { icon: '⚽' },
    'LEAGUE CUP': { icon: '⚽' },
    'COPA DEL REY': { icon: '⚽' },
    'DFB POKAL': { icon: '⚽' },
    'SAUDI PRO LEAGUE': { icon: '⚽' },
    'MLS': { icon: '⚽' },
    'LHJMQ': { icon: '🏒' },
    'AHL': { icon: '🏒' },
    'CFL': { icon: '🏈' },
    'INDYCAR': { icon: '🏎️' },
    'MOTOGP': { icon: '🏍️' },
    'WWE': { icon: '🥊' }
};

var LEAGUE_FORMAT_NAMES = {
    'nba': 'NBA',
    'nhl': 'NHL',
    'nfl': 'NFL',
    'mlb': 'MLB',
    'cfl': 'CFL',
    'mls': 'MLS',
    'premier league': 'Premier League',
    'la liga': 'La Liga',
    'serie a': 'Serie A',
    'bundesliga': 'Bundesliga',
    'ligue 1': 'Ligue 1',
    'uefa champions league': 'Champions League',
    'uefa europa league': 'Europa League',
    'uefa europa conference league': 'Conference League',
    'eredivisie': 'Eredivisie',
    'primeira liga': 'Primeira Liga',
    'uefa nations league': 'Nations League',
    'fa cup': 'FA Cup',
    'league cup': 'League Cup',
    'copa del rey': 'Copa del Rey',
    'dfb pokal': 'DFB Pokal',
    'saudi pro league': 'Saudi Pro League',
    'f1': 'F1',
    'pwhl': 'PWHL',
    'lhjmq': 'LHJMQ'
};
function formatLeagueName(league) {
    if (!league) return 'Autres Flux';
    var lower = league.toLowerCase().trim();
    if (LEAGUE_ALIASES[lower]) {
        lower = LEAGUE_ALIASES[lower];
    }

    var formatted = '';
    if (LEAGUE_FORMAT_NAMES[lower]) {
        formatted = LEAGUE_FORMAT_NAMES[lower];
    } else {
        formatted = lower.replace(/\b\w/g, function(l){ return l.toUpperCase(); });
    }

    // Si la ligue n'est pas dans DEFAULT_LEAGUES, on la met dans 'Autres Flux'
    // Exception pour 'Autres' (qui peut être utilisé ailleurs) et 'Autres Flux'
    if (DEFAULT_LEAGUES && formatted !== 'Autres' && formatted !== 'Autres Flux') {
        if (!DEFAULT_LEAGUES[formatted.toUpperCase()]) {
            return 'Autres Flux';
        }
    }
    return formatted;
}
var _normCache = {};

function getLogo(teamName) {
    if(!teamName) return null;
    var lowerName = teamName.toLowerCase().trim();
    if (TEAM_DATA[lowerName] && TEAM_DATA[lowerName].logo) {
        return TEAM_DATA[lowerName].logo;
    }

    var key = normName(teamName);
    if (NORM_TEAM_KEYS[key]) {
        var realKey = NORM_TEAM_KEYS[key];
        if (TEAM_DATA[realKey] && TEAM_DATA[realKey].logo) {
            return TEAM_DATA[realKey].logo;
        }
    }

    var aliasKey = TEAM_ALIASES[lowerName] || TEAM_ALIASES[key];
    if (aliasKey && TEAM_DATA[aliasKey] && TEAM_DATA[aliasKey].logo) {
        return TEAM_DATA[aliasKey].logo;
    }

    var colors = getTeamColors(teamName);
    var bg = colors[0].replace('#', '');
    if (bg.startsWith('hsl')) bg = '333333';
    var fg = colors[1].replace('#', '');
    if (fg.startsWith('hsl')) fg = 'ffffff';

    return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(teamName) + '&background=' + bg + '&color=' + fg + '&size=200&font-size=0.4';
}

var STATIC_TEAM_MAP = {};
STATIC_TEAM_MAP["abudhabigrandprix"] = "Abu Dhabi Grand Prix";
STATIC_TEAM_MAP["bahraingrandprix"] = "Bahrain Grand Prix";
STATIC_TEAM_MAP["saudiarabiangrandprix"] = "Saudi Arabian Grand Prix";
if (typeof STATIC_TEAMS !== 'undefined') {
    STATIC_TEAMS.forEach(function(t) {
        var lower = t.name.toLowerCase().trim();
        var stripped = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\b(fc|afc|sc|cf|de|sporting|cd|racing)\b/g, '').trim().replace(/[^a-z0-9]/g, '');
        if (stripped) {
            STATIC_TEAM_MAP[stripped] = t.name;
        }
    });
}
function getOfficialTeamName(n) {
    if (!n) return n;

    // For F1 Grand Prix events, remove the "F1 " prefix so it looks cleaner
    if (n.toLowerCase().startsWith('f1 ') || n.toLowerCase().includes('grand prix') || n.toLowerCase().includes('formula 1') || n.toLowerCase().includes('f1 - ')) {
        n = n.replace(/f1\s*[-–]?\s*/i, '').replace(/formula 1\s*[-–]?\s*/i, '').trim();
    }

    var lower = n.toLowerCase().trim();

    // Custom replaces for cities with common abbreviations before aliases
    lower = lower.replace(/\bny\b/g, 'new york');
    lower = lower.replace(/l\.a\./g, 'los angeles');

    if (typeof TEAM_ALIASES !== 'undefined' && TEAM_ALIASES[lower]) lower = TEAM_ALIASES[lower];

    var stripped = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    stripped = stripped.replace(/\b(fc|afc|sc|cf|de|sporting|cd|racing)\b/g, '').trim();
    stripped = stripped.replace(/[^a-z0-9]/g, '');

    if (typeof STATIC_TEAM_MAP !== 'undefined' && STATIC_TEAM_MAP[stripped]) {
        return STATIC_TEAM_MAP[stripped];
    }

    // Fuzzy matching against STATIC_TEAM_MAP keys
    if (typeof STATIC_TEAM_MAP !== 'undefined' && typeof isMatch === 'function' && typeof stringSimilarity === 'function') {
        var bestMatch = null;
        var bestSim = 0;

        for (var key in STATIC_TEAM_MAP) {
            if (isMatch(stripped, key)) {
                var sim = stringSimilarity(stripped, key);
                // If one contains the other, artificially boost similarity so it picks the best substring match
                if (key.includes(stripped) || stripped.includes(key)) {
                    sim += 0.5;
                }
                if (sim > bestSim) {
                    bestSim = sim;
                    bestMatch = STATIC_TEAM_MAP[key];
                }
            }
        }

        if (bestMatch) return bestMatch;
    }

    return n;
}
function normName(n) {
  if (!n) return '';
  var cached = _normCache[n];
  if (cached) return cached;

  var lower = n.toLowerCase().trim();

  // Custom replaces for cities with common abbreviations before aliases
  // Using very specific replacements to avoid breaking 'la liga' or 'deportivo la coruna'
  lower = lower.replace(/\bny\b/g, 'new york');
  lower = lower.replace(/l\.a\./g, 'los angeles');
  lower = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Apply aliases before stripping characters
  if (TEAM_ALIASES[lower]) {
      lower = TEAM_ALIASES[lower];
  } else if (LEAGUE_ALIASES[lower]) {
      lower = LEAGUE_ALIASES[lower];
  }

  // Basic fallback replacements (e.g. fc, afc, sc, cf)
  var stripped = lower.replace(/\b(fc|afc|sc|cf|de|cd|club)\b/gi, '').trim();
  if (stripped.length > 0) {
      lower = stripped;
  }

  var norm = lower.replace(/[^a-z0-9]/g, '');
  _normCache[n] = norm;
  return norm;
}
window.LGC = LGC;
window.FLAGS = FLAGS;
window.lgColor = lgColor;
window.lgFlag = lgFlag;
window.TEAM_COLORS = TEAM_COLORS;
window.STATIC_TEAMS = STATIC_TEAMS;
window.getTeamColors = getTeamColors;
window.TEAM_ALIASES = TEAM_ALIASES;
window.LEAGUE_ALIASES = LEAGUE_ALIASES;
window.LEAGUE_FORMAT_NAMES = LEAGUE_FORMAT_NAMES;
window.DEFAULT_LEAGUES = DEFAULT_LEAGUES;
window.formatLeagueName = formatLeagueName;
window._normCache = _normCache;
window.getLogo = getLogo;
window.STATIC_TEAM_MAP = STATIC_TEAM_MAP;
window.getOfficialTeamName = getOfficialTeamName;
window.normName = normName;

for (var key in TEAM_DATA) {
    NORM_TEAM_KEYS[normName(key)] = key;
}
window.NORM_TEAM_KEYS = NORM_TEAM_KEYS;




/* ══ MATCH MERGING LOGIC ══════════════ */
function mergeMatches(mainList, newList) {
  newList.forEach(function(nm) {
    var merged = false;

    for (var i = 0; i < mainList.length; i++) {
      var mm = mainList[i];

      if (isMatchPair(mm, nm)) {
        // It's the same match. Merge streams.
        mm.streamLinks = mm.streamLinks || [];
        nm.streamLinks = nm.streamLinks || [];

        nm.streamLinks.forEach(function(sl) {
          // Avoid exact duplicates
          if(!mm.streamLinks.find(function(existing) { return existing.url === sl.url; })) {
            mm.streamLinks.push(sl);
          }
        });

        // Update logos if the new source has them and we don't
        if(!mm.homeLogo && nm.homeLogo && nm.homeLogo.indexOf('default') === -1) {
            mm.homeLogo = nm.homeLogo;
        }
        if(!mm.awayLogo && nm.awayLogo && nm.awayLogo.indexOf('default') === -1) {
            mm.awayLogo = nm.awayLogo;
        }

        // Status resolution: if one says live and other says upcoming, prioritize live
        if(nm.status === 'live' && mm.status !== 'live') mm.status = 'live';
        if(nm.status === 'finished' && mm.status !== 'finished') mm.status = 'finished';

        // If API doesn't have time but source does
        if(mm.startTime === '00:00' && nm.startTime && nm.startTime !== '00:00') mm.startTime = nm.startTime;

        merged = true;
        break;
      }
    }

    if (!merged) {
      // If no match found, we add it as a new match to the list
      // Generate a new ID based on the array length to avoid conflicts
      nm.id = mainList.length;
      mainList.push(nm);
    }
  });

  return mainList;
}

/* ══ SIMILARITY ALGORITHM ════════════ */
function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  var matrix = [];
  for (var i = 0; i <= b.length; i++) { matrix[i] = [i]; }
  for (var j = 0; j <= a.length; j++) { matrix[0][j] = j; }
  for (var i = 1; i <= b.length; i++) {
    for (var j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
      }
    }
  }
  return matrix[b.length][a.length];
}

function stringSimilarity(s1, s2) {
  if (s1 === s2) return 1.0;
  var maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  var dist = levenshtein(s1, s2);
  return (maxLen - dist) / maxLen;
}


function getTeamInfo(name) {
    if (!name) return { city: '', teamName: '' };
    var n = normName(name);
    var key = NORM_TEAM_KEYS[n];
    if (key && TEAM_DATA[key]) {
        return { city: TEAM_DATA[key].city || '', teamName: TEAM_DATA[key].teamName || '' };
    }
    var lowerName = name.toLowerCase().trim();
    if (TEAM_DATA[lowerName]) {
        return { city: TEAM_DATA[lowerName].city || '', teamName: TEAM_DATA[lowerName].teamName || '' };
    }
    return { city: name, teamName: name };
}

function isMatchContext(name1, name2, contextText) {
    if (isMatch(name1, name2)) return true;
    return false;
}

function isMatchPair(m1, m2) {
  return debugMatchPair(m1, m2).isMatch;
}

function debugMatchPair(m1, m2) {
  if (!m1 || !m2) return { isMatch: false, reason: "m1 ou m2 manquant" };

  // League strict check if both have leagues defined and aren't generic
  var l1 = (m1.league || '').toLowerCase();
  var l2 = (m2.league || '').toLowerCase();

  // Some basic sport/league exclusions (only exclude if we are absolutely sure they mismatch)
  if (l1 && l2 && l1 !== l2) {
      var is1Hockey = l1.includes('nhl') || l1.includes('hockey') || l1.includes('pwhl') || l1.includes('lhjmq');
      var is2Hockey = l2.includes('nhl') || l2.includes('hockey') || l2.includes('pwhl') || l2.includes('lhjmq');
      var is1Bball = l1.includes('nba') || l1.includes('basketball');
      var is2Bball = l2.includes('nba') || l2.includes('basketball');
      var is1Base = l1.includes('mlb') || l1.includes('baseball');
      var is2Base = l2.includes('mlb') || l2.includes('baseball');
      var is1Football = l1.includes('nfl') || l1.includes('american');
      var is2Football = l2.includes('nfl') || l2.includes('american');

      if ((is1Hockey && (is2Bball || is2Base || is2Football)) ||
          (is1Bball && (is2Hockey || is2Base || is2Football)) ||
          (is1Base && (is2Hockey || is2Bball || is2Football)) ||
          (is1Football && (is2Hockey || is2Bball || is2Base))) {
          return { isMatch: false, reason: "Incompatibilité de sport/ligue (ex: hockey vs basketball)" };
      }
  }

  var m1H = normName(m1.homeTeam);
  var m1A = normName(m1.awayTeam);
  var m2H = normName(m2.homeTeam);
  var m2A = normName(m2.awayTeam);

  // Check explicitly for different dates before ANY matching
  if (m1.matchDate && m2.matchDate && m1.matchDate !== m2.matchDate) {
      return { isMatch: false, reason: "Dates différentes (" + m1.matchDate + " vs " + m2.matchDate + ")" };
  }

  // Check for TBD or missing teams (some scrapers only provide one team from URL)
  var is1HomeTbd = m1.homeTeam === 'TBD' || m1.homeTeam === 'tbd' || m1H === '';
  var is1AwayTbd = m1.awayTeam === 'TBD' || m1.awayTeam === 'tbd' || m1A === '';
  var is2HomeTbd = m2.homeTeam === 'TBD' || m2.homeTeam === 'tbd' || m2H === '';
  var is2AwayTbd = m2.awayTeam === 'TBD' || m2.awayTeam === 'tbd' || m2A === '';

  if (is1AwayTbd || is2AwayTbd || is1HomeTbd || is2HomeTbd) {
      if ((is1AwayTbd || is2AwayTbd) && isMatch(m1H, m2H)) return { isMatch: true, reason: "Match (TBD)" };
      if ((is1AwayTbd || is2AwayTbd) && isMatch(m1H, m2A)) return { isMatch: true, reason: "Match inversé (TBD)" };
      if ((is1HomeTbd || is2HomeTbd) && isMatch(m1A, m2A)) return { isMatch: true, reason: "Match (TBD)" };
      if ((is1HomeTbd || is2HomeTbd) && isMatch(m1A, m2H)) return { isMatch: true, reason: "Match inversé (TBD)" };
      return { isMatch: false, reason: "Équipe manquante ou TBD sans correspondance" };
  }

  var m2RawH = (m2.homeTeam || '').toLowerCase().trim();
  var m2RawA = (m2.awayTeam || '').toLowerCase().trim();
  var k1H = NORM_TEAM_KEYS[m1H];
  var k1A = NORM_TEAM_KEYS[m1A];

  var hMatches = isMatch(m1H, m2H);
  if (!hMatches && k1H && TEAM_DATA[k1H] && TEAM_DATA[k1H].aliases && TEAM_DATA[k1H].aliases.includes(m2RawH)) hMatches = true;

  var aMatches = isMatch(m1A, m2A);
  if (!aMatches && k1A && TEAM_DATA[k1A] && TEAM_DATA[k1A].aliases && TEAM_DATA[k1A].aliases.includes(m2RawA)) aMatches = true;

  // Standard direct match
  if (hMatches && aMatches) {
      return { isMatch: true, reason: "Correspondance directe" };
  }

  // Reversed match (away vs home)
  if (isMatch(m1H, m2A) && isMatch(m1A, m2H)) {
      return { isMatch: true, reason: "Correspondance inversée" };
  }

  // Advanced Cross-Validation Match
  // Create combined strings for both matches
  var combined1 = m1H + " " + m1A;
  var combined2 = m2H + " " + m2A;

  // We check if the smaller combo is essentially contained in the larger combo
  // by comparing words or high substring overlap.
  var shorterCombo = combined1.length < combined2.length ? combined1 : combined2;
  var longerCombo = combined1.length < combined2.length ? combined2 : combined1;

  // Let's break the original shorter names (from the object, not normalized) into words
  var rawShortH = m1.homeTeam.length + m1.awayTeam.length < m2.homeTeam.length + m2.awayTeam.length ? m1.homeTeam : m2.homeTeam;
  var rawShortA = m1.homeTeam.length + m1.awayTeam.length < m2.homeTeam.length + m2.awayTeam.length ? m1.awayTeam : m2.awayTeam;

  // Use normName on parts to match how the longer string is built
  var shortWordsRaw = (rawShortH + " " + rawShortA).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
  var uniqueRawWords = Array.from(new Set(shortWordsRaw.filter(w => w.length >= 3)));

  if (uniqueRawWords.length === 0) return { isMatch: false, reason: "Aucun mot clé significatif pour la validation croisée" };

  var matchedWords = 0;
  for (var i = 0; i < uniqueRawWords.length; i++) {
      var rawWord = uniqueRawWords[i];
      var normWord = normName(rawWord);

      var wordsToTest = [rawWord];
      if (normWord.length >= 3 && normWord !== rawWord) {
          wordsToTest.push(normWord);
      }

      var wordMatched = false;

      for (var t = 0; t < wordsToTest.length; t++) {
          var word = wordsToTest[t];
          if (longerCombo.includes(word)) {
              wordMatched = true;
              break;
          } else {
              // Last resort sliding window for this word on the entire longer combo
              var maxW = Math.min(longerCombo.length, word.length + 2);
              var minW = Math.max(1, word.length - 2);
              var bestSubSim = 0;
              for (var w = minW; w <= maxW; w++) {
                  for (var k = 0; k <= longerCombo.length - w; k++) {
                      var sub = longerCombo.substring(k, k + w);
                      var subSim = stringSimilarity(sub, word);
                      if (subSim > bestSubSim) bestSubSim = subSim;
                  }
              }
              if (bestSubSim > 0.80) {
                  wordMatched = true;
                  break;
              }
          }
      }

      if (wordMatched) {
          matchedWords++;
      }
  }

  // If a significant portion of words match, consider it the same matchup
  // (e.g. if we have "tigers" and "rangers", that's 2 words. If both match, it's 100%)
  if (matchedWords >= uniqueRawWords.length * 0.75 && matchedWords >= 2) {
      // Prevent cross-validation from grouping known distinct pairs
      // We block the direct match interpretation if any of its aligned pairs are explicitly distinct.
      var blockedDirect = isKnownDistinct(m1H, m2H) || isKnownDistinct(m1A, m2A);
      // We block the reversed match interpretation if any of its aligned pairs are explicitly distinct.
      var blockedReversed = isKnownDistinct(m1H, m2A) || isKnownDistinct(m1A, m2H);

      // If the direct interpretation is blocked, and it doesn't match reversed, reject.
      if (blockedDirect && !isMatch(m1H, m2A) && !isMatch(m1A, m2H)) {
          return { isMatch: false, reason: "Bloqué par distinction explicite (Direct)" };
      }
      // If the reversed interpretation is blocked, and it doesn't match direct, reject.
      if (blockedReversed && !isMatch(m1H, m2H) && !isMatch(m1A, m2A)) {
          return { isMatch: false, reason: "Bloqué par distinction explicite (Inversé)" };
      }
      return { isMatch: true, reason: "Validation croisée (" + matchedWords + "/" + uniqueRawWords.length + " mots)" };
  }

  // Final permissive fallback: pure substring overlap for extreme abbreviations (e.g. 'Rangers' vs 'Texas Rangers')
  if (m1H && m1A && m2H && m2A) {
      var hMatch = m1H.includes(m2H) || m2H.includes(m1H);
      var aMatch = m1A.includes(m2A) || m2A.includes(m1A);
      if (hMatch && aMatch) return { isMatch: true, reason: "Sous-chaîne extrême (Direct)" };

      // Check reversed teams with subset matching
      var crossHMatch = m1H.includes(m2A) || m2A.includes(m1H);
      var crossAMatch = m1A.includes(m2H) || m2H.includes(m1A);
      if (crossHMatch && crossAMatch) return { isMatch: true, reason: "Sous-chaîne extrême (Inversé)" };
  }

  // Prevent specific city-only mismatches in the fallback
  if (m1H && m1A && m2H && m2A) {
      if ((m1H.includes('manchester') && m2H.includes('manchester') && !isMatch(m1H, m2H)) ||
          (m1A.includes('manchester') && m2A.includes('manchester') && !isMatch(m1A, m2A))) {
          return { isMatch: false, reason: "Rejeté: équipes distinctes de même ville (ex: Manchester)" };
      }
  }

  // Cross-check dates and exact matches (already handled by early return, so we can just return true here)
  if (m1H === m2H && m1A === m2A) return { isMatch: true, reason: "Match exact (fallback final)" };

  return { isMatch: false, reason: "Score de similarité insuffisant (Mots trouvés: " + matchedWords + "/" + uniqueRawWords.length + ")" };
}

function isKnownDistinct(name1, name2) {
    if (!name1 || !name2) return false;
    var name1NoSpace = name1.replace(/\s+/g, '').toLowerCase();
    var name2NoSpace = name2.replace(/\s+/g, '').toLowerCase();
    var knownDistinctPairs = [
        ['manchestercity', 'manchesterunited'],
        ['milan', 'intermilan'],
        ['acmilan', 'intermilan'],
        ['realmadrid', 'atleticomadrid'],
        ['montrealcanadiens', 'cfmontreal'],
        ['montrealcanadiens', 'montrealalouettes'],
        ['montrealcanadiens', 'montrealvictoire'],
        ['cfmontreal', 'montrealalouettes'],
        ['cfmontreal', 'montrealvictoire'],
        ['montrealalouettes', 'montrealvictoire']
    ];
    for (var i = 0; i < knownDistinctPairs.length; i++) {
        var pair = knownDistinctPairs[i];
        if ((name1NoSpace.includes(pair[0]) && name2NoSpace.includes(pair[1])) ||
            (name1NoSpace.includes(pair[1]) && name2NoSpace.includes(pair[0]))) {
            return true;
        }
    }
    return false;
}

function isMatch(name1, name2) {
  if (!name1 || !name2) return false;
  if (name1 === name2) return true;

  // Clean empty strings might happen after normName replacements
  if (name1.length < 3 || name2.length < 3) return name1 === name2;

  // If they share a common city prefix/suffix but are distinct teams, do not match.
  // For example: 'manchestercity' and 'manchesterunited'
  if (isKnownDistinct(name1, name2)) return false;

  // Check if one contains the other (e.g. 'manchester' in 'manchesterunited')
  if (name1.includes(name2) || name2.includes(name1)) return true;

  // Check if they match by city or team name using TEAM_DATA
  var info1 = getTeamInfo(name1);
  var info2 = getTeamInfo(name2);

  var norm1C = normName(info1.city);
  var norm2C = normName(info2.city);
  var norm1N = normName(info1.teamName);
  var norm2N = normName(info2.teamName);

  // If one name is just the city of the other
  if (norm1C && norm2C && norm1C === norm2C) {
      // If one team doesn't have a distinct name (i.e. name == city) or they both have the same name
      if (norm1N === norm1C || norm2N === norm2C || norm1N === norm2N || norm1N.includes(norm2N) || norm2N.includes(norm1N)) {
          return true;
      }
  }

  // If one name is just the team name of the other
  if (norm1N && norm2N && norm1N === norm2N && norm1N.length > 3) {
      if (norm1C === norm1N || norm2C === norm2N || norm1C === norm2C || norm1C.includes(norm2C) || norm2C.includes(norm1C)) {
          return true;
      }
  }

  // Cross check if one name provided is the city of the other, or teamName of the other
  var n1 = normName(name1);
  var n2 = normName(name2);
  if (n1 && n2) {
      if (n1 === norm2C && n1.length >= 3 && norm2N === norm2C) return true; // name2 has no distinct teamName
      if (n2 === norm1C && n2.length >= 3 && norm1N === norm1C) return true;

      // If n1 is the teamName of n2
      if (n1 === norm2N && n1.length >= 3) return true;
      if (n2 === norm1N && n2.length >= 3) return true;

      if (n1 === norm2C && n1.length >= 3) return true;
      if (n2 === norm1C && n2.length >= 3) return true;
  }
  var sim = stringSimilarity(name1, name2);

  // Specific fallback for short names
  if (name1.length <= 4 || name2.length <= 4) {
      if (sim > 0.8) return true;
  } else {
      if (sim > 0.75) return true; // increased threshold from 0.65
  }

  // If one name is significantly longer but contains a typo-version of the shorter one
  // Handled by sliding window below...

  // Sliding window substring similarity
  // This allows catching scraped names like "tampa" within "tampabaylightning" even with typos (e.g., "tanpa")
  var shorter = name1.length < name2.length ? name1 : name2;
  var longer = name1.length < name2.length ? name2 : name1;

  if (longer.length > shorter.length) {
      // Window size accounts for possible missing or extra characters
      var maxWindow = Math.min(longer.length, shorter.length + 2);
      var minWindow = Math.max(1, shorter.length - 2);

      var bestSubSim = 0;
      for (var w = minWindow; w <= maxWindow; w++) {
          for (var i = 0; i <= longer.length - w; i++) {
              var sub = longer.substring(i, i + w);
              var subSim = stringSimilarity(sub, shorter);
              if (subSim > bestSubSim) bestSubSim = subSim;
          }
      }

      // Since isMatch is usually called for BOTH home and away teams concurrently,
      // a loose match (70% on a substring) is very safe here.
      if (bestSubSim > 0.70) {
          return true;
      }
  }

  return false;
}



// Global bindings for HTML compatibility
// window.mergeMatches = mergeMatches;
// window.levenshtein = levenshtein;
// window.stringSimilarity = stringSimilarity;
// window.isMatchPair = isMatchPair;
// window.debugMatchPair = debugMatchPair;
// window.isMatch = isMatch;
// window.isKnownDistinct = isKnownDistinct;

// window.getTeamInfo = getTeamInfo;


function fetchPage() { return Promise.resolve("<table><tbody><tr><td>PWHL</td></tr><tr class=\"game\"><td>19:00</td><td>Montréal Victoire - Ottawa Charge<div class=\"gamelinks\"><a href=\"/link1\">Link 1</a></div></td></tr></tbody></table>"); }
function getEstDateStrFromDate() { return "today"; }
var TARGET_DATE = new Date();
var ONHOCKEY_URL = "https://onhockey.tv/schedule_table.php";
function lg() {}
function getLeagueDuration() { return 120; }
var SITE = "https://army.footybite.to";
var SPORTSURGE_URL = "test";
var VIPLEAGUE_URL = "test";
var BUFFSTREAMS_URL = "test";
var STREAMEAST_URL = "test";
function resolveUrl(url, base) { return url; }
function addScrapeLog() {}
function safeStorageGetJSON() { return {}; }
function safeStorageSetJSON() {}
class DOMParser {
  parseFromString(html, type) {
    const { JSDOM } = require("jsdom");
    const dom = new JSDOM(html);
    return dom.window.document;
  }
}
global.DOMParser = DOMParser;
var document = { createElement: function() { return { setAttribute: function() {} }; }, querySelectorAll: function() { return []; }, getElementById: function() { return null; } };

var orig_updateMatchUiAfterScrape = null;
function updateMatchUiAfterScrape_hook(m) {
    if (m.streamLinks.length === 0) { throw new Error("Stream links empty"); }
}









/* ══ PARSE STREAMEAST ════════════════ */
function parseStreameast(html){
  var matches=[];
  var doc = new DOMParser().parseFromString(html, 'text/html');
  var cards = doc.querySelectorAll('.match-card');

  if (cards.length > 0) {
      [].forEach.call(cards, function(card, index) {
          var home = card.getAttribute('data-team1');
          var away = card.getAttribute('data-team2');
          var category = card.getAttribute('data-league') || 'Sports';
          var timeStr = card.getAttribute('data-time2'); // format "ET 08:50 PM"
          var playerLink = card.getAttribute('data-player');
          var logo1 = card.getAttribute('data-logo1');
          var logo2 = card.getAttribute('data-logo2');

          if(!home || !away || !playerLink) return;

          var startTime = '00:00';
          if(timeStr) {
              // Convert "ET 08:50 PM" to "HH:MM"
              var matchTime = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
              if(matchTime) {
                  var h = parseInt(matchTime[1], 10);
                  var m = matchTime[2];
                  var ampm = matchTime[3] ? matchTime[3].toUpperCase() : '';

                  if(ampm === 'PM' && h < 12) h += 12;
                  if(ampm === 'AM' && h === 12) h = 0;

                  // It's ET time, we keep it as is (or convert based on logic if needed, but our standard seems to accept local/ET depending on source)
                  startTime = pad(h) + ':' + pad(m);
              }
          }

          var streamLinks = [{
              name: 'Streameast - Flux',
              quality: 'HD',
              lang: 'MULTI',
              url: playerLink,
              icon: '📺'
          }];

          var l = category.toLowerCase().replace(/-/g, ' ');

          matches.push({
              id: 'se_' + index,
              league: formatLeagueName(l),
              flag: lgFlag(l),
              color: lgColor(l),
              homeTeam: getOfficialTeamName(home),
              awayTeam: getOfficialTeamName(away),
              homeLogo: logo1,
              awayLogo: logo2,
              startTime: startTime,
              durationMinutes: getLeagueDuration(l),
              status: 'upcoming', // Streameast doesn't give clear live status in the data attrs directly, rely on API fallback or default to upcoming
              streamLinks: streamLinks,
              streamsLoaded: false,
              matchUrl: playerLink || STREAMEAST_URL,
              source: 'streameast'
          });
      });
  } else {
      // Fallback
      var possibleMatches = doc.querySelectorAll('li, .match-row, a[href*="/player/"], a[href*="/live/"]');
      var added = {};
      [].forEach.call(possibleMatches, function(el, index) {
          var text = el.textContent.replace(/\s+/g, ' ').trim();
          var link = el.tagName.toLowerCase() === 'a' ? el : el.querySelector('a');
          if (link && text) {
              var href = link.getAttribute('href');
              if (!href || added[href]) return;

              var textToParse = (link.textContent || text).trim();
              var teams = textToParse.split(/ vs | v | - /i);
              if (teams.length >= 2 && textToParse.length < 80) {
                  var home = teams[0].trim();
                  var away = teams.slice(1).join(' - ').trim();

                  var startTimeStr = '00:00';
                  var matchTime = text.match(/(\d{1,2}):(\d{2})/);
                  if (matchTime) {
                      startTimeStr = pad(parseInt(matchTime[1], 10)) + ':' + matchTime[2];
                  }

                  var streamUrl = href;
                  if (!streamUrl.startsWith('http')) {
                      streamUrl = (STREAMEAST_URL.endsWith('/') ? STREAMEAST_URL.slice(0, -1) : STREAMEAST_URL) + (streamUrl.startsWith('/') ? streamUrl : '/' + streamUrl);
                  }

                  matches.push({
                      id: 'se_fb_' + index,
                      league: formatLeagueName('Sports'),
                      flag: lgFlag('Sports'),
                      color: lgColor('Sports'),
                      homeTeam: getOfficialTeamName(home),
                      awayTeam: getOfficialTeamName(away),
                      startTime: startTimeStr,
                      durationMinutes: getLeagueDuration('Sports'),
                      status: 'upcoming',
                      streamLinks: [{
                          name: 'Streameast - Flux',
                          quality: 'HD',
                          lang: 'MULTI',
                          url: streamUrl,
                          icon: '📺'
                      }],
                      streamsLoaded: false,
                      matchUrl: streamUrl,
                      source: 'streameast'
                  });
                  added[href] = true;
              } else if (textToParse.length > 3 && textToParse.length < 40) {
                  var streamUrl2 = href;
                  if (!streamUrl2.startsWith('http')) streamUrl2 = (STREAMEAST_URL.endsWith('/') ? STREAMEAST_URL.slice(0, -1) : STREAMEAST_URL) + (streamUrl2.startsWith('/') ? streamUrl2 : '/' + streamUrl2);
                  matches.push({
                      id: 'se_fb_' + index,
                      league: formatLeagueName('Sports'),
                      flag: lgFlag('Sports'),
                      color: lgColor('Sports'),
                      homeTeam: getOfficialTeamName(textToParse),
                      awayTeam: 'TBD',
                      startTime: '00:00',
                      durationMinutes: getLeagueDuration('Sports'),
                      status: 'upcoming',
                      streamLinks: [{ name: 'Streameast - Flux', quality: 'HD', lang: 'MULTI', url: streamUrl2, icon: '📺' }],
                      streamsLoaded: false,
                      matchUrl: streamUrl2,
                      source: 'streameast'
                  });
                  added[href] = true;
              }
          }
      });
  }

  lg('Streameast extraits', matches.length);
  return matches;
}


/* ══ PARSE ONHOCKEY ═══════════════════ */

/* ══ PARSE SPORTSURGE ═════════════════ */
function parsePWHLSchedule(html) {
  var matches = [];
  try {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var scripts = doc.querySelectorAll('script');
      for (var i = 0; i < scripts.length; i++) {
          var txt = scripts[i].textContent || '';
          if (txt.indexOf('games') !== -1) {
              var start = txt.indexOf('{');
              var end = txt.lastIndexOf('}');
              if (start !== -1 && end !== -1) {
                  var jsonStr = txt.substring(start, end + 1);
                  var data = JSON.parse(jsonStr);

                  var found = false;
                  var findSchedule = function(obj) {
                      if (!obj || typeof obj !== 'object') return;
                      if (obj.games && Array.isArray(obj.games) && obj.games.length > 0 && obj.games[0].home_team) {
                          obj.games.forEach(function(g) {
                              if (!g.home_team || !g.visiting_team) return;

                              var home = getOfficialTeamName(g.home_team.home_team_name);
                              var away = getOfficialTeamName(g.visiting_team.visiting_team_name);

                              var isLive = false;
                              var status = g.game_status ? g.game_status.toLowerCase() : '';
                              var isFinished = status.indexOf('final') >= 0;
                              if (status.indexOf('in progress') >= 0 || status === 'live' || status.indexOf('period') >= 0 || status.indexOf('intermission') >= 0) {
                                  isLive = true;
                              }

                              var homeScore = g.home_team.home_goal_count;
                              var awayScore = g.visiting_team.visiting_goal_count;

                              var timeStr = '';
                              if (g.date_played) {
                                  var d = new Date(g.date_played);
                                  timeStr = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
                              }

                              var homeLogo = g.home_team.home_team_logo && g.home_team.home_team_logo.length > 0 ? g.home_team.home_team_logo[0].secure_url : null;
                              var awayLogo = g.visiting_team.visiting_team_logo && g.visiting_team.visiting_team_logo.length > 0 ? g.visiting_team.visiting_team_logo[0].secure_url : null;

                              var m = {
                                  id: 'pwhl_' + g.game_id,
                                  homeTeam: home,
                                  awayTeam: away,
                                  homeLogo: homeLogo,
                                  awayLogo: awayLogo,
                                  sport: 'hockey',
                                  league: 'PWHL',
                                  time: isLive ? "LIVE" : timeStr,
                                  date: g.date_played,
                                  isFinished: isFinished,
                                  streamLinks: []
                              };

                              if (homeScore !== undefined && awayScore !== undefined) {
                                  m.homeScore = homeScore.toString();
                                  m.awayScore = awayScore.toString();
                              }

                              matches.push(m);
                          });
                          found = true;
                          return;
                      }
                      for (var key in obj) {
                          if (found) break;
                          findSchedule(obj[key]);
                      }
                  };

                  findSchedule(data);
                  if (found) break;
              }
          }
      }
  } catch(e) { lg('Error parsing PWHL schedule', e); }
  return matches;
}

function parseSportsurge(html) {
  var matches = [];
  try {
      var doc = new DOMParser().parseFromString(html, 'text/html');

      // Sportsurge v2 uses .MatchListItem or similar, but often it's rendered.
      // Sometimes it has direct <a> links.
      var matchLinks = doc.querySelectorAll('a[href*="/live/"], .MatchListItem a, a.match-link');

      [].forEach.call(matchLinks, function(a) {
          var titleEl = a.querySelector('.MatchTitle') || a;
          var titleText = titleEl.textContent.trim();
          var url = a.getAttribute('href');

          if(titleText && url) {
              var home = titleText;
              var away = 'TBD';
              if(titleText.includes(' vs ')) {
                 var pts = titleText.split(' vs ');
                 home = pts[0].trim();
                 away = pts[1].trim();
              } else if (titleText.includes('-')) {
                 var pts = titleText.split('-');
                 home = pts[0].trim();
                 away = pts[1].trim();
              }

              var m = {
                  id: 'surge_' + Math.random().toString(36).substr(2, 9),
                  homeTeam: getOfficialTeamName(home),
                  awayTeam: getOfficialTeamName(away),
                  league: 'Sports',
                  flag: lgFlag('Sports'),
                  color: lgColor('Sports'),
                  startTime: '00:00',
                  status: 'upcoming',
                  matchUrl: url.indexOf('http') === 0 ? url : ((SPORTSURGE_URL.endsWith('/') ? SPORTSURGE_URL.slice(0, -1) : SPORTSURGE_URL) + (url.startsWith('/') ? url : '/' + url)),
                  streamLinks: [],
                  streamsLoaded: false,
                  source: 'sportsurge'
              };
              if (!matches.find(ex => ex.matchUrl === m.matchUrl)) {
                  matches.push(m);
              }
          }
      });
  } catch(e) {}
  lg('Sportsurge extraits', matches.length);
  return matches;
}

function parseOnHockey(html) {
  var doc = new DOMParser().parseFromString(html, 'text/html');
  var matches = [];

  // onhockey.tv groups matches by league inside <tbody> elements in schedule_table.php
  var tbodies = doc.querySelectorAll('tbody');
  var matchIndex = 0;

  if (tbodies.length > 0) {
      for (var i = 0; i < tbodies.length; i++) {
          var tbody = tbodies[i];

          // onhockey structure: first tr in tbody usually contains the league name
          var firstTr = tbody.querySelector('tr');
          var leagueName = 'Hockey';
          if (firstTr && firstTr.textContent.trim() !== '') {
              leagueName = firstTr.textContent.replace(/standings|draw/gi, '').trim();
          }

          var textContent = tbody.textContent || '';
          var upText = textContent.toUpperCase();

          if (upText.indexOf('PWHL') >= 0) leagueName = 'PWHL';
          else if (upText.indexOf('LHJMQ') >= 0 || upText.indexOf('QMJHL') >= 0) leagueName = 'LHJMQ';

          var rows = tbody.querySelectorAll('tr.game');
          for (var r = 0; r < rows.length; r++) {
              var row = rows[r];
                  var tds = row.querySelectorAll('td');
                  if (tds.length >= 2) {
                      // The team names are usually in the second td.
                      // We clone it and remove .gamelinks to just get the text.
                      var tdClone = tds[1].cloneNode(true);
                      var gamelinksNode = tdClone.querySelector('.gamelinks');
                      if (gamelinksNode) gamelinksNode.remove();

                      // Remove extraneous geo-blocked messages or 'live stream will be available' messages
                      var matchText = tdClone.textContent.replace(/geo-blocked for[A-Z\/]+:[a-z\s]+|live stream will be available closer to the game time/gi, '').trim();

                      var teams = matchText.split(/ vs | v | - /i);
                      var home = 'Team 1';
                      var away = 'Team 2';

                      if (teams.length >= 2) {
                          home = teams[0].trim();
                          away = teams.slice(1).join(' - ').trim();
                      } else {
                          home = matchText.trim() || 'TBA';
                          away = 'TBA';
                      }

                      // Find all the stream links for this match
                      var streamLinksArr = [];
                      var linksContainer = row.querySelector('.gamelinks') || row; // fallback to entire row if .gamelinks is missing
                      if (linksContainer) {
                          var links = linksContainer.querySelectorAll('a');
                          for (var l = 0; l < links.length; l++) {
                              var linkEl = links[l];
                              var href = linkEl.getAttribute('href');
                              if (!href) continue;

                              var streamUrl = href;
                              if (streamUrl.indexOf('//') === 0) {
                                  streamUrl = 'https:' + streamUrl;
                              } else if (streamUrl.indexOf('http') !== 0) {
                                  streamUrl = 'https://onhockey.tv' + (streamUrl.charAt(0) === '/' ? '' : '/') + streamUrl;
                              }

                              streamLinksArr.push({
                                  name: 'OnHockey ' + (linkEl.title || linkEl.textContent || 'Flux').trim(),
                                  url: streamUrl,
                                  quality: 'HD',
                                  lang: 'MULTI',
                                  icon: '🏒'
                              });
                          }
                      }

                      // Try to extract start time if available
                      var startTimeStr = '00:00';
                      var hourEl = row.querySelector('.game_hour') || tds[0];
                      if (hourEl) {
                           var timeText = hourEl.textContent.trim();
                           var timeParts = timeText.match(/(\d+):(\d+)/);
                           if (timeParts) {
                               startTimeStr = timeParts[1].padStart(2, '0') + ':' + timeParts[2];
                           }
                      }

                      matches.push({
                          id: 'onhockey_' + Date.now() + '_' + matchIndex++,
                          league: formatLeagueName(leagueName),
                          homeTeam: getOfficialTeamName(home),
                          awayTeam: getOfficialTeamName(away),
                          startTime: startTimeStr,
                          durationMinutes: getLeagueDuration('hockey'),
                          status: 'upcoming',
                          streamLinks: streamLinksArr,
                          streamsLoaded: streamLinksArr.length > 0,
                          matchUrl: ONHOCKEY_URL,
                          source: 'onhockey',
                          matchDate: getEstDateStrFromDate(TARGET_DATE)
                      });
                  }
              }
      }
  } else {
      // Fallback: If tbodies are not found, look for general list items or div blocks containing links
      var lists = doc.querySelectorAll('li, .match-row, .event');
      for (var i = 0; i < lists.length; i++) {
          var item = lists[i];
          var links = item.querySelectorAll('a');
          if (links.length > 0) {
              var text = item.textContent.replace(/\s+/g, ' ').trim();

              var teams = text.split(/ vs | v | - /i);
              var home = 'Team 1';
              var away = 'Team 2';
              if (teams.length >= 2) {
                  home = teams[0].trim();
                  away = teams.slice(1).join(' - ').trim();
              } else {
                  home = text.trim();
              }

              var streamLinksArr = [];
              for (var l = 0; l < links.length; l++) {
                  var linkEl = links[l];
                  var href = linkEl.getAttribute('href');
                  if (!href) continue;

                  var streamUrl = href;
                  if (streamUrl.indexOf('//') === 0) {
                      streamUrl = 'https:' + streamUrl;
                  } else if (streamUrl.indexOf('http') !== 0) {
                      streamUrl = 'https://onhockey.tv' + (streamUrl.charAt(0) === '/' ? '' : '/') + streamUrl;
                  }

                  streamLinksArr.push({
                      name: 'OnHockey ' + (linkEl.title || linkEl.textContent || 'Flux').trim(),
                      url: streamUrl,
                      quality: 'HD',
                      lang: 'MULTI',
                      icon: '🏒'
                  });
              }

              var startTimeStr = '00:00';
              var timeParts = text.match(/(\d+):(\d+)/);
              if (timeParts) {
                   startTimeStr = timeParts[1].padStart(2, '0') + ':' + timeParts[2];
              }

              var leagueName = 'Hockey';
              if (text.toUpperCase().indexOf('PWHL') >= 0) leagueName = 'PWHL';
              else if (text.toUpperCase().indexOf('LHJMQ') >= 0 || text.toUpperCase().indexOf('QMJHL') >= 0) leagueName = 'LHJMQ';

              matches.push({
                  id: 'onhockey_' + Date.now() + '_' + matchIndex++,
                  league: formatLeagueName(leagueName),
                  homeTeam: getOfficialTeamName(home),
                  awayTeam: getOfficialTeamName(away),
                  startTime: startTimeStr,
                  durationMinutes: getLeagueDuration('hockey'),
                  status: 'upcoming',
                  streamLinks: streamLinksArr,
                  streamsLoaded: streamLinksArr.length > 0,
                  matchUrl: ONHOCKEY_URL,
                          source: 'onhockey',
                  matchDate: getEstDateStrFromDate(TARGET_DATE)
              });
          }
      }
  }

  lg('OnHockey extraits', matches.length);
  return matches;
}


/* ══ PARSE BUFFSTREAMS ════════════════ */
function parseBuffstreams(html){
  var matches=[];
  var index = 0;
  var doc = new DOMParser().parseFromString(html, 'text/html');

  // New Buffstreams doesn't load all data in home page JSON always, but it often does list categories
  // Let's try to extract what we can from React chunks
  var scriptRegex = /self\.__next_f\.push\(\[1,"(.*)"\]\)/g;
  var match;
  var concatenatedData = "";

  while ((match = scriptRegex.exec(html)) !== null) {
      var chunk = match[1];
      chunk = chunk.replace(/\\"/g, '"')
                   .replace(/\\\\/g, '\\')
                   .replace(/\\n/g, '\n');
      concatenatedData += chunk;
  }

  // 1. First attempt: Full event objects
  var eventRegex = /"event":({(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*})/g;
  var evMatch;

  while ((evMatch = eventRegex.exec(concatenatedData)) !== null) {
      try {
          var evObj = JSON.parse(evMatch[1]);
          var home = evObj.details ? evObj.details.text2 : '';
          var away = evObj.details ? evObj.details.text3 : '';
          var category = evObj.category || 'Sports';

          if(!home || !away) continue;
          if(home === 'null' || away === 'null') continue;

          var status = 'upcoming';
          if (evObj.status === 'live' || evObj.status === 'Live') status = 'live';

          var startTime = '00:00';
          if (evObj.matchStartTime) {
              var d = new Date(evObj.matchStartTime);
              startTime = getEstTimeStrFromDate(d);
          }

          var streamLinks = [];
          if (evObj.iframeStreams) {
              evObj.iframeStreams.forEach(function(s) {
                  streamLinks.push({
                      name: 'Buffstreams - ' + (s.name || 'Flux'),
                      quality: 'HD',
                      lang: 'MULTI',
                      url: s.src,
                      icon: '📺'
                  });
              });
          }

          // Generate a unique ID using the event ID if available
          var mId = evObj._id ? 'buff_' + evObj._id : 'buff_' + index;

          var l = category.toLowerCase().replace(/-/g, ' ');
          matches.push({
              id: mId,
              league: formatLeagueName(l),
              flag: lgFlag(l),
              color: lgColor(l),
              homeTeam: getOfficialTeamName(home),
              awayTeam: getOfficialTeamName(away),
              homeLogo: evObj.teamA_logo ? (evObj.teamA_logo.indexOf('http') === 0 ? evObj.teamA_logo : 'https://buffstreams.com.co' + evObj.teamA_logo) : null,
              awayLogo: evObj.teamB_logo ? (evObj.teamB_logo.indexOf('http') === 0 ? evObj.teamB_logo : 'https://buffstreams.com.co' + evObj.teamB_logo) : null,
              startTime: startTime,
              durationMinutes: getLeagueDuration(l),
              status: status,
              score: null,
              streamLinks: streamLinks,
              streamsLoaded: false,
              matchUrl: (evObj.link ? (evObj.link.indexOf('http')===0 ? evObj.link : 'https://buffstreams.com.co' + evObj.link) : (streamLinks.length > 0 ? streamLinks[0].url : BUFFSTREAMS_URL)),
              source: 'buffstreams'
          });
          index++;
      } catch(e) {}
  }

  lg('Buffstreams extraits', matches.length);
  return matches;
}

/* ══ FOOTYBITE LOGOS SCRAPING ═════════ */
// Add footybite logo parsing
function extractFootybiteLogos(doc) {
    var teams = doc.querySelectorAll('.txt-team');
    teams.forEach(function(teamEl) {
        var teamName = teamEl.textContent.trim();
        var box = teamEl.closest('.row');
        if(!box) return;
        var img = box.querySelector('img.img-icone');
        if(img && img.getAttribute('src') && img.getAttribute('src').indexOf('http') === 0 && img.getAttribute('src').indexOf('default') < 0) {
            // Logos are no longer cached
        }
    });
}



/* ══ PARSE STREAMONSPORT ═══════════════ */
function parseStreamonsport(html) {
    var matches = [];
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var cards = doc.querySelectorAll('.match-card');

    [].forEach.call(cards, function(card) {
        var href = card.getAttribute('href');
        var homeEl = card.querySelectorAll('.team-name')[0];
        var awayEl = card.querySelectorAll('.team-name')[1];
        var timeEl = card.querySelector('.match-time');
        var lgEl = card.querySelector('.date-label');
        var matchUrl = href;

        if (href && homeEl && awayEl && timeEl && matchUrl) {
            var home = homeEl.textContent.trim();
            var away = awayEl.textContent.trim();
            var utcTime = timeEl.getAttribute('data-utc');
            var startTimeStr = '00:00';

            if (utcTime) {
                var d = new Date(utcTime);
                if(!isNaN(d.getTime())){
                    startTimeStr = pad(d.getHours()) + ':' + pad(d.getMinutes());
                    startTimeStr = getEstTime(startTimeStr);
                }
            } else {
                 var tEl = timeEl.querySelector('.time');
                 if(tEl) {
                     startTimeStr = getEstTime(tEl.textContent.trim());
                 }
            }

            var league = lgEl ? lgEl.textContent.trim() : 'Football';

            if(!matchUrl.startsWith('http')) {
                matchUrl = 'https://www.stremonsport.net' + (matchUrl.startsWith('/') ? matchUrl : '/' + matchUrl);
            }

            if (home && away) {
                matches.push({
                    id: 'sos_' + matches.length,
                    league: formatLeagueName(league),
                    flag: lgFlag(league),
                    color: lgColor(league),
                    homeTeam: getOfficialTeamName(home),
                    awayTeam: getOfficialTeamName(away),
                    matchUrl: matchUrl,
                    startTime: startTimeStr,
                    status: 'upcoming',
                    streamLinks: [],
                    streamsLoaded: false,
                    source: 'streamonsport'
                });
            }
        }
    });

    lg('Streamonsport extraits', matches.length);
    return matches;
}


/* ══ PARSE TOTALSPORTEK ════════════════ */
function parseTotalsportek(html) {
    var matches = [];
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var links = doc.querySelectorAll('a[href]');
    [].forEach.call(links, function(a) {
        var href = a.getAttribute('href');
        if(href && href.includes('/game/') && href.includes('-vs-')) {
            var urlParts = href.split('/game/')[1].split('/')[0].split('-vs-');
            if(urlParts.length === 2) {
                var home = urlParts[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim();
                var away = urlParts[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim();
                if(home && away) {
                    var matchUrl = href;
                    if(!matchUrl.startsWith('http') && !matchUrl.startsWith('javascript')) {
                        matchUrl = 'https://www.totalsportek-real.com' + (matchUrl.startsWith('/') ? matchUrl : '/' + matchUrl);
                    }
                    if(matchUrl && !matchUrl.startsWith('javascript') && !matches.find(m => m.matchUrl === matchUrl)) {
                        matches.push({
                            id: 'ts_' + matches.length,
                            league: 'Sports',
                            flag: lgFlag('Sports'),
                            color: lgColor('Sports'),
                            homeTeam: getOfficialTeamName(home),
                            awayTeam: getOfficialTeamName(away),
                            matchUrl: matchUrl,
                            startTime: '00:00',
                            status: 'upcoming',
                            streamLinks: [],
                            streamsLoaded: false,
                            source: 'totalsportek'
                        });
                    }
                }
            }
        }
    });
    return matches;
}

/* ══ PARSE VIPLEAGUE ════════════════ */
function parseVipleague(html) {
    var matches = [];
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var links = doc.querySelectorAll('a[href]');
    [].forEach.call(links, function(a) {
        var href = a.getAttribute('href');
        if(href && href.includes('-streaming') && !href.includes('-links')) {
            var urlParts = href.split('/').pop().split('-streaming')[0].split('-vs-');
            if(urlParts.length >= 2) {
                var home = urlParts[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim();
                var away = urlParts.slice(1).join(' ').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim();
                if(home && away) {
                    var matchUrl = href;
                    if(!matchUrl.startsWith('http') && !matchUrl.startsWith('javascript')) {
                        matchUrl = 'https://vipleague.io' + (matchUrl.startsWith('/') ? matchUrl : '/' + matchUrl);
                    }
                    if(matchUrl.startsWith('http') && !matches.find(m => m.matchUrl === matchUrl)) {
                        matches.push({
                            id: 'vip_' + matches.length,
                            league: 'Sports',
                            flag: lgFlag('Sports'),
                            color: lgColor('Sports'),
                            homeTeam: getOfficialTeamName(home),
                            awayTeam: getOfficialTeamName(away),
                            matchUrl: matchUrl,
                            startTime: '00:00',
                            status: 'upcoming',
                            streamLinks: [],
                            streamsLoaded: false,
                            source: 'vipleague'
                        });
                    }
                }
            }
        }
    });
    return matches;
}

/* ══ PARSE METHSTREAMS ════════════════ */
function parseMethstreams(html) {
    var matches = [];
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var links = doc.querySelectorAll('a[href]');
    [].forEach.call(links, function(a) {
        if(a.href && a.href.includes('stream')) {
            var text = a.textContent.replace(/\s+/g, ' ').trim();
            var teams = text.split(/ vs | v | - /i);
            if(teams.length >= 2 && text.length < 100) {
                var home = teams[0].trim();
                var away = teams.slice(1).join(' - ').trim();
                if(home && away) {
                    var matchUrl = a.getAttribute('href');
                    if(!matchUrl.startsWith('http') && !matchUrl.startsWith('javascript')) {
                        matchUrl = resolveUrl(matchUrl, 'https://methstreams.com/');
                    }
                    if(matchUrl.startsWith('http')) {
                        matches.push({
                            id: 'meth_' + matches.length,
                            homeTeam: home,
                            awayTeam: away,
                            matchUrl: matchUrl,
                            source: 'methstreams'
                        });
                    }
                }
            }
        }
    });
    return matches;
}

/* ══ PARSER CHIRURGICAL ════════════════
   Classes footybite confirmées:
   .div-child-box  → chaque match (133x)
   .txt-team       → noms équipes (266x = 2 par match)
   .time-txt       → heure/score (133x)
   .btn-danger     → bouton flux (133x)
   .text-dark-light → titre de ligue (21x)
   .img-icone      → icône de ligue (20x)
═══════════════════════════════════════ */
function parseNflbite(html) {
    var matches = [];
    var regex = /<a class="teams-logo" href="([^"]*\/teams\/([^"]*)-live-stream\/)">[\s\S]*?<img class="team-logo-img" src="([^"]*)"/g;
    var match;
    var i = 0;
    while ((match = regex.exec(html)) !== null) {
        var url = match[1];
        var teamName = match[2].replace(/-/g, " ").trim();
        var logo = match[3];

        var streamLinks = [];

        matches.push({
            id: "nflbite_" + i,
            homeTeam: getOfficialTeamName(teamName),
            awayTeam: 'TBD',
            homeLogo: logo,
            status: "upcoming",
            score: null,
            startTime: "00:00",
            matchUrl: url.indexOf("http") === 0 ? url : "https://nflbite.is" + url,
            streamLinks: streamLinks,
            streamsLoaded: false,
            league: "NFL",
            source: "nflbite"
        });
        i++;
    }

    // Fallback: Just parse any team-like link
    if (matches.length === 0) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var links = doc.querySelectorAll('a[href*="/teams/"]');
        [].forEach.call(links, function(a) {
             var href = a.getAttribute('href');
             if(href.includes('-live-stream')) {
                 var teamPart = href.split('/teams/')[1].split('-live-stream')[0];
                 var teamN = teamPart.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim();
                 if (teamN && !matches.find(m => m.homeTeam === teamN)) {
                     var matchUrl = href.startsWith('http') ? href : (MLBITE_URL.endsWith('/') ? MLBITE_URL.slice(0, -1) : MLBITE_URL) + (href.startsWith('/') ? href : '/' + href);
                     matches.push({
                        id: "nflbite_fb_" + i++,
                        homeTeam: getOfficialTeamName(teamN),
                        awayTeam: 'TBD',
                        status: "upcoming",
                        startTime: "00:00",
                        matchUrl: matchUrl,
                        streamLinks: [],
                        streamsLoaded: false,
                        league: "NFL",
                        source: "nflbite"
                     });
                 }
             }
        });
    }
    lg("NFLBite extraits", matches.length);
    return matches;
}

function parseMlbbite(html) {
    var matches = [];
    try {
        var doc = new DOMParser().parseFromString(html, "text/html");

        // MLBBite new format: <a href="/watch/..." class="inline-match-item"> or similar
        // Just find any link that looks like a match link if .inline-match-item is missing
        var items = doc.querySelectorAll(".inline-match-item, a[href*='/watch/live/']");

        // Remove duplicates based on href
        var uniqueItems = [];
        var hrefs = new Set();
        [].forEach.call(items, function(el) {
            var href = el.getAttribute("href");
            if (href && !hrefs.has(href)) {
                hrefs.add(href);
                uniqueItems.push(el);
            }
        });

        uniqueItems.forEach(function(el, i) {
            var href = el.getAttribute("href");
            if (!href) return;

            var matchUrl = href.indexOf("http") === 0 ? href : "https://mlbbite.plus" + href;

            var home = "TBD";
            var away = "TBD";
            var score = null;
            var status = "upcoming";
            var startTime = "00:00";

            // Try different team selectors depending on mlbbite layout
            var teams = el.querySelectorAll(".team---item b, .team-name, .name");
            if (teams.length >= 2) {
                home = teams[0].textContent.trim();
                away = teams[1].textContent.trim();
            } else {
                // Try parsing from the URL: /watch/live/san-francisco-giants-at-tampa-bay-rays-5-free-live-stream
                var urlMatch = href.match(/live\/([a-z0-9-]+)-(?:at|vs)-([a-z0-9-]+?)(?:-\d*-?free-live-stream(?:s)?|-live-stream)?(?:\.html|\/)?$/);
                if (urlMatch) {
                    away = urlMatch[1].replace(/-/g, ' ');
                    home = urlMatch[2].replace(/-/g, ' ');
                }
            }

            if (home === "TBA" && away === "TBA") return;

            // Find logos
            var imgs = el.querySelectorAll(".img img, img.logo");
            var homeLogo = imgs.length > 0 ? imgs[0].getAttribute("src") : null;
            var awayLogo = imgs.length > 1 ? imgs[1].getAttribute("src") : null;

            var scoreEl = el.querySelector(".first-team-result, .score");
            if (scoreEl) {
                var s = scoreEl.textContent.trim().split("-");
                if (s.length === 2) {
                    score = [parseInt(s[0]), parseInt(s[1])];
                }
            }

            var statusEl = el.querySelector(".result-status-text, .status");
            if (statusEl) {
                var sTxt = statusEl.textContent.toLowerCase();
                if (sTxt.indexOf("live") !== -1 || sTxt.indexOf("in progress") !== -1 || sTxt.indexOf("top") !== -1 || sTxt.indexOf("bot") !== -1) {
                    status = "live";
                } else if (sTxt.indexOf("finished") !== -1 || sTxt.indexOf("ft") !== -1 || sTxt.indexOf("final") !== -1) {
                    status = "finished";
                }
            }

            var dateEl = el.querySelector(".match-date, .time");
            if (dateEl && !scoreEl) {
                var rawTime = dateEl.textContent.trim();
                var timeM = rawTime.match(/(\d{1,2}):(\d{2})/);
                if (timeM) {
                    startTime = timeM[1].padStart(2, "0") + ":" + timeM[2];
                }
            } else if (dateEl && dateEl.hasAttribute("title") && status === "upcoming") {
                var rawTime = dateEl.getAttribute("title").trim() || dateEl.textContent.trim();
                var timeM = rawTime.match(/(\d{1,2}):(\d{2})/);
                if (timeM) {
                    startTime = timeM[1].padStart(2, "0") + ":" + timeM[2];
                }
            }

            var streamLinks = [];

            matches.push({
                id: "mlbbite_" + i,
                homeTeam: getOfficialTeamName(home),
                awayTeam: getOfficialTeamName(away),
                homeLogo: homeLogo,
                awayLogo: awayLogo,
                status: status,
                score: score,
                startTime: startTime,
                matchUrl: matchUrl,
                streamLinks: streamLinks,
                streamsLoaded: false,
                league: "MLB",
                source: "mlbbite"
            });
        });
    } catch (e) {}
    lg("MLBBite extraits", matches.length);
    return matches;
}

function parseFootybite(html){
  var doc=new DOMParser().parseFromString(html,'text/html');
  lg('Title',doc.title);
  lg('HTML len',html.length);

  /* Compte les sélecteurs clés pour validation */
  var counts={
    'div-child-box': doc.querySelectorAll('.div-child-box').length,
    'txt-team':      doc.querySelectorAll('.txt-team').length,
    'time-txt':      doc.querySelectorAll('.time-txt').length,
    'btn-danger':    doc.querySelectorAll('.btn-danger').length,
    'text-dark-light':doc.querySelectorAll('.text-dark-light').length,
    'img-icone':     doc.querySelectorAll('.img-icone').length,
    'my-1':          doc.querySelectorAll('.my-1').length,
  };
  lg('Counts clés',JSON.stringify(counts));

  /* Snapshot du body pour debug */
  lg('body[5000]',doc.body.innerHTML.slice(0,5000));

  extractFootybiteLogos(doc);

  /* Si aucun .div-child-box → page différente */
  var matchEls=doc.querySelectorAll('.div-child-box');
  var matches=[];
  var currentLeague='Football';

  if(matchEls.length===0){
    // Fallback: If strict classes are missing, find typical match containers (e.g. ones with two teams and a time)
    var possibleMatches = doc.querySelectorAll('a[href*="/"], .match-row, .event-block, li');
    [].forEach.call(possibleMatches, function(el, i) {
        var text = el.textContent.replace(/\s+/g, ' ').trim();
        var teams = text.split(/ vs | v | - /i);
        if (teams.length >= 2 && text.length < 100) {
            var home = teams[0].trim();
            var away = teams.slice(1).join(' - ').trim();
            var timeM = text.match(/(\d{1,2}):(\d{2})/);
            var startTime = '00:00';
            if (timeM) {
                startTime = pad(parseInt(timeM[1])) + ':' + timeM[2];
                startTime = getEstTime(startTime);
            }

            var matchUrl = '';
            if (el.tagName.toLowerCase() === 'a') {
                matchUrl = el.getAttribute('href') || '';
            } else {
                var a = el.querySelector('a');
                if (a) matchUrl = a.getAttribute('href') || '';
            }
            if (matchUrl && !matchUrl.startsWith('http')) {
                var baseUrl = SITE.endsWith('/') ? SITE.slice(0, -1) : SITE;
                matchUrl = baseUrl + (matchUrl.startsWith('/') ? matchUrl : '/' + matchUrl);
            }

            matches.push({
                id: 'fb_fb_' + i,
                league: formatLeagueName('Football'),
                flag: lgFlag('Football'),
                color: lgColor('Football'),
                homeTeam: getOfficialTeamName(home),
                awayTeam: getOfficialTeamName(away),
                startTime: startTime,
                durationMinutes: getLeagueDuration('Football'),
                status: 'upcoming',
                score: null,
                minute: null,
                matchUrl: matchUrl,
                streamLinks: [],
                streamsLoaded: false
            });
        }
    });

    if (matches.length > 0) return matches;

    /* Fallback: scan toutes les classes présentes */
    var cls={};
    [].forEach.call(doc.querySelectorAll('[class]'),function(el){
      el.className.split(/\s+/).forEach(function(c){if(c)cls[c]=(cls[c]||0)+1;});
    });
    var top=Object.keys(cls).sort(function(a,b){return cls[b]-cls[a];}).slice(0,30);
    lg('Top classes',top.map(function(c){return c+'('+cls[c]+')';}).join(', '));
    lg('IDs',[].map.call(doc.querySelectorAll('[id]'),function(e){return e.id;}).filter(Boolean).slice(0,20).join(', '));
    return [];
  }

  [].forEach.call(matchEls,function(el,i){
    /* ─ Cherche le titre de ligue courant ─
       Le site organise: [league-header] [div-child-box] [div-child-box] … [league-header] …
       On remonte les siblings précédents pour trouver le dernier header */
    var lhdr=findLeagueHeader(el);
    if(lhdr) currentLeague=lhdr;
    var league=currentLeague;

    /* ─ Équipes (.txt-team) ─ */
    var teams=el.querySelectorAll('.txt-team');
    if(teams.length === 0){
      lg('Skip #'+i,'0 .txt-team');
      return;
    }
    var home=teams[0].textContent.trim();
    var away=teams.length>1 ? teams[1].textContent.trim() : '';

    if(away.toLowerCase() === 'live') {
      away = '';
    }

    if(!home) return;
    if(!away && home.toLowerCase().indexOf('f1') === -1 && home.toLowerCase().indexOf('nascar') === -1 && home.toLowerCase().indexOf('golf') === -1 && league.toLowerCase().indexOf('f1') === -1 && league.toLowerCase().indexOf('nascar') === -1 && league.toLowerCase().indexOf('golf') === -1 && league.toLowerCase().indexOf('nhl') === -1 && league.toLowerCase().indexOf('mlb') === -1) {
       return;
    }

    /* ─ Heure/score (.time-txt) ─ */
    var timeEl=el.querySelector('.time-txt');
    var rawTime=timeEl?timeEl.textContent.replace(/\s+/g,' ').trim():'';
    lg('raw time #'+i,rawTime);

    var startTime='00:00';
    var score=null;
    var status='upcoming';
    var minute=null;

    /* Cas 1: "19:45" → upcoming */
    var timeM=rawTime.match(/^(\d{1,2}):(\d{2})$/);
    /* Cas 2: "2 - 1" ou "2-1" → finished/live avec score */
    var scoreM=rawTime.match(/(\d+)\s*[-–]\s*(\d+)/);
    /* Cas 3: "45'" ou "HT" → live */
    var minM=rawTime.match(/(\d{1,3})'|HT|FT|Live/i);
    /* Cas 4: "Starts in 1hr:47min" ou "Starts in 17min" */
    var startsInM=rawTime.match(/Starts in (?:(\d+)hr:)?(\d+)min/i);
    /* Cas 5: "Match Started" */
    var matchStartedM=rawTime.match(/Match Started/i);

    if(timeM){
      startTime=pad(parseInt(timeM[1]))+':'+timeM[2];
      startTime=getEstTime(startTime);
      status='upcoming';
    } else if(startsInM){
      var n = new Date();
      var hAdd = startsInM[1]?parseInt(startsInM[1]):0;
      var mAdd = startsInM[2]?parseInt(startsInM[2]):0;
      n.setMinutes(n.getMinutes() + mAdd);
      n.setHours(n.getHours() + hAdd);
      startTime=pad(n.getHours())+':'+pad(n.getMinutes());
      status='upcoming';
    } else if(matchStartedM){
      var n = new Date();
      startTime=pad(n.getHours())+':'+pad(n.getMinutes());
      status='live';
    } else if(scoreM){
      score=[parseInt(scoreM[1]),parseInt(scoreM[2])];
      /* Cherche aussi l'heure dans un autre élément */
      var parentText=el.parentElement?el.parentElement.textContent:'';
      var ptime=parentText.match(/\b(\d{1,2}):(\d{2})\b/);
      startTime=ptime?pad(parseInt(ptime[1]))+':'+ptime[2]:'00:00';
      startTime=getEstTime(startTime);
      /* Live si minute trouvée */
      var liveEl=el.querySelector('.time-txt,[class*="live"],[class*="minute"]');
      var liveText=liveEl?liveEl.textContent:'';
      var lm=liveText.match(/(\d{1,3})'/);
      if(lm){status='live';minute=lm[1];}
      else if(/FT|Full/i.test(liveText)){status='finished';minute='FT';}
      else{status='live';}
    } else if(minM){
      var mText = minM[0];
      if (/FT/i.test(mText)) {
        status='finished';
        minute='FT';
      } else {
        status='live';
        minute=minM[1]||mText;
      }
    } else {
        /* Fallback: essai de trouver une heure qq part */
        var parentText=el.parentElement?el.parentElement.textContent:'';
        var ptime=parentText.match(/\b(\d{1,2}):(\d{2})\b/);
        if (ptime) {
            startTime=pad(parseInt(ptime[1]))+':'+ptime[2];
            startTime=getEstTime(startTime);
        }
    }

    /* On page d'accueil: lien vers la page du match */
    var matchUrl='';
    var matchLink=el.parentElement && el.parentElement.tagName.toLowerCase() === 'a' ? el.parentElement : null;
    if(!matchLink) matchLink=el.querySelector('a[target="_blank"][href*="/"]');
    if(!matchLink) matchLink=el.querySelector('a[href]');

    if(matchLink){
      var mhref=(matchLink.getAttribute('href')||'').trim();
      if(mhref&&mhref!=='#'){
        var baseUrl = SITE.endsWith('/') ? SITE.slice(0, -1) : SITE;
        matchUrl=mhref.indexOf('http')===0?mhref:baseUrl+(mhref.startsWith('/')?mhref:'/'+mhref);
      }
    }

    matches.push({
      id:i, league:formatLeagueName(league), flag:lgFlag(league), color:lgColor(league),
      homeTeam:getOfficialTeamName(home), awayTeam:getOfficialTeamName(away),
      startTime:startTime, durationMinutes:getLeagueDuration(league),
      status:status, score:score, minute:minute,
      matchUrl:matchUrl || SITE,
      streamLinks:[], /* Sera rempli par le scrape asynchrone */
      streamsLoaded:false
    });
  });

  lg('Matchs extraits',matches.length);
  return matches;
}


/* ══ CACHE STREAMS (2 hours) ══════════════ */
function getStreamCache(mid) {
    var globalCache = safeStorageGetJSON('stream_cache', {});
    var matchCache = globalCache[mid];

    if (matchCache && matchCache.streams && matchCache.streams.length > 0) {
        // Shorter cache lifespan: 30 minutes. Let's make sure we have fresh streams.
        if (Date.now() - matchCache.ts < 30 * 60 * 1000) {
            return matchCache.streams;
        } else {
            delete globalCache[mid];
            safeStorageSetJSON('stream_cache', globalCache);
        }
    }
    return null;
}

function saveStreamCache(mid, streams) {
    // Only cache if there are actual streams to avoid caching empty results
    if (!streams || streams.length === 0) return;

    var globalCache = safeStorageGetJSON('stream_cache', {});
    var now = Date.now();

    // Clean up older items to avoid large local storage footprint
    for (var k in globalCache) {
        if (now - globalCache[k].ts >= 30 * 60 * 1000) {
            delete globalCache[k];
        }
    }

    globalCache[mid] = { ts: now, streams: streams };
    safeStorageSetJSON('stream_cache', globalCache);
}

/* ══ FETCH SUB-PAGES (STREAMS) ════════════ */
function fetchSubPages(matches){
  var now = new Date();
  var currentEstDateStr = getEstDateStrFromDate(now);
  var currentEstTimeStr = getEstTimeStrFromDate(now);
  var currentParts = currentEstTimeStr.split(':');

  // Calculate absolute current minutes (since epoch) using EST date string and time string
  var currentAbsoluteMins = Math.floor(new Date(currentEstDateStr + 'T00:00:00Z').getTime() / 60000) +
                            parseInt(currentParts[0], 10) * 60 + parseInt(currentParts[1], 10);

  // We use a limited concurrency pool so we don't spam the proxy/network
  var concurrency=3;
  var queue=matches.filter(function(m){
      if (m.status === 'live' && !m.refreshedOnStart) {
          m.refreshedOnStart = true;
          m.streamsLoaded = false;
      }

      // if it has >= 100 streams, skip
      if (m.streamLinks && m.streamLinks.length >= 1000) {
          m.streamsLoaded = true;
          return false;
      }
      // Si on a très peu/pas de flux, on ne considère pas les streams comme "définitivement" chargés
      // pour le background refresh. Cela permet de réessayer si on a ouvert le modal trop tôt.
      var hasEnoughStreams = m.streamLinks && m.streamLinks.length > 0;
      if (!m.matchUrl || (m.streamsLoaded && hasEnoughStreams)) return false;

      if (m.startTime && m.matchDate) {
          var mParts = m.startTime.split(':');
          var matchAbsoluteStartMins = Math.floor(new Date(m.matchDate + 'T00:00:00Z').getTime() / 60000) +
                                       parseInt(mParts[0], 10) * 60 + parseInt(mParts[1], 10);

          var matchAbsoluteEndMins = matchAbsoluteStartMins + (m.durationMinutes || 120);

          var diffStart = matchAbsoluteStartMins - currentAbsoluteMins;
          var diffEnd = matchAbsoluteEndMins - currentAbsoluteMins;

          // Only fetch if current time is within [start - 60, end + 60]
          // which means current is >= start - 60 (diffStart <= 60)
          // and current is <= end + 60 (diffEnd >= -60)
          if (diffStart > 60) {
              return false; // Too early, don't fetch (even if playoff)
          }
          if (diffEnd < -60 && !(m.isPlayoff && m.status !== 'finished')) {
              return false; // Too late, unless it's an unfinished playoff game
          }
      }
      return true;
  });
  queue.sort(function(a, b) {
    var aFav = (favTeams[a.homeTeam] || favTeams[a.awayTeam]) ? 1 : 0;
    var bFav = (favTeams[b.homeTeam] || favTeams[b.awayTeam]) ? 1 : 0;
    if (aFav !== bFav) return bFav - aFav;

    var aNhl = (a.league && a.league.toLowerCase() === 'nhl') ? 1 : 0;
    var bNhl = (b.league && b.league.toLowerCase() === 'nhl') ? 1 : 0;
    if (aNhl !== bNhl) return bNhl - aNhl;

    return 0;
  });
  var active=0;

  function next(){
    if(queue.length===0 && active===0){
      lg('Scrape streams','Terminé pour tous les matchs');
      return;
    }
    while(active<concurrency && queue.length>0){
      active++;
      var m=queue.shift();
      scrapeMatchFlux(m).then(function(){
        active--;
        setTimeout(next, 0);
      }).catch(function(e){
        lg('Err scrape '+m.homeTeam,e.message);
        addScrapeLog(m.matchUrl, 'error', 'Match scrape failed: ' + e.message);
        m.streamsLoaded = true; // Empêche un blocage infini dans l'UI
        m.streamLinks = m.streamLinks || [];
        updateMatchUiAfterScrape_hook(m);
        active--;
        setTimeout(next, 0);
      });
    }
  }
  next();
}

function scrapeMatchFlux(m, forceRefresh){
  // Ignore artificial limits to allow robust fetch
  // Check cache first unless explicitly forcing refresh
  if (!forceRefresh) {
      var cachedStreams = getStreamCache(m.id);
      if (cachedStreams && cachedStreams.length > 0) {
          lg('Scrape streams cached', m.homeTeam);
          m.streamLinks = cachedStreams;
          m.streamsLoaded = true;
          updateMatchUiAfterScrape_hook(m);
          return Promise.resolve();
      }
  }

  // Timeout for individual match scrape
  return Promise.race([
    fetchPage(m.matchUrl),
    new Promise(function(_, reject) { setTimeout(function() { reject(new Error('Timeout match streams')); }, 10000); })
  ]).then(function(html){
    return new Promise(function(resolve, reject) {
      setTimeout(function() {
        try {
    var doc=new DOMParser().parseFromString(html,'text/html');
    var links=[];
    var pageTextContext = doc.body ? doc.body.textContent || '' : '';
    var pageLinksContext = [];

    // === TOUTES SOURCES : RECHERCHE LARGE DE FLUX ===

    // OnHockey specific logic for stream extraction from aggregate page
    if (m.matchUrl === ONHOCKEY_URL || m.source === 'onhockey') {
        var ohMatches = parseOnHockey(html);
        var matchingOh = ohMatches.find(function(oh) { return isMatchPair(m, oh); });
        if (matchingOh && matchingOh.streamLinks) {
            matchingOh.streamLinks.forEach(function(sl) {
                if (!links.find(function(l) { return l.url === sl.url; })) {
                    links.push(sl);
                }
            });
        }
    }

    // StreamOnSport specific logic
    if (m.source === 'streamonsport') {
        var panels = doc.querySelectorAll('.player-panel');
        [].forEach.call(panels, function(panel) {
            var dataEmbed = panel.getAttribute('data-embed');
            if (dataEmbed) {
                var txt = document.createElement('textarea');
                txt.innerHTML = dataEmbed;
                var decoded = txt.value;

                var iframeMatch = decoded.match(/<iframe.*?src=["'](.*?)["']/i);
                if (iframeMatch && iframeMatch[1]) {
                    var src = iframeMatch[1];
                    var nameText = 'StreamOnSport Flux';
                    var lang = 'MULTI';
                    var span = panel.querySelector('span'); // based on the structure where span is inside .player-panel
                    if (span) {
                        nameText = span.textContent.replace('En direct:', '').trim();
                        if (nameText.toLowerCase().indexOf('fra') >= 0 || nameText.toLowerCase().indexOf('fr') >= 0) {
                            lang = 'FR';
                        }
                    }
                    links.push({
                        name: nameText,
                        quality: 'HD',
                        lang: lang,
                        url: src,
                        icon: '▶️',
                        scrapeContext: { blockText: panel.textContent || '', pageText: pageTextContext, pageLink: m.matchUrl, allLinks: pageLinksContext }
                    });
                }
            }
        });
    }

    // 1. Chercher des iframes directs
    var iframes = doc.querySelectorAll('iframe');
    [].forEach.call(iframes, function(ifr) {
        var src = ifr.getAttribute('src');
        if(src && src.indexOf('http') === 0 && src.indexOf('ads') < 0) {
            links.push({
                name: 'Lecteur direct',
                quality: 'HD',
                lang: 'MULTI',
                url: src,
                icon: '▶️',
                scrapeContext: { blockText: ifr.parentElement ? ifr.parentElement.textContent || '' : '', pageText: pageTextContext, pageLink: m.matchUrl, allLinks: pageLinksContext }
            });
        }
    });

    // 2. Chercher dans les tables (Footybite, etc.)
    var rows = doc.querySelectorAll('tr');
    [].forEach.call(rows, function(row){
        var tds = row.querySelectorAll('td');
        if(tds.length < 2) return;

        var url = '';
        var input = row.querySelector('input');
        if(input && input.value && input.value.indexOf('http') === 0) {
            url = input.value;
        } else {
            var as = row.querySelectorAll('a[href]');
            for(var i=0; i<as.length; i++) {
                 var href = as[i].getAttribute('href');
                 if(href && !href.startsWith('http') && !href.startsWith('javascript')) { href = resolveUrl(href, m.matchUrl); }
                 if(href && href.indexOf('http')===0) {
                     url = href;
                     break;
                 }
            }
        }

        if(url && typeof url === 'string') {
            var lowerUrl = url.toLowerCase();
            if (lowerUrl.includes('1xbet') || lowerUrl.includes('bet365') || lowerUrl.includes('ads') || lowerUrl.length < 5) return;

            var name = tds[1] ? tds[1].textContent.replace(/\s+/g, ' ').trim() : 'Flux externe';
            if(!name && tds[2]) name = tds[2].textContent.replace(/\s+/g, ' ').trim();
            if(!name) name = 'Flux';
            if(name.length > 50) name = name.substring(0, 47) + '...';

            var upperName = name.toUpperCase();
            var isPartnerSite = ['FOOTYBITE', 'NFLBITE', 'NBABITE', 'SPORTSURGE', 'HESGOAL', 'SOCCER STREAMS', 'DISCORD', 'TWITTER', 'TELEGRAM', 'REDDIT'].some(function(partner) {
                return upperName.includes(partner);
            });
            if (isPartnerSite) return;

            var rowText = row.textContent.toLowerCase();
            var qual = 'SD';
            if(rowText.indexOf('hd') >= 0 || rowText.indexOf('1080') >= 0 || rowText.indexOf('720') >= 0) qual = 'HD';
            if(rowText.indexOf('4k') >= 0) qual = '4K';

            links.push({
                name: name,
                quality: qual,
                url: url,
                scrapeContext: { blockText: rowText, pageText: pageTextContext, pageLink: m.matchUrl, allLinks: pageLinksContext }
            });
        }
    });

    // 3. Fallback: boutons ou liens génériques
    var btns = doc.querySelectorAll('.btn-danger, a.nav-link2, a.btn-3d, a.stream-button, a[href*="/watch/"], a[href*="/live/"], a[href*="stream"], a[target="_blank"]');
    [].forEach.call(btns,function(btn){
       if(btn.tagName==='A' && btn.getAttribute('href')){
          var url=btn.getAttribute('href');
          if(url && !url.startsWith('http') && !url.startsWith('javascript')) { url = resolveUrl(url, m.matchUrl); }
          if(url && url.indexOf('http')===0) {
              var lowerUrl = url.toLowerCase();
              if (lowerUrl.includes('1xbet') || lowerUrl.includes('bet365') || lowerUrl.includes('ads') || lowerUrl.includes('f1streamsi') || lowerUrl.length < 5) return;
              var name = btn.textContent.replace(/\s+/g, ' ').trim() || 'Flux externe';
              if(name.length > 50) name = name.substring(0, 47) + '...';

              var upperName = name.toUpperCase();
              var isPartnerSite = ['FOOTYBITE', 'NFLBITE', 'NBABITE', 'SPORTSURGE', 'HESGOAL', 'SOCCER STREAMS', 'DISCORD', 'TWITTER', 'TELEGRAM', 'REDDIT'].some(function(partner) {
                  return upperName.includes(partner);
              });
              if (isPartnerSite) return;

              var isOtherMatch = false;
              if (lowerUrl.indexOf('match') >= 0 || name.toLowerCase().indexOf('match') >= 0 || name.toLowerCase().indexOf('started') >= 0 || name.toLowerCase().indexOf(' vs ') >= 0) {
                  // Use the context to see if it matches our team
                  var hName = (m.homeTeam || '').toLowerCase();
                  var aName = (m.awayTeam || '').toLowerCase();

                  // Get team info if available
                  var hInfo = { city: hName, teamName: hName };
                  var aInfo = { city: aName, teamName: aName };
                  if (typeof getTeamInfo !== 'undefined') {
                      hInfo = getTeamInfo(hName);
                      aInfo = getTeamInfo(aName);
                  }

                  var checkWords = function(normStr, normWords) {
                      return normWords.split(' ').some(function(w) { return w.length >= 3 && normStr.indexOf(w) >= 0; });
                  };

                  var searchStr = (name + " " + lowerUrl).toLowerCase();
                  var normSearchStr = searchStr.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

                  var normHName = hName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                  var normHCity = hInfo.city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                  var normHTeamName = hInfo.teamName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

                  var normAName = aName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                  var normACity = aInfo.city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                  var normATeamName = aInfo.teamName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

                  var hasHome = checkWords(normSearchStr, normHName) || checkWords(normSearchStr, normHCity) || checkWords(normSearchStr, normHTeamName);
                  var hasAway = checkWords(normSearchStr, normAName) || checkWords(normSearchStr, normACity) || checkWords(normSearchStr, normATeamName);

                  if (!hasHome && !hasAway && (name.toLowerCase().length > 10 || lowerUrl.indexOf('match') >= 0)) {
                      // Si on est déjà sur la page spécifique du match, on ne rejette pas ces liens !
                      if (m.matchUrl && m.matchUrl !== SITE && m.matchUrl !== SPORTSURGE_URL && m.matchUrl !== VIPLEAGUE_URL && m.matchUrl !== ONHOCKEY_URL) {
                          isOtherMatch = false; // Ne pas rejeter, on est sur la page du match
                      } else {
                          isOtherMatch = true;
                      }
                  }
              }
              if (isOtherMatch) return;

              links.push({
                 name:name,
                 quality:'HD',
                 lang:'MULTI',
                 url:url,
                 scrapeContext: { blockText: btn.parentElement ? btn.parentElement.textContent || '' : btn.textContent || '', pageText: pageTextContext, pageLink: m.matchUrl, allLinks: pageLinksContext }
              });
          }
       }
    });

    // 4. Fallback: attributs de données cachées (data-stream, etc)
    var elementsWithData = doc.querySelectorAll('[data-stream], [data-url], [data-src], [data-link]');
    [].forEach.call(elementsWithData, function(el) {
        var url = el.getAttribute('data-stream') || el.getAttribute('data-url') || el.getAttribute('data-src') || el.getAttribute('data-link');
        if(url) {
            if (url.startsWith('aHR0c')) {
                try { url = atob(url); } catch(e) {}
            }
            if(!url.startsWith('http') && !url.startsWith('javascript')) { url = resolveUrl(url, m.matchUrl); }
            if(url.indexOf('http') === 0) {
                var lowerUrl = url.toLowerCase();
                if (!lowerUrl.includes('1xbet') && !lowerUrl.includes('bet365') && !lowerUrl.includes('ads') && lowerUrl.length >= 5) {
                    links.push({
                        name: 'Lecteur caché',
                        quality: 'HD',
                        lang: 'MULTI',
                        url: url,
                        icon: '▶️',
                        scrapeContext: { blockText: el.parentElement ? el.parentElement.textContent || '' : el.textContent || '', pageText: pageTextContext, pageLink: m.matchUrl, allLinks: pageLinksContext }
                    });
                }
            }
        }
    });

    // 5. Ultime fallback : Si la source ne donne vraiment aucun autre flux et qu'on a le matchUrl.
    if(links.length===0 && m.matchUrl){
        links.push({name:'Voir streams sur le site', quality:'HD', lang:'Multi', url:m.matchUrl, icon:'🔗'});
    }


    // Populate pageLinksContext for all contexts
    links.forEach(function(l) {
        if (l.url) pageLinksContext.push(l.url);
    });

    // Preserve existing streams and avoid duplicates
    var existingLinks = m.streamLinks || [];
    var combinedLinks = existingLinks.slice();

    links.forEach(function(newLink) {
        var isDuplicate = combinedLinks.some(function(existingLink) {
            return existingLink.url === newLink.url;
        });
        if (!isDuplicate) {
            combinedLinks.push(newLink);
        }
    });

    // S'assurer qu'on affiche un maximum de streams
    m.streamLinks = combinedLinks;
    m.streamsLoaded=true;
    saveStreamCache(m.id, m.streamLinks);
    updateMatchUiAfterScrape_hook(m);

    // Add success log with number of streams found
    addScrapeLog(m.matchUrl, 'success', 'Scraping terminé: ' + combinedLinks.length + ' streams trouvés.');

        resolve();
        } catch(e) {
            addScrapeLog(m.matchUrl, 'error', 'Match scrape flux failed: ' + e.message);
            reject(e);
        }
      }, 0);
    });
  });
}

function orig_updateMatchUiAfterScrape_hook(m) {
    // Refresh UI for this specific match if needed
    var mbs = [document.getElementById('mb-'+m.id), document.getElementById('mb-'+m.id+'_live_copy')];
    mbs.forEach(function(mb) {
        if(mb){
            var sn=m.streamLinks ? m.streamLinks.length : 0;
            var snEl=mb.querySelector('.mb-sn');
            if(snEl){
                snEl.textContent=sn+' flux'+(sn>1?'s':'');
            }else if(sn>0){
                var mbM=mb.querySelector('.mb-m');
                if(mbM){
                    var span=document.createElement('span');
                    span.className='mb-sn';
                    span.textContent=sn+' flux'+(sn>1?'s':'');
                    mbM.appendChild(span);
                }
            }

            var primeSnEl=mb.querySelector('.prime-stream-count');
            if(primeSnEl){
                primeSnEl.textContent=sn+' flux';
            }else if(sn>0){
                var primeThumb=mb.querySelector('.prime-thumbnail');
                if(primeThumb){
                    var div=document.createElement('div');
                    div.className='prime-stream-count';
                    div.textContent=sn+' flux';
                    primeThumb.appendChild(div);
                }
            }
        }
    });

    // Si la modale est ouverte pour CE match, on la met à jour
    var mnameEl=document.getElementById('mname');
    if(document.getElementById('mbg').classList.contains('open') && mnameEl && mnameEl.textContent.indexOf(m.homeTeam) >= 0){
        var targetContainer = document.getElementById('modal-right-col') || document.getElementById('mbody');
        if(targetContainer) {
            if(!m.streamLinks || m.streamLinks.length===0){
                targetContainer.innerHTML='<div style="text-align:center;padding:20px;color:var(--muted2);">Aucun flux trouvé.</div>';
            } else {
                var sortedLinks = sortFluxLinks(m.streamLinks);
                targetContainer.innerHTML=sortedLinks.map(function(s,i){
                    return renderFluxItem(s, i, m);
                }).join('');
            }
        }
    }
}

/* Remonte les siblings/parents pour trouver le header de ligue */
function findLeagueHeader(el) {
    var curr = el;
    while (curr && curr !== document.body) {
        if (curr.classList && curr.classList.contains('my-1') && curr.querySelector('.img-icone')) {
            var span = curr.querySelector('span');
            if (span) return span.textContent.trim();
        }
        var prev = curr.previousElementSibling;
        while (prev) {
            if (prev.classList && prev.classList.contains('my-1') && prev.querySelector('.img-icone')) {
                var spanPrev = prev.querySelector('span');
                if (spanPrev) return spanPrev.textContent.trim();
            }
            if (prev.classList && prev.classList.contains('league-header')) {
                var text = prev.textContent.replace(/\s+/g, ' ').trim();
                return text;
            }
            prev = prev.previousElementSibling;
        }
        curr = curr.parentElement;
    }
    return null;
}

/* Convert UK time to EST */
function getEstTime(ukTimeStr){
    var parts = ukTimeStr.split(':');
    if(parts.length !== 2) return ukTimeStr;
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    // UK is UTC+0 or +1 (BST). EST is UTC-5 or EDT is UTC-4.
    // Usually a 5 hours difference.
    var estH = h - 5;
    if(estH < 0) estH += 24;
    estH = estH % 24;
    return pad(estH) + ':' + pad(m);
}



// Global bindings for HTML compatibility
// window.parseStreameast = parseStreameast;
// window.parsePWHLSchedule = parsePWHLSchedule;
// window.parseSportsurge = parseSportsurge;
// window.parseOnHockey = parseOnHockey;
// window.parseBuffstreams = parseBuffstreams;
// window.extractFootybiteLogos = extractFootybiteLogos;
// window.parseTotalsportek = parseTotalsportek;
// window.parseVipleague = parseVipleague;
// window.parseMethstreams = parseMethstreams;
// window.parseNflbite = parseNflbite;
// window.parseMlbbite = parseMlbbite;
// window.parseFootybite = parseFootybite;
// window.parseStreamonsport = parseStreamonsport;
// window.getStreamCache = getStreamCache;
// window.saveStreamCache = saveStreamCache;
// window.fetchSubPages = fetchSubPages;
// window.scrapeMatchFlux = scrapeMatchFlux;
// window.updateMatchUiAfterScrape = updateMatchUiAfterScrape;
// window.findLeagueHeader = findLeagueHeader;
// window.getEstTime = getEstTime;


var m = { id: "test", homeTeam: "Montréal Victoire", awayTeam: "Ottawa Charge", matchUrl: ONHOCKEY_URL, league: "PWHL", streamLinks: [] };
scrapeMatchFlux(m, true);
setTimeout(() => {}, 2000);

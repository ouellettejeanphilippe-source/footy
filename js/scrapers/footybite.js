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
                matchUrl = SITE.slice(0, -1) + (matchUrl.startsWith('/') ? matchUrl : '/' + matchUrl);
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
        matchUrl=mhref.indexOf('http')===0?mhref:SITE.slice(0,-1)+mhref;
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
            cacheLogo(mm.homeTeam, nm.homeLogo);
        }
        if(!mm.awayLogo && nm.awayLogo && nm.awayLogo.indexOf('default') === -1) {
            mm.awayLogo = nm.awayLogo;
            cacheLogo(mm.awayTeam, nm.awayLogo);
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

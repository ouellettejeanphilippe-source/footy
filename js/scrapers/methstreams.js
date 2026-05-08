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
                        try { matchUrl = new URL(matchUrl, 'https://methstreams.com/').href; } catch(e) {}
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

/* ══ FETCH ══════════════════════════════ */

function fetchPage(url){
  return new Promise(function(resolve,reject){
    var i=0,errs=[];
    var maxTries = 3; // Try a maximum of 3 proxies to avoid long hangs

    // OnHockey specific: skip allorigins since it strips headers and fails/timeouts for schedule_table.php
    if (url.indexOf('onhockey.tv') >= 0) {
        i = 1;
    }

    function next(){
      if(i>=PROXIES.length || i>=maxTries){reject(new Error(errs.join('\n')));return;}
      var pu=PROXIES[i++](url);
      lg('Proxy '+i,pu.slice(0,70)+'…');

      var headers = {'Accept':'text/html,*/*'};
      // OnHockey specific headers to trick the API/Proxy into thinking it's an AJAX request
      if(url.indexOf('onhockey.tv') >= 0) {
          headers['X-Requested-With'] = 'XMLHttpRequest';
          headers['Referer'] = 'https://onhockey.tv/';
      }

      // Use a slightly shorter timeout for each proxy try so we don't hang too long on bad proxies
      fetch(pu,{signal:AbortSignal.timeout(8000),headers:headers})
        .then(function(r){
          if(!r.ok){errs.push('HTTP '+r.status+' p'+i);next();return null;}
          return r.text().then(t => {
            if (pu.indexOf('allorigins.win/get') > -1) {
                try {
                    let j = JSON.parse(t);
                    return j.contents;
                } catch(e) {
                    return t;
                }
            }
            return t;
          });
        })
        .then(function(t){
          if(t===null) return;
          if(!t||t.length<200){errs.push('Vide p'+i+' ('+t.length+'c)');next();return;}

          // API AllOrigins returns a 522/520 as text sometimes but with a 200/502 status, catch it
          if(t.indexOf('Oops... Request Timeout') >= 0 || t.indexOf('500 Internal Server Error') >= 0 || t.indexOf('502 Bad Gateway') >= 0 || t.indexOf('522 Connection timed out') >= 0) {
              errs.push('Proxy Error Content p'+i);
              next();
              return;
          }

          lg('OK proxy '+i,'len='+t.length);
          S.proxy='proxy '+i;
          resolve(t);
        })
        .catch(function(e){errs.push(e.message+' p'+i);next();});
    }
    next();
  });
}

/* ══ PARSER CHIRURGICAL ════════════════
   Classes footybite confirmées:
   .div-child-box  → chaque match (133x)
   .txt-team       → noms équipes (266x = 2 par match)
   .time-txt       → heure/score (133x)
   .btn-danger     → bouton flux (133x)
   .text-dark-light → titre de ligue (21x)
   .img-icone      → icône de ligue (20x)

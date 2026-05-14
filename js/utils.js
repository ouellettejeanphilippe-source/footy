import { S } from './state.js';
import { PROXIES } from './config.js';
import { normName, getLogo } from './db.js';
import { mvFlux, toggleMultiviewPip, openOptionsPage, openLogsPage, openScriptPage, toggleMultiview } from './multiview.js';
import { userPrefs, buildEPG, scrollToNow } from './ui.js';
import { openFavPage } from './main.js';

/* ══ HELPERS ═══════════════════════════ */

/* ══ LOCALSTORAGE UTILS ═════════════════ */
export function safeStorageGet(key, fallback = null) {
    try {
        var val = localStorage.getItem(key);
        return val !== null ? val : fallback;
    } catch(e) {
        return fallback;
    }
}

export function safeStorageSet(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch(e) {}
}

export function safeStorageGetJSON(key, fallback = null) {
    var val = safeStorageGet(key);
    if (val !== null) {
        try {
            return JSON.parse(val);
        } catch(e) {}
    }
    return fallback;
}

export function safeStorageRemove(key) {
    try {
        localStorage.removeItem(key);
    } catch(e) {}
}

export function safeStorageSetJSON(key, value) {
    safeStorageSet(key, JSON.stringify(value));
}


export function pad(n){return String(n).padStart(2,'0');}
export function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

export function getLeagueDuration(league) {
  if(!league) return 105;
  var l = league.toLowerCase();

  if(l.indexOf('mlb') >= 0 || l.indexOf('baseball') >= 0) return 180;
  if(l.indexOf('nfl') >= 0 || l.indexOf('american football') >= 0 || l.indexOf('cfl') >= 0) return 180;
  if(l.indexOf('nba') >= 0 || l.indexOf('basketball') >= 0) return 150;
  if(l.indexOf('nhl') >= 0 || l.indexOf('hockey') >= 0 || l.indexOf('pwhl') >= 0 || l.indexOf('qmjhl') >= 0 || l.indexOf('lhjmq') >= 0) return 150;
  if(l.indexOf('f1') >= 0 || l.indexOf('formula 1') >= 0) return 120;
  if(l.indexOf('motogp') >= 0 || l.indexOf('moto gp') >= 0) return 60;
  if(l.indexOf('indycar') >= 0 || l.indexOf('indy') >= 0) return 120;
  if(l.indexOf('wwe') >= 0 || l.indexOf('wrestling') >= 0) return 180;

  return 105; // Default for soccer and others
}
export function escJs(s){var e=String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'\\"');return e.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
export function lg(label,val){S.log.push({l:String(label),v:String(val||'')});}


/* ══ RESOLVER ═══════════════════════════ */
export function resolveStreamUrl(url) {
    return new Promise(function(resolve) {
        if (!url || typeof url !== 'string') {
            resolve(url);
            return;
        }

        if (url.indexOf('onhockey.tv') >= 0) {
            fetchPage(url).then(function(html) {
                var doc = new DOMParser().parseFromString(html, 'text/html');
                var iframe = doc.querySelector('iframe');
                if (iframe && iframe.getAttribute('src')) {
                    resolve(iframe.getAttribute('src'));
                } else {
                    resolve(url);
                }
            }).catch(function(e) {
                resolve(url);
            });
        } else {
            resolve(url);
        }
    });
}

/* ══ FETCH ══════════════════════════════ */

export function fetchPage(url){
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

      var headers = {};
      if(!pu.includes('codetabs')) { headers = {'Accept':'text/html,*/*'}; }
      // Note: Custom headers (X-Requested-With, Referer) were previously injected for onhockey.tv,
      // but they now cause CORS preflight OPTIONS requests to fail on api.codetabs.com with 400 Bad Request.
      // Removing them allows the proxy GET request to succeed normally.

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

/* ══ TOAST ══════════════════════════════ */
export function showToast(msg){var t=document.getElementById('toast');document.getElementById('toasttxt').textContent=msg;t.classList.add('show');setTimeout(function(){t.classList.remove('show');},2500);}


/* ══ FILTERS ════════════════════════════ */



export function applyFilter(f){
  S.filter=f;
  ['all','live','upcoming','fav','options','logs','script'].forEach(function(k){
    var el=document.getElementById('filter-'+k);
    if(el){
        if (k===f) {
            el.classList.add('active-toggle');
            el.style.color = 'var(--text)';
        } else {
            el.classList.remove('active-toggle');
            el.style.color = 'var(--muted2)';
            el.style.borderColor = 'var(--border2)';
            el.style.background = 'var(--btn-bg)';
            el.style.boxShadow = 'var(--btn-shadow)';
        }
    }
  });
  var mvBtn = document.getElementById('mv-toggle-btn');
  if(mvBtn) {
      mvBtn.classList.remove('active-toggle');
      mvBtn.classList.remove('has-streams');
      mvBtn.style = '';
      mvBtn.style.boxShadow = 'var(--btn-shadow)';

      // Keep it red if streams are active
      if(mvFlux.length > 0) {
          mvBtn.classList.add('has-streams');
          if (userPrefs.toggleStyle === 'default' || !userPrefs.toggleStyle) {
              mvBtn.style.background = 'rgba(255, 69, 58, 0.2)';
              mvBtn.style.borderColor = 'var(--red)';
          }
          mvBtn.style.color = '#fff';
      }
  }

  // Auto pip multiview if we click on Guide or Live
  var mvc = document.getElementById('mv-container');
  if(mvc && mvc.style.display !== 'none' && !mvc.classList.contains('mv-pip')) {
      toggleMultiviewPip();
  }

  var zoomEpg = document.querySelector('.zoom-controls');
  if (zoomEpg) {
      if (f === 'all' || f === 'live' || f === 'upcoming') {
          zoomEpg.style.display = 'flex';
      } else {
          zoomEpg.style.display = 'none';
      }
  }

  if (f === 'options') {
      openOptionsPage();
  } else if (f === 'logs') {
      openLogsPage();
  } else if (f === 'script') {
      openScriptPage();
  } else if (f === 'fav') {
      openFavPage();
  } else {
      var favPage = document.getElementById('fav-page');
      if (favPage) favPage.style.display = 'none';
      var optionsPage = document.getElementById('options-page');
      if (optionsPage) optionsPage.style.display = 'none';
      var logsPage = document.getElementById('logs-page');
      if (logsPage) logsPage.style.display = 'none';
      var scriptPage = document.getElementById('script-page');
      if (scriptPage) scriptPage.style.display = 'none';
      var errbox = document.getElementById('errbox');
      if (errbox && errbox.classList.contains('show')) {
          // Do not overwrite errbox if it has a real error
      } else {
          var epgContainer = document.getElementById('epg');
          if (epgContainer) epgContainer.style.display = 'flex';
          var mareaContainer = document.getElementById('marea');
          if (mareaContainer) mareaContainer.style.display = 'flex';
          var sportFiltersContainer = document.getElementById('sport-filters-container');
          if (sportFiltersContainer) sportFiltersContainer.style.display = 'flex';
      }

      document.body.setAttribute('data-filter', f);

      // Rebuild the UI to only contain the elements for the active filter
      if (typeof S !== 'undefined' && S.matches && S.matches.length > 0) {
          if (f === 'all' || f === 'live' || f === 'upcoming') {
              buildEPG(S.matches);
          }
      }

      if(f === 'all' || f === 'live') {
          window.dispatchEvent(new Event('filterChanged'));
      }
  }
}

export function openMultiviewTab() {
    var favPage = document.getElementById('fav-page');
    if (favPage) favPage.style.display = 'none';
    ['all','live','upcoming','fav','options','logs','script'].forEach(function(k){
      var el=document.getElementById('filter-'+k);
      if(el){
          el.classList.remove('active-toggle');
          el.style.color = 'var(--muted2)';
          el.style.borderColor = 'var(--border2)';
          el.style.background = 'var(--btn-bg)';
          el.style.boxShadow = 'var(--btn-shadow)';
      }
    });

    var mvBtn = document.getElementById('mv-toggle-btn');
    if(mvBtn) {
        mvBtn.classList.add('active-toggle');
        mvBtn.classList.remove('has-streams');
        mvBtn.style = '';
    }

    var mvc = document.getElementById('mv-container');
    if(mvc) {
        if(mvc.style.display === 'none') {
            toggleMultiview(); // Open it
        } else if(mvc.classList.contains('mv-pip')) {
            toggleMultiviewPip(); // Restore from PIP to full
        }
    }
}

export function applySportFilter(sport){
  var sfContainer = document.getElementById('sport-filters');

  if(sport) {
      if (sport === 'all') {
          S.hiddenLg = {};
      } else {
          // If we were previously showing 'all' (none hidden), first hide all EXCEPT the clicked one
          // to easily select just one league to start with.
          var allWereVisible = true;
          var sports = {};
          S.matches.forEach(function(m){ sports[m.league]=true; });
          Object.keys(sports).forEach(function(k) {
              if (S.hiddenLg[k]) allWereVisible = false;
          });

          if (allWereVisible) {
              Object.keys(sports).forEach(function(k) {
                  S.hiddenLg[k] = true;
              });
              S.hiddenLg[sport] = false; // Show only clicked
          } else {
              // Otherwise toggle normally
              S.hiddenLg[sport] = !S.hiddenLg[sport];

              // If user manually unhid everything one by one, effectively it's 'all'
              var anyHidden = false;
              Object.keys(sports).forEach(function(k) {
                  if (S.hiddenLg[k]) anyHidden = true;
              });
              if (!anyHidden) S.hiddenLg = {};
          }
      }
  }

  if(sfContainer) {
      var anyHidden = false;
      Object.keys(S.hiddenLg).forEach(function(k) {
          if (S.hiddenLg[k]) anyHidden = true;
      });

      var buttons = sfContainer.querySelectorAll('.sport-btn');
      buttons.forEach(function(b) {
          var onClickStr = b.getAttribute('onclick') || '';
          if (onClickStr.indexOf("'all'") !== -1) {
              if (!anyHidden) b.classList.add('active-toggle');
              else b.classList.remove('active-toggle');
          } else {
              var m = onClickStr.match(/applySportFilter\('([^']+)'\)/);
              if (m && m[1]) {
                  var spName = m[1];
                  if (!S.hiddenLg[spName]) b.classList.add('active-toggle');
                  else b.classList.remove('active-toggle');
              }
          }
      });
  }
  setTimeout(function() { buildEPG(S.matches); }, 0);
}

/* ══ TOGGLE ET ACCORDÉON ════════════════ */
export function toggleLeague(lgName) {
  S.hiddenLg[lgName] = !S.hiddenLg[lgName];

  var sfContainer = document.getElementById('sport-filters');
  if(sfContainer) {
      var anyHidden = false;
      Object.keys(S.hiddenLg).forEach(function(k) {
          if (S.hiddenLg[k]) anyHidden = true;
      });

      var btns = sfContainer.querySelectorAll('.sport-filter-btn');
      btns.forEach(function(b) {
          var onClickStr = b.getAttribute('onclick') || '';
          if (onClickStr.indexOf("toggleLeague('") > -1) {
              var m = onClickStr.match(/toggleLeague\('([^']+)'\)/);
              if (m && m[1]) {
                  var lName = m[1];
                  if (!S.hiddenLg[lName]) b.classList.add('active-toggle');
                  else b.classList.remove('active-toggle');
              }
          }
      });
  }

  // Hide/Show elements using CSS based on data attribute
  var containers = document.querySelectorAll('.marea-row, .mrow, .lg-container, .match-card');
  containers.forEach(function(c) {
      var lg = c.getAttribute('data-lg');
      if (lg === lgName) {
          c.style.display = S.hiddenLg[lgName] ? 'none' : (c.classList.contains('mrow') || c.classList.contains('marea-row') || c.classList.contains('match-card') ? 'flex' : 'block');
      }
  });
}

export function toggleAccordion(lgName) {
  S.collapsedLg[lgName] = !S.collapsedLg[lgName];
  var isC = S.collapsedLg[lgName];

  var hdrs = document.querySelectorAll('.lg-hdr[data-lg-hdr="' + lgName + '"]');
  hdrs.forEach(function(h) {
      if(isC) h.classList.add('collapsed');
      else h.classList.remove('collapsed');
  });

  var rows = document.querySelectorAll('.mrow[data-lg="' + lgName + '"]');
  rows.forEach(function(r) {
      r.style.display = isC ? 'none' : 'flex';
  });

  var cards = document.querySelectorAll('.match-card[data-lg="' + lgName + '"]');
  cards.forEach(function(c) {
      c.style.display = isC ? 'none' : 'flex';
  });
}

// Global bindings for HTML compatibility
window.safeStorageGet = safeStorageGet;
window.safeStorageSet = safeStorageSet;
window.safeStorageGetJSON = safeStorageGetJSON;
window.safeStorageSetJSON = safeStorageSetJSON;
window.safeStorageRemove = safeStorageRemove;
window.getLeagueDuration = getLeagueDuration;
window.escJs = escJs;
window.lg = lg;
window.fetchPage = fetchPage;
window.showToast = showToast;
window.applyFilter = applyFilter;
window.openMultiviewTab = openMultiviewTab;
window.applySportFilter = applySportFilter;
window.toggleLeague = toggleLeague;
window.toggleAccordion = toggleAccordion;
window.resolveStreamUrl = resolveStreamUrl;

export function formatTeamNameBreak(name) {
    if (!name) return '';
    var n = name.trim();
    var parts = n.split(' ');
    if (parts.length <= 1) return esc(n);
    if (parts.length === 2) return esc(parts[0]) + '<br>' + esc(parts[1]);

    var prefixes = [
        "new york", "new jersey", "tampa bay", "st. louis", "san jose", "los angeles", "san diego",
        "san antonio", "san francisco", "kansas city", "green bay", "new england",
        "new orleans", "las vegas", "oklahoma city", "golden state",
        "real salt lake", "west ham", "brighton & hove", "1. fc", "cf", "fc", "ac",
        "as", "inter", "dc", "d.c.", "rb", "sporting", "racing", "red bull"
    ];

    var nLower = n.toLowerCase();
    for (var i = 0; i < prefixes.length; i++) {
        var p = prefixes[i];
        if (nLower.startsWith(p + ' ')) {
            return esc(n.substring(0, p.length)) + '<br>' + esc(n.substring(p.length + 1));
        }
    }

    var suffixes = [
        "maple leafs", "golden knights", "red wings", "blue jackets", "white sox", "red sox",
        "blue jays", "trail blazers", "hotspur", "united", "city", "rovers",
        "albion", "athletic", "wanderers", "fc", "cf"
    ];

    for (var i = 0; i < suffixes.length; i++) {
        var s = suffixes[i];
        if (nLower.endsWith(' ' + s)) {
            return esc(n.substring(0, n.length - s.length - 1)) + '<br>' + esc(n.substring(n.length - s.length));
        }
    }

    return esc(parts[0]) + '<br>' + esc(parts.slice(1).join(' '));
}

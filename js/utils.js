import { S } from './state.js';
import { PROXIES } from './config.js';
import { normName, getLogo } from './db.js';
import { mvFlux, toggleMultiviewPip, openOptionsPage, openLogsPage, openScriptPage, toggleMultiview } from './multiview.js';
import { userPrefs, buildEPG, scrollToNow } from './ui.js';
import { openFavPage } from './main.js';

/* ══ HELPERS ═══════════════════════════ */
export function pad(n){return String(n).padStart(2,'0');}
export function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

export function getLeagueDuration(league) {
  if(!league) return 105;
  var l = league.toLowerCase();

  if(l.indexOf('mlb') >= 0 || l.indexOf('baseball') >= 0) return 180;
  if(l.indexOf('nfl') >= 0 || l.indexOf('american football') >= 0) return 180;
  if(l.indexOf('nba') >= 0 || l.indexOf('basketball') >= 0) return 150;
  if(l.indexOf('nhl') >= 0 || l.indexOf('hockey') >= 0) return 150;
  if(l.indexOf('f1') >= 0 || l.indexOf('formula 1') >= 0) return 120;
  if(l.indexOf('indycar') >= 0 || l.indexOf('indy') >= 0) return 120;
  if(l.indexOf('wwe') >= 0 || l.indexOf('wrestling') >= 0) return 180;

  return 105; // Default for soccer and others
}
export function escJs(s){var e=String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'\\"');return e.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
export function lg(label,val){S.log.push({l:String(label),v:String(val||'')});}


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
          setTimeout(scrollToNow, 10);
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
          S.hiddenLg = {'Autres Flux': true};
      } else {
          // If we were previously showing 'all' (none hidden), first hide all EXCEPT the clicked one
          // to easily select just one league to start with.
          var allWereVisible = true;
          var sports = {};
          S.matches.forEach(function(m){ sports[m.league]=true; });
          Object.keys(sports).forEach(function(k) {
              if (k !== 'Autres Flux' && S.hiddenLg[k]) allWereVisible = false;
          });

          if (allWereVisible) {
              Object.keys(sports).forEach(function(k) {
                  if (k !== 'Autres Flux') S.hiddenLg[k] = true;
              });
              S.hiddenLg[sport] = false; // Show only clicked
          } else {
              // Otherwise toggle normally
              S.hiddenLg[sport] = !S.hiddenLg[sport];

              // If user manually unhid everything one by one, effectively it's 'all'
              var anyHidden = false;
              Object.keys(sports).forEach(function(k) {
                  if (k !== 'Autres Flux' && S.hiddenLg[k]) anyHidden = true;
              });
              if (!anyHidden) S.hiddenLg = {'Autres Flux': true};
          }
      }
  }

  if(sfContainer) {
      var anyHidden = false;
      Object.keys(S.hiddenLg).forEach(function(k) {
          if (k !== 'Autres Flux' && S.hiddenLg[k]) anyHidden = true;
      });

      var buttons = sfContainer.querySelectorAll('.sport-btn');
      buttons.forEach(function(b) {
          if (b.id === 'btn-autres-flux') return;
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
  var containers = document.querySelectorAll('.marea-row, .mrow, .lg-container');
  containers.forEach(function(c) {
      var lg = c.getAttribute('data-lg');
      if (lg === lgName) {
          c.style.display = S.hiddenLg[lgName] ? 'none' : (c.classList.contains('mrow') || c.classList.contains('marea-row') ? 'flex' : 'block');
      }
  });
}

export function toggleAutresFlux() {
    S.hiddenLg['Autres Flux'] = !S.hiddenLg['Autres Flux'];
    var btn = document.getElementById('btn-autres-flux');
    if(btn) {
        if (!S.hiddenLg['Autres Flux']) btn.classList.add('active-toggle');
        else btn.classList.remove('active-toggle');
    }
    var containers = document.querySelectorAll('[data-lg="Autres Flux"]');
    containers.forEach(function(c) {
        c.style.display = S.hiddenLg['Autres Flux'] ? 'none' : (c.classList.contains('mrow') || c.classList.contains('marea-row') ? 'flex' : 'block');
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
}

/* ══ LOGO CACHE ═══════════════════════════ */
export var STATIC_LOGOS_RAW = {
  'boston fleet': "https://upload.wikimedia.org/wikipedia/en/2/27/Boston_Fleet_logo.svg",
  'minnesota frost': "https://upload.wikimedia.org/wikipedia/en/5/5a/Minnesota_Frost_logo.svg",
  'montréal victoire': "https://upload.wikimedia.org/wikipedia/en/c/cd/Montreal_Victoire_logo.svg",
  'new york sirens': "https://upload.wikimedia.org/wikipedia/en/1/1a/New_York_Sirens_logo.svg",
  'ottawa charge': "https://upload.wikimedia.org/wikipedia/en/a/ad/Ottawa_Charge_logo.svg",
  'toronto sceptres': "https://upload.wikimedia.org/wikipedia/en/4/4b/Toronto_Sceptres_logo.svg",
  'acadie-bathurst titan': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/acadiebathursttitan.png",
  'baie-comeau drakkar': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/baiecomeaudrakkar.png",
  'blainville-boisbriand armada': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/blainvilleboisbriandarmada.png",
  'cape breton eagles': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/capebretoneagles.png",
  'charlottetown islanders': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/charlottetownislanders.png",
  'chicoutimi saguenéens': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/chicoutimisaguenens.png",
  'drummondville voltigeurs': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/drummondvillevoltigeurs.png",
  'gatineau olympiques': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/gatineauolympiques.png",
  'halifax mooseheads': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/halifaxmooseheads.png",
  'moncton wildcats': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/monctonwildcats.png",
  'québec remparts': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/qubecremparts.png",
  'rimouski océanic': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/rimouskiocanic.png",
  'rouyn-noranda huskies': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/rouynnorandahuskies.png",
  'saint john sea dogs': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/saintjohnseadogs.png",
  'shawinigan cataractes': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/shawinigancataractes.png",
  'sherbrooke phoenix': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/sherbrookephoenix.png",
  'val-d\'or foreurs': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/valdorforeurs.png",
  'victoriaville tigres': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/victoriavilletigres.png",
  'boston fleet': "https://upload.wikimedia.org/wikipedia/en/2/27/Boston_Fleet_logo.svg",
  'minnesota frost': "https://upload.wikimedia.org/wikipedia/en/5/5a/Minnesota_Frost_logo.svg",
  'montréal victoire': "https://upload.wikimedia.org/wikipedia/en/c/cd/Montreal_Victoire_logo.svg",
  'new york sirens': "https://upload.wikimedia.org/wikipedia/en/1/1a/New_York_Sirens_logo.svg",
  'ottawa charge': "https://upload.wikimedia.org/wikipedia/en/a/ad/Ottawa_Charge_logo.svg",
  'toronto sceptres': "https://upload.wikimedia.org/wikipedia/en/4/4b/Toronto_Sceptres_logo.svg",


// premier league
  'afc bournemouth': "https://a.espncdn.com/i/teamlogos/soccer/500/349.png",
  'arsenal': "https://a.espncdn.com/i/teamlogos/soccer/500/359.png",
  'aston villa': "https://a.espncdn.com/i/teamlogos/soccer/500/362.png",
  'brentford': "https://a.espncdn.com/i/teamlogos/soccer/500/337.png",
  'brighton & hove albion': "https://a.espncdn.com/i/teamlogos/soccer/500/331.png",
  'burnley': "https://a.espncdn.com/i/teamlogos/soccer/500/379.png",
  'chelsea': "https://a.espncdn.com/i/teamlogos/soccer/500/363.png",
  'crystal palace': "https://a.espncdn.com/i/teamlogos/soccer/500/384.png",
  'everton': "https://a.espncdn.com/i/teamlogos/soccer/500/368.png",
  'fulham': "https://a.espncdn.com/i/teamlogos/soccer/500/370.png",
  'leeds united': "https://a.espncdn.com/i/teamlogos/soccer/500/357.png",
  'liverpool': "https://a.espncdn.com/i/teamlogos/soccer/500/364.png",
  'manchester city': "https://a.espncdn.com/i/teamlogos/soccer/500/382.png",
  'manchester united': "https://a.espncdn.com/i/teamlogos/soccer/500/360.png",
  'newcastle united': "https://a.espncdn.com/i/teamlogos/soccer/500/361.png",
  'nottingham forest': "https://a.espncdn.com/i/teamlogos/soccer/500/393.png",
  'sunderland': "https://a.espncdn.com/i/teamlogos/soccer/500/366.png",
  'tottenham hotspur': "https://a.espncdn.com/i/teamlogos/soccer/500/367.png",
  'west ham united': "https://a.espncdn.com/i/teamlogos/soccer/500/371.png",
  'wolverhampton wanderers': "https://a.espncdn.com/i/teamlogos/soccer/500/380.png",

// la liga
  'alavés': "https://a.espncdn.com/i/teamlogos/soccer/500/96.png",
  'athletic club': "https://a.espncdn.com/i/teamlogos/soccer/500/93.png",
  'atlético madrid': "https://a.espncdn.com/i/teamlogos/soccer/500/1068.png",
  'barcelona': "https://a.espncdn.com/i/teamlogos/soccer/500/83.png",
  'celta vigo': "https://a.espncdn.com/i/teamlogos/soccer/500/85.png",
  'elche': "https://a.espncdn.com/i/teamlogos/soccer/500/3751.png",
  'espanyol': "https://a.espncdn.com/i/teamlogos/soccer/500/88.png",
  'getafe': "https://a.espncdn.com/i/teamlogos/soccer/500/2922.png",
  'girona': "https://a.espncdn.com/i/teamlogos/soccer/500/9812.png",
  'levante': "https://a.espncdn.com/i/teamlogos/soccer/500/1538.png",
  'mallorca': "https://a.espncdn.com/i/teamlogos/soccer/500/84.png",
  'osasuna': "https://a.espncdn.com/i/teamlogos/soccer/500/97.png",
  'rayo vallecano': "https://a.espncdn.com/i/teamlogos/soccer/500/101.png",
  'real betis': "https://a.espncdn.com/i/teamlogos/soccer/500/244.png",
  'real madrid': "https://a.espncdn.com/i/teamlogos/soccer/500/86.png",
  'real oviedo': "https://a.espncdn.com/i/teamlogos/soccer/500/92.png",
  'real sociedad': "https://a.espncdn.com/i/teamlogos/soccer/500/89.png",
  'sevilla': "https://a.espncdn.com/i/teamlogos/soccer/500/243.png",
  'valencia': "https://a.espncdn.com/i/teamlogos/soccer/500/94.png",
  'villarreal': "https://a.espncdn.com/i/teamlogos/soccer/500/102.png",

// serie a
  'ac milan': "https://a.espncdn.com/i/teamlogos/soccer/500/103.png",
  'as roma': "https://a.espncdn.com/i/teamlogos/soccer/500/104.png",
  'atalanta': "https://a.espncdn.com/i/teamlogos/soccer/500/105.png",
  'bologna': "https://a.espncdn.com/i/teamlogos/soccer/500/107.png",
  'cagliari': "https://a.espncdn.com/i/teamlogos/soccer/500/2925.png",
  'como': "https://a.espncdn.com/i/teamlogos/soccer/500/2572.png",
  'cremonese': "https://a.espncdn.com/i/teamlogos/soccer/500/4050.png",
  'fiorentina': "https://a.espncdn.com/i/teamlogos/soccer/500/109.png",
  'genoa': "https://a.espncdn.com/i/teamlogos/soccer/500/3263.png",
  'hellas verona': "https://a.espncdn.com/i/teamlogos/soccer/500/119.png",
  'internazionale': "https://a.espncdn.com/i/teamlogos/soccer/500/110.png",
  'juventus': "https://a.espncdn.com/i/teamlogos/soccer/500/111.png",
  'lazio': "https://a.espncdn.com/i/teamlogos/soccer/500/112.png",
  'lecce': "https://a.espncdn.com/i/teamlogos/soccer/500/113.png",
  'napoli': "https://a.espncdn.com/i/teamlogos/soccer/500/114.png",
  'parma': "https://a.espncdn.com/i/teamlogos/soccer/500/115.png",
  'pisa': "https://a.espncdn.com/i/teamlogos/soccer/500/3956.png",
  'sassuolo': "https://a.espncdn.com/i/teamlogos/soccer/500/3997.png",
  'torino': "https://a.espncdn.com/i/teamlogos/soccer/500/239.png",
  'udinese': "https://a.espncdn.com/i/teamlogos/soccer/500/118.png",

// bundesliga
  '1. fc heidenheim 1846': "https://a.espncdn.com/i/teamlogos/soccer/500/6418.png",
  '1. fc union berlin': "https://a.espncdn.com/i/teamlogos/soccer/500/598.png",
  'bayer leverkusen': "https://a.espncdn.com/i/teamlogos/soccer/500/131.png",
  'bayern munich': "https://a.espncdn.com/i/teamlogos/soccer/500/132.png",
  'borussia dortmund': "https://a.espncdn.com/i/teamlogos/soccer/500/124.png",
  'borussia mönchengladbach': "https://a.espncdn.com/i/teamlogos/soccer/500/268.png",
  'eintracht frankfurt': "https://a.espncdn.com/i/teamlogos/soccer/500/125.png",
  'fc augsburg': "https://a.espncdn.com/i/teamlogos/soccer/500/3841.png",
  'fc cologne': "https://a.espncdn.com/i/teamlogos/soccer/500/122.png",
  'hamburg sv': "https://a.espncdn.com/i/teamlogos/soccer/500/127.png",
  'mainz': "https://a.espncdn.com/i/teamlogos/soccer/500/2950.png",
  'rb leipzig': "https://a.espncdn.com/i/teamlogos/soccer/500/11420.png",
  'sc freiburg': "https://a.espncdn.com/i/teamlogos/soccer/500/126.png",
  'st. pauli': "https://a.espncdn.com/i/teamlogos/soccer/500/270.png",
  'tsg hoffenheim': "https://a.espncdn.com/i/teamlogos/soccer/500/7911.png",
  'vfb stuttgart': "https://a.espncdn.com/i/teamlogos/soccer/500/134.png",
  'vfl wolfsburg': "https://a.espncdn.com/i/teamlogos/soccer/500/138.png",
  'werder bremen': "https://a.espncdn.com/i/teamlogos/soccer/500/137.png",

// ligue 1
  'aj auxerre': "https://a.espncdn.com/i/teamlogos/soccer/500/172.png",
  'as monaco': "https://a.espncdn.com/i/teamlogos/soccer/500/174.png",
  'angers': "https://a.espncdn.com/i/teamlogos/soccer/500/7868.png",
  'brest': "https://a.espncdn.com/i/teamlogos/soccer/500/6997.png",
  'le havre ac': "https://a.espncdn.com/i/teamlogos/soccer/500/3236.png",
  'lens': "https://a.espncdn.com/i/teamlogos/soccer/500/175.png",
  'lille': "https://a.espncdn.com/i/teamlogos/soccer/500/166.png",
  'lorient': "https://a.espncdn.com/i/teamlogos/soccer/500/273.png",
  'lyon': "https://a.espncdn.com/i/teamlogos/soccer/500/167.png",
  'marseille': "https://a.espncdn.com/i/teamlogos/soccer/500/176.png",
  'metz': "https://a.espncdn.com/i/teamlogos/soccer/500/177.png",
  'nantes': "https://a.espncdn.com/i/teamlogos/soccer/500/165.png",
  'nice': "https://a.espncdn.com/i/teamlogos/soccer/500/2502.png",
  'paris fc': "https://a.espncdn.com/i/teamlogos/soccer/500/6851.png",
  'paris saint-germain': "https://a.espncdn.com/i/teamlogos/soccer/500/160.png",
  'stade rennais': "https://a.espncdn.com/i/teamlogos/soccer/500/169.png",
  'strasbourg': "https://a.espncdn.com/i/teamlogos/soccer/500/180.png",
  'toulouse': "https://a.espncdn.com/i/teamlogos/soccer/500/179.png",

// champions league
  'as monaco': "https://a.espncdn.com/i/teamlogos/soccer/500/174.png",
  'ajax amsterdam': "https://a.espncdn.com/i/teamlogos/soccer/500/139.png",
  'arsenal': "https://a.espncdn.com/i/teamlogos/soccer/500/359.png",
  'atalanta': "https://a.espncdn.com/i/teamlogos/soccer/500/105.png",
  'athletic club': "https://a.espncdn.com/i/teamlogos/soccer/500/93.png",
  'atlético madrid': "https://a.espncdn.com/i/teamlogos/soccer/500/1068.png",
  'barcelona': "https://a.espncdn.com/i/teamlogos/soccer/500/83.png",
  'bayer leverkusen': "https://a.espncdn.com/i/teamlogos/soccer/500/131.png",
  'bayern munich': "https://a.espncdn.com/i/teamlogos/soccer/500/132.png",
  'benfica': "https://a.espncdn.com/i/teamlogos/soccer/500/1929.png",
  'bodo/glimt': "https://a.espncdn.com/i/teamlogos/soccer/500/2980.png",
  'borussia dortmund': "https://a.espncdn.com/i/teamlogos/soccer/500/124.png",
  'chelsea': "https://a.espncdn.com/i/teamlogos/soccer/500/363.png",
  'club brugge': "https://a.espncdn.com/i/teamlogos/soccer/500/570.png",
  'eintracht frankfurt': "https://a.espncdn.com/i/teamlogos/soccer/500/125.png",
  'f.c. københavn': "https://a.espncdn.com/i/teamlogos/soccer/500/909.png",
  'fk qarabag': "https://a.espncdn.com/i/teamlogos/soccer/500/10414.png",
  'galatasaray': "https://a.espncdn.com/i/teamlogos/soccer/500/432.png",
  'internazionale': "https://a.espncdn.com/i/teamlogos/soccer/500/110.png",
  'juventus': "https://a.espncdn.com/i/teamlogos/soccer/500/111.png",
  'kairat almaty': "https://a.espncdn.com/i/teamlogos/soccer/500/2528.png",
  'liverpool': "https://a.espncdn.com/i/teamlogos/soccer/500/364.png",
  'manchester city': "https://a.espncdn.com/i/teamlogos/soccer/500/382.png",
  'marseille': "https://a.espncdn.com/i/teamlogos/soccer/500/176.png",
  'napoli': "https://a.espncdn.com/i/teamlogos/soccer/500/114.png",
  'newcastle united': "https://a.espncdn.com/i/teamlogos/soccer/500/361.png",
  'olympiacos': "https://a.espncdn.com/i/teamlogos/soccer/500/435.png",
  'psv eindhoven': "https://a.espncdn.com/i/teamlogos/soccer/500/148.png",
  'pafos': "https://a.espncdn.com/i/teamlogos/soccer/500/22281.png",
  'paris saint-germain': "https://a.espncdn.com/i/teamlogos/soccer/500/160.png",
  'real madrid': "https://a.espncdn.com/i/teamlogos/soccer/500/86.png",
  'slavia prague': "https://a.espncdn.com/i/teamlogos/soccer/500/494.png",
  'sporting cp': "https://a.espncdn.com/i/teamlogos/soccer/500/2250.png",
  'tottenham hotspur': "https://a.espncdn.com/i/teamlogos/soccer/500/367.png",
  'union st.-gilloise': "https://a.espncdn.com/i/teamlogos/soccer/500/5807.png",
  'villarreal': "https://a.espncdn.com/i/teamlogos/soccer/500/102.png",

// nba
  'atlanta hawks': "https://a.espncdn.com/i/teamlogos/nba/500/atl.png",
  'boston celtics': "https://a.espncdn.com/i/teamlogos/nba/500/bos.png",
  'brooklyn nets': "https://a.espncdn.com/i/teamlogos/nba/500/bkn.png",
  'charlotte hornets': "https://a.espncdn.com/i/teamlogos/nba/500/cha.png",
  'chicago bulls': "https://a.espncdn.com/i/teamlogos/nba/500/chi.png",
  'cleveland cavaliers': "https://a.espncdn.com/i/teamlogos/nba/500/cle.png",
  'dallas mavericks': "https://a.espncdn.com/i/teamlogos/nba/500/dal.png",
  'denver nuggets': "https://a.espncdn.com/i/teamlogos/nba/500/den.png",
  'detroit pistons': "https://a.espncdn.com/i/teamlogos/nba/500/det.png",
  'golden state warriors': "https://a.espncdn.com/i/teamlogos/nba/500/gs.png",
  'houston rockets': "https://a.espncdn.com/i/teamlogos/nba/500/hou.png",
  'indiana pacers': "https://a.espncdn.com/i/teamlogos/nba/500/ind.png",
  'la clippers': "https://a.espncdn.com/i/teamlogos/nba/500/lac.png",
  'los angeles lakers': "https://a.espncdn.com/i/teamlogos/nba/500/lal.png",
  'memphis grizzlies': "https://a.espncdn.com/i/teamlogos/nba/500/mem.png",
  'miami heat': "https://a.espncdn.com/i/teamlogos/nba/500/mia.png",
  'milwaukee bucks': "https://a.espncdn.com/i/teamlogos/nba/500/mil.png",
  'minnesota timberwolves': "https://a.espncdn.com/i/teamlogos/nba/500/min.png",
  'new orleans pelicans': "https://a.espncdn.com/i/teamlogos/nba/500/no.png",
  'new york knicks': "https://a.espncdn.com/i/teamlogos/nba/500/ny.png",
  'oklahoma city thunder': "https://a.espncdn.com/i/teamlogos/nba/500/okc.png",
  'orlando magic': "https://a.espncdn.com/i/teamlogos/nba/500/orl.png",
  'philadelphia 76ers': "https://a.espncdn.com/i/teamlogos/nba/500/phi.png",
  'phoenix suns': "https://a.espncdn.com/i/teamlogos/nba/500/phx.png",
  'portland trail blazers': "https://a.espncdn.com/i/teamlogos/nba/500/por.png",
  'sacramento kings': "https://a.espncdn.com/i/teamlogos/nba/500/sac.png",
  'san antonio spurs': "https://a.espncdn.com/i/teamlogos/nba/500/sa.png",
  'toronto raptors': "https://a.espncdn.com/i/teamlogos/nba/500/tor.png",
  'utah jazz': "https://a.espncdn.com/i/teamlogos/nba/500/utah.png",
  'washington wizards': "https://a.espncdn.com/i/teamlogos/nba/500/wsh.png",

// nfl
  'arizona cardinals': "https://a.espncdn.com/i/teamlogos/nfl/500/ari.png",
  'atlanta falcons': "https://a.espncdn.com/i/teamlogos/nfl/500/atl.png",
  'baltimore ravens': "https://a.espncdn.com/i/teamlogos/nfl/500/bal.png",
  'buffalo bills': "https://a.espncdn.com/i/teamlogos/nfl/500/buf.png",
  'carolina panthers': "https://a.espncdn.com/i/teamlogos/nfl/500/car.png",
  'chicago bears': "https://a.espncdn.com/i/teamlogos/nfl/500/chi.png",
  'cincinnati bengals': "https://a.espncdn.com/i/teamlogos/nfl/500/cin.png",
  'cleveland browns': "https://a.espncdn.com/i/teamlogos/nfl/500/cle.png",
  'dallas cowboys': "https://a.espncdn.com/i/teamlogos/nfl/500/dal.png",
  'denver broncos': "https://a.espncdn.com/i/teamlogos/nfl/500/den.png",
  'detroit lions': "https://a.espncdn.com/i/teamlogos/nfl/500/det.png",
  'green bay packers': "https://a.espncdn.com/i/teamlogos/nfl/500/gb.png",
  'houston texans': "https://a.espncdn.com/i/teamlogos/nfl/500/hou.png",
  'indianapolis colts': "https://a.espncdn.com/i/teamlogos/nfl/500/ind.png",
  'jacksonville jaguars': "https://a.espncdn.com/i/teamlogos/nfl/500/jax.png",
  'kansas city chiefs': "https://a.espncdn.com/i/teamlogos/nfl/500/kc.png",
  'las vegas raiders': "https://a.espncdn.com/i/teamlogos/nfl/500/lv.png",
  'los angeles chargers': "https://a.espncdn.com/i/teamlogos/nfl/500/lac.png",
  'los angeles rams': "https://a.espncdn.com/i/teamlogos/nfl/500/lar.png",
  'miami dolphins': "https://a.espncdn.com/i/teamlogos/nfl/500/mia.png",
  'minnesota vikings': "https://a.espncdn.com/i/teamlogos/nfl/500/min.png",
  'new england patriots': "https://a.espncdn.com/i/teamlogos/nfl/500/ne.png",
  'new orleans saints': "https://a.espncdn.com/i/teamlogos/nfl/500/no.png",
  'new york giants': "https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png",
  'new york jets': "https://a.espncdn.com/i/teamlogos/nfl/500/nyj.png",
  'philadelphia eagles': "https://a.espncdn.com/i/teamlogos/nfl/500/phi.png",
  'pittsburgh steelers': "https://a.espncdn.com/i/teamlogos/nfl/500/pit.png",
  'san francisco 49ers': "https://a.espncdn.com/i/teamlogos/nfl/500/sf.png",
  'seattle seahawks': "https://a.espncdn.com/i/teamlogos/nfl/500/sea.png",
  'tampa bay buccaneers': "https://a.espncdn.com/i/teamlogos/nfl/500/tb.png",
  'tennessee titans': "https://a.espncdn.com/i/teamlogos/nfl/500/ten.png",
  'washington commanders': "https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png",

// mlb
  'arizona diamondbacks': "https://a.espncdn.com/i/teamlogos/mlb/500/ari.png",
  'athletics': "https://a.espncdn.com/i/teamlogos/mlb/500/ath.png",
  'atlanta braves': "https://a.espncdn.com/i/teamlogos/mlb/500/atl.png",
  'baltimore orioles': "https://a.espncdn.com/i/teamlogos/mlb/500/bal.png",
  'boston red sox': "https://a.espncdn.com/i/teamlogos/mlb/500/bos.png",
  'chicago cubs': "https://a.espncdn.com/i/teamlogos/mlb/500/chc.png",
  'chicago white sox': "https://a.espncdn.com/i/teamlogos/mlb/500/chw.png",
  'cincinnati reds': "https://a.espncdn.com/i/teamlogos/mlb/500/cin.png",
  'cleveland guardians': "https://a.espncdn.com/i/teamlogos/mlb/500/cle.png",
  'colorado rockies': "https://a.espncdn.com/i/teamlogos/mlb/500/col.png",
  'detroit tigers': "https://a.espncdn.com/i/teamlogos/mlb/500/det.png",
  'houston astros': "https://a.espncdn.com/i/teamlogos/mlb/500/hou.png",
  'kansas city royals': "https://a.espncdn.com/i/teamlogos/mlb/500/kc.png",
  'los angeles angels': "https://a.espncdn.com/i/teamlogos/mlb/500/laa.png",
  'los angeles dodgers': "https://a.espncdn.com/i/teamlogos/mlb/500/lad.png",
  'miami marlins': "https://a.espncdn.com/i/teamlogos/mlb/500/mia.png",
  'milwaukee brewers': "https://a.espncdn.com/i/teamlogos/mlb/500/mil.png",
  'minnesota twins': "https://a.espncdn.com/i/teamlogos/mlb/500/min.png",
  'new york mets': "https://a.espncdn.com/i/teamlogos/mlb/500/nym.png",
  'new york yankees': "https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png",
  'philadelphia phillies': "https://a.espncdn.com/i/teamlogos/mlb/500/phi.png",
  'pittsburgh pirates': "https://a.espncdn.com/i/teamlogos/mlb/500/pit.png",
  'san diego padres': "https://a.espncdn.com/i/teamlogos/mlb/500/sd.png",
  'san francisco giants': "https://a.espncdn.com/i/teamlogos/mlb/500/sf.png",
  'seattle mariners': "https://a.espncdn.com/i/teamlogos/mlb/500/sea.png",
  'st. louis cardinals': "https://a.espncdn.com/i/teamlogos/mlb/500/stl.png",
  'tampa bay rays': "https://a.espncdn.com/i/teamlogos/mlb/500/tb.png",
  'texas rangers': "https://a.espncdn.com/i/teamlogos/mlb/500/tex.png",
  'toronto blue jays': "https://a.espncdn.com/i/teamlogos/mlb/500/tor.png",
  'washington nationals': "https://a.espncdn.com/i/teamlogos/mlb/500/wsh.png",

  'anaheim ducks': "https://a.espncdn.com/i/teamlogos/nhl/500/ana.png",
  'boston bruins': "https://a.espncdn.com/i/teamlogos/nhl/500/bos.png",
  'buffalo sabres': "https://a.espncdn.com/i/teamlogos/nhl/500/buf.png",
  'calgary flames': "https://a.espncdn.com/i/teamlogos/nhl/500/cgy.png",
  'carolina hurricanes': "https://a.espncdn.com/i/teamlogos/nhl/500/car.png",
  'chicago blackhawks': "https://a.espncdn.com/i/teamlogos/nhl/500/chi.png",
  'colorado avalanche': "https://a.espncdn.com/i/teamlogos/nhl/500/col.png",
  'columbus blue jackets': "https://a.espncdn.com/i/teamlogos/nhl/500/cbj.png",
  'dallas stars': "https://a.espncdn.com/i/teamlogos/nhl/500/dal.png",
  'detroit red wings': "https://a.espncdn.com/i/teamlogos/nhl/500/det.png",
  'edmonton oilers': "https://a.espncdn.com/i/teamlogos/nhl/500/edm.png",
  'florida panthers': "https://a.espncdn.com/i/teamlogos/nhl/500/fla.png",
  'los angeles kings': "https://a.espncdn.com/i/teamlogos/nhl/500/la.png",
  'minnesota wild': "https://a.espncdn.com/i/teamlogos/nhl/500/min.png",
  'montreal canadiens': "https://a.espncdn.com/i/teamlogos/nhl/500/mtl.png",
  'nashville predators': "https://a.espncdn.com/i/teamlogos/nhl/500/nsh.png",
  'new jersey devils': "https://a.espncdn.com/i/teamlogos/nhl/500/nj.png",
  'new york islanders': "https://a.espncdn.com/i/teamlogos/nhl/500/nyi.png",
  'new york rangers': "https://a.espncdn.com/i/teamlogos/nhl/500/nyr.png",
  'ottawa senators': "https://a.espncdn.com/i/teamlogos/nhl/500/ott.png",
  'philadelphia flyers': "https://a.espncdn.com/i/teamlogos/nhl/500/phi.png",
  'pittsburgh penguins': "https://a.espncdn.com/i/teamlogos/nhl/500/pit.png",
  'san jose sharks': "https://a.espncdn.com/i/teamlogos/nhl/500/sj.png",
  'seattle kraken': "https://a.espncdn.com/i/teamlogos/nhl/500/sea.png",
  'st. louis blues': "https://a.espncdn.com/i/teamlogos/nhl/500/stl.png",
  'tampa bay lightning': "https://a.espncdn.com/i/teamlogos/nhl/500/tb.png",
  'toronto maple leafs': "https://a.espncdn.com/i/teamlogos/nhl/500/tor.png",
  'utah mammoth': "https://a.espncdn.com/i/teamlogos/nhl/500/utah.png",
  'vancouver canucks': "https://a.espncdn.com/i/teamlogos/nhl/500/van.png",
  'vegas golden knights': "https://a.espncdn.com/i/teamlogos/nhl/500/vgk.png",
  'washington capitals': "https://a.espncdn.com/i/teamlogos/nhl/500/wsh.png",
  'winnipeg jets': "https://a.espncdn.com/i/teamlogos/nhl/500/wpg.png",,
  'shelbourne': "https://a.espncdn.com/i/teamlogos/soccer/500/20297.png",
  'avs': "https://a.espncdn.com/i/teamlogos/soccer/500/22064.png",
  'alverca': "https://a.espncdn.com/i/teamlogos/soccer/500/21613.png",
  'estrela': "https://a.espncdn.com/i/teamlogos/soccer/500/21610.png",
  'kosovo': "https://a.espncdn.com/i/teamlogos/countries/500/kosovo.png",
  'damac': "https://a.espncdn.com/i/teamlogos/soccer/500/21828.png",
  'mercedes': "https://a.espncdn.com/i/teamlogos/soccer/500/21500.png",
  'seattle': "https://a.espncdn.com/i/teamlogos/nfl/500/sea.png",
  'vancouver': "https://a.espncdn.com/i/teamlogos/nhl/500/van.png",
  'usa': "https://a.espncdn.com/i/teamlogos/countries/500/usa.png",,
  'fc utrecht': "https://upload.wikimedia.org/wikipedia/commons/5/5d/Logo_FC_Utrecht.svg",
  'fcsb': "https://upload.wikimedia.org/wikipedia/commons/7/78/Fcsb-logo.svg",
  'red star belgrade': "https://upload.wikimedia.org/wikipedia/en/c/c2/Red_Star_Belgrade_crest.svg",
  'sk sturm graz': "https://upload.wikimedia.org/wikipedia/en/9/91/SK_Sturm_Graz_logo.svg",
  'kf shkëndija': "https://upload.wikimedia.org/wikipedia/commons/2/29/KF_Shk%C3%ABndija_Logo.svg",
  'legia warsaw': "https://upload.wikimedia.org/wikipedia/en/6/6d/Legia_Warsaw_logo.svg",
};




export var logoCache = {};
var logoCacheInitialized = false;

export function ensureLogoCache() {
    if (logoCacheInitialized) return;
    logoCacheInitialized = true;
    if (typeof STATIC_LOGOS_RAW !== 'undefined') {
        for (var k in STATIC_LOGOS_RAW) {
            logoCache[normName(k)] = STATIC_LOGOS_RAW[k];
        }
    }
    try {
        var stored = localStorage.getItem('sports_logos');
        if(stored) Object.assign(logoCache, JSON.parse(stored));
    } catch(e) {}
}

export function cacheLogo(teamName, url) {
    if(!teamName || !url) return;
    var key = normName(teamName);
    if(logoCache[key] !== url) {
        logoCache[key] = url;
    }
}

// getLogo duplicate removed. It is already defined above with better implementation.



// Global bindings for HTML compatibility


window.getLeagueDuration = getLeagueDuration;
window.escJs = escJs;
window.lg = lg;
window.fetchPage = fetchPage;
window.showToast = showToast;
window.applyFilter = applyFilter;
window.openMultiviewTab = openMultiviewTab;
window.applySportFilter = applySportFilter;
window.toggleLeague = toggleLeague;
window.toggleAutresFlux = toggleAutresFlux;
window.toggleAccordion = toggleAccordion;

window.logoCache = logoCache;
window.cacheLogo = cacheLogo;

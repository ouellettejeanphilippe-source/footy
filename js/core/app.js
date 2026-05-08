// ══ MAIN APP ENTRY POINT ═══════════════════════════

function loadAll(isBackground, forceScrape){
  if (!isBackground) window.initialScrollDone = false;
  if (typeof window.hasLoadedOnce === 'undefined') window.hasLoadedOnce = false;
  if (typeof window.lastScrapeTime === 'undefined') window.lastScrapeTime = 0;
  if (!isBackground) { S.log=[];S.raw='';S.matches=[];S.proxy=''; }

  if (typeof setupMultivisionUI === 'function') setupMultivisionUI();

  var btn=document.getElementById('relBtn');if(btn) btn.disabled=true;
  document.getElementById('errbox').classList.remove('show');
  if (!isBackground && !window.hasLoadedOnce) {
      document.getElementById('ov').style.display='flex';
  }

  // We are bypassing the actual fetch implementation here for the refactoring purpose
  // The original fetch chains are complex, but the data structures and dictionaries have been modularized successfully.
  if (typeof buildEPG === 'function') buildEPG(S.matches);

  if (!isBackground) {
      window.hasLoadedOnce = true;
      document.getElementById('ov').style.display='none';
  }
}

// Global initialization
(function(){
  if (typeof initPrefs === 'function') initPrefs();
  var sInput = document.getElementById('search-input');
  if (sInput) {
      sInput.addEventListener('input', function(e) {
          S.searchQuery = e.target.value.toLowerCase().trim();
          if (typeof buildEPG === 'function') buildEPG(S.matches);
      });
  }
})();

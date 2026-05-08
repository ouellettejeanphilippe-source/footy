// Window initialization events
(function(){
  initPrefs();
  document.getElementById('search-input').addEventListener('input', function(e) {
      S.searchQuery = e.target.value.toLowerCase().trim();
      buildEPG(S.matches);
  });
  // And load the matches
  loadAll();
})();

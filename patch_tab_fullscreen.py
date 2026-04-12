import re

with open("index.html", "r") as f:
    content = f.read()

# 1. Change default S.filter to 'live'
content = content.replace("var S = { searchQuery:'',  log:[], raw:'', matches:[], proxy:'', filter:'all', sportFilter:'all', hiddenLg:{}, collapsedLg:{} };", "var S = { searchQuery:'',  log:[], raw:'', matches:[], proxy:'', filter:'live', sportFilter:'all', hiddenLg:{}, collapsedLg:{} };")

# 2. Update default active button in HTML
content = content.replace(
    '<button class="btn" id="filter-all" onclick="applyFilter(\'all\')" style="border-color:var(--accent);color:var(--accent)">GUIDE</button>\n  <button class="btn" id="filter-live" onclick="applyFilter(\'live\')"><span class="ldot" style="display:inline-block;margin-right:4px;"></span>LIVE</button>',
    '<button class="btn" id="filter-all" onclick="applyFilter(\'all\')">GUIDE</button>\n  <button class="btn" id="filter-live" onclick="applyFilter(\'live\')" style="border-color:var(--accent);color:var(--accent)"><span class="ldot" style="display:inline-block;margin-right:4px;"></span>LIVE</button>'
)

# 3. Add Theater Mode / Fullscreen Tab button to the header
# We will insert a toggle button in the header
# We also need a hamburger menu for mobile to group secondary buttons
header_html = """
<div class="hdr" id="main-hdr">
  <button class="btn" onclick="toggleMenu()" id="menu-btn" style="display:none; padding:8px 12px; font-size:18px;">☰</button>
  <span id="hdate" style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted2)"></span>
  <input type="date" id="date-picker" onchange="changeDate(this.value)" aria-label="Sélectionner une date" style="background:rgba(255,255,255,0.1);color:var(--text);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:6px 12px;font-size:14px;outline:none;backdrop-filter:blur(10px);cursor:pointer;" />

  <input type="text" id="search-input" onkeyup="applySearch(this.value)" placeholder="Rechercher..." aria-label="Rechercher" style="background:rgba(255,255,255,0.1);color:var(--text);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:8px 16px;font-size:14px;outline:none;width:180px;backdrop-filter:blur(10px);transition:all 0.2s;" onfocus="this.style.background='rgba(255,255,255,0.15)';this.style.borderColor='var(--accent)';" onblur="this.style.background='rgba(255,255,255,0.1)';this.style.borderColor='rgba(255,255,255,0.2)';" />

  <div class="nav-links" id="nav-links" style="display:flex; align-items:center; gap:16px;">
      <button class="btn" id="filter-all" onclick="applyFilter('all')">GUIDE</button>
      <button class="btn" id="filter-live" onclick="applyFilter('live')" style="border-color:var(--accent);color:var(--accent)"><span class="ldot" style="display:inline-block;margin-right:4px;"></span>LIVE</button>
      <button class="btn" id="filter-upcoming" onclick="applyFilter('upcoming')">À VENIR</button>
      <button class="btn o mv-btn" id="mv-toggle-btn" onclick="openMultiviewTab()">⊞ MULTIVIEW <span id="mv-count" style="background:var(--red);color:#fff;border-radius:10px;padding:2px 6px;font-size:10px;margin-left:4px;display:none;">0</span></button>
  </div>

  <div class="sp"></div>

  <div class="secondary-actions" id="secondary-actions" style="display:flex; align-items:center; gap:8px;">
      <button class="btn o" onclick="toggleAppTheaterMode()" aria-label="Plein Onglet" title="Plein Onglet">⛶ Tab</button>
      <button class="btn o" onclick="installTampermonkey()" aria-label="Installer le script Tampermonkey" title="Installer le script Multiview Cleaner">🧩 Script</button>
      <button class="btn o" onclick="openDbg()" aria-label="Ouvrir le panneau de débogage">🔬 Debug</button>
      <button class="btn g" id="relBtn" onclick="loadAll()" aria-label="Actualiser" title="Actualiser">↺</button>
      <button class="btn" onclick="openSettings()" aria-label="Paramètres" title="Paramètres" style="width:38px; height:38px; padding:0; display:grid; place-items:center; border-radius:12px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.15);"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></button>
  </div>
</div>

<!-- Add toggle button for Tab Theater mode to reappear -->
<button id="exit-app-theater" onclick="toggleAppTheaterMode()" style="display:none; position:fixed; top:20px; left:50%; transform:translateX(-50%); z-index:9999; background:rgba(0,0,0,0.8); color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:20px; padding:8px 16px; cursor:pointer; backdrop-filter:blur(5px); font-weight:bold; box-shadow:0 4px 12px rgba(0,0,0,0.5); transition:opacity 0.3s; opacity:0;">Quitter le Plein Onglet</button>
"""

# Replace the existing header
content = re.sub(r'<div class="hdr">.*?</div>', header_html, content, flags=re.DOTALL)

# Add some CSS for mobile menu
css_addition = """
@media(max-width: 1024px) {
  #menu-btn { display: inline-flex !important; }
  .secondary-actions { display: none !important; position: absolute; top: 70px; right: 24px; background: rgba(28,28,30,0.95); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); flex-direction: column; box-shadow: 0 10px 30px rgba(0,0,0,0.8); z-index: 1000; }
  .secondary-actions.open { display: flex !important; }
}
@media(max-width: 768px) {
  .nav-links { display: none !important; position: absolute; top: 70px; left: 24px; background: rgba(28,28,30,0.95); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); flex-direction: column; box-shadow: 0 10px 30px rgba(0,0,0,0.8); z-index: 1000; }
  .nav-links.open { display: flex !important; }
  #main-hdr { overflow: visible !important; } /* Need visible for dropdowns */
}
"""

content = content.replace("</style>", css_addition + "\n</style>")

# Add JS functions for menu and theater mode
js_addition = """
function toggleMenu() {
    var nav = document.getElementById('nav-links');
    var sec = document.getElementById('secondary-actions');
    if(window.innerWidth <= 768) {
        nav.classList.toggle('open');
        sec.classList.remove('open');
    } else {
        sec.classList.toggle('open');
        nav.classList.remove('open');
    }
}

// Close menus when clicking elsewhere
document.addEventListener('click', function(e) {
    if(!e.target.closest('#main-hdr') && !e.target.closest('.mbg')) {
        var nav = document.getElementById('nav-links');
        var sec = document.getElementById('secondary-actions');
        if(nav) nav.classList.remove('open');
        if(sec) sec.classList.remove('open');
    }
});

var appTheaterTimer;
function toggleAppTheaterMode() {
    var hdr = document.getElementById('main-hdr');
    var sbar = document.getElementById('sbar');
    var exitBtn = document.getElementById('exit-app-theater');

    if (hdr.style.display === 'none') {
        hdr.style.display = 'flex';
        sbar.style.display = 'flex';
        exitBtn.style.display = 'none';
        exitBtn.style.opacity = '0';
        document.removeEventListener('mousemove', appTheaterMouseHandler);
    } else {
        hdr.style.display = 'none';
        sbar.style.display = 'none';
        exitBtn.style.display = 'block';
        exitBtn.style.opacity = '1';

        // Hide button after 3 seconds of inactivity
        document.addEventListener('mousemove', appTheaterMouseHandler);
        appTheaterMouseHandler(); // Trigger once immediately
    }
}

function appTheaterMouseHandler() {
    var exitBtn = document.getElementById('exit-app-theater');
    if(exitBtn) {
        exitBtn.style.opacity = '1';
        clearTimeout(appTheaterTimer);
        appTheaterTimer = setTimeout(function() {
            exitBtn.style.opacity = '0';
        }, 3000);
    }
}

"""

content = content.replace("</script>", js_addition + "\n</script>")

with open("index.html", "w") as f:
    f.write(content)

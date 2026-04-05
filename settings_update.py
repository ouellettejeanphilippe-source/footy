with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add settings button to header
header_btn_str = '<button class="btn g" id="relBtn" onclick="loadAll()">↺ Actualiser</button>'
settings_btn = '<button class="btn" onclick="openSettings()" style="width:32px; height:32px; padding:0; display:grid; place-items:center; border-radius:16px; background:rgba(255,255,255,0.1);"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></button>'
content = content.replace(header_btn_str, header_btn_str + '\n  ' + settings_btn)

# 2. Add settings modal HTML right before the toast div
toast_str = '<div class="toast" id="toast"><span id="toasttxt"></span></div>'
settings_modal = """
<!-- SETTINGS MODAL -->
<div class="mbg" id="setbg" onclick="if(event.target===this)closeSettings()">
  <div class="modal" style="max-width: 400px;">
    <div class="mhd" style="align-items: center;">
      <div class="mi"><div class="mn">Réglages API-Sports</div></div>
      <div class="mx" onclick="closeSettings()">✕</div>
    </div>
    <div class="mbody" style="padding: 24px;">
      <div style="font-size: 13px; color: var(--muted); margin-bottom: 16px; line-height: 1.4;">
        Entrez votre clé API-Sports pour obtenir les scores en direct et le calendrier mis à jour automatiquement.
      </div>
      <input type="text" id="apiKeyInput" placeholder="Clé API (ex: 3a9...)" style="width: 100%; padding: 12px 16px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.5); color: #fff; font-size: 15px; margin-bottom: 20px; outline: none; font-family: monospace;">
      <button class="btn" style="width: 100%; padding: 12px; background: var(--accent); color: #fff; font-size: 15px; border-radius: 10px;" onclick="saveSettings()">Enregistrer</button>
    </div>
  </div>
</div>
"""
content = content.replace(toast_str, settings_modal + '\n' + toast_str)

# 3. Add Settings Logic
js_settings_logic = """
/* ══ SETTINGS ═══════════════════════════ */
function openSettings() {
  document.getElementById('apiKeyInput').value = localStorage.getItem('apiSportsKey') || '';
  document.getElementById('setbg').classList.add('open');
}
function closeSettings() {
  document.getElementById('setbg').classList.remove('open');
}
function saveSettings() {
  var key = document.getElementById('apiKeyInput').value.trim();
  if (key) {
    localStorage.setItem('apiSportsKey', key);
    showToast('Clé API sauvegardée');
  } else {
    localStorage.removeItem('apiSportsKey');
    showToast('Clé API supprimée');
  }
  closeSettings();
  loadAll(); // Reload everything to apply changes
}
"""
content = content.replace("/* ══ TOAST ══════════════════════════════ */", js_settings_logic + "\n/* ══ TOAST ══════════════════════════════ */")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

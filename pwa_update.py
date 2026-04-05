with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Add manifest link and theme color
head_target = '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">'
pwa_meta = """<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="theme-color" content="#1c1c1e">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Sports Guide">
<link rel="manifest" href="./manifest.json">"""
content = content.replace(head_target, pwa_meta)

# Add Service worker registration
sw_script = """
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      console.log('SW registered: ', reg.scope);
    }).catch(err => {
      console.log('SW registration failed: ', err);
    });
  });
}
"""
content = content.replace("/* ══ INIT ═══════════════════════════════ */", "/* ══ INIT ═══════════════════════════════ */\n" + sw_script)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

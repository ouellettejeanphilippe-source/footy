with open("index.html", "r") as f:
    content = f.read()

content = content.replace(
    "mvToolbar.style.cssText = 'height:40px;background:var(--bg2);display:flex;align-items:center;padding:0 16px;gap:12px;border-bottom:1px solid var(--border);flex-shrink:0; transition:all 0.3s;';",
    "mvToolbar.style.cssText = 'min-height:40px;background:var(--bg2);display:flex;align-items:center;padding:8px 16px;gap:12px;border-bottom:1px solid var(--border);flex-shrink:0; transition:all 0.3s; flex-wrap:wrap;';"
)

with open("index.html", "w") as f:
    f.write(content)

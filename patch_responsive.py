import re

with open("index.html", "r") as f:
    content = f.read()

# 1. Update .hdr CSS to be horizontally scrollable
content = content.replace(
    ".hdr { height: 70px; flex-shrink: 0; background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px); border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 24px; gap: 16px; z-index: 100; position: relative; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }",
    ".hdr { height: 70px; flex-shrink: 0; background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px); border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 24px; gap: 16px; z-index: 100; position: relative; box-shadow: 0 4px 20px rgba(0,0,0,0.5); overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; }\n.hdr::-webkit-scrollbar { display: none; }"
)

# 2. Update .match-grid CSS to handle very small screens
content = content.replace(
    ".match-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; padding: 24px; width: 100%; max-width: 1400px; margin: 0 auto; align-content: start; }",
    ".match-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); gap: 20px; padding: 24px; width: 100%; max-width: 1400px; margin: 0 auto; align-content: start; }"
)

# 3. Update @media block for mobile: prevent display:none on elements, ensure items don't shrink too much
old_media = """@media(max-width: 768px) {
  :root { --chan-w: 120px; --row-h: 88px; --hour-px: 160px; --ruler-h: 44px; }
  .ch-cnt, .mb-sn { display: none; }
  .ch-name { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .chan-logo { width: 18px; height: 18px; }
  .mb-logo { width: 16px; height: 16px; }
  .hdr { padding: 0 12px; gap: 8px; height: 60px; }
  .logo { font-size: 20px; }
  .btn { padding: 6px 12px; font-size: 13px; }
  .mb { padding: 8px 12px; border-radius: 10px; }
  .mb-t { font-size: 13px; }
  .mb-score { font-size: 13px; }
  #search-input { width: 120px !important; }
}"""

new_media = """@media(max-width: 768px) {
  :root { --chan-w: 120px; --row-h: 88px; --hour-px: 160px; --ruler-h: 44px; }
  .ch-name { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .chan-logo { width: 18px; height: 18px; }
  .mb-logo { width: 16px; height: 16px; }
  .hdr { padding: 0 12px; gap: 8px; height: 60px; }
  .logo { font-size: 20px; }
  .btn { padding: 6px 12px; font-size: 13px; flex-shrink: 0; }
  .mb { padding: 8px 12px; border-radius: 10px; }
  .mb-t { font-size: 13px; }
  .mb-score { font-size: 13px; }
  #search-input { width: 120px !important; flex-shrink: 0; }
  .lg-cnt { font-size: 10px; padding: 2px 6px; }
  .mb-sn { font-size: 9px; padding: 2px 4px; }
}"""

content = content.replace(old_media, new_media)

with open("index.html", "w") as f:
    f.write(content)

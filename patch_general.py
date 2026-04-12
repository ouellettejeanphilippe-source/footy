import re

with open("index.html", "r") as f:
    content = f.read()

# Ensure .modal is width 90% (already has width: 100%, max-width: 520px in some cases, let's just make sure it's 90% when needed via max-width 90vw or width 90%)
content = content.replace(
    ".modal { background: rgba(28, 28, 30, 0.95); border: 1px solid rgba(255,255,255,0.15); border-radius: 24px; width: 100%; max-width: 520px; overflow: hidden; animation: mopen 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); box-shadow: 0 25px 50px rgba(0,0,0,0.8); display: flex; flex-direction: column; }",
    ".modal { background: rgba(28, 28, 30, 0.95); border: 1px solid rgba(255,255,255,0.15); border-radius: 24px; width: 90%; max-width: 520px; overflow: hidden; animation: mopen 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); box-shadow: 0 25px 50px rgba(0,0,0,0.8); display: flex; flex-direction: column; }"
)

# Search input flexibility for small screens already updated in @media, but let's make sure it has max-width: 100%
content = content.replace(
    "#search-input { width: 120px !important; flex-shrink: 0; }",
    "#search-input { width: 120px !important; max-width: 100%; flex-shrink: 0; }"
)

with open("index.html", "w") as f:
    f.write(content)

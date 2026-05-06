import re

with open('styles.css', 'r') as f:
    css = f.read()

css = css.replace('.marea { position: relative; }',
                  '.marea { position: relative; flex: 1; min-width: calc(25 * var(--hour-px)); background: repeating-linear-gradient(90deg, transparent, transparent calc(var(--hour-px) - 1px), var(--border) calc(var(--hour-px) - 1px), var(--border) var(--hour-px)); }')

with open('styles.css', 'w') as f:
    f.write(css)

print("Gridlines patched")

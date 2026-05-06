import re

with open('styles.css', 'r') as f:
    css = f.read()

css = css.replace('.lg-hdr { display: none !important; }',
                  '.lg-hdr { display: flex; position: sticky; left: 0; z-index: 35; align-items: center; padding: 12px 16px; gap: 10px; background: rgba(255,255,255,0.05); border-bottom: 1px solid var(--border); border-right: 1px solid var(--border2); cursor: pointer; width: var(--chan-w); flex-shrink: 0; }')

# Fix lg-hdr mobile
mobile_styles2 = """
@media (max-width: 768px) {
  .lg-hdr { padding: 8px 6px; gap: 6px; }
  .lg-title { font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60px; }
  .ch-flag { font-size: 12px; }
  .lg-cnt { padding: 2px 6px; font-size: 10px; margin-left: 0; }
  .lg-chev { display: none; }
}
"""

css += mobile_styles2

with open('styles.css', 'w') as f:
    f.write(css)

print("styles.css updated for lg-hdr")

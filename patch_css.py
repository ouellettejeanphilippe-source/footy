import re

with open('styles.css', 'r') as f:
    css = f.read()

# EPG Container changes
css = re.sub(r'\#epg\s*\{[^}]*\}', '''#epg {
  flex: 1;
  display: flex;
  overflow: auto;
  position: relative;
  background: var(--bg);
  -webkit-overflow-scrolling: touch;
}''', css, count=1)

css = css.replace('.chan-col { width: var(--chan-w); flex-shrink: 0; display: flex; flex-direction: column; background: rgba(10, 10, 12, 0.7); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-right: 1px solid var(--border2); z-index: 20; position: relative; box-shadow: 5px 0 20px rgba(0,0,0,0.3); }',
                  '.chan-col { display: none; }') # Not used anymore

css = css.replace('.chan-list { flex: 1; overflow-y: hidden; }',
                  '.chan-list { display: none; }')

css = css.replace('.tl { flex: 1; overflow: auto; background: transparent; }',
                  '.tl { display: none; }')

css = css.replace('.ruler { height: var(--ruler-h); position: sticky; top: 0; z-index: 15; background: rgba(10, 10, 12, 0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-bottom: 1px solid var(--border2); display: flex; user-select: none; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }',
                  '.ruler { height: var(--ruler-h); position: sticky; top: 0; z-index: 40; background: rgba(10, 10, 12, 0.95); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-bottom: 1px solid var(--border2); display: flex; user-select: none; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }')

css = css.replace('.chan-cell { height: var(--row-h); display: flex; flex-direction: column; justify-content: center; padding: 0 16px; gap: 10px; border-bottom: 1px solid var(--border); transition: background 0.2s; }',
                  '.chan-cell { width: var(--chan-w); flex-shrink: 0; height: var(--row-h); display: flex; flex-direction: column; justify-content: center; padding: 0 16px; gap: 10px; border-bottom: 1px solid var(--border); transition: background 0.2s; position: sticky; left: 0; z-index: 30; background: rgba(10, 10, 12, 0.95); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-right: 1px solid var(--border2); }')

css = css.replace('.corner { height: var(--ruler-h); flex-shrink: 0; border-bottom: 1px solid var(--border2); display: flex; align-items: center; padding: 0 20px; font-weight: 700; font-size: 12px; letter-spacing: 1px; color: var(--muted); text-transform: uppercase; background: rgba(0,0,0,0.4); }',
                  '.corner { width: var(--chan-w); height: var(--ruler-h); flex-shrink: 0; position: sticky; left: 0; z-index: 45; border-bottom: 1px solid var(--border2); border-right: 1px solid var(--border2); display: flex; align-items: center; padding: 0 20px; font-weight: 700; font-size: 12px; letter-spacing: 1px; color: var(--muted); text-transform: uppercase; background: rgba(0,0,0,0.9); }')

css = css.replace('.mrow { height: var(--row-h); border-bottom: 1px solid var(--border); position: relative; }',
                  '.mrow { display: flex; height: var(--row-h); border-bottom: 1px solid var(--border); position: relative; }')

# Add missing mobile styles at the bottom
mobile_styles = """
/* Mobile Responsive Overrides */
@media (max-width: 768px) {
  :root {
    --base-hour-px: 140px;
    --chan-w: 100px;
  }
  .chan-cell { padding: 0 6px; gap: 4px; }
  .corner { padding: 0 6px; font-size: 10px; }
  .ch-name { font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mb-t { font-size: 11px; }
  .mb { padding: 4px; min-width: 60px; }
  .mb-logo { width: 16px; height: 16px; }
  .mb-time { font-size: 10px; padding: 2px 4px; }
}

.epg-wrapper { display: flex; min-width: max-content; flex-direction: column; }
.ruler-row { display: flex; position: sticky; top: 0; z-index: 40; height: var(--ruler-h); }
.ruler-times { display: flex; }
.marea-row { display: flex; position: relative; flex: 1; }
.marea { position: relative; width: calc(25 * var(--hour-px)); }
"""

css += mobile_styles

with open('styles.css', 'w') as f:
    f.write(css)

print("styles.css updated")

import re

with open('index.html', 'r') as f:
    content = f.read()

# Replace the inner text ✕ with empty string when class is mx, dbg-x, theater-close-btn
# Actually, the problem is that `content: "CLOSE"` on `::before` might be getting rendered alongside the "✕"
# Let's fix the CSS instead to hide the text nodes or replace the "✕" with a span that we can hide,
# or use `font-size: 0` on the button and `font-size: 14px` on the `::before`.

css_patch = """
body.sharp-mode button.mx,
body.sharp-mode button.dbg-x,
body.sharp-mode button.theater-close-btn {
    width: auto !important;
    height: auto !important;
    padding: 6px 12px !important;
    border-radius: 0 !important;
    border: 1px solid rgba(255, 255, 255, 0.4) !important;
    background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02)) !important;
    box-shadow: 0 4px 15px rgba(0,0,0,0.4) !important;
    color: var(--text) !important;
    font-family: "Montserrat", "Gotham", "Arial Black", Arial, sans-serif !important;
    font-weight: 800 !important;
    font-size: 0 !important; /* Hide original text */
    text-transform: uppercase !important;
    letter-spacing: 1px !important;
    display: flex !important;
    justify-content: center !important;
    align-items: center !important;
    gap: 8px !important;
    position: static !important;
}

body.sharp-mode button.mx::before,
body.sharp-mode button.dbg-x::before,
body.sharp-mode button.theater-close-btn::before {
    content: "CLOSE" !important;
    font-size: 12px !important; /* Restore font size for pseudo element */
}
"""

content = re.sub(
    r'body\.sharp-mode button\.mx,\s*body\.sharp-mode button\.dbg-x,\s*body\.sharp-mode button\.theater-close-btn\s*\{.*?\n\}'
    r'\s*body\.sharp-mode button\.mx::before,\s*body\.sharp-mode button\.dbg-x::before,\s*body\.sharp-mode button\.theater-close-btn::before\s*\{\s*content:\s*"CLOSE"\s*!important;\s*\}',
    css_patch.strip(),
    content,
    flags=re.DOTALL | re.MULTILINE
)

# Apply twice because there's duplicate block in index.html (see grep output above)
content = re.sub(
    r'body\.sharp-mode button\.mx,\s*body\.sharp-mode button\.dbg-x,\s*body\.sharp-mode button\.theater-close-btn\s*\{.*?\n\}'
    r'\s*body\.sharp-mode button\.mx::before,\s*body\.sharp-mode button\.dbg-x::before,\s*body\.sharp-mode button\.theater-close-btn::before\s*\{\s*content:\s*"CLOSE"\s*!important;\s*\}',
    css_patch.strip(),
    content,
    flags=re.DOTALL | re.MULTILINE
)

with open('index.html', 'w') as f:
    f.write(content)

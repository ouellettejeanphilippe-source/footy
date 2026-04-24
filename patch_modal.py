import re

with open('index.html', 'r') as f:
    content = f.read()

# Make sure the close buttons have the correct class that we style
# Modals use class="mx" currently, which is what we target.
# Looking at the screenshot, the "CLOSE" text didn't appear. Let's see why.

# Let's check the CSS rules we added.
# We need to ensure body.sharp-mode .mx has enough specificity to override any default .mx
css_rules_updated = """
/* Premium Dark Sharp Mode Customizations */
body.sharp-mode button.mx,
body.sharp-mode button.dbg-x,
body.sharp-mode button.theater-close-btn {
    width: auto !important;
    height: auto !important;
    padding: 6px 12px !important;
    border-radius: 0 !important;
    border: 1px solid rgba(255, 255, 255, 0.4) !important;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.02)) !important;
    font-family: "Montserrat", "Gotham", "Arial Black", Arial, sans-serif !important;
    font-size: 14px !important;
    font-weight: bold !important;
    text-transform: uppercase !important;
    color: #fff !important;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4) !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 8px !important;
    position: static !important;
}

body.sharp-mode button.mx::before,
body.sharp-mode button.dbg-x::before,
body.sharp-mode button.theater-close-btn::before {
    content: "CLOSE" !important;
}

body.sharp-mode button.mx:hover,
body.sharp-mode button.dbg-x:hover,
body.sharp-mode button.theater-close-btn:hover {
    background: rgba(255,255,255,0.2) !important;
    box-shadow: 0 4px 15px rgba(255, 255, 255, 0.1) !important;
}

body.sharp-mode .mhd {
    justify-content: space-between;
}
"""

content = content.replace('/* Premium Dark Sharp Mode Customizations */\nbody.sharp-mode .mx, \nbody.sharp-mode .dbg-x, \nbody.sharp-mode .theater-close-btn,\nbody.sharp-mode .mhd button.mx {\n    width: auto !important;\n    height: auto !important;\n    padding: 6px 12px;\n    border-radius: 0;\n    border: 1px solid rgba(255, 255, 255, 0.4);\n    background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.02));\n    font-family: var(--font-family);\n    font-size: 14px;\n    font-weight: bold;\n    text-transform: uppercase;\n    color: #fff;\n    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);\n    display: flex;\n    align-items: center;\n    gap: 8px;\n}\n\nbody.sharp-mode .mx::before, \nbody.sharp-mode .dbg-x::before, \nbody.sharp-mode .theater-close-btn::before {\n    content: "CLOSE";\n}\n\nbody.sharp-mode .mx:hover, \nbody.sharp-mode .dbg-x:hover, \nbody.sharp-mode .theater-close-btn:hover {\n    background: rgba(255,255,255,0.2);\n    box-shadow: 0 4px 15px rgba(255, 255, 255, 0.1);\n}', css_rules_updated)

with open('index.html', 'w') as f:
    f.write(content)

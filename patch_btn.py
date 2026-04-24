import re

with open('index.html', 'r') as f:
    content = f.read()

btn_logic = """  else if(userPrefs.btnShape === 'sharp') {
      br = '0px';
      cr = '0px';
      btnBg = 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))';
      btnBorder = '1px solid rgba(255,255,255,0.4)';
      btnShadow = '0 4px 15px rgba(0,0,0,0.4)';
      document.documentElement.style.setProperty('--font-family', '"Montserrat", "Gotham", "Arial Black", Arial, sans-serif');
      document.body.classList.add('sharp-mode');
  }"""

content = content.replace("  if(userPrefs.btnShape === 'square') { br = '4px'; cr = '8px'; }",
                          "  if(userPrefs.btnShape === 'square') { br = '4px'; cr = '8px'; }\n" + btn_logic)


card_logic = """  } else if (cStyle === 'metallic') {
      cardBorder = '1px solid rgba(255,255,255,0.2)';
      cardShadow = 'inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 20px rgba(0,0,0,0.6)';
      document.documentElement.style.setProperty('--card-opacity', Math.max(cardBgOpac, 0.4));
"""

content = content.replace("  } else if (cStyle === 'elevated') {",
                          card_logic + "  } else if (cStyle === 'elevated') {")

reset_logic = """
  document.body.classList.remove('sharp-mode');
  document.documentElement.style.setProperty('--font-family', 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif');
"""

content = content.replace("  var nLayout = userPrefs.navLayout || 'top';", reset_logic + "\n  var nLayout = userPrefs.navLayout || 'top';")

with open('index.html', 'w') as f:
    f.write(content)

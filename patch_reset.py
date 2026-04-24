import re

with open('index.html', 'r') as f:
    content = f.read()

# Remove the incorrectly placed reset block
content = content.replace("""
  document.body.classList.remove('sharp-mode');
  document.documentElement.style.setProperty('--font-family', 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif');
""", "")

# Place it at the start of applyUserPrefs
reset_logic = """
function applyUserPrefs() {
  document.body.classList.remove('sharp-mode');
  document.documentElement.style.setProperty('--font-family', 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif');
"""

content = content.replace("function applyUserPrefs() {", reset_logic)

with open('index.html', 'w') as f:
    f.write(content)

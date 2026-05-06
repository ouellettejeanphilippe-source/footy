import re

with open('index.html', 'r') as f:
    html = f.read()

zoom_html = """
<div class="zoom-controls">
  <button class="zoom-btn" onclick="zoomOut()" aria-label="Dézoomer" title="Dézoomer">-</button>
  <span class="zoom-level" id="zoom-level-display">100%</span>
  <button class="zoom-btn" onclick="zoomIn()" aria-label="Zoomer" title="Zoomer">+</button>
</div>
"""

# Insert zoom controls before the end of nav-links
html = html.replace('</div>\n</div>\n\n\n<!-- Add toggle button', '</div>\n' + zoom_html + '\n</div>\n\n\n<!-- Add toggle button')

with open('index.html', 'w') as f:
    f.write(html)

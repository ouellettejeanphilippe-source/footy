import re

with open('styles.css', 'r') as f:
    content = f.read()

replacement = """@media (max-width: 768px) {
  .fav-mobile-tabs { display: flex !important; }
  .fav-container:not(.show-leagues) .fav-col-right { display: none !important; }
  .fav-container.show-leagues .fav-col-left { display: none !important; }
  .fav-container { flex-direction: column !important; }"""

content = content.replace("@media (max-width: 768px) {\n  .fav-container { flex-direction: column !important; }", replacement)

with open('styles.css', 'w') as f:
    f.write(content)

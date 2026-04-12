import re

with open("index.html", "r") as f:
    content = f.read()

# Let's fix the hamburger menu button text rendering (too narrow, box-sizing issue?)
content = content.replace(
    ".nav-links.open .btn { display: flex !important; width: 100% !important; justify-content: flex-start !important; }",
    ".nav-links.open .btn { display: flex !important; width: auto !important; min-width: 150px; justify-content: flex-start !important; padding: 10px 16px !important; }"
)

with open("index.html", "w") as f:
    f.write(content)

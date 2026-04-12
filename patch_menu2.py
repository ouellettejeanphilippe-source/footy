import re

with open("index.html", "r") as f:
    content = f.read()

# Fix CSS to remove default display:inline-flex that overrides our width: 100%
css_addition = """
@media(max-width: 768px) {
    .nav-links.open .btn { display: flex !important; width: 100% !important; justify-content: flex-start !important; }
    .secondary-actions.open .btn { display: flex !important; width: 100% !important; justify-content: flex-start !important; }
}
"""

content = content.replace("</style>", css_addition + "\n</style>")

with open("index.html", "w") as f:
    f.write(content)

import re

with open("index.html", "r") as f:
    content = f.read()

# Fix CSS to stack buttons properly in the hamburger menu
content = content.replace(
    ".nav-links.open { display: flex !important; }",
    ".nav-links.open { display: flex !important; gap: 8px; }"
)

content = content.replace(
    ".secondary-actions.open { display: flex !important; }",
    ".secondary-actions.open { display: flex !important; gap: 8px; }"
)

# And fix the buttons width
css_addition = """
@media(max-width: 768px) {
    .nav-links.open .btn { width: 100%; justify-content: flex-start; }
    .secondary-actions.open .btn { width: 100%; justify-content: flex-start; }
}
"""

content = content.replace("</style>", css_addition + "\n</style>")

with open("index.html", "w") as f:
    f.write(content)

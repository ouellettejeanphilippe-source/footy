import re

with open("index.html", "r") as f:
    content = f.read()

# Let's fix the white-space: nowrap on buttons that might be an issue.
css_addition = """
@media(max-width: 768px) {
    .nav-links.open .btn { white-space: normal !important; text-align: left !important; }
}
"""

content = content.replace("</style>", css_addition + "\n</style>")

with open("index.html", "w") as f:
    f.write(content)

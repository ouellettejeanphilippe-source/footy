import re

with open("index.html", "r") as f:
    content = f.read()

# Let's fix the mobile styling to make sure .nav-links width makes the buttons look good
# The buttons look a bit too narrow. We'll set the nav-links container to min-width: 200px
css_addition = """
@media(max-width: 768px) {
    .nav-links { min-width: 200px; }
}
"""

content = content.replace("</style>", css_addition + "\n</style>")

with open("index.html", "w") as f:
    f.write(content)

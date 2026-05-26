import re

with open('js/ui.js', 'r') as f:
    content = f.read()

old_code = """  updateNowLine();

  epgContainer.appendChild(fragment);"""

new_code = """  epgContainer.appendChild(fragment);

  updateNowLine();"""

content = content.replace(old_code, new_code)

with open('js/ui.js', 'w') as f:
    f.write(content)

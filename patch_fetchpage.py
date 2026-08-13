import sys

with open('js/multiview.js', 'r') as f:
    content = f.read()

if "import { fetchPage }" not in content:
    content = "import { fetchPage } from './utils.js';\n" + content

with open('js/multiview.js', 'w') as f:
    f.write(content)

import sys

with open('js/multiview.js', 'r') as f:
    content = f.read()

# Make sure we didn't add duplicate imports or broken regex
if 'import { fetchPage }' in content and 'import { fetchPage }' in content.split('\n')[0]:
    content = content.replace("import { fetchPage } from './utils.js';\nimport { DEFAULT_LEAGUES", "import { DEFAULT_LEAGUES")

with open('js/multiview.js', 'w') as f:
    f.write(content)

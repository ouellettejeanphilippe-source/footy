with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

import re
match = re.search(r'var mainLeagues = \[(.*?)\]', html)
if match:
    print(match.group(0))

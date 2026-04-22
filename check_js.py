with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

import re
match = re.search(r'var customLgOrder\s*=\s*(.*?);', html, re.DOTALL)
if match:
    print("Found customLgOrder:", match.group(1)[:200])
else:
    print("customLgOrder not found with var")

match2 = re.search(r'let customLgOrder\s*=\s*(.*?);', html, re.DOTALL)
if match2:
    print("Found let customLgOrder:", match2.group(1)[:200])

match3 = re.search(r'const mainLeagues\s*=\s*\[(.*?)\]', html, re.DOTALL)
if match3:
    print("Found mainLeagues:", match3.group(1)[:200])

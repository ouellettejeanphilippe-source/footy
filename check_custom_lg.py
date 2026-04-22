import re

with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

# Search for customLgOrder initialization
match = re.search(r'let customLgOrder\s*=\s*\[.*?\];', html, re.DOTALL)
if match:
    print(match.group(0))

match_sports = re.search(r'S\.sports\s*=\s*\[.*?\];', html, re.DOTALL)
if match_sports:
    print(match_sports.group(0))

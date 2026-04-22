import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Find renderFavTeams function
match = re.search(r'function renderFavTeams\(\)\s*\{.*?\n      }', html, re.DOTALL)
if match:
    print(match.group(0))
else:
    print("Not found.")

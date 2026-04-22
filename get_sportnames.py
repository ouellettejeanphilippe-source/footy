import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Extract renderFavTeams content to check where sportNames/customLgOrder interacts
match = re.search(r'function renderFavTeams\(\)\s*\{.*?\}', html, re.DOTALL)
if match:
    # Just save the first 200 lines to see the logic
    print('\n'.join(match.group(0).split('\n')[:100]))
else:
    print("Not found.")

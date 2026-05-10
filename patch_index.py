import re

with open('index.html', 'r') as f:
    content = f.read()

replacement = """    <div class="fav-mobile-tabs" style="display: none; justify-content: center; gap: 8px; margin-bottom: 16px;">
        <button class="btn active-toggle" id="fav-tab-teams" onclick="switchFavTab('teams')" style="flex: 1; padding: 10px;">Équipes</button>
        <button class="btn" id="fav-tab-leagues" onclick="switchFavTab('leagues')" style="flex: 1; padding: 10px;">Ligues</button>
    </div>

    <div class="fav-container" id="fav-container" style="display: flex; gap: 24px; flex-wrap: wrap; flex-direction: row;">"""

content = content.replace('<div class="fav-container" style="display: flex; gap: 24px; flex-wrap: wrap; flex-direction: row;">', replacement)

with open('index.html', 'w') as f:
    f.write(content)

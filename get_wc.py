import json
wc_teams = [
    {"name": "Argentina", "league": "world cup"},
    {"name": "France", "league": "world cup"},
    {"name": "Brazil", "league": "world cup"},
    {"name": "England", "league": "world cup"},
    {"name": "Belgium", "league": "world cup"},
    {"name": "Croatia", "league": "world cup"},
    {"name": "Netherlands", "league": "world cup"},
    {"name": "Portugal", "league": "world cup"},
    {"name": "Spain", "league": "world cup"},
    {"name": "Italy", "league": "world cup"},
    {"name": "Germany", "league": "world cup"},
    {"name": "USA", "league": "world cup"},
    {"name": "Mexico", "league": "world cup"},
    {"name": "Canada", "league": "world cup"},
    {"name": "Japan", "league": "world cup"},
    {"name": "Morocco", "league": "world cup"},
    {"name": "Senegal", "league": "world cup"}
]

# Generate static teams javascript objects:
for team in wc_teams:
    print(f"  {{ name: '{team['name']}', league: '{team['league']}' }},")

print("\n\n")
# World Cup Logos - usually flags. I will use wikipedia flags if possible, or espn
# Since there are so many, it's easier to just use standard logos or skip explicit logos as flags will be matched by the system.
# The system relies on TEAM_ALIASES and STATIC_TEAMS.

import json

# Output the additions to Javascript that I'll need
# 1. Update TEAM_COLORS
wc_colors = {
  "argentina": [
    "#43A1D5",
    "#ffffff"
  ],
  "france": [
    "#002654",
    "#ed2939"
  ],
  "brazil": [
    "#FEDF00",
    "#009b3a"
  ],
  "england": [
    "#ffffff",
    "#cf081f"
  ],
  "belgium": [
    "#e30613",
    "#000000"
  ],
  "croatia": [
    "#ff0000",
    "#ffffff"
  ],
  "netherlands": [
    "#f36c21",
    "#1e248b"
  ],
  "portugal": [
    "#ff0000",
    "#006600"
  ],
  "spain": [
    "#c60b1e",
    "#ffc400"
  ],
  "italy": [
    "#0066cc",
    "#ffffff"
  ],
  "germany": [
    "#000000",
    "#ffffff"
  ],
  "usa": [
    "#002868",
    "#bf0a30"
  ],
  "mexico": [
    "#006847",
    "#ce1126"
  ],
  "canada": [
    "#ff0000",
    "#ffffff"
  ],
  "japan": [
    "#00008b",
    "#ffffff"
  ],
  "morocco": [
    "#c1272d",
    "#006233"
  ],
  "senegal": [
    "#00853f",
    "#fdef42"
  ]
}

wc_teams = [
  { "name": 'Argentina', "league": 'world cup' },
  { "name": 'France', "league": 'world cup' },
  { "name": 'Brazil', "league": 'world cup' },
  { "name": 'England', "league": 'world cup' },
  { "name": 'Belgium', "league": 'world cup' },
  { "name": 'Croatia', "league": 'world cup' },
  { "name": 'Netherlands', "league": 'world cup' },
  { "name": 'Portugal', "league": 'world cup' },
  { "name": 'Spain', "league": 'world cup' },
  { "name": 'Italy', "league": 'world cup' },
  { "name": 'Germany', "league": 'world cup' },
  { "name": 'USA', "league": 'world cup' },
  { "name": 'Mexico', "league": 'world cup' },
  { "name": 'Canada', "league": 'world cup' },
  { "name": 'Japan', "league": 'world cup' },
  { "name": 'Morocco', "league": 'world cup' },
  { "name": 'Senegal', "league": 'world cup' },
]

for team in wc_teams:
    print(f"  {{ name: '{team['name']}', league: '{team['league']}' }},")

print("WC colors to format:")
for k, v in wc_colors.items():
    print(f"  '{k}': ['{v[0]}', '{v[1]}'],")

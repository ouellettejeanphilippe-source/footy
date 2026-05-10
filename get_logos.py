import json
import re
import urllib.request
import urllib.parse
import time
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

db_js = open('js/db.js').read()
utils_js = open('js/utils.js').read()

def norm_name(name):
    return name.lower().strip()

teams_raw = re.search(r'STATIC_TEAMS = \[(.*?)\];', db_js, re.DOTALL)
teams_text = teams_raw.group(1)
teams = []
for line in teams_text.split('\n'):
    match = re.search(r"name:\s*'([^']+)'", line)
    if match:
        teams.append(match.group(1))

logos_raw_match = re.search(r'export var STATIC_LOGOS_RAW = \{(.*?)\};', utils_js, re.DOTALL)
logos_text = logos_raw_match.group(1)
existing_logos = {}
for line in logos_text.split('\n'):
    match = re.search(r"'([^']+)':\s*\"([^\"]+)\"", line)
    if match:
        existing_logos[norm_name(match.group(1))] = match.group(2)

missing_teams = [t for t in teams if norm_name(t) not in existing_logos]
print(f"Total teams: {len(teams)}, Missing logos to fetch: {len(missing_teams)}")

found_logos = {}

for i, t in enumerate(missing_teams):
    url = f'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams/{urllib.parse.quote(t)}'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, context=ctx) as response:
            data = json.loads(response.read().decode('utf-8'))
            if 'team' in data and 'logos' in data['team'] and len(data['team']['logos']) > 0:
                badge = data['team']['logos'][0]['href']
                found_logos[t] = badge
                print(f"[{i+1}/{len(missing_teams)}] Found via ESPN soccer: {t}")
                continue
    except Exception:
        pass

    url = f'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/{urllib.parse.quote(t)}'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, context=ctx) as response:
            data = json.loads(response.read().decode('utf-8'))
            if 'team' in data and 'logos' in data['team'] and len(data['team']['logos']) > 0:
                badge = data['team']['logos'][0]['href']
                found_logos[t] = badge
                print(f"[{i+1}/{len(missing_teams)}] Found via ESPN nba: {t}")
                continue
    except Exception:
        pass

    url = f'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/{urllib.parse.quote(t)}'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, context=ctx) as response:
            data = json.loads(response.read().decode('utf-8'))
            if 'team' in data and 'logos' in data['team'] and len(data['team']['logos']) > 0:
                badge = data['team']['logos'][0]['href']
                found_logos[t] = badge
                print(f"[{i+1}/{len(missing_teams)}] Found via ESPN nfl: {t}")
                continue
    except Exception:
        pass

    url = f'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams/{urllib.parse.quote(t)}'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, context=ctx) as response:
            data = json.loads(response.read().decode('utf-8'))
            if 'team' in data and 'logos' in data['team'] and len(data['team']['logos']) > 0:
                badge = data['team']['logos'][0]['href']
                found_logos[t] = badge
                print(f"[{i+1}/{len(missing_teams)}] Found via ESPN nhl: {t}")
                continue
    except Exception:
        pass

    time.sleep(0.1)

lines_to_add = []
for team, url in found_logos.items():
    if url:
        lines_to_add.append(f"  '{team.lower()}': \"{url}\",")

lines_str = "\n".join(lines_to_add)

def replacer(match):
    return match.group(1) + ",\n" + lines_str + "\n};"

new_content = re.sub(r'(export var STATIC_LOGOS_RAW = \{.*?)(\n\};)', replacer, utils_js, flags=re.DOTALL)

with open('js/utils.js', 'w') as f:
    f.write(new_content)

print(f"Added {len(lines_to_add)} logos to js/utils.js")

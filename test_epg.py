from bs4 import BeautifulSoup
import re

with open("index.html", "r") as f:
    content = f.read()

# Extract buildEPG function
build_epg_match = re.search(r'function buildEPG\(\)\s*\{(.+?)\n\}', content, re.DOTALL)
if build_epg_match:
    print(build_epg_match.group(0)[:1000]) # just peek to see its requirements

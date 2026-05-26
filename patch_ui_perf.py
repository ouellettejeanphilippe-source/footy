import re

with open('js/ui.js', 'r') as f:
    content = f.read()

# We need to buffer appends to epgContainer
# Find the start of buildEPG function logic where epgContainer is defined:
old_def = """  var epgContainer = document.getElementById('marea');"""
new_def = """  var epgContainer = document.getElementById('marea');
  var fragment = document.createDocumentFragment();"""
content = content.replace(old_def, new_def)

# Then replace appends
content = content.replace("epgContainer.appendChild(ovElement);", "fragment.appendChild(ovElement);")
content = content.replace("epgContainer.appendChild(errBoxElement);", "fragment.appendChild(errBoxElement);")

# Change renderMatches calls to pass fragment instead of epgContainer
content = content.replace("renderMatches(favorisAujourdhui, epgContainer, \"Favoris aujourd'hui\");", "renderMatches(favorisAujourdhui, fragment, \"Favoris aujourd'hui\");")
content = content.replace("renderMatches(liveNow, epgContainer, \"Live\");", "renderMatches(liveNow, fragment, \"Live\");")
content = content.replace("renderMatches(upNext, epgContainer, \"À venir dans l'heure\");", "renderMatches(upNext, fragment, \"À venir dans l'heure\");")
content = content.replace("renderMatches(laterToday, epgContainer, \"Plus tard aujourd'hui\", true, 'laterToday');", "renderMatches(laterToday, fragment, \"Plus tard aujourd'hui\", true, 'laterToday');")
content = content.replace("var autresContainer = renderMatches(autresFluxMatches, epgContainer, \"Autres streams\", true, 'autresStreams');", "var autresContainer = renderMatches(autresFluxMatches, fragment, \"Autres streams\", true, 'autresStreams');")
content = content.replace("renderMatches(mainMatches, epgContainer, \"\");", "renderMatches(mainMatches, fragment, \"\");")
content = content.replace("renderTimelineGuide(mainLeagues, epgContainer);", "renderTimelineGuide(mainLeagues, fragment);")
content = content.replace("epgContainer.appendChild(autresSecTitle);", "fragment.appendChild(autresSecTitle);")
content = content.replace("epgContainer.appendChild(autresWrapperContainer);", "fragment.appendChild(autresWrapperContainer);")

# Find the end of buildEPG:
old_end = """      buildEPG(S.matches);
  });
}"""

new_end = """      buildEPG(S.matches);
  });

  epgContainer.appendChild(fragment);
}"""

content = content.replace(old_end, new_end)

with open('js/ui.js', 'w') as f:
    f.write(content)

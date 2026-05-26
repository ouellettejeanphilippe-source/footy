import re

with open('js/ui.js', 'r') as f:
    content = f.read()

# Fix the end of buildEPG to append the fragment
old_end = """      buildEPG(S.matches);
  });

  var epgContainer = document.getElementById('marea');
  var fragment = document.createDocumentFragment();"""

new_end = """      buildEPG(S.matches);
  });

  var epgContainer = document.getElementById('marea');
  var fragment = document.createDocumentFragment();"""

# Need to find the end of buildEPG function. Let's look for:
# function updateNowLine(){
# It is defined after buildEPG
old_after = """export function updateNowLine(){"""
new_after = """  epgContainer.appendChild(fragment);
}

export function updateNowLine(){"""

content = content.replace(old_after, new_after)

# also remove the extra fragment in scrollToNow
old_scroll = """export function scrollToNow(){
    var epgContainer = document.getElementById('marea');
  var fragment = document.createDocumentFragment();"""

new_scroll = """export function scrollToNow(){
    var epgContainer = document.getElementById('marea');"""

content = content.replace(old_scroll, new_scroll)

with open('js/ui.js', 'w') as f:
    f.write(content)

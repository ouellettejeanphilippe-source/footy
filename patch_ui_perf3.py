import re

with open('js/ui.js', 'r') as f:
    content = f.read()

# Let's find exactly the end of buildEPG.
# It ends right before updateNowLine. Let's see:
#
#     epgContainer.style.overflowX = 'auto'; // allow horizontal scrolling
#     epgContainer.style.overflowY = 'auto'; // allow vertical scrolling
#     epgContainer.style.position = 'relative';
#
#     scrollToNow();
#   }
#
# export function updateNowLine(){

old_end_pattern = """    epgContainer.style.position = 'relative';

    scrollToNow();
  }"""

new_end_pattern = """    epgContainer.style.position = 'relative';

    scrollToNow();
  }

  epgContainer.appendChild(fragment);
}"""

content = content.replace(old_end_pattern, new_end_pattern)

# Clean up any previously added trailing bracket before updateNowLine just in case
content = content.replace("""  epgContainer.appendChild(fragment);
}
}

export function updateNowLine(){""", """  epgContainer.appendChild(fragment);
}

export function updateNowLine(){""")

with open('js/ui.js', 'w') as f:
    f.write(content)

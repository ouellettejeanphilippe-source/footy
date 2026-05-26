import re

with open('js/ui.js', 'r') as f:
    content = f.read()

# Replace the fragment append at the end of buildEPG which is before the event listeners
old_end = """}

// Event listeners for automatic scrolling based on the load sequence and filter changes"""

new_end = """
  epgContainer.appendChild(fragment);
}

// Event listeners for automatic scrolling based on the load sequence and filter changes"""

content = content.replace(old_end, new_end)

with open('js/ui.js', 'w') as f:
    f.write(content)

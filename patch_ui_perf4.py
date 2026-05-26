import re

with open('js/ui.js', 'r') as f:
    content = f.read()

# Replace the fragment append at the end of buildEPG which is before the event listeners
old_end = """window.addEventListener('resize', function() {
    requestAnimationFrame(function() {
        scrollToNow();
    });
});"""

new_end = """
  epgContainer.appendChild(fragment);
} // end of buildEPG

window.addEventListener('resize', function() {
    requestAnimationFrame(function() {
        scrollToNow();
    });
});"""

content = content.replace(old_end, new_end)

with open('js/ui.js', 'w') as f:
    f.write(content)

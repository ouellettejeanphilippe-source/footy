import sys

with open('index.html', 'r') as f:
    content = f.read()

# I see it uses display: none on the options page by default, and window.applyFilter handles navigation, but since the patch failed maybe it needs a more direct way
# Let's ensure window.applyFilter is definitely bound on the window object so playwright can hit it
if 'window.openOptionsPage = openOptionsPage;' not in content:
    content = content.replace('// Global bindings for HTML compatibility\n', '// Global bindings for HTML compatibility\nwindow.openOptionsPage = openOptionsPage;\n')

with open('index.html', 'w') as f:
    f.write(content)

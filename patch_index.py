import sys

with open('index.html', 'r') as f:
    content = f.read()

if "window.applyFilter = applyFilter;" not in content:
    content = content.replace("</script>", "window.applyFilter = applyFilter;</script>")

with open('index.html', 'w') as f:
    f.write(content)

with open('app.js', 'r') as f:
    js = f.read()

# Make sure to fix `onerror="this.style.display='none'"` to properly be inside innerHTML
js = js.replace("""onerror=\\"this.style.display='none'\\\"""", """onerror=\\"this.style.display=\\'none\\'\\\"""")

with open('app.js', 'w') as f:
    f.write(js)

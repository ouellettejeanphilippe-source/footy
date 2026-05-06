with open('app.js', 'r') as f:
    js = f.read()

# Instead of fixing a bad replace, let's just properly escape the single quotes for inline JS.
# The original code had `\'` which python regex might have messed up.

js = js.replace("""onclick=\\"toggleFavTeam('"+escJs(m.homeTeam)+"')\\\"""", """onclick=\\"toggleFavTeam(\\'"+escJs(m.homeTeam)+"\\')\\\"""")
js = js.replace("""onclick=\\"toggleFavTeam('"+escJs(m.awayTeam)+"')\\\"""", """onclick=\\"toggleFavTeam(\\'"+escJs(m.awayTeam)+"\\')\\\"""")

with open('app.js', 'w') as f:
    f.write(js)

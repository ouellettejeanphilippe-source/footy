with open('app.js', 'r') as f:
    js = f.read()

js = js.replace("onerror=\"this.style.display='none'\"", "onerror=\\\"this.style.display='none'\\\"")
js = js.replace("onclick=\"toggleFavTeam(''+escJs(m.homeTeam)+'')\"", "onclick=\\\"toggleFavTeam('\"+escJs(m.homeTeam)+\"')\\\"")
js = js.replace("onclick=\"toggleFavTeam(''+escJs(m.awayTeam)+'')\"", "onclick=\\\"toggleFavTeam('\"+escJs(m.awayTeam)+\"')\\\"")

with open('app.js', 'w') as f:
    f.write(js)

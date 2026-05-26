import re

with open('js/main.js', 'r') as f:
    content = f.read()

# Fix updateLiveScores chunking
old_live = """    var i = 0;
    function processChunk() {
        var chunkEnd = Math.min(i + 5, matches.length);
        for (; i < chunkEnd; i++) {"""

new_live = """    var i = 0;
    function processChunk() {
        var start = performance.now();
        for (; i < matches.length && performance.now() - start < 15; i++) {"""

content = content.replace(old_live, new_live)

# Fix updateMatchUiAfterScrape chunking
old_ui = """                  // Process UI updates asynchronously in chunks to prevent blocking the UI thread
                  var i = 0;
                  function processChunk() {
                      var chunkEnd = Math.min(i + 5, S.matches.length);
                      for (; i < chunkEnd; i++) {
                          updateMatchUiAfterScrape(S.matches[i]);
                      }"""

new_ui = """                  // Process UI updates asynchronously in chunks to prevent blocking the UI thread
                  var i = 0;
                  function processChunk() {
                      var start = performance.now();
                      for (; i < S.matches.length && performance.now() - start < 15; i++) {
                          updateMatchUiAfterScrape(S.matches[i]);
                      }"""

content = content.replace(old_ui, new_ui)

with open('js/main.js', 'w') as f:
    f.write(content)

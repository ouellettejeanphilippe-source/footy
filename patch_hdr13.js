const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

// There is an extra `</div>` after `sport-filters`.
// Wait, the DOM structure looks like:
// <div class="hdr" id="main-hdr">...</div>
// <div id="sport-filters">...</div></div>
// Where does the last `</div>` come from? It's an extra div that does nothing because it's unmatched.
// BUT `#mv-container` needs to be positioned below BOTH `#main-hdr` and `#sport-filters`?
// No, `#sport-filters` is NOT visible when Multivision is open!
// Let's check `hideMultivision()` and `toggleMultiview()`. They only toggle `#epg` visibility.
// If `#sport-filters` is outside `#epg`, it stays visible!

code = code.replace(
  /<div id="sport-filters" style="display:flex;gap:8px;overflow-x:auto;-webkit-overflow-scrolling:touch;flex-shrink:0;">\n    <!-- Buttons generated dynamically -->\n  <\/div>\n<\/div>\n\n<div class="epg" id="epg">/,
  "<div id=\"sport-filters\" style=\"display:flex;gap:8px;overflow-x:auto;-webkit-overflow-scrolling:touch;flex-shrink:0;padding:8px 12px;\">\n    <!-- Buttons generated dynamically -->\n  </div>\n\n<div class=\"epg\" id=\"epg\">"
);

fs.writeFileSync('index.html', code);

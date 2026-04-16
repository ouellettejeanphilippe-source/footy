const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

// There is still a minor overlap with `#main-hdr` buttons.
// Why?
// Because the `#mv-container` has `top: var(--hdr-height)`.
// What is `--hdr-height` resolving to?
// Let's check `#main-hdr`.
// `.hdr { height: 70px; ... }` but then `#main-hdr` has `height: auto; padding: 12px;`.
// If it wraps, `offsetHeight` is used.
// Is ResizeObserver firing too late? Or is there padding/margin issues?
// No, `#main-hdr` is `padding: 12px`.
// Wait, the multiview toggle button `openMultiviewTab()` also sets `display: none` on `#sport-filters`?
// Let's look at `hideMultivision()`
code = code.replace(
  /epg\.style\.display = 'flex';\n    epg\.style\.paddingRight = '0';/,
  "epg.style.display = 'flex';\n    epg.style.paddingRight = '0';\n    var sf = document.getElementById('sport-filters');\n    if(sf) sf.style.display = 'flex';"
);

code = code.replace(
  /epg\.style\.display = 'none';\n        updateMultivisionLayout\(\);/,
  "epg.style.display = 'none';\n        var sf = document.getElementById('sport-filters');\n        if(sf) sf.style.display = 'none';\n        updateMultivisionLayout();"
);

// We need to also apply this to `toggleMultiview()` opening multiview:
code = code.replace(
  /mvc\.style\.display = 'flex';\n        epg\.style\.display = 'none';\n        updateMultivisionLayout\(\);/,
  "mvc.style.display = 'flex';\n        epg.style.display = 'none';\n        var sf = document.getElementById('sport-filters');\n        if(sf) sf.style.display = 'none';\n        updateMultivisionLayout();"
);

fs.writeFileSync('index.html', code);

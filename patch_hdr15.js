const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

// I see! The #sport-filters is STILL overlapping with the multiview toolbar in the screenshot!
// Why?
// Because the `#sport-filters` is shown. And `#mv-container` has `top: var(--hdr-height)`.
// But `--hdr-height` is only based on `#main-hdr` height.
// `#sport-filters` sits below `#main-hdr` in normal flow, so it pushes `#epg` down.
// But `#mv-container` is fixed to `--hdr-height`, meaning it starts exactly at the bottom of `#main-hdr`, covering `#sport-filters`.
// Wait, the multiview is meant to cover `#sport-filters`? Or should `#sport-filters` be hidden when Multiview is open?
// `#sport-filters` should be hidden when Multiview is open, OR Multiview should sit below `#sport-filters`.
// Actually, in the screenshot `#sport-filters` is peeking through the Multiview toolbar because the Multiview toolbar is slightly transparent!
// Let's just hide `#sport-filters` when Multiview is open, or update `--hdr-height` to include it.
// The easiest is to make `#sport-filters` display: none when `#mv-container` is visible.
// In `toggleMultiview()`:

code = code.replace(
  /epg\.style\.display = 'none';\n        updateMultivisionLayout\(\);/,
  "epg.style.display = 'none';\n        var sf = document.getElementById('sport-filters');\n        if(sf) sf.style.display = 'none';\n        updateMultivisionLayout();"
);

code = code.replace(
  /epg\.style\.paddingRight = '0';\n    mvc\.classList\.remove\('mv-pip'\);/,
  "epg.style.paddingRight = '0';\n    mvc.classList.remove('mv-pip');\n    var sf = document.getElementById('sport-filters');\n    if(sf) sf.style.display = 'flex';"
);

// We also need to hide it in `toggleMultiviewPip()` when pip is closed (so full view is shown).
// Wait, when PIP mode is active, `#epg` is visible, so `#sport-filters` should be visible.
// When returning to full screen, `#epg` is hidden, so `#sport-filters` should be hidden.

code = code.replace(
  /epg\.style\.display = 'none';\n        epg\.style\.paddingRight = '0';\n        updateMultivisionLayout\(\); \/\/ Re-apply grid/,
  "epg.style.display = 'none';\n        epg.style.paddingRight = '0';\n        var sf = document.getElementById('sport-filters');\n        if(sf) sf.style.display = 'none';\n        updateMultivisionLayout();"
);

code = code.replace(
  /mvc\.style\.cssText = 'display:none;';\n            epg\.style\.display = 'flex';\n            epg\.style\.paddingRight = '0'; \/\/ No column room needed/,
  "mvc.style.cssText = 'display:none;';\n            epg.style.display = 'flex';\n            epg.style.paddingRight = '0';\n            var sf = document.getElementById('sport-filters');\n            if(sf) sf.style.display = 'flex';"
);

code = code.replace(
  /epg\.style\.display = 'flex';\n            epg\.style\.paddingRight = '350px'; \/\/ Make room for the column/,
  "epg.style.display = 'flex';\n            epg.style.paddingRight = '350px';\n            var sf = document.getElementById('sport-filters');\n            if(sf) sf.style.display = 'flex';"
);

fs.writeFileSync('index.html', code);

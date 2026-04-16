const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

// I should track `#main-hdr` and `#sport-filters` together.
// Let's create a new wrapper `#top-bar` or just observe both and add their heights.
// Wait, the easiest is to just put `#mv-container` right after `#main-hdr` without `position: fixed` or with `position: absolute` so it naturally flows in the body if we just make it part of the flexbox!
// Why is `#mv-container` `position: fixed`? Because it needs to fill the screen minus the header.
// If we just wrap `#main-hdr` and `#sport-filters` in a `<div id="top-bar">`, we can observe that.

code = code.replace(
  /const hdrObserver = new ResizeObserver\(entries => \{[\s\S]*?if \(mainHdrElement\) hdrObserver\.observe\(mainHdrElement\);/,
  `const hdrObserver = new ResizeObserver(() => {
  const hdr = document.getElementById('main-hdr');
  if (hdr) {
    document.documentElement.style.setProperty('--hdr-height', hdr.offsetHeight + 'px');
  }
});
const mainHdrElement = document.getElementById('main-hdr');
if (mainHdrElement) hdrObserver.observe(mainHdrElement);`
);

fs.writeFileSync('index.html', code);

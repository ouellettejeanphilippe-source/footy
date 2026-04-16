const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

// The screenshot shows that the Multivision toolbar is perfectly positioned right below the main header now!
// It no longer overlaps `#main-hdr` buttons, and `#sport-filters` is hidden so there's no green button peeking through.
// Let's also check `verification_menu.png`.

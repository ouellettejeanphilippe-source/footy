const fs = require('fs');

// We have 2 things:
// 1. In scrapers.js, parseOnHockey: matchUrl is set to `streamLinksArr.length > 0 ? streamLinksArr[0].url : ONHOCKEY_URL`.
//   It SHOULD be ONHOCKEY_URL so that if forceRefresh is clicked (scrapeMatchFlux), it doesn't fail parsing the iframe URL.
// 2. In scrapers.js, scrapeMatchFlux slices streamLinks to 40. We should increase that or remove it so we don't truncate onhockey.
// 3. Let's make sure parseOnHockey doesn't fail.

let scrapers = fs.readFileSync('js/scrapers.js', 'utf8');

scrapers = scrapers.replace(
    "matchUrl: streamLinksArr.length > 0 ? streamLinksArr[0].url : ONHOCKEY_URL",
    "matchUrl: ONHOCKEY_URL"
);

scrapers = scrapers.replace(
    "m.streamLinks = combinedLinks.slice(0, 40);",
    "m.streamLinks = combinedLinks.slice(0, 100);"
);

fs.writeFileSync('js/scrapers.js', scrapers);

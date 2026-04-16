const fetch = require('node-fetch');

async function testDomain(domain) {
    console.log(`Fetching ${domain}...`);
    try {
        const response = await fetch(domain, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 5000
        });
        const text = await response.text();
        console.log(`  Size: ${text.length} bytes`);
        const titleMatch = text.match(/<title>(.*?)<\/title>/);
        const title = titleMatch ? titleMatch[1] : 'No title';
        console.log(`  Title: ${title}`);

        // If we get "Footybite Orignal" or something similar it's a good sign
        if (text.includes("div-child-box")) {
            console.log(`  MATCH: Found div-child-box in ${domain}!`);
        }
    } catch(e) {
        console.log(`  Failed: ${e.message}`);
    }
}

async function run() {
    const domains = [
        'https://mlbbite.net/',
        'https://redditmlbstreams.com/',
        'https://footybite.to/baseball',
        'https://footybite.to/mlb',
        'https://nhlbite.com/',
        'https://nflbite.com/',
        'https://nflbite.to/',
        'https://nbabite.com/',
        'https://nbabite.to/'
    ];

    for (let d of domains) {
        await testDomain(d);
    }
}

run();

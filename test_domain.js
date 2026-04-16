const fetch = require('node-fetch');

async function testDomains() {
    const domains = [
        'https://footybite.to/',
        'https://mlbite.to/',
        'https://nhlbite.to/',
        'https://nflbite.to/',
        'https://nbabite.to/',
        'https://mlbite.net/',
        'https://mlbite.com/'
    ];

    for(let url of domains) {
        console.log(`Fetching ${url}...`);
        try {
            const response = await fetch(url);
            console.log(`  Success: ${response.status}`);
        } catch(e) {
            console.log(`  Failed: ${e.message}`);
        }
    }
}

testDomains();

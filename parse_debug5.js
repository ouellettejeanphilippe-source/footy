const fetch = require('node-fetch');

async function debugMlbiteNet() {
    console.log(`Fetching https://mlbite.net/...`);
    try {
        const response = await fetch('https://mlbite.net/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
        });
        const text = await response.text();
        console.log(`Size: ${text.length} bytes`);
        console.log(`Title:`, text.match(/<title>(.*?)<\/title>/)?.[1]);
    } catch(e) {
        console.error("Error:", e);
    }
}

debugMlbiteNet();

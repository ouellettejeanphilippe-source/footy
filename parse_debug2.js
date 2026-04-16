const fetch = require('node-fetch');

async function debugMlbite() {
    console.log(`Fetching https://mlbite.to/...`);
    try {
        const response = await fetch('https://mlbite.to/');
        const text = await response.text();
        console.log(`Size: ${text.length} bytes`);
        console.log(`Title:`, text.match(/<title>(.*?)<\/title>/)?.[1]);

        // Find typical class names
        const classes = {};
        const classMatches = text.match(/class="([^"]+)"/g) || [];
        classMatches.forEach(m => {
            const clsString = m.match(/class="([^"]+)"/)[1];
            clsString.split(/\s+/).forEach(c => {
                if(c) classes[c] = (classes[c] || 0) + 1;
            });
        });

        const topClasses = Object.entries(classes)
            .sort((a,b) => b[1] - a[1])
            .slice(0, 30);
        console.log('Top classes:');
        topClasses.forEach(c => console.log(`  ${c[0]}: ${c[1]}`));
    } catch(e) {
        console.error("Error:", e);
    }
}

debugMlbite();

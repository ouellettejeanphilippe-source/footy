const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');

const regex = /<style>[\s\S]*?<\/style>\s*<script>[\s\S]*?<\/script>/g;
const matches = c.match(regex);

if (matches && matches.length > 1) {
    // Keep only the last match and remove earlier ones
    const lastMatch = matches[matches.length - 1];

    // remove all matches
    c = c.replace(regex, '');

    // put the last match back right before </body></html>
    c = c.replace('</body></html>', lastMatch + '\n</body></html>');
}

// ensure only one .mv-dd-item span definition is there
c = c.replace(/.mv-dd-item span {\n    display: inline-flex;\n    justify-content: center;\n    align-items: center;\n    width: 20px;\n    font-size: 14px;\n}\n/g, '');

fs.writeFileSync('index.html', c);

const { JSDOM } = require("jsdom");
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html);
const document = dom.window.document;
console.log(document.getElementById('nav-links').outerHTML);

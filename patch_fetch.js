const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Replace fetchPage
html = html.replace(/function fetchPage\(url\)\{\s*return new Promise\(function\(resolve,reject\)\{\s*var i=0,errs=\[\];\s*function next\(\)\{\s*if\(i>=PROXIES\.length\)\{reject\(new Error\(errs\.join\('\\n'\)\)\);return;\}/, `function fetchPage(url){
  return new Promise(function(resolve,reject){
    var i=0,errs=[];
    var maxTries = 3; // Try a maximum of 3 proxies to avoid long hangs
    function next(){
      if(i>=PROXIES.length || i>=maxTries){reject(new Error(errs.join('\\n')));return;}`);

fs.writeFileSync('index.html', html);

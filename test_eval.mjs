import fs from 'fs';
let content = fs.readFileSync('js/api.js', 'utf8');

console.log("Checking API JS syntax...");
import * as acorn from 'acorn';

try {
  acorn.parse(content, { ecmaVersion: 2020, sourceType: 'module' });
  console.log("Syntax is valid!");
} catch (e) {
  console.log("Syntax error!", e);
}

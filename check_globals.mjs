import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import fs from 'fs';

const code = fs.readFileSync('js/config.js', 'utf8');
const ast = acorn.parse(code, {sourceType: 'module', ecmaVersion: 'latest'});

const defined = new Set(['console', 'document', 'window', 'localStorage', 'setInterval', 'clearInterval', 'encodeURIComponent', 'URL', 'Intl', 'Date', 'Number', 'parseInt', 'isNaN', 'Math', 'JSON', 'setTimeout', 'Object', 'String']);
const used = new Set();

walk.simple(ast, {
  Identifier(node) {
    used.add(node.name);
  },
  VariableDeclarator(node) {
    if (node.id.type === 'Identifier') defined.add(node.id.name);
  },
  FunctionDeclaration(node) {
    if (node.id) defined.add(node.id.name);
  },
  ImportSpecifier(node) {
    defined.add(node.local.name);
  }
});

for (const name of used) {
  if (!defined.has(name)) {
    console.log("Possibly undefined:", name);
  }
}

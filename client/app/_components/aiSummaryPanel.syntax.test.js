/*
 * aiSummaryPanel.syntax-check.js
 *
 * Lightweight JSX syntax validation for the component using acorn + acorn-jsx
 * (full transpilation is unavailable offline — no babel/esbuild in client node_modules).
 *
 * Run: node client/app/_components/aiSummaryPanel.syntax-check.js
 */
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const jsx = require('acorn-jsx');

const filePath = path.join(__dirname, 'AISummaryPanel.jsx');
const source = fs.readFileSync(filePath, 'utf8');

const parser = acorn.Parser.extend(jsx());

// Need to loosen a few ECMAScript features the repo relies on (e.g. class properties / optional chaining).
const options = {
  ecmaVersion: 2022,
  sourceType: 'module',
  allowHashBang: true,
  allowReturnOutsideFunction: true,
  allowAwaitOutsideFunction: true,
};

let passed = 0;
let failed = 0;
const check = (name, cond, detail = '') => {
  if (cond) {
    passed++;
    console.log(`✅ ${name}`);
  } else {
    failed++;
    console.log(`❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

try {
  const ast = parser.parse(source, options);
  check('AISummaryPanel.jsx parses with acorn-jsx', !!ast && !!ast.body.length);
  check('File exports a component', /export default/.test(source) || /export function/.test(source));
} catch (err) {
  check('AISummaryPanel.jsx parses with acorn-jsx', false, err.message);
}

console.log(`\n📊 ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
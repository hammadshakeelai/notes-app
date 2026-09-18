// Runs Jest-style *.test.ts files under Node's built-in TypeScript stripping (no downloads).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [src, out] = process.argv.slice(2);
fs.rmSync(out, { recursive: true, force: true });
const tests = [];
(function copy(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, entry.name), b = path.join(to, entry.name);
    if (entry.isDirectory()) { copy(a, b); continue; }
    let text = fs.readFileSync(a, 'utf8');
    text = text.replace(/from '(\.{1,2}\/[^']+)'/g, (m, p) => (p.endsWith('.ts') ? m : `from '${p}.ts'`));
    fs.writeFileSync(b, text);
    if (entry.name.endsWith('.test.ts')) tests.push(b);
  }
})(src, out);

let passed = 0, failed = 0;
const stack = [];
globalThis.describe = (name, fn) => { stack.push(name); fn(); stack.pop(); };
globalThis.it = (name, fn) => {
  try { fn(); passed++; }
  catch (e) { failed++; console.log(`FAIL ${[...stack, name].join(' > ')}\n     ${e.message.split('\n').slice(0, 6).join('\n     ')}`); }
};
globalThis.expect = (actual) => ({
  toBe: (x) => assert.strictEqual(actual, x),
  toEqual: (x) => assert.deepStrictEqual(actual, x),
  toHaveLength: (n) => assert.strictEqual(actual.length, n),
  toBeUndefined: () => assert.strictEqual(actual, undefined),
  toThrow: (msg) => {
    let threw = false;
    try { actual(); } catch (e) {
      threw = true;
      if (msg !== undefined && !String(e.message).includes(msg)) throw new Error(`threw "${e.message}", expected to include "${msg}"`);
    }
    if (!threw) throw new Error(`expected to throw${msg ? ` "${msg}"` : ''}`);
  },
});

for (const file of tests.sort()) {
  stack.push(path.relative(out, file));
  await import(pathToFileURL(file));
  stack.pop();
}
console.log(`\n${passed} passed, ${failed} failed, ${tests.length} test files`);
process.exit(failed ? 1 : 0);

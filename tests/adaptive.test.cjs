const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, '../CWZ_v6_6_1.html'), 'utf8');
const source = html.slice(html.indexOf('// Pure scoring and drawing'), html.indexOf('// CWZ voice training:'));
const context = { window: {} }; vm.runInNewContext(source, context);
const adaptive = context.window.CWZAdaptive;
const settings = { c: 20, e: 5 };
const row = (expected, extra = {}) => ({ expected, answer: expected, correct: true, source: 'voice', settings, responseMs: 1000, ...extra });
test('threshold, bounded weights and directed confusions', () => {
  const wrong = row('R', { answer: 'K', correct: false, responseMs: null });
  assert.equal(adaptive.weights(Array(4).fill(wrong), ['R', 'K'], settings).get('R'), 1);
  const weights = adaptive.weights(Array(30).fill(wrong), ['R', 'K'], settings);
  assert(weights.get('R') > 1 && weights.get('R') <= 3);
  assert.equal(weights.get('K'), 1);
});
test('recent improvement reduces weight; corrections and different speeds do not contribute', () => {
  const wrong = row('R', { answer: 'K', correct: false });
  const initial = Array(30).fill(wrong);
  const before = adaptive.weights(initial, ['R', 'K'], settings).get('R');
  const after = adaptive.weights([...initial, ...Array(30).fill(row('R'))], ['R', 'K'], settings).get('R');
  assert.equal(after, 1); assert(after < before);
  for (const extra of [{ corrected: true }, { source: 'typed' }, { help: true }, { repeats: 1 }, { recognitionRetries: 1 }, { settings: { c: 30, e: 5 } }]) {
    assert.equal(adaptive.weights(Array(30).fill({ ...wrong, ...extra }), ['R'], settings).get('R'), 1);
  }
});
test('slower valid response times increase weight', () => {
  const rows = ['E', 'T', 'R'].flatMap(c => Array(15).fill(row(c, { responseMs: c === 'R' ? 4000 : 1000 })));
  const weights = adaptive.weights(rows, ['E', 'T', 'R'], settings);
  assert(weights.get('R') > weights.get('E')); assert.equal(weights.get('T'), 1);
});
test('60% uniform branch, 40% weighted branch and selectable uniform mode', () => {
  const weights = new Map([['E', 1], ['R', 3]]), pool = ['E', 'R'];
  const draw = (branch, position, enabled = true) => { const sequence = enabled ? [branch, position] : [position]; return adaptive.draw(pool, weights, enabled, () => sequence.shift()); };
  assert.equal(draw(0.59, 0.4), 'E');
  assert.equal(draw(0.6, 0.4), 'R');
  assert.equal(draw(0.99, 0.4, false), 'E');
  let state = 123456789;
  const random = () => { state = (1664525 * state + 1013904223) >>> 0; return state / 4294967296; };
  let count = 0;
  for (let i = 0; i < 100000; i++) if (adaptive.draw(pool, weights, true, random) === 'R') count++;
  // 0.60 * 0.50 + 0.40 * 0.75 = 0.60, rather than 0.75.
  assert(Math.abs(count / 100000 - 0.6) < 0.01);
});
test('user-selected share controls the draw, including both endpoints', () => {
  const pool = ['E', 'R'], weights = new Map([['E', 1], ['R', 3]]);
  const values = [0, 0.4];
  assert.equal(adaptive.draw(pool, weights, 1, () => values.shift()), 'R');
  assert.equal(adaptive.draw(pool, weights, 0, () => 0.4), 'E');
  const mixed = [0.49, 0.4];
  assert.equal(adaptive.draw(pool, weights, 0.5, () => mixed.shift()), 'E');
});

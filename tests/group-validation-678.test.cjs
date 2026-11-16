const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../CWZ_v6_7_8.html'), 'utf8');
const focusSource = html.match(/function focusCell\(index\)\{[^\n]*\}/)?.[0];
assert.ok(focusSource, 'focusCell() must exist');

test('Auto-advance preserves previous group until focus handler validates it', () => {
  const state = { activeCell: 4 };
  let previousWasVisibleToFocusHandler = false;
  const cells = Array.from({ length: 10 }, (_, i) => ({
    dataset: { group: String(Math.floor(i / 5)) },
    focus() {
      if (i === 5) previousWasVisibleToFocusHandler =
        cells[state.activeCell].dataset.group === '0';
    }
  }));
  const focusCell = new Function('state','allCells','scheduleCellVisibility','updateCellPosition',
    focusSource + '; return focusCell;')(state, () => cells, () => {}, () => {});
  focusCell(5);
  assert.equal(previousWasVisibleToFocusHandler, true,
    'Previous group must still be active during the focus event');
  assert.equal(state.activeCell, 5);
});

test('Incomplete groups are marked validated when advancing, regardless of length', () => {
  assert.match(html, /if\(previous&&g>\+previous\.dataset\.group\)/);
  assert.match(html, /previousRow\.dataset\.validated='1'/);
  assert.match(html, /const validated=complete\|\|row\.dataset\.validated==='1'/);
  assert.match(html, /validated&&received\[i\]!==expected\[i\]/);
});

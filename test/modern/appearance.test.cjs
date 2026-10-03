'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');

test('appearance survives reopening, follows system brightness and tolerates damaged preferences', async () => {
  const { readAppearance, saveAppearance, applyAppearance } = await import('../../ui/appearance.mjs');
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let saved = null;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true,
    value: { getItem: () => saved, setItem: (_key, value) => { saved = value; } } });
  try {
    assert.deepEqual(readAppearance(), { palette: 'orange', mode: 'system' });
    assert.equal(saveAppearance({ palette: 'blue', mode: 'system' }), true);
    const reopened = readAppearance(), root = { dataset: {} };
    applyAppearance(reopened, root, true); assert.equal(root.dataset.colorScheme, 'dark');
    applyAppearance(reopened, root, false); assert.equal(root.dataset.colorScheme, 'light');
    assert.equal(root.dataset.palette, 'blue');
    saveAppearance({ palette: 'forest', mode: 'dark' });
    applyAppearance(readAppearance(), root, false); assert.equal(root.dataset.colorScheme, 'dark');
    saved = '{corrupt'; assert.deepEqual(readAppearance(), { palette: 'orange', mode: 'system' });
    saved = JSON.stringify({ palette: 'unknown', mode: 'unknown' });
    assert.deepEqual(readAppearance(), { palette: 'orange', mode: 'system' });
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

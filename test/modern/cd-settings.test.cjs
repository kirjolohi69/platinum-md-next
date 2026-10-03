'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateReadSpeed } = require('../../app/audio-cd.cjs');

test('CD speed choices persist, remain valid for the reader, and recover from unavailable or obsolete preferences', async t => {
  const { cdReadSpeeds, readCdReadSpeed, saveCdReadSpeed } = await import('../../ui/cd-settings.mjs');
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  });
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  } });
  assert.equal(readCdReadSpeed(), 'max');
  for (const choice of cdReadSpeeds) {
    assert.equal(validateReadSpeed(choice.value), choice.value);
    assert.equal(saveCdReadSpeed(choice.value), true);
    assert.equal(readCdReadSpeed(), choice.value);
  }
  assert.equal(saveCdReadSpeed('unsupported'), false);
  values.set('platinum-md-next.cd-read-speed', 'obsolete');
  assert.equal(readCdReadSpeed(), 'max');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage unavailable'); } });
  assert.equal(readCdReadSpeed(), 'max');
  assert.equal(saveCdReadSpeed('8'), false);
});

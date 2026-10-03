'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { helperOutputLogger } = require('../../app/helper-output.cjs');

test('fragmented encoder spinners are summarized without losing real output or warnings', () => {
  const events = [];
  const logger = helperOutputLogger('atracdenc', (event, detail) => events.push({ event, ...detail }));
  for (let i = 0; i < 2000; i++) {
    const frame = `|  ${Math.floor(i / 20)}% done\r`;
    logger.onOutput({ stream: 'stdout', text: frame.slice(0, 4), elapsedMs: i * 7 });
    logger.onOutput({ stream: 'stdout', text: frame.slice(4), elapsedMs: i * 7 });
    if (i === 1000) logger.onOutput({ stream: 'stdout', text: 'Encoder warning\n', elapsedMs: i * 7 });
  }
  logger.onOutput({ stream: 'stderr', text: 'stderr stays intact\n', elapsedMs: 14000 });
  logger.onOutput({ stream: 'stdout', text: '/  100% done\rFinal text without newline', elapsedMs: 14001 });
  logger.flush();
  assert.equal(events.filter(e => e.event === 'helper-progress').reduce((sum, e) => sum + e.updates, 0), 2001);
  assert.equal(events.filter(e => e.event === 'helper-progress').at(-1).percent, 100);
  assert.ok(events.length < 10);
  assert.deepEqual(events.filter(e => e.event === 'helper-output').map(e => e.text),
    ['Encoder warning\n', 'stderr stays intact\n', 'Final text without newline\n']);
});

test('USB diagnostics pass through unchanged and unterminated text remains bounded', () => {
  const events = [];
  const logger = helperOutputLogger('netmdcli', (event, detail) => events.push({ event, ...detail }));
  logger.onOutput({ stream: 'stderr', text: 'libusb error\n', elapsedMs: 12 });
  logger.flush();
  assert.equal(events[0].text, 'libusb error\n');
  const encoder = helperOutputLogger('atracdenc', (event, detail) => events.push({ event, ...detail }));
  encoder.onOutput({ stream: 'stdout', text: 'x'.repeat(20000), elapsedMs: 20 });
  encoder.flush();
  assert.equal(events.at(-1).text.length, 16000);
});

'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AudioCd, parseToc } = require('../../app/audio-cd.cjs');
const readSpeeds = require('../../app/cd-read-speeds.json');

const toc = `Table of contents (audio tracks only):
track        length               begin        copy pre ch
===========================================================
  1.     2250 [00:30.00]        0 [00:00.00]    no  no  2
  3.     4500 [01:00.00]     3000 [00:40.00]    OK  no  2
TOTAL    6750 [01:30.00]    (audio only)
`;
const device = '/dev/sr0';
function fixture() {
  const state = { calls: [], scans: 0, changedAt: 0, short: false, fail: false, accessible: true };
  const cd = new AudioCd(async (name, args) => {
    state.calls.push([name, ...args]);
    if (name === 'ffprobe') return { stdout: JSON.stringify({ format: { duration: state.short ? 29 : 30 },
      streams: [{ codec_name: 'pcm_s16le', channels: 2, sample_rate: '44100' }] }) };
    if (args[0] === '-Q') {
      state.scans++;
      return { stdout: '', stderr: state.scans === state.changedAt ? toc.replace('3000', '3100') : toc };
    }
    if (state.fail) throw new Error('Uncorrectable read');
    return { stdout: '', stderr: '' };
  }, async () => [{ device, accessible: state.accessible, label: 'Test drive' }]);
  return { cd, state, source: { device, number: 1, revision: parseToc(toc).revision } };
}

test('CD table preserves audio-only track numbers and exact sector lengths', () => {
  const cd = parseToc(toc);
  assert.deepEqual(cd.tracks.map(t => [t.number, t.duration]), [[1, 30], [3, 60]]);
  assert.equal(cd.revision, parseToc('drive diagnostic\n' + toc).revision);
  assert.notEqual(cd.revision, parseToc(toc.replace('3000', '3100')).revision);
});
test('incomplete, duplicate and overlapping CD tables are rejected', () => {
  for (const invalid of ['', toc.replace('TOTAL    6750', 'TOTAL    6700'),
    toc.replace('  3.', '  1.'), toc.replace('3000', '2200'), toc.replace('4500 [', '-4500 [')]) {
    assert.throws(() => parseToc(invalid));
  }
});
test('pre-emphasis and four-channel CD tracks are marked unavailable', () => {
  assert.match(parseToc(toc.replace('no  no  2', 'no yes  2')).tracks[0].unavailable, /Pre-emphasis/);
  assert.match(parseToc(toc.replace('no  no  2', 'no  no  4')).tracks[0].unavailable, /stereo/);
});
test('CD paths must match an accessible enumerated optical drive', async () => {
  const { cd, state } = fixture();
  await assert.rejects(cd.scan('/dev/sda'), /no longer connected/);
  state.accessible = false;
  await assert.rejects(cd.scan(device), /cannot access/);
  assert.equal(state.calls.length, 0);
});
test('CD extraction keeps correction enabled, aborts skips and validates the resulting audio', async () => {
  const { cd, state, source } = fixture();
  await cd.readTrack(source, '/private temp/audio.wav');
  assert.deepEqual(state.calls[1], ['cdparanoia', '-q', '-X', '-w', '-d', device, '1', '/private temp/audio.wav']);
  assert.equal(state.scans, 2);
  assert.equal(state.calls.at(-1)[0], 'ffprobe');
});
test('every CD read speed uses the supported switch and preserves correction and output checks', async () => {
  for (const speed of readSpeeds) {
    const { cd, state, source } = fixture();
    await cd.readTrack(source, '/private temp/audio.wav', speed);
    assert.deepEqual(state.calls[1], ['cdparanoia', '-q', '-X', '-w',
      ...(speed === 'max' ? [] : ['-S', speed]), '-d', device, '1', '/private temp/audio.wav']);
    assert.equal(state.scans, 2);
    assert.equal(state.calls.at(-1)[0], 'ffprobe');
  }
});
test('invalid CD read speeds are rejected before touching a drive', async () => {
  const { cd, state, source } = fixture();
  for (const speed of [null, false, 8, 0, '', '0', '-1', '3', '8.0', '100000', '8 -Z', ['8'], {}]) {
    await assert.rejects(cd.readTrack(source, '/unused.wav', speed), /Choose a CD read speed/);
  }
  assert.equal(state.calls.length, 0);
});
test('a CD changed before extraction is never ripped', async () => {
  const { cd, state, source } = fixture(); state.changedAt = 1;
  await assert.rejects(cd.readTrack(source, '/unused.wav'), /CD changed/);
  assert.equal(state.calls.length, 1);
});
test('a CD changed during extraction or a truncated WAV is rejected', async () => {
  const first = fixture(); first.state.changedAt = 2;
  await assert.rejects(first.cd.readTrack(first.source, '/unused.wav'), /CD changed/);
  const second = fixture(); second.state.short = true;
  await assert.rejects(second.cd.readTrack(second.source, '/unused.wav'), /incomplete/);
});
test('an unreadable CD track stops before output probing or another read', async () => {
  const { cd, state, source } = fixture(); state.fail = true;
  await assert.rejects(cd.readTrack(source, '/unused.wav'), /queue has stopped/);
  assert.equal(state.calls.length, 2);
});

test('CD timing distinguishes extraction from TOC checks and audio validation', async () => {
  const { cd, source } = fixture();
  const steps = [];
  await cd.readTrack(source, '/unused.wav', 'max', step => steps.push(step));
  assert.deepEqual(steps.map(s => [s.step, s.success]), [
    ['check-before', true], ['extract', true], ['check-after', true], ['validate-audio', true]]);
  assert.ok(steps.every(s => Number.isInteger(s.elapsedMs) && s.elapsedMs >= 0));
});

test('CD timings preserve a failed extraction or audio validation without starting more work', async () => {
  for (const failure of ['fail', 'short']) {
    const { cd, state, source } = fixture();
    state[failure] = true;
    const steps = [];
    await assert.rejects(cd.readTrack(source, '/unused.wav', 'max', step => steps.push(step)));
    assert.equal(steps.at(-1).step, failure === 'fail' ? 'extract' : 'validate-audio');
    assert.equal(steps.at(-1).success, false);
    assert.equal(steps.length, failure === 'fail' ? 2 : 4);
  }
});

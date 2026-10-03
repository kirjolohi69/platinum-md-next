'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { NetMdService } = require('../../app/service.cjs');

async function fixture(t, exitCode, audioCd, cdMetadata) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'netmd-recording-test-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const input = path.join(dir, 'audio input.mp3');
  await fs.writeFile(input, 'synthetic input; audio conversion is stubbed');
  const stat = await fs.stat(input);
  const state = { key: '054c:00c7:1:2', sends: 0, converts: 0, fail: exitCode !== 0, failAt: 1,
    calls: [], uploaded: [], statuses: [], toolStages: [] };
  const disc = { device: 'Sony MZ-N910', title: 'Spare test disc', groupCount: 1,
    tracks: [], recordedTime: '00:00:00.00', totalTime: '01:20:00.00', availableTime: '01:20:00.00' };
  const service = new NetMdService({ bin: n => n, env: {} }, (type, value) => {
    if (type === 'uploaded') state.uploaded.push(value);
    if (type === 'status') state.statuses.push(value);
  }, {
    audioCd,
    cdMetadata,
    enumerate: async () => [{ id: '054c:00c7', writable: true, key: state.key }],
    run: async (name, args) => {
      state.calls.push([name, ...args]);
      state.toolStages.push({ name, args, stage: state.statuses.at(-1)?.stage?.name });
      if (name === 'ffprobe') return { stdout: JSON.stringify({ format: { duration: '30',
        tags: { TITLE: 'Beyoncé — Live', ARTIST: 'Performer', ALBUM: 'Album', ALBUM_ARTIST: 'Album artist' } },
        streams: [{ codec_type: 'audio' }] }), exitCode: 0 };
      if (name === 'ffmpeg') { state.converts++; return { stdout: '', exitCode: 0 }; }
      if (name === 'atracdenc') {
        if (state.failEncoding) throw new Error('Encoding failed');
        return { stdout: '', exitCode: 0 };
      }
      assert.equal(name, 'netmdcli');
      if (args[1] === 'send') {
        state.sends++;
        const failed = state.fail && state.sends === state.failAt;
        if (!failed || exitCode === 2) disc.tracks.push({ no: disc.tracks.length, name: args.at(-1),
          time: '00:30:00', bitrate: 'SP', protect: 'UNPROTECTED' });
        if (failed) throw Object.assign(new Error('Injected USB failure'), { exitCode });
      } else if (args[0] === 'settitle') {
        if (state.failTitle) throw new Error('Title failed');
        disc.title = args[1];
      } else {
        assert.deepEqual(args, ['-v']);
        if (state.failReadAfterSend && state.sends) throw new Error('Readback unavailable');
      }
      return { stdout: JSON.stringify(disc), exitCode: 0 };
    }
  });
  await service.connect();
  for (const id of ['first', 'second']) service.files.set(id, { id, path: input, title: id,
    duration: 30, size: stat.size, mtimeMs: stat.mtimeMs });
  const request = () => ({ mode: 'SP', revision: service.disc?.revision,
    tracks: [...service.files.values()].map(({ id, title }) => ({ id, title })) });
  return { service, state, request, disc };
}

test('local-file album tags are recognized regardless of tag capitalization', async t => {
  const { service } = await fixture(t, 0);
  const result = await service.importFiles([service.files.get('first').path]);
  assert.equal(result.errors.length, 0);
  assert.deepEqual([result.files[0].title, result.files[0].artist, result.files[0].album, result.files[0].suggestedDiscTitle],
    ['Beyonce - Live', 'Performer', 'Album', 'Album artist - Album']);
});

test('files from one album are queued in disc and track order; other selections keep their order', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'netmd-import-order-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const tags = {
    'a.flac': { title: 'Disc 2 opener', album: 'Album', track: '1/9', disc: '2/2' },
    'b.flac': { title: 'Third', album: 'Album', track: '3/9' },
    'c.flac': { title: 'First', album: 'Album', track: '01' },
    'd.flac': { title: 'Other album', album: 'Other', track: '2' }
  };
  const files = {};
  for (const name of Object.keys(tags)) {
    files[name] = path.join(dir, name);
    await fs.writeFile(files[name], 'synthetic');
  }
  const service = new NetMdService({ bin: n => n, env: {} }, () => {}, {
    run: async (_name, args) => ({ exitCode: 0, stdout: JSON.stringify({ format: { duration: '30',
      tags: tags[path.basename(args.at(-1))] }, streams: [{ codec_type: 'audio' }] }) })
  });
  const album = await service.importFiles([files['a.flac'], files['b.flac'], files['c.flac']]);
  assert.deepEqual(album.files.map(f => f.title), ['First', 'Third', 'Disc 2 opener']);
  assert.ok(album.files.every(f => !('order' in f)));
  const mixed = await service.importFiles([files['b.flac'], files['d.flac'], files['c.flac']]);
  assert.deepEqual(mixed.files.map(f => f.title), ['Third', 'Other album', 'First']);
});

test('CD lookup titles the selected track numbers and preserves the MiniDisc if lookup is unavailable', async t => {
  const album = { id: 'release:1', album: 'Example album', artist: 'Album artist', tracks:
    [1, 2, 3].map(number => ({ number, title: `Song ${number}`, artist: `Artist ${number}` })) };
  let fail = false;
  const cdMetadata = { lookup: async () => { if (fail) throw new Error('Offline'); return { candidates: [album] }; } };
  const audioCd = { scan: async () => ({ device: '/dev/sr0', revision: 'cd-one', tracks:
    [1, 2, 3].map(number => ({ number, title: `Track ${number}`, duration: 30 })) }) };
  const { service } = await fixture(t, 0, audioCd, cdMetadata);
  await assert.rejects(service.lookupCd({ device: '/dev/sr0', revision: 'cd-one' }), /Read the CD/);
  await service.scanCd('/dev/sr0');
  await service.lookupCd({ device: '/dev/sr0', revision: 'cd-one' });
  const result = await service.addCd({ device: '/dev/sr0', revision: 'cd-one', tracks: [3, 1], releaseId: album.id });
  assert.deepEqual(result.files.map(t => [t.title, t.artist, t.album]), [
    ['Song 1', 'Artist 1', 'Example album'], ['Song 3', 'Artist 3', 'Example album']]);
  assert.equal(result.files[0].suggestedDiscTitle, 'Album artist - Example album');
  fail = true; const before = service.disc;
  await assert.rejects(service.lookupCd({ device: '/dev/sr0', revision: 'cd-one', refresh: true }), /Offline/);
  assert.equal(service.disc, before);
  await assert.rejects(service.addCd({ device: '/dev/sr0', revision: 'cd-one', tracks: [2], releaseId: 'invented' }), /album choice/);
  assert.equal(service.disc, before);
});

test('recording to a grouped disc appends the tracks and leaves the groups alone', async t => {
  const { service, state, request, disc } = await fixture(t, 0);
  disc.groupCount = 3;
  disc.tracks.push({ no: 0, name: 'Grouped song', time: '00:30:00', bitrate: 'SP', protect: 'UNPROTECTED' });
  await service.connect();
  let detail;
  const result = await service.upload(request(), async (_message, text) => { detail = text; return true; });
  assert.match(detail, /outside the disc's groups/);
  assert.equal(result.completed.length, 2);
  assert.deepEqual(service.disc.tracks.map(t => t.name), ['Grouped song', 'first', 'second']);
  assert.equal(service.disc.groupCount, 3);
  assert.equal(state.calls.some(c => c[1] === 'settitle'), false);
});

test('a disc title or group change after recording stops the queue', async t => {
  const { service, state, request, disc } = await fixture(t, 0);
  disc.groupCount = 2;
  await service.connect();
  const run = service.run;
  service.run = async (name, args, options) => {
    const result = await run(name, args, options);
    if (args[1] === 'send') disc.groupCount = 1;
    return result;
  };
  await assert.rejects(service.upload(request(), async () => true), /groups changed unexpectedly/);
  assert.equal(state.sends, 1);
  assert.equal(service.files.has('first'), false);
  assert.equal(service.files.has('second'), true);
});

test('automatic album title is confirmed and written only after all tracks commit', async t => {
  const { service, state, request } = await fixture(t, 0);
  let detail;
  await service.upload({ ...request(), discTitle: 'Artist - Album' }, async (_message, text) => { detail = text; return true; });
  assert.match(detail, /MiniDisc title after recording: Artist - Album/);
  const commands = state.calls.filter(c => c[0] === 'netmdcli' && (c[2] === 'send' || c[1] === 'settitle'));
  assert.deepEqual(commands.map(c => c[2] === 'send' ? 'send' : 'settitle'), ['send', 'send', 'settitle']);
  assert.equal(service.disc.title, 'Artist - Album');
});

test('stopping during the final track still finishes the batch and names the MiniDisc', async t => {
  for (const [stopAfterSend, expected] of [[2, { recorded: 2, title: 'Album', cancelled: false }],
    [1, { recorded: 1, title: 'Spare test disc', cancelled: true }]]) {
    const { service, state, request } = await fixture(t, 0);
    const run = service.run;
    service.run = async (name, args, options) => {
      const result = await run(name, args, options);
      if (args[1] === 'send' && state.sends === stopAfterSend) service.stopRequested = true;
      return result;
    };
    const result = await service.upload({ ...request(), discTitle: 'Album' }, async () => true);
    assert.deepEqual({ recorded: result.completed.length, title: service.disc.title, cancelled: result.cancelled }, expected);
  }
});

test('cancelled or failed batches do not rename the MiniDisc', async t => {
  const cancelled = await fixture(t, 0);
  await cancelled.service.upload({ ...cancelled.request(), discTitle: 'Album' }, async () => false);
  assert.equal(cancelled.state.sends, 0);
  assert.equal(cancelled.state.calls.some(c => c[1] === 'settitle'), false);
  const failed = await fixture(t, 2);
  await assert.rejects(failed.service.upload({ ...failed.request(), discTitle: 'Album' }, async () => true), /committed/);
  assert.equal(failed.state.calls.some(c => c[1] === 'settitle'), false);
});

test('a disc-title failure leaves successfully recorded tracks out of the queue', async t => {
  const { service, state, request } = await fixture(t, 0); state.failTitle = true;
  await assert.rejects(service.upload({ ...request(), discTitle: 'Album' }, async () => true), /tracks were recorded/);
  assert.equal(state.sends, 2); assert.equal(service.files.size, 0);
});

test('automatic album naming refuses a populated MiniDisc before writing', async t => {
  const { service, state, request } = await fixture(t, 0);
  await service.upload({ ...request(), tracks: [{ id: 'first', title: 'first' }] }, async () => true);
  const sends = state.sends;
  await assert.rejects(service.upload({ ...request(), discTitle: 'Album' }, async () => true), /empty/);
  assert.equal(state.sends, sends);
  assert.equal(state.calls.some(c => c[1] === 'settitle'), false);
});

test('failed recording stops the queue and requires a USB reconnect before another attempt', async t => {
  const { service, state, request } = await fixture(t, 1);
  await assert.rejects(service.upload(request(), async () => true), /communication.*failed/);
  assert.equal(state.sends, 1); assert.equal(state.converts, 1);
  assert.deepEqual(state.uploaded, []); assert.equal(service.files.size, 2);
  assert.equal(service.disc, null); assert.equal(service.gate.busy, false);
  assert.equal(state.calls.at(-1)[2], 'send'); // No follow-up read or command on an uncertain session.
  const calls = state.calls.length;
  await assert.rejects(service.connect(), /Disconnect USB/);
  assert.equal(state.calls.length, calls); // Refresh must not contact the broken USB session.
  await assert.rejects(service.upload(request(), async () => true), /Disconnect USB/);
  assert.equal(state.calls.length, calls);
  state.key = '054c:00c7:1:3'; state.fail = false;
  await service.connect();
  assert.deepEqual((await service.upload(request(), async () => true)).completed, ['first', 'second']);
  assert.equal(state.sends, 3); assert.equal(service.files.size, 0);
});

test('CD tracks enter in disc order and record once each through the existing queue', async t => {
  const reads = [];
  const audioCd = { scan: async () => ({ device: '/dev/sr0', revision: 'cd-one', tracks:
    [1, 2, 3].map(number => ({ number, title: `Track ${number}`, duration: 30 })) }),
    readTrack: async (source, _output, speed) => { reads.push([source.number, speed]); } };
  const { service, state, request } = await fixture(t, 0, audioCd);
  service.files.clear();
  const added = await service.addCd({ device: '/dev/sr0', revision: 'cd-one', tracks: [3, 1] });
  assert.deepEqual(added.files.map(t => t.title), ['Track 1', 'Track 3']);
  await service.upload(request(), async () => true);
  assert.deepEqual(reads, [[1, 'max'], [3, 'max']]); assert.equal(state.sends, 2); assert.equal(state.converts, 0);
  assert.equal(service.files.size, 0);
});

test('LP batches apply the chosen CD speed to every track and report the actual active stage', async t => {
  for (const mode of ['LP2', 'LP4']) {
    const reads = [];
    let currentState;
    const audioCd = { scan: async () => ({ device: '/dev/sr0', revision: 'cd-one', tracks:
      [1, 2].map(number => ({ number, title: `Track ${number}`, duration: 30 })) }),
      readTrack: async (source, _output, speed, onTiming) => {
        reads.push([source.number, speed, currentState.statuses.at(-1).stage.name]);
        onTiming({ step: 'extract', elapsedMs: 1200 + source.number, success: true });
      } };
    const { service, state, request } = await fixture(t, 0, audioCd);
    currentState = state;
    service.files.clear();
    await service.addCd({ device: '/dev/sr0', revision: 'cd-one', tracks: [1, 2] });
    await service.upload({ ...request(), mode, cdReadSpeed: '16' }, async () => true);
    assert.deepEqual(reads, [[1, '16', 'cd-read'], [2, '16', 'cd-read']]);
    assert.equal(state.sends, 2); assert.equal(state.converts, 0);
    assert.equal(service.files.size, 0);
    const stages = ['cd-read', 'encode', 'check-disc', 'transfer', 'verify'];
    const statuses = state.statuses.filter(s => s.stage);
    assert.deepEqual(statuses.map(s => s.stage.name), [...stages, ...stages]);
    for (const [i, status] of statuses.entries()) {
      assert.equal(status.busy, true); assert.equal(status.recording, true);
      assert.deepEqual(status.stage.timings.map(s => s.name), stages.slice(0, i % stages.length));
      if (status.stage.name === 'encode') assert.match(status.message, new RegExp(`^Encoding ${mode}`));
    }
    for (const call of state.toolStages.filter(c => c.name === 'atracdenc')) {
      assert.equal(call.stage, 'encode');
      assert.equal(call.args.at(-1), mode === 'LP2' ? '128' : '64');
    }
    assert.ok(state.toolStages.filter(c => c.args[1] === 'send').every(c => c.stage === 'transfer'));
    const finished = service.logs.filter(l => l.event === 'recording-stage-finish');
    assert.equal(finished.length, 10);
    assert.ok(finished.every(l => l.success && Number.isInteger(l.elapsedMs) && l.elapsedMs >= 0 && l.cdReadSpeed === '16'));
    assert.equal(state.statuses.at(-1).busy, false);
    assert.equal(state.statuses.at(-1).stage, undefined);
    assert.equal(service.transferTimings.length, 2);
    assert.deepEqual(service.transferTimings.map(t => [t.source, t.durationSeconds, t.stages.map(s => s.stage)]),
      [['cd', 30, stages], ['cd', 30, stages]]);
    service.logs.length = 0; // Long helper traces cannot evict the separate timing record.
    assert.equal(service.transferTimings[0].stages.length, 5);
    assert.deepEqual(service.transferTimings.map(t => t.cdReadSteps), [
      [{ step: 'extract', elapsedMs: 1201, success: true }],
      [{ step: 'extract', elapsedMs: 1202, success: true }]]);
  }
});

test('an invalid speed cannot reach a helper or recording confirmation through IPC', async t => {
  const { service, state, request } = await fixture(t, 0);
  const before = state.calls.length;
  await assert.rejects(service.upload({ ...request(), cdReadSpeed: '8 -Z' }, async () => {
    assert.fail('Invalid input must not reach confirmation');
  }), /Choose a CD read speed/);
  assert.equal(state.calls.length, before);
  assert.equal(service.gate.busy, false);
});

test('a failed encoding is identified, stops before USB transfer and preserves the queue', async t => {
  const { service, state, request } = await fixture(t, 0);
  state.failEncoding = true;
  await assert.rejects(service.upload({ ...request(), mode: 'LP4' }, async () => true), /Encoding failed/);
  assert.equal(state.sends, 0); assert.equal(service.files.size, 2);
  const finished = service.logs.filter(l => l.event === 'recording-stage-finish');
  assert.deepEqual(finished.map(l => [l.stage, l.success]), [['convert', true], ['encode', false]]);
  assert.equal(state.statuses.at(-1).busy, false);
  assert.equal(state.statuses.at(-1).stage, undefined);
});

test('a failed CD read leaves the remaining queue intact and sends no audio to MiniDisc', async t => {
  const audioCd = { scan: async () => ({ device: '/dev/sr0', revision: 'cd-one', tracks:
    [1, 2].map(number => ({ number, title: `Track ${number}`, duration: 30 })) }),
    readTrack: async () => { throw new Error('CD changed'); } };
  const { service, state, request } = await fixture(t, 0, audioCd);
  service.files.clear();
  await assert.rejects(service.addCd({ device: '/dev/sr0', revision: 'old', tracks: [1] }), /changed/);
  assert.equal(service.files.size, 0);
  await service.connect();
  await service.addCd({ device: '/dev/sr0', revision: 'cd-one', tracks: [1, 2] });
  await assert.rejects(service.upload(request(), async () => true), /CD changed/);
  assert.equal(state.sends, 0); assert.equal(state.converts, 0); assert.equal(service.files.size, 2);
});

test('commit followed by cleanup failure removes only the committed queue item and never resends it', async t => {
  const { service, state, request } = await fixture(t, 2);
  await assert.rejects(service.upload(request(), async () => true), /committed the track/);
  assert.equal(state.sends, 1); assert.deepEqual(state.uploaded, ['first']);
  assert.deepEqual([...service.files.keys()], ['second']);
  assert.equal(state.calls.at(-1)[2], 'send');
  state.key = '054c:00c7:1:3'; state.fail = false;
  await service.connect();
  assert.deepEqual((await service.upload(request(), async () => true)).completed, ['second']);
  assert.equal(state.sends, 2);
  assert.deepEqual(service.disc.tracks.map(t => t.name), ['first', 'second']);
});

test('a committed track leaves the queue even when the following disc read fails', async t => {
  const { service, state, request } = await fixture(t, 0);
  state.failReadAfterSend = true;
  await assert.rejects(service.upload(request(), async () => true), /Readback unavailable/);
  assert.equal(state.sends, 1); assert.deepEqual(state.uploaded, ['first']);
  assert.deepEqual([...service.files.keys()], ['second']);
  state.failReadAfterSend = false;
  await service.connect();
  await service.upload(request(), async () => true);
  assert.equal(state.sends, 2);
  assert.deepEqual(service.disc.tracks.map(t => t.name), ['first', 'second']);
});

test('cleanup failure on the second track preserves both committed tracks and leaves the third queued', async t => {
  const { service, state, request } = await fixture(t, 2);
  state.failAt = 2;
  service.files.set('third', { ...service.files.get('second'), id: 'third', title: 'third' });
  await assert.rejects(service.upload(request(), async () => true), /committed the track/);
  assert.equal(state.sends, 2); assert.equal(state.converts, 2);
  assert.deepEqual(state.uploaded, ['first', 'second']);
  assert.deepEqual([...service.files.keys()], ['third']);
  assert.equal(state.calls.at(-1)[2], 'send');
  state.key = '054c:00c7:1:3'; state.fail = false;
  await service.connect();
  assert.deepEqual(service.disc.tracks.map(t => t.name), ['first', 'second']);
  assert.deepEqual((await service.upload(request(), async () => true)).completed, ['third']);
  assert.equal(state.sends, 3);
  assert.deepEqual(service.disc.tracks.map(t => t.name), ['first', 'second', 'third']);
});

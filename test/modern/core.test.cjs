'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { runTool, OperationGate } = require('../../app/runner.cjs');
const { parseDisc, safeTitle, safeFilename, trackNumber } = require('../../app/disc.cjs');
const { enumerateUsb, requireOneDevice } = require('../../app/usb.cjs');
const { NetMdService } = require('../../app/service.cjs');

const sample = () => ({ device: 'Sony MZ-N910', title: '100% music', groupCount: 1,
  recordedTime: '00:03:12.00', totalTime: '01:20:00.00', availableTime: '01:16:48.00',
  tracks: [{ no: 0, name: 'Track %s', time: '03:12:00', protect: 'UNPROTECTED', bitrate: 'SP' }] });
const device = { id: '054c:00c7', model: 'Sony MZ-N910', writable: true, key: '054c:00c7:1:2' };
const native = { bin: n => n, env: {} };

test('captures stderr and nonzero exits instead of reporting success', async () => {
  await assert.rejects(runTool(process.execPath, ['-e', 'process.stderr.write("missing libjson-c\\n"); process.exit(7)']),
    e => e.exitCode === 7 && e.stderr.includes('libjson-c'));
});
test('missing helper always settles', async () => {
  await assert.rejects(runTool('/definitely-not-a-platinum-md-helper'), e => e.code === 'ENOENT');
});
test('a stuck child is terminated and its operation settles', async () => {
  const start = Date.now();
  await assert.rejects(runTool(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { timeoutMs: 100 }),
    e => e.code === 'TIMEOUT');
  assert.ok(Date.now() - start < 3000);
});
test('shell metacharacters in filenames and titles stay literal', async () => {
  const title = '100% $HOME; `touch pwned` $(echo x)';
  const result = await runTool(process.execPath, ['-e', 'process.stdout.write(process.argv[1])', title]);
  assert.equal(result.stdout, title);
});
test('unbounded helper output is stopped', async () => {
  await assert.rejects(runTool(process.execPath, ['-e', 'process.stdout.write("x".repeat(65536))'], { maxBytes: 1024 }),
    e => e.code === 'OUTPUT_LIMIT');
});
test('only one hardware operation can run, and failure releases the gate', async () => {
  const gate = new OperationGate(); let release;
  const first = gate.run(() => new Promise(resolve => { release = resolve; }));
  await assert.rejects(gate.run(async () => {}), e => e.code === 'BUSY');
  release(); await first;
  await assert.rejects(gate.run(async () => { throw new Error('test'); }));
  assert.equal(await gate.run(async () => 42), 42);
});
test('disc titles with percent signs parse and malformed responses fail', () => {
  assert.equal(parseDisc(JSON.stringify(sample())).title, '100% music');
  assert.throws(() => parseDisc('helper failed'));
  assert.throws(() => parseDisc(JSON.stringify({ ...sample(), tracks: {} })));
  assert.throws(() => parseDisc(JSON.stringify({ ...sample(), totalTime: '00:00:00.00' })));
  assert.throws(() => parseDisc(JSON.stringify({ ...sample(), tracks: [{ ...sample().tracks[0], no: -1 }] })));
});
test('a legitimately empty disc is accepted', () => {
  const empty = { ...sample(), tracks: [], recordedTime: '00:00:00.00', availableTime: '01:20:00.00' };
  assert.equal(parseDisc(JSON.stringify(empty)).tracks.length, 0);
});
test('names cannot become filesystem paths or group descriptors', () => {
  assert.equal(safeTitle('Beyoncé'), 'Beyonce');
  assert.throws(() => safeTitle('0;My Disc//1-2;Group//'));
  assert.equal(safeFilename('../../music'), '_.._music');
  assert.throws(() => trackNumber(-1, 3));
  assert.throws(() => trackNumber('0', 3));
  assert.throws(() => trackNumber(3, 3));
});
test('USB discovery uses exact device IDs and checks access', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'netmd-usb-test-'));
  try {
    const sys = path.join(root, 'sys'); const dev = path.join(root, 'dev');
    await fs.mkdir(path.join(sys, '1-2'), { recursive: true });
    await fs.mkdir(path.join(sys, '1-3'), { recursive: true });
    await fs.mkdir(path.join(dev, '001'), { recursive: true });
    for (const entry of ['1-2', '1-3']) {
      for (const [key, value] of Object.entries({ idVendor: '054c', idProduct: entry === '1-2' ? '00c7' : 'ffff', busnum: '1', devnum: '2' })) {
        await fs.writeFile(path.join(sys, entry, key), value);
      }
    }
    await fs.writeFile(path.join(dev, '001', '002'), '');
    const devices = await enumerateUsb(sys, dev);
    assert.equal(devices.length, 1);
    assert.equal(devices[0].id, '054c:00c7');
    assert.ok(devices[0].writable);
    assert.throws(() => requireOneDevice([...devices, ...devices]));
    assert.throws(() => requireOneDevice([{ ...devices[0], writable: false }]));
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
test('malformed helper response resets busy state and never marks the disc ready', async () => {
  const service = new NetMdService(native, () => {}, { enumerate: async () => [device],
    run: async () => ({ stdout: 'invalid', exitCode: 0 }) });
  await assert.rejects(service.connect());
  assert.equal(service.disc, null);
  assert.equal(service.gate.busy, false);
});
test('a changed disc blocks a write even if the UI still has its previous revision', async () => {
  const calls = [];
  const service = new NetMdService(native, () => {}, { enumerate: async () => [device],
    run: async (_file, args) => { calls.push(args); return { stdout: JSON.stringify({ ...sample(), title: 'Changed' }), exitCode: 0 }; } });
  service.disc = parseDisc(JSON.stringify(sample())); service.deviceKey = device.key;
  await assert.rejects(service.edit({ action: 'renameTrack', track: 0, title: 'New', revision: service.disc.revision }, async () => true), /changed/);
  assert.deepEqual(calls, [['-v']]);
});
test('disconnect during a read invalidates the result', async () => {
  let reads = 0;
  const service = new NetMdService(native, () => {}, { enumerate: async () => [{ ...device, key: ++reads === 1 ? device.key : 'new' }],
    run: async () => ({ stdout: JSON.stringify(sample()), exitCode: 0 }) });
  await assert.rejects(service.connect(), /disconnected/);
});
test('a declined deletion does not send a delete command', async () => {
  const calls = [];
  const service = new NetMdService(native, () => {}, { enumerate: async () => [device],
    run: async (_file, args) => { calls.push(args); return { stdout: JSON.stringify(sample()), exitCode: 0 }; } });
  service.disc = parseDisc(JSON.stringify(sample())); service.deviceKey = device.key;
  await service.edit({ action: 'deleteTracks', tracks: [0], revision: service.disc.revision }, async () => false);
  assert.deepEqual(calls, [['-v']]);
});
test('grouped discs cannot lose their group data through disc renaming', async () => {
  const grouped = { ...sample(), groupCount: 2 };
  const calls = [];
  const service = new NetMdService(native, () => {}, { enumerate: async () => [device],
    run: async (_file, args) => { calls.push(args); return { stdout: JSON.stringify(grouped), exitCode: 0 }; } });
  service.disc = parseDisc(JSON.stringify(grouped)); service.deviceKey = device.key;
  await assert.rejects(service.edit({ action: 'renameDisc', title: 'New', revision: service.disc.revision }, async () => true), /group/);
  assert.deepEqual(calls, [['-v']]);
});

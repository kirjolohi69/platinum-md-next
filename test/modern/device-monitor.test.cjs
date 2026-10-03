'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NetMdService } = require('../../app/service.cjs');
const { DeviceMonitor } = require('../../app/device-monitor.cjs');
const { parseDisc } = require('../../app/disc.cjs');

const device = { id: '054c:00c7', model: 'Sony MZ-N910', key: '054c:00c7:1:2', writable: true };
const blank = { device: device.model, title: 'Test disc', groupCount: 1, tracks: [],
  totalTime: '01:20:00.00', recordedTime: '00:00:00.00', availableTime: '01:20:00.00' };
const absent = { device: device.model, discPresent: false };
function fixture() {
  const state = { devices: [{ ...device }], now: 0, calls: [], events: [], reply: blank, failure: null };
  const service = new NetMdService({ bin: name => name, env: {} }, (type, value) => state.events.push({ type, value }), {
    enumerate: async () => state.devices,
    run: async (name, args) => {
      state.calls.push([name, ...args]);
      if (state.failure) throw state.failure;
      return { stdout: JSON.stringify(state.reply), exitCode: 0 };
    }
  });
  const monitor = new DeviceMonitor(service, { enumerate: async () => state.devices, now: () => state.now });
  const statuses = () => state.events.filter(e => e.type === 'status').map(e => e.value);
  return { state, service, monitor, statuses };
}

test('confirmed absence is distinct from a blank, unreadable or malformed MiniDisc', () => {
  assert.throws(() => parseDisc(JSON.stringify(absent)), e => e.code === 'NO_DISC');
  assert.equal(parseDisc(JSON.stringify(blank)).tracks.length, 0);
  for (const value of [{ discPresent: false }, { ...blank, discPresent: false },
    { ...blank, totalTime: '00:00:00.00' }, {}]) {
    assert.throws(() => parseDisc(JSON.stringify(value)), e => e.code !== 'NO_DISC');
  }
});

test('connecting without a disc is an informational state and Refresh can then read an inserted disc', async () => {
  const { service, state, statuses } = fixture();
  state.reply = absent;
  assert.equal(await service.connect(), null);
  assert.equal(service.disc, null); assert.equal(service.mediaState, 'no-disc');
  assert.equal(service.gate.busy, false);
  assert.equal(statuses().some(s => s.error), false);
  assert.match(statuses().at(-1).message, /Insert a MiniDisc/);
  assert.equal(statuses().at(-1).clearConnectionError, true);
  state.reply = blank;
  await service.connect();
  assert.equal(service.mediaState, 'ready'); assert.equal(service.disc.tracks.length, 0);
});

test('a disc removed before an edit stops before any write and clears the stale listing', async () => {
  const { service, state } = fixture();
  await service.connect();
  const revision = service.disc.revision;
  state.reply = absent; state.calls = [];
  await assert.rejects(service.edit({ action: 'renameDisc', revision, title: 'New' }, async () => true), e => e.code === 'NO_DISC');
  assert.deepEqual(state.calls, [['netmdcli', '-v']]);
  assert.equal(service.disc, null); assert.equal(service.mediaState, 'no-disc');
  assert.equal(service.gate.busy, false);
});

test('USB failures and a rejected title alone never turn into a no-disc success', async () => {
  for (const stderr of ['libusb_open: LIBUSB_ERROR_ACCESS (-3)',
    'Disc title request was not accepted\nCannot read disc title\n']) {
    const { service, state, statuses } = fixture();
    state.failure = Object.assign(new Error('netmdcli failed (exit 1).'), { exitCode: 1, stderr });
    await assert.rejects(service.connect(), /failed/);
    assert.equal(service.disc, null); assert.equal(service.mediaState, 'unknown');
    assert.equal(statuses().at(-1).error, true);
    assert.equal(statuses().at(-1).errorScope, 'connection');
  }
});

test('the reported two-second USB permission transition connects without a false access warning', async () => {
  const { monitor, state, service, statuses } = fixture();
  state.devices[0].writable = false;
  await monitor.scan();
  assert.equal(state.calls.length, 0);
  assert.match(statuses().at(-1).message, /Waiting for Linux/);
  state.now = 2006; state.devices[0].writable = true;
  await monitor.scan(); await monitor.scan();
  assert.equal(state.calls.length, 1); assert.equal(service.mediaState, 'ready');
  assert.equal(statuses().some(s => s.error), false);
  assert.equal(statuses().at(-1).clearConnectionError, true);
});

test('persistent denied access warns once after the grace period and clears on recovery', async () => {
  const { monitor, state, statuses } = fixture();
  state.devices[0].writable = false;
  await monitor.scan();
  state.now = 5999; await monitor.scan();
  assert.equal(statuses().some(s => s.error), false);
  state.now = 6000; await monitor.scan();
  state.now = 8000; await monitor.scan();
  assert.equal(statuses().filter(s => s.error).length, 1);
  assert.equal(statuses().at(-1).errorScope, 'connection');
  assert.equal(state.calls.length, 0);
  state.devices[0].writable = true; await monitor.scan();
  assert.equal(statuses().at(-1).clearConnectionError, true);
});

test('unplugging resets pending access and monitoring never touches a busy recording', async () => {
  const { monitor, state, service, statuses } = fixture();
  state.devices[0].writable = false; await monitor.scan();
  state.now = 9000; state.devices = []; await monitor.scan();
  assert.equal(monitor.pending, null);
  assert.equal(statuses().at(-1).clearConnectionError, true);
  state.devices = [{ ...device, key: 'new', writable: false }];
  service.gate.busy = true; await monitor.scan();
  assert.equal(monitor.pending, null);
  service.gate.busy = false; await monitor.scan();
  assert.equal(monitor.pending.since, 9000);
  assert.equal(statuses().some(s => s.error), false);
});

test('overlapping discovery calls perform only one connection attempt', async () => {
  const { monitor, state } = fixture();
  let resume, enumerations = 0;
  monitor.enumerate = () => { enumerations++; return new Promise(resolve => { resume = resolve; }); };
  const scan = monitor.scan();
  await monitor.scan();
  assert.equal(enumerations, 1);
  resume(state.devices); await scan;
  assert.equal(state.calls.length, 1);
});

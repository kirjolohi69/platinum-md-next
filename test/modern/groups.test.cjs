'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const groups = require('../../app/groups.cjs');
const { parseDisc } = require('../../app/disc.cjs');
const { NetMdService } = require('../../app/service.cjs');

const g = (name, start, end = start) => ({ name, start, end });

test('group lines parse and compose in the recorder format', () => {
  const raw = '0;Tom Petty//1-5;Heartbreakers//6;Single//7-9;Solo//';
  const parsed = groups.parseRawTitle(raw);
  assert.deepEqual(parsed, { title: 'Tom Petty', groups: [g('Heartbreakers', 0, 4), g('Single', 5), g('Solo', 6, 8)] });
  assert.equal(groups.composeRawTitle(parsed), raw);
  assert.deepEqual(groups.parseRawTitle('Plain title'), { title: 'Plain title', groups: [] });
  assert.deepEqual(groups.parseRawTitle('0;//1-2;A//'), { title: '', groups: [g('A', 0, 1)] });
  const empty = groups.parseRawTitle('0;Disc//1;A//;Later//');
  assert.deepEqual(empty.groups[1], { name: 'Later', start: null, end: null });
  assert.equal(groups.composeRawTitle(empty), '0;Disc//1;A//;Later//');
});

test('only group lines the app fully understands can be rewritten', () => {
  assert.equal(groups.readGroups('0;Disc//1-2;A//3;B//', 3, 3).editable, true);
  for (const [raw, tracks, count, reason] of [
    [undefined, 3, 2, /did not report/],
    ['0;Disc//1-2;Ä//', 3, 2, /characters/],
    ['0;Disc//1-4;A//', 3, 2, /not on the disc/],
    ['0;Disc//1-2;A//2-3;B//', 3, 3, /overlap/],
    ['0;Disc//x1;A//', 3, 2, /unusual format/],
    ['0;Disc//1-2;A//3;//', 3, 3, /does not understand/]
  ]) {
    const info = groups.readGroups(raw, tracks, count);
    assert.equal(info.editable, false, String(raw));
    assert.match(info.reason, reason);
  }
});

test('deleting a track shifts later groups and removes groups left empty', () => {
  const start = [g('A', 0, 2), g('B', 3), g('C', 4, 6)];
  assert.deepEqual(groups.deleteTrack(start, 1), { groups: [g('A', 0, 1), g('B', 2), g('C', 3, 5)], removed: [] });
  assert.deepEqual(groups.deleteTrack(start, 3), { groups: [g('A', 0, 2), g('C', 3, 5)], removed: ['B'] });
  assert.deepEqual(groups.deleteTrack(start, 8), { groups: start, removed: [] });
});

test('moving a track keeps every group in one piece', () => {
  const start = [g('A', 0, 2), g('B', 3, 5)];
  // Reordering inside a group, including to its first and last place, keeps the track in it.
  assert.deepEqual(groups.moveTrack(start, 8, 2, 0).groups, start);
  assert.deepEqual(groups.moveTrack(start, 8, 3, 5).groups, start);
  // Landing inside another group joins it; landing between groups leaves it outside.
  assert.deepEqual(groups.moveTrack(start, 8, 7, 4).groups, [g('A', 0, 2), g('B', 3, 6)]);
  assert.deepEqual(groups.moveTrack(start, 8, 0, 7).groups, [g('A', 0, 1), g('B', 2, 4)]);
  assert.deepEqual(groups.moveTrack([g('A', 0), g('B', 1, 2)], 4, 0, 3), { groups: [g('B', 0, 1)], removed: ['A'] });
});

// A recorder model that behaves like netmdcli: track commands never change
// the disc title, and settitle replaces the whole title including groups.
function recorder(raw, names) {
  const state = { raw, tracks: names.map(name => ({ name, bitrate: 'LP2', protect: 'UNPROTECTED', time: '00:03:00' })),
    calls: [], meddle: null, fail: null };
  const listing = () => {
    const segments = state.raw.split('//').filter(s => s && (Number.parseInt(s, 10) > 0 || s.startsWith(';')));
    let title = state.raw;
    try { title = groups.parseRawTitle(state.raw).title; } catch {}
    title ||= '<Untitled>';
    return JSON.stringify({ device: 'Sony MZ-N910', title, groupCount: segments.length + 1, rawTitle: state.raw,
      recordedTime: '00:30:00.00', totalTime: '01:20:00.00', availableTime: '00:50:00.00',
      tracks: state.tracks.map((t, no) => ({ no, ...t })) });
  };
  const service = new NetMdService({ bin: n => n, env: {} }, () => {}, {
    enumerate: async () => [{ id: '054c:0186', writable: true, key: '054c:0186:1:2' }],
    sleep: async () => {},
    run: async (name, args) => {
      if (name !== 'netmdcli') return { stdout: '', exitCode: 0 }; // Audio conversion is not modelled.
      state.calls.push(args.map(String));
      const failure = state.fail?.(args);
      if (failure) throw Object.assign(new Error('netmdcli failed'), { exitCode: failure });
      if (args[0] === 'move') state.tracks.splice(args[2], 0, state.tracks.splice(args[1], 1)[0]);
      if (args[0] === 'delete') state.tracks.splice(args[1], 1);
      if (args[0] === 'settitle') state.raw = args[1];
      if (args[1] === 'send') {
        state.tracks.push({ name: args.at(-1), bitrate: 'SP', protect: 'UNPROTECTED', time: '00:03:00' });
        if (state.stopAfterSend) service.stopRequested = true;
      }
      if (args[0] !== '-v') state.meddle?.(state, args);
      const late = state.lateReply?.(args);
      if (late) throw Object.assign(new Error('reply arrived late'), { exitCode: late });
      return { stdout: listing(), exitCode: 0 };
    }
  });
  return { service, state };
}

const tomPetty = () => recorder('0;Tom Petty//1-3;Early//4;Single//5-6;Late//',
  ['American Girl', 'Breakdown', 'Refugee', 'Free Fallin\'', 'Learning To Fly', 'Into The Great Wide Open']);
const settitles = state => state.calls.filter(c => c[0] === 'settitle').map(c => c[1]);

test('grouped discs report their groups and can be edited', async () => {
  const { service } = tomPetty();
  const disc = await service.connect();
  assert.equal(disc.groupsEditable, true);
  assert.deepEqual(disc.groups.map(x => x.name), ['Early', 'Single', 'Late']);
  assert.equal(parseDisc(JSON.stringify({ ...JSON.parse(JSON.stringify(disc)), rawTitle: undefined,
    recordedTime: disc.recordedTime, tracks: disc.tracks })).groupsEditable, false);
});

test('deleting from a grouped disc rewrites and verifies the groups after each track', async () => {
  const { service, state } = tomPetty();
  await service.connect();
  let detail;
  await service.edit({ action: 'deleteTracks', revision: service.disc.revision, tracks: [1, 3] },
    async (_m, text) => { detail = text; return true; });
  assert.match(detail, /also be removed[\s\S]*Single/);
  assert.equal(state.raw, '0;Tom Petty//1-2;Early//3-4;Late//');
  assert.deepEqual(settitles(state), ['0;Tom Petty//1-3;Early//4-5;Late//', '0;Tom Petty//1-2;Early//3-4;Late//']);
  assert.deepEqual(service.disc.groups.map(x => [x.name, x.start, x.end]), [['Early', 0, 1], ['Late', 2, 3]]);
  // Each delete is followed by its own verified group update.
  assert.deepEqual(state.calls.filter(c => c[0] !== '-v').map(c => c[0]), ['delete', 'settitle', 'delete', 'settitle']);
});

test('moving and renaming on a grouped disc keep the groups', async () => {
  const { service, state } = tomPetty();
  await service.connect();
  await service.edit({ action: 'moveTrack', revision: service.disc.revision, track: 5, to: 1 }, async () => true);
  assert.equal(state.raw, '0;Tom Petty//1-4;Early//5;Single//6;Late//');
  await service.edit({ action: 'renameDisc', revision: service.disc.revision, title: 'Greatest Hits' }, async () => true);
  assert.equal(state.raw, '0;Greatest Hits//1-4;Early//5;Single//6;Late//');
  assert.equal(service.disc.title, 'Greatest Hits');
  // A move that keeps the groups as they are writes nothing extra.
  const before = settitles(state).length;
  await service.edit({ action: 'moveTrack', revision: service.disc.revision, track: 0, to: 2 }, async () => true);
  assert.equal(settitles(state).length, before);
});

test('moving the only track of a group asks first', async () => {
  const { service, state } = tomPetty();
  await service.connect();
  await service.edit({ action: 'moveTrack', revision: service.disc.revision, track: 3, to: 5 }, async () => false);
  assert.equal(state.calls.some(c => c[0] === 'move'), false);
  await service.edit({ action: 'moveTrack', revision: service.disc.revision, track: 3, to: 5 }, async () => true);
  assert.equal(state.raw, '0;Tom Petty//1-3;Early//4-5;Late//');
});

test('if the recorder changes the groups by itself, nothing more is written', async () => {
  const { service, state } = tomPetty();
  await service.connect();
  state.meddle = (s, args) => { if (args[0] === 'delete') s.raw = '0;Tom Petty//1-2;Early//'; };
  await assert.rejects(service.edit({ action: 'deleteTracks', revision: service.disc.revision, tracks: [0] }, async () => true),
    /changed the disc's group information by itself/);
  assert.deepEqual(settitles(state), []);
});

test('a group update that does not read back correctly stops with an explanation', async () => {
  const { service, state } = tomPetty();
  await service.connect();
  state.meddle = (s, args) => { if (args[0] === 'settitle') s.raw = '0;Tom Petty//1-3;Early//'; };
  await assert.rejects(service.edit({ action: 'deleteTracks', revision: service.disc.revision, tracks: [5, 0] }, async () => true),
    /could not be saved and verified/);
  // The first deletion's group update failed, so the second track was not deleted.
  assert.equal(state.calls.filter(c => c[0] === 'delete').length, 1);
  assert.ok(service.logs.some(entry => entry.event === 'group-title-write' && entry.before.includes('4;Single')));
});

test('discs whose groups cannot be read safely stay protected', async () => {
  const { service, state } = recorder('0;Disc//1-2;Ä//', ['One', 'Two', 'Three']);
  await service.connect();
  assert.equal(service.disc.groupsEditable, false);
  await assert.rejects(service.edit({ action: 'deleteTracks', revision: service.disc.revision, tracks: [0] }, async () => true),
    /cannot safely rewrite/);
  assert.equal(state.calls.some(c => c[0] === 'delete'), false);
});

test('group lines too long for the recorder are refused before writing', async () => {
  const long = 'x'.repeat(120);
  const { service, state } = recorder(`0;Disc//1;${long}//2;${long}//`, ['One', 'Two']);
  await service.connect();
  await assert.rejects(service.edit({ action: 'renameDisc', revision: service.disc.revision, title: 'A longer disc title' }, async () => true),
    /too long/);
  assert.deepEqual(settitles(state), []);
});

test('groups running past the last track can be repaired after confirming', async () => {
  // Left behind on hardware when the group update after a delete could not run.
  assert.deepEqual(groups.trimGroups([g('A', 0, 2), g('B', 3, 5), g('C', 6, 7)], 5),
    { groups: [g('A', 0, 2), g('B', 3, 4)], changes: [{ name: 'B', before: g('B', 3, 5), after: g('B', 3, 4) }, { name: 'C', before: g('C', 6, 7), after: null }] });
  const { service, state } = recorder('0;Tom Petty//1-16;Greatest Hits//', Array.from({ length: 15 }, (_, i) => `Song ${i + 1}`));
  await service.connect();
  assert.equal(service.disc.groupsEditable, false);
  assert.ok(service.disc.groupsRepair);
  let detail;
  await service.edit({ action: 'repairGroups', revision: service.disc.revision }, async (_m, text) => { detail = text; return false; });
  assert.match(detail, /Greatest Hits: tracks 1-16 → tracks 1-15/);
  assert.deepEqual(settitles(state), []);
  await service.edit({ action: 'repairGroups', revision: service.disc.revision }, async () => true);
  assert.equal(state.raw, '0;Tom Petty//1-15;Greatest Hits//');
  assert.equal(service.disc.groupsEditable, true);
  await assert.rejects(service.edit({ action: 'repairGroups', revision: service.disc.revision }, async () => true), /do not need repairing/);
});

test('a busy recorder is tried once more only when nothing was sent', async () => {
  const { service, state } = tomPetty();
  await service.connect();
  // Exit 3: the helper stopped before sending anything, so one more try is safe.
  let busy = 1;
  state.fail = args => args[0] === 'settitle' && busy-- > 0 ? 3 : 0;
  await service.edit({ action: 'deleteTracks', revision: service.disc.revision, tracks: [0] }, async () => true);
  assert.equal(state.raw, '0;Tom Petty//1-2;Early//3;Single//4-5;Late//');
  assert.equal(settitles(state).length, 2);
  assert.ok(service.logs.some(e => e.event === 'helper-retry-nothing-sent'));
  // Any other failure may have changed the disc and is never repeated.
  state.fail = args => args[0] === 'settitle' ? 1 : 0;
  await assert.rejects(service.edit({ action: 'deleteTracks', revision: service.disc.revision, tracks: [0] }, async () => true),
    /could not be saved and verified/);
  assert.equal(settitles(state).length, 3);
  const fresh = tomPetty();
  await fresh.service.connect();
  fresh.state.fail = args => args[0] === 'delete' ? 1 : 0;
  await assert.rejects(fresh.service.edit({ action: 'deleteTracks', revision: fresh.service.disc.revision, tracks: [0] }, async () => true));
  assert.equal(fresh.state.calls.filter(c => c[0] === 'delete').length, 1);
});

test('deleting every track from a grouped disc leaves no groups behind', async () => {
  const { service, state } = tomPetty();
  await service.connect();
  let detail;
  await service.edit({ action: 'deleteTracks', revision: service.disc.revision, tracks: [0, 1, 2, 3, 4, 5] },
    async (_m, text) => { detail = text; return true; });
  assert.match(detail, /Early[\s\S]*Single[\s\S]*Late|Late[\s\S]*Single[\s\S]*Early/);
  assert.equal(state.tracks.length, 0);
  assert.equal(state.raw, '0;Tom Petty//');
  assert.equal(service.disc.groupCount, 1);
});

test('a change the recorder made despite a late reply is confirmed, never repeated', async () => {
  // Hardware report: deleting every track, a group update was written but
  // its reply timed out (exit 1). The listing afterwards showed it applied.
  const { service, state } = tomPetty();
  await service.connect();
  let writes = 0;
  state.lateReply = args => args[0] === 'settitle' && ++writes === 3 ? 1 : 0;
  await service.edit({ action: 'deleteTracks', revision: service.disc.revision, tracks: [0, 1, 2, 3, 4, 5] }, async () => true);
  assert.equal(state.tracks.length, 0);
  assert.equal(state.raw, '0;Tom Petty//');
  assert.equal(service.logs.filter(e => e.event === 'change-confirmed-after-error').length, 1);
  // Every group update was sent exactly once.
  assert.equal(new Set(settitles(state)).size, settitles(state).length);
  // A failed delete that did not happen still stops everything.
  const other = tomPetty();
  await other.service.connect();
  other.state.fail = args => args[0] === 'delete' ? 1 : 0;
  await assert.rejects(other.service.edit({ action: 'deleteTracks', revision: other.service.disc.revision, tracks: [0] }, async () => true),
    /failed/);
  assert.equal(other.state.tracks.length, 6);
});

test('new groups cover free runs of tracks and are kept in track order', () => {
  const start = [g('A', 0, 1), g('C', 5, 6)];
  assert.deepEqual(groups.addGroup(start, 8, 2, 4, 'B'), [g('A', 0, 1), g('B', 2, 4), g('C', 5, 6)]);
  assert.deepEqual(groups.addGroup(start, 8, 7, 7, 'D').at(-1), g('D', 7));
  assert.throws(() => groups.addGroup(start, 8, 1, 3, 'X'), /already in the group "A"/);
  assert.throws(() => groups.addGroup(start, 8, 6, 8, 'X'), /follow each other/);
  assert.deepEqual(groups.renameGroup(start, 1, 'Z'), [g('A', 0, 1), g('Z', 5, 6)]);
  assert.deepEqual(groups.removeGroup(start, 0), [g('C', 5, 6)]);
  assert.throws(() => groups.removeGroup(start, 2), /no longer on the disc/);
});

const acdc = (raw = 'AC-DC') => recorder(raw, ['Hells Bells', 'Shoot to Thrill', 'Back in Black', 'Highway to Hell', 'Girls Got Rhythm']);

test('a disc without groups gets its first group, written and verified', async () => {
  const { service, state } = acdc();
  await service.connect();
  assert.equal(service.disc.groupingNote, '');
  await service.edit({ action: 'createGroup', revision: service.disc.revision, tracks: [2, 0, 1], title: 'Back in Black' });
  assert.equal(state.raw, '0;AC-DC//1-3;Back in Black//');
  assert.deepEqual(service.disc.groups.map(x => [x.name, x.start, x.end]), [['Back in Black', 0, 2]]);
  await service.edit({ action: 'createGroup', revision: service.disc.revision, tracks: [3, 4], title: 'Highway to Hell' });
  assert.equal(state.raw, '0;AC-DC//1-3;Back in Black//4-5;Highway to Hell//');
  assert.deepEqual(state.calls.filter(c => c[0] !== '-v').map(c => c[0]), ['settitle', 'settitle']);
});

test('a disc without a title can be grouped; its title stays empty', async () => {
  const { service, state } = acdc('');
  await service.connect();
  await service.edit({ action: 'createGroup', revision: service.disc.revision, tracks: [0], title: 'Singles' });
  assert.equal(state.raw, '0;//1;Singles//');
});

test('groups need a continuous run of tracks outside other groups', async () => {
  const { service, state } = acdc('0;AC-DC//1-2;Early//');
  await service.connect();
  for (const [tracks, error] of [[[2, 4], /continuous/], [[1, 2], /already in the group "Early"/], [[], /Select the tracks/]]) {
    await service.connect();
    await assert.rejects(service.edit({ action: 'createGroup', revision: service.disc.revision, tracks, title: 'X' }), error);
  }
  await service.connect();
  await assert.rejects(service.edit({ action: 'createGroup', revision: service.disc.revision, tracks: [2], title: 'A//B' }), /separator/);
  assert.equal(settitles(state).length, 0);
});

test('groups can be renamed and removed; removing keeps the tracks', async () => {
  const { service, state } = tomPetty();
  await service.connect();
  await service.edit({ action: 'renameGroup', revision: service.disc.revision, group: 1, title: 'B-side' });
  assert.equal(state.raw, '0;Tom Petty//1-3;Early//4;B-side//5-6;Late//');
  let asked;
  await service.edit({ action: 'removeGroup', revision: service.disc.revision, group: 0 }, async m => { asked = m; return false; });
  assert.match(asked, /Remove the group "Early"/);
  assert.equal(settitles(state).length, 1);
  await service.edit({ action: 'removeGroup', revision: service.disc.revision, group: 0 }, async () => true);
  assert.equal(state.raw, '0;Tom Petty//4;B-side//5-6;Late//');
  assert.equal(state.tracks.length, 6);
  await assert.rejects(service.edit({ action: 'renameGroup', revision: service.disc.revision, group: 7, title: 'X' }), /no longer on the disc/);
});

test('discs whose title cannot be rewritten safely cannot get groups', async () => {
  for (const raw of ['AC;DC', 'Café']) {
    const { service, state } = acdc(raw);
    await service.connect();
    assert.notEqual(service.disc.groupingNote, '');
    await assert.rejects(service.edit({ action: 'createGroup', revision: service.disc.revision, tracks: [0], title: 'X' }), /Groups cannot be changed/);
    assert.equal(settitles(state).length, 0);
  }
});

async function queue(t, service, names) {
  const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'netmd-group-recording-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'song.flac');
  await fs.writeFile(file, 'stub');
  const stat = await fs.stat(file);
  for (const name of names) service.files.set(name, { id: name, path: file, title: name, duration: 180, size: stat.size, mtimeMs: stat.mtimeMs });
  return { mode: 'SP', revision: service.disc.revision, tracks: names.map(name => ({ id: name, title: name })) };
}

test('two CDs recorded one after the other each go into their own new group', async t => {
  const { service, state } = recorder('', []);
  await service.connect();
  let detail;
  await service.upload({ ...await queue(t, service, ['Hells Bells', 'Shoot to Thrill']), groupName: 'Back in Black', discTitle: 'AC-DC' },
    async (_m, text) => { detail = text; return true; });
  assert.match(detail, /into a new group "Back in Black"/);
  assert.equal(state.raw, '0;AC-DC//1-2;Back in Black//');
  await service.upload({ ...await queue(t, service, ['Highway to Hell', 'Girls Got Rhythm', 'Walk All Over You']), groupName: 'Highway to Hell' }, async () => true);
  assert.equal(state.raw, '0;AC-DC//1-2;Back in Black//3-5;Highway to Hell//');
  assert.deepEqual(service.disc.groups.map(x => [x.name, x.start, x.end]), [['Back in Black', 0, 1], ['Highway to Hell', 2, 4]]);
  // One title write per batch, after its tracks were recorded and verified.
  assert.deepEqual(state.calls.filter(c => c[0] !== '-v' || c[1] === 'send').map(c => c[1] === 'send' ? 'send' : c[0]),
    ['send', 'send', 'settitle', 'send', 'send', 'send', 'settitle']);
});

test('after Stop, the tracks already recorded are grouped and the album title is not written', async t => {
  const { service, state } = recorder('0;Mix//', []);
  await service.connect();
  state.stopAfterSend = true;
  const result = await service.upload({ ...await queue(t, service, ['One', 'Two']), groupName: 'Album' }, async () => true);
  assert.equal(result.cancelled, true);
  assert.equal(state.raw, '0;Mix//1;Album//');
});

test('a group that cannot be added is refused before anything is recorded', async t => {
  for (const [raw, names, groupName, error] of [
    ['AC;DC', ['A'], 'Album', /Groups cannot be changed/],
    ['0;Disc//1;Old//', ['A'], 'x'.repeat(120), /too long/]
  ]) {
    const { service, state } = recorder(raw, ['Existing']);
    await service.connect();
    const request = await queue(t, service, names);
    if (groupName.length === 120) state.raw = '0;' + 'D'.repeat(120) + '//1;Older//';
    await service.connect();
    await assert.rejects(service.upload({ ...request, revision: service.disc.revision, groupName }, async () => true), error);
    assert.equal(state.calls.some(c => c[1] === 'send' || c[0] === 'settitle'), false);
  }
});

test('if the new group cannot be verified, the recorded tracks are not offered again', async t => {
  const { service, state } = recorder('0;Mix//', []);
  await service.connect();
  state.meddle = (current, args) => { if (args[0] === 'settitle') current.raw = '0;Mix//'; };
  await assert.rejects(service.upload({ ...await queue(t, service, ['One']), groupName: 'Album' }, async () => true),
    /recorded, but their group could not be created[\s\S]*do not record those tracks again/);
  assert.equal(service.files.size, 0);
  assert.equal(state.tracks.length, 1);
});

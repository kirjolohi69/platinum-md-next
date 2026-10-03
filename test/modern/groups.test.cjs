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
    calls: [], meddle: null };
  const listing = () => {
    const segments = state.raw.split('//').filter(s => s && (Number.parseInt(s, 10) > 0 || s.startsWith(';')));
    const title = groups.parseRawTitle(state.raw).title || '<Untitled>';
    return JSON.stringify({ device: 'Sony MZ-N910', title, groupCount: segments.length + 1, rawTitle: state.raw,
      recordedTime: '00:30:00.00', totalTime: '01:20:00.00', availableTime: '00:50:00.00',
      tracks: state.tracks.map((t, no) => ({ no, ...t })) });
  };
  const service = new NetMdService({ bin: n => n, env: {} }, () => {}, {
    enumerate: async () => [{ id: '054c:0186', writable: true, key: '054c:0186:1:2' }],
    run: async (_name, args) => {
      state.calls.push(args.map(String));
      if (args[0] === 'move') state.tracks.splice(args[2], 0, state.tracks.splice(args[1], 1)[0]);
      if (args[0] === 'delete') state.tracks.splice(args[1], 1);
      if (args[0] === 'settitle') state.raw = args[1];
      if (args[0] !== '-v') state.meddle?.(state, args);
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

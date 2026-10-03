'use strict';

// MiniDisc groups are stored inside the disc title, e.g.
//   0;Disc title//1-3;Group A//5;Group B//;Empty group//
// Track numbers there are 1-based; groups returned here use 0-based track
// indexes ({ name, start, end } inclusive, or start/end null for a group with
// no tracks). Parsing mirrors libnetmd's netmd_parse_disc_title, and
// composeRawTitle writes the same format as netmd_generate_disc_header.

// netmdcli's title write stores each length in one byte.
const MAX_RAW_TITLE_BYTES = 255;

function parseRawTitle(raw) {
  let title = '';
  const groups = [];
  for (const segment of raw.split('//')) {
    if (!segment) continue;
    const semicolon = segment.indexOf(';');
    if (semicolon < 0) { title = segment; continue; }
    const prefix = segment.slice(0, semicolon), name = segment.slice(semicolon + 1);
    if (!name) continue;
    if (!prefix) { groups.push({ name, start: null, end: null }); continue; }
    const match = prefix.match(/^(\d{1,3})(?:-(\d{1,3}))?$/);
    if (!match) throw new Error(`Unrecognised group entry "${segment}".`);
    const first = Number(match[1]);
    if (first === 0) { title = name; continue; }
    groups.push({ name, start: first - 1, end: (match[2] ? Number(match[2]) : first) - 1 });
  }
  return { title, groups };
}

function composeRawTitle({ title, groups }) {
  let raw = `0;${title}//`;
  for (const group of groups) {
    const range = group.start === null ? '' :
      group.start === group.end ? `${group.start + 1}` : `${group.start + 1}-${group.end + 1}`;
    raw += `${range};${group.name}//`;
  }
  return raw;
}

function groupProblem(groups, trackCount) {
  const ranged = groups.filter(g => g.start !== null).sort((a, b) => a.start - b.start);
  for (const [i, group] of ranged.entries()) {
    if (group.start < 0 || group.end < group.start || group.end >= trackCount) return `Group "${group.name}" refers to tracks that are not on the disc.`;
    if (i && group.start <= ranged[i - 1].end) return `Groups "${ranged[i - 1].name}" and "${group.name}" overlap.`;
  }
  return '';
}

// Groups that run past the last track (left behind when a group update did
// not finish) are shortened to end there. Used only after the user confirms.
function trimGroups(groups, trackCount) {
  const result = [], changes = [];
  for (const group of groups) {
    if (group.start === null || group.end < trackCount) { result.push(group); continue; }
    if (group.start >= trackCount) { changes.push({ name: group.name, before: group, after: null }); continue; }
    const after = { ...group, end: trackCount - 1 };
    result.push(after);
    changes.push({ name: group.name, before: group, after });
  }
  return { groups: result, changes };
}

// Everything the app needs to know before it may rewrite a disc's groups.
function readGroups(raw, trackCount, groupCount) {
  const blocked = reason => ({ title: '', groups: [], editable: false, reason });
  if (typeof raw !== 'string') return blocked('This recorder helper did not report the disc\'s group information.');
  if (!/^[\x20-\x7e]*$/.test(raw)) return blocked('This disc\'s titles use characters this version cannot safely rewrite.');
  let parsed;
  try { parsed = parseRawTitle(raw); } catch (error) { return blocked(`This disc's group information is in an unusual format. ${error.message}`); }
  // libnetmd counts the disc title as a group. A mismatch means entries we do
  // not understand (for example unnamed groups) that a rewrite would drop.
  if (parsed.groups.length + 1 !== groupCount) return { ...parsed, editable: false, reason: 'This disc\'s group information contains entries this version does not understand.' };
  const problem = groupProblem(parsed.groups, trackCount);
  if (problem) {
    const trimmed = trimGroups(parsed.groups, trackCount);
    const repair = !groupProblem(trimmed.groups, trackCount) ? trimmed : null;
    return { ...parsed, editable: false, reason: problem, repair };
  }
  return { ...parsed, editable: true, reason: '' };
}

function deleteTrack(groups, index) {
  const result = [], removed = [];
  for (const group of groups) {
    if (group.start === null || index > group.end) result.push(group);
    else if (index < group.start) result.push({ ...group, start: group.start - 1, end: group.end - 1 });
    else if (group.start === group.end) removed.push(group.name);
    else result.push({ ...group, end: group.end - 1 });
  }
  return { groups: result, removed };
}

// A moved track stays in its own group if it lands next to that group's other
// tracks, joins a group it lands inside, and is otherwise outside any group.
function moveTrack(groups, trackCount, from, to) {
  const member = Array(trackCount).fill(-1);
  groups.forEach((group, g) => { if (group.start !== null) for (let i = group.start; i <= group.end; i++) member[i] = g; });
  const own = member.splice(from, 1)[0];
  const before = to > 0 ? member[to - 1] : -1, after = to < member.length ? member[to] : -1;
  let target = -1;
  if (own >= 0 && (before === own || after === own)) target = own;
  else if (before >= 0 && before === after) target = before;
  member.splice(to, 0, target);
  const result = [], removed = [];
  groups.forEach((group, g) => {
    if (group.start === null) { result.push(group); return; }
    const positions = member.flatMap((m, i) => m === g ? [i] : []);
    if (!positions.length) { removed.push(group.name); return; }
    const start = positions[0], end = positions.at(-1);
    if (end - start + 1 !== positions.length) throw new Error('Moving this track would split a group.');
    result.push({ ...group, start, end });
  });
  return { groups: result, removed };
}

// New groups cover a run of tracks that are not in any group yet. Groups are
// kept in track order, as the recorder lists them.
function addGroup(groups, trackCount, start, end, name) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end >= trackCount) {
    throw new Error('Select tracks that follow each other on the disc.');
  }
  const taken = groups.find(g => g.start !== null && start <= g.end && end >= g.start);
  if (taken) throw new Error(`Some of these tracks are already in the group "${taken.name}". Remove that group first, or select other tracks.`);
  const result = [...groups];
  const at = result.findIndex(g => g.start !== null && g.start > end);
  result.splice(at < 0 ? result.length : at, 0, { name, start, end });
  return result;
}

function groupAt(groups, index) {
  if (!Number.isInteger(index) || index < 0 || index >= groups.length) throw new Error('That group is no longer on the disc. Refresh the disc.');
  return groups[index];
}

function renameGroup(groups, index, name) {
  groupAt(groups, index);
  return groups.map((g, i) => i === index ? { ...g, name } : g);
}

function removeGroup(groups, index) {
  groupAt(groups, index);
  return groups.filter((_, i) => i !== index);
}

function sameGroups(a, b) {
  const key = value => JSON.stringify([value.title, value.groups.map(g => [g.name, g.start, g.end])]);
  return key(a) === key(b);
}

module.exports = { MAX_RAW_TITLE_BYTES, parseRawTitle, composeRawTitle, readGroups, trimGroups, deleteTrack, moveTrack,
  addGroup, renameGroup, removeGroup, sameGroups };

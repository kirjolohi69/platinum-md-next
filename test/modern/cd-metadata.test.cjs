'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { CdMetadata, discIdentity, parseReleases, recorderTitle, requestJson } = require('../../app/cd-metadata.cjs');
const discidContract = require('./fixtures/musicbrainz-discid-contract.json');

// Published MusicBrainz Disc ID Calculation example, not the user's private CD.
const offsets = [0, 15213, 32164, 46442, 63264, 80339, 95312];
const cd = { tracks: offsets.slice(0, -1).map((start, i) => ({ number: i + 1, start, sectors: offsets[i + 1] - start })) };
const identity = discIdentity(cd);
const releaseId = '12345678-1234-1234-1234-123456789012';
function data() {
  return { releases: [{ id: releaseId, title: 'Test album', date: '2001', country: 'FI',
    'artist-credit': [{ name: 'Test artist', joinphrase: ' & ' }, { artist: { name: 'Guest' } }],
    media: [{ position: 1, discs: [{ id: identity.id }], tracks: cd.tracks.map(t => ({ position: t.number,
      title: `Song ${t.number}`, length: t.sectors / 75 * 1000,
      'artist-credit': [{ name: `Per-track artist ${t.number}` }] })) }] }] };
}

test('MusicBrainz identifier matches the published example and preserves nonzero first-track offsets', () => {
  assert.equal(identity.id, '49HHV7Eb8UKF3aQiNmu1GR8vKTY-');
  assert.equal(identity.toc, '1 6 95462 150 15363 32314 46592 63414 80489');
  const shifted = { tracks: cd.tracks.map(t => ({ ...t, start: t.start + 32 })) };
  assert.match(discIdentity(shifted).toc, /^1 6 95494 182 /);
  assert.notEqual(discIdentity(shifted).id, identity.id);
  assert.throws(() => discIdentity({ tracks: [cd.tracks[0], cd.tracks[2]] }), /layout/);
});
test('metadata retains album and per-track artists and identifies the correct medium in a box set', () => {
  const response = data(); const wrong = structuredClone(response.releases[0].media[0]);
  wrong.position = 2; wrong.discs[0].id = 'another-disc'; wrong.tracks[0].length += 20000;
  response.releases[0].media.unshift(wrong);
  const results = parseReleases(response, cd);
  assert.equal(results.length, 1); assert.equal(results[0].id, `${releaseId}:1`);
  assert.equal(results[0].artist, 'Test artist & Guest');
  assert.equal(results[0].tracks[1].artist, 'Per-track artist 2');
  assert.equal(results[0].exact, true);
});
test('different editions remain selectable and plausible fuzzy matches are labelled', () => {
  const response = data(), second = structuredClone(response.releases[0]);
  second.id = '22345678-1234-1234-1234-123456789012'; second.country = 'GB';
  second.media[0].discs = []; second.media[0].tracks[0].length += 1000;
  response.releases.push(second);
  const results = parseReleases(response, cd);
  assert.equal(results.length, 2); assert.deepEqual(results.map(r => r.exact), [true, false]);
});
test('wrong track counts, duplicate positions, missing titles and unrelated lengths cannot become album matches', () => {
  for (const mutate of [r => r.media[0].tracks.pop(), r => r.media[0].tracks[1].position = 1,
    r => r.media[0].tracks[0].title = '', r => { r.media[0].discs = []; r.media[0].tracks[0].length = 999999; },
    r => r.media[0].tracks[0] = null]) {
    const response = data(); mutate(response.releases[0]); assert.deepEqual(parseReleases(response, cd), []);
  }
});
test('automatic recorder titles keep metadata from becoming control characters or group descriptors', () => {
  assert.equal(recorderTitle('Beyoncé — “Live” // edition'), 'Beyonce - "Live" / edition');
  assert.equal(recorderTitle('日本語', 'Track 01'), 'Track 01');
  assert.equal(recorderTitle('x'.repeat(400)).length, 120);
});
test('lookup sends only a CD identifier/timings and coalesces requests for the same CD', async () => {
  let calls = 0; let finish;
  const metadata = new CdMetadata({ request: async (url, options) => {
    calls++; assert.equal(url.origin, 'https://musicbrainz.org');
    assert.equal(url.searchParams.get('toc'), identity.toc);
    assert.equal(url.searchParams.get('inc'), 'recordings artist-credits');
    assert.match(url.search, /inc=recordings\+artist-credits&/);
    assert.doesNotMatch(url.search, /%2b/i);
    assert.match(options.userAgent, /^Platinum-MD-Next\//);
    await new Promise(resolve => { finish = resolve; }); return data();
  } });
  const first = metadata.lookup(cd), second = metadata.lookup(cd);
  await new Promise(resolve => setImmediate(resolve)); finish();
  assert.deepEqual(await first, await second); assert.equal(calls, 1);
  assert.equal((await metadata.lookup(cd)).cached, true); assert.equal(calls, 1);
});
test('different CD queries are spaced apart and service busy responses cause a cooldown', async () => {
  let clock = 1000, calls = 0; const sleeps = [];
  const metadata = new CdMetadata({ now: () => clock, sleep: async ms => { sleeps.push(ms); clock += ms; },
    request: async () => { calls++; if (calls === 2) throw Object.assign(new Error('busy'), { status: 503 }); return { releases: [] }; } });
  await metadata.lookup(cd);
  const other = { tracks: cd.tracks.map(t => ({ ...t, start: t.start + 10 })) };
  await assert.rejects(metadata.lookup(other), /busy/);
  assert.deepEqual(sleeps, [1100]);
  await assert.rejects(metadata.lookup(cd), /pause/); assert.equal(calls, 2);
});
test('positive matches survive reopening offline and damaged cache entries are ignored', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'netmd-album-cache-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const cachePath = path.join(dir, 'albums.json');
  const first = new CdMetadata({ cachePath, request: async () => data() }); await first.lookup(cd);
  const second = new CdMetadata({ cachePath, request: async () => { throw new Error('offline'); } });
  assert.equal((await second.lookup(cd)).cached, true);
  assert.match((await second.lookup(cd, true)).message, /saved/);
  await fs.writeFile(cachePath, JSON.stringify({ version: 1, entries: [{ id: identity.id, candidates: [null] }] }));
  let calls = 0; const third = new CdMetadata({ cachePath, request: async () => { calls++; return data(); } });
  assert.equal((await third.lookup(cd)).candidates.length, 1); assert.equal(calls, 1);
});
test('not-found responses remain usable manual-import results and network errors settle', async () => {
  const missing = new CdMetadata({ request: async () => { throw Object.assign(new Error('404'), { status: 404 }); } });
  assert.deepEqual((await missing.lookup(cd)).candidates, []);
  const offline = new CdMetadata({ request: async () => { throw new Error('offline'); } });
  await assert.rejects(offline.lookup(cd), /offline/); assert.equal(offline.inflight.size, 0);
});

function transport(body, status = 200, hang = false) {
  return (_url, _options, callback) => {
    const request = new EventEmitter(); request.destroy = () => {};
    queueMicrotask(() => {
      const response = new PassThrough(); response.statusCode = status; callback(response);
      if (!hang) response.end(Buffer.from(body));
    });
    return request;
  };
}
test('HTTP client rejects HTML, oversized responses and redirects without following them', async () => {
  const url = new URL('https://musicbrainz.org/ws/2/discid/test');
  assert.deepEqual(await requestJson(url, { get: transport('{"releases":[]}'), userAgent: 'test' }), { releases: [] });
  await assert.rejects(requestJson(url, { get: transport('<html>Unavailable</html>'), userAgent: 'test' }), /usable data/);
  await assert.rejects(requestJson(url, { get: transport(' '.repeat(2 * 1024 * 1024 + 1)), userAgent: 'test' }), /too large/);
  await assert.rejects(requestJson(url, { get: transport('', 302), userAgent: 'test' }), e => e.status === 302);
});
test('HTTP lookup has a deadline even when the response body never finishes', async () => {
  await assert.rejects(requestJson(new URL('https://musicbrainz.org/'), {
    get: transport('', 200, true), timeoutMs: 25, userAgent: 'test' }), /too long/);
});

test('lookup obeys the upstream DiscID endpoint rules and retains automatic disc IDs', async () => {
  // These endpoint rules come from the MusicBrainz controller, independently of
  // our request builder. Generic release-query rules did not catch alpha.6's bug.
  const allowed = new Set(discidContract.allowedIncludes);
  assert.equal(allowed.has('discids'), false);
  assert.equal(allowed.has('releases'), false);
  assert.deepEqual(discidContract.automaticIncludes, ['media', 'discids']);
  const discidsError = 'discids is not a valid option for the inc parameter for the discid resource unless you specify one of the following other inc parameters: releases';
  const get = (url, options, callback) => {
    const wireUrl = new URL(url.toString());
    const tokens = wireUrl.searchParams.get('inc').split(/\s+/);
    const invalid = tokens.find(token => !allowed.has(token));
    if (invalid) return transport(JSON.stringify({ error: invalid === 'discids' ? discidsError : `Invalid inc parameter: ${invalid}` }),
      400)(wireUrl, options, callback);
    assert.equal(wireUrl.searchParams.get('fmt'), 'json');
    assert.equal(wireUrl.searchParams.get('cdstubs'), 'no');
    assert.equal(wireUrl.searchParams.get('toc'), identity.toc);
    const body = data();
    // The server always adds media/disc IDs here; recordings and credits are
    // opt-in. Omitting those options must not magically yield complete metadata.
    if (!tokens.includes('recordings')) delete body.releases[0].media[0].tracks;
    if (!tokens.includes('artist-credits') && !tokens.includes('artists')) {
      delete body.releases[0]['artist-credit'];
      for (const track of body.releases[0].media[0].tracks || []) delete track['artist-credit'];
    }
    return transport(JSON.stringify(body))(wireUrl, options, callback);
  };
  for (const inc of ['artists+recordings+artist-credits+discids', 'recordings artist-credits discids',
    'releases recordings artist-credits discids']) {
    const old = new URL(`https://musicbrainz.org/ws/2/discid/${identity.id}`);
    old.search = new URLSearchParams({ inc }).toString();
    await assert.rejects(requestJson(old, { get, userAgent: 'test' }), error =>
      error.status === 400 && /rejected/.test(error.message) &&
      (inc === 'recordings artist-credits discids' ? error.detail === discidsError : /Invalid inc parameter/.test(error.detail)));
  }
  const metadata = new CdMetadata({ request: (url, options) => requestJson(url, { ...options, get }) });
  const result = await metadata.lookup(cd);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].tracks.length, 6);
  assert.equal(result.candidates[0].exact, true);
  assert.equal(result.candidates[0].artist, 'Test artist & Guest');
  assert.equal(result.candidates[0].tracks[0].title, 'Song 1');
  assert.equal(result.candidates[0].tracks[0].artist, 'Per-track artist 1');
});

test('HTTP errors retain status and bounded service details in diagnostics', async () => {
  const events = [];
  const metadata = new CdMetadata({ log: (event, fields) => events.push({ event, ...fields }),
    request: (url, options) => requestJson(url, { ...options,
      get: transport(JSON.stringify({ error: 'Invalid inc parameter\n' + 'x'.repeat(2000) }), 400) }) });
  await assert.rejects(metadata.lookup(cd), /HTTP 400/);
  const failure = events.find(e => e.event === 'cd-metadata-unavailable');
  assert.equal(failure.status, 400);
  assert.match(failure.detail, /^Invalid inc parameter /);
  assert.equal(failure.detail.length, 512);
  for (const [status, pattern] of [[403, /refused access/], [502, /HTTP 502/], [503, /busy/]]) {
    await assert.rejects(requestJson(new URL('https://musicbrainz.org/'), {
      get: transport('<html>Unavailable</html>', status), userAgent: 'test' }),
    error => error.status === status && pattern.test(error.message) && error.detail === undefined);
  }
});

test('failed responses remain bounded even when a server sends too much data or never finishes', async () => {
  const url = new URL('https://musicbrainz.org/');
  await assert.rejects(requestJson(url, { get: transport('x'.repeat(20000), 400), userAgent: 'test' }),
    error => error.status === 400 && error.detail === undefined);
  await assert.rejects(requestJson(url, { get: transport('', 400, true), timeoutMs: 25, userAgent: 'test' }),
    error => error.status === 400);
});

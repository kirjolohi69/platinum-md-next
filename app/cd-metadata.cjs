'use strict';

const https = require('node:https');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { safeTitle } = require('./disc.cjs');
const { version, musicbrainzContact = '' } = require('../package.json');

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_CACHED = 40;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clean = value => typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, 512) : '';

function recorderTitle(value, fallback = 'Untitled') {
  const converted = clean(value).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
    .normalize('NFD').replace(/[^\x20-\x7e]/g, '').replace(/\/{2,}/g, '/').trim().slice(0, 120);
  try { return safeTitle(converted); } catch { return fallback; }
}

// MusicBrainz Disc ID Calculation: SHA-1 of uppercase hex TOC, then modified Base64.
// cdparanoia uses LBA offsets; MusicBrainz includes the 150-sector lead-in.
function discIdentity(cd) {
  const tracks = cd?.tracks;
  if (!Array.isArray(tracks) || !tracks.length || tracks.length > 99 || tracks.some((t, i) =>
    t.number !== i + 1 || !Number.isInteger(t.start) || !Number.isInteger(t.sectors) ||
    t.start < 0 || t.sectors <= 0 || t.start + t.sectors > 600000 ||
    (i && tracks[i - 1].start + tracks[i - 1].sectors !== t.start))) {
    throw new Error('Online lookup is unavailable for this CD layout. You can still add its audio tracks.');
  }
  const offsets = tracks.map(t => t.start + 150);
  const leadout = tracks.at(-1).start + tracks.at(-1).sectors + 150;
  const hex = (number, width) => number.toString(16).toUpperCase().padStart(width, '0');
  const input = '01' + hex(tracks.length, 2) + hex(leadout, 8) +
    Array.from({ length: 99 }, (_, i) => hex(offsets[i] || 0, 8)).join('');
  const id = createHash('sha1').update(input, 'ascii').digest('base64').replace(/\+/g, '.').replace(/\//g, '_').replace(/=/g, '-');
  return { id, toc: [1, tracks.length, leadout, ...offsets].join(' ') };
}

function artistCredit(credits) {
  if (!Array.isArray(credits)) return '';
  return clean(credits.slice(0, 30).map(c => typeof c === 'string' ? c :
    (clean(c?.name) || clean(c?.artist?.name)) + (typeof c?.joinphrase === 'string' ? c.joinphrase : '')).join(''));
}

function validCached(candidates, count) {
  return Array.isArray(candidates) && candidates.length > 0 && candidates.length <= 60 && candidates.every(c =>
    c && UUID.test(c.releaseId) && Number.isInteger(c.discNumber) && c.discNumber >= 1 && c.discNumber <= 100 &&
    c.id === `${c.releaseId}:${c.discNumber}` && typeof c.exact === 'boolean' &&
    ['album', 'artist', 'date', 'country', 'edition', 'discTitle'].every(k => typeof c[k] === 'string' && c[k].length <= 512) &&
    Array.isArray(c.tracks) && c.tracks.length > 0 && c.tracks.length <= 99 && (!count || c.tracks.length === count) &&
    c.tracks.every((t, i) => t && t.number === i + 1 && typeof t.title === 'string' && t.title.length <= 512 &&
      typeof t.artist === 'string' && t.artist.length <= 512));
}

function parseReleases(data, cd, identity = discIdentity(cd)) {
  if (!data || !Array.isArray(data.releases)) {
    if (data && (data['release-count'] === 0 || data.error)) return [];
    throw new Error('The album service returned an incomplete response. You can add the tracks without names.');
  }
  const results = [], seen = new Set();
  for (const release of data.releases.slice(0, 500)) {
    if (!release || !UUID.test(release.id) || !clean(release.title) || !Array.isArray(release.media)) continue;
    for (const medium of release.media.slice(0, 100)) {
      if (!medium || !Number.isInteger(medium.position) || medium.position < 1 || medium.position > 100 ||
          !Array.isArray(medium.tracks) || medium.tracks.length !== cd.tracks.length) continue;
      const id = `${release.id}:${medium.position}`;
      if (seen.has(id)) continue;
      if (medium.tracks.some(t => !t || !Number.isInteger(t.position))) continue;
      const rawTracks = [...medium.tracks].sort((a, b) => a.position - b.position);
      if (rawTracks.some((t, i) => !t || t.position !== cd.tracks[i].number || !clean(t.title || t.recording?.title))) continue;
      const exact = Array.isArray(medium.discs) && medium.discs.some(d => d?.id === identity.id);
      // Fuzzy matches must have a compatible track list and lengths; users always choose them.
      const differences = rawTracks.map((t, i) => {
        const length = t.length ?? t.recording?.length;
        return typeof length === 'number' && length > 0 ? Math.abs(length / 1000 - cd.tracks[i].sectors / 75) : Infinity;
      });
      if (!exact && (differences.some(d => d > 3) || differences.reduce((a, b) => a + b, 0) > 8)) continue;
      const artist = artistCredit(release['artist-credit']);
      results.push({ id, releaseId: release.id, album: clean(release.title), artist,
        date: clean(release.date), country: clean(release.country), edition: clean(release.disambiguation),
        discNumber: medium.position, discTitle: clean(medium.title), exact,
        tracks: rawTracks.map(t => ({ number: t.position, title: clean(t.title || t.recording?.title),
          artist: artistCredit(t['artist-credit']) || artistCredit(t.recording?.['artist-credit']) || artist })) });
      seen.add(id);
    }
  }
  return results.sort((a, b) => Number(b.exact) - Number(a.exact) ||
    a.album.localeCompare(b.album) || a.date.localeCompare(b.date) || a.country.localeCompare(b.country)).slice(0, 60);
}

function requestJson(url, options = {}) {
  const { userAgent, timeoutMs = 12000, get = https.get } = options;
  return new Promise((resolve, reject) => {
    let request, timer, httpError, settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      error ? reject(error) : resolve(value);
    };
    request = get(url, { headers: { Accept: 'application/json', 'User-Agent': userAgent } }, response => {
      const status = response.statusCode;
      if (status !== 200) {
        httpError = new Error(status === 404 ? 'No album match was found.' :
          status === 429 || status === 503 ? 'MusicBrainz is busy. Try again in a minute, or add tracks without names.' :
          status === 400 ? 'MusicBrainz rejected this app\'s lookup request (HTTP 400). Please save a diagnostics report. You can still add tracks.' :
          status === 401 || status === 403 ? `MusicBrainz refused access (HTTP ${status}). Please save a diagnostics report. You can still add tracks.` :
            `MusicBrainz returned HTTP ${status}. You can still add tracks; save a diagnostics report if this continues.`);
        httpError.status = status;
      }
      let size = 0; const chunks = [];
      response.on('data', chunk => {
        size += chunk.length;
        if (size > (httpError ? 16384 : MAX_BYTES)) {
          const error = httpError || new Error('The album response was too large. Add tracks without names or try another CD.');
          finish(error); response.destroy(); request?.destroy(); return;
        }
        chunks.push(chunk);
      });
      response.on('error', error => finish(httpError || error));
      response.on('aborted', () => finish(httpError || new Error('The album connection ended early. Try again.')));
      response.on('end', () => {
        if (settled) return;
        if (httpError) {
          // Keep a bounded JSON explanation in Diagnostics, never raw HTML in the UI.
          try { httpError.detail = clean(JSON.parse(Buffer.concat(chunks).toString('utf8'))?.error); }
          catch { /* Some proxies and service errors return HTML instead of JSON. */ }
          finish(httpError); return;
        }
        try { finish(null, JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch { finish(new Error('The album service did not return usable data. Check your connection or try again later.')); }
      });
    });
    request.on('error', cause => {
      const error = httpError || new Error('Could not reach MusicBrainz. Check your connection; recording still works offline.');
      if (typeof cause.code === 'string') error.code = cause.code.slice(0, 80);
      finish(error);
    });
    timer = setTimeout(() => {
      finish(httpError || new Error('Album lookup took too long. You can still add tracks, or try again later.'));
      request.destroy();
    }, timeoutMs);
  });
}

class CdMetadata {
  constructor({ cachePath, request = requestJson, log = () => {}, now = Date.now, sleep = delay,
    contact = musicbrainzContact } = {}) {
    this.cachePath = cachePath; this.request = request; this.log = log; this.now = now; this.sleep = sleep;
    // Set a real fork-maintainer URL/email before public release. Do not impersonate upstream.
    this.userAgent = `Platinum-MD-Next/${version} (${contact || 'unpublished local preview'})`;
    this.cache = new Map(); this.inflight = new Map(); this.chain = Promise.resolve(); this.nextRequest = 0;
    this.loaded = this.loadCache();
  }

  async loadCache() {
    if (!this.cachePath) return;
    try {
      if ((await fs.stat(this.cachePath)).size > 5 * MAX_BYTES) return;
      const data = JSON.parse(await fs.readFile(this.cachePath, 'utf8'));
      if (data.version !== 1 || !Array.isArray(data.entries)) return;
      for (const entry of data.entries.slice(-MAX_CACHED)) {
        if (entry && /^[A-Za-z0-9._-]{28}$/.test(entry.id) && validCached(entry.candidates)) {
          this.cache.set(entry.id, entry.candidates);
        }
      }
    } catch { /* A missing/damaged cache must never block recording or a fresh lookup. */ }
  }

  async saveCache() {
    if (!this.cachePath) return;
    const temporary = this.cachePath + '.new';
    try {
      await fs.mkdir(path.dirname(this.cachePath), { recursive: true });
      const entries = [...this.cache].slice(-MAX_CACHED).map(([id, candidates]) => ({ id, candidates }));
      let content = JSON.stringify({ version: 1, entries });
      while (Buffer.byteLength(content) > 5 * MAX_BYTES && entries.length > 1) {
        entries.shift(); content = JSON.stringify({ version: 1, entries });
      }
      if (Buffer.byteLength(content) > 5 * MAX_BYTES) return;
      await fs.writeFile(temporary, content, { mode: 0o600 });
      await fs.rename(temporary, this.cachePath);
    } catch { this.log('cd-metadata-cache-unavailable'); }
  }

  async lookup(cd, refresh = false) {
    const identity = discIdentity(cd);
    await this.loaded;
    const found = this.cache.get(identity.id);
    const cached = validCached(found, cd.tracks.length) ? found : undefined;
    if (!refresh && cached) return { candidates: cached, cached: true };
    if (this.inflight.has(identity.id)) return this.inflight.get(identity.id);
    const pending = this.chain.catch(() => {}).then(async () => {
      const wait = this.nextRequest - this.now();
      if (wait > 2000) {
        if (cached) return { candidates: cached, cached: true, message: 'Showing saved album information while MusicBrainz is busy.' };
        throw new Error('MusicBrainz asked us to pause. Try again in a minute; recording still works.');
      }
      if (wait > 0) await this.sleep(wait);
      this.nextRequest = this.now() + 1100; // MusicBrainz allows at most one request per second.
      const url = new URL(`https://musicbrainz.org/ws/2/discid/${identity.id}`);
      // URLSearchParams encodes spaces as '+' separators. Literal '+' values
      // become '%2B' and MusicBrainz rejects the resulting single inc token.
      // DiscID lookups add media/disc IDs automatically. Explicit 'discids' and
      // 'releases' are not accepted by this endpoint (unlike other resources).
      url.search = new URLSearchParams({ fmt: 'json', inc: 'recordings artist-credits',
        toc: identity.toc, cdstubs: 'no' }).toString();
      this.log('cd-metadata-request', { provider: 'MusicBrainz', discId: identity.id });
      try {
        const data = await this.request(url, { userAgent: this.userAgent });
        const candidates = parseReleases(data, cd, identity);
        if (candidates.length) {
          this.cache.delete(identity.id); this.cache.set(identity.id, candidates);
          while (this.cache.size > MAX_CACHED) this.cache.delete(this.cache.keys().next().value);
          await this.saveCache();
        }
        this.log('cd-metadata-result', { matches: candidates.length });
        return { candidates, cached: false };
      } catch (error) {
        if (error.status === 404) return { candidates: [], cached: false };
        if (error.status === 429 || error.status === 503) this.nextRequest = this.now() + 60000;
        this.log('cd-metadata-unavailable', { message: error.message, status: error.status,
          code: error.code, detail: error.detail });
        if (cached) return { candidates: cached, cached: true, message: 'Showing saved album information; the online service is unavailable.' };
        throw error;
      }
    });
    this.chain = pending;
    this.inflight.set(identity.id, pending);
    try { return await pending; } finally { this.inflight.delete(identity.id); }
  }
}

module.exports = { CdMetadata, discIdentity, parseReleases, recorderTitle, requestJson };

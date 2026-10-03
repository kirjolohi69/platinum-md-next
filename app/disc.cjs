'use strict';

const { createHash } = require('node:crypto');

function parseDisc(output) {
  let value;
  try { value = JSON.parse(output); } catch {
    throw new Error('The NetMD helper returned an invalid disc response. Open Diagnostics for details.');
  }
  // Only the helper's explicit, confirmed presence response means no disc.
  // Empty, malformed, rejected and zero-capacity listings remain real errors.
  if (value && typeof value.device === 'string' && value.device && value.discPresent === false &&
      value.tracks === undefined && value.totalTime === undefined) {
    throw Object.assign(new Error('Insert a MiniDisc, close the lid, then choose Refresh disc.'), { code: 'NO_DISC' });
  }
  if (value?.discPresent === false) throw new Error('The recorder returned conflicting disc information. Refresh the disc.');
  if (!value || typeof value.device !== 'string' || typeof value.title !== 'string' ||
      !Array.isArray(value.tracks) || value.tracks.length > 255 ||
      !['recordedTime', 'totalTime', 'availableTime'].every(k =>
        typeof value[k] === 'string' && /^\d{2,3}:\d{2}:\d{2}\.\d{2}$/.test(value[k]))) {
    throw new Error('The device returned incomplete disc information. Check the disc and reconnect.');
  }
  if (/^00:00:00\.00$/.test(value.totalTime)) {
    throw new Error('The recorder is not ready, or no readable MiniDisc is inserted.');
  }
  for (const [i, track] of value.tracks.entries()) {
    if (!track || track.no !== i || typeof track.name !== 'string' ||
        typeof track.bitrate !== 'string' || typeof track.protect !== 'string' ||
        typeof track.time !== 'string' || !/^\d{2,3}:\d{2}:\d{2}$/.test(track.time) ||
        track.bitrate.trim() === 'UNKNOWN') {
      throw new Error('The recorder returned incomplete track information. Retry after it is ready.');
    }
  }
  if (!Number.isInteger(value.groupCount) || value.groupCount < 1 || value.groupCount > 256) throw new Error('Invalid disc group information.');
  const disc = { device: value.device, title: value.title, groupCount: value.groupCount, recordedTime: value.recordedTime,
    totalTime: value.totalTime, availableTime: value.availableTime,
    tracks: value.tracks.map(t => ({ no: t.no, name: t.name, bitrate: t.bitrate.trim(),
      protect: t.protect.trim(), time: t.time })) };
  disc.revision = createHash('sha256').update(JSON.stringify(disc)).digest('hex');
  return disc;
}

function safeTitle(value) {
  if (typeof value !== 'string' || value.length > 512) throw new Error('Enter a shorter title.');
  const title = value.normalize('NFD').replace(/[^\x20-\x7e]/g, '').trim();
  if (!title || title.length > 120) throw new Error('Use a title of 1–120 basic Latin characters.');
  // Disc group separators must not be created accidentally by the title editor.
  if (title.includes('//')) throw new Error('Titles cannot contain the group separator // .');
  return title;
}

function safeFilename(value) {
  return String(value).normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, '_')
    .replace(/^\.+|[. ]+$/g, '').slice(0, 120) || 'track';
}

function trackNumber(value, count) {
  if (!Number.isInteger(value) || value < 0 || value >= count) throw new Error('Select a valid track.');
  return value;
}

function capacitySeconds(value) {
  const [h, m, s] = value.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

module.exports = { parseDisc, safeTitle, safeFilename, trackNumber, capacitySeconds };

'use strict';

const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const readSpeeds = require('./cd-read-speeds.json');

function validateReadSpeed(value = 'max') {
  if (!readSpeeds.includes(value)) throw new Error('Choose a CD read speed from the list.');
  return value;
}

// cdparanoia's C-locale query prints audio tracks only, in 75-sector seconds.
function parseToc(text) {
  const rows = [...text.matchAll(/^\s*(\d+)\.\s+(\d+)\s+\[[\d:.]+\]\s+(-?\d+)\s+\[[\d:.]+\]\s+(OK|no)\s+(yes|no)\s+([24])\s*$/gm)];
  const total = text.match(/^TOTAL\s+(\d+)\s+\[/m);
  const tracks = rows.map(m => ({ number: Number(m[1]), sectors: Number(m[2]), start: Number(m[3]),
    preEmphasis: m[5] === 'yes', channels: Number(m[6]) }));
  if (!total || !tracks.length || tracks.length > 99 || tracks.some((t, i) =>
    t.number < 1 || t.number > 99 || t.sectors <= 0 || t.start < 0 || t.start + t.sectors > 600000 ||
    (i && (t.number <= tracks[i - 1].number || t.start < tracks[i - 1].start + tracks[i - 1].sectors))) ||
    tracks.reduce((sum, t) => sum + t.sectors, 0) !== Number(total[1])) {
    throw new Error('The CD did not provide a complete audio track list. Insert an audio CD and try again.');
  }
  const revision = createHash('sha256').update(JSON.stringify(tracks)).digest('hex');
  return { revision, tracks: tracks.map(t => ({ ...t, duration: t.sectors / 75,
    title: `Track ${String(t.number).padStart(2, '0')}`,
    unavailable: t.preEmphasis ? 'Pre-emphasis CDs are not supported yet.' : t.channels !== 2 ? 'Only stereo CD tracks are supported.' : '' })) };
}

async function listDrives(sysRoot = '/sys/class/block', devRoot = '/dev') {
  const names = await fs.readdir(sysRoot);
  const drives = [];
  for (const name of names.filter(n => /^sr\d+$/.test(n)).sort()) {
    const device = path.join(devRoot, name);
    const model = await fs.readFile(path.join(sysRoot, name, 'device/model'), 'utf8').catch(() => name);
    // SCSI audio extraction normally needs read/write access to the drive node.
    const accessible = await fs.access(device, constants.R_OK | constants.W_OK).then(() => true, () => false);
    drives.push({ device, label: `${model.trim()} (${name})`, accessible });
  }
  return drives;
}

class AudioCd {
  constructor(tool, enumerate = listDrives) { this.tool = tool; this.enumerate = enumerate; }

  async scan(device) {
    const drive = (await this.enumerate()).find(d => d.device === device);
    if (!drive) throw new Error('The CD drive is no longer connected. Refresh the drive list.');
    if (!drive.accessible) throw new Error('Your account cannot access this CD drive. Check its permissions in Linux, then try again.');
    let result;
    try { result = await this.tool('cdparanoia', ['-Q', '-d', drive.device], 45000); }
    catch { throw new Error('Could not read the audio CD. Insert a music CD, close other CD apps, and try again. Details are in Diagnostics.'); }
    return { device: drive.device, label: drive.label, ...parseToc(result.stdout + '\n' + result.stderr) };
  }

  async readTrack(source, output, readSpeed = 'max', onTiming = () => {}) {
    const speed = validateReadSpeed(readSpeed);
    const measure = async (step, task) => {
      const started = performance.now();
      let success = false;
      try { const result = await task(); success = true; return result; }
      finally { onTiming({ step, elapsedMs: Math.round(performance.now() - started), success }); }
    };
    const current = await measure('check-before', () => this.scan(source.device));
    const track = current.tracks.find(t => t.number === source.number);
    if (current.revision !== source.revision || !track) throw new Error('The audio CD changed. Remove its queued tracks and add the new CD.');
    if (track.unavailable) throw new Error(track.unavailable);
    // Preserve correction and abort on an uncorrectable skip. Never silently pad a damaged CD.
    // With no -S, this bundled cdparanoia requests full speed. Explicit speeds
    // are requests only: the drive may limit or ignore them. Never disable
    // correction to reach a requested speed.
    const speedArgs = speed === 'max' ? [] : ['-S', speed];
    try { await measure('extract', () => this.tool('cdparanoia', ['-q', '-X', '-w', ...speedArgs, '-d', source.device, String(track.number), output], 30 * 60 * 1000)); }
    catch { throw new Error('Could not read this CD track completely. The recording queue has stopped. Check the CD and save Diagnostics.'); }
    const after = await measure('check-after', () => this.scan(source.device));
    if (after.revision !== current.revision) throw new Error('The audio CD changed while it was being read. No audio from this read was recorded.');
    // A failed/short extraction must not become a shortened MiniDisc recording.
    await measure('validate-audio', async () => {
      const result = await this.tool('ffprobe', ['-v', 'error', '-show_entries',
        'format=duration:stream=codec_name,sample_rate,channels', '-of', 'json', output], 15000);
      const info = JSON.parse(result.stdout), stream = info.streams?.[0];
      const duration = Number(info.format?.duration);
      if (stream?.codec_name !== 'pcm_s16le' || Number(stream.sample_rate) !== 44100 || stream.channels !== 2 ||
          !Number.isFinite(duration) || Math.abs(duration - track.duration) > 1 / 75) {
        throw new Error('The extracted CD track is incomplete or has an unexpected format. Nothing from this read was recorded.');
      }
    });
  }
}

module.exports = { AudioCd, parseToc, listDrives, validateReadSpeed };

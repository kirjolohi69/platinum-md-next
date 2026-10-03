'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const { runTool, OperationGate } = require('./runner.cjs');
const { enumerateUsb, requireOneDevice } = require('./usb.cjs');
const { parseDisc, safeTitle, trackNumber, capacitySeconds } = require('./disc.cjs');
const { AudioCd, validateReadSpeed } = require('./audio-cd.cjs');
const { CdMetadata, recorderTitle } = require('./cd-metadata.cjs');
const { helperOutputLogger } = require('./helper-output.cjs');

// Tag values such as "3" or "3/12"; anything else is treated as missing.
function tagNumber(value) {
  const match = typeof value === 'string' && value.trim().match(/^(\d{1,3})(?:\s*\/\s*\d{1,3})?$/);
  return match && Number(match[1]) > 0 ? Number(match[1]) : undefined;
}

class NetMdService {
  constructor(paths, emit = () => {}, dependencies = {}) {
    this.paths = paths;
    this.emit = emit;
    this.run = dependencies.run || runTool;
    this.enumerate = dependencies.enumerate || enumerateUsb;
    this.gate = new OperationGate();
    this.disc = null;
    this.mediaState = 'unknown';
    this.deviceKey = null;
    this.files = new Map();
    this.logs = [];
    this.transferTimings = [];
    this.stopRequested = false;
    this.recordingBlockedKey = null;
    this.audioCd = dependencies.audioCd || new AudioCd((...args) => this.tool(...args));
    this.cdMetadata = dependencies.cdMetadata || new CdMetadata({ cachePath: paths.metadataCache,
      contact: paths.metadataContact, log: (...args) => this.log(...args) });
    this.cdScans = new Map();
    this.cdMatches = new Map();
  }

  log(event, details = {}) {
    const entry = { time: new Date().toISOString(), event, ...details };
    this.logs.push(entry);
    if (this.logs.length > 1000) this.logs.shift();
    this.emit('log', entry);
  }

  status(message, extra = {}) { this.emit('status', { message, ...extra }); }

  setMediaState(state) { this.mediaState = state; this.emit('media-state', state); }

  async tool(name, args, timeoutMs = 45000) {
    this.log('helper-start', { helper: name, args, timeoutMs });
    const output = helperOutputLogger(name, (...values) => this.log(...values));
    try {
      const result = await this.run(this.paths.bin(name), args, {
        env: this.paths.env, timeoutMs,
        onOutput: output.onOutput
      });
      output.flush();
      this.log('helper-exit', { helper: name, code: result.exitCode, elapsedMs: result.elapsedMs });
      return result;
    } catch (error) {
      output.flush();
      this.log('helper-error', { helper: name, message: error.message, code: error.code,
        exitCode: error.exitCode, stderr: error.stderr?.slice(-16000) });
      throw error;
    }
  }

  async operation(label, task, invalidateDisc = true, connection = false) {
    return this.gate.run(async () => {
      this.stopRequested = false;
      this.status(label, { busy: true });
      try {
        const result = await task();
        this.status(this.mediaState === 'no-disc' ? 'Insert a MiniDisc, close the lid, then choose Refresh disc.' : 'Ready',
          { busy: false, ...(connection ? { clearConnectionError: true } : {}) });
        return result;
      } catch (error) {
        if (invalidateDisc) {
          this.disc = null; this.emit('disc', null);
          if (error.code !== 'NO_DISC') this.setMediaState('unknown');
        }
        this.status(error.message, { busy: false, error: true, ...(connection ? { errorScope: 'connection' } : {}) });
        throw error;
      }
    });
  }

  requireReadySession(device) {
    if (this.recordingBlockedKey === device.key) {
      throw new Error('The previous recording session failed. Disconnect USB, wait for the recorder to leave PC mode, then reconnect before refreshing or recording again.');
    }
    this.recordingBlockedKey = null;
  }

  async readDisc(allowNoDisc = false) {
    const device = requireOneDevice(await this.enumerate());
    this.requireReadySession(device);
    this.log('usb-open-request', device);
    const result = await this.tool('netmdcli', ['-v']);
    const after = requireOneDevice(await this.enumerate());
    if (after.key !== device.key) throw new Error('The recorder disconnected during the operation. Reconnect and retry.');
    this.deviceKey = device.key;
    let disc;
    try { disc = parseDisc(result.stdout); }
    catch (error) {
      if (error.code === 'NO_DISC') {
        this.disc = null; this.emit('disc', null);
        this.setMediaState('no-disc');
        this.log('recorder-no-disc', { model: device.model });
        if (allowNoDisc) return null;
      }
      throw error;
    }
    this.disc = disc;
    this.setMediaState('ready');
    this.emit('disc', disc);
    return disc;
  }

  connect() { return this.operation('Reading your MiniDisc…', () => this.readDisc(true), true, true); }

  scanCd(device) {
    return this.operation('Reading the audio CD…', async () => {
      this.cdScans.delete(device);
      const cd = await this.audioCd.scan(device);
      this.cdScans.set(device, cd);
      return cd;
    }, false);
  }

  async lookupCd(request) {
    const cd = this.cdScans.get(request?.device);
    if (!cd || cd.revision !== request?.revision) throw new Error('Read the CD again before looking up its album.');
    const result = await this.cdMetadata.lookup(cd, request.refresh === true);
    this.cdMatches.set(cd.revision, result.candidates);
    while (this.cdMatches.size > 40) this.cdMatches.delete(this.cdMatches.keys().next().value);
    return result;
  }

  addCd(request) {
    if (!request || !Array.isArray(request.tracks) || !request.tracks.length || request.tracks.length > 99 ||
        request.tracks.some(n => !Number.isInteger(n)) || new Set(request.tracks).size !== request.tracks.length) {
      throw new Error('Choose the CD tracks to add.');
    }
    return this.operation('Adding CD tracks…', async () => {
      const cd = await this.audioCd.scan(request.device);
      if (cd.revision !== request.revision) throw new Error('The audio CD changed. Read it again before choosing tracks.');
      const selected = request.tracks.map(number => cd.tracks.find(t => t.number === number));
      if (selected.some(t => !t || t.unavailable)) throw new Error('One of the selected CD tracks is unavailable.');
      const album = request.releaseId ? this.cdMatches.get(cd.revision)?.find(r => r.id === request.releaseId) : null;
      if (request.releaseId && !album) throw new Error('That album choice is no longer available. Look up the CD again.');
      const files = selected.sort((a, b) => a.number - b.number).map(track => {
        const metadata = album?.tracks.find(t => t.number === track.number);
        const item = { id: randomUUID(), title: recorderTitle(metadata?.title, track.title), filename: `Audio CD · track ${track.number}`,
          artist: metadata?.artist || '', album: album?.album || '', albumArtist: album?.artist || '',
          suggestedDiscTitle: album ? recorderTitle([album.artist, album.album].filter(Boolean).join(' - '), '') : '',
          albumKey: album?.id || '', duration: track.duration, source: 'cd' };
        this.files.set(item.id, { ...item, cd: { device: cd.device, revision: cd.revision, number: track.number } });
        return item;
      });
      return { files, errors: [] };
    }, false);
  }

  async assertUnchanged(revision) {
    if (!this.disc || this.disc.revision !== revision) throw new Error('The disc listing changed. Refresh it before continuing.');
    const key = this.deviceKey;
    const current = await this.readDisc();
    if (current.revision !== revision || key !== this.deviceKey) throw new Error('The disc or recorder changed. Review the refreshed listing before continuing.');
    return current;
  }

  async importFiles(paths) {
    return this.operation('Reading audio files…', async () => {
      const imported = [], errors = [];
      for (const file of paths.slice(0, 255)) {
        try {
          const stat = await fs.stat(file);
          if (!stat.isFile()) continue;
          const result = await this.tool('ffprobe', ['-v', 'error', '-show_entries',
            'format=duration:format_tags=title,artist,album,album_artist,track,disc:stream=codec_type,duration', '-of', 'json', file], 15000);
          const meta = JSON.parse(result.stdout);
          if (!meta.streams?.some(s => s.codec_type === 'audio')) throw new Error('No audio stream.');
          const duration = Number(meta.format?.duration);
          if (!Number.isFinite(duration) || duration <= 0) throw new Error('Could not determine the track length.');
          const id = randomUUID();
          const tags = Object.fromEntries(Object.entries(meta.format?.tags || {})
            .filter(([, value]) => typeof value === 'string').map(([key, value]) => [key.toLowerCase(), value]));
          const title = recorderTitle(tags.title || path.parse(file).name, 'Untitled track');
          const album = typeof tags.album === 'string' ? tags.album.slice(0, 512) : '';
          const albumArtist = typeof (tags.album_artist || tags.artist) === 'string' ? (tags.album_artist || tags.artist).slice(0, 512) : '';
          const item = { id, filename: path.basename(file), title, artist: (tags.artist || '').slice(0, 512), album, albumArtist,
            suggestedDiscTitle: album ? recorderTitle([albumArtist, album].filter(Boolean).join(' - '), '') : '',
            albumKey: album ? JSON.stringify([album, albumArtist]) : '',
            duration, size: stat.size, mtimeMs: stat.mtimeMs };
          this.files.set(id, { ...item, path: file });
          imported.push({ ...item, order: [tagNumber(tags.disc) ?? 1, tagNumber(tags.track)] });
        } catch (error) {
          errors.push(`${path.basename(file)}: ${error.message}`);
        }
      }
      // One album with numbered tracks is queued in album order; anything else
      // keeps the order the files were chosen in.
      if (imported.length > 1 && imported[0].albumKey && imported.every(f =>
          f.albumKey === imported[0].albumKey && f.order[1] !== undefined)) {
        imported.sort((a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1]);
      }
      return { files: imported.map(({ order, ...item }) => item), errors };
    });
  }

  forgetFiles(ids) {
    if (this.gate.busy) throw new Error('Wait for the current operation to finish.');
    if (!Array.isArray(ids) || ids.length > 255) throw new Error('Invalid file selection.');
    for (const id of ids) this.files.delete(id);
  }

  async edit(request, confirm) {
    const { action, revision } = request || {};
    if (!['renameTrack', 'renameDisc', 'deleteTracks', 'moveTrack', 'play', 'pause', 'stop', 'next', 'previous'].includes(action)) {
      throw new Error('Unknown device action.');
    }
    return this.operation('Updating the recorder…', async () => {
      let current = await this.assertUnchanged(revision);
      if (['play', 'pause', 'stop', 'next', 'previous'].includes(action)) {
        const args = [action];
        if (action === 'play' && request.track !== undefined) args.push(trackNumber(request.track, current.tracks.length));
        await this.tool('netmdcli', args);
        return current;
      }
      if (action === 'renameTrack') {
        const index = trackNumber(request.track, current.tracks.length);
        const title = safeTitle(request.title);
        await this.tool('netmdcli', ['rename', index, title]);
        current = await this.readDisc();
        if (current.tracks[index]?.name !== title) throw new Error('The title change could not be verified. Refresh the disc before trying again.');
      } else if (action === 'renameDisc') {
        if (current.groupCount > 1) throw new Error('Renaming grouped discs is not supported in this version, to preserve group information.');
        const title = safeTitle(request.title);
        await this.tool('netmdcli', ['settitle', title]);
        current = await this.readDisc();
        if (current.title !== title) throw new Error('The disc title change could not be verified.');
      } else if (action === 'moveTrack') {
        if (current.groupCount > 1) throw new Error('Moving tracks on grouped discs is not supported in this version.');
        const from = trackNumber(request.track, current.tracks.length);
        const to = trackNumber(request.to, current.tracks.length);
        if (from !== to) {
          const expected = current.tracks.map(({ no, ...track }) => track);
          expected.splice(to, 0, expected.splice(from, 1)[0]);
          await this.tool('netmdcli', ['move', from, to]);
          current = await this.readDisc();
          if (JSON.stringify(expected) !== JSON.stringify(current.tracks.map(({ no, ...t }) => t))) {
            throw new Error('The new track order could not be verified. Refresh the disc before continuing.');
          }
        }
      } else if (action === 'deleteTracks') {
        if (current.groupCount > 1) throw new Error('Deleting tracks from grouped discs is not supported in this version.');
        if (!Array.isArray(request.tracks) || !request.tracks.length || request.tracks.length > 255) throw new Error('Select tracks to delete.');
        const indices = [...new Set(request.tracks.map(i => trackNumber(i, current.tracks.length)))].sort((a, b) => b - a);
        const names = indices.map(i => `${i + 1}. ${current.tracks[i].name}`).join('\n');
        if (!await confirm(`Permanently delete ${indices.length} track(s)?`, names)) return current;
        current = await this.assertUnchanged(current.revision);
        for (const index of indices) {
          const expected = current.tracks.filter((_, i) => i !== index).map(({ no, ...t }) => t);
          await this.tool('netmdcli', ['delete', index, index], 90000);
          current = await this.readDisc();
          if (JSON.stringify(expected) !== JSON.stringify(current.tracks.map(({ no, ...t }) => t))) {
            throw new Error('Deletion could not be verified. No further tracks were deleted. Refresh the disc.');
          }
        }
      }
      return current;
    });
  }

  async upload(request, confirm) {
    if (!request || !['SP', 'LP2', 'LP4'].includes(request.mode) ||
        !Array.isArray(request.tracks) || !request.tracks.length || request.tracks.length > 255) {
      throw new Error('Select audio files and a recording mode.');
    }
    const cdReadSpeed = validateReadSpeed(request.cdReadSpeed);
    const selected = request.tracks.map(t => {
      if (!t || !this.files.has(t.id)) throw new Error('An audio file is no longer in the queue. Add it again.');
      return { ...this.files.get(t.id), title: safeTitle(t.title) };
    });
    if (new Set(selected.map(t => t.id)).size !== selected.length) throw new Error('A file is selected more than once.');
    const discTitle = request.discTitle ? safeTitle(request.discTitle) : '';
    return this.operation('Preparing transfer…', async () => {
      const device = requireOneDevice(await this.enumerate());
      this.requireReadySession(device);
      let disc = await this.assertUnchanged(request.revision);
      const factor = { SP: 1, LP2: 2, LP4: 4 }[request.mode];
      // Reserve two seconds per track for the medium's allocation units.
      const needed = selected.reduce((sum, t) => sum + t.duration / factor + 2, 0);
      if (needed > capacitySeconds(disc.availableTime)) throw new Error('The selected audio will not fit. Remove tracks or choose a longer recording mode.');
      if (selected.length + disc.tracks.length > 255) throw new Error('A MiniDisc can contain at most 255 tracks.');
      if (disc.groupCount > 1) throw new Error('Recording to grouped discs is not supported in this version.');
      if (discTitle && disc.tracks.length) throw new Error('Automatic album naming is only available when the MiniDisc is empty.');
      if (!await confirm(`Record ${selected.length} track(s) in ${request.mode}?`,
        `New tracks will be appended. Keep the recorder connected until the transfer finishes.${discTitle ? `\nMiniDisc title after recording: ${discTitle}` : ''}`)) return { completed: [], cancelled: true };
      disc = await this.assertUnchanged(disc.revision);
      const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'platinum-md-next-'));
      const completed = [];
      try {
        for (const [i, track] of selected.entries()) {
          if (this.stopRequested) break;
          const pcm = path.join(temporary, 'audio.wav');
          const encoded = path.join(temporary, 'audio.at3');
          const timings = [];
          const context = { track: i + 1, total: selected.length, title: track.title, mode: request.mode,
            ...(track.source === 'cd' ? { cdReadSpeed } : {}) };
          const measurement = { ...context, source: track.source || 'file', durationSeconds: track.duration,
            startedAt: new Date().toISOString(), stages: [] };
          this.transferTimings.push(measurement);
          if (this.transferTimings.length > 255) this.transferTimings.shift();
          const stage = async (name, label, task) => {
            const started = performance.now();
            this.status(`${label} · ${i + 1} of ${selected.length}: ${track.title}`,
              { busy: true, recording: true, stage: { name, label, timings: [...timings] } });
            this.log('recording-stage-start', { ...context, stage: name });
            let success = false;
            try {
              const result = await task();
              success = true;
              return result;
            } finally {
              const elapsedMs = Math.round(performance.now() - started);
              measurement.stages.push({ stage: name, elapsedMs, success });
              this.log('recording-stage-finish', { ...context, stage: name, elapsedMs, success });
              if (success) timings.push({ name, label, elapsedMs });
            }
          };
          if (track.source === 'cd') {
            await fs.rm(pcm, { force: true });
            measurement.cdReadSteps = [];
            await stage('cd-read', 'Reading CD', () => this.audioCd.readTrack(track.cd, pcm, cdReadSpeed, detail => {
              measurement.cdReadSteps.push({ ...detail });
              this.log('cd-read-step', { ...context, ...detail });
            }));
          } else {
            const stat = await fs.stat(track.path);
            if (stat.size !== track.size || stat.mtimeMs !== track.mtimeMs) throw new Error('An audio file changed after it was added. Add it again.');
            await stage('convert', 'Converting audio', () => this.tool('ffmpeg',
              ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', track.path,
                '-map', '0:a:0', '-vn', '-map_metadata', '-1', '-ac', '2', '-ar', '44100', '-c:a', 'pcm_s16le', pcm], 30 * 60 * 1000));
          }
          let file = pcm;
          if (request.mode !== 'SP') {
            await stage('encode', `Encoding ${request.mode}`, () => this.tool('atracdenc',
              ['-e', 'atrac3', '-i', pcm, '-o', encoded, '--container', 'riff',
                '--bitrate', request.mode === 'LP2' ? '128' : '64'], 30 * 60 * 1000));
            file = encoded;
          }
          // Recheck after conversion: users can unplug or replace a disc while
          // an audio encoder is running. Never automatically retry a write.
          disc = await stage('check-disc', 'Checking MiniDisc', () => this.assertUnchanged(disc.revision));
          const count = disc.tracks.length;
          try {
            await stage('transfer', 'Sending to MiniDisc', () => this.tool('netmdcli', ['-v', 'send', file, track.title], 2 * 60 * 60 * 1000));
          } catch (error) {
            this.recordingBlockedKey = this.deviceKey;
            if (error.exitCode === 2) {
              // The helper explicitly confirmed commit, then failed cleanup.
              // Remove the committed item so a retry cannot duplicate it.
              completed.push(track.id);
              this.files.delete(track.id);
              this.emit('uploaded', track.id);
              this.log('recording-committed-cleanup-failed', { title: track.title });
              throw new Error('The recorder committed the track, but closing the recording session failed. The queue has stopped. Reconnect USB and refresh the disc to check it before another recording.');
            }
            throw new Error('Recording stopped because communication with the recorder failed. Save Diagnostics, then reconnect USB and refresh the disc before trying again. A partial track may exist.');
          }
          // A successful helper has confirmed commit. A later listing failure
          // must not leave this item queued for an accidental duplicate write.
          completed.push(track.id);
          this.files.delete(track.id);
          this.emit('uploaded', track.id);
          disc = await stage('verify', 'Verifying recording', async () => {
            const result = await this.readDisc();
            if (result.tracks.length !== count + 1 || result.tracks.at(-1).name !== track.title) {
              throw new Error('The last recording could not be verified. The queue has stopped. Refresh the disc before retrying.');
            }
            return result;
          });
        }
        if (discTitle && !this.stopRequested && completed.length === selected.length) {
          this.status('Naming MiniDisc…', { busy: true, recording: true });
          try {
            disc = await this.assertUnchanged(disc.revision);
            await this.tool('netmdcli', ['settitle', discTitle]);
            disc = await this.readDisc();
            if (disc.title !== discTitle) throw new Error('Title readback differs.');
          } catch {
            throw new Error('The tracks were recorded, but the album title could not be verified. Refresh the disc before changing its title; do not record those tracks again.');
          }
        }
        return { completed, cancelled: this.stopRequested };
      } finally {
        // Only this process's uniquely created scratch directory is removed.
        await fs.rm(temporary, { recursive: true, force: true });
      }
    });
  }
}

module.exports = { NetMdService };

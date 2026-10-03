<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { palettes, defaultAppearance, readAppearance, saveAppearance, applyAppearance } from './appearance.mjs';
import { cdReadSpeeds, readCdReadSpeed, saveCdReadSpeed } from './cd-settings.mjs';

const api = window.netmd;
const version = ref('1.0.1');
const appearance = ref(readAppearance()), appearanceDialog = ref(null), appearanceSaved = ref(true);
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
const refreshAppearance = () => applyAppearance(appearance.value, document.documentElement, systemTheme.matches);
watch(appearance, () => { refreshAppearance(); appearanceSaved.value = saveAppearance(appearance.value); }, { deep: true });
refreshAppearance();
const disc = ref(null), devices = ref([]), files = ref([]), selected = ref([]), mediaState = ref('unknown');
const mode = ref('SP'), busy = ref(false), recording = ref(false), stopping = ref(false);
const cdReadSpeed = ref(readCdReadSpeed()), cdSpeedSaved = ref(true);
watch(cdReadSpeed, value => { cdSpeedSaved.value = saveCdReadSpeed(value); });
const recordingStage = ref(null), stageElapsed = ref(0);
let stageClock;
watch(recordingStage, stage => {
  clearInterval(stageClock);
  stageElapsed.value = 0;
  if (stage) {
    const started = performance.now();
    stageClock = setInterval(() => { stageElapsed.value = (performance.now() - started) / 1000; }, 1000);
  }
});
const message = ref('Connect your NetMD recorder to get started.'), error = ref(''), connectionError = ref('');
const diagnostics = ref(false), logs = ref([]), editor = ref(null), editValue = ref('');
const cdDialog = ref(null), cdDrives = ref([]), cdDevice = ref(''), audioCd = ref(null), cdError = ref('');
const cdSelection = computed(() => audioCd.value?.tracks.filter(t => t.selected) || []);
const cdMatches = ref([]), cdRelease = ref(''), lookupBusy = ref(false), lookupMessage = ref('');
const automaticLookup = ref(true), useAlbumTitle = ref(true);
try { automaticLookup.value = localStorage.getItem('platinum-md-next.cd-lookup') !== 'off'; } catch {}
let lookupSequence = 0;
watch(automaticLookup, enabled => {
  try { localStorage.setItem('platinum-md-next.cd-lookup', enabled ? 'on' : 'off'); } catch {}
  if (enabled && audioCd.value) lookupCd();
  if (!enabled) { lookupSequence++; lookupBusy.value = false; lookupMessage.value = 'Automatic lookup is off. You can still use Look up album.'; }
});
const chosenAlbum = computed(() => cdMatches.value.find(r => r.id === cdRelease.value));
const cdTrackName = track => chosenAlbum.value?.tracks.find(t => t.number === track.number)?.title || track.title;
const cdTrackArtist = track => chosenAlbum.value?.tracks.find(t => t.number === track.number)?.artist || '';
const albumOption = album => [album.exact ? '' : 'Possible match', album.artist, album.album,
  album.date, album.country, album.edition, `Disc ${album.discNumber}`].filter(Boolean).join(' · ');
let unsubscribe;
const picked = computed(() => files.value.filter(f => f.selected));
const total = computed(() => picked.value.reduce((sum, f) => sum + f.duration, 0));
const suggestedDiscTitle = computed(() => {
  const first = picked.value[0];
  return disc.value?.tracks.length === 0 && first?.albumKey &&
    picked.value.every(f => f.albumKey === first.albumKey) ? first.suggestedDiscTitle || '' : '';
});
const canEdit = computed(() => disc.value && !busy.value);
const recordingUnavailable = computed(() => {
  if (!disc.value) return '';
  if (/^00:00:00\.00$/.test(disc.value.availableTime)) return 'This disc is full. Use another MiniDisc to record more music.';
  if (disc.value.groupCount > 1) return 'Recording to grouped discs is unavailable in this version.';
  return '';
});
const oneTrack = computed(() => selected.value.length === 1 ? disc.value?.tracks.find(t => t.no === selected.value[0]) : null);
const logText = computed(() => logs.value.map(l => `${l.time}  ${l.event}  ${JSON.stringify(l)}`).join('\n'));
const time = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

async function perform(task, connection = false) {
  if (!api) return;
  const target = connection ? connectionError : error;
  target.value = '';
  try { return await task(); } catch (e) { target.value = e.message; }
}
async function addFiles() {
  const result = await perform(() => api.addFiles());
  if (!result) return;
  files.value.push(...result.files.map(f => ({ ...f, selected: true })));
  if (result.errors.length) error.value = result.errors.join('\n');
}
async function clearQueue() {
  const ids = files.value.map(f => f.id);
  await perform(async () => { await api.forgetFiles(ids); files.value = []; });
}
async function readCd() {
  lookupSequence++; lookupBusy.value = false; cdMatches.value = []; cdRelease.value = ''; lookupMessage.value = '';
  cdError.value = ''; audioCd.value = null;
  try {
    const result = await api.scanCd(cdDevice.value);
    audioCd.value = { ...result, tracks: result.tracks.map(t => ({ ...t, selected: !t.unavailable })) };
    if (automaticLookup.value) lookupCd();
  } catch (e) { cdError.value = e.message; }
}
async function lookupCd(refresh = false) {
  if (!audioCd.value) return;
  const sequence = ++lookupSequence, cd = audioCd.value;
  lookupBusy.value = true; lookupMessage.value = 'Looking up album information…';
  try {
    const result = await api.lookupCd({ device: cd.device, revision: cd.revision, refresh: refresh === true });
    if (sequence !== lookupSequence || audioCd.value?.revision !== cd.revision || !cdDialog.value.open) return;
    cdMatches.value = result.candidates;
    const exact = result.candidates.filter(r => r.exact);
    cdRelease.value = exact.length === 1 ? exact[0].id : '';
    lookupMessage.value = result.message || (result.candidates.length ?
      `${result.cached ? 'Saved MusicBrainz information. ' : ''}${exact.length === 1 ? 'Check the album and track names below.' : 'Choose the edition that matches your CD, or continue without names.'}` :
      'No matching album found. You can still add the tracks and edit their names.');
  } catch (e) {
    if (sequence === lookupSequence && audioCd.value?.revision === cd.revision) lookupMessage.value = e.message;
  } finally { if (sequence === lookupSequence) lookupBusy.value = false; }
}
async function refreshCdDrives() {
  lookupSequence++; lookupBusy.value = false; cdMatches.value = []; cdRelease.value = ''; lookupMessage.value = '';
  cdError.value = ''; audioCd.value = null;
  try {
    cdDrives.value = await api.cdDrives();
    cdDevice.value = cdDrives.value.find(d => d.accessible)?.device || cdDrives.value[0]?.device || '';
    if (cdDevice.value) await readCd();
  } catch (e) { cdError.value = e.message; }
}
async function openCd() {
  cdDialog.value.showModal();
  await refreshCdDrives();
}
async function addCd() {
  cdError.value = '';
  try {
    const result = await api.addCd({ device: audioCd.value.device, revision: audioCd.value.revision,
      releaseId: cdRelease.value || undefined,
      tracks: cdSelection.value.map(t => t.number) });
    files.value.push(...result.files.map(f => ({ ...f, selected: true })));
    cdDialog.value.close();
  } catch (e) { cdError.value = e.message; }
}
async function removeFile(id) {
  await perform(async () => { await api.forgetFiles([id]); files.value = files.value.filter(f => f.id !== id); });
}
function reorder(index, offset) {
  const list = [...files.value];
  const target = index + offset;
  if (target < 0 || target >= list.length) return;
  [list[index], list[target]] = [list[target], list[index]];
  files.value = list;
}
function edit(type, track = null) {
  editor.value = { type, track };
  editValue.value = type === 'renameDisc' ? disc.value.title : type === 'moveTrack' ? String(track.no + 1) : track.title ?? track.name;
}
async function saveEdit() {
  const { type, track } = editor.value;
  if (type === 'localTitle') {
    const item = files.value.find(f => f.id === track.id);
    if (item) item.title = editValue.value;
    editor.value = null;
    return;
  }
  const request = { action: type, revision: disc.value.revision, title: editValue.value };
  if (track) request.track = track.no;
  if (type === 'moveTrack') request.to = Number(editValue.value) - 1;
  editor.value = null;
  await perform(() => api.edit(request));
}
async function record() {
  stopping.value = false;
  const result = await perform(() => api.upload({ mode: mode.value, revision: disc.value.revision,
    cdReadSpeed: cdReadSpeed.value,
    discTitle: useAlbumTitle.value ? suggestedDiscTitle.value : '',
    tracks: picked.value.map(f => ({ id: f.id, title: f.title })) }));
  if (result?.completed?.length) message.value = `${result.completed.length} track(s) recorded. After disconnecting, press STOP on the recorder and wait for TOC Edit to clear before opening the lid.`;
}
async function action(name) {
  await perform(() => api.edit({ action: name, revision: disc.value.revision,
    ...(name === 'play' && oneTrack.value ? { track: oneTrack.value.no } : {}),
    ...(name === 'deleteTracks' ? { tracks: [...selected.value] } : {}) }));
}
async function saveReport() {
  await perform(async () => { if (await api.saveDiagnostics()) message.value = 'Diagnostic report saved.'; });
}

onMounted(async () => {
  systemTheme.addEventListener('change', refreshAppearance);
  if (!api) { error.value = 'Open this app using the Platinum-MD Next desktop launcher.'; return; }
  unsubscribe = api.onEvent(({ type, value }) => {
    if (type === 'disc') { disc.value = value; selected.value = []; }
    if (type === 'media-state') mediaState.value = value;
    if (type === 'devices') devices.value = value;
    if (type === 'log') { logs.value.push(value); if (logs.value.length > 1000) logs.value.shift(); }
    if (type === 'uploaded') files.value = files.value.filter(f => f.id !== value);
    if (type === 'status') {
      message.value = value.message;
      busy.value = Boolean(value.busy);
      recording.value = Boolean(value.recording);
      recordingStage.value = value.stage || null;
      if (value.clearConnectionError) connectionError.value = '';
      if (value.error) {
        if (value.errorScope === 'connection') connectionError.value = value.message;
        else error.value = value.message;
      }
    }
  });
  await perform(async () => {
    const info = await api.info();
    version.value = info.version; devices.value = info.devices; disc.value = info.disc; logs.value = info.logs;
    mediaState.value = info.mediaState || 'unknown';
  });
});
onUnmounted(() => { unsubscribe?.(); clearInterval(stageClock); systemTheme.removeEventListener('change', refreshAppearance); });
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="brand"><span class="brand-disc" aria-hidden="true"></span><h1>Platinum-MD <span>Next</span></h1></div>
      <div class="header-actions"><span class="version-label">{{ version }}</span><button @click="appearanceDialog.showModal()">Appearance</button><button @click="diagnostics = true">Diagnostics</button></div>
    </header>

    <section class="connection" :class="{ connected: disc || mediaState === 'no-disc' }" aria-live="polite">
      <span class="connection-dot" :class="{ pulse: busy }"></span>
      <div class="connection-message"><strong>{{ disc?.device || devices[0]?.model || 'Waiting for a recorder' }}</strong><p>{{ message }}</p>
        <p v-if="recordingStage" class="stage-timings" aria-live="off"><span>{{ time(stageElapsed) }} elapsed in this step</span><span v-for="timing in recordingStage.timings.filter(t => !['check-disc', 'verify'].includes(t.name))" :key="timing.name">{{ timing.label }}: {{ time(timing.elapsedMs / 1000) }}</span></p>
      </div>
      <button :disabled="busy || !api" @click="perform(() => api.connect(), true)">{{ disc || mediaState === 'no-disc' ? 'Refresh disc' : 'Connect / Retry' }}</button>
    </section>

    <div v-if="error || connectionError" class="error-message" role="alert"><div><strong>Something needs attention</strong><p>{{ error || connectionError }}</p><button class="text-button" @click="diagnostics = true">View diagnostics</button></div><button class="icon-button" aria-label="Dismiss error" @click="error = ''; connectionError = ''">×</button></div>

    <main class="workspace">
      <section class="panel music-panel">
        <div class="panel-heading queue-heading"><div><p class="eyebrow">FROM YOUR COMPUTER</p><h2>Recording queue <span class="count">{{ files.length }}</span></h2></div><div class="queue-add"><button :disabled="busy || !api" @click="openCd">Add audio CD</button><button :disabled="busy || !api" @click="addFiles">+ Add audio</button></div></div>
        <div v-if="!files.length" class="empty-state"><div class="audio-symbol" aria-hidden="true">♫</div><h3>Make your next mix.</h3><p>Add music, arrange your tracks,<br>then record them to MiniDisc.</p><p class="formats">FLAC · MP3 · WAV · AAC · and more</p></div>
        <div v-else class="track-list">
          <div class="list-bar"><label><input type="checkbox" :checked="picked.length === files.length" :disabled="busy" @change="files.forEach(f => f.selected = $event.target.checked)"> Select all</label><button class="text-button" :disabled="busy" @click="clearQueue">Clear queue</button></div>
          <div v-for="(file, index) in files" :key="file.id" class="file-row">
            <input v-model="file.selected" type="checkbox" :disabled="busy" :aria-label="`Select ${file.title}`">
            <span class="track-number">{{ String(index + 1).padStart(2, '0') }}</span>
            <button class="track-title" :disabled="busy" @click="edit('localTitle', file)"><strong>{{ file.title }}</strong><small>{{ [file.artist, file.album].filter(Boolean).join(' · ') || file.filename }}</small></button>
            <time>{{ time(file.duration) }}</time>
            <div class="row-actions"><button class="icon-button" :disabled="busy || index === 0" :aria-label="`Move ${file.title} up`" @click="reorder(index, -1)">↑</button><button class="icon-button" :disabled="busy || index === files.length - 1" :aria-label="`Move ${file.title} down`" @click="reorder(index, 1)">↓</button><button class="icon-button" :disabled="busy" :aria-label="`Remove ${file.title}`" @click="removeFile(file.id)">×</button></div>
          </div>
        </div>
        <div class="record-settings">
          <div class="setting-row"><label for="record-mode">Recording quality</label><select id="record-mode" v-model="mode" :disabled="busy"><option value="SP">SP · Best quality</option><option value="LP2">LP2 · Double length</option><option value="LP4">LP4 · Quadruple length</option></select></div>
          <p class="hint">{{ mode === 'SP' ? 'The recorder encodes the audio in full-quality SP.' : 'LP2 and LP4 use the open-source ATRAC encoder.' }}</p>
          <template v-if="files.some(f => f.source === 'cd')">
            <div class="setting-row cd-speed-setting"><label for="cd-read-speed">CD read speed</label><select id="cd-read-speed" v-model="cdReadSpeed" :disabled="busy" aria-describedby="cd-speed-hint"><option v-for="speed in cdReadSpeeds" :key="speed.value" :value="speed.value">{{ speed.label }}</option></select></div>
            <p id="cd-speed-hint" class="hint">Requested drive speed; the drive may limit it. Error correction stays on. This affects CD reading; encoding and MiniDisc transfer have their own speeds.</p>
            <p v-if="!cdSpeedSaved" class="hint">This speed applies now, but could not be saved for next time.</p>
          </template>
          <p v-if="files.some(f => f.source === 'cd')" class="hint">Keep the audio CD in its drive until recording finishes. Click a queued title to rename it.</p>
          <label v-if="suggestedDiscTitle" class="album-disc-title"><input v-model="useAlbumTitle" type="checkbox" :disabled="busy"><span>Name this MiniDisc <strong>{{ suggestedDiscTitle }}</strong></span></label>
          <p v-if="recordingUnavailable" class="hint">{{ recordingUnavailable }}</p>
          <div class="record-footer"><div><strong>{{ picked.length }} {{ picked.length === 1 ? 'track' : 'tracks' }} selected</strong><span>{{ time(total) }} of music</span></div><button v-if="recording" class="primary" :disabled="stopping" @click="perform(async () => { await api.stopAfterTrack(); stopping = true; })">{{ stopping ? 'Stopping after this track…' : 'Stop after this track' }}</button><button v-else class="primary" :disabled="!disc || busy || !picked.length || !!recordingUnavailable" @click="record">Record to MiniDisc →</button></div>
        </div>
      </section>

      <section class="panel disc-panel">
        <div class="panel-heading"><div><p class="eyebrow">ON YOUR RECORDER</p><h2>{{ disc?.title || 'Your MiniDisc' }}</h2></div><button :disabled="!canEdit || disc?.groupCount > 1" @click="edit('renameDisc')">Rename disc</button></div>
        <template v-if="disc">
          <div class="disc-summary"><span>{{ disc.tracks.length }} tracks</span><span>{{ disc.availableTime.replace(/\.\d+$/, '') }} free in SP</span></div>
          <p v-if="disc.groupCount > 1" class="group-notice">This disc contains groups. Recording, moving, deleting and renaming the disc are unavailable in this version.</p>
          <div v-if="!disc.tracks.length" class="empty-state"><div class="mini-disc" aria-hidden="true"><i></i></div><h3>A fresh start.</h3><p>Your MiniDisc is ready for music.</p></div>
          <div v-else class="track-list disc-tracks"><table><thead><tr><th><input type="checkbox" :disabled="busy" :checked="selected.length === disc.tracks.length" aria-label="Select all disc tracks" @change="selected = $event.target.checked ? disc.tracks.map(t => t.no) : []"></th><th>#</th><th>TRACK</th><th>MODE</th><th>LENGTH</th></tr></thead><tbody><tr v-for="track in disc.tracks" :key="track.no" :class="{ selected: selected.includes(track.no) }"><td><input v-model="selected" type="checkbox" :value="track.no" :disabled="busy" :aria-label="`Select ${track.name}`"></td><td class="track-number">{{ String(track.no + 1).padStart(2, '0') }}</td><td class="disc-track-title">{{ track.name || 'Untitled track' }}</td><td><span class="mode-badge">{{ track.bitrate }}</span></td><td><time>{{ track.time.slice(0, -3) }}</time></td></tr></tbody></table></div>
          <div class="disc-tools"><div><button :disabled="!canEdit || !oneTrack" @click="edit('renameTrack', oneTrack)">Rename</button><button :disabled="!canEdit || !oneTrack || disc.groupCount > 1" @click="edit('moveTrack', oneTrack)">Move</button><button class="danger" :disabled="!canEdit || !selected.length || disc.groupCount > 1" @click="action('deleteTracks')">Delete</button></div><span>{{ selected.length }} selected</span></div>
          <div class="playback"><span>Listen on your recorder</span><div><button :disabled="!canEdit" aria-label="Previous track" @click="action('previous')">‹</button><button :disabled="!canEdit || !disc.tracks.length" @click="action('play')">▶ Play</button><button :disabled="!canEdit" @click="action('pause')">Ⅱ Pause</button><button :disabled="!canEdit" @click="action('stop')">■ Stop</button><button :disabled="!canEdit" aria-label="Next track" @click="action('next')">›</button></div></div>
        </template>
        <div v-else class="empty-state"><div class="mini-disc" aria-hidden="true"><i></i></div><h3>{{ mediaState === 'no-disc' ? 'Insert a MiniDisc.' : 'Bring your MiniDisc back.' }}</h3><p v-if="mediaState === 'no-disc'">Your recorder is connected.<br>Insert a MiniDisc, close the lid, then choose Refresh disc.</p><p v-else>Insert a disc and connect a NetMD recorder.<br>Your tracks will appear here.</p><p class="formats">One recorder at a time · NetMD mode</p></div>
      </section>
    </main>
    <footer class="app-footer"><span>Community fork of Platinum-MD by Gavin Benda</span><span>Linux desktop · SP, LP2 and LP4</span></footer>

    <dialog ref="cdDialog" class="dialog cd-dialog" aria-labelledby="cd-heading" @cancel="busy && $event.preventDefault()" @close="lookupSequence++; lookupBusy = false">
      <div class="appearance-heading"><div><p class="eyebrow">CD TO MINIDISC</p><h2 id="cd-heading">Add audio CD</h2></div><button :disabled="busy" @click="cdDialog.close()">Close</button></div>
      <p class="appearance-intro">Choose songs for your recording queue. Keep the CD inserted, then click Record to MiniDisc.</p>
      <label class="cd-lookup-toggle"><input v-model="automaticLookup" type="checkbox"> Look up albums automatically with MusicBrainz</label>
      <div class="cd-drive-controls"><label v-if="cdDrives.length" for="cd-drive">CD drive</label><select v-if="cdDrives.length" id="cd-drive" v-model="cdDevice" :disabled="busy" @change="readCd"><option v-for="drive in cdDrives" :key="drive.device" :value="drive.device">{{ drive.label }}</option></select><button :disabled="busy" @click="refreshCdDrives">Refresh drives</button></div>
      <p v-if="!cdDrives.length && !busy">Connect a CD/DVD drive, insert a music CD, then refresh the drive list.</p>
      <p v-if="busy" role="status">{{ message }}</p><p v-if="cdError" class="error-message" role="alert">{{ cdError }}</p>
      <template v-if="audioCd">
        <div class="cd-lookup-heading"><p class="hint" role="status">{{ lookupMessage || 'Album information is optional.' }}</p><button :disabled="busy || lookupBusy" @click="lookupCd(true)">{{ lookupBusy ? 'Looking up…' : 'Look up album' }}</button></div>
        <label v-if="cdMatches.length" class="cd-album-picker" for="cd-album">Album / edition<select id="cd-album" v-model="cdRelease" :disabled="busy || lookupBusy"><option value="">Continue without album names</option><option v-for="album in cdMatches" :key="album.id" :value="album.id">{{ albumOption(album) }}</option></select></label>
        <div v-if="chosenAlbum" class="cd-album-summary"><strong>{{ chosenAlbum.album }}</strong><span>{{ chosenAlbum.artist }}</span><small v-if="!chosenAlbum.exact">Possible match — check the track names before adding.</small></div>
        <div class="list-bar"><label><input type="checkbox" :disabled="busy" :checked="cdSelection.length === audioCd.tracks.filter(t => !t.unavailable).length" @change="audioCd.tracks.forEach(t => t.selected = !t.unavailable && $event.target.checked)"> Select all</label><span>{{ cdSelection.length }} selected</span></div>
        <div class="cd-track-list"><label v-for="track in audioCd.tracks" :key="track.number" class="cd-track"><input v-model="track.selected" type="checkbox" :disabled="busy || !!track.unavailable"><span>{{ cdTrackName(track) }}<small v-if="cdTrackArtist(track)">{{ cdTrackArtist(track) }}</small><small v-if="track.unavailable">{{ track.unavailable }}</small></span><time>{{ time(track.duration) }}</time></label></div>
        <p class="hint">MusicBrainz receives the CD's track timings, never your audio files. Found albums are saved on this computer. Names can be edited in the queue; accents are simplified for the recorder.</p>
      </template>
      <div class="dialog-actions"><button class="primary" :disabled="busy || !cdSelection.length" @click="addCd">Add {{ cdSelection.length || '' }} tracks to queue</button></div>
    </dialog>

    <dialog ref="appearanceDialog" class="dialog appearance-dialog" aria-labelledby="appearance-heading" @click="$event.target === appearanceDialog && appearanceDialog.close()">
      <div class="appearance-heading"><div><p class="eyebrow">MAKE IT YOURS</p><h2 id="appearance-heading">Appearance</h2></div><button autofocus @click="appearanceDialog.close()">Done</button></div>
      <p class="appearance-intro">A little personality for your next mix. Changes appear immediately.</p>
      <fieldset class="palette-options"><legend>Colour palette</legend>
        <label v-for="palette in palettes" :key="palette.id" class="palette-option" :class="{ chosen: appearance.palette === palette.id }">
          <span class="palette-swatch" :data-swatch="palette.id" aria-hidden="true"></span>
          <span class="palette-name"><input v-model="appearance.palette" type="radio" name="palette" :value="palette.id">{{ palette.name }}</span>
          <small>{{ palette.description }}</small>
        </label>
      </fieldset>
      <fieldset class="mode-options"><legend>Brightness</legend>
        <label><input v-model="appearance.mode" type="radio" name="brightness" value="system"> Follow system</label>
        <label><input v-model="appearance.mode" type="radio" name="brightness" value="light"> Light</label>
        <label><input v-model="appearance.mode" type="radio" name="brightness" value="dark"> Dark</label>
      </fieldset>
      <div class="appearance-footer"><p class="hint" role="status">{{ appearanceSaved ? 'Your choice is remembered on this computer.' : 'Applied for now. Your choice could not be saved on this computer.' }}</p><button class="text-button" @click="appearance = { ...defaultAppearance }">Reset appearance</button></div>
    </dialog>

    <div v-if="editor" class="modal-backdrop" @keydown.esc="editor = null"><form class="dialog editor" role="dialog" aria-modal="true" aria-labelledby="edit-heading" @submit.prevent="saveEdit"><h2 id="edit-heading">{{ editor.type === 'moveTrack' ? 'Move track' : 'Edit title' }}</h2><label for="edit-field">{{ editor.type === 'moveTrack' ? 'New position' : 'Title (basic Latin characters)' }}</label><input id="edit-field" v-model="editValue" autofocus required :type="editor.type === 'moveTrack' ? 'number' : 'text'" :min="1" :max="disc?.tracks.length" maxlength="120"><p v-if="editor.type !== 'moveTrack'" class="hint">Accents are simplified for older NetMD displays.</p><div class="dialog-actions"><button type="button" @click="editor = null">Cancel</button><button class="primary" type="submit">Save</button></div></form></div>

    <div v-if="diagnostics" class="modal-backdrop" @keydown.esc="diagnostics = false"><section class="dialog diagnostics" role="dialog" aria-modal="true" aria-labelledby="diagnostics-heading"><div class="panel-heading"><div><p class="eyebrow">CONNECTION HELP</p><h2 id="diagnostics-heading">Diagnostics</h2></div><button aria-label="Close diagnostics" @click="diagnostics = false">Close</button></div><p>Connect your recorder with a disc inserted and close other MiniDisc apps. Retry once, then save this report if it still fails.</p><p v-if="devices.length && !devices[0].writable" class="error-message">USB access is blocked. Ask an administrator to install the included NetMD USB rule once. Run the app from your normal account.</p><div class="device-details"><strong>{{ devices[0]?.model || 'No recorder detected' }}</strong><span>{{ devices[0]?.id || 'USB device not present' }}</span><span>{{ devices[0]?.writable ? 'USB read/write access available' : 'USB access not confirmed' }}</span></div><pre tabindex="0">{{ logText || 'No diagnostic events yet.' }}</pre><div class="dialog-actions"><span class="hint">Reports may include music titles and local file paths.</span><button class="primary" @click="saveReport">Save report</button></div></section></div>
  </div>
</template>

'use strict';

const { app, BrowserWindow, ipcMain, dialog, protocol, net, session } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { nativePaths } = require('./paths.cjs');
const { enumerateUsb } = require('./usb.cjs');
const { NetMdService } = require('./service.cjs');
const { DeviceMonitor } = require('./device-monitor.cjs');

protocol.registerSchemesAsPrivileged([{ scheme: 'platinum', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
app.setName('Platinum-MD Next');
const gotLock = app.requestSingleInstanceLock();
let window, service, monitor, poll, closing = false;
if (!gotLock) app.quit();

function register(channel, handler) {
  ipcMain.handle(channel, async (event, payload) => {
    if (event.sender !== window?.webContents || event.senderFrame !== window.webContents.mainFrame ||
        event.senderFrame.url !== 'platinum://app/index.html') throw new Error('Untrusted sender.');
    try { return { ok: true, value: await handler(payload) }; }
    catch (error) {
      service.log('operation-error', { message: error.message });
      return { ok: false, error: error.message };
    }
  });
}

async function confirm(message, detail) {
  const result = await dialog.showMessageBox(window, { type: 'question', title: 'Platinum-MD Next',
    message, detail, buttons: ['Cancel', 'Continue'], defaultId: 0, cancelId: 0, noLink: true });
  return result.response === 1;
}

if (gotLock) app.whenReady().then(async () => {
  if (process.platform !== 'linux') {
    dialog.showErrorBox('Linux build', 'This release supports Linux.');
    return app.quit();
  }
  const uiRoot = path.join(__dirname, '..', 'dist', 'ui');
  protocol.handle('platinum', request => {
    const url = new URL(request.url);
    if (url.host !== 'app') return new Response('Not found', { status: 404 });
    let filename;
    try { filename = path.resolve(uiRoot, '.' + decodeURIComponent(url.pathname)); }
    catch { return new Response('Not found', { status: 404 }); }
    if (!filename.startsWith(uiRoot + path.sep)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(filename).toString());
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  window = new BrowserWindow({ width: 1260, height: 820, minWidth: 900, minHeight: 640,
    title: 'Platinum-MD Next', backgroundColor: '#f6f7f5',
    icon: path.join(__dirname, '..', 'static', 'icons', '256x256.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false,
      contextIsolation: true, sandbox: true, webSecurity: true, webviewTag: false }
  });
  window.setMenu(null);
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  service = new NetMdService({ ...nativePaths(app.isPackaged ? process.resourcesPath : undefined),
    metadataCache: path.join(app.getPath('userData'), 'cd-albums.json') }, (type, value) => {
    if (window && !window.isDestroyed()) window.webContents.send('app:event', { type, value });
  });
  service.log('app-start', { version: app.getVersion(), electron: process.versions.electron,
    platform: process.platform, arch: process.arch });
  monitor = new DeviceMonitor(service);
  register('app:info', async () => ({ version: app.getVersion(), electron: process.versions.electron,
    devices: await enumerateUsb(), disc: service.disc, mediaState: service.mediaState, logs: service.logs }));
  register('device:connect', () => service.connect());
  register('files:add', async () => {
    if (service.gate.busy) throw new Error('Wait for the current operation to finish.');
    const result = await dialog.showOpenDialog(window, { title: 'Add audio files',
      properties: ['openFile', 'multiSelections'], filters: [
        { name: 'Audio', extensions: ['flac', 'mp3', 'wav', 'm4a', 'aac', 'ogg', 'opus', 'aif', 'aiff', 'wma', 'ape'] },
        { name: 'All files', extensions: ['*'] }
      ] });
    return result.canceled ? { files: [], errors: [] } : service.importFiles(result.filePaths);
  });
  register('files:add-paths', paths => {
    if (service.gate.busy) throw new Error('Wait for the current operation to finish.');
    if (!Array.isArray(paths) || !paths.length || paths.length > 255 ||
        paths.some(p => typeof p !== 'string' || !path.isAbsolute(p))) throw new Error('Drop audio files from your computer.');
    return service.importFiles(paths);
  });
  register('files:forget', ids => service.forgetFiles(ids));
  register('cd:drives', () => service.audioCd.enumerate());
  register('cd:scan', device => service.scanCd(device));
  register('cd:lookup', request => service.lookupCd(request));
  register('cd:add', request => service.addCd(request));
  register('device:edit', request => service.edit(request, confirm));
  register('device:upload', request => service.upload(request, confirm));
  register('device:stop-queue', () => { service.stopRequested = true; });
  register('diagnostics:save', async () => {
    const result = await dialog.showSaveDialog(window, { title: 'Save diagnostics',
      defaultPath: 'platinum-md-diagnostics.txt', filters: [{ name: 'Text', extensions: ['txt'] }] });
    if (result.canceled) return false;
    const report = { app: app.getVersion(), electron: process.versions.electron, arch: process.arch,
      devices: await enumerateUsb(), mediaState: service.mediaState,
      transferTimings: service.transferTimings, events: service.logs };
    await fs.writeFile(result.filePath, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
    return true;
  });
  window.on('close', event => {
    if (!service.gate.busy || closing) return;
    event.preventDefault();
    dialog.showMessageBox(window, { type: 'info', message: 'Wait for the current operation to finish.',
      detail: 'During a transfer, use “Stop after this track” before closing Platinum-MD Next.' });
  });
  await window.loadURL('platinum://app/index.html');
  // CI checks the real sandboxed renderer and preload without opening a USB device.
  if (process.env.PLATINUM_SMOKE_TEST === '1') {
    const loaded = await window.webContents.executeJavaScript(`(async () => {
      const info = await window.netmd.info();
      return { heading: document.querySelector('h1')?.textContent, version: info.version,
        nodeHidden: typeof process === 'undefined' && typeof require === 'undefined' };
    })()`);
    if (!loaded.heading?.includes('Platinum-MD') || !loaded.nodeHidden || loaded.version !== app.getVersion()) {
      console.error('Desktop smoke test failed', loaded);
      return app.exit(1);
    }
    console.log('Desktop smoke test passed', JSON.stringify(loaded));
    return app.quit();
  }
  await monitor.scan();
  poll = setInterval(() => monitor.scan(), 2000);
}).catch(error => { dialog.showErrorBox('Could not start Platinum-MD Next', error.message); app.quit(); });

app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
app.on('window-all-closed', () => { clearInterval(poll); app.quit(); });
app.on('before-quit', () => { closing = !service?.gate.busy; });

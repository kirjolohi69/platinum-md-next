'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');
const invoke = async (channel, payload) => {
  const result = await ipcRenderer.invoke(channel, payload);
  if (!result.ok) throw new Error(result.error);
  return result.value;
};
contextBridge.exposeInMainWorld('netmd', {
  info: () => invoke('app:info'),
  connect: () => invoke('device:connect'),
  addFiles: () => invoke('files:add'),
  // Sandboxed pages cannot see local paths; only the preload can resolve a dropped File.
  addDroppedFiles: files => invoke('files:add-paths', Array.from(files, file => webUtils.getPathForFile(file))),
  cdDrives: () => invoke('cd:drives'),
  scanCd: device => invoke('cd:scan', device),
  lookupCd: request => invoke('cd:lookup', request),
  addCd: request => invoke('cd:add', request),
  forgetFiles: ids => invoke('files:forget', ids),
  edit: request => invoke('device:edit', request),
  upload: request => invoke('device:upload', request),
  stopAfterTrack: () => invoke('device:stop-queue'),
  saveDiagnostics: () => invoke('diagnostics:save'),
  onEvent: callback => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('app:event', listener);
    return () => ipcRenderer.removeListener('app:event', listener);
  }
});

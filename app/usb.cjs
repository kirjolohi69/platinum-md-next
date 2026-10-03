'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { constants } = require('node:fs');
const known = require('./devices.json');

// Linux exposes USB descriptors here; polling this avoids an obsolete native
// Node add-on and does not open or send commands to the recorder.
async function enumerateUsb(sysRoot = '/sys/bus/usb/devices', devRoot = '/dev/bus/usb') {
  const devices = [];
  const entries = await fs.readdir(sysRoot);
  for (const entry of entries) {
    if (entry.includes(':')) continue;
    const read = name => fs.readFile(path.join(sysRoot, entry, name), 'utf8').then(s => s.trim());
    try {
      const [vendor, product, bus, number] = await Promise.all(['idVendor', 'idProduct', 'busnum', 'devnum'].map(read));
      const id = `${vendor.toLowerCase()}:${product.toLowerCase()}`;
      if (!known[id]) continue;
      const node = path.join(devRoot, bus.padStart(3, '0'), number.padStart(3, '0'));
      let writable = false;
      try { await fs.access(node, constants.R_OK | constants.W_OK); writable = true; } catch {}
      devices.push({ id, model: known[id], node, writable, key: `${id}:${bus}:${number}` });
    } catch (error) {
      if (!['ENOENT', 'ENODEV', 'EACCES'].includes(error.code)) throw error;
    }
  }
  return devices.sort((a, b) => a.key.localeCompare(b.key));
}

function requireOneDevice(devices) {
  if (!devices.length) throw new Error('No NetMD recorder was found. Insert a disc, connect the recorder and use NetMD mode.');
  if (devices.length !== 1) throw new Error('Connect one NetMD recorder at a time, then retry.');
  if (!devices[0].writable) throw new Error('Linux is denying USB access. An administrator must install the included NetMD USB rule once; then reconnect the recorder.');
  return devices[0];
}
module.exports = { enumerateUsb, requireOneDevice };

'use strict';
const { enumerateUsb } = require('./usb.cjs');

// A newly created USB node can appear before udev/logind grants user access.
// Recheck through the ordinary poll; never delay, retry or replay a write.
class DeviceMonitor {
  constructor(service, { enumerate = enumerateUsb, now = () => performance.now(), permissionGraceMs = 6000 } = {}) {
    this.service = service;
    this.enumerate = enumerate;
    this.now = now;
    this.permissionGraceMs = permissionGraceMs;
    this.lastDevices = '';
    this.pending = null;
    this.scanning = false;
  }

  async scan() {
    const service = this.service;
    if (this.scanning || service.gate.busy) return;
    this.scanning = true;
    try {
      const devices = await this.enumerate();
      if (service.gate.busy) return;
      const fingerprint = JSON.stringify(devices);
      const changed = fingerprint !== this.lastDevices;
      if (changed) {
        this.lastDevices = fingerprint;
        service.log('usb-discovery', { devices });
        service.disc = null;
        service.setMediaState('unknown');
        service.emit('disc', null);
        service.emit('devices', devices);
      }
      if (devices.length === 1 && !devices[0].writable) {
        if (this.pending?.key !== devices[0].key) {
          this.pending = { key: devices[0].key, since: this.now(), warned: false };
          service.status('Waiting for Linux to grant USB access…', { clearConnectionError: true });
        }
        if (!this.pending.warned && this.now() - this.pending.since >= this.permissionGraceMs) {
          this.pending.warned = true;
          service.status('USB access is blocked. Open Diagnostics for the next step.', { error: true, errorScope: 'connection' });
          service.log('usb-access-blocked', { key: devices[0].key });
        }
        return;
      }
      this.pending = null;
      if (!changed) return;
      if (devices.length === 1) await service.connect().catch(() => {});
      else if (devices.length > 1) service.status('Connect one NetMD recorder at a time.', { error: true, errorScope: 'connection' });
      else service.status('Connect your NetMD recorder to get started.', { clearConnectionError: true });
    } catch (error) {
      service.log('usb-discovery-error', { message: error.message });
    } finally { this.scanning = false; }
  }
}

module.exports = { DeviceMonitor };

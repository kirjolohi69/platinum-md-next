#!/usr/bin/env node
'use strict';
const { nativePaths } = require('../app/paths.cjs');
const { enumerateUsb, requireOneDevice } = require('../app/usb.cjs');
const { runTool } = require('../app/runner.cjs');
const { parseDisc } = require('../app/disc.cjs');

async function main() {
  if (process.platform !== 'linux') throw new Error('The diagnostic currently supports Linux only.');
  const trace = process.argv.includes('--trace');
  const paths = nativePaths();
  const log = message => process.stderr.write(`${new Date().toISOString()} ${message}\n`);
  log('Read-only NetMD connection test. Close every other MiniDisc app first.');
  const devices = await enumerateUsb();
  for (const device of devices) log(JSON.stringify(device));
  requireOneDevice(devices);
  const result = await runTool(paths.bin('netmdcli'), [trace ? '-t' : '-v'], {
    env: { ...paths.env, ...(trace ? { LIBUSB_DEBUG: '4' } : {}) }, timeoutMs: 45000,
    onOutput: ({ stream, text }) => { if (stream === 'stderr') log(text.trimEnd()); }
  });
  const disc = parseDisc(result.stdout);
  process.stdout.write(JSON.stringify(disc, null, 2) + '\n');
  log('Success: read the disc listing. No tracks were modified.');
}
main().catch(error => { process.stderr.write(`${error.message}\n${error.stderr || ''}`); process.exitCode = 1; });

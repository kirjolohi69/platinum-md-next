'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { nativePaths } = require('../app/paths.cjs');
const native = nativePaths();
for (const [name, args] of [['netmdcli', ['help']], ['ffmpeg', ['-version']], ['ffprobe', ['-version']], ['atracdenc', ['-h']], ['cdparanoia', ['-V']]]) {
  fs.accessSync(native.bin(name), fs.constants.X_OK);
  const result = spawnSync(native.bin(name), args, { env: native.env, timeout: 10000, encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error(`${name}: ${result.error?.message || result.stderr || result.stdout}`);
  console.log(`${name}: executable and dependencies available`);
}
fs.accessSync(path.join(native.root, 'sources.json'));

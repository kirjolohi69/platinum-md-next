'use strict';
const path = require('node:path');
const fs = require('node:fs');

function nativePaths(resourcesPath) {
  const root = resourcesPath ? path.join(resourcesPath, 'native') : path.join(__dirname, '..', 'native');
  const env = { ...process.env, LC_ALL: 'C' };
  // Scope helper libraries to helper processes, never to Electron itself.
  if (fs.existsSync(path.join(root, 'lib'))) {
    env.LD_LIBRARY_PATH = [path.join(root, 'lib'), env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  }
  return { root, env, bin: name => path.join(root, 'bin', name) };
}
module.exports = { nativePaths };

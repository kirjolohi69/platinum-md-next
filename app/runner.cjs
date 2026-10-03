'use strict';

const { spawn } = require('node:child_process');

class ToolError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ToolError';
    Object.assign(this, details);
  }
}

// Every helper has a deadline. A failed helper must never look like success or
// leave the GUI's connection promise pending indefinitely.
function runTool(file, args = [], options = {}) {
  const { timeoutMs = 30000, env = process.env, onOutput = () => {},
    maxBytes = 2 * 1024 * 1024, signal } = options;
  return new Promise((resolve, reject) => {
    let stdout = '', stderr = '', bytes = 0, failure, settled = false;
    let timer, killTimer;
    const started = Date.now();
    const child = spawn(file, args.map(String), {
      env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
    });
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(killTimer);
      signal?.removeEventListener('abort', abort);
      error ? reject(error) : resolve(result);
    };
    const stop = error => {
      if (failure || settled) return;
      failure = error;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => child.kill('SIGKILL'), 1000);
    };
    const abort = () => stop(new ToolError('Operation cancelled.', { code: 'CANCELLED' }));
    for (const stream of ['stdout', 'stderr']) {
      child[stream].setEncoding('utf8');
      child[stream].on('data', chunk => {
        bytes += Buffer.byteLength(chunk);
        if (bytes > maxBytes) {
          stop(new ToolError('The helper produced too much output.', { code: 'OUTPUT_LIMIT' }));
          return;
        }
        if (stream === 'stdout') stdout += chunk;
        else stderr += chunk;
        onOutput({ stream, text: chunk, elapsedMs: Date.now() - started });
      });
    }
    child.on('error', error => finish(new ToolError(
      error.code === 'ENOENT' ? 'A required helper is missing or cannot load its libraries.' : error.message,
      { code: error.code, file, stdout, stderr }
    )));
    child.on('close', (exitCode, exitSignal) => {
      const details = { file, exitCode, exitSignal, stdout, stderr, elapsedMs: Date.now() - started };
      if (failure) return finish(Object.assign(failure, details));
      if (exitCode !== 0) return finish(new ToolError(
        `${file.split('/').pop()} failed${exitSignal ? ` (${exitSignal})` : ` (exit ${exitCode})`}.`,
        { ...details, code: 'HELPER_FAILED' }
      ));
      finish(null, details);
    });
    timer = setTimeout(() => stop(new ToolError(
      `The device or helper did not finish within ${Math.round(timeoutMs / 1000)} seconds.`,
      { code: 'TIMEOUT' }
    )), timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
  });
}

class OperationGate {
  busy = false;
  async run(task) {
    if (this.busy) throw new ToolError('Another operation is still running.', { code: 'BUSY' });
    this.busy = true;
    try { return await task(); } finally { this.busy = false; }
  }
}

module.exports = { runTool, ToolError, OperationGate };

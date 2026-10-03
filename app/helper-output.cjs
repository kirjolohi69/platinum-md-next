'use strict';

// atracdenc prints a spinner many times per percentage point. Keep real text
// and stderr, but send only occasional progress summaries to the renderer.
function helperOutputLogger(helper, log) {
  let pending = '', lastElapsed = 0, lastProgressAt = -Infinity, progress = null;
  const output = (stream, text, elapsedMs) => log('helper-output', { helper, stream, text: text.slice(-16000), elapsedMs });
  const flushProgress = () => {
    if (!progress) return;
    log('helper-progress', { helper, ...progress });
    lastProgressAt = progress.elapsedMs;
    progress = null;
  };
  const line = (text, elapsedMs) => {
    const match = text.match(/^[|/\\-]\s+(\d{1,3})% done\s*$/);
    if (match && Number(match[1]) <= 100) {
      progress = { percent: Number(match[1]), elapsedMs, updates: (progress?.updates || 0) + 1 };
      if (elapsedMs - lastProgressAt >= 5000) flushProgress();
    } else if (text) output('stdout', text + '\n', elapsedMs);
  };
  return {
    onOutput({ stream, text, elapsedMs }) {
      if (helper !== 'atracdenc' || stream !== 'stdout') return output(stream, text, elapsedMs);
      lastElapsed = elapsedMs;
      pending += text;
      const parts = pending.split(/[\r\n]/);
      pending = parts.pop();
      for (const part of parts) line(part, elapsedMs);
      if (pending.length >= 16000) { output('stdout', pending, elapsedMs); pending = ''; }
    },
    flush() {
      if (pending) { line(pending, lastElapsed); pending = ''; }
      flushProgress();
    }
  };
}

module.exports = { helperOutputLogger };

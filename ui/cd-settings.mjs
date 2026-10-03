import speeds from '../app/cd-read-speeds.json' with { type: 'json' };

export const cdReadSpeeds = speeds.map(value => ({
  value, label: value === 'max' ? 'Maximum (default)' : `${value}×`
}));
const storageKey = 'platinum-md-next.cd-read-speed';

export function readCdReadSpeed() {
  try {
    const value = globalThis.localStorage.getItem(storageKey);
    return speeds.includes(value) ? value : 'max';
  } catch { return 'max'; }
}

export function saveCdReadSpeed(value) {
  if (!speeds.includes(value)) return false;
  try { globalThis.localStorage.setItem(storageKey, value); return true; }
  catch { return false; }
}

export const palettes = [
  { id: 'orange', name: 'Walkman orange', description: 'Copper, silver and an LCD glow' },
  { id: 'red', name: 'Red', description: 'Bright red with silver trim' },
  { id: 'yellow', name: 'Yellow', description: 'Golden yellow and charcoal' },
  { id: 'forest', name: 'Forest', description: 'Soft greens and warm neutrals' },
  { id: 'blue', name: 'Midnight blue', description: 'Cool blue and brushed silver' },
  { id: 'silver', name: 'Silver', description: 'Brushed metal and graphite' },
  { id: 'burgundy', name: 'Burgundy', description: 'Deep red and champagne trim' },
  { id: 'violet', name: 'Violet', description: 'Soft lavender and plum' }
];
export const defaultAppearance = Object.freeze({ palette: 'orange', mode: 'system' });
const storageKey = 'platinum-md-next.appearance.v1';

export function normalizeAppearance(value) {
  return {
    palette: palettes.some(p => p.id === value?.palette) ? value.palette : defaultAppearance.palette,
    mode: ['system', 'light', 'dark'].includes(value?.mode) ? value.mode : defaultAppearance.mode
  };
}

export function readAppearance() {
  try { return normalizeAppearance(JSON.parse(globalThis.localStorage.getItem(storageKey))); }
  catch { return { ...defaultAppearance }; }
}

export function saveAppearance(value) {
  try { globalThis.localStorage.setItem(storageKey, JSON.stringify(normalizeAppearance(value))); return true; }
  catch { return false; }
}

export function applyAppearance(value, root, systemDark) {
  const { palette, mode } = normalizeAppearance(value);
  root.dataset.palette = palette;
  root.dataset.colorScheme = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;
}

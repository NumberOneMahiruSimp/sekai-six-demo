import {THEMES} from './themes.js';
export const DEFAULT_KEYS = ['d', 'f', 'g', 'j', 'k', 'l'];
export const DEFAULT_SETTINGS = {
  travel: 1.8, volume: .65, offset: 0, practice: true, effects: true,
  keys: DEFAULT_KEYS, flickKey: 'shift', flickMode: 'modifier',
  hitVolume: .55, hitSound: 'sekai', soundPackVersion: 1, theme: 'emu', backgroundDim: .5,
  laneMode: 'perspective', noteScale: 1.1,
};
export function keyLabel(key) {
  return ({' ': 'SPACE', shift: 'SHIFT', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→'})[key] || key.toUpperCase();
}
export function validateBinding(key, keys, flickKey, index) {
  key = key.toLowerCase();
  if (!key || ['escape', 'tab', 'enter', 'control', 'alt', 'meta', 'capslock', 'dead', 'unidentified'].includes(key)) {
    return 'Choose a letter, number, arrow, Space, or Shift. Escape is reserved for pause.';
  }
  if (index !== 'flick' && key === 'shift') return 'Shift is a flick modifier. Choose another key for this lane.';
  if (keys.some((k, i) => i !== index && k === key) || (index !== 'flick' && key === flickKey)) {
    return 'That key is already assigned. Each control needs a different key.';
  }
  return null;
}
export function normalizeSettings(raw = {}) {
  const p = {...DEFAULT_SETTINGS, ...raw, keys: [...DEFAULT_KEYS]};
  const num = (name, min, max) => p[name] = Number.isFinite(Number(p[name])) ? Math.max(min, Math.min(max, Number(p[name]))) : DEFAULT_SETTINGS[name];
  num('travel', .7, 3); num('volume', 0, 1); num('offset', -500, 500);
  num('hitVolume', 0, 1); num('backgroundDim', 0, .9); num('noteScale', .8, 1.5);
  if (!Object.hasOwn(THEMES,p.theme)) p.theme = 'emu';
  if (!['perspective', 'flat'].includes(p.laneMode)) p.laneMode = 'perspective';
  if (!raw.soundPackVersion || !['sekai','pop','soft','arcade'].includes(p.hitSound)) p.hitSound = 'sekai';
  p.soundPackVersion = 1;
  if (!['modifier', 'tap'].includes(p.flickMode)) p.flickMode = 'modifier';
  const flick = typeof raw.flickKey === 'string' ? raw.flickKey.toLowerCase() : 'shift';
  if (Array.isArray(raw.keys) && raw.keys.length === 6 && raw.keys.every(k => typeof k === 'string')) {
    const keys = raw.keys.map(k => k.toLowerCase());
    if (keys.every((k, i) => !validateBinding(k, keys, flick, i)) && !validateBinding(flick, keys, flick, 'flick')) {
      p.keys = keys; p.flickKey = flick;
    } else p.flickKey = 'shift';
  } else p.flickKey = 'shift';
  return p;
}

export const HIGH_SCORE_KEY = 'runbabyrun.highScores.v1';
export const SETTINGS_KEY = 'runbabyrun.settings.v1';

const DEFAULT_SCORES = [
  ['RICHARD', 15], ['PHILIPS', 14], ['FEYNMAN', 13], ['JOHANN', 12], ['SEBASTIAN', 11],
  ['BACH', 10], ['LUDWIG', 9], ['VAN', 8], ['BEETHOVEN', 7], ['BEBUL', 7],
].map(([name, score]) => ({ name, score }));

export function sanitizeName(value) {
  const clean = String(value ?? '').trim().replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 12);
  return clean || 'HRÁČ';
}

export function rankScores(scores, entry) {
  return [...scores, { name: sanitizeName(entry.name), score: Math.max(0, Math.floor(entry.score)) }]
    .sort((left, right) => right.score - left.score)
    .slice(0, 10);
}

export function loadScores(storage = localStorage) {
  try {
    const parsed = JSON.parse(storage.getItem(HIGH_SCORE_KEY));
    return Array.isArray(parsed) ? parsed : DEFAULT_SCORES;
  } catch {
    return DEFAULT_SCORES;
  }
}

export function saveScore(entry, storage = localStorage) {
  const scores = rankScores(loadScores(storage), entry);
  storage.setItem(HIGH_SCORE_KEY, JSON.stringify(scores));
  return scores;
}

export function loadSettings(storage = localStorage) {
  try {
    return { name: 'HRÁČ', speed: 'normal', music: false, ...JSON.parse(storage.getItem(SETTINGS_KEY)) };
  } catch {
    return { name: 'HRÁČ', speed: 'normal', music: false };
  }
}

export function saveSettings(settings, storage = localStorage) {
  const safe = {
    name: sanitizeName(settings.name),
    speed: ['slow', 'normal', 'fast'].includes(settings.speed) ? settings.speed : 'normal',
    music: settings.music === true,
  };
  storage.setItem(SETTINGS_KEY, JSON.stringify(safe));
  return safe;
}

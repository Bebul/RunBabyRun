export const CRASH_SOUNDS = Object.freeze({
  player: '/audio/crash004.mp3',
  vehicles: Object.freeze({
    'sprite-03-formule3': '/audio/crash004.mp3',
    'sprite-04-formule5': '/audio/crash005.mp3',
    'sprite-05-formule6': '/audio/crash006.mp3',
    'sprite-06-formule7': '/audio/crash007.mp3',
    'sprite-07-formule8': '/audio/crash004.mp3',
    'sprite-08-formule9': '/audio/crash005.mp3',
    'sprite-09-formul10': '/audio/crash006.mp3',
    'sprite-10-formul11': '/audio/crash007.mp3',
  }),
  fallbackVehicle: '/audio/crash004.mp3',
});

export function crashSoundsForTransition(previous, current) {
  const sounds = [];
  const previouslyCrashed = new Set(previous.enemies.filter((enemy) => enemy.crashed).map((enemy) => enemy.id));
  for (const enemy of current.enemies) {
    if (enemy.crashed && !previouslyCrashed.has(enemy.id)) {
      sounds.push(CRASH_SOUNDS.vehicles[enemy.spriteId] ?? CRASH_SOUNDS.fallbackVehicle);
    }
  }
  const playerJustCrashed = previous.mode === 'running'
    && (current.mode === 'crashed' || current.mode === 'game-over')
    && current.lastEvent === 'collision';
  if (playerJustCrashed) sounds.push(CRASH_SOUNDS.player);
  return sounds;
}

export class CrashSoundPlayer {
  constructor(AudioClass = globalThis.Audio) {
    this.AudioClass = AudioClass;
    this.enabled = true;
    this.active = new Set();
    this.sources = [...new Set([
      CRASH_SOUNDS.player,
      ...Object.values(CRASH_SOUNDS.vehicles),
      CRASH_SOUNDS.fallbackVehicle,
    ])];
    this.preloaded = new Map();
    if (AudioClass) {
      for (const source of this.sources) {
        const audio = new AudioClass(source);
        audio.preload = 'auto';
        this.preloaded.set(source, audio);
      }
    }
  }

  playTransition(previous, current) {
    if (!this.enabled) return;
    crashSoundsForTransition(previous, current).forEach((source) => this.play(source));
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) this.stopActive();
  }

  play(source) {
    const template = this.preloaded.get(source);
    if (!template) return;
    const audio = template.cloneNode(true);
    this.active.add(audio);
    const release = () => this.active.delete(audio);
    audio.addEventListener('ended', release, { once: true });
    audio.addEventListener('error', release, { once: true });
    const result = audio.play();
    result?.catch(release);
  }

  dispose() {
    this.stopActive();
  }

  stopActive() {
    for (const audio of this.active) {
      audio.pause();
      audio.currentTime = 0;
    }
    this.active.clear();
  }
}

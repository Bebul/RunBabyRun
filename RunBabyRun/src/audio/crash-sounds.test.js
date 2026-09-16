import { describe, expect, it } from 'vitest';
import { CRASH_SOUNDS, CrashSoundPlayer, crashSoundsForTransition } from './crash-sounds.js';

const enemy = (id, spriteId, crashed = false) => ({ id, spriteId, crashed });

describe('crash sound configuration', () => {
  it('explicitly assigns a sound to every opponent formula sprite', () => {
    expect(Object.keys(CRASH_SOUNDS.vehicles)).toEqual([
      'sprite-03-formule3', 'sprite-04-formule5', 'sprite-05-formule6', 'sprite-06-formule7',
      'sprite-07-formule8', 'sprite-08-formule9', 'sprite-09-formul10', 'sprite-10-formul11',
    ]);
    expect(new Set(Object.values(CRASH_SOUNDS.vehicles))).toEqual(new Set([
      '/audio/crash004.mp3', '/audio/crash005.mp3', '/audio/crash006.mp3', '/audio/crash007.mp3',
    ]));
  });

  it('returns every newly crashed opponent and the separately configured player sound', () => {
    const previous = {
      mode: 'running',
      enemies: [enemy('one', 'sprite-03-formule3'), enemy('two', 'sprite-04-formule5')],
    };
    const current = {
      mode: 'crashed', lastEvent: 'collision',
      enemies: [enemy('one', 'sprite-03-formule3', true), enemy('two', 'sprite-04-formule5', true)],
    };
    expect(crashSoundsForTransition(previous, current)).toEqual([
      '/audio/crash004.mp3', '/audio/crash005.mp3', CRASH_SOUNDS.player,
    ]);
  });

  it('does not repeat a sound for an already gray formula', () => {
    const wreck = enemy('one', 'sprite-03-formule3', true);
    expect(crashSoundsForTransition(
      { mode: 'running', enemies: [wreck] },
      { mode: 'running', lastEvent: 'moved', enemies: [wreck] },
    )).toEqual([]);
  });
});

describe('crash sound playback', () => {
  it('allows multiple crash sounds to overlap', () => {
    const played = [];
    class FakeAudio {
      constructor(source) { this.source = source; }
      cloneNode() { return new FakeAudio(this.source); }
      addEventListener() {}
      play() { played.push(this.source); return Promise.resolve(); }
      pause() {}
    }
    const player = new CrashSoundPlayer(FakeAudio);
    player.play('/audio/crash004.mp3');
    player.play('/audio/crash005.mp3');
    expect(played).toEqual(['/audio/crash004.mp3', '/audio/crash005.mp3']);
  });

  it('can be disabled independently', () => {
    const played = [];
    class FakeAudio {
      constructor(source) { this.source = source; }
      cloneNode() { return new FakeAudio(this.source); }
      addEventListener() {}
      play() { played.push(this.source); return Promise.resolve(); }
      pause() {}
    }
    const player = new CrashSoundPlayer(FakeAudio);
    player.setEnabled(false);
    player.playTransition(
      { mode: 'running', enemies: [enemy('one', 'sprite-03-formule3')] },
      { mode: 'running', lastEvent: 'enemy-crashed', enemies: [enemy('one', 'sprite-03-formule3', true)] },
    );
    expect(played).toEqual([]);
  });
});

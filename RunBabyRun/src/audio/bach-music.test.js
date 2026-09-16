import { describe, expect, it } from 'vitest';
import { BACH_TRACKS, PLAYBACK_RATE, decodeMelody } from './bach-music.js';

describe('original Bach melody decoder', () => {
  it('uses the ASM octave, duration and rest commands', () => {
    expect(decodeMelody('3Oai4Qc')).toEqual([
      { frequency: 444, duration: 125 },
      { frequency: 0, duration: 125 },
      { frequency: 526, duration: 250 },
    ]);
  });

  it('contains all three named pieces from ATEST.ASM', () => {
    expect(BACH_TRACKS.map((track) => track.title)).toEqual([
      'Preludium a moll',
      'Rondeau ze suity č. 2',
      'Badinerie ze suity č. 2',
    ]);
    expect(BACH_TRACKS.map((track) => decodeMelody(track.source).length))
      .toEqual([expect.any(Number), expect.any(Number), expect.any(Number)]);
    expect(BACH_TRACKS.every((track) => decodeMelody(track.source).length > 100)).toBe(true);
  });

  it('plays at three quarters of the previous speed', () => {
    expect(PLAYBACK_RATE).toBe(0.75);
    expect(decodeMelody('Oa')[0].duration / PLAYBACK_RATE).toBeCloseTo(166.667, 3);
  });
});

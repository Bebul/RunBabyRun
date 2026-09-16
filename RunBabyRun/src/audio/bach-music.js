const NOTE_BASE_FREQUENCIES = {
  a: 110, b: 116, c: 65, d: 73, e: 82, f: 87, g: 98, h: 124, i: 0,
  A: 116, B: 0, C: 69, D: 78, E: 87, F: 93, G: 104, H: 65,
};

const LENGTH_UNITS = { N: 32, O: 8, P: 5, Q: 16, R: 12, S: 4, T: 6 };
const MILLISECONDS_PER_UNIT = 1000 / 512;
export const PLAYBACK_RATE = 0.75;

export const BACH_TRACKS = [
  {
    title: 'Preludium a moll',
    source: [
      '3Oa4c3a4e3a4c3a4f3GhG4e3ghg',
      '4e3FaF4d3faf4d3eGe4c3ege',
      '4c3DFDhdfdhCeCacec',
      'a2h3d2h3G2h3d2h3gTCdefgfedC2ha',
      '3defedc2h3cdc2haGaheGh3dc2h3fed',
      'c2ah3cdefedc2haOG3f2h3f2g3e2h3e',
      '2F3e2a3e2f3d2a3d2e3d2G3d2e3c2g3c',
      '2D3c2F3c2dhfhChehcaea',
      '1h2ada1h2GdGT1a2cehGa1h2dehGa',
      'ceahGadfahGaea3c2hGafa3d2hGa',
      'ea3ceGa2fa3dfGa2ea3ceGa2dGh3fed',
      '2ea3ce2Ga2fa3de2Gaea3ce2Ga2dGh3e2Ga',
      'cea3cde2dfa3def2cea3cde1h2dGh3cd',
      '1a2ea3c2Ga1h2ea3d2Gacea3e2GaCeg3e2Ga',
      'dfa3def2Cea3efg2dfa3def2ega3Cde',
      '2fa3deCd2gb3deCd2a3dfeCd2b3dgeCd',
      '2a3dfa4Cd2b3dgb4Cd2a3dfa4Cd2g3Cebag',
      '2a3dfaCd2b3CegCd2a3dfaCd2g3CeaCd',
      '2fa3dfga2g3Cegab2fa3dfga2eg3Cefg',
      '2da3dfCd2egb3gCd2Fa3CaCd2Gh3dhCd',
      '2a3ceah4c2Gh3eh4cd2a3ceah4c2h3dfGah',
      'PceFGah4cdefedc3haGah4cdeFGahfed3Gh4cd',
      '3edeFGah4cd3haG2h3def4dededededededede',
      'NccOdQ3hOaSiNaaiiii',
    ].join(''),
  },
  {
    title: 'Rondeau ze suity č. 2',
    source: [
      '4Oci3hiNe4Odici3Ne4Oedefedcedcde',
      'dc3h4dci3hiNe4Odici3Ne4Oedefei3aihiGiNa',
      '4Oci3hiNe4Odici3Ne4Oedefedcedcde',
      'dc3h4dci3hiNe4Odici3Ne4Oedefei3aihiGiNa',
      '4OefedeifigifiQeaOefedeifigifiNeOaigi',
      '3Nb4Ogifi3Na4OfefgfedfedCeNdf',
      'edOdcdedc3hahiei4ci3hi',
      'Ne4Odici3Ne4Oedefedcedcdedc3h4dci3hi',
      'Ne4Odici3Ne4Oedefei3aihiGiNa4Oc3h4cdcdc3hah4c3a',
      'hagah4cdefgfefedfefgeagFedc3ha4gFedc3hag4FeDe',
      'Fi3hi4hiagNF3Ohiai4NgOci3hi4NaOgFga',
      'gFegFeDFNeO3h4c3hahi4cidici3Qh4e3Oh4c3ha',
      'hi4cidici3NhO4ci3hiNe4Odici3Ne4Oedefedcedcde',
      'dc3h4dci3hiNeO4dici3Ne4Oedefei3aihiGiNa',
      'Nii',
    ].join(''),
  },
  {
    title: 'Badinerie ze suity č. 2',
    source: [
      '4Oai5c4aeiaeciec3NaOea4c3ahahaGh4d3h4Qc3Oai4ai5c4a',
      'eiaeciec3Na4OciciciQcOaiciQc3Ohi4eiei',
      'eiQe5Oci4eiQeODi3h4egeFeFeDFaFgFgFegeD',
      'eaeDeheDe5c4eDe5c4hahgFegiFiNe',
      '4Oai5c4aeiaeciec3NaOea4c3ahahaGh4d3h4Qc3Oai4ai5c4a',
      'eiaeciec3Na4OciciciQcOaiciQc3Ohi4eiei',
      'eiQe5Oci4eiQeODi3h4egeFeFeDFaFgFgFegeD',
      'eaeDeheDe5c4eDe5c4hahgFegiFiQeOei',
      'Oeige3hi4e3hgihgNeQbOai4QdOCeQgOfeQfOdifiafdifd3hi4d3hNgOg4cec',
      'dcdc3h4dfdededcec3h4cfc3h4cgc3h4cac3h4cagfgedcQeOdiNcOeiei',
      'eiQe5Oci4eiQeOdidididiQdOhidiQdOciai5c4aOgNfOiSagfeNdOdiSfedc',
      '3Ob4dfd3babaQGOeiQfOeiaiGh4dic3h4Qc3Sah4cdQeOceQaOeidc3h4c3NaOi',
      '4Oeige3hi4e3hgihgNeQbOai4QdOCeQgOfeQfOdifiafdifd3hi4d3hNgOg4cec',
      'dcdc3h4dfdededcec3h4cfc3h4cgc3h4cac3h4cagfgedcQeOdiNcOeiei',
      'eiQe5Oci4eiQeOdidididiQdOhidiQdOciai5c4aOgNfOiSagfeNdOdiSfedc',
      '3Ob4dfd3babaQGOeiQfOeiaiGh4dic3h4Qc3Sah4cdQeOceQaOeidc3h4c3NaOi',
      'Niiii',
    ].join(''),
  },
];

export function decodeMelody(source) {
  let octave = 0;
  let length = 1;
  const events = [];
  for (const token of source) {
    if (/[1-5]/.test(token)) {
      octave = Number(token) - 1;
    } else if (token in LENGTH_UNITS) {
      length = LENGTH_UNITS[token] * 8;
    } else if (token in NOTE_BASE_FREQUENCIES) {
      const base = NOTE_BASE_FREQUENCIES[token];
      events.push({
        frequency: base ? base * (2 ** octave) + 2 * octave : 0,
        duration: length * MILLISECONDS_PER_UNIT,
      });
    }
  }
  return events;
}

const PLAYLIST = BACH_TRACKS.flatMap((track, trackIndex) => (
  decodeMelody(track.source).map((event) => ({ ...event, trackIndex }))
));

export class BachMusic {
  constructor(AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext, onTrackChange = () => {}) {
    this.AudioContextClass = AudioContextClass;
    this.onTrackChange = onTrackChange;
    this.enabled = false;
    this.context = null;
    this.oscillator = null;
    this.gain = null;
    this.timer = null;
    this.eventIndex = 0;
    this.nextEventAt = 0;
    this.trackTimers = [];
    this.announcedTrackIndex = 0;
  }

  async setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) {
      this.stop();
      return false;
    }
    if (!this.AudioContextClass) return false;
    if (!this.context) this.context = new this.AudioContextClass();
    await this.context.resume();
    if (!this.enabled || this.oscillator) return this.enabled;

    this.oscillator = this.context.createOscillator();
    this.gain = this.context.createGain();
    this.oscillator.type = 'square';
    this.gain.gain.value = 0;
    this.oscillator.connect(this.gain).connect(this.context.destination);
    this.oscillator.start();
    this.eventIndex = 0;
    this.announcedTrackIndex = 0;
    this.nextEventAt = this.context.currentTime + 0.03;
    this.onTrackChange(BACH_TRACKS[0]);
    this.schedule();
    this.timer = setInterval(() => this.schedule(), 500);
    return true;
  }

  schedule() {
    if (!this.enabled || !this.oscillator || !PLAYLIST.length) return;
    const horizon = this.context.currentTime + 2;
    while (this.nextEventAt < horizon) {
      const event = PLAYLIST[this.eventIndex];
      const duration = event.duration / 1000 / PLAYBACK_RATE;
      if (event.trackIndex !== this.announcedTrackIndex) {
        const delay = Math.max(0, (this.nextEventAt - this.context.currentTime) * 1000);
        const trackIndex = event.trackIndex;
        this.trackTimers.push(setTimeout(() => {
          if (this.enabled) this.onTrackChange(BACH_TRACKS[trackIndex]);
        }, delay));
        this.announcedTrackIndex = trackIndex;
      }
      this.oscillator.frequency.setValueAtTime(Math.max(1, event.frequency), this.nextEventAt);
      this.gain.gain.setValueAtTime(event.frequency ? 0.035 : 0, this.nextEventAt);
      this.gain.gain.setValueAtTime(0, this.nextEventAt + Math.max(0, duration - 0.006));
      this.nextEventAt += duration;
      this.eventIndex = (this.eventIndex + 1) % PLAYLIST.length;
    }
  }

  stop() {
    clearInterval(this.timer);
    this.trackTimers.forEach(clearTimeout);
    this.trackTimers = [];
    this.timer = null;
    if (this.gain && this.context) {
      this.gain.gain.cancelScheduledValues(this.context.currentTime);
      this.gain.gain.setValueAtTime(0, this.context.currentTime);
    }
    this.oscillator?.stop();
    this.oscillator?.disconnect();
    this.gain?.disconnect();
    this.oscillator = null;
    this.gain = null;
    this.eventIndex = 0;
  }

  dispose() {
    this.enabled = false;
    this.stop();
    this.context?.close().catch(() => {});
    this.context = null;
  }
}

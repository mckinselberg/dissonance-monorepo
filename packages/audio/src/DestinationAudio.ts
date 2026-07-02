import * as Tone from 'tone';

// Car alarm beacon for the destination parking lot.
// Two descending WOOP chirps per 3.5-second cycle — volume driven by
// distance so the player can use it as a directional beacon.
export class DestinationAudio {
  private synth: Tone.Synth;
  private filter: Tone.Filter;
  private masterGain: Tone.Gain;
  private loop: Tone.Loop | null = null;
  private running = false;
  private currentVolume = 0.0;
  private gainMultiplier = 1.0;

  constructor() {
    // Sawtooth with 4 harmonics → buzzy electronic alarm character
    this.synth = new Tone.Synth({
      oscillator: { type: 'sawtooth4' },
      envelope: { attack: 0.006, decay: 0.0, sustain: 1.0, release: 0.05 },
      volume: -6,
    });

    // Bandpass centred on 1.2 kHz shapes the horn bite without full harshness
    this.filter = new Tone.Filter({ frequency: 1200, type: 'bandpass', rolloff: -12 });
    this.masterGain = new Tone.Gain(0.0);

    this.synth.connect(this.filter);
    this.filter.connect(this.masterGain);
    this.masterGain.toDestination();
  }

  start(): void {
    if (this.running) return;
    // A5 → F#5 — descending minor third, classic two-tone alarm interval
    this.loop = new Tone.Loop((time) => {
      this.synth.triggerAttackRelease('A5', 0.24, time);
      this.synth.triggerAttackRelease('F#5', 0.24, time + 0.38);
    }, '3.5');
    this.loop.start(0);
    if (Tone.getTransport().state !== 'started') {
      Tone.getTransport().start();
    }
    this.running = true;
  }

  stop(): void {
    this.loop?.stop();
    this.loop?.dispose();
    this.loop = null;
    this.masterGain.gain.rampTo(0, 1.0);
    this.running = false;
  }

  setDistance(normalizedDistance: number): void {
    const db = -2 - normalizedDistance * 20;
    const target = Tone.dbToGain(db) * this.gainMultiplier;
    if (Math.abs(target - this.currentVolume) > 0.001) {
      this.masterGain.gain.rampTo(target, 1.0);
      this.currentVolume = target;
    }
  }

  setGainMultiplier(v: number): void {
    this.gainMultiplier = v;
    this.currentVolume = -1;
  }

  dispose(): void {
    this.stop();
    this.synth.dispose();
    this.filter.dispose();
    this.masterGain.dispose();
  }
}

import * as Tone from 'tone';

// Car alarm beacon for the destination parking lot.
// Two descending WOOP chirps per 3.5-second cycle — volume and reverb wet
// both driven by distance so the alarm sounds close/dry at the car and
// washes into a distant forest echo from far away.
export class DestinationAudio {
  private synth: Tone.Synth;
  private filter: Tone.Filter;
  private reverb: Tone.Reverb;
  private masterGain: Tone.Gain;
  private loop: Tone.Loop | null = null;
  private running = false;
  private currentVolume = 0.0;
  private targetVolume = 0.0;
  private gainMultiplier = 1.0;
  private onChirp: (() => void) | null = null;

  constructor() {
    // Sawtooth with 4 harmonics → buzzy electronic alarm character
    this.synth = new Tone.Synth({
      oscillator: { type: 'sawtooth4' },
      envelope: { attack: 0.006, decay: 0.0, sustain: 1.0, release: 0.05 },
      volume: -6,
    });

    // Bandpass centred on 1.2 kHz shapes the horn bite without full harshness
    this.filter = new Tone.Filter({ frequency: 1200, type: 'bandpass', rolloff: -12 });

    // Long forest reverb — fully dry at the car, wetter as the player moves
    // further away. wet is set each frame via setDistance().
    this.reverb = new Tone.Reverb({ decay: 5.0, preDelay: 0.02, wet: 0.6 });

    this.masterGain = new Tone.Gain(0.0);

    this.synth.connect(this.filter);
    this.filter.connect(this.reverb);
    this.reverb.connect(this.masterGain);
    this.masterGain.toDestination();
  }

  setChirpCallback(cb: () => void): void {
    this.onChirp = cb;
  }

  start(): void {
    if (this.running) return;
    // A5 → F#5 — descending minor third, classic two-tone alarm interval.
    // getDraw().schedule fires the visual flash on the next animation frame
    // at the exact audio time so lights sync to the chirps with no drift.
    this.loop = new Tone.Loop((time) => {
      this.triggerChirpPair(time);
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

  chirpOnce(): void {
    const now = Tone.now();
    if (Tone.getTransport().state !== 'started') {
      Tone.getTransport().start();
    }
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(Math.max(this.targetVolume, 0.04), now);
    this.triggerChirpPair(now + 0.02);
    if (!this.running) {
      this.masterGain.gain.rampTo(0, 1.2);
    }
  }

  setDistance(normalizedDistance: number): void {
    const db = -2 - normalizedDistance * 20;
    const target = Tone.dbToGain(db) * this.gainMultiplier;
    this.targetVolume = target;
    if (Math.abs(target - this.currentVolume) > 0.001) {
      this.masterGain.gain.rampTo(target, 1.0);
      this.currentVolume = target;
    }

    // Dry at the car (distance≈0), progressively wetter further away.
    // Cap at 0.8 so even at max distance there's still some direct signal.
    const targetWet = normalizedDistance * 0.8;
    this.reverb.wet.rampTo(targetWet, 2.0);
  }

  setGainMultiplier(v: number): void {
    this.gainMultiplier = v;
    this.currentVolume = -1;
  }

  private triggerChirpPair(time: number): void {
    this.synth.triggerAttackRelease('A5', 0.24, time);
    if (this.onChirp) Tone.getDraw().schedule(this.onChirp, time);
    this.synth.triggerAttackRelease('F#5', 0.24, time + 0.38);
    if (this.onChirp) Tone.getDraw().schedule(this.onChirp, time + 0.38);
  }

  dispose(): void {
    this.stop();
    this.synth.dispose();
    this.filter.dispose();
    this.reverb.dispose();
    this.masterGain.dispose();
  }
}

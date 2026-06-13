import * as Tone from 'tone';

// FM bell beacon for the destination tower
export class DestinationAudio {
  private synth: Tone.FMSynth;
  private reverb: Tone.Reverb;
  private masterGain: Tone.Gain;
  private loop: Tone.Loop | null = null;
  private running = false;
  private currentVolume = 0.0;

  constructor() {
    // FM bell: quick attack, slow metallic decay
    this.synth = new Tone.FMSynth({
      harmonicity: 3.01,
      modulationIndex: 14,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: { attack: 0.001, decay: 5.0, sustain: 0.0, release: 0.5 },
      modulationEnvelope: { attack: 0.002, decay: 1.5, sustain: 0.0, release: 0.5 },
    });

    this.reverb = new Tone.Reverb({ decay: 10, wet: 0.75 });
    this.masterGain = new Tone.Gain(0.0);

    this.synth.connect(this.reverb);
    this.reverb.connect(this.masterGain);
    this.masterGain.toDestination();
  }

  start(): void {
    if (this.running) return;
    // Strike every ~3.5 seconds — slow enough to chase, clear enough to localise
    this.loop = new Tone.Loop((time) => {
      this.synth.triggerAttackRelease('A3', '8n', time);
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

  // normalizedDistance: 0.0 (at tower) → 1.0 (max audible range)
  setDistance(normalizedDistance: number): void {
    // At distance 0 → -2 dB; at distance 1 → -22 dB.
    // Audible across the whole map so the player can always orient by ear.
    const db = -2 - normalizedDistance * 20;
    const target = Tone.dbToGain(db);
    if (Math.abs(target - this.currentVolume) > 0.001) {
      this.masterGain.gain.rampTo(target, 1.0);
      this.currentVolume = target;
    }
  }

  dispose(): void {
    this.stop();
    this.synth.dispose();
    this.reverb.dispose();
    this.masterGain.dispose();
  }
}

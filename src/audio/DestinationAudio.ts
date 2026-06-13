import * as Tone from 'tone';

// Wind-chime / tower-hum beacon for the destination
export class DestinationAudio {
  private synth: Tone.MetalSynth;
  private reverb: Tone.Reverb;
  private gain: Tone.Gain;
  private loop: Tone.Loop | null = null;
  private running = false;

  constructor() {
    this.synth = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 4.0, release: 6.0 },
      harmonicity: 5.1,
      modulationIndex: 12,
      resonance: 3000,
      octaves: 0.5,
    });
    this.synth.frequency.value = 180;

    this.reverb = new Tone.Reverb({ decay: 8, wet: 0.85 });
    this.gain = new Tone.Gain(0.0);

    this.synth.connect(this.reverb);
    this.reverb.connect(this.gain);
    this.gain.toDestination();
  }

  start(): void {
    if (this.running) return;
    this.loop = new Tone.Loop((time) => {
      this.synth.triggerAttackRelease('12n', time);
    }, '4n');
    this.loop.start(0);
    if (Tone.getTransport().state !== 'started') {
      Tone.getTransport().start();
    }
    this.gain.gain.rampTo(0.06, 2.0);
    this.running = true;
  }

  stop(): void {
    this.loop?.stop();
    this.loop?.dispose();
    this.loop = null;
    this.gain.gain.rampTo(0, 1.0);
    this.running = false;
  }

  // normalizedDistance: 0 (at destination) .. 1 (far)
  setDistance(normalizedDistance: number): void {
    const vol = Tone.dbToGain(-4 - normalizedDistance * 32);
    this.gain.gain.rampTo(vol, 0.5);
  }

  dispose(): void {
    this.stop();
    this.synth.dispose();
    this.reverb.dispose();
    this.gain.dispose();
  }
}

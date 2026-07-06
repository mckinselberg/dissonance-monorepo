import * as Tone from 'tone';

// Continuous running-water ambience for river-flavored trails. Volume is
// distance-driven the same way DestinationAudio drives the car alarm, so
// the river can be located by ear even where dense forest blocks the
// sightline to the water itself.
export class RiverAudio {
  private noise: Tone.Noise;
  private filter: Tone.Filter;
  private lfo: Tone.LFO;
  private gain: Tone.Gain;
  private running = false;
  private currentVolume = 0;

  constructor() {
    this.noise = new Tone.Noise('pink');
    // Bandpass swept slowly by the LFO gives a trickling/bubbling character
    // instead of a static hiss.
    this.filter = new Tone.Filter({ frequency: 1800, type: 'bandpass', Q: 0.7 });
    this.lfo = new Tone.LFO({ frequency: 0.35, min: 1100, max: 2400 });
    this.gain = new Tone.Gain(0);

    this.lfo.connect(this.filter.frequency);
    this.noise.connect(this.filter);
    this.filter.connect(this.gain);
    this.gain.toDestination();
  }

  start(): void {
    if (this.running) return;
    this.noise.start();
    this.lfo.start();
    this.running = true;
  }

  stop(): void {
    if (!this.running) return;
    this.noise.stop();
    this.lfo.stop();
    this.running = false;
  }

  // normalizedDistance: 0 at the water's edge, 1 at/beyond the max audible range.
  setDistance(normalizedDistance: number): void {
    const db = -8 - normalizedDistance * 30;
    const target = Tone.dbToGain(db);
    if (Math.abs(target - this.currentVolume) > 0.001) {
      this.gain.gain.rampTo(target, 1.2);
      this.currentVolume = target;
    }
  }

  dispose(): void {
    this.stop();
    this.noise.dispose();
    this.filter.dispose();
    this.lfo.dispose();
    this.gain.dispose();
  }
}

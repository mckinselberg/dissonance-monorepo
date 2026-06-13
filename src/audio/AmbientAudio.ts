import * as Tone from 'tone';

// Looping ambient forest bed — wind, distant insects, low drone
export class AmbientAudio {
  private windLayer: { start: () => void; stop: () => void; setIntensity: (v: number) => void };
  private insectNoise: Tone.Noise;
  private insectFilter: Tone.Filter;
  private insectGain: Tone.Gain;
  private lowDrone: Tone.Oscillator;
  private droneGain: Tone.Gain;
  private running = false;

  constructor() {
    // Insect/nature bed — present in the chain but muted until tuned
    this.insectNoise = new Tone.Noise('white');
    this.insectFilter = new Tone.Filter({ frequency: 6000, type: 'bandpass', Q: 0.5 });
    this.insectGain = new Tone.Gain(0.0);
    this.insectNoise.connect(this.insectFilter);
    this.insectFilter.connect(this.insectGain);
    this.insectGain.toDestination();

    // Sub-bass environmental drone (inaudible but felt)
    this.lowDrone = new Tone.Oscillator({ frequency: 38, type: 'sine' });
    this.droneGain = new Tone.Gain(0.025);
    this.lowDrone.connect(this.droneGain);
    this.droneGain.toDestination();

    // Wind from AudioEngine pattern
    const noise = new Tone.Noise('pink');
    const filter = new Tone.Filter(300, 'bandpass');
    const gain = new Tone.Gain(0.0);
    const lfo = new Tone.LFO({ frequency: 0.04, min: 0.0, max: 0.12 });
    noise.connect(filter);
    filter.connect(gain);
    lfo.connect(gain.gain);
    gain.toDestination();

    let windRunning = false;
    this.windLayer = {
      start() {
        if (windRunning) return;
        noise.start();
        lfo.start();
        windRunning = true;
      },
      stop() {
        noise.stop();
        lfo.stop();
        windRunning = false;
      },
      setIntensity(v: number) {
        gain.gain.rampTo(v * 0.18, 2.0);
        filter.frequency.rampTo(200 + v * 800, 2.5);
        lfo.frequency.rampTo(0.03 + v * 0.12, 3.0);
      },
    };
  }

  start(): void {
    if (this.running) return;
    this.insectNoise.start();
    this.lowDrone.start();
    this.windLayer.start();
    this.windLayer.setIntensity(0.15);
    this.running = true;
  }

  stop(): void {
    this.insectNoise.stop();
    this.lowDrone.stop();
    this.windLayer.stop();
    this.running = false;
  }

  setWeatherIntensity(intensity: number): void {
    // intensity: 0 (calm) .. 1 (heavy wind)
    this.windLayer.setIntensity(intensity);
    // Insects muted for now; placeholder kept for future tuning
    // this.insectGain.gain.rampTo(0.04 * (1 - intensity * 0.7), 3.0);
  }

  setNightLevel(level: number): void {
    // level: 0 (day) .. 1 (night) — insects shift in character
    this.insectFilter.frequency.rampTo(6000 - level * 2000, 10.0);
    this.droneGain.gain.rampTo(0.025 + level * 0.035, 8.0);
  }
}

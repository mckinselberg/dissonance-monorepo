import * as Tone from 'tone';
import { audioBuses } from './AudioBuses';

export class AmbientAudio {
  private windLayer: { start: () => void; stop: () => void; setIntensity: (v: number) => void };
  private insectNoise: Tone.Noise;
  private insectFilter: Tone.Filter;
  private insectGain: Tone.Gain;
  private lowDrone: Tone.Oscillator;
  private droneGain: Tone.Gain;
  private rainNoise: Tone.Noise;
  private rainFilter: Tone.Filter;
  private rainGain: Tone.Gain;
  private running = false;

  constructor() {
    this.insectNoise = new Tone.Noise('white');
    this.insectFilter = new Tone.Filter({ frequency: 6000, type: 'bandpass', Q: 0.5 });
    this.insectGain = new Tone.Gain(0.0);
    this.insectNoise.connect(this.insectFilter);
    this.insectFilter.connect(this.insectGain);
    this.insectGain.connect(audioBuses.ambientBeds);

    this.lowDrone = new Tone.Oscillator({ frequency: 38, type: 'sine' });
    this.droneGain = new Tone.Gain(0.025);
    this.lowDrone.connect(this.droneGain);
    this.droneGain.connect(audioBuses.ambientBeds);

    // A single 2D bed for the whole rain field. Individual drops are never
    // spatialized: precipitation is environmental masking, not a swarm of
    // point emitters.
    this.rainNoise = new Tone.Noise('pink');
    this.rainFilter = new Tone.Filter({ frequency: 3600, type: 'bandpass', Q: 0.35 });
    this.rainGain = new Tone.Gain(0);
    this.rainNoise.connect(this.rainFilter);
    this.rainFilter.connect(this.rainGain);
    this.rainGain.connect(audioBuses.ambientBeds);

    const noise = new Tone.Noise('pink');
    const filter = new Tone.Filter(300, 'bandpass');
    const gain = new Tone.Gain(0.0);
    const lfo = new Tone.LFO({ frequency: 0.04, min: 0.0, max: 0.062 });
    noise.connect(filter);
    filter.connect(gain);
    lfo.connect(gain.gain);
    gain.connect(audioBuses.ambientBeds);

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
        gain.gain.rampTo(v * 0.10, 2.0);
        filter.frequency.rampTo(200 + v * 800, 2.5);
        lfo.frequency.rampTo(0.03 + v * 0.12, 3.0);
      },
    };
  }

  start(): void {
    if (this.running) return;
    this.insectNoise.start();
    this.lowDrone.start();
    this.rainNoise.start();
    this.windLayer.start();
    this.windLayer.setIntensity(0.15);
    this.running = true;
  }

  stop(): void {
    this.insectNoise.stop();
    this.lowDrone.stop();
    this.rainNoise.stop();
    this.windLayer.stop();
    this.running = false;
  }

  setWeatherIntensity(intensity: number): void {
    this.windLayer.setIntensity(intensity);
  }

  setRainIntensity(intensity: number): void {
    const clamped = Math.max(0, Math.min(1, intensity));
    this.rainGain.gain.rampTo(clamped * clamped * 0.18, 1.5);
    this.rainFilter.frequency.rampTo(2200 + clamped * 2600, 1.5);
  }

  playThunder(gain = 1, delaySeconds = 0): void {
    const clampedGain = Math.max(0, Math.min(1, gain));
    const delay = Math.max(0, delaySeconds);
    const noise = new Tone.Noise('brown');
    const filter = new Tone.Filter({ frequency: 180, type: 'lowpass', Q: 0.7 });
    const envelope = new Tone.AmplitudeEnvelope({
      attack: 0.01,
      decay: 1.2,
      sustain: 0.08,
      release: 2.2,
    });
    const output = new Tone.Gain(clampedGain * 0.7);
    noise.connect(filter);
    filter.connect(envelope);
    envelope.connect(output);
    output.connect(audioBuses.ambientBeds);

    const startAt = Tone.now() + delay;
    noise.start(startAt);
    envelope.triggerAttackRelease(1.8, startAt);
    window.setTimeout(() => {
      noise.stop();
      noise.dispose();
      filter.dispose();
      envelope.dispose();
      output.dispose();
    }, (delay + 4.5) * 1000);
  }

  setNightLevel(level: number): void {
    this.insectFilter.frequency.rampTo(6000 - level * 2000, 10.0);
    this.droneGain.gain.rampTo(0.025 + level * 0.035, 8.0);
  }
}

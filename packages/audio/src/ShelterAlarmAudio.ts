import { Gain, Synth } from 'tone';
import { audioBuses } from './AudioBuses';

// A deliberately consonant, non-diegetic locator: paired perfect fifths
// recur slowly near the shelter, then vanish hard at the threshold.
export class ShelterAlarmAudio {
  private readonly output = new Gain(0).connect(audioBuses.ambientBeds);
  private readonly low = new Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.035, decay: 0.18, sustain: 0.12, release: 0.65 },
  }).connect(this.output);
  private readonly high = new Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.05, decay: 0.22, sustain: 0.08, release: 0.7 },
  }).connect(this.output);
  private timer: number | null = null;
  private running = false;
  private silenced = false;

  setProximity(intensity: number): void {
    if (this.silenced) return;
    const amount = Math.max(0, Math.min(1, intensity));
    this.output.gain.rampTo(amount * 0.12, 0.35);
    if (amount > 0.01 && !this.running) {
      this.running = true;
      this.pulse();
    } else if (amount <= 0.01) {
      this.stop();
    }
  }

  silence(): void {
    this.silenced = true;
    this.stop();
  }

  private pulse(): void {
    if (!this.running || this.silenced) return;
    this.low.triggerAttackRelease('D4', 0.42);
    this.high.triggerAttackRelease('A4', 0.42, '+0.045');
    this.timer = window.setTimeout(() => this.pulse(), 2400);
  }

  private stop(): void {
    this.running = false;
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.output.gain.rampTo(0, 0.06);
  }

  dispose(): void {
    this.stop();
    this.low.dispose();
    this.high.dispose();
    this.output.dispose();
  }
}

import * as Tone from 'tone';

export const AMBIENT_DUCK_UNDER_PRIORITY_DB = -12;
export const AMBIENT_DUCK_ATTACK_SECONDS = 0.035;
export const AMBIENT_DUCK_RELEASE_SECONDS = 0.45;

class AudioBusGraph {
  readonly spatial = new Tone.Gain(1).toDestination();
  readonly ambientBeds = new Tone.Gain(1).toDestination();
  readonly interior = new Tone.Gain(1).toDestination();
  readonly musicSynth = new Tone.Gain(1).toDestination();
  private duckReleaseTimer: number | null = null;

  duckAmbientForPriority(holdSeconds: number): void {
    const duckGain = Tone.dbToGain(AMBIENT_DUCK_UNDER_PRIORITY_DB);
    this.ambientBeds.gain.rampTo(duckGain, AMBIENT_DUCK_ATTACK_SECONDS);
    if (this.duckReleaseTimer !== null) window.clearTimeout(this.duckReleaseTimer);
    this.duckReleaseTimer = window.setTimeout(() => {
      this.ambientBeds.gain.rampTo(1, AMBIENT_DUCK_RELEASE_SECONDS);
      this.duckReleaseTimer = null;
    }, Math.max(0, holdSeconds) * 1000);
  }
}

export const audioBuses = new AudioBusGraph();

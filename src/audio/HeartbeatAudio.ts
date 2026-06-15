import { MembraneSynth, Gain, Oscillator } from 'tone';

export class HeartbeatAudio {
  private lub: MembraneSynth;
  private dub: MembraneSynth;
  private masterGain: Gain;
  private droneOsc: Oscillator;
  private droneGain: Gain;

  private bpm = 65;
  private running = false;
  private timerId: number | null = null;

  constructor() {
    this.masterGain = new Gain(0).toDestination();

    // Lub — deep, long
    this.lub = new MembraneSynth({
      pitchDecay: 0.12,
      octaves: 7,
      envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.10 },
    }).connect(this.masterGain);

    // Dub — slightly higher, shorter
    this.dub = new MembraneSynth({
      pitchDecay: 0.07,
      octaves: 5,
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.06 },
    }).connect(this.masterGain);

    // 48 Hz sine drone — imperceptible until pursuer is very close
    this.droneGain = new Gain(0).toDestination();
    this.droneOsc  = new Oscillator(48, 'sine').connect(this.droneGain);
    this.droneOsc.start();
  }

  start(): void {
    this.running = true;
    this.scheduleTick();
  }

  private scheduleTick(): void {
    if (!this.running) return;
    const intervalMs = 60_000 / this.bpm;
    this.timerId = window.setTimeout(() => {
      this.lub.triggerAttackRelease('C2', '16n');
      window.setTimeout(() => {
        if (this.running) this.dub.triggerAttackRelease('E2', '16n');
      }, 78);
      this.scheduleTick();
    }, intervalMs);
  }

  // stress: 0..1 (use adrenaline level directly)
  setStressLevel(stress: number): void {
    // BPM ramps from 65 at rest to 155 at max stress
    this.bpm = 65 + stress * 90;

    // Heartbeat audible above ~0.28 stress; full volume at 0.85
    const heartVol = Math.max(0, Math.min(1, (stress - 0.28) / 0.57));
    this.masterGain.gain.rampTo(heartVol * 0.52, 0.8);

    // Bass drone kicks in above 0.68 stress — signals pursuer very close
    const droneVol = Math.max(0, Math.min(1, (stress - 0.68) / 0.32)) * 0.16;
    this.droneGain.gain.rampTo(droneVol, 0.35);
  }

  stop(): void {
    this.running = false;
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.masterGain.gain.rampTo(0, 0.6);
    this.droneGain.gain.rampTo(0, 0.4);
  }

  dispose(): void {
    this.stop();
    this.lub.dispose();
    this.dub.dispose();
    this.droneOsc.dispose();
    this.droneGain.dispose();
    this.masterGain.dispose();
  }
}

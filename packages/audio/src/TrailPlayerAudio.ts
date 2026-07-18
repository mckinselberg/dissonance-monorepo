import { AudioEngine } from './AudioEngine';

// Decoupled sibling of PlayerAudio (dont-turn-around) — same breath-handling
// logic (that part is already generic, no DTA coupling), but calls
// AudioEngine.playTrailStep() instead of playForestStep() for footsteps, and
// adds an independent footstep mute (DTA's PlayerAudio has no such toggle —
// only breath is individually mutable there — trail-viewer's DevHUD-derived
// audio row exposes both).
export class TrailPlayerAudio {
  private breathLayer: ReturnType<typeof AudioEngine.createBreathLayer>;
  private footstepInterval: number | null = null;
  private activeIntervalMs = 0;
  private breathMuted = false;
  private footstepMuted = false;
  private currentBreathLoad = 0;
  private lastBreathLoad = 0;
  private nextBreathCatchAt = 0;

  constructor() {
    this.breathLayer = AudioEngine.createBreathLayer();
  }

  start(): void {
    this.breathLayer.start();
  }

  stop(): void {
    this.breathLayer.stop();
    this.clearFootstepInterval();
  }

  setBreathMuted(muted: boolean): void { this.breathMuted = muted; }
  setFootstepMuted(muted: boolean): void { this.footstepMuted = muted; }

  updateBreath(breathLoad: number): void {
    const now = performance.now();
    this.currentBreathLoad = breathLoad;
    this.breathLayer.setLoad(this.breathMuted ? 0 : breathLoad);

    if (!this.breathMuted && breathLoad > 0.68 && now >= this.nextBreathCatchAt) {
      const intensity = Math.min(1, (breathLoad - 0.55) / 0.45);
      AudioEngine.playBreathCatch(-24 + intensity * 5, intensity);
      this.nextBreathCatchAt = now + 2300 - intensity * 850 + Math.random() * 450;
    }

    if (!this.breathMuted && this.lastBreathLoad < 0.94 && breathLoad >= 0.94) {
      AudioEngine.playBreathCatch(-17, 1);
      this.nextBreathCatchAt = now + 1400;
    }

    this.lastBreathLoad = breathLoad;
  }

  updateFootsteps(speed: number): void {
    if (speed < 0.5) {
      this.clearFootstepInterval();
      return;
    }

    const intervalMs = speed < 5 ? 640 : speed < 8 ? 430 : 310;

    if (this.footstepInterval !== null && intervalMs === this.activeIntervalMs) return;

    this.clearFootstepInterval();
    this.activeIntervalMs = intervalMs;
    this.footstepInterval = window.setInterval(() => {
      if (this.footstepMuted) return;
      const vol = -10 + this.currentBreathLoad * 6 + (Math.random() - 0.5) * 2;
      const crack = Math.random() < 0.06;
      const pan = (Math.random() - 0.5) * 0.15;
      AudioEngine.playTrailStep(pan, vol, crack);
    }, intervalMs);
  }

  private clearFootstepInterval(): void {
    if (this.footstepInterval !== null) {
      clearInterval(this.footstepInterval);
      this.footstepInterval = null;
      this.activeIntervalMs = 0;
    }
  }

  dispose(): void {
    this.stop();
  }
}

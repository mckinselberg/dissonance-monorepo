import { AudioEngine } from './AudioEngine';

export class PlayerAudio {
  private breathLayer: ReturnType<typeof AudioEngine.createBreathLayer>;
  private footstepInterval: number | null = null;
  private activeIntervalMs = 0;
  private breathMuted = false;
  private currentBreathLoad = 0;

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

  updateBreath(breathLoad: number): void {
    this.currentBreathLoad = breathLoad;
    this.breathLayer.setLoad(this.breathMuted ? 0 : breathLoad);
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
      const vol = -21 + this.currentBreathLoad * 5 + (Math.random() - 0.5) * 2;
      const crack = Math.random() < 0.20;
      const pan = (Math.random() - 0.5) * 0.15;
      AudioEngine.playForestStep(pan, vol, crack);
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

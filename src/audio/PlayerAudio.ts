import { AudioEngine } from './AudioEngine';

export class PlayerAudio {
  private breathLayer: ReturnType<typeof AudioEngine.createBreathLayer>;
  private footstepInterval: number | null = null;
  private activeIntervalMs = 0;

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

  updateBreath(breathLoad: number): void {
    this.breathLayer.setLoad(breathLoad);
  }

  updateFootsteps(speed: number, breathLoad: number): void {
    if (speed < 0.5) {
      this.clearFootstepInterval();
      return;
    }

    const intervalMs = speed < 5 ? 620 : speed < 8 ? 420 : 300;

    // Restart interval when speed tier changes
    if (this.footstepInterval !== null && intervalMs === this.activeIntervalMs) return;

    this.clearFootstepInterval();
    this.activeIntervalMs = intervalMs;
    this.footstepInterval = window.setInterval(() => {
      const vol = -22 + breathLoad * 6;
      AudioEngine.playFootstep(0, vol);
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

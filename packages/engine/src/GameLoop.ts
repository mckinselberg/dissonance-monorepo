import { Engine } from '@babylonjs/core';

type UpdateFn = (dt: number) => void;

export class GameLoop {
  private updateFn: UpdateFn;
  private engine: Engine;
  private running = false;
  private paused = false;
  private targetFrameIntervalMs: number | null = null;
  private accumulatedMs = 0;

  private readonly renderFrame = (): void => {
    const dtMs = this.engine.getDeltaTime();
    if (this.targetFrameIntervalMs !== null) {
      this.accumulatedMs = Math.min(this.accumulatedMs + dtMs, this.targetFrameIntervalMs * 2);
      if (this.accumulatedMs < this.targetFrameIntervalMs) return;
      this.accumulatedMs -= this.targetFrameIntervalMs;
    }
    const dt = Math.min(dtMs / 1000, 0.1);
    this.updateFn(dt);
  };

  private readonly resize = (): void => {
    this.engine.resize();
  };

  constructor(engine: Engine, updateFn: UpdateFn) {
    this.engine = engine;
    this.updateFn = updateFn;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.paused = false;

    this.engine.runRenderLoop(this.renderFrame);
    window.addEventListener('resize', this.resize);
  }

  pause(): void {
    if (!this.running || this.paused) return;
    this.paused = true;
    this.engine.stopRenderLoop(this.renderFrame);
  }

  resume(): void {
    if (!this.running || !this.paused) return;
    this.paused = false;
    this.engine.runRenderLoop(this.renderFrame);
  }

  isPaused(): boolean {
    return this.paused;
  }

  setTargetFps(fps: number | null): void {
    this.targetFrameIntervalMs = fps === null ? null : 1000 / fps;
    this.accumulatedMs = 0;
  }

  getTargetFps(): number | null {
    return this.targetFrameIntervalMs === null ? null : 1000 / this.targetFrameIntervalMs;
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.paused = false;
    this.engine.stopRenderLoop(this.renderFrame);
    window.removeEventListener('resize', this.resize);
  }
}

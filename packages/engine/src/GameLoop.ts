import { Engine } from '@babylonjs/core';

type UpdateFn = (dt: number) => void;

export class GameLoop {
  private updateFn: UpdateFn;
  private engine: Engine;
  private running = false;
  private paused = false;

  private readonly renderFrame = (): void => {
    const dt = this.engine.getDeltaTime() / 1000;
    const clampedDt = Math.min(dt, 0.1);
    this.updateFn(clampedDt);
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

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.paused = false;
    this.engine.stopRenderLoop(this.renderFrame);
    window.removeEventListener('resize', this.resize);
  }
}

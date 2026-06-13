import { Engine } from '@babylonjs/core';

type UpdateFn = (dt: number) => void;

export class GameLoop {
  private updateFn: UpdateFn;
  private engine: Engine;
  private running = false;

  constructor(engine: Engine, updateFn: UpdateFn) {
    this.engine = engine;
    this.updateFn = updateFn;
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    this.engine.runRenderLoop(() => {
      if (!this.running) return;
      const dt = this.engine.getDeltaTime() / 1000;
      const clampedDt = Math.min(dt, 0.1);  // cap at 100ms to prevent spiral
      this.updateFn(clampedDt);
    });

    window.addEventListener('resize', () => this.engine.resize());
  }

  stop(): void {
    this.running = false;
    this.engine.stopRenderLoop();
  }
}

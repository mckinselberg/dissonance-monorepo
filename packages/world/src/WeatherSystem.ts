import { Scene } from '@babylonjs/core';
import type { WeatherMode } from '@dta/shared-types';

export class WeatherSystem {
  private mode: WeatherMode = 'clear';
  private windIntensity = 0.0;
  private targetWindIntensity = 0.0;
  private gustTimer = 0;
  private windOverride: number | null = null;

  constructor(_scene: Scene) {
    // Scene reference kept for potential future particle systems
  }

  setWindOverride(v: number | null): void { this.windOverride = v; }

  update(dt: number, onWindChange: (v: number) => void): void {
    if (this.windOverride !== null) {
      this.windIntensity = this.windOverride;
      onWindChange(this.windIntensity);
      return;
    }

    this.windIntensity += (this.targetWindIntensity - this.windIntensity) * dt * 0.4;
    onWindChange(this.windIntensity);

    if (this.mode === 'windy') {
      this.gustTimer -= dt;
      if (this.gustTimer <= 0) {
        this.targetWindIntensity = 0.3 + Math.random() * 0.7;
        this.gustTimer = 4 + Math.random() * 10;

        const dropDelay = 2000 + Math.random() * 4000;
        setTimeout(() => {
          this.targetWindIntensity = 0.1 + Math.random() * 0.3;
        }, dropDelay);
      }
    }
  }

  setMode(mode: WeatherMode): void {
    this.mode = mode;
    if (mode === 'clear') {
      this.targetWindIntensity = 0.05;
    } else {
      this.targetWindIntensity = 0.5;
      this.gustTimer = 0;
    }
  }

  getMaskLevel(): number {
    return this.windIntensity;
  }
}

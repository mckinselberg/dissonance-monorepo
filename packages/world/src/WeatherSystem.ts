import { Scene } from '@babylonjs/core';
import type { PrecipitationMode, WeatherMode } from '@dissonance/shared-types';

export interface WeatherState {
  windIntensity: number;
  precipitationMode: PrecipitationMode;
  precipitationIntensity: number;
  rainIntensity: number;
  snowIntensity: number;
  noiseFloorOffset: number;
  fogBoost: number;
}

export interface WeatherProfile {
  precipitationLerpPerSecond: number;
  rainIntensityToNoiseFloor: number;
  snowIntensityToNoiseFloor: number;
  rainFogBoost: number;
  snowFogBoost: number;
}

export const DEFAULT_WEATHER_PROFILE: WeatherProfile = {
  precipitationLerpPerSecond: 0.025,
  rainIntensityToNoiseFloor: 0.24,
  snowIntensityToNoiseFloor: -0.18,
  rainFogBoost: 0.0025,
  snowFogBoost: 0.005,
};

export class WeatherSystem {
  private mode: WeatherMode = 'clear';
  private windIntensity = 0.0;
  private targetWindIntensity = 0.0;
  private gustTimer = 0;
  private windOverride: number | null = null;
  private windTime = 0;
  private precipitationMode: PrecipitationMode = 'none';
  private precipitationIntensity = 0;
  private targetPrecipitationIntensity = 0;

  constructor(
    _scene: Scene,
    private readonly profile: WeatherProfile = DEFAULT_WEATHER_PROFILE,
  ) {
    // Scene reference kept for potential future particle systems
  }

  setWindOverride(v: number | null): void { this.windOverride = v; }

  update(dt: number, onWindChange: (v: number) => void): void {
    this.windTime += Math.max(0, dt);
    const precipitationAlpha = 1 - Math.exp(-Math.max(0, dt) * this.profile.precipitationLerpPerSecond);
    this.precipitationIntensity +=
      (this.targetPrecipitationIntensity - this.precipitationIntensity) * precipitationAlpha;
    if (this.targetPrecipitationIntensity === 0 && this.precipitationIntensity < 0.001) {
      this.precipitationIntensity = 0;
    }

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

  requestPrecipitation(mode: PrecipitationMode, intensity = 1): void {
    this.precipitationMode = mode;
    this.targetPrecipitationIntensity = mode === 'none'
      ? 0
      : Math.max(0, Math.min(1, intensity));
  }

  setPrecipitationImmediate(mode: PrecipitationMode, intensity: number): void {
    this.requestPrecipitation(mode, intensity);
    this.precipitationIntensity = this.targetPrecipitationIntensity;
  }

  getState(): WeatherState {
    const rainIntensity =
      this.precipitationMode === 'rain' || this.precipitationMode === 'storm'
        ? this.precipitationIntensity
        : 0;
    const snowIntensity = this.precipitationMode === 'snow'
      ? this.precipitationIntensity
      : 0;
    return {
      windIntensity: this.windIntensity,
      precipitationMode: this.precipitationMode,
      precipitationIntensity: this.precipitationIntensity,
      rainIntensity,
      snowIntensity,
      noiseFloorOffset:
        rainIntensity * this.profile.rainIntensityToNoiseFloor +
        snowIntensity * this.profile.snowIntensityToNoiseFloor,
      fogBoost:
        rainIntensity * this.profile.rainFogBoost +
        snowIntensity * this.profile.snowFogBoost,
    };
  }

  getRainIntensity(): number {
    return this.getState().rainIntensity;
  }

  getNoiseFloorOffset(): number {
    return this.getState().noiseFloorOffset;
  }

  getMaskLevel(): number {
    return this.windIntensity;
  }

  getWindIntensity(): number {
    return this.windIntensity;
  }

  getWindTime(): number {
    return this.windTime;
  }
}

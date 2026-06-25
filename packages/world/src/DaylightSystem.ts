import {
  Scene,
  DirectionalLight,
  HemisphericLight,
  Color3,
  Vector3,
} from '@babylonjs/core';
import type { RunProfile, ExperienceProfile } from '@dissonance/shared-types';

export class DaylightSystem {
  private sun: DirectionalLight;
  private ambient: HemisphericLight;
  private elapsed = 0;
  private lightLevel: number;

  constructor(scene: Scene, runProfile: RunProfile, expProfile: ExperienceProfile) {
    this.lightLevel = runProfile.startingLightLevel;

    this.sun = new DirectionalLight('sun', new Vector3(-0.5, -1, 0.3), scene);
    this.sun.specular = Color3.Black();

    this.ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);
    this.ambient.specular = Color3.Black();

    if (expProfile.mode === 'ps1') {
      this.sun.diffuse = new Color3(1.0, 0.80, 0.32);
      this.sun.intensity = this.lightLevel * expProfile.ambientIntensity * 5.5;
      this.ambient.diffuse = new Color3(0.42, 0.60, 0.90);
      this.ambient.groundColor = new Color3(0.20, 0.28, 0.10);
      this.ambient.intensity = this.lightLevel * expProfile.ambientIntensity * 1.6;
    } else {
      this.sun.diffuse = new Color3(1.0, 0.85, 0.6);
      this.sun.intensity = this.lightLevel * expProfile.ambientIntensity * 3.0;
      this.ambient.diffuse = new Color3(0.5, 0.6, 0.8);
      this.ambient.groundColor = new Color3(0.08, 0.10, 0.06);
      this.ambient.intensity = this.lightLevel * expProfile.ambientIntensity;
    }
  }

  update(dt: number, runProfile: RunProfile, expProfile: ExperienceProfile): void {
    this.elapsed += dt;

    this.lightLevel = Math.max(
      0.04,
      runProfile.startingLightLevel - this.elapsed * runProfile.daylightDecayRate,
    );

    const warmth = this.lightLevel;

    if (expProfile.mode === 'ps1') {
      this.sun.intensity = this.lightLevel * expProfile.ambientIntensity * 5.5;
      this.ambient.intensity = this.lightLevel * expProfile.ambientIntensity * 1.6;
      this.sun.diffuse = new Color3(
        0.35 + warmth * 0.65,
        0.30 + warmth * 0.50,
        0.10 + warmth * 0.22,
      );
    } else {
      this.sun.intensity = this.lightLevel * expProfile.ambientIntensity * 3.0;
      this.ambient.intensity = this.lightLevel * expProfile.ambientIntensity;
      this.sun.diffuse = new Color3(0.4 + warmth * 0.6, 0.4 + warmth * 0.45, 0.4 + warmth * 0.2);
    }
  }

  getLightLevel(): number {
    return this.lightLevel;
  }

  getNightLevel(): number {
    return 1 - this.lightLevel;
  }
}

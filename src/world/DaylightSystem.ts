import {
  Scene,
  DirectionalLight,
  HemisphericLight,
  Color3,
  Vector3,
} from '@babylonjs/core';
import type { RunProfile, ExperienceProfile } from '../types';

export class DaylightSystem {
  private sun: DirectionalLight;
  private ambient: HemisphericLight;
  private elapsed = 0;
  private lightLevel: number;

  constructor(scene: Scene, runProfile: RunProfile, expProfile: ExperienceProfile) {
    this.lightLevel = runProfile.startingLightLevel;

    this.sun = new DirectionalLight('sun', new Vector3(-0.5, -1, 0.3), scene);
    this.sun.intensity = this.lightLevel * expProfile.ambientIntensity * 3.0;
    this.sun.diffuse = new Color3(1.0, 0.85, 0.6);
    this.sun.specular = Color3.Black();

    this.ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);
    this.ambient.intensity = this.lightLevel * expProfile.ambientIntensity;
    this.ambient.diffuse = new Color3(0.5, 0.6, 0.8);
    this.ambient.groundColor = new Color3(0.08, 0.10, 0.06);
    this.ambient.specular = Color3.Black();
  }

  update(dt: number, runProfile: RunProfile, expProfile: ExperienceProfile): void {
    this.elapsed += dt;

    // Light level fades over time
    this.lightLevel = Math.max(
      0.04,
      runProfile.startingLightLevel - this.elapsed * runProfile.daylightDecayRate,
    );

    this.sun.intensity = this.lightLevel * expProfile.ambientIntensity * 3.0;
    this.ambient.intensity = this.lightLevel * expProfile.ambientIntensity;

    // Shift sun color toward blue as it gets darker
    const warmth = this.lightLevel;
    this.sun.diffuse = new Color3(0.4 + warmth * 0.6, 0.4 + warmth * 0.45, 0.4 + warmth * 0.2);
  }

  getLightLevel(): number {
    return this.lightLevel;
  }

  // Returns 0 (day) .. 1 (night) for audio systems
  getNightLevel(): number {
    return 1 - this.lightLevel;
  }
}

import {
  Scene,
  DirectionalLight,
  HemisphericLight,
  ShadowGenerator,
  RenderTargetTexture,
  Color3,
  Vector3,
} from '@babylonjs/core';
import type { RunProfile, ExperienceProfile } from '@dissonance/shared-types';

export class DaylightSystem {
  private sun: DirectionalLight;
  private ambient: HemisphericLight;
  private shadowGenerator: ShadowGenerator;
  private elapsed = 0;
  private lightLevel: number;
  private isNight: boolean;

  constructor(scene: Scene, runProfile: RunProfile, expProfile: ExperienceProfile) {
    this.lightLevel = runProfile.startingLightLevel;
    this.isNight = runProfile.departureTime === 'night';

    this.sun = new DirectionalLight('sun', new Vector3(-0.5, -1, 0.3), scene);
    this.sun.specular = Color3.Black();

    this.ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);
    this.ambient.specular = Color3.Black();

    // One shadow-casting light only — a real-time shadow map per light is
    // expensive, and the moonlight/sun is the only one that needs to ground
    // trees/rocks visually. The player's flashlight (PlayerController)
    // deliberately does not cast shadows.
    this.shadowGenerator = new ShadowGenerator(1024, this.sun);
    this.shadowGenerator.usePercentageCloserFiltering = true;
    this.shadowGenerator.bias = 0.002;

    // Overcast reference (docs/dissonance-forest-color-handoff.md) has
    // almost no hard shadows — lift instead of switching shadow techniques,
    // so this stays cheap. Genesis/night keep full-strength shadows.
    if (expProfile.mode === 'ps3' && expProfile.lookVariant === 'overcast' && !this.isNight) {
      this.shadowGenerator.darkness = 0.3;
    }

    // Every registered caster (trees, rocks — over a thousand at full
    // forest scale) is static once placed, and the sun's *direction* never
    // changes (only its color/intensity over time) — so the shadow map's
    // actual content never needs to change after the first frame. Without
    // this, Babylon re-renders the full depth pass for every caster every
    // single frame forever, which is almost certainly what was driving FPS
    // down into single digits. World generation (which adds all the
    // casters) runs synchronously before the game loop's first render, so
    // by the time this "render once" actually fires, every caster is
    // already registered.
    this.shadowGenerator.getShadowMap()!.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;

    if (this.isNight) {
      this.sun.diffuse = new Color3(0.55, 0.62, 0.85);
      this.sun.intensity = this.lightLevel * expProfile.ambientIntensity * 2.5;
      this.ambient.diffuse = new Color3(0.10, 0.16, 0.24);
      this.ambient.groundColor = new Color3(0.02, 0.03, 0.02);
      this.ambient.intensity = this.lightLevel * expProfile.ambientIntensity * 0.7;
    } else if (expProfile.mode === 'ps3' && expProfile.lookVariant === 'overcast') {
      // Overcast bounce rig (docs/dissonance-forest-color-handoff.md) — no
      // visible sun direction; everything lit by sky + a green-contaminated
      // ground bounce instead of a warm directional key. The genesis ps3
      // golden-hour rig below is preserved and still selectable via
      // expProfile.lookVariant === 'genesis'.
      this.sun.diffuse = new Color3(0.92, 0.94, 0.92);
      this.sun.intensity = this.lightLevel * expProfile.ambientIntensity * 1.9;
      this.ambient.diffuse = new Color3(0.87, 0.91, 0.89);
      this.ambient.groundColor = new Color3(0.36, 0.42, 0.25);
      this.ambient.intensity = this.lightLevel * expProfile.ambientIntensity * 2.7;
    } else if (expProfile.mode === 'ps3') {
      // Genesis — original warm golden-hour ps3 rig.
      this.sun.diffuse = new Color3(1.0, 0.76, 0.48);
      this.sun.intensity = this.lightLevel * expProfile.ambientIntensity * 7.2;
      this.ambient.diffuse = new Color3(0.24, 0.34, 0.50);
      this.ambient.groundColor = new Color3(0.035, 0.06, 0.035);
      this.ambient.intensity = this.lightLevel * expProfile.ambientIntensity * 0.7;
    } else if (expProfile.mode === 'ps2') {
      this.sun.diffuse = new Color3(1.0, 0.70, 0.38);
      this.sun.intensity = this.lightLevel * expProfile.ambientIntensity * 6.8;
      this.ambient.diffuse = new Color3(0.20, 0.28, 0.44);
      this.ambient.groundColor = new Color3(0.025, 0.045, 0.025);
      this.ambient.intensity = this.lightLevel * expProfile.ambientIntensity * 0.58;
    } else if (expProfile.mode === 'ps1') {
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
      this.isNight ? 0.10 : 0.04,
      runProfile.startingLightLevel - this.elapsed * runProfile.daylightDecayRate,
    );

    const warmth = this.lightLevel;

    if (this.isNight) {
      this.sun.intensity = this.lightLevel * expProfile.ambientIntensity * 2.5;
      this.ambient.intensity = this.lightLevel * expProfile.ambientIntensity * 0.7;
      // Stays cool/blue rather than warming up — moonlight doesn't redden
      // the way a setting sun does.
      this.sun.diffuse = new Color3(
        0.30 + warmth * 0.25,
        0.36 + warmth * 0.26,
        0.55 + warmth * 0.30,
      );
    } else if (expProfile.mode === 'ps3' && expProfile.lookVariant === 'overcast') {
      this.sun.intensity = this.lightLevel * expProfile.ambientIntensity * 1.9;
      this.ambient.intensity = this.lightLevel * expProfile.ambientIntensity * 2.7;
      // Stays in the cool overcast family throughout — dims toward dusk
      // rather than warming toward gold, matching the reference's "no
      // visible sun direction" read. warmth=1 matches the constructor's
      // initial (0.92, 0.94, 0.92) exactly, for continuity at run start.
      this.sun.diffuse = new Color3(
        0.55 + warmth * 0.37,
        0.60 + warmth * 0.34,
        0.55 + warmth * 0.37,
      );
    } else if (expProfile.mode === 'ps3') {
      this.sun.intensity = this.lightLevel * expProfile.ambientIntensity * 7.2;
      this.ambient.intensity = this.lightLevel * expProfile.ambientIntensity * 0.7;
      this.sun.diffuse = new Color3(
        0.34 + warmth * 0.66,
        0.28 + warmth * 0.48,
        0.16 + warmth * 0.32,
      );
    } else if (expProfile.mode === 'ps2') {
      this.sun.intensity = this.lightLevel * expProfile.ambientIntensity * 6.8;
      this.ambient.intensity = this.lightLevel * expProfile.ambientIntensity * 0.58;
      this.sun.diffuse = new Color3(
        0.28 + warmth * 0.72,
        0.24 + warmth * 0.46,
        0.14 + warmth * 0.24,
      );
    } else if (expProfile.mode === 'ps1') {
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

  getShadowGenerator(): ShadowGenerator {
    return this.shadowGenerator;
  }
}

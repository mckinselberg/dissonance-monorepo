import {
  Engine,
  Scene,
  Color3,
  Color4,
} from '@babylonjs/core';
import type { ExperienceProfile, RunProfile } from '@dta/shared-types';

export class SceneFactory {
  static create(
    canvas: HTMLCanvasElement,
    expProfile: ExperienceProfile,
    _runProfile: RunProfile,
  ): { engine: Engine; scene: Scene } {
    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });

    const scene = new Scene(engine);

    const sky = expProfile.skyColor;
    const fog = expProfile.fogColor;

    scene.clearColor = new Color4(sky.r, sky.g, sky.b, 1.0);
    scene.ambientColor = new Color3(sky.r * 0.5, sky.g * 0.5, sky.b * 0.5);

    scene.fogMode = Scene.FOGMODE_EXP;
    scene.fogDensity = expProfile.fogDensity;
    scene.fogColor = new Color3(fog.r, fog.g, fog.b);
    scene.fogStart = 2;
    scene.fogEnd = expProfile.drawDistance;

    return { engine, scene };
  }

  static updateFog(
    scene: Scene,
    baseDensity: number,
    lightLevel: number,
    weatherMask: number,
  ): void {
    const nightFog = (1 - lightLevel) * 0.04;
    const windFog = weatherMask * 0.015;
    scene.fogDensity = baseDensity + nightFog + windFog;
  }
}

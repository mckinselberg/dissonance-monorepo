import {
  Engine,
  Scene,
  Camera,
  Color3,
  Color4,
  MeshBuilder,
  StandardMaterial,
  VertexBuffer,
  DefaultRenderingPipeline,
  SSAO2RenderingPipeline,
  MotionBlurPostProcess,
  ColorCurves,
} from '@babylonjs/core';
import type { ExperienceProfile, RunProfile } from '@dissonance/shared-types';

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

    SceneFactory.buildSkyGradient(scene, sky);

    return { engine, scene };
  }

  // A single flat clearColor reads as an unnaturally uniform sky. This
  // paints a cheap zenith-to-horizon gradient onto a giant inverted dome
  // using per-vertex color instead of a texture — no asset pipeline needed.
  private static buildSkyGradient(scene: Scene, sky: { r: number; g: number; b: number }): void {
    const dome = MeshBuilder.CreateSphere('skyDome', { diameter: 850, segments: 14 }, scene);
    dome.infiniteDistance = true;
    dome.applyFog = false;
    dome.isPickable = false;

    const mat = new StandardMaterial('skyDomeMat', scene);
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    dome.material = mat;

    const horizon = new Color3(sky.r, sky.g, sky.b);
    const zenith = new Color3(sky.r * 0.45, sky.g * 0.55, sky.b * 0.95);

    const positions = dome.getVerticesData(VertexBuffer.PositionKind)!;
    const colors: number[] = [];
    for (let i = 0; i < positions.length; i += 3) {
      const y = positions[i + 1];
      const t = Math.max(0, Math.min(1, y / 425 + 0.15));
      colors.push(
        horizon.r + (zenith.r - horizon.r) * t,
        horizon.g + (zenith.g - horizon.g) * t,
        horizon.b + (zenith.b - horizon.b) * t,
        1,
      );
    }
    dome.setVerticesData(VertexBuffer.ColorKind, colors);

    dome.renderingGroupId = 0;
  }

  // Conservative/cheap settings throughout — low SSAO render ratio, small
  // bloom kernel, light motion blur. This scene already carries a doubled
  // tree count plus shadows/PBR; the post-process budget here is deliberately
  // trimmed rather than matched 1:1 to the graphics-prompt doc's settings.
  // Returns the motion blur post-process so the caller can drive its
  // strength from actual player speed each frame (see Game.tick) instead
  // of leaving it at one constant value regardless of movement.
  static createPostProcessing(
    scene: Scene, camera: Camera,
  ): { motionBlur: MotionBlurPostProcess; ssao: SSAO2RenderingPipeline; pipeline: DefaultRenderingPipeline } {
    const ssao = new SSAO2RenderingPipeline('ssao', scene, {
      ssaoRatio: 0.5,
      blurRatio: 0.5,
    }, [camera]);
    ssao.totalStrength = 0.35;
    ssao.radius = 2;
    ssao.base = 0.2;
    ssao.samples = 8;

    const pipeline = new DefaultRenderingPipeline('default', true, scene, [camera]);

    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.8;
    pipeline.bloomWeight = 0.12;
    pipeline.bloomKernel = 32;
    pipeline.bloomScale = 0.5;

    pipeline.grainEnabled = true;
    pipeline.grain.intensity = 6;
    pipeline.grain.animated = true;

    pipeline.imageProcessingEnabled = true;
    pipeline.imageProcessing.contrast = 1.0;
    pipeline.imageProcessing.exposure = 1.0;
    pipeline.imageProcessing.colorCurvesEnabled = true;
    const curves = new ColorCurves();
    curves.globalSaturation = -8;
    curves.globalDensity = 4;
    pipeline.imageProcessing.colorCurves = curves;

    const motionBlur = new MotionBlurPostProcess('motionBlur', scene, 0, camera);
    return { motionBlur, ssao, pipeline };
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

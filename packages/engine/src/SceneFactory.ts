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
  ImageProcessingConfiguration,
  Vector3,
  Mesh,
} from '@babylonjs/core';
import type { ExperienceProfile, RunProfile } from '@dissonance/shared-types';

// Overcast forest fog retint (docs/dissonance-forest-color-handoff.md,
// section 4) — grey-green so distance dissolves into "more forest" rather
// than atmospheric blue/brown. Only used when expProfile.lookVariant ===
// 'overcast'; genesis fog values (in experienceProfiles.ts and below) are
// untouched and still selectable by leaving lookVariant unset/'genesis'.
const PS3_OVERCAST_FOG = new Color3(0.62, 0.70, 0.60);
const PS3_OVERCAST_FOG_DUSK = new Color3(0.34, 0.38, 0.33);

function isOvercast(expProfile?: ExperienceProfile): boolean {
  return expProfile?.mode === 'ps3' && expProfile?.lookVariant === 'overcast';
}

export class SceneFactory {
  static create(
    canvas: HTMLCanvasElement,
    expProfile: ExperienceProfile,
    runProfile: RunProfile,
  ): { engine: Engine; scene: Scene } {
    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });

    const scene = new Scene(engine);

    const isNight = runProfile.departureTime === 'night';

    // Night overrides the profile's day-sky blue with a charcoal gradient so
    // tree silhouettes read against the sky instead of both being near-black.
    const sky = isNight
      ? { r: 0.24, g: 0.24, b: 0.27 }
      : expProfile.skyColor;
    const skyZenith = isNight
      ? { r: 0.05, g: 0.05, b: 0.07 }
      : null;
    const fog = expProfile.fogColor;

    scene.clearColor = new Color4(sky.r, sky.g, sky.b, 1.0);
    scene.ambientColor = new Color3(sky.r * 0.5, sky.g * 0.5, sky.b * 0.5);

    scene.fogMode = Scene.FOGMODE_EXP;
    scene.fogDensity = expProfile.fogDensity;
    scene.fogColor = isNight
      ? new Color3(0.14, 0.14, 0.15)
      : isOvercast(expProfile)
      ? PS3_OVERCAST_FOG
      : new Color3(fog.r, fog.g, fog.b);
    scene.fogStart = 2;
    scene.fogEnd = expProfile.drawDistance;

    SceneFactory.buildSkyGradient(scene, sky, skyZenith, expProfile, runProfile);

    return { engine, scene };
  }

  // A single flat clearColor reads as an unnaturally uniform sky. This
  // paints a cheap zenith-to-horizon gradient onto a giant inverted dome
  // using per-vertex color instead of a texture — no asset pipeline needed.
  private static buildSkyGradient(
    scene: Scene,
    sky: { r: number; g: number; b: number },
    zenithOverride?: { r: number; g: number; b: number } | null,
    expProfile?: ExperienceProfile,
    runProfile?: RunProfile,
  ): void {
    const dome = MeshBuilder.CreateSphere('skyDome', { diameter: 850, segments: 14 }, scene);
    dome.infiniteDistance = true;
    dome.applyFog = false;
    dome.isPickable = false;

    const mat = new StandardMaterial('skyDomeMat', scene);
    mat.disableLighting = true;
    // With disableLighting on, StandardMaterial's finalDiffuse is
    // clamp(emissiveColor + vAmbientColor) * vertexColor — with emissiveColor
    // and ambientColor both left at their default black, that clamp is
    // always zero regardless of the gradient painted below, so the dome has
    // been rendering solid black in every mode. White emissive makes the
    // vertex-color gradient itself the final output, independent of scene
    // lighting (the intent — the sky shouldn't dim/tint with the ambient
    // light that drives ground-level time-of-day).
    mat.emissiveColor = Color3.White();
    mat.backFaceCulling = false;
    dome.material = mat;

    const ps3 = expProfile?.mode === 'ps3';
    const afternoon = runProfile?.departureTime === 'afternoon';
    const dusk = runProfile?.departureTime === 'dusk';
    const horizon = ps3 && afternoon
      ? new Color3(0.74, 0.54, 0.28)
      : ps3 && dusk
      ? new Color3(0.46, 0.27, 0.20)
      : ps3 && runProfile?.departureTime !== 'night'
      ? new Color3(Math.min(1, sky.r * 1.18 + 0.08), Math.min(1, sky.g * 0.98 + 0.05), Math.min(1, sky.b * 0.78 + 0.03))
      : new Color3(sky.r, sky.g, sky.b);
    const zenith = zenithOverride
      ? new Color3(zenithOverride.r, zenithOverride.g, zenithOverride.b)
      : ps3 && afternoon
      ? new Color3(0.17, 0.26, 0.42)
      : ps3 && dusk
      ? new Color3(0.08, 0.12, 0.22)
      : ps3
      ? new Color3(sky.r * 0.34, sky.g * 0.48, sky.b * 1.06)
      : new Color3(sky.r * 0.45, sky.g * 0.55, sky.b * 0.95);

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

    if (ps3 && runProfile) SceneFactory.buildPs3SkyTreatment(scene, runProfile);
  }

  private static buildPs3SkyTreatment(scene: Scene, runProfile: RunProfile): void {
    const night = runProfile.departureTime === 'night';
    const dusk = runProfile.departureTime === 'dusk';

    // A flat single-color band read as an obvious hard-edged rectangle cut
    // into the sky dome's own smooth gradient. Using the dome's own
    // vertex-color-gradient trick here too — fading from the golden haze
    // tone at the bottom rim to fully transparent at the top rim — lets it
    // blend into the dome instead of showing a seam.
    const hazeMat = new StandardMaterial('ps3HorizonHazeMat', scene);
    hazeMat.disableLighting = true;
    // Same fix as skyDomeMat above — without this the vertex-color gradient
    // set below is multiplied by zero and the haze band is invisible.
    hazeMat.emissiveColor = Color3.White();
    hazeMat.backFaceCulling = false;
    // Just under 1 so the per-vertex alpha below actually drives blending
    // instead of being ignored as fully opaque.
    hazeMat.alpha = 0.999;

    const haze = MeshBuilder.CreateCylinder('ps3HorizonHaze', {
      diameter: 780,
      height: 56,
      tessellation: 64,
      cap: Mesh.NO_CAP,
    }, scene);
    haze.position.y = -8;
    haze.material = hazeMat;
    haze.applyFog = false;
    haze.isPickable = false;
    haze.infiniteDistance = true;
    haze.hasVertexAlpha = true;

    const hazeGold = night
      ? new Color3(0.10, 0.12, 0.18)
      : dusk
        ? new Color3(0.62, 0.30, 0.17)
        : new Color3(0.92, 0.62, 0.28);
    const hazePeakAlpha = night ? 0.16 : dusk ? 0.24 : 0.28;
    const hazePositions = haze.getVerticesData(VertexBuffer.PositionKind)!;
    const hazeColors: number[] = [];
    for (let i = 0; i < hazePositions.length; i += 3) {
      const y = hazePositions[i + 1];
      const t = Math.max(0, Math.min(1, (y + 28) / 56)); // 0 at bottom rim, 1 at top rim
      hazeColors.push(hazeGold.r, hazeGold.g, hazeGold.b, hazePeakAlpha * (1 - t));
    }
    haze.setVerticesData(VertexBuffer.ColorKind, hazeColors);

    const sunMat = new StandardMaterial('ps3SunDiscMat', scene);
    sunMat.disableLighting = true;
    sunMat.backFaceCulling = false;
    sunMat.alpha = night ? 0.78 : 0.92;
    sunMat.emissiveColor = night
      ? new Color3(0.52, 0.58, 0.86)
      : dusk
        ? new Color3(1.0, 0.54, 0.25)
        : new Color3(1.0, 0.74, 0.34);

    const glowMat = new StandardMaterial('ps3SunGlowMat', scene);
    glowMat.disableLighting = true;
    glowMat.backFaceCulling = false;
    glowMat.alpha = night ? 0.18 : 0.24;
    glowMat.emissiveColor = night
      ? new Color3(0.30, 0.35, 0.64)
      : dusk
        ? new Color3(0.85, 0.30, 0.12)
        : new Color3(0.95, 0.55, 0.22);

    const bodyPos = night
      ? new Vector3(210, 185, -210)
      : new Vector3(-250, dusk ? 110 : 132, 210);
    const glow = MeshBuilder.CreateDisc('ps3SunGlow', {
      radius: night ? 34 : 48,
      tessellation: 48,
      sideOrientation: Mesh.DOUBLESIDE,
    }, scene);
    glow.position.copyFrom(bodyPos);
    glow.billboardMode = Mesh.BILLBOARDMODE_ALL;
    glow.material = glowMat;
    glow.applyFog = false;
    glow.isPickable = false;
    glow.infiniteDistance = true;

    const disc = MeshBuilder.CreateDisc('ps3SunDisc', {
      radius: night ? 10 : 13,
      tessellation: 40,
      sideOrientation: Mesh.DOUBLESIDE,
    }, scene);
    disc.position.copyFrom(bodyPos);
    disc.billboardMode = Mesh.BILLBOARDMODE_ALL;
    disc.material = sunMat;
    disc.applyFog = false;
    disc.isPickable = false;
    disc.infiniteDistance = true;

    const wispMat = new StandardMaterial('ps3HighWispMat', scene);
    wispMat.disableLighting = true;
    wispMat.backFaceCulling = false;
    wispMat.alpha = night ? 0.10 : 0.18;
    wispMat.emissiveColor = night
      ? new Color3(0.16, 0.17, 0.24)
      : dusk
        ? new Color3(0.34, 0.26, 0.24)
        : new Color3(0.68, 0.56, 0.42);

    const wispCount = night ? 7 : 11;
    for (let i = 0; i < wispCount; i++) {
      const wisp = MeshBuilder.CreatePlane(`ps3SkyWisp_${i}`, {
        width: 80 + Math.random() * 110,
        height: 7 + Math.random() * 12,
      }, scene);
      wisp.position.set(
        -310 + Math.random() * 620,
        120 + Math.random() * 80,
        -260 + Math.random() * 520,
      );
      wisp.rotation.set(
        -0.16 + Math.random() * 0.08,
        Math.random() * Math.PI,
        (Math.random() - 0.5) * 0.18,
      );
      wisp.material = wispMat;
      wisp.applyFog = false;
      wisp.isPickable = false;
      wisp.infiniteDistance = true;
    }
  }

  // Conservative/cheap settings throughout — low SSAO render ratio, small
  // bloom kernel, light motion blur. This scene already carries a doubled
  // tree count plus shadows/PBR; the post-process budget here is deliberately
  // trimmed rather than matched 1:1 to the graphics-prompt doc's settings.
  // Returns the motion blur post-process so the caller can drive its
  // strength from actual player speed each frame (see Game.tick) instead
  // of leaving it at one constant value regardless of movement.
  static createPostProcessing(
    scene: Scene, camera: Camera, expProfile?: ExperienceProfile,
  ): { motionBlur: MotionBlurPostProcess; ssao: SSAO2RenderingPipeline; pipeline: DefaultRenderingPipeline } {
    const ps2 = expProfile?.mode === 'ps2';
    const ps3 = expProfile?.mode === 'ps3';
    const overcast = isOvercast(expProfile);
    const ssao = new SSAO2RenderingPipeline('ssao', scene, {
      ssaoRatio: ps3 ? 0.8 : ps2 ? 0.65 : 0.5,
      blurRatio: ps3 ? 0.65 : 0.5,
    }, [camera]);
    // Overcast wants SSAO to read as contact darkening at leaf-litter/log
    // bases, not a global dirt pass — smaller radius, slightly higher
    // strength than genesis ps3.
    ssao.totalStrength = overcast ? 0.85 : ps3 ? 0.72 : ps2 ? 0.55 : 0.35;
    ssao.radius = overcast ? 1.8 : ps3 ? 3.6 : ps2 ? 2.8 : 2;
    ssao.base = 0.2;
    ssao.samples = ps3 ? 16 : ps2 ? 12 : 8;

    const pipeline = new DefaultRenderingPipeline('default', true, scene, [camera]);

    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = ps3 ? 0.56 : ps2 ? 0.62 : 0.8;
    pipeline.bloomWeight = ps3 ? 0.30 : ps2 ? 0.24 : 0.12;
    pipeline.bloomKernel = ps3 ? 64 : ps2 ? 48 : 32;
    pipeline.bloomScale = ps3 ? 0.65 : 0.5;

    pipeline.grainEnabled = true;
    pipeline.grain.intensity = ps3 ? 5 : ps2 ? 9 : 6;
    pipeline.grain.animated = true;

    pipeline.imageProcessingEnabled = true;
    // Overcast wants lifted shadows (contrast below 1) and a brighter,
    // desaturated-then-boosted read — the opposite direction from genesis
    // ps3's punchier golden-hour grade.
    pipeline.imageProcessing.contrast = overcast ? 0.9 : ps3 ? 1.18 : ps2 ? 1.12 : 1.0;
    pipeline.imageProcessing.exposure = overcast ? 1.15 : ps3 ? 1.02 : ps2 ? 0.95 : 1.0;
    pipeline.imageProcessing.toneMappingEnabled = overcast;
    if (overcast) pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    pipeline.imageProcessing.colorCurvesEnabled = true;
    const curves = new ColorCurves();
    curves.globalSaturation = overcast ? 15 : ps3 ? -6 : ps2 ? -14 : -8;
    curves.globalDensity = ps3 ? 5 : ps2 ? 8 : 4;
    if (overcast) {
      // Shadow tint toward green-teal — highlights stay neutral so only
      // the darker end of the range reads as "under canopy."
      curves.shadowsHue = 150;
      curves.shadowsSaturation = 12;
      curves.shadowsDensity = 8;
    }
    pipeline.imageProcessing.colorCurves = curves;

    const motionBlur = new MotionBlurPostProcess('motionBlur', scene, 0, camera);
    return { motionBlur, ssao, pipeline };
  }

  static updateFog(
    scene: Scene,
    baseDensity: number,
    lightLevel: number,
    weatherMask: number,
    expProfile?: ExperienceProfile,
    runProfile?: RunProfile,
  ): void {
    const ps3 = expProfile?.mode === 'ps3';
    const nightFog = (1 - lightLevel) * (ps3 ? 0.020 : 0.04);
    const windFog = weatherMask * (ps3 ? 0.010 : 0.015);
    scene.fogDensity = baseDensity + nightFog + windFog;

    const overcast = isOvercast(expProfile);
    if (ps3 && runProfile?.departureTime === 'afternoon') {
      scene.fogColor = overcast ? PS3_OVERCAST_FOG : new Color3(0.24, 0.21, 0.16);
    } else if (ps3 && runProfile?.departureTime === 'dusk') {
      scene.fogColor = overcast ? PS3_OVERCAST_FOG_DUSK : new Color3(0.13, 0.12, 0.13);
    }
  }
}

import {
  Material,
  MaterialPluginBase,
  PBRMaterial,
  ShaderLanguage,
  StandardMaterial,
} from '@babylonjs/core';
import type {
  Color3,
  Observer,
  Scene,
  UniformBuffer,
} from '@babylonjs/core';

const PLUGIN_NAME = 'HazeBandFogMaterialPlugin';
const PLUGIN_PRIORITY = 220;

export interface HazeBandFogBand {
  /** Normalized EXP2 extinction position (distance fallback at zero density). */
  readonly depth: number;
  readonly color: Color3;
  readonly inscatter: number;
}

export type FixedFourHazeBands = readonly [
  HazeBandFogBand,
  HazeBandFogBand,
  HazeBandFogBand,
  HazeBandFogBand,
];

export interface HazeBandFogConfig {
  readonly bands: FixedFourHazeBands;
  /** Normalized half-width of each transition between bands. */
  readonly bandSoftness: number;
  /** Strength of altitude attenuation; zero produces height-uniform haze. */
  readonly heightFalloff: number;
  /** World-space distance represented by depth 1 when density is zero. */
  readonly farDistance: number;
  /** EXP2 optical-density fallback used by a standalone material plugin. */
  readonly density: number;
  /** Optional final red-channel multiplier. Defaults to the no-op value 1. */
  readonly redChannelGain?: number;
}

export type HazeBandFogMaterial = PBRMaterial | StandardMaterial;
export type HazeBandFogDensitySource = () => number;

function isSupportedMaterial(material: Material): material is HazeBandFogMaterial {
  return material instanceof PBRMaterial || material instanceof StandardMaterial;
}

/**
 * Fixed-four depth-band inscattering for Babylon's stock PBR and Standard
 * materials. The fragment work is fully unrolled and relies only on the
 * existing world-position varying, so it does not add per-instance attributes
 * and remains compatible with thin instances.
 *
 * Babylon 7 exposes `CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR` as the only stable
 * fragment injection point shared by both material families after stock fog.
 * It is also after their built-in image-processing block. This guarantees that
 * haze layers over stock fog and reaches downstream bloom, but means this
 * plugin operates in the host material's final color space rather than at a
 * shared linear-space, pre-grade hook.
 */
export class HazeBandFogMaterialPlugin extends MaterialPluginBase {
  private config: HazeBandFogConfig | null;
  private densitySource: HazeBandFogDensitySource | null;

  constructor(
    material: HazeBandFogMaterial,
    config: HazeBandFogConfig | null = null,
    densitySource: HazeBandFogDensitySource | null = null,
  ) {
    super(material, PLUGIN_NAME, PLUGIN_PRIORITY, undefined, true, true);
    this.config = config;
    this.densitySource = densitySource;
  }

  override getClassName(): string {
    return PLUGIN_NAME;
  }

  /** Updates uniforms on subsequent binds; no material recreation is needed. */
  setConfig(config: HazeBandFogConfig | null): void {
    this.config = config;
  }

  /**
   * Overrides config density with a live source. Scene controllers use this to
   * track weather/underwater edits to `scene.fogDensity` frame by frame.
   */
  setDensitySource(source: HazeBandFogDensitySource | null): void {
    this.densitySource = source;
  }

  override getUniforms() {
    return {
      ubo: [
        { name: 'dissonanceHazeEnabled', size: 1, type: 'float' },
        { name: 'dissonanceHazeBandDepths', size: 4, type: 'vec4' },
        { name: 'dissonanceHazeBandColor0', size: 3, type: 'vec3' },
        { name: 'dissonanceHazeBandColor1', size: 3, type: 'vec3' },
        { name: 'dissonanceHazeBandColor2', size: 3, type: 'vec3' },
        { name: 'dissonanceHazeBandColor3', size: 3, type: 'vec3' },
        { name: 'dissonanceHazeBandInscatters', size: 4, type: 'vec4' },
        { name: 'dissonanceHazeBandSoftness', size: 1, type: 'float' },
        { name: 'dissonanceHazeHeightFalloff', size: 1, type: 'float' },
        { name: 'dissonanceHazeFarDistance', size: 1, type: 'float' },
        { name: 'dissonanceHazeDensity', size: 1, type: 'float' },
        { name: 'dissonanceHazeRedChannelGain', size: 1, type: 'float' },
      ],
      fragment: `
        uniform float dissonanceHazeEnabled;
        uniform vec4 dissonanceHazeBandDepths;
        uniform vec3 dissonanceHazeBandColor0;
        uniform vec3 dissonanceHazeBandColor1;
        uniform vec3 dissonanceHazeBandColor2;
        uniform vec3 dissonanceHazeBandColor3;
        uniform vec4 dissonanceHazeBandInscatters;
        uniform float dissonanceHazeBandSoftness;
        uniform float dissonanceHazeHeightFalloff;
        uniform float dissonanceHazeFarDistance;
        uniform float dissonanceHazeDensity;
        uniform float dissonanceHazeRedChannelGain;
      `,
    };
  }

  override bindForSubMesh(uniformBuffer: UniformBuffer): void {
    const config = this.config;
    if (!config) {
      uniformBuffer.updateFloat('dissonanceHazeEnabled', 0);
      uniformBuffer.updateFloat('dissonanceHazeRedChannelGain', 1);
      return;
    }

    const [band0, band1, band2, band3] = config.bands;
    const sourcedDensity = this.densitySource?.();
    const density = typeof sourcedDensity === 'number' && Number.isFinite(sourcedDensity)
      ? sourcedDensity
      : config.density;

    uniformBuffer.updateFloat('dissonanceHazeEnabled', 1);
    uniformBuffer.updateFloat4(
      'dissonanceHazeBandDepths',
      band0.depth,
      band1.depth,
      band2.depth,
      band3.depth,
    );
    uniformBuffer.updateColor3('dissonanceHazeBandColor0', band0.color);
    uniformBuffer.updateColor3('dissonanceHazeBandColor1', band1.color);
    uniformBuffer.updateColor3('dissonanceHazeBandColor2', band2.color);
    uniformBuffer.updateColor3('dissonanceHazeBandColor3', band3.color);
    uniformBuffer.updateFloat4(
      'dissonanceHazeBandInscatters',
      band0.inscatter,
      band1.inscatter,
      band2.inscatter,
      band3.inscatter,
    );
    uniformBuffer.updateFloat('dissonanceHazeBandSoftness', config.bandSoftness);
    uniformBuffer.updateFloat('dissonanceHazeHeightFalloff', config.heightFalloff);
    uniformBuffer.updateFloat('dissonanceHazeFarDistance', config.farDistance);
    uniformBuffer.updateFloat('dissonanceHazeDensity', Math.max(0, density));
    uniformBuffer.updateFloat(
      'dissonanceHazeRedChannelGain',
      config.redChannelGain ?? 1,
    );
  }

  override getCustomCode(shaderType: string, shaderLanguage = ShaderLanguage.GLSL) {
    if (shaderType !== 'fragment' || shaderLanguage !== ShaderLanguage.GLSL) return null;

    const outputColor = this._material instanceof PBRMaterial ? 'finalColor' : 'color';
    return {
      CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: `
        {
          float dissonanceHazeDistance = length(vPositionW - vEyePosition.xyz);
          float dissonanceHazeFar = max(dissonanceHazeFarDistance, 0.0001);
          float dissonanceHazeOpticalDepth =
            max(dissonanceHazeDensity, 0.0) * dissonanceHazeDistance;
          float dissonanceHazeExtinction = 1.0 - exp(
            -dissonanceHazeOpticalDepth * dissonanceHazeOpticalDepth
          );
          // Follow the live EXP2 extinction curve so authored bands remain
          // visible before stock fog becomes opaque. Normalized far distance
          // is retained only as a deterministic zero-density fallback.
          float dissonanceHazeRawDepth = dissonanceHazeDensity > 0.000001
            ? dissonanceHazeExtinction
            : clamp(dissonanceHazeDistance / dissonanceHazeFar, 0.0, 1.0);

          float dissonanceHazeDepthSpan = max(
            dissonanceHazeBandDepths.w - dissonanceHazeBandDepths.x,
            0.0001
          );
          float dissonanceHazeDepth = clamp(
            (dissonanceHazeRawDepth - dissonanceHazeBandDepths.x) /
              dissonanceHazeDepthSpan,
            0.0,
            1.0
          );
          vec3 dissonanceHazeThresholds = clamp(
            (dissonanceHazeBandDepths.yzw - dissonanceHazeBandDepths.xxx) /
              dissonanceHazeDepthSpan,
            0.0,
            1.0
          );
          float dissonanceHazeSoftness = max(
            dissonanceHazeBandSoftness / dissonanceHazeDepthSpan,
            0.0001
          );

          // Fixed-four by design: three explicit transitions, no GPU loop or
          // dynamic band count.
          float dissonanceHazeMix01 = smoothstep(
            max(0.0, dissonanceHazeThresholds.x - dissonanceHazeSoftness),
            min(1.0, dissonanceHazeThresholds.x + dissonanceHazeSoftness),
            dissonanceHazeDepth
          );
          float dissonanceHazeMix12 = smoothstep(
            max(0.0, dissonanceHazeThresholds.y - dissonanceHazeSoftness),
            min(1.0, dissonanceHazeThresholds.y + dissonanceHazeSoftness),
            dissonanceHazeDepth
          );
          float dissonanceHazeMix23 = smoothstep(
            max(0.0, dissonanceHazeThresholds.z - dissonanceHazeSoftness),
            min(1.0, dissonanceHazeThresholds.z + dissonanceHazeSoftness),
            dissonanceHazeDepth
          );

          vec3 dissonanceHazeColor = mix(
            dissonanceHazeBandColor0,
            dissonanceHazeBandColor1,
            dissonanceHazeMix01
          );
          dissonanceHazeColor = mix(
            dissonanceHazeColor,
            dissonanceHazeBandColor2,
            dissonanceHazeMix12
          );
          dissonanceHazeColor = mix(
            dissonanceHazeColor,
            dissonanceHazeBandColor3,
            dissonanceHazeMix23
          );

          float dissonanceHazeInscatter = mix(
            dissonanceHazeBandInscatters.x,
            dissonanceHazeBandInscatters.y,
            dissonanceHazeMix01
          );
          dissonanceHazeInscatter = mix(
            dissonanceHazeInscatter,
            dissonanceHazeBandInscatters.z,
            dissonanceHazeMix12
          );
          dissonanceHazeInscatter = mix(
            dissonanceHazeInscatter,
            dissonanceHazeBandInscatters.w,
            dissonanceHazeMix23
          );

          float dissonanceHazeHeight = max(
            vPositionW.y - vEyePosition.y,
            0.0
          ) / dissonanceHazeFar;
          float dissonanceHazeHeightWeight = exp(
            -max(dissonanceHazeHeightFalloff, 0.0) *
              dissonanceHazeHeight * 8.0
          );
          float dissonanceHazeAmount = clamp(
            dissonanceHazeEnabled * dissonanceHazeInscatter *
              dissonanceHazeExtinction * dissonanceHazeHeightWeight,
            0.0,
            1.0
          );

          ${outputColor}.rgb = mix(
            ${outputColor}.rgb,
            dissonanceHazeColor,
            dissonanceHazeAmount
          );
          ${outputColor}.r *= mix(
            1.0,
            dissonanceHazeRedChannelGain,
            dissonanceHazeEnabled
          );
        }
      `,
    };
  }
}

interface AttachedPlugin {
  plugin: HazeBandFogMaterialPlugin;
  materialDisposeObserver: Observer<Material> | null;
}

/**
 * Applies one live haze configuration to every current and future supported
 * material in a scene. The controller samples `scene.fogDensity` at bind time
 * so weather and underwater overrides stay aligned with the stock fog pass.
 */
export class HazeBandFogSceneController {
  private readonly attached = new Map<Material, AttachedPlugin>();
  private readonly materialAddedObserver: Observer<Material> | null;
  private sceneDisposeObserver: Observer<Scene> | null;
  private config: HazeBandFogConfig | null;
  private disposed = false;

  constructor(
    private readonly scene: Scene,
    config: HazeBandFogConfig | null = null,
  ) {
    this.config = config;
    scene.materials.forEach((material) => this.attach(material));
    this.materialAddedObserver = scene.onNewMaterialAddedObservable.add((material) => {
      this.attach(material);
    });
    this.sceneDisposeObserver = scene.onDisposeObservable.add(() => this.dispose());
  }

  /** Updates all attached plugins in place. Passing null makes them no-ops. */
  setConfig(config: HazeBandFogConfig | null): void {
    if (this.disposed) return;
    this.config = config;
    this.attached.forEach(({ plugin }) => plugin.setConfig(config));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.onNewMaterialAddedObservable.remove(this.materialAddedObserver);
    this.scene.onDisposeObservable.remove(this.sceneDisposeObserver);
    this.sceneDisposeObserver = null;

    this.attached.forEach(({ plugin, materialDisposeObserver }, material) => {
      material.onDisposeObservable.remove(materialDisposeObserver);
      // Babylon has no public per-material plugin removal API. Leave the
      // plugin inert until its owning material is disposed.
      plugin.setDensitySource(null);
      plugin.setConfig(null);
    });
    this.attached.clear();
  }

  private attach(material: Material): void {
    if (this.disposed || this.attached.has(material) || !isSupportedMaterial(material)) return;

    const existing = material.pluginManager?.getPlugin<HazeBandFogMaterialPlugin>(PLUGIN_NAME);
    const plugin = existing instanceof HazeBandFogMaterialPlugin
      ? existing
      : new HazeBandFogMaterialPlugin(material, this.config);
    plugin.setConfig(this.config);
    plugin.setDensitySource(() => this.scene.fogDensity);

    const materialDisposeObserver = material.onDisposeObservable.add(() => {
      this.attached.delete(material);
    });
    this.attached.set(material, { plugin, materialDisposeObserver });
  }
}

export function attachHazeBandFogToScene(
  scene: Scene,
  config: HazeBandFogConfig | null = null,
): HazeBandFogSceneController {
  return new HazeBandFogSceneController(scene, config);
}

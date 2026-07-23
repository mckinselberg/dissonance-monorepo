import {
  Material,
  MaterialPluginBase,
  ShaderLanguage,
  UniformBuffer,
} from '@babylonjs/core';

export interface FoliageSwaySource {
  getWindIntensity(): number;
  getWindTime(): number;
}

/**
 * Adds inexpensive, world-space wind motion to foliage-only materials.
 *
 * Thin-instance translations seed the phase, so every instance sharing a
 * material moves differently without an additional instance attribute.
 */
export class FoliageSwayPlugin extends MaterialPluginBase {
  constructor(
    material: Material,
    private readonly wind: FoliageSwaySource,
  ) {
    super(material, 'FoliageSwayPlugin', 200, undefined, true, true);
  }

  override getClassName(): string {
    return 'FoliageSwayPlugin';
  }

  override getUniforms() {
    return {
      ubo: [
        { name: 'foliageWindIntensity', size: 1, type: 'float' },
        { name: 'foliageWindTime', size: 1, type: 'float' },
      ],
      vertex: `
        uniform float foliageWindIntensity;
        uniform float foliageWindTime;
      `,
    };
  }

  override bindForSubMesh(uniformBuffer: UniformBuffer): void {
    uniformBuffer.updateFloat('foliageWindIntensity', this.wind.getWindIntensity());
    uniformBuffer.updateFloat('foliageWindTime', this.wind.getWindTime());
  }

  override getCustomCode(shaderType: string, shaderLanguage = ShaderLanguage.GLSL) {
    if (shaderType !== 'vertex' || shaderLanguage !== ShaderLanguage.GLSL) return null;

    return {
      CUSTOM_VERTEX_UPDATE_WORLDPOS: `
        // finalWorld includes each thin instance's matrix at this injection
        // point. Hash its translation for stable, buffer-free phase variety.
        vec3 foliageInstancePosition = finalWorld[3].xyz;
        float foliagePhase = fract(sin(dot(
          foliageInstancePosition.xz,
          vec2(12.9898, 78.233)
        )) * 43758.5453) * 6.2831853;
        float foliagePrimary = sin(foliageWindTime * 1.7 + foliagePhase);
        float foliageFlutter = sin(
          foliageWindTime * 3.9 + foliagePhase * 1.37 + positionUpdated.y * 0.45
        );
        float foliageStrength = foliageWindIntensity * (0.18 + 0.07 * foliageFlutter);
        worldPos.xz += vec2(
          foliagePrimary,
          foliagePrimary * 0.42 + foliageFlutter * 0.2
        ) * foliageStrength;
      `,
    };
  }
}

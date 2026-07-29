import { PBRMaterial, Texture } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { ScatterVariationMaterialPlugin } from './ScatterVariationMaterialPlugin';

export interface ScatterMaterialTextures {
  albedoPath: string;
  // Roughness-only grayscale, no packed metalness — see the green-channel
  // note below for why that's fine with core PBRMaterial's metallic slot.
  roughnessPath?: string;
  normalPath?: string;
}

export interface ScatterMaterialHandle {
  material: PBRMaterial;
  plugin: ScatterVariationMaterialPlugin;
  dispose(): void;
}

/**
 * The shared thin-instance material deliverable: a PBRMaterial wired to the
 * baked swatch textures, with ScatterVariationMaterialPlugin attached so
 * per-instance hue/value jitter works once the caller populates the
 * instance buffer via `setScatterVariationBuffer`.
 */
export function createScatterMaterial(
  name: string,
  scene: Scene,
  textures: ScatterMaterialTextures,
): ScatterMaterialHandle {
  const material = new PBRMaterial(name, scene);
  const disposables: Texture[] = [];

  const albedo = new Texture(textures.albedoPath, scene);
  material.albedoTexture = albedo;
  disposables.push(albedo);

  if (textures.roughnessPath) {
    const roughnessTex = new Texture(textures.roughnessPath, scene);
    // Our roughness bake is a plain greyscale map (R=G=B), not a packed
    // ORM texture — pointing metallicTexture at it and reading roughness
    // from the green channel works because green happens to equal the
    // greyscale value; metallic is forced to 0 below so the texture's blue
    // channel (same greyscale value) never gets misread as metalness.
    material.metallicTexture = roughnessTex;
    material.useRoughnessFromMetallicTextureGreen = true;
    material.useMetallnessFromMetallicTextureBlue = false;
    material.useRoughnessFromMetallicTextureAlpha = false;
    disposables.push(roughnessTex);
  }
  material.metallic = 0;
  material.roughness = 1;

  if (textures.normalPath) {
    const normalTex = new Texture(textures.normalPath, scene);
    material.bumpTexture = normalTex;
    disposables.push(normalTex);
  }

  const plugin = new ScatterVariationMaterialPlugin(material);

  return {
    material,
    plugin,
    dispose() {
      material.dispose();
      disposables.forEach((tex) => tex.dispose());
    },
  };
}

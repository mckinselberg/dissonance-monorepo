import { PBRMaterial, Texture } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';

// Shared base paths for the two texture sources currently on disk (see
// CLAUDE.md's "public/data/locations.json" note and docs/THREADS.md T22/T30):
// the downtown-city-megakit's own baked BaseColor/Normal/ORM sets, and the
// PolyHaven-style swatches under public/textures/. Vite's BASE_URL prefix
// keeps both correct under the /world/ deploy path.
export const CITY_KIT_TEXTURE_BASE = `${import.meta.env.BASE_URL}models/downtown-city-megakit/`;
export const TEXTURES_BASE = `${import.meta.env.BASE_URL}textures/`;

// One PBRMaterial wired to on-disk texture maps, with real-world tiling via
// textureScale. Third call site (after FalloutShelterEntrance's original)
// is what pulled this out of that file — LocationProps and CompositeLocations
// both needed the identical albedo/normal/roughness-or-ORM wiring.
export function texturedMaterial(
  scene: Scene,
  name: string,
  paths: { albedo: string; normal?: string; roughness?: string; orm?: string },
  textureScale: number,
): PBRMaterial {
  const result = new PBRMaterial(name, scene);
  const albedo = new Texture(paths.albedo, scene);
  albedo.uScale = textureScale;
  albedo.vScale = textureScale;
  result.albedoTexture = albedo;
  if (paths.normal) {
    const normal = new Texture(paths.normal, scene);
    normal.uScale = textureScale;
    normal.vScale = textureScale;
    result.bumpTexture = normal;
  }
  if (paths.roughness) {
    const roughness = new Texture(paths.roughness, scene);
    roughness.uScale = textureScale;
    roughness.vScale = textureScale;
    result.metallicTexture = roughness;
    result.useRoughnessFromMetallicTextureGreen = true;
    result.useMetallnessFromMetallicTextureBlue = false;
    result.useRoughnessFromMetallicTextureAlpha = false;
  } else if (paths.orm) {
    const orm = new Texture(paths.orm, scene);
    orm.uScale = textureScale;
    orm.vScale = textureScale;
    result.metallicTexture = orm;
    result.useRoughnessFromMetallicTextureGreen = true;
    result.useMetallnessFromMetallicTextureBlue = true;
    result.useRoughnessFromMetallicTextureAlpha = false;
    result.ambientTexture = orm;
    result.useAmbientOcclusionFromMetallicTextureRed = true;
  }
  result.metallic = 0;
  result.roughness = 1;
  return result;
}

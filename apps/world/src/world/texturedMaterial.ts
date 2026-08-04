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
// A single number tiles uniformly; { u, v } tiles the two axes independently
// — needed for long thin meshes (e.g. a road ribbon many times longer than
// it is wide) where a uniform scale would stretch one axis or over-tile the
// other. Every call site before RoadNetwork.ts's road surface used a plain
// number on roughly-square meshes, so this stays backward compatible.
export type TextureScale = number | { u: number; v: number };

export function texturedMaterial(
  scene: Scene,
  name: string,
  paths: { albedo: string; normal?: string; roughness?: string; orm?: string },
  textureScale: TextureScale,
): PBRMaterial {
  const uScale = typeof textureScale === 'number' ? textureScale : textureScale.u;
  const vScale = typeof textureScale === 'number' ? textureScale : textureScale.v;
  const result = new PBRMaterial(name, scene);
  const albedo = new Texture(paths.albedo, scene);
  albedo.uScale = uScale;
  albedo.vScale = vScale;
  result.albedoTexture = albedo;
  if (paths.normal) {
    const normal = new Texture(paths.normal, scene);
    normal.uScale = uScale;
    normal.vScale = vScale;
    result.bumpTexture = normal;
  }
  if (paths.roughness) {
    const roughness = new Texture(paths.roughness, scene);
    roughness.uScale = uScale;
    roughness.vScale = vScale;
    result.metallicTexture = roughness;
    result.useRoughnessFromMetallicTextureGreen = true;
    result.useMetallnessFromMetallicTextureBlue = false;
    result.useRoughnessFromMetallicTextureAlpha = false;
  } else if (paths.orm) {
    const orm = new Texture(paths.orm, scene);
    orm.uScale = uScale;
    orm.vScale = vScale;
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

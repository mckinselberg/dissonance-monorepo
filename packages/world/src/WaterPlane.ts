import { Scene, MeshBuilder, Mesh, Texture, Vector2, Color3, StandardMaterial } from '@babylonjs/core';
import { WaterMaterial } from '@babylonjs/materials';
import type { HeightmapContract, UtmCoordinate } from '@dissonance/geo';
import { utmToWorld } from '@dissonance/geo';

export type WaterPlaneOptions = {
  // Real-world (unscaled) elevation in meters where the water surface sits.
  // Defaults to defaultWaterLevel(contract) if omitted.
  level?: number;
  verticalExaggeration?: number;
  horizontalScale?: number;
  gridResolution?: number;
};

const DEFAULT_GRID_RESOLUTION = 32;
const WATER_COLOR = new Color3(0.05, 0.18, 0.24);
const UNDERSIDE_COLOR = new Color3(0.03, 0.1, 0.13);
// Real (unscaled) meters — keeps the underside from z-fighting with the top
// surface at a grazing angle; small enough to still read as "the same
// water level" rather than a separate submerged layer.
const UNDERSIDE_OFFSET = 0.15;
// Official Babylon.js sample-asset CDN — the standard bump map used in
// WaterMaterial's own docs/playgrounds; this repo has no local texture
// pipeline of its own yet, so there's nothing to bundle it from instead.
const BUMP_TEXTURE_URL = 'https://assets.babylonjs.com/textures/waterbump.png';

// The DEM's bbox has no tagged lake/river geometry to trace (see
// packages/geo's GeoJSON parser — LineString/MultiLineString only, and
// smr-trails.geojson carries no natural=water/waterway features at all).
// Picks a level a little above the DEM's lowest point, so it reads as a
// lake filling the deepest local depression rather than flooding the map.
export function defaultWaterLevel(contract: HeightmapContract): number {
  const { min, max } = contract.elevation;
  return min + (max - min) * 0.05;
}

// A single flat plane spanning the DEM's full bbox at a configurable
// elevation — not a geographically accurate water body, just a stand-in
// surface. Ordinary z-buffer occlusion against the opaque terrain mesh is
// what makes it read as "water filling the valleys" rather than a literal
// rectangle: wherever real terrain is above the plane's Y, it simply draws
// in front of (hides) the water, no clipping/masking logic needed.
export class WaterPlane {
  private readonly mesh: Mesh;
  private readonly material: WaterMaterial;
  // A second, simple mesh at the same position — WaterMaterial's real-time
  // reflection/refraction assumes being viewed from above, so it looks
  // wrong (or just doesn't render meaningfully) seen from underneath. Fly/
  // Drive have no collision, so diving below the surface is easy; this
  // gives that view something sensible (a murky, dim ceiling) instead of
  // an upside-down mirror or nothing at all.
  private readonly underside: Mesh;
  private readonly centerX: number;
  private readonly centerZ: number;

  constructor(scene: Scene, contract: HeightmapContract, origin: UtmCoordinate, options: WaterPlaneOptions = {}) {
    const { bbox } = contract;
    const worldMin = utmToWorld({ x: bbox.minX, y: bbox.minZ }, origin);
    const worldMax = utmToWorld({ x: bbox.maxX, y: bbox.maxZ }, origin);
    const width = worldMax.x - worldMin.x;
    const depth = worldMax.z - worldMin.z;
    this.centerX = (worldMin.x + worldMax.x) / 2;
    this.centerZ = (worldMin.z + worldMax.z) / 2;

    this.mesh = MeshBuilder.CreateGround('waterPlane', {
      width,
      height: depth,
      subdivisions: options.gridResolution ?? DEFAULT_GRID_RESOLUTION,
    }, scene);

    this.material = new WaterMaterial('waterMaterial', scene, new Vector2(512, 512));
    this.material.bumpTexture = new Texture(BUMP_TEXTURE_URL, scene);
    this.material.windForce = -8;
    this.material.waveHeight = 0.12;
    this.material.bumpHeight = 0.15;
    this.material.waveLength = 0.2;
    this.material.waterColor = WATER_COLOR;
    this.material.colorBlendFactor = 0.6;
    this.mesh.material = this.material;

    this.underside = MeshBuilder.CreateGround('waterUnderside', { width, height: depth, subdivisions: 2 }, scene);
    const undersideMat = new StandardMaterial('waterUndersideMat', scene);
    undersideMat.diffuseColor = UNDERSIDE_COLOR;
    undersideMat.emissiveColor = UNDERSIDE_COLOR;
    undersideMat.specularColor = Color3.Black();
    undersideMat.backFaceCulling = false;
    this.underside.material = undersideMat;

    const level = options.level ?? defaultWaterLevel(contract);
    this.setScale(options.horizontalScale ?? 1, options.verticalExaggeration ?? 1, level);
  }

  // Reflects/refracts the given mesh in the water surface. Meshes not
  // passed here still render normally (and still occlude the water from
  // the camera's view) — they just won't appear in its reflection.
  addToRenderList(mesh: Mesh): void {
    this.material.addToRenderList(mesh);
  }

  removeFromRenderList(mesh: Mesh): void {
    this.material.removeFromRenderList(mesh);
  }

  // Cheap: just repositions/rescales the existing flat mesh. Unlike
  // HeightmapTerrain, a flat plane's vertices don't need resampling when
  // scale changes, so this is safe to call on every slider tick.
  setScale(horizontalScale: number, verticalExaggeration: number, level: number): void {
    this.mesh.scaling.x = horizontalScale;
    this.mesh.scaling.z = horizontalScale;
    this.mesh.position.x = this.centerX * horizontalScale;
    this.mesh.position.z = this.centerZ * horizontalScale;
    this.mesh.position.y = level * verticalExaggeration;

    this.underside.scaling.x = horizontalScale;
    this.underside.scaling.z = horizontalScale;
    this.underside.position.x = this.centerX * horizontalScale;
    this.underside.position.z = this.centerZ * horizontalScale;
    this.underside.position.y = (level - UNDERSIDE_OFFSET) * verticalExaggeration;
  }

  setVisible(visible: boolean): void {
    this.mesh.setEnabled(visible);
    this.underside.setEnabled(visible);
  }

  dispose(): void {
    this.mesh.dispose();
    this.material.dispose();
    this.underside.dispose();
  }
}

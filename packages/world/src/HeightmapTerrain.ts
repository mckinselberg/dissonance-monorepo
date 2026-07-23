import {
  Scene,
  MeshBuilder,
  PBRMaterial,
  Color3,
  Texture,
  DynamicTexture,
  VertexBuffer,
  VertexData,
  Mesh,
} from '@babylonjs/core';
import { TerrainMaterial } from '@babylonjs/materials';
import type { HeightmapContract, HeightmapSampler, UtmCoordinate } from '@dissonance/geo';
import { utmToWorld } from '@dissonance/geo';
import type { ITerrain } from './ITerrain';

export type SlopeTextureLayer = {
  diffuseUrl: string;
  normalUrl?: string;
};

export type HeightmapTerrainOptions = {
  // Mesh subdivision density — independent of the heightmap's own pixel
  // resolution; HeightmapSampler's bilinear sampling means the mesh can be
  // coarser or finer than the source DEM.
  gridResolution?: number;
  // Real-world relief (e.g. SMR's ~120m over ~5.5km) reads as nearly flat
  // at typical game camera distances. 1.0 = true scale.
  //
  // verticalExaggeration alone (horizontalScale left at 1) distorts real
  // slope angles — it stretches the terrain's Y axis without touching X/Z,
  // so a real 6-degree hillside can become a 45+ degree wall. Setting
  // horizontalScale equal to verticalExaggeration instead grows the whole
  // world uniformly (true slopes preserved, nothing gets steeper) — combine
  // that with PlayerController's own independent `scale` option to make the
  // *player* relatively smaller/slower against the enlarged world instead.
  verticalExaggeration?: number;
  // Uniform scale on X/Z only. 1.0 = true scale (1 world unit = 1 meter).
  horizontalScale?: number;
  lowElevationColor?: Color3;
  highElevationColor?: Color3;
  // Three-tier slope-blended ground material (Babylon's TerrainMaterial) —
  // flat ground gets `flat`, steep ground gets `steep`, `mid` blends in
  // between. Slope is computed from the DEM itself (finite-difference on
  // HeightmapSampler), not any external land-cover data — this dataset has
  // none (see ThinInstanceTrees' own comment on the same gap). Omitting
  // this keeps the low/high elevation vertex-color gradient (unchanged
  // behavior) — the two aren't combined, since multiplying a real photo
  // texture by the (fairly dark) elevation gradient just muddies it.
  //
  // TerrainMaterial is Babylon's legacy (pre-PBR, Phong-lit) splat
  // material — no per-layer roughness/metalness, single global
  // specularColor/specularPower instead. Traded deliberately for the
  // built-in 3-layer blending (mixTexture-driven) rather than hand-writing
  // a custom PBR splat shader.
  slopeTextures?: {
    flat: SlopeTextureLayer;
    mid: SlopeTextureLayer;
    steep: SlopeTextureLayer;
  };
  // Real-world meters one texture tile should cover — lower means more
  // repeats (finer, busier detail). Applies to all three slope layers.
  textureTileMeters?: number;
  // Local slope (rise/run, dimensionless — 1.0 = 45 degrees) at which the
  // blend fully commits to `steep`; halfway there is fully `mid`. Only
  // meaningful with slopeTextures set.
  maxSlopeForSteep?: number;
};

const DEFAULT_GRID_RESOLUTION = 128;
const LOW_ELEVATION_COLOR = new Color3(0.14, 0.11, 0.07);
const HIGH_ELEVATION_COLOR = new Color3(0.55, 0.55, 0.52);
const DEFAULT_MAX_SLOPE_FOR_STEEP = 0.5;
// Finite-difference sample spacing for slope estimation — a few DEM pixels'
// worth keeps it representative of local terrain shape rather than
// per-pixel noise, without smoothing out real ridgelines/cliffs.
const SLOPE_SAMPLE_OFFSET_METERS = 8;
// Independent of gridResolution — this is a texture (sampled per-fragment
// by the GPU, smoothly interpolated), not mesh geometry, so it doesn't need
// to match the mesh's own vertex density.
const MIX_TEXTURE_RESOLUTION = 256;

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

// Fraction of each of the three slope layers at a given steepness ratio
// (0 = flat, 1 = at/past maxSlopeForSteep) — flat->mid over the first half,
// mid->steep over the second, so "mid" peaks at exactly the halfway point
// instead of the blend jumping straight from flat to steep.
function slopeLayerWeights(steepness: number): { flat: number; mid: number; steep: number } {
  const t = clamp01(steepness);
  if (t < 0.5) {
    const local = t * 2;
    return { flat: 1 - local, mid: local, steep: 0 };
  }
  const local = (t - 0.5) * 2;
  return { flat: 0, mid: 1 - local, steep: local };
}

// Sibling to the procedural Terrain (packages/world/src/Terrain.ts),
// satisfying the same ITerrain contract but backed by a real-world DEM via
// packages/geo's HeightmapSampler instead of procedural noise.
export class HeightmapTerrain implements ITerrain {
  private readonly ground: Mesh;
  private readonly sampler: HeightmapSampler;
  private readonly verticalExaggeration: number;
  private readonly horizontalScale: number;

  constructor(
    scene: Scene,
    sampler: HeightmapSampler,
    contract: HeightmapContract,
    origin: UtmCoordinate,
    options: HeightmapTerrainOptions = {},
  ) {
    this.sampler = sampler;
    this.verticalExaggeration = options.verticalExaggeration ?? 1.0;
    this.horizontalScale = options.horizontalScale ?? 1.0;
    this.ground = this.buildMesh(
      scene, contract, origin, options.gridResolution ?? DEFAULT_GRID_RESOLUTION,
      options.lowElevationColor ?? LOW_ELEVATION_COLOR,
      options.highElevationColor ?? HIGH_ELEVATION_COLOR,
      options,
    );
  }

  // x, z are in this terrain's *rendered* world space — i.e. already
  // multiplied by horizontalScale, same space the mesh and a camera moving
  // through the scene both live in. Divide back out to find the real DEM
  // location before sampling.
  getHeightAt(x: number, z: number): number {
    const real = { x: x / this.horizontalScale, z: z / this.horizontalScale };
    return this.sampler.sampleHeight(real) * this.verticalExaggeration;
  }

  // Rise/run magnitude of the local height gradient at a real (unscaled)
  // world position — independent of horizontalScale/verticalExaggeration,
  // a property of the DEM itself.
  private sampleSlope(worldX: number, worldZ: number): number {
    const hC = this.sampler.sampleHeight({ x: worldX, z: worldZ });
    const hX = this.sampler.sampleHeight({ x: worldX + SLOPE_SAMPLE_OFFSET_METERS, z: worldZ });
    const hZ = this.sampler.sampleHeight({ x: worldX, z: worldZ + SLOPE_SAMPLE_OFFSET_METERS });
    const dX = (hX - hC) / SLOPE_SAMPLE_OFFSET_METERS;
    const dZ = (hZ - hC) / SLOPE_SAMPLE_OFFSET_METERS;
    return Math.sqrt(dX * dX + dZ * dZ);
  }

  private buildMesh(
    scene: Scene, contract: HeightmapContract, origin: UtmCoordinate, gridResolution: number,
    lowElevationColor: Color3, highElevationColor: Color3,
    textureOptions: Pick<HeightmapTerrainOptions, 'slopeTextures' | 'textureTileMeters' | 'maxSlopeForSteep'>,
  ): Mesh {
    const { bbox, elevation } = contract;
    const worldMin = utmToWorld({ x: bbox.minX, y: bbox.minZ }, origin);
    const worldMax = utmToWorld({ x: bbox.maxX, y: bbox.maxZ }, origin);
    const width = worldMax.x - worldMin.x;
    const depth = worldMax.z - worldMin.z;
    const centerX = (worldMin.x + worldMax.x) / 2;
    const centerZ = (worldMin.z + worldMax.z) / 2;

    // Built at true (unscaled) size/position so the vertex loop below can
    // sample the DEM in real coordinates; rendered scale is applied after,
    // to the mesh root and each vertex's X/Z, once sampling is done.
    const ground = MeshBuilder.CreateGround('heightmapTerrain', {
      width,
      height: depth,
      subdivisions: gridResolution,
      updatable: true,
    }, scene);
    ground.position.x = centerX * this.horizontalScale;
    ground.position.z = centerZ * this.horizontalScale;

    const positions = ground.getVerticesData(VertexBuffer.PositionKind) as Float32Array;
    // A real texture reads correctly on its own — multiplying it by the
    // (fairly dark) elevation-gradient vertex colors would just muddy it,
    // so the two are mutually exclusive: colors stay empty in texture mode.
    const usingTexture = !!textureOptions.slopeTextures;
    const colors: number[] = [];
    const elevationRange = elevation.max - elevation.min;

    for (let i = 0; i < positions.length; i += 3) {
      // Real (unscaled) world position — sample the DEM here, before
      // positions[i]/[i+2] get overwritten with their rendered (scaled) values.
      const worldX = positions[i] + centerX;
      const worldZ = positions[i + 2] + centerZ;
      const rawElevation = this.sampler.sampleHeight({ x: worldX, z: worldZ });

      positions[i] *= this.horizontalScale;
      positions[i + 1] = rawElevation * this.verticalExaggeration;
      positions[i + 2] *= this.horizontalScale;

      if (!usingTexture) {
        const t = elevationRange > 0 ? clamp01((rawElevation - elevation.min) / elevationRange) : 0;
        colors.push(
          lowElevationColor.r + (highElevationColor.r - lowElevationColor.r) * t,
          lowElevationColor.g + (highElevationColor.g - lowElevationColor.g) * t,
          lowElevationColor.b + (highElevationColor.b - lowElevationColor.b) * t,
          1,
        );
      }
    }
    ground.updateVerticesData(VertexBuffer.PositionKind, positions);
    if (!usingTexture) ground.setVerticesData(VertexBuffer.ColorKind, colors);

    const indices = ground.getIndices()!;
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    ground.updateVerticesData(VertexBuffer.NormalKind, normals);

    let mat: PBRMaterial | TerrainMaterial;
    if (textureOptions.slopeTextures) {
      const slope = textureOptions.slopeTextures;
      const terrainMat = new TerrainMaterial('heightmapTerrainMat', scene);

      // CreateGround's UV convention (verified against groundBuilder.js):
      // U = (localX + width/2) / width, V = (localZ + depth/2) / depth —
      // i.e. matches world position directly, no axis flip — so the mix
      // texture below can be generated with the same worldMin + u*width /
      // worldMin + v*depth mapping used for the mesh's own vertex sampling.
      const mixTexture = new DynamicTexture('heightmapTerrainMix', MIX_TEXTURE_RESOLUTION, scene, false);
      const ctx = mixTexture.getContext() as CanvasRenderingContext2D;
      const imageData = ctx.createImageData(MIX_TEXTURE_RESOLUTION, MIX_TEXTURE_RESOLUTION);
      const maxSlope = textureOptions.maxSlopeForSteep ?? DEFAULT_MAX_SLOPE_FOR_STEEP;
      for (let ty = 0; ty < MIX_TEXTURE_RESOLUTION; ty++) {
        for (let tx = 0; tx < MIX_TEXTURE_RESOLUTION; tx++) {
          const u = tx / (MIX_TEXTURE_RESOLUTION - 1);
          const v = ty / (MIX_TEXTURE_RESOLUTION - 1);
          const worldX = worldMin.x + u * width;
          const worldZ = worldMin.z + v * depth;
          const steepness = this.sampleSlope(worldX, worldZ) / maxSlope;
          const w = slopeLayerWeights(steepness);
          const idx = (ty * MIX_TEXTURE_RESOLUTION + tx) * 4;
          imageData.data[idx] = Math.round(w.flat * 255);
          imageData.data[idx + 1] = Math.round(w.mid * 255);
          imageData.data[idx + 2] = Math.round(w.steep * 255);
          imageData.data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0);
      mixTexture.update(false);
      terrainMat.mixTexture = mixTexture;

      const tileMeters = textureOptions.textureTileMeters ?? 4;
      const uScale = width / tileMeters;
      const vScale = depth / tileMeters;
      const loadLayerTexture = (url: string, isNormal: boolean) => {
        const tex = new Texture(url, scene);
        tex.uScale = uScale;
        tex.vScale = vScale;
        if (isNormal) tex.gammaSpace = false; // normal maps are data, not sRGB color
        return tex;
      };
      terrainMat.diffuseTexture1 = loadLayerTexture(slope.flat.diffuseUrl, false);
      terrainMat.diffuseTexture2 = loadLayerTexture(slope.mid.diffuseUrl, false);
      terrainMat.diffuseTexture3 = loadLayerTexture(slope.steep.diffuseUrl, false);
      if (slope.flat.normalUrl) terrainMat.bumpTexture1 = loadLayerTexture(slope.flat.normalUrl, true);
      if (slope.mid.normalUrl) terrainMat.bumpTexture2 = loadLayerTexture(slope.mid.normalUrl, true);
      if (slope.steep.normalUrl) terrainMat.bumpTexture3 = loadLayerTexture(slope.steep.normalUrl, true);

      mat = terrainMat;
    } else {
      const pbrMat = new PBRMaterial('heightmapTerrainMat', scene);
      pbrMat.metallic = 0;
      pbrMat.roughness = 0.9;
      pbrMat.albedoColor = new Color3(1, 1, 1); // vertex colors carry the elevation tint
      mat = pbrMat;
    }

    // Fly/Drive have no collision, so it's easy to end up below the mesh
    // (an overhang, or just diving under it) — without this, looking up
    // from underneath shows nothing (the backface is culled) instead of
    // the terrain's underside.
    mat.backFaceCulling = false;
    ground.material = mat;
    ground.receiveShadows = true;

    return ground;
  }

  // Not part of ITerrain — a POC-viewer convenience for layer-visibility
  // toggles (getHeightAt keeps sampling the DEM regardless of mesh visibility).
  setVisible(visible: boolean): void {
    this.ground.setEnabled(visible);
  }

  // Not part of ITerrain — lets a WaterPlane reflect/refract the actual
  // terrain surface instead of just showing empty background.
  getMesh(): Mesh {
    return this.ground;
  }

  dispose(): void {
    this.ground.dispose();
  }
}

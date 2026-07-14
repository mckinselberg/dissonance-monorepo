import {
  Scene,
  MeshBuilder,
  PBRMaterial,
  Color3,
  VertexBuffer,
  VertexData,
  Mesh,
} from '@babylonjs/core';
import type { HeightmapContract, HeightmapSampler, UtmCoordinate } from '@dissonance/geo';
import { utmToWorld } from '@dissonance/geo';
import type { ITerrain } from './ITerrain';

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
};

const DEFAULT_GRID_RESOLUTION = 128;
const LOW_ELEVATION_COLOR = new Color3(0.14, 0.11, 0.07);
const HIGH_ELEVATION_COLOR = new Color3(0.55, 0.55, 0.52);

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
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
    this.ground = this.buildMesh(scene, contract, origin, options.gridResolution ?? DEFAULT_GRID_RESOLUTION);
  }

  // x, z are in this terrain's *rendered* world space — i.e. already
  // multiplied by horizontalScale, same space the mesh and a camera moving
  // through the scene both live in. Divide back out to find the real DEM
  // location before sampling.
  getHeightAt(x: number, z: number): number {
    const real = { x: x / this.horizontalScale, z: z / this.horizontalScale };
    return this.sampler.sampleHeight(real) * this.verticalExaggeration;
  }

  private buildMesh(scene: Scene, contract: HeightmapContract, origin: UtmCoordinate, gridResolution: number): Mesh {
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

      const t = elevationRange > 0 ? clamp01((rawElevation - elevation.min) / elevationRange) : 0;
      colors.push(
        LOW_ELEVATION_COLOR.r + (HIGH_ELEVATION_COLOR.r - LOW_ELEVATION_COLOR.r) * t,
        LOW_ELEVATION_COLOR.g + (HIGH_ELEVATION_COLOR.g - LOW_ELEVATION_COLOR.g) * t,
        LOW_ELEVATION_COLOR.b + (HIGH_ELEVATION_COLOR.b - LOW_ELEVATION_COLOR.b) * t,
        1,
      );
    }
    ground.updateVerticesData(VertexBuffer.PositionKind, positions);
    ground.setVerticesData(VertexBuffer.ColorKind, colors);

    const indices = ground.getIndices()!;
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    ground.updateVerticesData(VertexBuffer.NormalKind, normals);

    const mat = new PBRMaterial('heightmapTerrainMat', scene);
    mat.metallic = 0;
    mat.roughness = 0.9;
    mat.albedoColor = new Color3(1, 1, 1); // vertex colors carry the elevation tint
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

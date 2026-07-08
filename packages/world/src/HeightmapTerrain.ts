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
  verticalExaggeration?: number;
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

  constructor(
    scene: Scene,
    sampler: HeightmapSampler,
    contract: HeightmapContract,
    origin: UtmCoordinate,
    options: HeightmapTerrainOptions = {},
  ) {
    this.sampler = sampler;
    this.verticalExaggeration = options.verticalExaggeration ?? 1.0;
    this.ground = this.buildMesh(scene, contract, origin, options.gridResolution ?? DEFAULT_GRID_RESOLUTION);
  }

  getHeightAt(x: number, z: number): number {
    return this.sampler.sampleHeight({ x, z }) * this.verticalExaggeration;
  }

  private buildMesh(scene: Scene, contract: HeightmapContract, origin: UtmCoordinate, gridResolution: number): Mesh {
    const { bbox, elevation } = contract;
    const worldMin = utmToWorld({ x: bbox.minX, y: bbox.minZ }, origin);
    const worldMax = utmToWorld({ x: bbox.maxX, y: bbox.maxZ }, origin);
    const width = worldMax.x - worldMin.x;
    const depth = worldMax.z - worldMin.z;
    const centerX = (worldMin.x + worldMax.x) / 2;
    const centerZ = (worldMin.z + worldMax.z) / 2;

    const ground = MeshBuilder.CreateGround('heightmapTerrain', {
      width,
      height: depth,
      subdivisions: gridResolution,
      updatable: true,
    }, scene);
    ground.position.x = centerX;
    ground.position.z = centerZ;

    const positions = ground.getVerticesData(VertexBuffer.PositionKind) as Float32Array;
    const colors: number[] = [];
    const elevationRange = elevation.max - elevation.min;

    for (let i = 0; i < positions.length; i += 3) {
      const worldX = positions[i] + centerX;
      const worldZ = positions[i + 2] + centerZ;
      const rawElevation = this.sampler.sampleHeight({ x: worldX, z: worldZ });
      positions[i + 1] = rawElevation * this.verticalExaggeration;

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
    ground.material = mat;
    ground.receiveShadows = true;

    return ground;
  }

  // Not part of ITerrain — a POC-viewer convenience for layer-visibility
  // toggles (getHeightAt keeps sampling the DEM regardless of mesh visibility).
  setVisible(visible: boolean): void {
    this.ground.setEnabled(visible);
  }

  dispose(): void {
    this.ground.dispose();
  }
}

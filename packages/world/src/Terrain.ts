import {
  Scene,
  MeshBuilder,
  PBRMaterial,
  Color3,
  VertexBuffer,
  VertexData,
  Mesh,
} from '@babylonjs/core';
import type { ExperienceProfile } from '@dissonance/shared-types';

const WORLD_SIZE = 800;
const GRID_RES = 192;
const MAX_HEIGHT = 12;
const NOISE_SCALE = 0.019;
const SEED = 7331;

// Large, slow-wavelength layer that produces actual hills and valleys.
// Wavelength must be short enough relative to fog draw distance (~80
// units in ps1 mode) that you can actually see a hill-and-valley shape
// from one spot — the original 150-unit wavelength meant you only ever
// saw a sliver of one slope, which read as "flat." NOISE_SCALE/MACRO_SCALE
// are frequencies, not extents, so they don't need to change when
// WORLD_SIZE grows — only the amplitudes (MAX_HEIGHT/MACRO_HEIGHT) do.
const MACRO_SCALE = 0.018;
const MACRO_HEIGHT = 64;

function macro(x: number, y: number): number {
  return (
    vnoise(x,     y,     SEED + 700) * 0.6 +
    vnoise(x * 2, y * 2, SEED + 800) * 0.4
  );
}

function fade(t: number): number {
  return t * t * (3 - 2 * t);
}

function hashF(ix: number, iy: number, s: number): number {
  let n = (ix * 1619 + iy * 31337 + s * 1031) | 0;
  n = (n ^ (n << 13)) | 0;
  n = ((n * (n * n * 15731 + 789221) + 1376312589) | 0);
  return (n & 0x7fffffff) / 0x7fffffff;
}

function vnoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fade(fx), uy = fade(fy);
  const v00 = hashF(ix, iy, seed);
  const v10 = hashF(ix + 1, iy, seed);
  const v01 = hashF(ix, iy + 1, seed);
  const v11 = hashF(ix + 1, iy + 1, seed);
  return v00 + (v10 - v00) * ux + (v01 - v00) * uy + (v00 - v10 - v01 + v11) * ux * uy;
}

// The last two octaves are higher frequency than the rolling base shape —
// they add small mounds/dips at human/walking scale so the ground floor
// reads as textured underfoot, not just a smooth rolling sheet.
function fbm(x: number, y: number): number {
  return (
    vnoise(x,      y,      SEED)       * 0.45 +
    vnoise(x * 2,  y * 2,  SEED + 100) * 0.22 +
    vnoise(x * 4,  y * 4,  SEED + 200) * 0.13 +
    vnoise(x * 8,  y * 8,  SEED + 300) * 0.09 +
    vnoise(x * 16, y * 16, SEED + 400) * 0.07 +
    vnoise(x * 32, y * 32, SEED + 500) * 0.04
  );
}

export class Terrain {
  private readonly heights: Float32Array;
  private ground: Mesh;

  constructor(scene: Scene, profile: ExperienceProfile) {
    this.heights = this.generateHeights();
    this.ground = this.buildMesh(scene, profile);
  }

  private generateHeights(): Float32Array {
    const n = GRID_RES + 1;
    const grid = new Float32Array(n * n);

    for (let iz = 0; iz < n; iz++) {
      for (let ix = 0; ix < n; ix++) {
        const wx = (ix / GRID_RES - 0.5) * WORLD_SIZE;
        const wz = (iz / GRID_RES - 0.5) * WORLD_SIZE;

        let h = macro(wx * MACRO_SCALE, wz * MACRO_SCALE) * MACRO_HEIGHT
          + fbm(wx * NOISE_SCALE, wz * NOISE_SCALE) * MAX_HEIGHT;

        const dStart = Math.sqrt(wx * wx + wz * wz);
        if (dStart < 20) h *= Math.pow(dStart / 20, 2);

        const ddx = wx - 190, ddz = wz - 140;
        const dDest = Math.sqrt(ddx * ddx + ddz * ddz);
        if (dDest < 16) h *= Math.pow(dDest / 16, 2);

        grid[iz * n + ix] = h;
      }
    }
    return grid;
  }

  getHeightAt(wx: number, wz: number): number {
    const n = GRID_RES + 1;
    const gx = Math.max(0, Math.min(GRID_RES, (wx / WORLD_SIZE + 0.5) * GRID_RES));
    const gz = Math.max(0, Math.min(GRID_RES, (wz / WORLD_SIZE + 0.5) * GRID_RES));
    const ix = Math.min(GRID_RES - 1, Math.floor(gx));
    const iz = Math.min(GRID_RES - 1, Math.floor(gz));
    const fx = gx - ix, fz = gz - iz;
    const h00 = this.heights[iz * n + ix];
    const h10 = this.heights[iz * n + (ix + 1)];
    const h01 = this.heights[(iz + 1) * n + ix];
    const h11 = this.heights[(iz + 1) * n + (ix + 1)];
    return h00 * (1 - fx) * (1 - fz) + h10 * fx * (1 - fz) + h01 * (1 - fx) * fz + h11 * fx * fz;
  }

  private buildMesh(scene: Scene, profile: ExperienceProfile): Mesh {
    const ground = MeshBuilder.CreateGround('terrain', {
      width: WORLD_SIZE,
      height: WORLD_SIZE,
      subdivisions: GRID_RES,
      updatable: true,
    }, scene);

    const positions = ground.getVerticesData(VertexBuffer.PositionKind) as Float32Array;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i + 1] = this.getHeightAt(positions[i], positions[i + 2]);
    }
    ground.updateVerticesData(VertexBuffer.PositionKind, positions);

    const indices = ground.getIndices()!;
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    ground.updateVerticesData(VertexBuffer.NormalKind, normals);

    const mat = new PBRMaterial('terrainMat', scene);
    mat.metallic = 0;
    mat.roughness = 0.9;
    if (profile.mode === 'radio') {
      mat.albedoColor = new Color3(0.04, 0.04, 0.04);
      mat.ambientColor = new Color3(0.02, 0.02, 0.03);
    } else {
      mat.albedoColor = new Color3(0.14, 0.22, 0.07);
      mat.ambientColor = new Color3(0.10, 0.16, 0.05);
    }
    ground.material = mat;
    ground.receiveShadows = true;

    if (profile.mode === 'ps1') ground.convertToFlatShadedMesh();

    return ground;
  }

  dispose(): void {
    this.ground.dispose();
  }
}

import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  VertexBuffer,
  VertexData,
  Mesh,
} from '@babylonjs/core';
import type { ExperienceProfile } from '@dissonance/shared-types';

const WORLD_SIZE = 400;
const GRID_RES = 64;
const MAX_HEIGHT = 8;
const NOISE_SCALE = 0.019;
const SEED = 7331;

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

function fbm(x: number, y: number): number {
  return (
    vnoise(x,     y,     SEED)       * 0.50 +
    vnoise(x * 2, y * 2, SEED + 100) * 0.25 +
    vnoise(x * 4, y * 4, SEED + 200) * 0.15 +
    vnoise(x * 8, y * 8, SEED + 300) * 0.10
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

        let h = fbm(wx * NOISE_SCALE, wz * NOISE_SCALE) * MAX_HEIGHT;

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

    const mat = new StandardMaterial('terrainMat', scene);
    if (profile.mode === 'radio') {
      mat.diffuseColor = new Color3(0.04, 0.04, 0.04);
      mat.ambientColor = new Color3(0.02, 0.02, 0.03);
    } else {
      mat.diffuseColor = new Color3(0.14, 0.22, 0.07);
      mat.ambientColor = new Color3(0.10, 0.16, 0.05);
    }
    mat.specularColor = Color3.Black();
    ground.material = mat;

    if (profile.mode === 'ps1') ground.convertToFlatShadedMesh();

    return ground;
  }

  dispose(): void {
    this.ground.dispose();
  }
}

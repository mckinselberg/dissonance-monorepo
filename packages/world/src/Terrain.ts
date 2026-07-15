import {
  Scene,
  MeshBuilder,
  PBRMaterial,
  Color3,
  VertexBuffer,
  VertexData,
  Mesh,
} from '@babylonjs/core';
import type { ExperienceProfile, WorldPosition } from '@dissonance/shared-types';
import type { ITerrain } from './ITerrain';

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

// A constant directional grade layered under the hills/valleys — real
// forests are very often on a hillside, not a flat plain. Tuned down from
// a literal 10-15° (which over an 800-unit world would add 70-110 units of
// edge-to-edge elevation on top of the existing macro hills) to whatever
// reads as that tilt within the player's actual draw distance. Starting
// value — adjust after seeing it in motion.
const TILT_GRADE = Math.tan((6 * Math.PI) / 180); // ~6°, ~0.105 rise per unit

export type TerrainOptions = {
  destinationPosition?: WorldPosition;
  flavor?: 'pine' | 'rocky' | 'river';
};

export const RIVER_POINTS: [number, number][] = [
  [-220, -120],
  [-126, -38],
  [-48, 42],
  [34, 112],
  [128, 190],
];

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

function distanceToPolyline(x: number, z: number, points: [number, number][]): number {
  let nearest = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i];
    const [bx, bz] = points[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
    const px = ax + dx * t - x;
    const pz = az + dz * t - z;
    nearest = Math.min(nearest, Math.sqrt(px * px + pz * pz));
  }
  return nearest;
}

export class Terrain implements ITerrain {
  private readonly heights: Float32Array;
  private ground: Mesh;
  private readonly options: TerrainOptions;

  constructor(scene: Scene, profile: ExperienceProfile, options: TerrainOptions = {}) {
    this.options = options;
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

        // Flattening near spawn/destination zeroes out the *bumps* only —
        // the tilt is the base elevation real ground at that location
        // actually sits at. Flattening it away too (as a previous version
        // did) forced those clearings down to literal height 0 regardless
        // of the surrounding tilted ground, creating a cliff at the
        // flatten radius boundary — exactly what put the car/parking lot
        // below the nearby trail surface near the (190, 140) destination,
        // where the tilt term is ~20 units.
        let bumps = macro(wx * MACRO_SCALE, wz * MACRO_SCALE) * MACRO_HEIGHT
          + fbm(wx * NOISE_SCALE, wz * NOISE_SCALE) * MAX_HEIGHT;

        const dStart = Math.sqrt(wx * wx + wz * wz);
        if (dStart < 20) bumps *= Math.pow(dStart / 20, 2);

        // Spawn clearing — new spawn is at x≈0, z≈-262. No natural
        // flattening was here before, so macro hills could land the player
        // on a 30+ unit cliff looking toward the trail. Flatten a 40-unit
        // bowl around the spawn centre so the opening view is unobstructed.
        const dSpawn = Math.sqrt(wx * wx + (wz + 262) * (wz + 262));
        if (dSpawn < 40) bumps *= Math.pow(dSpawn / 40, 2);

        const dest = this.options.destinationPosition ?? { x: 190, y: 0, z: 140 };
        const ddx = wx - dest.x, ddz = wz - dest.z;
        const dDest = Math.sqrt(ddx * ddx + ddz * ddz);
        // Flatten bumps out to radius 50 so no cliff band appears on approach.
        if (dDest < 50) bumps *= Math.pow(dDest / 50, 2);

        // Flatten the tilt gradient near the lot so the parking-lot surface is
        // level. Without this, a 30-unit-wide box placed at the centre height
        // floats ~1.6 units above terrain on the low-X side (TILT_GRADE ×15).
        // We blend toward the tilt at the lot centre (190 × TILT_GRADE), not
        // toward 0 — keeping the base elevation so there's no cliff at the edge.
        const baseTilt = wx * TILT_GRADE;
        const destTilt = dest.x * TILT_GRADE;
        const tiltBlend = dDest < 50 ? Math.pow(dDest / 50, 2) : 1;
        let tilt = destTilt + (baseTilt - destTilt) * tiltBlend;

        if (this.options.flavor === 'rocky') {
          const climb = Math.max(0, Math.min(1, (wz + 270) / 420));
          const ridgeLift = Math.pow(climb, 1.18) * 54;
          const sideBank = Math.max(0, Math.min(1, Math.abs(wx) / 240)) * 12;
          const destClimb = Math.max(0, Math.min(1, (dest.z + 270) / 420));
          const destRidgeLift = Math.pow(destClimb, 1.18) * 54
            + Math.max(0, Math.min(1, Math.abs(dest.x) / 240)) * 12;
          const ridgeBlend = dDest < 50 ? Math.pow(dDest / 50, 2) : 1;
          tilt += destRidgeLift + (ridgeLift + sideBank - destRidgeLift) * ridgeBlend;
        } else if (this.options.flavor === 'river') {
          const riverDist = distanceToPolyline(wx, wz, RIVER_POINTS);
          if (riverDist < 34) {
            const t = 1 - Math.min(1, riverDist / 34);
            const carved = Math.pow(t, 1.7);
            // Damping bumps by only 58% left enough residual noise along the
            // channel bed that it rose above the (near-flat) water mesh
            // between sample points, breaking the water surface into
            // disconnected patches. Right at the centerline (carved≈1) the
            // bed needs to be almost fully flat for continuous water to sit
            // on top of it cleanly.
            bumps *= 1 - carved * 0.92;
            tilt -= carved * 4.2;
          }
        }

        grid[iz * n + ix] = bumps + tilt;
      }
    }
    return grid;
  }

  // Distance from (wx, wz) to the river centerline, or null when this
  // terrain has no river feature — lets audio/other systems drive a
  // proximity beacon without duplicating RIVER_POINTS.
  getRiverDistance(wx: number, wz: number): number | null {
    if (this.options.flavor !== 'river') return null;
    return distanceToPolyline(wx, wz, RIVER_POINTS);
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
    } else if (profile.mode === 'ps3') {
      mat.albedoColor = this.options.flavor === 'rocky'
        ? new Color3(0.14, 0.12, 0.085)
        : this.options.flavor === 'river'
        ? new Color3(0.058, 0.105, 0.060)
        : new Color3(0.065, 0.125, 0.058);
      mat.ambientColor = this.options.flavor === 'rocky'
        ? new Color3(0.065, 0.055, 0.040)
        : this.options.flavor === 'river'
        ? new Color3(0.025, 0.050, 0.032)
        : new Color3(0.030, 0.065, 0.030);
    } else if (profile.mode === 'ps2') {
      mat.albedoColor = new Color3(0.08, 0.15, 0.06);
      mat.ambientColor = new Color3(0.04, 0.08, 0.03);
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

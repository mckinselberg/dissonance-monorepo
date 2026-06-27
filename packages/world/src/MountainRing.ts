import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
  VertexData,
  VertexBuffer,
} from '@babylonjs/core';
import type { ExperienceProfile } from '@dissonance/shared-types';
import { displaceRadial, noise3 } from './noise';

const CLUSTER_COUNT = 16;
// Must stay clearly outside the destination tower's distance from origin
// (~236 units) — it used to sit at 210, i.e. *inside* that distance, which
// is exactly why the mountains were rendering in front of/around the goal.
const RING_RADIUS = 340;

interface RidgePeak {
  angle: number;
  height: number;
  coreHalfWidth: number;
  shoulderWidth: number;
}

// Smallest signed angular distance between two angles, accounting for the
// 0/2π wraparound — without this, peaks near the seam would compare wrong.
function angleDist(a: number, b: number): number {
  let d = Math.abs(a - b) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
}

// Builds a small number of discrete peaks around the circle and, for any
// angle, returns the height of whichever peak's "footprint" reaches it —
// flat-topped within coreHalfWidth, sloping linearly down to the shared
// valley floor over shoulderWidth. This is what gives distinct ridges and
// valleys (a bar-graph silhouette) instead of one continuously-undulating
// curve, and shoulderWidth directly controls how steep each rise/fall is.
function buildRidgePeaks(count: number, minH: number, maxH: number): RidgePeak[] {
  const peaks: RidgePeak[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * (Math.PI * 2 / count) * 0.4;
    peaks.push({
      angle,
      height: minH + Math.random() * (maxH - minH),
      coreHalfWidth: 0.05 + Math.random() * 0.07,
      shoulderWidth: 0.22 + Math.random() * 0.16,
    });
  }
  return peaks;
}

function ridgeHeightAt(angle: number, peaks: RidgePeak[], valleyH: number): number {
  let h = valleyH;
  for (const peak of peaks) {
    const d = angleDist(angle, peak.angle);
    let contribution: number;
    if (d <= peak.coreHalfWidth) {
      contribution = peak.height;
    } else if (d <= peak.coreHalfWidth + peak.shoulderWidth) {
      const t = (d - peak.coreHalfWidth) / peak.shoulderWidth;
      contribution = peak.height + (valleyH - peak.height) * t;
    } else {
      contribution = valleyH;
    }
    h = Math.max(h, contribution);
  }
  return h;
}

export class MountainRing {
  private meshes: Mesh[] = [];

  constructor(scene: Scene, profile: ExperienceProfile) {
    const mat = new StandardMaterial('mountainMat', scene);
    mat.diffuseColor = new Color3(1, 1, 1);
    mat.specularColor = Color3.Black();
    mat.backFaceCulling = false;
    mat.emissiveColor = profile.mode === 'ps1'
      ? new Color3(0.03, 0.04, 0.07)
      : new Color3(0.01, 0.008, 0.015);

    const rockColors: Color3[] = profile.mode === 'ps1'
      ? [new Color3(0.16, 0.19, 0.30), new Color3(0.11, 0.14, 0.24)]
      : [new Color3(0.06, 0.05, 0.09), new Color3(0.045, 0.04, 0.07)];
    const snowColor = profile.mode === 'ps1'
      ? new Color3(0.82, 0.84, 0.88)
      : new Color3(0.22, 0.22, 0.26);

    this.meshes.push(this.buildRidgeWall(scene, profile, mat, rockColors[0], snowColor));
    this.buildForegroundClumps(scene, profile, mat, rockColors, snowColor);
  }

  // One continuous mesh wrapping the whole horizon — height varies via
  // periodic noise instead of being built from isolated cone peaks, so
  // there's no gap of sky between mountains anywhere in the loop.
  private buildRidgeWall(
    scene: Scene, profile: ExperienceProfile,
    mat: StandardMaterial, rockColor: Color3, snowColor: Color3,
  ): Mesh {
    const segments = 160;
    const seed = 4200;
    const VALLEY_H = 50, PEAK_MIN_H = 95, PEAK_MAX_H = 175;
    const BOTTOM_Y = -45;
    const RADIUS_JITTER = 14;
    const BASE_FLARE = 16;

    const peaks = buildRidgePeaks(12, PEAK_MIN_H, PEAK_MAX_H);

    const positions: number[] = [];
    const heights: number[] = [];

    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const height = ridgeHeightAt(angle, peaks, VALLEY_H);
      const radiusJ = (noise3(Math.cos(angle) * 3 + seed, Math.sin(angle) * 3 + seed, seed, seed) - 0.5) * 2 * RADIUS_JITTER;
      const r = RING_RADIUS + radiusJ;
      const tx = Math.cos(angle) * r, tz = Math.sin(angle) * r;
      // base flares outward a bit wider than the crest — a real mountainside
      // widens as it descends, rather than being a sheer vertical curtain.
      const br = r + BASE_FLARE;
      const bx = Math.cos(angle) * br, bz = Math.sin(angle) * br;

      positions.push(bx, BOTTOM_Y, bz);
      positions.push(tx, height, tz);
      heights.push(height);
    }

    const indices: number[] = [];
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      const b0 = i * 2, t0 = i * 2 + 1, b1 = next * 2, t1 = next * 2 + 1;
      indices.push(b0, t0, t1, b0, t1, b1);
    }

    const wall = new Mesh('mountainRidge', scene);
    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;

    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    vertexData.normals = normals;
    vertexData.applyToMesh(wall, true);

    const minH = Math.min(...heights), maxH = Math.max(...heights);
    const span = maxH - minH || 1;
    const colors: number[] = [];
    for (let i = 0; i < segments; i++) {
      const t = Math.max(0, Math.min(1, ((heights[i] - minH) / span - 0.6) / 0.2));
      // bottom vertex: always rock
      colors.push(rockColor.r, rockColor.g, rockColor.b, 1);
      // top vertex: rock -> snow blend by height
      colors.push(
        rockColor.r + (snowColor.r - rockColor.r) * t,
        rockColor.g + (snowColor.g - rockColor.g) * t,
        rockColor.b + (snowColor.b - rockColor.b) * t,
        1,
      );
    }
    wall.setVerticesData(VertexBuffer.ColorKind, colors);

    wall.material = mat;
    wall.applyFog = false;
    wall.isPickable = false;
    if (profile.mode === 'ps1') wall.convertToFlatShadedMesh();
    return wall;
  }

  // Clusters of overlapping cone peaks layered in front of the ridge wall
  // for foreground variety/depth — same look as before, just denser and
  // tighter so they merge into one chunky mass instead of reading as
  // separate isolated triangles.
  private buildForegroundClumps(
    scene: Scene, profile: ExperienceProfile,
    mat: StandardMaterial, rockColors: Color3[], snowColor: Color3,
  ): void {
    for (let c = 0; c < CLUSTER_COUNT; c++) {
      const baseAngle = (c / CLUSTER_COUNT) * Math.PI * 2;
      const peakCount = 3 + Math.floor(Math.random() * 4);
      const rockColor = rockColors[Math.floor(Math.random() * rockColors.length)];

      for (let p = 0; p < peakCount; p++) {
        const angle = baseAngle + (Math.random() - 0.5) * 0.45;
        const dist  = RING_RADIUS + (Math.random() - 0.5) * 25;
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;

        const height    = 48 + Math.random() * 82;
        const baseDiam  = height * (0.75 + Math.random() * 0.65);
        const tess      = profile.mode === 'ps1' ? 10 : 14;
        const seed      = Math.floor(Math.random() * 1000);

        const coneBaseY = height / 2 - 10;

        // A true point (diameterTop: 0) is what reads as a cartoon spike no
        // matter how jagged the sides get — real peaks have a blunt, broken
        // crown. Truncating the top and letting displaceRadial jitter that
        // now-nonzero ring (rather than just nudging a single apex vertex)
        // is what kills the "goofy" look.
        const peak = MeshBuilder.CreateCylinder(`mtn_${c}_${p}`, {
          height,
          diameterTop:    baseDiam * (0.10 + Math.random() * 0.10),
          diameterBottom: baseDiam,
          tessellation:   tess,
          subdivisions:   5,
        }, scene);
        displaceRadial(peak, 0.55, seed);

        peak.scaling.set(
          0.75 + Math.random() * 0.55,
          1,
          0.75 + Math.random() * 0.55,
        );
        peak.rotation.set(
          (Math.random() - 0.5) * 0.16, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.16,
        );

        const hasSnow = height > 78;
        const snowline = 0.55 + Math.random() * 0.15;
        this.paintRockSnowGradient(peak, rockColor, snowColor, hasSnow ? snowline : 1.05, seed);

        peak.position.set(x, coneBaseY, z);
        peak.material = mat;
        peak.applyFog = false;
        peak.isPickable = false;
        if (profile.mode === 'ps1') peak.convertToFlatShadedMesh();
        this.meshes.push(peak);
      }
    }
  }

  private paintRockSnowGradient(
    mesh: Mesh, rock: Color3, snow: Color3, snowline: number, seed: number,
  ): void {
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
    let minY = Infinity, maxY = -Infinity;
    for (let i = 1; i < positions.length; i += 3) {
      minY = Math.min(minY, positions[i]);
      maxY = Math.max(maxY, positions[i]);
    }
    const span = maxY - minY || 1;

    const colors: number[] = [];
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i], y = positions[i + 1], z = positions[i + 2];
      const heightFrac = (y - minY) / span;
      const angle = Math.atan2(z, x);
      const jitter = (noise3(Math.cos(angle) * 2 + seed, Math.sin(angle) * 2 + seed, y * 0.05 + seed, seed) - 0.5) * 0.18;
      const t = Math.max(0, Math.min(1, (heightFrac - (snowline + jitter)) / 0.18));
      colors.push(
        rock.r + (snow.r - rock.r) * t,
        rock.g + (snow.g - rock.g) * t,
        rock.b + (snow.b - rock.b) * t,
        1,
      );
    }
    mesh.setVerticesData(VertexBuffer.ColorKind, colors);
  }

  dispose(): void {
    this.meshes.forEach(m => m.dispose());
    this.meshes = [];
  }
}

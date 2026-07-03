import {
  Scene,
  Mesh,
  VertexData,
  StandardMaterial,
  Color3,
} from '@babylonjs/core';
import type { ExperienceProfile } from '@dissonance/shared-types';

const RING_RADIUS = 340;
const CARD_COUNT = 20;
const CARD_WIDTH = 210; // wider than ring slot (2π·340/20 ≈ 107) — ~2× overlap
const CARD_BOTTOM_Y = -35;
const PROFILE_POINTS = 9;

// Fast integer hash → [0, 1]
function hash(n: number): number {
  let h = n | 0;
  h = ((h ^ (h << 13)) | 0) * 1000003;
  h = (h ^ (h >> 17)) | 0;
  return (h & 0x7fffffff) / 0x7fffffff;
}

// Jagged mountain silhouette as a series of (x, y) points along the top
// edge of the card. Heights fade to minimum at the edges so overlapping
// cards blend without visible seams.
function buildSilhouette(width: number, seed: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < PROFILE_POINTS; i++) {
    const t = i / (PROFILE_POINTS - 1);
    const x = (t - 0.5) * width;
    const edgeFade = Math.sin(t * Math.PI);        // 0 at edges → 1 at centre
    const baseH = 18 + edgeFade * 52;              // 18 at edges, 70 at centre
    const peakH = hash(i * 1619 + seed) * 90 * edgeFade;
    pts.push({ x, y: Math.max(10, baseH + peakH) });
  }
  return pts;
}

// Mountain-profile polygon card.
// Vertices: v0 = bottom-left, v1..vN = top silhouette (left→right),
// v_{N+1} = bottom-right. Fan-triangulated from v0.
function buildCard(
  scene: Scene,
  name: string,
  width: number,
  bottomY: number,
  topPts: { x: number; y: number }[],
  mat: StandardMaterial,
): Mesh {
  const pos: number[] = [];
  pos.push(-width / 2, bottomY, 0);
  for (const p of topPts) pos.push(p.x, p.y, 0);
  pos.push(width / 2, bottomY, 0);

  const N = topPts.length;
  const idx: number[] = [];
  for (let i = 0; i < N; i++) idx.push(0, i + 1, i + 2);

  const normals: number[] = [];
  VertexData.ComputeNormals(pos, idx, normals);

  const vd = new VertexData();
  vd.positions = pos;
  vd.indices = idx;
  vd.normals = normals;

  const mesh = new Mesh(name, scene);
  vd.applyToMesh(mesh);
  mesh.material = mat;
  // Rotate around world Y to face the camera at all times.
  // Player boundary (320) keeps the player far enough that individual
  // planes never appear edge-on from within the playable area.
  mesh.billboardMode = Mesh.BILLBOARDMODE_Y;
  mesh.applyFog = false;
  mesh.isPickable = false;
  return mesh;
}

export class MountainRing {
  private meshes: Mesh[] = [];

  constructor(scene: Scene, profile: ExperienceProfile) {
    // Near silhouette layer — the primary visible ridge
    const nearEmissive = profile.mode === 'ps2'
      ? new Color3(0.045, 0.050, 0.075)
      : profile.mode === 'ps1'
      ? new Color3(0.07, 0.08, 0.14)
      : new Color3(0.028, 0.022, 0.040);
    const nearMat = new StandardMaterial('mtnNearMat', scene);
    nearMat.emissiveColor = nearEmissive;
    nearMat.diffuseColor = Color3.Black();
    nearMat.specularColor = Color3.Black();
    nearMat.backFaceCulling = false;
    nearMat.disableLighting = true;

    // Far backing layer — slightly darker, taller, staggered between the near
    // cards. Creates the impression of a second mountain range receding behind.
    const farEmissive = new Color3(nearEmissive.r * 0.5, nearEmissive.g * 0.5, nearEmissive.b * 0.5);
    const farMat = new StandardMaterial('mtnFarMat', scene);
    farMat.emissiveColor = farEmissive;
    farMat.diffuseColor = Color3.Black();
    farMat.specularColor = Color3.Black();
    farMat.backFaceCulling = false;
    farMat.disableLighting = true;

    for (let i = 0; i < CARD_COUNT; i++) {
      const angle = (i / CARD_COUNT) * Math.PI * 2;

      // Near card at RING_RADIUS
      const nx = Math.cos(angle) * RING_RADIUS;
      const nz = Math.sin(angle) * RING_RADIUS;
      const nearPts = buildSilhouette(CARD_WIDTH, i * 7331 + 100);
      const nearCard = buildCard(scene, `mtnNear_${i}`, CARD_WIDTH, CARD_BOTTOM_Y, nearPts, nearMat);
      nearCard.position.set(nx, 0, nz);
      this.meshes.push(nearCard);

      // Far card: staggered by half a slot angle, set back 35 units, 40% wider
      const fa = angle + Math.PI / CARD_COUNT;
      const fr = RING_RADIUS + 35;
      const farPts = buildSilhouette(CARD_WIDTH * 1.4, i * 13337 + 500);
      const farCard = buildCard(
        scene, `mtnFar_${i}`, CARD_WIDTH * 1.4, CARD_BOTTOM_Y - 10, farPts, farMat,
      );
      farCard.position.set(Math.cos(fa) * fr, 8, Math.sin(fa) * fr);
      this.meshes.push(farCard);
    }
  }

  dispose(): void {
    this.meshes.forEach(m => m.dispose());
    this.meshes = [];
  }
}

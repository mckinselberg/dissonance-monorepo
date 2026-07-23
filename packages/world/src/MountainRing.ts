import {
  Scene,
  Mesh,
  VertexData,
  StandardMaterial,
  Color3,
} from '@babylonjs/core';

const DEFAULT_RADIUS = 340;
const DEFAULT_CARD_COUNT = 20;
const DEFAULT_BOTTOM_Y = -35;
const PROFILE_POINTS = 9;
// Far-layer stagger, tuned against the DTA baseline (radius 340, ~2x-overlap
// cardWidth 210 → derived below as CARD_OVERLAP · perimeter/cardCount) and
// re-applied proportionally at other scales/shapes below.
const FAR_OFFSET = 35;
const FAR_Y_OFFSET = 8;
const FAR_BOTTOM_EXTRA = 10;
const CARD_OVERLAP = 2; // card width = this many slot-widths, for seamless overlap

export interface MountainRingOptions {
  /** 'circle' rings the ring around a point (DTA's fixed-size world); 'rectangle' hugs a rectangle's boundary (e.g. the same rectangle used to clamp player movement) so there's no gap between the play area's edge and the backdrop. Default 'circle'. */
  shape?: 'circle' | 'rectangle';
  /** circle mode: ring radius, world units. Default 340 (DTA's original fixed-size world). */
  radius?: number;
  /** rectangle mode: half-extents (X/Z) of the boundary the ring hugs. Required when shape is 'rectangle'. */
  halfWidth?: number;
  halfDepth?: number;
  /** rectangle mode: how far beyond halfWidth/halfDepth the ring sits. Default 0 (sits exactly at the boundary). */
  edgeMargin?: number;
  /** Card count for the near layer (the far layer uses the same count, staggered by half a slot). Default 20. */
  cardCount?: number;
  /** Width of each near-layer card. Defaults to ~2x the ring's own slot width (perimeter/cardCount), for seamless overlap regardless of shape/scale. */
  cardWidth?: number;
  /** World-space Y of each card's bottom edge — should sit at/below the lowest terrain the ring surrounds. Default -35 (DTA's flat ~y=0 world). */
  bottomY?: number;
  /** Multiplies the silhouette's peak/base heights (10-160 unit range at scale 1) and the far-layer's Y stagger — use to keep mountains proportionate on vertically-exaggerated worlds. Default 1. */
  heightScale?: number;
  /** Near-layer emissive color. */
  nearColor: Color3;
  /** Far-layer emissive color — defaults to nearColor at half brightness (a recession-into-haze look). */
  farColor?: Color3;
}

type RingPoint = { x: number; z: number; normalX: number; normalZ: number };

// A point at arc-length fraction t∈[0,1) around the ring, pushed outward
// along its own outward normal by `push` (used to stagger the far layer
// further out without duplicating the shape math per-shape at call sites).
type RingPointAt = (t: number, push: number) => RingPoint;

function circleRing(radius: number): { perimeter: number; pointAt: RingPointAt } {
  return {
    perimeter: 2 * Math.PI * radius,
    pointAt: (t, push) => {
      const angle = t * Math.PI * 2;
      const nx = Math.cos(angle);
      const nz = Math.sin(angle);
      const r = radius + push;
      return { x: nx * r, z: nz * r, normalX: nx, normalZ: nz };
    },
  };
}

// Walks the boundary of a halfWidth x halfDepth rectangle (offset outward by
// `edgeMargin`) as 4 straight segments. Segments meet at right-angle corners
// rather than a smoothed/rounded curve — the small diagonal gap this leaves
// at each corner is comfortably covered by normal card-to-card overlap, and
// is far smaller than the gap a circumscribing circle would leave along the
// flat edges (which is the whole reason this shape exists).
function rectangleRing(halfWidth: number, halfDepth: number, edgeMargin: number): { perimeter: number; pointAt: RingPointAt } {
  const sideX = 2 * halfWidth;  // length of the north/south (Z-normal) edges
  const sideZ = 2 * halfDepth;  // length of the east/west (X-normal) edges
  const perimeter = 2 * sideX + 2 * sideZ;
  const pointAt: RingPointAt = (t, push) => {
    let d = (((t % 1) + 1) % 1) * perimeter;
    const m = edgeMargin + push;
    if (d < sideX) {
      return { x: -halfWidth + d, z: -(halfDepth + m), normalX: 0, normalZ: -1 };
    }
    d -= sideX;
    if (d < sideZ) {
      return { x: halfWidth + m, z: -halfDepth + d, normalX: 1, normalZ: 0 };
    }
    d -= sideZ;
    if (d < sideX) {
      return { x: halfWidth - d, z: halfDepth + m, normalX: 0, normalZ: 1 };
    }
    d -= sideX;
    return { x: -(halfWidth + m), z: halfDepth - d, normalX: -1, normalZ: 0 };
  };
  return { perimeter, pointAt };
}

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
function buildSilhouette(width: number, seed: number, heightScale: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < PROFILE_POINTS; i++) {
    const t = i / (PROFILE_POINTS - 1);
    const x = (t - 0.5) * width;
    const edgeFade = Math.sin(t * Math.PI);        // 0 at edges → 1 at centre
    const baseH = (18 + edgeFade * 52) * heightScale;  // 18 at edges, 70 at centre (scale 1)
    const peakH = hash(i * 1619 + seed) * 90 * edgeFade * heightScale;
    pts.push({ x, y: Math.max(10 * heightScale, baseH + peakH) });
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
  mesh.applyFog = false;
  mesh.isPickable = false;
  return mesh;
}

export class MountainRing {
  private meshes: Mesh[] = [];

  constructor(scene: Scene, options: MountainRingOptions) {
    const cardCount = options.cardCount ?? DEFAULT_CARD_COUNT;
    const bottomY = options.bottomY ?? DEFAULT_BOTTOM_Y;
    const heightScale = options.heightScale ?? 1;

    const ring = options.shape === 'rectangle'
      ? rectangleRing(
        options.halfWidth ?? (() => { throw new Error('MountainRing: halfWidth is required for shape "rectangle"'); })(),
        options.halfDepth ?? (() => { throw new Error('MountainRing: halfDepth is required for shape "rectangle"'); })(),
        options.edgeMargin ?? 0,
      )
      : circleRing(options.radius ?? DEFAULT_RADIUS);

    const slotWidth = ring.perimeter / cardCount;
    const cardWidth = options.cardWidth ?? slotWidth * CARD_OVERLAP;

    // Near silhouette layer — the primary visible ridge
    const nearEmissive = options.nearColor;
    const nearMat = new StandardMaterial('mtnNearMat', scene);
    nearMat.emissiveColor = nearEmissive;
    nearMat.diffuseColor = Color3.Black();
    nearMat.specularColor = Color3.Black();
    nearMat.backFaceCulling = false;
    nearMat.disableLighting = true;

    // Far backing layer — slightly darker, taller, staggered between the near
    // cards. Creates the impression of a second mountain range receding behind.
    const farEmissive = options.farColor
      ?? new Color3(nearEmissive.r * 0.5, nearEmissive.g * 0.5, nearEmissive.b * 0.5);
    const farMat = new StandardMaterial('mtnFarMat', scene);
    farMat.emissiveColor = farEmissive;
    farMat.diffuseColor = Color3.Black();
    farMat.specularColor = Color3.Black();
    farMat.backFaceCulling = false;
    farMat.disableLighting = true;

    // Scaled relative to the DTA baseline (cardWidth 210, from radius 340 /
    // cardCount 20 at the CARD_OVERLAP ratio) so the stagger looks
    // proportionate at any scale/shape.
    const scaleFactor = cardWidth / (2 * Math.PI * DEFAULT_RADIUS / DEFAULT_CARD_COUNT * CARD_OVERLAP);
    const farOffset = FAR_OFFSET * scaleFactor;
    const farYOffset = FAR_Y_OFFSET * scaleFactor * heightScale;
    const farBottomExtra = FAR_BOTTOM_EXTRA * scaleFactor * heightScale;
    const farCardWidth = cardWidth * 1.4;

    for (let i = 0; i < cardCount; i++) {
      const t = i / cardCount;

      // Near card, right at the ring
      const near = ring.pointAt(t, 0);
      const nearPts = buildSilhouette(cardWidth, i * 7331 + 100, heightScale);
      const nearCard = buildCard(scene, `mtnNear_${i}`, cardWidth, bottomY, nearPts, nearMat);
      nearCard.position.set(near.x, 0, near.z);
      nearCard.rotation.y = Math.atan2(-near.normalX, -near.normalZ);
      this.meshes.push(nearCard);

      // Far card: staggered by half a slot, pushed further out, taller
      const far = ring.pointAt(t + 0.5 / cardCount, farOffset);
      const farPts = buildSilhouette(farCardWidth, i * 13337 + 500, heightScale);
      const farCard = buildCard(
        scene, `mtnFar_${i}`, farCardWidth, bottomY - farBottomExtra, farPts, farMat,
      );
      farCard.position.set(far.x, farYOffset, far.z);
      farCard.rotation.y = Math.atan2(-far.normalX, -far.normalZ);
      this.meshes.push(farCard);
    }
  }

  setVisible(visible: boolean): void {
    this.meshes.forEach(m => m.setEnabled(visible));
  }

  dispose(): void {
    this.meshes.forEach(m => m.dispose());
    this.meshes = [];
  }
}

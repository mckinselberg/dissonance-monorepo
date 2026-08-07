import { Scene, TransformNode, MeshBuilder, StandardMaterial, Color3, Mesh } from '@babylonjs/core';

// A named cloud silhouette: up to `slotCount` blob "prints", one per index
// slot. x/y/z are local offsets and diameterScale is a size multiplier, both
// expressed in units of the cloud instance's own base diameter (not meters)
// so one shape library works at any world scale/hScale — the same reason
// DriftingClouds' own size options are already meters-in, scaled by the
// caller. Slot index is the only correspondence between shapes (no semantic
// role names); shapes in a library should agree on what each slot "means"
// so morphing between them reads as continuous rather than shuffled.
export interface CloudBlobPrint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly diameterScale: number;
  readonly scaleY: number;
}

export type CloudShapeDefinition = readonly CloudBlobPrint[];
export type CloudShapeLibrary = Record<string, CloudShapeDefinition>;

// A vanished slot (diameterScale near 0) rather than a shorter array lets a
// shape "drop" a blob without shifting every later index's meaning.
const VANISHED_BLOB: CloudBlobPrint = { x: 0, y: 0, z: 0, diameterScale: 0.0001, scaleY: 0.2 };

// Four starting silhouettes, index-aligned to the same 6 slots (0=core,
// 1=secondary mass, 2/3=shoulders, 4=crown, 5=trailing wisp) so morphing
// between any pair moves a mass from one role to a plausible neighbor
// instead of teleporting. Not meant to be exhaustive — a real authoring pass
// would add more and vary slot count with VANISHED_BLOB, per shape docs above.
export const DEFAULT_CLOUD_SHAPES: CloudShapeLibrary = {
  'puffy-cumulus': [
    { x: 0, y: 0, z: 0, diameterScale: 1.0, scaleY: 0.32 },
    { x: 0.25, y: 0.05, z: 0.1, diameterScale: 0.85, scaleY: 0.3 },
    { x: -0.4, y: -0.05, z: -0.05, diameterScale: 0.7, scaleY: 0.28 },
    { x: 0.4, y: -0.05, z: 0.05, diameterScale: 0.7, scaleY: 0.28 },
    { x: 0.05, y: 0.22, z: -0.05, diameterScale: 0.55, scaleY: 0.34 },
    { x: 0.5, y: 0.15, z: 0.25, diameterScale: 0.4, scaleY: 0.22 },
  ],
  'wind-sheared-trail': [
    { x: 0, y: 0, z: 0, diameterScale: 0.9, scaleY: 0.18 },
    { x: 0.7, y: 0.02, z: 0.05, diameterScale: 0.8, scaleY: 0.16 },
    { x: -0.7, y: -0.02, z: -0.05, diameterScale: 0.75, scaleY: 0.15 },
    { x: 1.3, y: 0, z: 0.1, diameterScale: 0.55, scaleY: 0.12 },
    { x: -1.2, y: -0.05, z: -0.1, diameterScale: 0.45, scaleY: 0.1 },
    { x: 1.9, y: 0.03, z: 0.15, diameterScale: 0.3, scaleY: 0.08 },
  ],
  'flat-overcast-bank': [
    { x: 0, y: 0, z: 0, diameterScale: 1.1, scaleY: 0.14 },
    { x: 0.5, y: -0.02, z: 0.15, diameterScale: 1.0, scaleY: 0.13 },
    { x: -0.5, y: -0.02, z: -0.15, diameterScale: 1.0, scaleY: 0.13 },
    { x: 0.95, y: 0, z: -0.1, diameterScale: 0.75, scaleY: 0.12 },
    { x: -0.95, y: 0, z: 0.1, diameterScale: 0.75, scaleY: 0.12 },
    { x: 0, y: 0.1, z: 0, diameterScale: 0.5, scaleY: 0.16 },
  ],
  'broken-wisps': [
    { x: 0, y: 0, z: 0, diameterScale: 0.5, scaleY: 0.2 },
    { x: 0.8, y: 0.1, z: 0.3, diameterScale: 0.35, scaleY: 0.15 },
    { x: -0.75, y: -0.1, z: -0.35, diameterScale: 0.3, scaleY: 0.14 },
    VANISHED_BLOB,
    { x: -1.2, y: 0.15, z: 0.4, diameterScale: 0.25, scaleY: 0.12 },
    { x: 0.2, y: 0.3, z: -0.4, diameterScale: 0.2, scaleY: 0.1 },
  ],
};

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function pickShapeId(ids: string[], exclude?: string): string {
  if (ids.length <= 1) return ids[0];
  let id = ids[Math.floor(Math.random() * ids.length)];
  while (id === exclude) id = ids[Math.floor(Math.random() * ids.length)];
  return id;
}

type CloudMorphState = {
  fromId: string;
  toId: string;
  elapsedSeconds: number;
  durationSeconds: number;
};

export type DriftingCloudsOptions = {
  count?: number;
  // World units (already scaled by the caller) — clouds wrap within
  // [center - spread/2, center + spread/2] on X and Z.
  spread?: number;
  centerX?: number;
  centerZ?: number;
  altitudeMin?: number;
  altitudeMax?: number;
  diameterMin?: number;
  diameterMax?: number;
  // Base drift speed (world units/sec); each cloud randomizes 1x-2.5x this.
  driftSpeed?: number;
  color?: Color3;
  alpha?: number;
  // Opt-in authored-shape morphing (Strategy A from
  // docs/intake/authored-morphing-cloud-volumes-engineering-spec.md, scoped
  // down to index-based slot interpolation on the existing blob-cluster
  // renderer — no density fields, no raymarching). Omitting this preserves
  // the original random per-blob cluster behavior exactly.
  shapes?: CloudShapeLibrary;
  // Range of seconds a full morph between two shapes takes; each cloud
  // randomizes within this range and re-randomizes on every completed morph.
  morphDurationSecondsRange?: readonly [number, number];
};

const DEFAULTS = {
  count: 16,
  spread: 380,
  altitudeMin: 80,
  altitudeMax: 130,
  diameterMin: 12,
  diameterMax: 34,
  driftSpeed: 1,
  color: new Color3(0.9, 0.9, 0.92),
  alpha: 0.75,
  morphDurationSecondsRange: [30, 90] as const,
};

// Same blob-cluster-of-spheres technique as this package's CloudSystem, but
// decoupled from @dissonance/shared-types' ExperienceProfile and DTA's
// ~800-unit world scale — CloudSystem's hardcoded sizes/altitudes only make
// sense at that one scale. Scenes with a different (or no) notion of
// "experience mode" — e.g. a real-world DEM viewer where world size varies
// with a horizontalScale slider — configure size/altitude/spread directly
// instead.
export class DriftingClouds {
  private roots: TransformNode[] = [];
  private velocities: { vx: number; vz: number }[] = [];
  // Per-cloud blob groups (index-aligned to shape slots when shapes are
  // enabled); getMeshes() flattens this for callers that just want every
  // mesh (water reflection render list, disposal, etc).
  private blobGroups: Mesh[][] = [];
  private readonly spread: number;
  private readonly centerX: number;
  private readonly centerZ: number;

  // Shape-morph state, only populated when options.shapes is provided.
  private readonly shapes?: CloudShapeLibrary;
  private readonly shapeIds: string[] = [];
  private readonly slotCount: number = 0;
  private readonly morphDurationRange: readonly [number, number];
  private morphStates: CloudMorphState[] = [];
  private readonly baseDiameters: number[] = [];

  constructor(scene: Scene, options: DriftingCloudsOptions = {}) {
    const count = options.count ?? DEFAULTS.count;
    this.spread = options.spread ?? DEFAULTS.spread;
    this.centerX = options.centerX ?? 0;
    this.centerZ = options.centerZ ?? 0;
    const altitudeMin = options.altitudeMin ?? DEFAULTS.altitudeMin;
    const altitudeMax = options.altitudeMax ?? DEFAULTS.altitudeMax;
    const diameterMin = options.diameterMin ?? DEFAULTS.diameterMin;
    const diameterMax = options.diameterMax ?? DEFAULTS.diameterMax;
    const driftSpeed = options.driftSpeed ?? DEFAULTS.driftSpeed;
    this.morphDurationRange = options.morphDurationSecondsRange ?? DEFAULTS.morphDurationSecondsRange;

    this.shapes = options.shapes;
    if (this.shapes) {
      this.shapeIds = Object.keys(this.shapes);
      this.slotCount = Math.max(...this.shapeIds.map((id) => this.shapes![id].length));
    }

    const mat = new StandardMaterial('driftingCloudsMat', scene);
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    mat.emissiveColor = options.color ?? DEFAULTS.color;
    mat.alpha = options.alpha ?? DEFAULTS.alpha;

    for (let c = 0; c < count; c++) {
      const cx = this.centerX + (Math.random() - 0.5) * this.spread;
      const cz = this.centerZ + (Math.random() - 0.5) * this.spread;
      const cy = altitudeMin + Math.random() * (altitudeMax - altitudeMin);

      const root = new TransformNode(`cloudRoot_${c}`, scene);
      root.position.set(cx, cy, cz);
      this.roots.push(root);

      const angle = Math.random() * Math.PI * 2;
      const speed = driftSpeed * (1.0 + Math.random() * 1.5);
      this.velocities.push({ vx: Math.cos(angle) * speed, vz: Math.sin(angle) * speed });

      const diameter = diameterMin + Math.random() * (diameterMax - diameterMin);
      const group: Mesh[] = [];

      if (this.shapes) {
        this.baseDiameters.push(diameter);
        const fromId = pickShapeId(this.shapeIds);
        const toId = pickShapeId(this.shapeIds, fromId);
        this.morphStates.push({
          fromId,
          toId,
          elapsedSeconds: 0,
          durationSeconds: lerp(this.morphDurationRange[0], this.morphDurationRange[1], Math.random()),
        });
        for (let i = 0; i < this.slotCount; i++) {
          // Unit-diameter sphere so per-frame morphing can drive the full
          // scaling vector directly from diameterScale/scaleY, unlike the
          // unauthored branch below where diameter is baked into geometry.
          const blob = MeshBuilder.CreateSphere(`cloud_${c}_${i}`, { diameter: 1, segments: 5 }, scene);
          blob.parent = root;
          blob.material = mat;
          blob.applyFog = false;
          group.push(blob);
        }
        // Must push before applyMorphFrame — it reads the group back out of
        // this.blobGroups by index, which only exists after this push.
        this.blobGroups.push(group);
        this.applyMorphFrame(c, 0);
        continue;
      } else {
        const blobCount = 4 + Math.floor(Math.random() * 5);
        for (let b = 0; b < blobCount; b++) {
          const blob = MeshBuilder.CreateSphere(`cloud_${c}_${b}`, { diameter, segments: 5 }, scene);
          blob.parent = root;
          const spanXZ = diameter * 1.3;
          blob.position.set((Math.random() - 0.5) * spanXZ, (Math.random() - 0.5) * spanXZ * 0.25, (Math.random() - 0.5) * spanXZ);
          blob.scaling.y = 0.22 + Math.random() * 0.14;
          blob.material = mat;
          blob.applyFog = false;
          group.push(blob);
        }
      }
      this.blobGroups.push(group);
    }
  }

  // Lets a caller register the cloud blobs with something else that wants
  // to know about scene meshes — e.g. WaterPlane.addToRenderList, so
  // clouds show up in the water's reflection.
  getMeshes(): Mesh[] {
    return this.blobGroups.flat();
  }

  update(dt: number): void {
    const half = this.spread / 2;
    for (let c = 0; c < this.roots.length; c++) {
      const root = this.roots[c];
      root.position.x += this.velocities[c].vx * dt;
      root.position.z += this.velocities[c].vz * dt;
      if (root.position.x > this.centerX + half) root.position.x -= this.spread;
      if (root.position.x < this.centerX - half) root.position.x += this.spread;
      if (root.position.z > this.centerZ + half) root.position.z -= this.spread;
      if (root.position.z < this.centerZ - half) root.position.z += this.spread;
    }

    if (this.shapes) {
      for (let c = 0; c < this.morphStates.length; c++) {
        const state = this.morphStates[c];
        state.elapsedSeconds += dt;
        if (state.elapsedSeconds >= state.durationSeconds) {
          state.fromId = state.toId;
          state.toId = pickShapeId(this.shapeIds, state.fromId);
          state.elapsedSeconds = 0;
          state.durationSeconds = lerp(this.morphDurationRange[0], this.morphDurationRange[1], Math.random());
        }
        this.applyMorphFrame(c, smoothstep(Math.min(1, state.elapsedSeconds / state.durationSeconds)));
      }
    }
  }

  // Interpolates cloud c's blob slots between its current morph's from/to
  // shapes at eased progress t, and writes the result straight to each
  // blob mesh's local position/scaling. Also called once at t=0 during
  // construction so a freshly spawned cloud starts posed, not default-sized.
  private applyMorphFrame(cloudIndex: number, t: number): void {
    const shapes = this.shapes!;
    const state = this.morphStates[cloudIndex];
    const from = shapes[state.fromId];
    const to = shapes[state.toId];
    const diameter = this.baseDiameters[cloudIndex];
    const group = this.blobGroups[cloudIndex];
    for (let i = 0; i < this.slotCount; i++) {
      const a = from[i] ?? VANISHED_BLOB;
      const b = to[i] ?? VANISHED_BLOB;
      const x = lerp(a.x, b.x, t) * diameter;
      const y = lerp(a.y, b.y, t) * diameter;
      const z = lerp(a.z, b.z, t) * diameter;
      const blobDiameter = Math.max(0.001, lerp(a.diameterScale, b.diameterScale, t) * diameter);
      const scaleY = lerp(a.scaleY, b.scaleY, t);
      const blob = group[i];
      blob.position.set(x, y, z);
      blob.scaling.set(blobDiameter, blobDiameter * scaleY, blobDiameter);
    }
  }

  setVisible(visible: boolean): void {
    this.roots.forEach((r) => r.setEnabled(visible));
  }

  dispose(): void {
    this.blobGroups.forEach((group) => group.forEach((m) => m.dispose()));
    this.roots.forEach((r) => r.dispose());
  }
}

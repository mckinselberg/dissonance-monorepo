import { Scene, Mesh, MeshBuilder, StandardMaterial, PBRMaterial, Color3, Matrix, Quaternion, Vector3 } from '@babylonjs/core';
import type { TreePoint } from './ThinInstanceTrees';

export type ForestFireOptions = {
  horizontalScale?: number;
  verticalExaggeration?: number;
  // Real meters — how far a burning tree can ignite an unburnt neighbor.
  spreadRadius?: number;
  // Seconds between spread attempts from each currently-burning tree.
  spreadIntervalSeconds?: number;
  // Probability a given unburnt neighbor within spreadRadius catches, per attempt.
  spreadChance?: number;
  // Seconds a tree actively burns (visible flame) before becoming a burnt stand-in.
  burnDurationSeconds?: number;
  // Hard cap on simultaneous flame meshes. A real wildfire sim would need a
  // spatial index to keep spread-checking cheap at scale; this POC instead
  // just throttles growth so it never needs one — checking every burning
  // tree against every tree point (a few thousand) every couple seconds is
  // still trivial, it's only the *mesh* count this guards.
  maxActiveFires?: number;
  // Real meters — how close an ignite() point needs to be to a tree to catch it.
  igniteRadius?: number;
};

type TreeState = 'unburnt' | 'burning' | 'burnt';

const DEFAULT_SPREAD_RADIUS = 35;
const DEFAULT_SPREAD_INTERVAL = 2.5;
const DEFAULT_SPREAD_CHANCE = 0.22;
const DEFAULT_BURN_DURATION = 10;
const DEFAULT_MAX_ACTIVE_FIRES = 60;
// Wider than spreadRadius — with a few thousand trees scattered across a
// multi-km² area, average spacing between them is tens of meters, so a
// tight radius would frequently find nothing near an arbitrary player position.
const DEFAULT_IGNITE_RADIUS = 150;

// A game-mechanic layer on top of ThinInstanceTrees' scattered points:
// ignite the nearest tree, then fire spreads through unburnt neighbors
// within spreadRadius over time, throttled by maxActiveFires so growth is
// gradual instead of the whole forest catching in one frame.
//
// Doesn't touch the original tree thin-instances at all — recoloring or
// removing one specific thin instance needs a per-instance attribute buffer
// this POC doesn't set up. Instead a burnt tree gets a blackened stand-in
// silhouette (its own thin-instanced template) added at the same spot, so
// from normal viewing distance it just reads as "that tree burned down."
export class ForestFire {
  private readonly points: TreePoint[];
  private readonly state: TreeState[];
  private readonly burnStartTime: number[] = [];
  private readonly flameMeshes: Map<number, Mesh> = new Map();
  private readonly burntStumpTemplate: Mesh;
  private readonly flameMat: StandardMaterial;
  private horizontalScale: number;
  private verticalExaggeration: number;
  private readonly spreadRadius: number;
  private readonly spreadIntervalSeconds: number;
  private readonly spreadChance: number;
  private readonly burnDurationSeconds: number;
  private readonly maxActiveFires: number;
  private readonly igniteRadius: number;
  private readonly scene: Scene;
  private elapsed = 0;
  private timeSinceSpreadCheck = 0;

  constructor(scene: Scene, points: TreePoint[], options: ForestFireOptions = {}) {
    this.scene = scene;
    this.points = points;
    this.state = points.map(() => 'unburnt');
    this.horizontalScale = options.horizontalScale ?? 1;
    this.verticalExaggeration = options.verticalExaggeration ?? 1;
    this.spreadRadius = options.spreadRadius ?? DEFAULT_SPREAD_RADIUS;
    this.spreadIntervalSeconds = options.spreadIntervalSeconds ?? DEFAULT_SPREAD_INTERVAL;
    this.spreadChance = options.spreadChance ?? DEFAULT_SPREAD_CHANCE;
    this.burnDurationSeconds = options.burnDurationSeconds ?? DEFAULT_BURN_DURATION;
    this.maxActiveFires = options.maxActiveFires ?? DEFAULT_MAX_ACTIVE_FIRES;
    this.igniteRadius = options.igniteRadius ?? DEFAULT_IGNITE_RADIUS;

    this.flameMat = new StandardMaterial('fireFlameMat', scene);
    this.flameMat.emissiveColor = new Color3(1.0, 0.45, 0.05);
    this.flameMat.disableLighting = true;
    this.flameMat.backFaceCulling = false;
    this.flameMat.alpha = 0.9;

    const stumpMat = new PBRMaterial('burntStumpMat', scene);
    stumpMat.albedoColor = new Color3(0.04, 0.03, 0.03);
    stumpMat.metallic = 0;
    stumpMat.roughness = 1;
    // A tall, thin charred silhouette (not a literal low stump) — tall
    // enough to visually cover the original tree's canopy too, since we
    // can't hide that specific thin instance out from under it.
    this.burntStumpTemplate = MeshBuilder.CreateCylinder('burntStumpTemplate', {
      height: 10, diameterBottom: 1.2, diameterTop: 0.3, tessellation: 6,
    }, scene);
    this.burntStumpTemplate.material = stumpMat;
    this.burntStumpTemplate.position.y = 5; // local origin at ground; mesh extends upward from there
    this.burntStumpTemplate.bakeCurrentTransformIntoVertices();
  }

  get activeFireCount(): number {
    return this.flameMeshes.size;
  }

  // Repositions/rescales active flames and rebuilds the burnt-stump thin
  // instances from tracked state — unlike ThinInstanceTrees/DriftingClouds,
  // fire has real in-progress state (which trees are burnt/burning) worth
  // preserving across a rescale rather than just disposing and starting over.
  setScale(horizontalScale: number, verticalExaggeration: number): void {
    this.horizontalScale = horizontalScale;
    this.verticalExaggeration = verticalExaggeration;

    for (const [index, flame] of this.flameMeshes) {
      const p = this.points[index];
      flame.position.set(p.x * horizontalScale, p.groundY * verticalExaggeration + 2, p.z * horizontalScale);
    }

    this.burntStumpTemplate.thinInstanceCount = 0;
    const matrices: Matrix[] = [];
    for (let i = 0; i < this.state.length; i++) {
      if (this.state[i] !== 'burnt') continue;
      const p = this.points[i];
      matrices.push(Matrix.Compose(
        new Vector3(horizontalScale, verticalExaggeration, horizontalScale),
        Quaternion.Identity(),
        new Vector3(p.x * horizontalScale, p.groundY * verticalExaggeration, p.z * horizontalScale),
      ));
    }
    if (matrices.length > 0) this.burntStumpTemplate.thinInstanceAdd(matrices, true);
  }

  // (x, z) are real (unscaled) world coordinates — same convention as
  // TreePoint and everything else in this scene.
  ignite(x: number, z: number): void {
    if (this.flameMeshes.size >= this.maxActiveFires) return;
    let closestIndex = -1;
    let closestDist = this.igniteRadius * this.igniteRadius;
    for (let i = 0; i < this.points.length; i++) {
      if (this.state[i] !== 'unburnt') continue;
      const dx = this.points[i].x - x;
      const dz = this.points[i].z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < closestDist) {
        closestDist = d2;
        closestIndex = i;
      }
    }
    if (closestIndex >= 0) this.startBurning(closestIndex);
  }

  private startBurning(index: number): void {
    this.state[index] = 'burning';
    this.burnStartTime[index] = this.elapsed;

    const p = this.points[index];
    const flame = MeshBuilder.CreatePlane(`fireFlame_${index}`, { size: 3 }, this.scene);
    flame.billboardMode = Mesh.BILLBOARDMODE_ALL;
    flame.material = this.flameMat;
    flame.position.set(
      p.x * this.horizontalScale,
      p.groundY * this.verticalExaggeration + 2,
      p.z * this.horizontalScale,
    );
    this.flameMeshes.set(index, flame);
  }

  private extinguish(index: number): void {
    const flame = this.flameMeshes.get(index);
    if (flame) {
      flame.dispose();
      this.flameMeshes.delete(index);
    }
    this.state[index] = 'burnt';

    const p = this.points[index];
    const matrix = Matrix.Compose(
      new Vector3(this.horizontalScale, this.verticalExaggeration, this.horizontalScale),
      Quaternion.Identity(),
      new Vector3(p.x * this.horizontalScale, p.groundY * this.verticalExaggeration, p.z * this.horizontalScale),
    );
    this.burntStumpTemplate.thinInstanceAdd(matrix, true);
  }

  update(dt: number): void {
    this.elapsed += dt;

    // Flicker: cheap per-frame emissive jitter shared across all active
    // flames (one material), rather than animating each flame mesh separately.
    this.flameMat.emissiveColor.set(1.0, 0.4 + Math.sin(this.elapsed * 11) * 0.08 + Math.random() * 0.05, 0.05);

    const burningNow = Array.from(this.flameMeshes.keys());
    for (const index of burningNow) {
      if (this.elapsed - this.burnStartTime[index] >= this.burnDurationSeconds) {
        this.extinguish(index);
      }
    }

    this.timeSinceSpreadCheck += dt;
    if (this.timeSinceSpreadCheck < this.spreadIntervalSeconds) return;
    this.timeSinceSpreadCheck = 0;
    if (this.flameMeshes.size >= this.maxActiveFires) return;

    const spreadRadius2 = this.spreadRadius * this.spreadRadius;
    for (const bi of Array.from(this.flameMeshes.keys())) {
      if (this.flameMeshes.size >= this.maxActiveFires) break;
      const bp = this.points[bi];
      for (let i = 0; i < this.points.length; i++) {
        if (this.state[i] !== 'unburnt') continue;
        const dx = this.points[i].x - bp.x;
        const dz = this.points[i].z - bp.z;
        if (dx * dx + dz * dz > spreadRadius2) continue;
        if (Math.random() < this.spreadChance) {
          this.startBurning(i);
          if (this.flameMeshes.size >= this.maxActiveFires) break;
        }
      }
    }
  }

  reset(): void {
    for (const flame of this.flameMeshes.values()) flame.dispose();
    this.flameMeshes.clear();
    this.burntStumpTemplate.thinInstanceCount = 0;
    for (let i = 0; i < this.state.length; i++) this.state[i] = 'unburnt';
  }

  dispose(): void {
    for (const flame of this.flameMeshes.values()) flame.dispose();
    this.flameMeshes.clear();
    this.burntStumpTemplate.dispose();
    this.flameMat.dispose();
  }
}

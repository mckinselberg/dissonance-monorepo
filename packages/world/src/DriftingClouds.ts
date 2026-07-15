import { Scene, TransformNode, MeshBuilder, StandardMaterial, Color3, Mesh } from '@babylonjs/core';

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
  private blobs: Mesh[] = [];
  private readonly spread: number;
  private readonly centerX: number;
  private readonly centerZ: number;

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

      const blobCount = 4 + Math.floor(Math.random() * 5);
      for (let b = 0; b < blobCount; b++) {
        const diameter = diameterMin + Math.random() * (diameterMax - diameterMin);
        const blob = MeshBuilder.CreateSphere(`cloud_${c}_${b}`, { diameter, segments: 5 }, scene);
        blob.parent = root;
        const spanXZ = diameter * 1.3;
        blob.position.set((Math.random() - 0.5) * spanXZ, (Math.random() - 0.5) * spanXZ * 0.25, (Math.random() - 0.5) * spanXZ);
        blob.scaling.y = 0.22 + Math.random() * 0.14;
        blob.material = mat;
        blob.applyFog = false;
        this.blobs.push(blob);
      }
    }
  }

  // Lets a caller register the cloud blobs with something else that wants
  // to know about scene meshes — e.g. WaterPlane.addToRenderList, so
  // clouds show up in the water's reflection.
  getMeshes(): Mesh[] {
    return this.blobs;
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
  }

  setVisible(visible: boolean): void {
    this.roots.forEach((r) => r.setEnabled(visible));
  }

  dispose(): void {
    this.blobs.forEach((m) => m.dispose());
    this.roots.forEach((r) => r.dispose());
  }
}

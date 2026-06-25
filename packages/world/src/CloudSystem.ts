import {
  Scene,
  TransformNode,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
} from '@babylonjs/core';
import type { ExperienceProfile } from '@dissonance/shared-types';

const CLOUD_COUNT = 16;
const WORLD_SPREAD = 380;

export class CloudSystem {
  private roots: TransformNode[] = [];
  private velocities: { vx: number; vz: number }[] = [];
  private blobs: Mesh[] = [];

  constructor(scene: Scene, profile: ExperienceProfile) {
    const mat = new StandardMaterial('cloudMat', scene);
    mat.disableLighting = true;
    mat.backFaceCulling = false;

    if (profile.mode === 'ps1') {
      mat.emissiveColor = new Color3(0.88, 0.86, 0.82);
      mat.alpha = 0.80;
    } else {
      mat.emissiveColor = new Color3(0.18, 0.18, 0.22);
      mat.alpha = 0.70;
    }

    for (let c = 0; c < CLOUD_COUNT; c++) {
      const cx = (Math.random() - 0.5) * WORLD_SPREAD;
      const cz = (Math.random() - 0.5) * WORLD_SPREAD;
      const cy = 80 + Math.random() * 50;

      const root = new TransformNode(`cloudRoot_${c}`, scene);
      root.position.set(cx, cy, cz);
      this.roots.push(root);

      const angle = Math.random() * Math.PI * 2;
      const speed = 1.0 + Math.random() * 1.5;
      this.velocities.push({ vx: Math.cos(angle) * speed, vz: Math.sin(angle) * speed });

      const blobCount = 4 + Math.floor(Math.random() * 5);
      for (let b = 0; b < blobCount; b++) {
        const blob = MeshBuilder.CreateSphere(
          `cloud_${c}_${b}`,
          { diameter: 12 + Math.random() * 22, segments: profile.mode === 'ps1' ? 3 : 5 },
          scene,
        );
        blob.parent = root;
        blob.position.set(
          (Math.random() - 0.5) * 28,
          (Math.random() - 0.5) * 7,
          (Math.random() - 0.5) * 28,
        );
        blob.scaling.y = 0.22 + Math.random() * 0.14;
        blob.material = mat;
        blob.applyFog = false;
        if (profile.mode === 'ps1') blob.convertToFlatShadedMesh();
        this.blobs.push(blob);
      }
    }
  }

  update(dt: number): void {
    const half = WORLD_SPREAD / 2;
    for (let c = 0; c < this.roots.length; c++) {
      const root = this.roots[c];
      root.position.x += this.velocities[c].vx * dt;
      root.position.z += this.velocities[c].vz * dt;
      if (root.position.x >  half) root.position.x -= WORLD_SPREAD;
      if (root.position.x < -half) root.position.x += WORLD_SPREAD;
      if (root.position.z >  half) root.position.z -= WORLD_SPREAD;
      if (root.position.z < -half) root.position.z += WORLD_SPREAD;
    }
  }

  dispose(): void {
    this.blobs.forEach(m => m.dispose());
    this.roots.forEach(r => r.dispose());
  }
}

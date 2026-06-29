import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
  GlowLayer,
} from '@babylonjs/core';
import type { ExperienceMode } from '@dissonance/shared-types';
import { HeartbeatGlow } from '@dissonance/glow';

export class PursuerBody {
  private capsule: Mesh;
  private glowLayer: GlowLayer;
  private heartbeat: HeartbeatGlow;
  private readonly height = 1.8;

  private readonly glowR: number;
  private readonly glowG: number;
  private readonly glowB: number;

  constructor(scene: Scene, mode: ExperienceMode) {
    const ps1 = mode === 'ps1';

    this.glowR = ps1 ? 1.0  : 0.20;
    this.glowG = ps1 ? 0.18 : 0.55;
    this.glowB = ps1 ? 0.02 : 1.0;

    const mat = new StandardMaterial('pursuerBodyMat', scene);
    mat.diffuseColor  = Color3.Black();
    mat.specularColor = Color3.Black();
    mat.emissiveColor = new Color3(this.glowR, this.glowG, this.glowB);
    mat.alpha = 0;

    this.capsule = MeshBuilder.CreateCapsule('pursuerBody', {
      height: this.height,
      radius: 0.26,
      tessellation: ps1 ? 6 : 10,
      subdivisions: ps1 ? 2 : 4,
    }, scene);

    this.capsule.material = mat;
    this.capsule.isVisible = true;
    if (ps1) this.capsule.convertToFlatShadedMesh();

    this.glowLayer = new GlowLayer('pursuerGlow', scene);
    this.glowLayer.intensity = 0.4;
    this.heartbeat = new HeartbeatGlow(this.capsule, this.glowLayer);
  }

  setStress(stress: number): void {
    this.heartbeat.setStress(stress);
  }

  setVisible(visible: boolean): void {
    this.capsule.isVisible = visible;
  }

  // The capsule's diffuse/specular are already black, but its emissiveColor
  // (the heartbeat glow tint) was still self-illuminating it — alpha alone
  // wasn't enough to read as a flat black silhouette instead of a glowing
  // shape. Zero the emissive while lit (also starves the GlowLayer halo,
  // which samples emissive) and restore it once out of the beam.
  setIlluminated(lit: boolean): void {
    const mat = this.capsule.material as StandardMaterial;
    mat.alpha = lit ? 1 : 0;
    mat.emissiveColor = lit
      ? Color3.Black()
      : new Color3(this.glowR, this.glowG, this.glowB);
  }

  update(dt: number, pos: { x: number; z: number }, groundY: number): void {
    this.capsule.position.set(pos.x, groundY + this.height / 2, pos.z);
    this.heartbeat.update(dt);
  }

  dispose(): void {
    this.glowLayer.dispose();
    this.capsule.dispose();
  }
}

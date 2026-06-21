import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
  GlowLayer,
} from '@babylonjs/core';
import type { ExperienceMode } from '@dta/shared-types';

export class PursuerBody {
  private capsule: Mesh;
  private glow: GlowLayer;
  private readonly height = 1.8;
  private stress = 0;
  private glowPhase = 0;

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

    this.glow = new GlowLayer('pursuerGlow', scene);
    this.glow.addIncludedOnlyMesh(this.capsule);
    this.glow.intensity = 0.4;
  }

  setStress(stress: number): void {
    this.stress = stress;
  }

  setVisible(visible: boolean): void {
    this.capsule.isVisible = visible;
  }

  update(dt: number, pos: { x: number; z: number }, groundY: number): void {
    this.capsule.position.set(pos.x, groundY + this.height / 2, pos.z);

    const bpm = 65 + this.stress * 90;
    const cycleLen = 60 / bpm;
    this.glowPhase = (this.glowPhase + dt / cycleLen) % 1.0;

    const lub = Math.pow(Math.max(0, 1 - this.glowPhase * 5.5), 2.5);
    const dub = Math.pow(Math.max(0, 1 - Math.abs(this.glowPhase - 0.14) * 13), 2.5) * 0.55;
    const pulse = Math.max(lub, dub);

    const base    = 0.30 + this.stress * 0.50;
    const peakAdd = pulse * (0.85 + this.stress * 1.8);
    this.glow.intensity = base + peakAdd;
  }

  dispose(): void {
    this.glow.dispose();
    this.capsule.dispose();
  }
}

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
  private body: Mesh;
  private glowLayer: GlowLayer;
  private heartbeat: HeartbeatGlow;

  private readonly glowR: number;
  private readonly glowG: number;
  private readonly glowB: number;

  constructor(scene: Scene, mode: ExperienceMode) {
    const ps1 = mode === 'ps1';
    const ps2 = mode === 'ps2';

    this.glowR = ps1 ? 1.0  : ps2 ? 1.0  : 0.20;
    this.glowG = ps1 ? 0.18 : ps2 ? 0.08 : 0.55;
    this.glowB = ps1 ? 0.02 : ps2 ? 0.02 : 1.0;

    const mat = new StandardMaterial('pursuerBodyMat', scene);
    mat.diffuseColor = Color3.Black();
    mat.specularColor = Color3.Black();
    mat.emissiveColor = new Color3(this.glowR, this.glowG, this.glowB);
    mat.alpha = 0;

    const bakeBox = (
      name: string,
      w: number, h: number, d: number,
      x: number, y: number, z: number,
      rx = 0, ry = 0, rz = 0,
    ): Mesh => {
      const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      m.bakeCurrentTransformIntoVertices();
      return m;
    };

    const limbSegs = ps1 ? 5 : ps2 ? 8 : 7;
    const headSegs = ps1 ? 6 : ps2 ? 10 : 8;
    const bakeLimb = (
      name: string,
      height: number,
      diameter: number,
      x: number, y: number, z: number,
      rx = 0, ry = 0, rz = 0,
    ): Mesh => {
      const m = MeshBuilder.CreateCylinder(name, {
        height,
        diameterTop: diameter * 0.78,
        diameterBottom: diameter,
        tessellation: limbSegs,
      }, scene);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      m.bakeCurrentTransformIntoVertices();
      return m;
    };

    const head = MeshBuilder.CreateSphere('head', {
      diameterX: 0.38,
      diameterY: 0.58,
      diameterZ: 0.34,
      segments: headSegs,
    }, scene);
    head.position.set(0, 2.36, 0.06);
    head.rotation.x = -0.18;
    head.bakeCurrentTransformIntoVertices();

    const parts = [
      // Human-readable core: hips, abdomen, ribcage, shoulders, neck, skull.
      bakeBox('pelvis', 0.34, 0.20, 0.22, 0, 0.98, -0.02, -0.06),
      bakeBox('abdomen', 0.46, 0.52, 0.20, 0, 1.32, -0.04, 0.10),
      bakeBox('ribcage', 0.82, 0.62, 0.30, 0, 1.66, -0.08, 0.18),
      bakeBox('shoulders', 1.16, 0.16, 0.24, 0, 1.93, -0.04, 0, 0, 0.04),
      bakeLimb('neck', 0.34, 0.16, 0, 2.08, -0.02, -0.22),
      head,

      // Small horns keep the devil read without turning the silhouette cartoony.
      bakeBox('hornL', 0.10, 0.34, 0.10, -0.15, 2.70, 0.02, 0.28, 0, -0.34),
      bakeBox('hornR', 0.10, 0.34, 0.10,  0.15, 2.70, 0.02, 0.28, 0,  0.34),

      // Too-long arms and low hands are the main unnatural cue.
      bakeLimb('upperArmL', 0.76, 0.13, -0.58, 1.57, 0.10, 0.42, 0.08, -0.36),
      bakeLimb('upperArmR', 0.76, 0.13,  0.58, 1.57, 0.10, 0.42, -0.08, 0.36),
      bakeLimb('forearmL', 0.84, 0.11, -0.70, 0.96, 0.34, 0.64, -0.04, 0.10),
      bakeLimb('forearmR', 0.84, 0.11,  0.70, 0.96, 0.34, 0.64,  0.04, -0.10),
      bakeBox('handL', 0.16, 0.10, 0.22, -0.74, 0.50, 0.58, 0.12),
      bakeBox('handR', 0.16, 0.10, 0.22,  0.74, 0.50, 0.58, 0.12),

      // Bent, narrow legs put feet back at world-y=0 and make it recognizably bipedal.
      bakeLimb('thighL', 0.66, 0.15, -0.18, 0.66, -0.02, -0.12, 0.03, -0.10),
      bakeLimb('thighR', 0.66, 0.15,  0.18, 0.66, -0.02, -0.12, -0.03, 0.10),
      bakeLimb('shinL', 0.78, 0.12, -0.14, 0.28, 0.08, 0.20, 0.05, 0.06),
      bakeLimb('shinR', 0.78, 0.12,  0.14, 0.28, 0.08, 0.20, -0.05, -0.06),
      bakeBox('footL', 0.18, 0.08, 0.42, -0.14, 0.04, 0.22, 0, -0.16),
      bakeBox('footR', 0.18, 0.08, 0.42,  0.14, 0.04, 0.22, 0,  0.16),
    ];

    this.body = Mesh.MergeMeshes(parts, true, true)!;
    this.body.name = 'pursuerBody';
    this.body.material = mat;
    this.body.isVisible = true;

    if (ps1) this.body.convertToFlatShadedMesh();

    this.glowLayer = new GlowLayer('pursuerGlow', scene);
    this.glowLayer.intensity = ps2 ? 0.7 : 0.4;
    this.heartbeat = new HeartbeatGlow(this.body, this.glowLayer);
  }

  setStress(stress: number): void {
    this.heartbeat.setStress(stress);
  }

  setVisible(visible: boolean): void {
    this.body.isVisible = visible;
  }

  setIlluminated(lit: boolean): void {
    const mat = this.body.material as StandardMaterial;
    mat.alpha = lit ? 1 : 0;
    mat.emissiveColor = lit
      ? Color3.Black()
      : new Color3(this.glowR, this.glowG, this.glowB);
  }

  update(
    dt: number,
    pos: { x: number; z: number },
    groundY: number,
    playerPos: { x: number; z: number },
  ): void {
    this.body.position.set(pos.x, groundY, pos.z);
    const dx = playerPos.x - pos.x;
    const dz = playerPos.z - pos.z;
    if (dx * dx + dz * dz > 0.01) {
      this.body.rotation.y = Math.atan2(dx, dz);
    }
    this.heartbeat.update(dt);
  }

  dispose(): void {
    this.glowLayer.dispose();
    this.body.dispose();
  }
}

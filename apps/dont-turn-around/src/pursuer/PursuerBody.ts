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

    this.glowR = ps1 ? 1.0  : 0.20;
    this.glowG = ps1 ? 0.18 : 0.55;
    this.glowB = ps1 ? 0.02 : 1.0;

    const mat = new StandardMaterial('pursuerBodyMat', scene);
    mat.diffuseColor  = Color3.Black();
    mat.specularColor = Color3.Black();
    mat.emissiveColor = new Color3(this.glowR, this.glowG, this.glowB);
    mat.alpha = 0;

    // Build humanoid silhouette. Local origin = feet centre (y=0).
    // Arms extend forward along +Z so the figure faces the player once
    // rotation.y is set in update().
    const box = (name: string, w: number, h: number, d: number, x: number, y: number, z: number): Mesh => {
      const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
      m.position.set(x, y, z);
      m.bakeCurrentTransformIntoVertices(); // fold position into vertices; origin stays at feet
      return m;
    };

    const parts = [
      box('legL',  0.18, 0.88, 0.18,  -0.12, 0.44, 0   ),
      box('legR',  0.18, 0.88, 0.18,   0.12, 0.44, 0   ),
      box('torso', 0.48, 0.60, 0.22,   0,    1.18, 0   ),
      box('head',  0.26, 0.26, 0.22,   0,    1.65, 0   ),
      // Arms: depth = reach length, centre at z=+0.26 (sticking forward)
      box('armL',  0.14, 0.14, 0.52,  -0.30, 1.32, 0.26),
      box('armR',  0.14, 0.14, 0.52,   0.30, 1.32, 0.26),
    ];

    this.body = Mesh.MergeMeshes(parts, true, true)!;
    this.body.name = 'pursuerBody';
    this.body.material = mat;
    this.body.isVisible = true;

    if (ps1) this.body.convertToFlatShadedMesh();

    this.glowLayer = new GlowLayer('pursuerGlow', scene);
    this.glowLayer.intensity = 0.4;
    this.heartbeat = new HeartbeatGlow(this.body, this.glowLayer);
  }

  setStress(stress: number): void {
    this.heartbeat.setStress(stress);
  }

  setVisible(visible: boolean): void {
    this.body.isVisible = visible;
  }

  // When the flashlight catches the pursuer, swap from glow-halo to a solid
  // black silhouette — emissive feeds the GlowLayer, so zeroing it kills the
  // halo; alpha=1 makes the mesh itself visible as a flat black shape instead.
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
    // Feet at groundY; humanoid extends upward from there.
    this.body.position.set(pos.x, groundY, pos.z);

    // Rotate to face the player so the forward-reaching arms point toward them.
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

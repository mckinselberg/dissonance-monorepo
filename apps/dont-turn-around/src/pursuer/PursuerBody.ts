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

    // Bake position + rotation into vertex data so the merged mesh
    // keeps world-y=0 as the feet origin. rx/ry/rz default to 0.
    const bake = (
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

    //
    // Demonic silhouette — inverted triangle (massive chest, narrow hips),
    // elongated skull, splayed horns, long reaching arms.
    //
    // Heights (y):
    //   0.00–0.92  legs
    //   0.92–1.14  pelvis (narrow — the V starts here)
    //   1.14–1.74  torso  (0.88 wide — the widest point)
    //   1.74–2.10  head   (taller/narrower than a human skull)
    //   2.10–2.36  horns  (splayed outward ~25°)
    //
    const parts = [
      // Legs: slightly taller and narrower than a human
      bake('legL', 0.14, 0.92, 0.14, -0.11, 0.46, 0),
      bake('legR', 0.14, 0.92, 0.14,  0.11, 0.46, 0),

      // Pelvis: narrow hips start the inverted-V
      bake('pelvis', 0.38, 0.22, 0.20, 0, 1.03, 0),

      // Chest/torso: nearly double the width of the hips — very imposing
      bake('torso', 0.88, 0.60, 0.26, 0, 1.44, 0),

      // Head: doubled in size — center at y=2.10 keeps bottom flush with torso top
      // (0.22→0.44 wide, 0.36→0.72 tall, 0.20→0.40 deep; top now at y=2.46)
      bake('head', 0.44, 0.72, 0.40, 0, 2.10, 0),

      // Horns: doubled in size, straight up from the top corners of the skull.
      // Placed at x=±0.16 (near head outer edges, head half-width=0.22).
      // Base sits at head top (y=2.46); tips reach y=2.98.
      bake('hornL', 0.16, 0.52, 0.16, -0.16, 2.72, 0),
      bake('hornR', 0.16, 0.52, 0.16,  0.16, 2.72, 0),

      // Arms: much longer than before (0.90 vs 0.52), positioned at shoulder
      // height and extending forward along +Z toward the player.
      bake('armL', 0.13, 0.13, 0.90, -0.56, 1.44, 0.32),
      bake('armR', 0.13, 0.13, 0.90,  0.56, 1.44, 0.32),
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

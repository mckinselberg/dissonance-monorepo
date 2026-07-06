import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh } from '@babylonjs/core';
import type { Terrain } from '@dissonance/world';

const PICKUP_RADIUS = 2.4;

export class ArtifactProp {
  private base: Mesh;
  private tag: Mesh;
  private tagMat: StandardMaterial;
  private picked = false;
  private pulseTime = 0;
  private readonly groundY: number;

  constructor(
    scene: Scene,
    readonly id: string,
    readonly label: string,
    readonly x: number,
    readonly z: number,
    terrain: Terrain,
  ) {
    this.groundY = terrain.getHeightAt(x, z);

    const baseMat = new StandardMaterial('artifactPostMat', scene);
    baseMat.diffuseColor = new Color3(0.12, 0.07, 0.04);
    baseMat.specularColor = Color3.Black();

    this.tagMat = new StandardMaterial('artifactTagMat', scene);
    this.tagMat.diffuseColor = new Color3(0.55, 0.32, 0.10);
    this.tagMat.emissiveColor = new Color3(0.18, 0.07, 0.02);
    this.tagMat.specularColor = Color3.Black();

    this.base = MeshBuilder.CreateCylinder('artifactPost', {
      height: 0.75,
      diameter: 0.08,
      tessellation: 6,
    }, scene);
    this.base.position.set(x, this.groundY + 0.375, z);
    this.base.material = baseMat;
    this.base.isPickable = false;

    this.tag = MeshBuilder.CreateBox('artifactTag', {
      width: 0.44,
      height: 0.28,
      depth: 0.045,
    }, scene);
    this.tag.position.set(x, this.groundY + 0.82, z);
    this.tag.rotation.y = -0.7;
    this.tag.material = this.tagMat;
    this.tag.isPickable = false;
  }

  update(dt: number, playerX: number, playerZ: number): boolean {
    if (this.picked) return false;

    this.pulseTime += dt;
    const glow = 0.08 + (0.5 + Math.sin(this.pulseTime * 2.8) * 0.5) * 0.16;
    this.tagMat.emissiveColor = new Color3(glow, glow * 0.35, glow * 0.12);

    const dx = playerX - this.x;
    const dz = playerZ - this.z;
    if (dx * dx + dz * dz < PICKUP_RADIUS * PICKUP_RADIUS) {
      this.picked = true;
      this.base.isVisible = false;
      this.tag.isVisible = false;
      return true;
    }
    return false;
  }

  dispose(): void {
    this.base.material?.dispose();
    this.base.dispose();
    this.tagMat.dispose();
    this.tag.dispose();
  }
}

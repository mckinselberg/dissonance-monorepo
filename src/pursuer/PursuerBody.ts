import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
} from '@babylonjs/core';
import type { ExperienceMode } from '../types';

// Dev-only visible stand-in for the pursuer.
// Invisible by default; toggle via DevHUD.
// Eyes from WatcherEffect spawn at the body's position, so enabling this
// lets you see exactly where the eyes are appearing.
export class PursuerBody {
  private capsule: Mesh;
  private readonly height = 1.8;

  constructor(scene: Scene, mode: ExperienceMode) {
    const mat = new StandardMaterial('pursuerBodyMat', scene);
    mat.diffuseColor = new Color3(0.08, 0.06, 0.08);
    mat.emissiveColor = new Color3(0.06, 0.04, 0.06);
    mat.specularColor = Color3.Black();

    this.capsule = MeshBuilder.CreateCapsule('pursuerBody', {
      height: this.height,
      radius: 0.26,
      tessellation: mode === 'ps1' ? 6 : 10,
      subdivisions: mode === 'ps1' ? 2 : 4,
    }, scene);

    // Capsule origin is its centre, so lift by half height to sit on the ground
    this.capsule.position.y = this.height / 2;
    this.capsule.material = mat;
    this.capsule.isVisible = false;

    if (mode === 'ps1') this.capsule.convertToFlatShadedMesh();
  }

  setVisible(visible: boolean): void {
    this.capsule.isVisible = visible;
  }

  update(pos: { x: number; z: number }): void {
    this.capsule.position.x = pos.x;
    this.capsule.position.z = pos.z;
  }

  dispose(): void {
    this.capsule.dispose();
  }
}

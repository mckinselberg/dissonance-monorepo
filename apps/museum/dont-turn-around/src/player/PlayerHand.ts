import { Scene, MeshBuilder, StandardMaterial, Color3, Vector3, Mesh } from '@babylonjs/core';
import type { FreeCamera } from '@babylonjs/core';

// Hand-held phone mesh parented to the player camera so it follows all
// camera movement without any per-frame sync logic. renderingGroupId=1
// puts it in the layer rendered after the world (group 0), and the default
// depth-clear between groups means it always appears in front of terrain/trees
// without z-fighting — standard FPS weapon technique.
//
// Camera-local axes: +X = right, +Y = up, +Z = forward (into scene).
// For the face of the phone to be VISIBLE to the player, height must be the
// tall dimension — width×height is the face plane, depth is how thick the
// slab is front-to-back relative to the camera view direction.
export class PlayerHand {
  private readonly meshes: Mesh[];

  constructor(scene: Scene, camera: FreeCamera) {
    const bodyMat = new StandardMaterial('handBodyMat', scene);
    bodyMat.diffuseColor = new Color3(0.10, 0.10, 0.10);
    bodyMat.specularColor = new Color3(0.15, 0.15, 0.15);

    const screenMat = new StandardMaterial('handScreenMat', scene);
    screenMat.emissiveColor = new Color3(0.35, 0.55, 0.85);
    screenMat.disableLighting = true;

    // Portrait phone: width=narrow, height=tall, depth=thin slab
    // From the camera's POV: width×height is the visible face rectangle
    const body = MeshBuilder.CreateBox('handBody', { width: 0.065, height: 0.13, depth: 0.014 }, scene);
    body.material = bodyMat;
    body.renderingGroupId = 1;
    body.isPickable = false;

    // Screen sits on the front face of the body (slightly closer to camera = smaller z)
    const screen = MeshBuilder.CreateBox('handScreen', { width: 0.054, height: 0.108, depth: 0.002 }, scene);
    screen.material = screenMat;
    screen.renderingGroupId = 1;
    screen.isPickable = false;

    body.parent = camera;
    screen.parent = camera;

    // Lower-right corner of view, 0.38 units forward so it clears the near clip (0.1)
    body.position.set(0.20, -0.20, 0.38);
    // Screen on the front face: body center z=0.38, body depth/2=0.007 → front face at z=0.373
    screen.position.set(0.20, -0.20, 0.373);

    // Slight natural-hold tilt: top leans away from camera
    const tilt = new Vector3(-0.18, 0.10, 0.04);
    body.rotation.copyFrom(tilt);
    screen.rotation.copyFrom(tilt);

    this.meshes = [body, screen];
    this.setVisible(false);
  }

  setVisible(v: boolean): void {
    for (const m of this.meshes) m.isVisible = v;
  }

  dispose(): void {
    for (const m of this.meshes) {
      m.material?.dispose();
      m.dispose();
    }
  }
}

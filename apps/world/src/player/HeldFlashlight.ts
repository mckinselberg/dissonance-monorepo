import {
  LoadAssetContainerAsync,
  Mesh,
  TransformNode,
  Vector3,
  type AssetContainer,
  type FreeCamera,
  type Scene,
} from '@babylonjs/core';
import { ensureGltfLoader } from '../world/gltfLoader';

const MODEL_URL = `${import.meta.env.BASE_URL}models/flashlight/runtime/flashlight.glb`;

// Camera-space presentation belongs to World rather than @dissonance/player:
// the shared player package owns the light mechanics, while this authored
// model, pose, and visual treatment are specific to Dissonance's active layer.
export class HeldFlashlight {
  private readonly root: TransformNode;
  private container: AssetContainer | null = null;
  private visible = false;
  private disposed = false;

  constructor(
    private readonly scene: Scene,
    camera: FreeCamera,
  ) {
    this.root = new TransformNode('heldFlashlight', scene);
    this.root.parent = camera;
    this.root.position.set(0.18, -0.18, 0.32);

    // The imported glTF root already handles Blender's handedness/Y-up
    // conversion. Keep only a restrained screen-space cant here; adding the
    // compensating half-turn points the torch's tail into the scene.
    this.root.rotation = new Vector3(-0.18, 0.12, 0.1);
    this.root.setEnabled(false);

    // Keep the held prop from clipping into terrain or architecture. Group 1
    // is reserved here for the camera-space presentation; the world stays in
    // Babylon's default group 0.
    scene.setRenderingAutoClearDepthStencil(1, true);
    void this.load();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.root.setEnabled(visible);
  }

  dispose(): void {
    this.disposed = true;
    this.container?.dispose();
    this.root.dispose();
  }

  private async load(): Promise<void> {
    try {
      await ensureGltfLoader();
      const container = await LoadAssetContainerAsync(MODEL_URL, this.scene);
      if (this.disposed) {
        container.dispose();
        return;
      }

      container.addAllToScene();
      for (const node of container.rootNodes) node.parent = this.root;

      const renderMeshes = container.meshes.filter(
        (mesh): mesh is Mesh => mesh instanceof Mesh && mesh.getTotalVertices() > 0,
      );
      if (renderMeshes.length === 0) {
        container.dispose();
        throw new Error('flashlight.glb contains no renderable meshes');
      }

      for (const mesh of renderMeshes) {
        mesh.isPickable = false;
        mesh.receiveShadows = false;
        mesh.renderingGroupId = 1;
      }
      this.container = container;
      this.root.setEnabled(this.visible);
    } catch (error) {
      // The light mechanic remains usable if the presentation asset fails;
      // a missing cosmetic GLB must not prevent World from starting.
      console.warn('[HeldFlashlight] failed to load presentation model', error);
    }
  }
}

import {
  Color3,
  LoadAssetContainerAsync,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import type { Scene, ShadowGenerator } from '@babylonjs/core';
import { ensureGltfLoader } from './gltfLoader';

const TREE_PREVIEW_URL = `${import.meta.env.BASE_URL}models/tree-small-02/tree_small_02_preview.glb`;

export interface TrailTreePreviewHandle {
  meshCount: number;
  triangleCount: number;
  setPlacement(groundPosition: Vector3, uniformScale: number): void;
  dispose(): void;
}

export async function loadTrailTreePreview(
  scene: Scene,
  groundPosition: Vector3,
  uniformScale: number,
  shadowGenerator?: ShadowGenerator,
): Promise<TrailTreePreviewHandle> {
  await ensureGltfLoader();

  const container = await LoadAssetContainerAsync(TREE_PREVIEW_URL, scene);
  const root = new TransformNode('trailTreePreviewRoot', scene);
  let marker: Mesh | null = null;
  let markerMaterial: StandardMaterial | null = null;

  try {
    container.addAllToScene();
    for (const node of container.rootNodes) node.parent = root;

    root.rotation.y = Math.PI * 0.2;
    root.computeWorldMatrix(true);

    const renderMeshes = container.meshes.filter((mesh) => mesh.getTotalVertices() > 0);
    let minimumY = Number.POSITIVE_INFINITY;
    let triangleCount = 0;

    for (const mesh of renderMeshes) {
      mesh.computeWorldMatrix(true);
      minimumY = Math.min(minimumY, mesh.getBoundingInfo().boundingBox.minimumWorld.y);
      triangleCount += Math.floor(mesh.getTotalIndices() / 3);
      mesh.receiveShadows = true;
      shadowGenerator?.addShadowCaster(mesh);
    }
    if (!Number.isFinite(minimumY)) minimumY = 0;

    markerMaterial = new StandardMaterial('trailTreePreviewMarkerMaterial', scene);
    markerMaterial.disableLighting = true;
    markerMaterial.emissiveColor = new Color3(0.05, 0.85, 1);

    marker = MeshBuilder.CreateTorus('trailTreePreviewMarker', {
      diameter: 3.6,
      thickness: 0.04,
      tessellation: 48,
    }, scene);
    marker.material = markerMaterial;

    const setPlacement = (position: Vector3, requestedScale: number) => {
      const scale = Math.max(0.01, requestedScale);
      root.scaling.setAll(scale);
      root.position.set(position.x, position.y - minimumY * scale, position.z);
      root.computeWorldMatrix(true);

      marker?.scaling.setAll(scale);
      marker?.position.set(position.x, position.y + 0.04 * scale, position.z);
      shadowGenerator?.getShadowMap()?.resetRefreshCounter();
    };
    setPlacement(groundPosition, uniformScale);

    let disposed = false;
    return {
      meshCount: renderMeshes.length,
      triangleCount,
      setPlacement,
      dispose: () => {
        if (disposed) return;
        disposed = true;
        marker?.dispose();
        markerMaterial?.dispose();
        container.dispose();
        root.dispose();
      },
    };
  } catch (error) {
    marker?.dispose();
    markerMaterial?.dispose();
    container.dispose();
    root.dispose();
    throw error;
  }
}

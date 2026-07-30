import {
  Color3,
  HemisphericLight,
  LoadAssetContainerAsync,
  Mesh,
  PBRMaterial,
  TransformNode,
  Vector3,
  type Scene,
} from '@babylonjs/core';
import { ensureGltfLoader } from '../world/gltfLoader';
import { SurveilledInteriorCamera } from './SurveilledInteriorCamera';

export interface SurveillanceInteriorHandle {
  readonly cameraController: SurveilledInteriorCamera;
  readonly architectureMeshCount: number;
  readonly propMeshCount: number;
  readonly occluderMeshCount: number;
  readonly artifactAnchorCount: number;
  dispose(): void;
}

const RUNTIME_MODEL_URL =
  `${import.meta.env.BASE_URL}models/milos-apartment/runtime/milos-apartment.glb`;
const STAGING_HEIGHT = 50_000;

export async function loadMilosApartmentInterior(scene: Scene): Promise<SurveillanceInteriorHandle> {
  await ensureGltfLoader();
  const container = await LoadAssetContainerAsync(RUNTIME_MODEL_URL, scene);
  container.addAllToScene();

  const stagingRoot = new TransformNode('milos_apartment_runtime_root', scene);
  for (const node of container.rootNodes) node.parent = stagingRoot;

  const renderMeshes = container.meshes.filter(
    (mesh): mesh is Mesh => mesh instanceof Mesh && mesh.getTotalVertices() > 0,
  );
  if (renderMeshes.length === 0) {
    container.dispose();
    stagingRoot.dispose();
    throw new Error('Milo apartment capture contains no renderable meshes');
  }

  const architecture = renderMeshes.filter((mesh) => mesh.name.startsWith('APT_ARCH_'));
  const props = renderMeshes.filter((mesh) => mesh.name.startsWith('APT_PROP_'));
  const occluders = renderMeshes.filter((mesh) => mesh.name.startsWith('APT_OCCLUDER_'));
  // Artifact anchors are exported as empties (no mesh data), so glTF gives
  // them no `mesh` index and Babylon loads them as TransformNodes rather
  // than into container.meshes.
  const artifactAnchors = container.transformNodes.filter((node) =>
    node.name.startsWith('ARTIFACT_ANCHOR_'),
  );
  const classified = new Set([...architecture, ...props, ...occluders]);
  const unclassified = renderMeshes.filter((mesh) => !classified.has(mesh));
  if (unclassified.length > 0) {
    console.warn(
      `[MilosApartment] unclassified runtime meshes: ${unclassified.map((mesh) => mesh.name).join(', ')}`,
    );
  }

  for (const mesh of renderMeshes) {
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    mesh.computeWorldMatrix(true);
  }

  let min = new Vector3(
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  );
  let max = new Vector3(
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  );
  for (const mesh of renderMeshes) {
    const bounds = mesh.getBoundingInfo().boundingBox;
    min = Vector3.Minimize(min, bounds.minimumWorld);
    max = Vector3.Maximize(max, bounds.maximumWorld);
  }

  const sourceCenter = min.add(max).scale(0.5);
  stagingRoot.position.set(-sourceCenter.x, STAGING_HEIGHT - min.y, -sourceCenter.z);
  stagingRoot.computeWorldMatrix(true);
  for (const mesh of renderMeshes) mesh.computeWorldMatrix(true);

  min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  max = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
  for (const mesh of renderMeshes) {
    const bounds = mesh.getBoundingInfo().boundingBox;
    min = Vector3.Minimize(min, bounds.minimumWorld);
    max = Vector3.Maximize(max, bounds.maximumWorld);
  }
  const dimensions = max.subtract(min);
  const target = min.add(max).scale(0.5);

  // The scan textures already contain baked lighting. A restrained ambient
  // source plus a small albedo-emissive contribution keeps them readable
  // without visibly relighting the captured room.
  const interiorLight = new HemisphericLight(
    'milos_apartment_capture_light',
    new Vector3(-0.35, 1, -0.25),
    scene,
  );
  interiorLight.intensity = 0.7;
  interiorLight.diffuse = new Color3(1, 0.93, 0.84);
  interiorLight.groundColor = new Color3(0.16, 0.18, 0.22);
  for (const material of container.materials) {
    if (!(material instanceof PBRMaterial) || !material.albedoTexture) continue;
    material.emissiveTexture = material.albedoTexture;
    material.emissiveColor = new Color3(0.22, 0.22, 0.22);
    material.roughness = 0.9;
    material.metallic = 0;
  }

  const cameraController = new SurveilledInteriorCamera(scene, {
    target,
    bounds: {
      width: Math.max(0.1, dimensions.x),
      depth: Math.max(0.1, dimensions.z),
      height: Math.max(0.1, dimensions.y),
    },
  });

  console.info(
    `[MilosApartment] loaded capture: ${renderMeshes.length} meshes, ` +
    `${renderMeshes.reduce((sum, mesh) => sum + mesh.getTotalVertices(), 0)} vertices, ` +
    `bounds ${dimensions.x.toFixed(2)}×${dimensions.y.toFixed(2)}×${dimensions.z.toFixed(2)}m`,
  );

  return {
    cameraController,
    architectureMeshCount: architecture.length,
    propMeshCount: props.length,
    occluderMeshCount: occluders.length,
    artifactAnchorCount: artifactAnchors.length,
    dispose: () => {
      cameraController.dispose();
      interiorLight.dispose();
      container.dispose();
      stagingRoot.dispose();
    },
  };
}

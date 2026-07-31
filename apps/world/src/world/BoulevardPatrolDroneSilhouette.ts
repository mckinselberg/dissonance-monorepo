import {
  Color3,
  MeshBuilder,
  PBRMaterial,
  TransformNode,
  type AbstractMesh,
  type Scene,
  type ShadowGenerator,
} from '@babylonjs/core';

export const BOULEVARD_PATROL_DRONE_BODY_RADIUS = 0.62;

export type BoulevardPatrolDronePresentation = 'active' | 'inert-scorched' | 'cradle';

export interface BoulevardPatrolDroneSilhouetteHandle {
  readonly root: TransformNode;
  readonly eyeMaterial: PBRMaterial;
  setPresentation(presentation: BoulevardPatrolDronePresentation): void;
  dispose(): void;
}

export function createBoulevardPatrolDroneSilhouette(
  scene: Scene,
  id: string,
  options: {
    parent?: TransformNode;
    rootName?: string;
    meshPrefix?: string;
    presentation?: BoulevardPatrolDronePresentation;
    shadowGenerator?: ShadowGenerator;
  } = {},
): BoulevardPatrolDroneSilhouetteHandle {
  const meshPrefix = options.meshPrefix ?? 'patrolDrone';
  const root = new TransformNode(options.rootName ?? `patrolDrone:${id}`, scene);
  root.parent = options.parent ?? null;
  const meshes: AbstractMesh[] = [];

  const bodyMaterial = new PBRMaterial(`${meshPrefix}Body:${id}`, scene);
  const eyeMaterial = new PBRMaterial(`${meshPrefix}Eye:${id}`, scene);

  const body = MeshBuilder.CreateSphere(
    `${meshPrefix}Body:${id}`,
    { diameter: BOULEVARD_PATROL_DRONE_BODY_RADIUS * 2, segments: 12 },
    scene,
  );
  body.scaling.set(1.25, 0.52, 0.85);
  body.material = bodyMaterial;
  body.parent = root;
  meshes.push(body);

  const ring = MeshBuilder.CreateTorus(
    `${meshPrefix}Ring:${id}`,
    {
      diameter: BOULEVARD_PATROL_DRONE_BODY_RADIUS * 1.8,
      thickness: 0.08,
      tessellation: 20,
    },
    scene,
  );
  ring.rotation.x = Math.PI / 2;
  ring.material = bodyMaterial;
  ring.parent = root;
  meshes.push(ring);

  for (const side of [-1, 1]) {
    const eye = MeshBuilder.CreateSphere(
      `${meshPrefix}Eye:${id}:${side}`,
      { diameter: 0.16, segments: 8 },
      scene,
    );
    eye.position.set(
      side * 0.3,
      -0.04,
      BOULEVARD_PATROL_DRONE_BODY_RADIUS * 0.72,
    );
    eye.material = eyeMaterial;
    eye.parent = root;
    meshes.push(eye);
  }

  for (const mesh of [body, ring]) {
    mesh.receiveShadows = true;
    options.shadowGenerator?.addShadowCaster(mesh);
  }

  const setPresentation = (presentation: BoulevardPatrolDronePresentation) => {
    bodyMaterial.wireframe = presentation === 'cradle';
    bodyMaterial.alpha = presentation === 'cradle' ? 0.28 : 1;
    eyeMaterial.wireframe = presentation === 'cradle';
    eyeMaterial.alpha = presentation === 'cradle' ? 0.22 : 1;

    if (presentation === 'active') {
      bodyMaterial.albedoColor = new Color3(0.065, 0.075, 0.08);
      bodyMaterial.emissiveColor = Color3.Black();
      bodyMaterial.metallic = 0.85;
      bodyMaterial.roughness = 0.26;
      eyeMaterial.albedoColor = new Color3(0.03, 0.1, 0.12);
      eyeMaterial.emissiveColor = new Color3(0.12, 0.9, 1);
      eyeMaterial.metallic = 0.3;
      eyeMaterial.roughness = 0.25;
      return;
    }

    if (presentation === 'inert-scorched') {
      bodyMaterial.albedoColor = new Color3(0.032, 0.038, 0.04);
      bodyMaterial.emissiveColor = new Color3(0.006, 0.008, 0.008);
      bodyMaterial.metallic = 0.62;
      bodyMaterial.roughness = 0.72;
      eyeMaterial.albedoColor = new Color3(0.018, 0.04, 0.045);
      eyeMaterial.emissiveColor = new Color3(0.012, 0.075, 0.085);
      eyeMaterial.metallic = 0.2;
      eyeMaterial.roughness = 0.7;
      return;
    }

    bodyMaterial.albedoColor = new Color3(0.07, 0.2, 0.18);
    bodyMaterial.emissiveColor = new Color3(0.018, 0.08, 0.065);
    bodyMaterial.metallic = 0.25;
    bodyMaterial.roughness = 0.8;
    eyeMaterial.albedoColor = new Color3(0.035, 0.16, 0.17);
    eyeMaterial.emissiveColor = new Color3(0.018, 0.09, 0.1);
    eyeMaterial.metallic = 0.15;
    eyeMaterial.roughness = 0.85;
  };
  setPresentation(options.presentation ?? 'active');

  return {
    root,
    eyeMaterial,
    setPresentation,
    dispose: () => {
      meshes.forEach((mesh) => mesh.dispose(false, false));
      bodyMaterial.dispose();
      eyeMaterial.dispose();
      root.dispose();
    },
  };
}

import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  Vector3,
  type AbstractMesh,
  type Scene,
} from '@babylonjs/core';
import { WORLD_HARDWARE_IDS } from '../state/worldSave';
import { createBoulevardPatrolDroneSilhouette } from '../world/BoulevardPatrolDroneSilhouette';

export interface WorkshopInventoryDisplay {
  setHardwareIds(hardwareIds: readonly string[]): void;
  dispose(): void;
}

function createMaterial(
  scene: Scene,
  name: string,
  diffuse: Color3,
  emissive: Color3,
): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = diffuse;
  material.emissiveColor = emissive;
  material.specularColor = diffuse.scale(0.08);
  return material;
}

/**
 * Presentation-only inventory surfaces for the first T31 recovery beat.
 * Stable hardware IDs come from the World save; these objects intentionally
 * expose no assembly, mounting, maintenance, terminal, or piloting behavior.
 */
export function createWorkshopInventoryDisplay(
  scene: Scene,
  parent: TransformNode,
  initialHardwareIds: readonly string[],
): WorkshopInventoryDisplay {
  const meshes: AbstractMesh[] = [];
  const cradleMaterial = createMaterial(
    scene,
    'workshopHardwareCradleMaterial',
    new Color3(0.1, 0.2, 0.18),
    new Color3(0.025, 0.09, 0.075),
  );
  cradleMaterial.alpha = 0.62;
  const emitterMaterial = createMaterial(
    scene,
    'workshopRecoveredEmitterMaterial',
    new Color3(0.24, 0.18, 0.09),
    new Color3(0.13, 0.07, 0.018),
  );

  const addMesh = (mesh: AbstractMesh, node: TransformNode, position: Vector3) => {
    mesh.parent = node;
    mesh.position.copyFrom(position);
    mesh.checkCollisions = false;
    meshes.push(mesh);
    return mesh;
  };

  const chassisCradle = createBoulevardPatrolDroneSilhouette(
    scene,
    WORLD_HARDWARE_IDS.boulevardPatrolDroneChassis,
    {
      parent,
      rootName: `workshopHardwareCradle:${WORLD_HARDWARE_IDS.boulevardPatrolDroneChassis}`,
      meshPrefix: 'workshopHardwareCradle',
      presentation: 'cradle',
    },
  );
  chassisCradle.root.position.set(-1.45, 1.76, 22);
  chassisCradle.root.rotation.y = Math.PI;
  chassisCradle.root.scaling.setAll(1.04);

  const emitterCradle = new TransformNode(
    `workshopHardwareCradle:${WORLD_HARDWARE_IDS.patrolDroneEmitter}`,
    scene,
  );
  emitterCradle.parent = parent;
  emitterCradle.position.set(1.45, 1.21, 22);
  const emitterRing = addMesh(
    MeshBuilder.CreateTorus(
      `${emitterCradle.name}:ring`,
      { diameter: 1.05, thickness: 0.1, tessellation: 24 },
      scene,
    ),
    emitterCradle,
    Vector3.Zero(),
  );
  emitterRing.material = cradleMaterial;

  const chassis = createBoulevardPatrolDroneSilhouette(
    scene,
    WORLD_HARDWARE_IDS.boulevardPatrolDroneChassis,
    {
      parent,
      rootName: `workshopHardware:${WORLD_HARDWARE_IDS.boulevardPatrolDroneChassis}`,
      meshPrefix: 'workshopRecoveredPatrolDrone',
      presentation: 'inert-scorched',
    },
  );
  chassis.root.position.set(-1.45, 1.76, 22);
  chassis.root.rotation.y = Math.PI;

  const emitter = new TransformNode(
    `workshopHardware:${WORLD_HARDWARE_IDS.patrolDroneEmitter}`,
    scene,
  );
  emitter.parent = emitterCradle;
  const emitterCore = addMesh(
    MeshBuilder.CreateCylinder(
      `${emitter.name}:core`,
      { height: 0.42, diameter: 0.5, tessellation: 20 },
      scene,
    ),
    emitter,
    new Vector3(0, 0.25, 0),
  );
  emitterCore.material = emitterMaterial;
  const emitterCoil = addMesh(
    MeshBuilder.CreateTorus(
      `${emitter.name}:coil`,
      { diameter: 0.7, thickness: 0.085, tessellation: 24 },
      scene,
    ),
    emitter,
    new Vector3(0, 0.46, 0),
  );
  emitterCoil.material = emitterMaterial;

  const setHardwareIds = (hardwareIds: readonly string[]) => {
    const held = new Set(hardwareIds);
    const hasChassis = held.has(WORLD_HARDWARE_IDS.boulevardPatrolDroneChassis);
    chassisCradle.root.setEnabled(!hasChassis);
    chassis.root.setEnabled(hasChassis);
    emitter.setEnabled(held.has(WORLD_HARDWARE_IDS.patrolDroneEmitter));
  };
  setHardwareIds(initialHardwareIds);

  return {
    setHardwareIds,
    dispose: () => {
      meshes.forEach((mesh) => mesh.dispose(false, false));
      chassis.dispose();
      emitter.dispose();
      chassisCradle.dispose();
      emitterCradle.dispose();
      cradleMaterial.dispose();
      emitterMaterial.dispose();
    },
  };
}

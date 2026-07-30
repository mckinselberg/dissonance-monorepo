import {
  Color3,
  FreeCamera,
  HemisphericLight,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  Vector3,
  type AbstractMesh,
  type Camera,
  type Scene,
} from '@babylonjs/core';
import type { ActiveMode, MovementSignals } from '../state/movement';
import type { TraversalController } from '../world/TraversalRig';
import type { WorldFeaturesSystem } from '../world/WorldFeaturesSystem';

const INTERIOR_ORIGIN = new Vector3(60_000, -1_000, 60_000);
const WORKBENCH_POSITION = INTERIOR_ORIGIN.add(new Vector3(0, 0, 22));
const EXIT_POSITION = INTERIOR_ORIGIN.add(new Vector3(0, 0, -4));

export interface WorkshopSession {
  isInterior(): boolean;
  isNearEntrance(): boolean;
  isNearExit(): boolean;
  enter(): void;
  exit(): void;
  update(): void;
  dispose(): void;
}

function makeMaterial(scene: Scene, name: string, color: Color3): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  material.specularColor = color.scale(0.08);
  return material;
}

export function createWorkshopSession(deps: {
  scene: Scene;
  canvas: HTMLCanvasElement;
  locationFeatures: WorldFeaturesSystem;
  controllers: Record<ActiveMode, TraversalController>;
  movement: MovementSignals;
  onEntered: () => void;
  onWorkbenchEntered: () => void;
}): WorkshopSession {
  const { scene, canvas, locationFeatures, controllers, movement, onEntered, onWorkbenchEntered } = deps;
  const root = new TransformNode('undergroundWorkshop', scene);
  root.position.copyFrom(INTERIOR_ORIGIN);
  root.setEnabled(false);
  const meshes: AbstractMesh[] = [];
  const concrete = makeMaterial(scene, 'workshopConcrete', new Color3(0.18, 0.2, 0.18));
  const steel = makeMaterial(scene, 'workshopSteel', new Color3(0.12, 0.15, 0.16));
  const task = makeMaterial(scene, 'workshopTask', new Color3(0.26, 0.42, 0.38));
  task.emissiveColor = new Color3(0.04, 0.13, 0.11);

  const box = (
    name: string,
    size: { width: number; height: number; depth: number },
    position: Vector3,
    material = concrete,
  ) => {
    const mesh = MeshBuilder.CreateBox(name, size, scene);
    mesh.position.copyFrom(position);
    mesh.material = material;
    mesh.parent = root;
    mesh.checkCollisions = true;
    meshes.push(mesh);
    return mesh;
  };

  // Zone 1: cramped threshold vestibule.
  box('workshopFloor', { width: 8, height: 0.25, depth: 34 }, new Vector3(0, -0.125, 10));
  box('workshopCeiling', { width: 8, height: 0.3, depth: 34 }, new Vector3(0, 3.8, 10));
  box('workshopLeftWall', { width: 0.35, height: 4, depth: 34 }, new Vector3(-4, 1.9, 10));
  box('workshopRightWall', { width: 0.35, height: 4, depth: 34 }, new Vector3(4, 1.9, 10));
  box('workshopRearWall', { width: 8, height: 4, depth: 0.35 }, new Vector3(0, 1.9, 27));
  box('workshopThresholdDoor', { width: 3, height: 3.2, depth: 0.35 }, new Vector3(2.3, 1.6, -7), steel);

  // Zone 2: a compressed service passage, cluttered enough to slow the read.
  for (let index = 0; index < 4; index++) {
    const side = index % 2 === 0 ? -1 : 1;
    box(
      `workshopServiceCabinet:${index}`,
      { width: 1.25, height: 2.1, depth: 1.1 },
      new Vector3(side * 3.05, 1.05, 5 + index * 3.1),
      steel,
    );
  }
  for (const z of [-2, 8, 17, 24]) {
    const strip = box(
      `workshopCeilingLight:${z}`,
      { width: 2.4, height: 0.08, depth: 0.28 },
      new Vector3(0, 3.57, z),
      task,
    );
    strip.checkCollisions = false;
  }

  // Zone 3: the emitter workbench and the first concrete story discovery.
  box('workshopBenchTop', { width: 5.4, height: 0.22, depth: 1.8 }, new Vector3(0, 1.05, 22), steel);
  box('workshopBenchLeft', { width: 0.35, height: 1, depth: 1.5 }, new Vector3(-2.25, 0.5, 22), steel);
  box('workshopBenchRight', { width: 0.35, height: 1, depth: 1.5 }, new Vector3(2.25, 0.5, 22), steel);
  const emitterCradle = MeshBuilder.CreateTorus(
    'workshopEmitterCradle',
    { diameter: 1.1, thickness: 0.13, tessellation: 24 },
    scene,
  );
  emitterCradle.position.set(0, 1.42, 22);
  emitterCradle.rotation.x = Math.PI / 2;
  emitterCradle.material = task;
  emitterCradle.parent = root;
  meshes.push(emitterCradle);

  const light = new HemisphericLight('workshopLight', new Vector3(0, 1, 0), scene);
  light.intensity = 0.55;
  light.diffuse = new Color3(0.55, 0.72, 0.66);
  light.parent = root;
  light.setEnabled(false);

  const camera = new FreeCamera('workshopFirstPersonCamera', EXIT_POSITION.add(new Vector3(0, 1.7, 0)), scene);
  camera.minZ = 0.05;
  camera.speed = 0.16;
  camera.angularSensibility = 2600;
  camera.keysUp = [87];
  camera.keysDown = [83];
  camera.keysLeft = [65];
  camera.keysRight = [68];
  camera.checkCollisions = true;
  camera.ellipsoid = new Vector3(0.4, 0.85, 0.4);

  let interior = false;
  let previousCamera: Camera | null = null;
  let previousFogEnabled = true;
  let discoveredThisVisit = false;

  const isNearEntrance = (): boolean => {
    const door = locationFeatures.falloutShelterDoor;
    if (!door || interior) return false;
    const position = controllers[movement.activeMode.value].getPosition();
    return Vector3.DistanceSquared(
      new Vector3(position.x, door.position.y, position.z),
      door.position,
    ) <= door.interactionRadius ** 2;
  };

  const isNearExit = (): boolean =>
    interior && Vector3.DistanceSquared(camera.position, EXIT_POSITION.add(new Vector3(0, 1.7, 0))) <= 9;

  const enter = () => {
    if (interior) return;
    interior = true;
    discoveredThisVisit = false;
    previousCamera = scene.activeCamera;
    previousFogEnabled = scene.fogEnabled;
    scene.fogEnabled = false;
    root.setEnabled(true);
    light.setEnabled(true);
    camera.position.copyFrom(EXIT_POSITION.add(new Vector3(0, 1.7, 0)));
    camera.rotation.copyFromFloats(0, 0, 0);
    scene.activeCamera = camera;
    camera.attachControl(canvas, true);
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    onEntered();
  };

  const exit = () => {
    if (!interior) return;
    camera.detachControl();
    root.setEnabled(false);
    light.setEnabled(false);
    scene.fogEnabled = previousFogEnabled;
    scene.activeCamera = previousCamera;
    interior = false;
  };

  return {
    isInterior: () => interior,
    isNearEntrance,
    isNearExit,
    enter,
    exit,
    update: () => {
      if (!interior || discoveredThisVisit) return;
      if (Vector3.DistanceSquared(camera.position, WORKBENCH_POSITION.add(new Vector3(0, 1.5, 0))) > 16) return;
      discoveredThisVisit = true;
      onWorkbenchEntered();
    },
    dispose: () => {
      exit();
      camera.dispose();
      light.dispose();
      meshes.forEach((mesh) => mesh.dispose(false, true));
      root.dispose();
    },
  };
}

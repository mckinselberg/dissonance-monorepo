import {
  FreeCamera,
  LoadAssetContainerAsync,
  Mesh,
  TransformNode,
  Vector3,
  type Camera,
  type Scene,
  type ShadowGenerator,
} from '@babylonjs/core';
import { ensureGltfLoader } from '../world/gltfLoader';
import type { RoadHandle } from '../world/RoadNetwork';
import type { VehicleTravelSnapshot } from './VehicleTravelState';

// Real asset (Dan, 2026-08-03): a 1970s Buick Riviera-style coupe, dropped in
// as the Synod road-service vehicle's visual per docs/intake/
// a9b3aad8-943f-4aa0-95a4-c1530a0a4afc.png's period target — "the resolution
// is aspirational," so this is the actual drivable mesh, not a stand-in for
// a future pass. See doc §1's suggested asset id below.
export const VEHICLE_ASSET_ID = 'vehicle.synodRoadServiceCoupeUtility';
const VEHICLE_MODEL_URL_SUFFIX = 'models/vehicles/Riviera Black.glb';
// Authored scale is unknown/arbitrary (whatever the source file used) — the
// loader measures its own native bounding box and derives a uniform scale
// from this real-world target length instead of a hardcoded magic number,
// so swapping in a different vehicle model later doesn't require retuning.
const TARGET_LENGTH_M = 5.0;
// Corrects whichever way the model's own front happens to face on import;
// 0 assumes native +Z forward, matching this app's heading convention
// (Math.atan2(dx, dz) — see world/polyline.ts). Flip to Math.PI (or ±PI/2)
// if the loaded model turns out to drive backwards/sideways.
const MODEL_HEADING_OFFSET_RADIANS = 0;

const ENTER_RANGE_M = 3;

async function loadVehicleModel(
  scene: Scene,
  shadowGenerator?: ShadowGenerator,
): Promise<{ root: TransformNode; halfWidthM: number; dispose(): void }> {
  await ensureGltfLoader();
  const url = `${import.meta.env.BASE_URL}${VEHICLE_MODEL_URL_SUFFIX}`;
  const container = await LoadAssetContainerAsync(url, scene);
  container.addAllToScene();

  const modelRoot = new TransformNode('vehicleModelRoot', scene);
  for (const node of container.rootNodes) node.parent = modelRoot;

  const nativeBounds = modelRoot.getHierarchyBoundingVectors(true);
  const nativeSizeX = nativeBounds.max.x - nativeBounds.min.x;
  const nativeSizeZ = nativeBounds.max.z - nativeBounds.min.z;
  const nativeLength = Math.max(nativeSizeX, nativeSizeZ);
  const scale = nativeLength > 0 ? TARGET_LENGTH_M / nativeLength : 1;
  modelRoot.scaling.setAll(scale);
  modelRoot.rotation.y = MODEL_HEADING_OFFSET_RADIANS;

  // Re-measure after scaling to ground the model's lowest point (wheels) at
  // its parent's local y = 0, i.e. the road surface — same "bake a measured
  // offset once" idiom CompositeLocations' couch loader uses.
  const scaledBounds = modelRoot.getHierarchyBoundingVectors(true);
  modelRoot.position.y = -scaledBounds.min.y;
  const halfWidthM = Math.min(
    scaledBounds.max.x - scaledBounds.min.x,
    scaledBounds.max.z - scaledBounds.min.z,
  ) / 2;

  const meshes = container.meshes.filter((mesh): mesh is Mesh => mesh instanceof Mesh);
  for (const mesh of meshes) {
    mesh.receiveShadows = true;
    shadowGenerator?.addShadowCaster(mesh, true);
  }

  const root = new TransformNode(VEHICLE_ASSET_ID, scene);
  modelRoot.parent = root;

  return {
    root,
    halfWidthM,
    dispose() {
      container.dispose();
      modelRoot.dispose();
      root.dispose();
    },
  };
}

export interface VehicleSessionDeps {
  scene: Scene;
  canvas: HTMLCanvasElement;
  road: RoadHandle;
  horizontalScale: number;
  shadowGenerator?: ShadowGenerator;
}

export interface VehicleSession {
  isNearVehicle(playerPosition: Vector3): boolean;
  isInVehicle(): boolean;
  enter(): void;
  exit(): void;
  getExitPosition(): Vector3;
  getPosition(): Vector3;
  update(dt: number, travel: VehicleTravelSnapshot): void;
  dispose(): void;
}

export async function createVehicleSession(deps: VehicleSessionDeps): Promise<VehicleSession> {
  const { scene, canvas, road, horizontalScale, shadowGenerator } = deps;
  const model = await loadVehicleModel(scene, shadowGenerator);

  // Roughly a seated driver's eye point: centered left/right for forward
  // visibility over the hood rather than an authored driver's seat.
  const cameraLocalOffset = new Vector3(0, 1.1, 0.2);
  // Placed just outside the passenger side on exit so the player doesn't
  // spawn inside the vehicle mesh.
  const exitLocalOffset = new Vector3(model.halfWidthM + 0.9, 0, 0);

  const camera = new FreeCamera('vehicleCabinCamera', Vector3.Zero(), scene);
  camera.minZ = 0.05;
  camera.inputs.clear(); // fully domain-driven — no independent WASD/mouselook this slice
  camera.parent = model.root;
  camera.position.copyFrom(cameraLocalOffset);
  camera.rotation.set(0, 0, 0);

  let inVehicle = false;
  let previousCamera: Camera | null = null;

  const worldPositionFor = (distanceMeters: number) => {
    const sample = road.positionAtDistance(distanceMeters);
    return { position: new Vector3(sample.x, sample.y, sample.z), headingRadians: sample.headingRadians };
  };

  // Start parked at the road's beginning until the first update() call.
  const initial = worldPositionFor(0);
  model.root.position.copyFrom(initial.position);
  model.root.rotation.y = initial.headingRadians;

  return {
    isNearVehicle(playerPosition: Vector3): boolean {
      if (inVehicle) return false;
      return Vector3.DistanceSquared(
        new Vector3(playerPosition.x, model.root.position.y, playerPosition.z),
        model.root.position,
      ) <= (ENTER_RANGE_M * horizontalScale) ** 2;
    },
    isInVehicle: () => inVehicle,
    enter() {
      if (inVehicle) return;
      inVehicle = true;
      previousCamera = scene.activeCamera;
      scene.activeCamera = camera;
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    },
    exit() {
      if (!inVehicle) return;
      inVehicle = false;
      scene.activeCamera = previousCamera;
    },
    getExitPosition(): Vector3 {
      return Vector3.TransformCoordinates(exitLocalOffset, model.root.getWorldMatrix());
    },
    getPosition(): Vector3 {
      return model.root.position.clone();
    },
    update(_dt: number, travel: VehicleTravelSnapshot) {
      const { position, headingRadians } = worldPositionFor(travel.distanceMeters);
      model.root.position.copyFrom(position);
      model.root.rotation.y = headingRadians;
    },
    dispose() {
      camera.dispose();
      model.dispose();
    },
  };
}

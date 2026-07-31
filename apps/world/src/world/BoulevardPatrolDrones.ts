import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  Vector3,
  type Mesh,
  type Scene,
  type ShadowGenerator,
} from '@babylonjs/core';
import type { LocationEntry } from './LocationProps';
import {
  BOULEVARD_PATROL_DRONE_BODY_RADIUS,
  createBoulevardPatrolDroneSilhouette,
  type BoulevardPatrolDroneSilhouetteHandle,
} from './BoulevardPatrolDroneSilhouette';

const DEFAULT_SPEED_METERS_PER_SECOND = 3.2;
const DEFAULT_ALTITUDE_METERS = 4.2;
const READ_CONE_RADIUS = 7;
const READ_CONE_ARC = 0.19;

export type PatrolDroneState = 'patrolling' | 'inert';

export interface PatrolDroneSnapshot {
  id: string;
  state: PatrolDroneState;
  position: Vector3;
}

class BoulevardPatrolDrone {
  private readonly silhouette: BoulevardPatrolDroneSilhouetteHandle;
  private readonly readCone: Mesh;
  private readonly route: Vector3[];
  private segmentIndex = 0;
  private segmentProgress = 0;
  private state: PatrolDroneState = 'patrolling';
  private inertElapsed = 0;
  private inertSettleSeconds = 1.25;
  private groundY = 0;
  private recovered = false;

  constructor(
    private readonly id: string,
    scene: Scene,
    route: Vector3[],
    private readonly speed: number,
    private readonly altitude: number,
    shadowGenerator?: ShadowGenerator,
  ) {
    this.route = route;
    this.silhouette = createBoulevardPatrolDroneSilhouette(scene, id, { shadowGenerator });
    this.silhouette.root.position.copyFrom(route[0]);

    const coneMaterial = new StandardMaterial(`patrolDroneReadCone:${id}`, scene);
    coneMaterial.diffuseColor = new Color3(0.08, 0.72, 0.86);
    coneMaterial.emissiveColor = new Color3(0.04, 0.34, 0.42);
    coneMaterial.alpha = 0.18;
    coneMaterial.backFaceCulling = false;
    this.readCone = MeshBuilder.CreateDisc(
      `patrolDroneReadCone:${id}`,
      { radius: READ_CONE_RADIUS, tessellation: 28, arc: READ_CONE_ARC },
      scene,
    );
    this.readCone.rotation.x = Math.PI / 2;
    this.readCone.material = coneMaterial;
    this.readCone.isPickable = false;

  }

  update(dt: number, getHeightAt: (x: number, z: number) => number): void {
    if (this.recovered) return;
    const root = this.silhouette.root;
    this.groundY = getHeightAt(root.position.x, root.position.z);
    if (this.state === 'inert') {
      this.inertElapsed = Math.min(this.inertSettleSeconds, this.inertElapsed + Math.max(0, dt));
      const t = this.inertElapsed / this.inertSettleSeconds;
      root.position.y = this.groundY + this.altitude * (1 - t) + BOULEVARD_PATROL_DRONE_BODY_RADIUS * t;
      root.rotation.z = t * 1.15;
      const gutter = Math.max(0, 1 - t) * (0.45 + Math.sin(this.inertElapsed * 31) * 0.35);
      this.silhouette.eyeMaterial.emissiveColor.set(0.12 * gutter, 0.9 * gutter, gutter);
      return;
    }

    const from = this.route[this.segmentIndex];
    const to = this.route[(this.segmentIndex + 1) % this.route.length];
    const segmentLength = Vector3.Distance(from, to);
    this.segmentProgress += segmentLength > 0 ? Math.max(0, dt) * this.speed / segmentLength : 1;
    while (this.segmentProgress >= 1) {
      this.segmentProgress -= 1;
      this.segmentIndex = (this.segmentIndex + 1) % this.route.length;
    }
    const currentFrom = this.route[this.segmentIndex];
    const currentTo = this.route[(this.segmentIndex + 1) % this.route.length];
    Vector3.LerpToRef(currentFrom, currentTo, this.segmentProgress, root.position);
    this.groundY = getHeightAt(root.position.x, root.position.z);
    root.position.y = this.groundY + this.altitude;
    root.rotation.y = Math.atan2(
      currentTo.x - currentFrom.x,
      currentTo.z - currentFrom.z,
    );
    this.readCone.position.set(root.position.x, this.groundY + 0.04, root.position.z);
    this.readCone.rotation.y = root.rotation.y - Math.PI * READ_CONE_ARC;
  }

  setInert(position: Vector3, settleSeconds: number): void {
    if (this.state === 'inert') return;
    this.silhouette.root.position.copyFrom(position);
    this.state = 'inert';
    this.inertElapsed = 0;
    this.inertSettleSeconds = Math.max(0.01, settleSeconds);
    this.silhouette.setPresentation('inert-scorched');
    this.readCone.setEnabled(false);
  }

  setRecovered(recovered: boolean): void {
    this.recovered = recovered;
    this.silhouette.root.setEnabled(!recovered);
    this.readCone.setEnabled(!recovered && this.state === 'patrolling');
  }

  snapshot(): PatrolDroneSnapshot {
    const position = this.silhouette.root.position.clone();
    return {
      id: this.id,
      state: this.state,
      position,
    };
  }

  dispose(): void {
    this.silhouette.dispose();
    this.readCone.dispose(false, true);
  }
}

export interface BoulevardPatrolDronesHandle {
  update(dt: number): void;
  get(id: string): PatrolDroneSnapshot | null;
  setInert(id: string, position: Vector3, settleSeconds: number): boolean;
  setRecovered(id: string, recovered: boolean): boolean;
  dispose(): void;
}

export function loadBoulevardPatrolDrones(
  scene: Scene,
  locations: LocationEntry[],
  toRenderXZ: (lat: number, lon: number) => { x: number; z: number },
  horizontalScale: number,
  getHeightAt: (x: number, z: number) => number,
  shadowGenerator?: ShadowGenerator,
): BoulevardPatrolDronesHandle {
  const drones = new Map<string, BoulevardPatrolDrone>();
  for (const location of locations) {
    if (!location.patrolDrones) continue;
    const anchor = toRenderXZ(location.latLong[0], location.latLong[1]);
    for (const definition of location.patrolDrones) {
      if (drones.has(definition.id)) {
        throw new Error(`Duplicate patrol drone id "${definition.id}".`);
      }
      if (definition.route.length < 2) {
        throw new Error(`Patrol drone "${definition.id}" needs at least two route points.`);
      }
      const route = definition.route.map(([localX, localZ]) =>
        new Vector3(
          anchor.x + localX * horizontalScale,
          0,
          anchor.z + localZ * horizontalScale,
        ));
      const drone = new BoulevardPatrolDrone(
        definition.id,
        scene,
        route,
        (definition.speedMetersPerSecond ?? DEFAULT_SPEED_METERS_PER_SECOND) * horizontalScale,
        (definition.altitudeMeters ?? DEFAULT_ALTITUDE_METERS),
        shadowGenerator,
      );
      drones.set(definition.id, drone);
    }
  }

  return {
    update(dt) {
      drones.forEach((drone) => drone.update(dt, getHeightAt));
    },
    get(id) {
      return drones.get(id)?.snapshot() ?? null;
    },
    setInert(id, position, settleSeconds) {
      const drone = drones.get(id);
      if (!drone) return false;
      drone.setInert(position, settleSeconds);
      return true;
    },
    setRecovered(id, recovered) {
      const drone = drones.get(id);
      if (!drone) return false;
      drone.setRecovered(recovered);
      return true;
    },
    dispose() {
      drones.forEach((drone) => drone.dispose());
      drones.clear();
    },
  };
}

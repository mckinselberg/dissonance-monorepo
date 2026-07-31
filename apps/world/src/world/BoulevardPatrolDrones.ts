import {
  Color3,
  MeshBuilder,
  PBRMaterial,
  StandardMaterial,
  TransformNode,
  Vector3,
  type AbstractMesh,
  type Mesh,
  type Scene,
  type ShadowGenerator,
} from '@babylonjs/core';
import type { LocationEntry } from './LocationProps';

const DEFAULT_SPEED_METERS_PER_SECOND = 3.2;
const DEFAULT_ALTITUDE_METERS = 4.2;
const BODY_RADIUS = 0.62;
const READ_CONE_RADIUS = 7;
const READ_CONE_ARC = 0.19;
const INERT_SETTLE_SECONDS = 1.25;

export type PatrolDroneState = 'patrolling' | 'inert';

export interface PatrolDroneSnapshot {
  id: string;
  state: PatrolDroneState;
  position: Vector3;
  losProbePoint: Vector3;
}

class BoulevardPatrolDrone {
  private readonly root: TransformNode;
  private readonly bodyMaterial: PBRMaterial;
  private readonly eyeMaterial: PBRMaterial;
  private readonly readCone: Mesh;
  private readonly route: Vector3[];
  private segmentIndex = 0;
  private segmentProgress = 0;
  private state: PatrolDroneState = 'patrolling';
  private inertElapsed = 0;
  private groundY = 0;

  constructor(
    private readonly id: string,
    scene: Scene,
    route: Vector3[],
    private readonly speed: number,
    private readonly altitude: number,
    shadowGenerator?: ShadowGenerator,
  ) {
    this.route = route;
    this.root = new TransformNode(`patrolDrone:${id}`, scene);
    this.root.position.copyFrom(route[0]);

    this.bodyMaterial = new PBRMaterial(`patrolDroneBody:${id}`, scene);
    this.bodyMaterial.albedoColor = new Color3(0.065, 0.075, 0.08);
    this.bodyMaterial.metallic = 0.85;
    this.bodyMaterial.roughness = 0.26;
    const body = MeshBuilder.CreateSphere(
      `patrolDroneBody:${id}`,
      { diameter: BODY_RADIUS * 2, segments: 12 },
      scene,
    );
    body.scaling.set(1.25, 0.52, 0.85);
    body.material = this.bodyMaterial;
    body.parent = this.root;

    const ring = MeshBuilder.CreateTorus(
      `patrolDroneRing:${id}`,
      { diameter: BODY_RADIUS * 1.8, thickness: 0.08, tessellation: 20 },
      scene,
    );
    ring.rotation.x = Math.PI / 2;
    ring.material = this.bodyMaterial;
    ring.parent = this.root;

    this.eyeMaterial = new PBRMaterial(`patrolDroneEye:${id}`, scene);
    this.eyeMaterial.albedoColor = new Color3(0.03, 0.1, 0.12);
    this.eyeMaterial.emissiveColor = new Color3(0.12, 0.9, 1);
    this.eyeMaterial.metallic = 0.3;
    this.eyeMaterial.roughness = 0.25;
    for (const side of [-1, 1]) {
      const eye = MeshBuilder.CreateSphere(
        `patrolDroneEye:${id}:${side}`,
        { diameter: 0.16, segments: 8 },
        scene,
      );
      eye.position.set(side * 0.3, -0.04, BODY_RADIUS * 0.72);
      eye.material = this.eyeMaterial;
      eye.parent = this.root;
    }

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

    for (const mesh of [body, ring]) {
      mesh.receiveShadows = true;
      shadowGenerator?.addShadowCaster(mesh);
    }
  }

  update(dt: number, getHeightAt: (x: number, z: number) => number): void {
    this.groundY = getHeightAt(this.root.position.x, this.root.position.z);
    if (this.state === 'inert') {
      this.inertElapsed = Math.min(INERT_SETTLE_SECONDS, this.inertElapsed + Math.max(0, dt));
      const t = this.inertElapsed / INERT_SETTLE_SECONDS;
      this.root.position.y = this.groundY + this.altitude * (1 - t) + BODY_RADIUS * t;
      this.root.rotation.z = t * 1.15;
      const gutter = Math.max(0, 1 - t) * (0.45 + Math.sin(this.inertElapsed * 31) * 0.35);
      this.eyeMaterial.emissiveColor.set(0.12 * gutter, 0.9 * gutter, gutter);
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
    Vector3.LerpToRef(currentFrom, currentTo, this.segmentProgress, this.root.position);
    this.groundY = getHeightAt(this.root.position.x, this.root.position.z);
    this.root.position.y = this.groundY + this.altitude;
    this.root.rotation.y = Math.atan2(
      currentTo.x - currentFrom.x,
      currentTo.z - currentFrom.z,
    );
    this.readCone.position.set(this.root.position.x, this.groundY + 0.04, this.root.position.z);
    this.readCone.rotation.y = this.root.rotation.y - Math.PI * READ_CONE_ARC;
  }

  setInert(): void {
    if (this.state === 'inert') return;
    this.state = 'inert';
    this.inertElapsed = 0;
    this.readCone.setEnabled(false);
  }

  snapshot(): PatrolDroneSnapshot {
    const position = this.root.position.clone();
    return {
      id: this.id,
      state: this.state,
      position,
      losProbePoint: position.add(new Vector3(0, 0.15, 0)),
    };
  }

  dispose(): void {
    const childMeshes = this.root.getChildMeshes(false) as AbstractMesh[];
    childMeshes.forEach((mesh) => mesh.dispose(false, true));
    this.root.dispose();
    this.readCone.dispose(false, true);
  }
}

export interface BoulevardPatrolDronesHandle {
  update(dt: number): void;
  get(id: string): PatrolDroneSnapshot | null;
  setInert(id: string): boolean;
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
    setInert(id) {
      const drone = drones.get(id);
      if (!drone) return false;
      drone.setInert();
      return true;
    },
    dispose() {
      drones.forEach((drone) => drone.dispose());
      drones.clear();
    },
  };
}

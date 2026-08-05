import type { Scene, ShadowGenerator } from '@babylonjs/core';
import { PursuerSystem, type PursuerConfig } from '@dissonance/pursuit';
import type { Collider } from '@dissonance/world';
import type { LocationEntry } from '../world/LocationProps';
import type { RoadHandle } from '../world/RoadNetwork';
import { MechDogBody } from './MechDogBody';

// T28's highway consequence (docs/design/world/RURAL-INFRASTRUCTURE.md) — a
// hostile patroller dispatched to a specific road, seeded from that road's
// own `patrol` data (LocationProps.ts). Distinct from MechDogController's
// single always-near-the-player companion dog, which this leaves untouched:
// no camera/sightline spawn logic (position is always road- or pursuit-
// derived, never player-relative at spawn), always the 'default' (menacing)
// skin, never the shared companion skin signal.
const ROAD_PATROL_DOG_CONFIG: PursuerConfig = {
  startDistance: 20,
  baseSpeed: 3.2,
  maxSpeed: 8.5,
  catchRadius: 0.5,
  nearThreshold: 24,
  closeThreshold: 10,
  sprintAggressionGain: 0.02,
  stillAggressionLoss: 0.006,
  aggressionDecayRate: 0.002,
  stunMin: 0.8,
  stunRange: 0.4,
  orbitStrength: 0.2,
  reengageDelay: 1,
};

const DEFAULT_PATROL_SPEED_MPS = 2.2;
const DEFAULT_DETECTION_RADIUS_M = 25;
// Player must be outside detectionRadius by this extra margin, continuously
// for RELEASE_COOLDOWN_SECONDS, before the dog gives up and resumes patrol —
// a plain "distance < radius" flip-flops right at the boundary.
const RELEASE_MARGIN_M = 10;
const RELEASE_COOLDOWN_SECONDS = 4;
// Same order as MechDogController's own MECH_DOG_COLLISION_RADIUS — a rough
// body-footprint circle, not a tight hitbox.
const PATROL_DOG_COLLISION_RADIUS = 0.35;

type PatrolDogState = 'patrolling' | 'pursuing';

class RoadPatrolDogInstance {
  private readonly body: MechDogBody;
  private readonly pursuit: PursuerSystem;
  private readonly position: { x: number; z: number };
  private state: PatrolDogState = 'patrolling';
  private patrolDistanceMeters = 0;
  private patrolDirection: 1 | -1 = 1;
  private releaseTimer = 0;
  private lastPlayerX: number | null = null;
  private lastPlayerZ: number | null = null;
  // 0..1 — 0 while patrolling (undetected), rising toward 1 as the dog
  // closes in while pursuing. Drives the T28 threat vignette (main.tsx);
  // see heartbeatVignette.ts for why this reads as real dread while the
  // companion dog's own threat signal stays deliberately faint.
  private threatLevel = 0;

  constructor(
    scene: Scene,
    shadowGenerator: ShadowGenerator | undefined,
    private readonly road: RoadHandle,
    private readonly patrolSpeedMps: number,
    private readonly detectionRadiusMeters: number,
  ) {
    this.body = new MechDogBody(scene, shadowGenerator, 'default');
    this.pursuit = new PursuerSystem(ROAD_PATROL_DOG_CONFIG, ROAD_PATROL_DOG_CONFIG.startDistance);
    const start = road.positionAtDistance(0);
    this.position = { x: start.x, z: start.z };
  }

  update(
    dt: number,
    playerPosition: { x: number; z: number },
    playerIsCrouching: boolean,
    getHeightAt: (x: number, z: number) => number,
  ): void {
    const distanceToPlayer = Math.hypot(playerPosition.x - this.position.x, playerPosition.z - this.position.z);

    if (this.state === 'patrolling') {
      if (distanceToPlayer <= this.detectionRadiusMeters) {
        this.state = 'pursuing';
        this.releaseTimer = 0;
        this.pursuit.reset(distanceToPlayer);
      } else {
        this.patrolDistanceMeters += this.patrolDirection * this.patrolSpeedMps * dt;
        if (this.patrolDistanceMeters >= this.road.totalLengthMeters) {
          this.patrolDistanceMeters = this.road.totalLengthMeters;
          this.patrolDirection = -1;
        } else if (this.patrolDistanceMeters <= 0) {
          this.patrolDistanceMeters = 0;
          this.patrolDirection = 1;
        }
        const sample = this.road.positionAtDistance(this.patrolDistanceMeters);
        this.position.x = sample.x;
        this.position.z = sample.z;
      }
    } else {
      const playerDx = this.lastPlayerX === null ? 0 : playerPosition.x - this.lastPlayerX;
      const playerDz = this.lastPlayerZ === null ? 0 : playerPosition.z - this.lastPlayerZ;
      const playerSpeed = dt > 0 ? Math.hypot(playerDx, playerDz) / dt : 0;
      // Deliberately not acting on model.state === 'caught' — same choice
      // MechDogController already made (see its own comment): a readable
      // standoff/chase is the consequence, not a catch/fail state (D2).
      this.pursuit.update(dt, playerSpeed, playerPosition, this.position, true, playerIsCrouching);

      if (distanceToPlayer > this.detectionRadiusMeters + RELEASE_MARGIN_M) {
        this.releaseTimer += dt;
        if (this.releaseTimer >= RELEASE_COOLDOWN_SECONDS) {
          this.state = 'patrolling';
          const nearest = this.road.nearestPointOnRoad(this.position.x, this.position.z);
          this.patrolDistanceMeters = nearest.distanceAlongMeters;
        }
      } else {
        this.releaseTimer = 0;
      }
    }
    this.lastPlayerX = playerPosition.x;
    this.lastPlayerZ = playerPosition.z;

    // Recomputed post-movement so it reflects this frame's actual position,
    // not the pre-update distance used for the state-transition check above.
    const currentDistanceToPlayer = Math.hypot(
      playerPosition.x - this.position.x,
      playerPosition.z - this.position.z,
    );
    const detectionSpan = Math.max(1, this.detectionRadiusMeters - ROAD_PATROL_DOG_CONFIG.catchRadius);
    this.threatLevel = this.state === 'pursuing'
      ? Math.max(0, Math.min(1, 1 - (currentDistanceToPlayer - ROAD_PATROL_DOG_CONFIG.catchRadius) / detectionSpan))
      : 0;

    const groundY = getHeightAt(this.position.x, this.position.z);
    this.body.update(dt, this.position, groundY);
  }

  getCollider(): Collider {
    return { x: this.position.x, z: this.position.z, radius: PATROL_DOG_COLLISION_RADIUS };
  }

  getThreatLevel(): number {
    return this.threatLevel;
  }

  dispose(): void {
    this.body.dispose();
  }
}

export interface RoadPatrolDogsHandle {
  update(
    dt: number,
    playerPosition: { x: number; z: number },
    playerIsCrouching: boolean,
    getHeightAt: (x: number, z: number) => number,
  ): void;
  getColliders(): Collider[];
  // Highest threatLevel across every dispatched dog — see
  // RoadPatrolDogInstance.getThreatLevel and heartbeatVignette.ts.
  getMaxThreatLevel(): number;
  dispose(): void;
}

// Reads locations.json entries' road.patrol field and dispatches one
// RoadPatrolDogInstance per tagged road, resolving each against the
// already-constructed RoadNetworkHandle (WorldFeaturesSystem.getRoad) —
// no independent path/polyline resolution here.
export function loadRoadPatrolDogs(
  scene: Scene,
  locations: LocationEntry[],
  getRoad: (locationId: string) => RoadHandle | null,
  shadowGenerator: ShadowGenerator | undefined,
): RoadPatrolDogsHandle {
  const dogs: RoadPatrolDogInstance[] = [];
  for (const location of locations) {
    const patrol = location.road?.patrol;
    if (!patrol) continue;
    const road = getRoad(location.id);
    if (!road) {
      console.warn(`[RoadPatrolDog] "${location.id}" has road.patrol but no resolved road — skipping`);
      continue;
    }
    dogs.push(new RoadPatrolDogInstance(
      scene,
      shadowGenerator,
      road,
      patrol.speedMetersPerSecond ?? DEFAULT_PATROL_SPEED_MPS,
      patrol.detectionRadiusMeters ?? DEFAULT_DETECTION_RADIUS_M,
    ));
  }

  return {
    update(dt, playerPosition, playerIsCrouching, getHeightAt) {
      dogs.forEach((dog) => dog.update(dt, playerPosition, playerIsCrouching, getHeightAt));
    },
    getColliders() {
      return dogs.map((dog) => dog.getCollider());
    },
    getMaxThreatLevel() {
      return dogs.reduce((max, dog) => Math.max(max, dog.getThreatLevel()), 0);
    },
    dispose() {
      dogs.forEach((dog) => dog.dispose());
    },
  };
}

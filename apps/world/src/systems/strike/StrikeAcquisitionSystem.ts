import { Ray, Vector3, type Scene } from '@babylonjs/core';
import type { WeatherSystem } from '@dissonance/world';
import type { LocationEntry } from '../../world/LocationProps';
import type { PatrolDroneSnapshot } from '../../world/BoulevardPatrolDrones';
import { DroneRecovery, type RecoveryFlags } from './DroneRecovery';
import {
  buildStrikeAnchors,
  selectStrikeAnchor,
  type StrikeAnchor,
} from './StrikeAnchorSelector';
import { StrikeGate, type StrikeGateState } from './StrikeGate';
import type { StrikeProfile } from './strikeProfile';

export interface StrikeDroneAccess {
  get(id: string): PatrolDroneSnapshot | null;
  setInert(id: string, position: Vector3, settleSeconds: number): boolean;
}

export interface StrikePresentation {
  flash(intensity: number, durationSeconds: number): void;
  clap(gain: number, delaySeconds: number): void;
}

export interface StrikeAcquisitionSnapshot {
  state: StrikeGateState;
  anchorId: string;
  droneId: string;
  windupProgress: number;
  recoveryAvailable: boolean;
  flags: RecoveryFlags;
  hasLineOfSight: boolean;
  distanceToAnchor: number;
  droneDistanceToAnchor: number;
  rainIntensity: number;
  blockingReason: string;
}

export class StrikeAcquisitionSystem {
  private readonly gate: StrikeGate;
  private readonly recovery: DroneRecovery;
  private recoveryAvailable = false;
  private hasCurrentLineOfSight = false;
  private currentDistanceToAnchor = Infinity;
  private currentDroneDistanceToAnchor = Infinity;

  constructor(
    private readonly scene: Scene,
    locations: LocationEntry[],
    toRenderXZ: (lat: number, lon: number) => { x: number; z: number },
    horizontalScale: number,
    getHeightAt: (x: number, z: number) => number,
    runSeed: number,
    private readonly profile: StrikeProfile,
    private readonly weather: WeatherSystem,
    private readonly drones: StrikeDroneAccess,
    private readonly presentation: StrikePresentation,
    restored?: {
      anchorId?: string | null;
      windupSeconds?: number | null;
      recoverablePosition?: { x: number; y: number; z: number } | null;
    },
  ) {
    this.recovery = new DroneRecovery(profile);
    const anchors = buildStrikeAnchors(
      locations,
      toRenderXZ,
      horizontalScale,
      getHeightAt,
    );
    const anchor = selectStrikeAnchor(anchors, runSeed, restored?.anchorId ?? undefined);
    this.gate = new StrikeGate(anchor, runSeed, {
      requestStorm: () => this.weather.requestPrecipitation('storm', 1),
      forceStormThreshold: () =>
        this.weather.setPrecipitationImmediate(
          'storm',
          profile.strikeRainThreshold,
        ),
    }, profile, restored?.windupSeconds ?? undefined);
    if (restored?.recoverablePosition) {
      this.recovery.markRecoverable(new Vector3(
        restored.recoverablePosition.x,
        restored.recoverablePosition.y,
        restored.recoverablePosition.z,
      ));
    }
  }

  update(dt: number, playerPosition: Vector3): void {
    const drone = this.drones.get(this.gate.anchor.patrolDroneRef);
    if (!drone) return;
    if (this.gate.getState() === 'SPENT' && drone.state !== 'inert') {
      this.drones.setInert(
        this.gate.anchor.patrolDroneRef,
        this.recovery.getRecoverablePosition() ?? drone.position,
        this.profile.droneInertSettleSeconds,
      );
    }
    const hasLineOfSight = this.hasLineOfSight(playerPosition, drone);
    const distanceToAnchor = Vector3.Distance(playerPosition, this.gate.anchor.position);
    const droneDistanceToAnchor = Math.hypot(
      drone.position.x - this.gate.anchor.position.x,
      drone.position.z - this.gate.anchor.position.z,
    );
    this.hasCurrentLineOfSight = hasLineOfSight;
    this.currentDistanceToAnchor = distanceToAnchor;
    this.currentDroneDistanceToAnchor = droneDistanceToAnchor;
    const state = this.gate.update(dt, {
      hasLineOfSight,
      distanceToAnchor,
      droneDistanceToAnchor,
      rainIntensity: this.weather.getRainIntensity(),
    });
    if (state !== 'FIRING') {
      this.recoveryAvailable = this.recovery.isAvailable(playerPosition);
      return;
    }

    this.presentation.flash(
      this.profile.flashIntensity,
      this.profile.flashDurationSeconds,
    );
    this.presentation.clap(1, this.profile.clapDelayFromFlashSeconds);
    if (!this.drones.setInert(
      this.gate.anchor.patrolDroneRef,
      drone.position,
      this.profile.droneInertSettleSeconds,
    )) {
      console.error(`[Strike] could not set drone "${this.gate.anchor.patrolDroneRef}" inert.`);
      return;
    }
    this.recovery.markRecoverable(drone.position);
    this.gate.markSpent();
    this.recoveryAvailable = this.recovery.isAvailable(playerPosition);
  }

  restoreProgress(flags: {
    droneStrikeWitnessed: boolean;
    emitterAcquired: boolean;
    chassisRecovered: boolean;
  }): void {
    if (!flags.droneStrikeWitnessed) return;
    const drone = this.drones.get(this.gate.anchor.patrolDroneRef);
    if (!drone) return;
    const recoverablePosition = this.recovery.getRecoverablePosition() ?? drone.position;
    this.drones.setInert(
      this.gate.anchor.patrolDroneRef,
      recoverablePosition,
      this.profile.droneInertSettleSeconds,
    );
    this.gate.restoreSpent();
    this.recovery.restore(
      {
        emitterAcquired: flags.emitterAcquired,
        chassisRecovered: flags.chassisRecovered,
      },
      flags.chassisRecovered ? null : recoverablePosition,
    );
  }

  recover(playerPosition: Vector3): RecoveryFlags | null {
    if (!this.recovery.isAvailable(playerPosition)) return null;
    const flags = this.recovery.recover();
    this.recoveryAvailable = false;
    return flags;
  }

  getSelectedAnchor(): StrikeAnchor {
    return this.gate.anchor;
  }

  snapshot(): StrikeAcquisitionSnapshot {
    const state = this.gate.getState();
    let blockingReason = 'complete';
    if (state === 'DORMANT') {
      if (this.currentDistanceToAnchor > this.profile.losRange) blockingReason = 'Milo outside anchor range';
      else if (!this.hasCurrentLineOfSight) blockingReason = 'drone not in line of sight';
      else if (this.currentDroneDistanceToAnchor > this.profile.strikeAnchorCaptureRange) {
        blockingReason = 'waiting for drone at anchor';
      } else blockingReason = 'ready to arm';
    } else if (state === 'ARMED') {
      if (this.weather.getRainIntensity() < this.profile.strikeRainThreshold) {
        blockingReason = 'building rain';
      } else if (this.gate.getWindupProgress() < 1) {
        blockingReason = 'seeded windup';
      } else if (!this.hasCurrentLineOfSight) {
        blockingReason = 'holding for witnessed LOS';
      } else if (this.currentDroneDistanceToAnchor > this.profile.strikeAnchorCaptureRange) {
        blockingReason = 'holding for drone return';
      } else blockingReason = 'ready to fire';
    } else if (state === 'FIRING') {
      blockingReason = 'firing';
    }
    return {
      state,
      anchorId: this.gate.anchor.id,
      droneId: this.gate.anchor.patrolDroneRef,
      windupProgress: this.gate.getWindupProgress(),
      recoveryAvailable: this.recoveryAvailable,
      flags: this.recovery.getFlags(),
      hasLineOfSight: this.hasCurrentLineOfSight,
      distanceToAnchor: this.currentDistanceToAnchor,
      droneDistanceToAnchor: this.currentDroneDistanceToAnchor,
      rainIntensity: this.weather.getRainIntensity(),
      blockingReason,
    };
  }

  persistenceSnapshot() {
    const recoverable = this.recovery.getRecoverablePosition();
    return {
      anchorId: this.gate.anchor.id,
      windupSeconds: this.gate.windupSeconds,
      recoverablePosition: recoverable
        ? { x: recoverable.x, y: recoverable.y, z: recoverable.z }
        : null,
    };
  }

  private hasLineOfSight(playerPosition: Vector3, drone: PatrolDroneSnapshot): boolean {
    const probePoint = drone.position.add(this.gate.anchor.losProbeOffset);
    const toDrone = probePoint.subtract(playerPosition);
    const distance = toDrone.length();
    if (distance <= 0.001 || distance > this.profile.losRange) return false;
    const ray = new Ray(playerPosition, toDrone.scale(1 / distance), distance);
    const hit = this.scene.pickWithRay(
      ray,
      (mesh) =>
        mesh.isEnabled() &&
        mesh.isVisible &&
        mesh.isPickable &&
        !mesh.name.startsWith('weather'),
    );
    return !hit?.hit || hit.pickedMesh?.name.startsWith('patrolDrone') === true;
  }
}

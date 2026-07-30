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
import { STRIKE_CONSTANTS } from './strikeConstants';

export interface StrikeDroneAccess {
  get(id: string): PatrolDroneSnapshot | null;
  setInert(id: string): boolean;
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
  workshopDiscovered: boolean;
  recoveryAvailable: boolean;
  flags: RecoveryFlags;
}

export class StrikeAcquisitionSystem {
  private readonly gate: StrikeGate;
  private readonly recovery = new DroneRecovery();
  private workshopDiscovered = false;
  private recoveryAvailable = false;

  constructor(
    private readonly scene: Scene,
    locations: LocationEntry[],
    toRenderXZ: (lat: number, lon: number) => { x: number; z: number },
    horizontalScale: number,
    getHeightAt: (x: number, z: number) => number,
    runSeed: number,
    private readonly weather: WeatherSystem,
    private readonly drones: StrikeDroneAccess,
    private readonly presentation: StrikePresentation,
  ) {
    const anchors = buildStrikeAnchors(
      locations,
      toRenderXZ,
      horizontalScale,
      getHeightAt,
    );
    const anchor = selectStrikeAnchor(anchors, runSeed);
    this.gate = new StrikeGate(anchor, runSeed, {
      requestStorm: () => this.weather.requestPrecipitation('storm', 1),
      forceStormThreshold: () =>
        this.weather.setPrecipitationImmediate(
          'storm',
          STRIKE_CONSTANTS.strikeRainThreshold,
        ),
    });
  }

  update(dt: number, playerPosition: Vector3): void {
    const drone = this.drones.get(this.gate.anchor.patrolDroneRef);
    if (!drone) return;
    const hasLineOfSight = this.hasLineOfSight(playerPosition, drone);
    const state = this.gate.update(dt, {
      workshopDiscovered: this.workshopDiscovered,
      hasLineOfSight,
      distanceToAnchor: Vector3.Distance(playerPosition, this.gate.anchor.position),
      droneDistanceToAnchor: Vector3.Distance(drone.position, this.gate.anchor.position),
      rainIntensity: this.weather.getRainIntensity(),
    });
    if (state !== 'FIRING') {
      this.recoveryAvailable = this.recovery.isAvailable(playerPosition);
      return;
    }

    this.presentation.flash(
      STRIKE_CONSTANTS.flashIntensity,
      STRIKE_CONSTANTS.flashDurationSeconds,
    );
    this.presentation.clap(1, STRIKE_CONSTANTS.clapDelayFromFlashSeconds);
    if (!this.drones.setInert(this.gate.anchor.patrolDroneRef)) {
      console.error(`[Strike] could not set drone "${this.gate.anchor.patrolDroneRef}" inert.`);
      return;
    }
    this.recovery.markRecoverable(drone.position);
    this.gate.markSpent();
    this.recoveryAvailable = this.recovery.isAvailable(playerPosition);
  }

  setWorkshopDiscovered(discovered: boolean): void {
    this.workshopDiscovered = discovered;
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
    return {
      state: this.gate.getState(),
      anchorId: this.gate.anchor.id,
      droneId: this.gate.anchor.patrolDroneRef,
      windupProgress: this.gate.getWindupProgress(),
      workshopDiscovered: this.workshopDiscovered,
      recoveryAvailable: this.recoveryAvailable,
      flags: this.recovery.getFlags(),
    };
  }

  private hasLineOfSight(playerPosition: Vector3, drone: PatrolDroneSnapshot): boolean {
    const toDrone = drone.losProbePoint.subtract(playerPosition);
    const distance = toDrone.length();
    if (distance <= 0.001 || distance > STRIKE_CONSTANTS.losRange) return false;
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

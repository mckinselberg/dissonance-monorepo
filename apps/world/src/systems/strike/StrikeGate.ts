import type { StrikeAnchor } from './StrikeAnchorSelector';
import { seededUnit } from './StrikeAnchorSelector';
import { STRIKE_CONSTANTS } from './strikeConstants';

export type StrikeGateState = 'DORMANT' | 'ARMED' | 'FIRING' | 'SPENT';

export interface StrikeGateInputs {
  workshopDiscovered: boolean;
  hasLineOfSight: boolean;
  distanceToAnchor: number;
  droneDistanceToAnchor: number;
  rainIntensity: number;
}

export interface StrikeGateActions {
  requestStorm(): void;
  forceStormThreshold(): void;
}

export class StrikeGate {
  private state: StrikeGateState = 'DORMANT';
  private rainWaitSeconds = 0;
  private windupElapsedSeconds = 0;
  private windupStarted = false;
  readonly windupSeconds: number;

  constructor(
    readonly anchor: StrikeAnchor,
    runSeed: number,
    private readonly actions: StrikeGateActions,
  ) {
    this.windupSeconds =
      STRIKE_CONSTANTS.strikeWindupMinSeconds +
      seededUnit(runSeed, `strike-windup:${anchor.id}`) *
        (STRIKE_CONSTANTS.strikeWindupMaxSeconds - STRIKE_CONSTANTS.strikeWindupMinSeconds);
  }

  update(dt: number, inputs: StrikeGateInputs): StrikeGateState {
    const delta = Math.max(0, dt);
    if (this.state === 'DORMANT') {
      if (
        inputs.workshopDiscovered &&
        inputs.hasLineOfSight &&
        inputs.distanceToAnchor <= STRIKE_CONSTANTS.losRange &&
        inputs.droneDistanceToAnchor <= STRIKE_CONSTANTS.strikeAnchorCaptureRange
      ) {
        this.state = 'ARMED';
        if (inputs.rainIntensity < STRIKE_CONSTANTS.strikeRainThreshold) {
          this.actions.requestStorm();
        }
      }
      return this.state;
    }

    if (this.state !== 'ARMED') return this.state;
    if (inputs.rainIntensity < STRIKE_CONSTANTS.strikeRainThreshold) {
      this.rainWaitSeconds += delta;
      if (this.rainWaitSeconds >= STRIKE_CONSTANTS.rainEstablishTimeoutSeconds) {
        this.actions.forceStormThreshold();
      }
      return this.state;
    }

    this.windupStarted = true;
    this.windupElapsedSeconds += delta;
    if (
      this.windupElapsedSeconds >= this.windupSeconds &&
      inputs.hasLineOfSight &&
      inputs.droneDistanceToAnchor <= STRIKE_CONSTANTS.strikeAnchorCaptureRange
    ) {
      this.state = 'FIRING';
    }
    return this.state;
  }

  markSpent(): void {
    if (this.state === 'FIRING') this.state = 'SPENT';
  }

  getState(): StrikeGateState {
    return this.state;
  }

  getWindupProgress(): number {
    if (!this.windupStarted) return 0;
    return Math.min(1, this.windupElapsedSeconds / this.windupSeconds);
  }
}

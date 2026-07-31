import type { StrikeAnchor } from './StrikeAnchorSelector';
import { seededUnit } from './StrikeAnchorSelector';
import type { StrikeProfile } from './strikeProfile';

export type StrikeGateState = 'DORMANT' | 'ARMED' | 'FIRING' | 'SPENT';

export interface StrikeGateInputs {
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
  private readonly windupUnit: number;

  constructor(
    readonly anchor: StrikeAnchor,
    runSeed: number,
    private readonly actions: StrikeGateActions,
    private readonly profile: StrikeProfile,
    private readonly restoredWindupSeconds?: number,
  ) {
    this.windupUnit = seededUnit(runSeed, `strike-windup:${anchor.id}`);
  }

  get windupSeconds(): number {
    return this.restoredWindupSeconds ??
      this.profile.strikeWindupMinSeconds +
      this.windupUnit *
        (this.profile.strikeWindupMaxSeconds - this.profile.strikeWindupMinSeconds);
  }

  update(dt: number, inputs: StrikeGateInputs): StrikeGateState {
    const delta = Math.max(0, dt);
    if (this.state === 'DORMANT') {
      if (
        inputs.hasLineOfSight &&
        inputs.distanceToAnchor <= this.profile.losRange &&
        inputs.droneDistanceToAnchor <= this.profile.strikeAnchorCaptureRange
      ) {
        this.state = 'ARMED';
        if (inputs.rainIntensity < this.profile.strikeRainThreshold) {
          this.actions.requestStorm();
        }
      }
      return this.state;
    }

    if (this.state !== 'ARMED') return this.state;
    if (inputs.rainIntensity < this.profile.strikeRainThreshold) {
      this.rainWaitSeconds += delta;
      if (this.rainWaitSeconds >= this.profile.rainEstablishTimeoutSeconds) {
        this.actions.forceStormThreshold();
      }
      return this.state;
    }

    this.windupStarted = true;
    this.windupElapsedSeconds += delta;
    if (
      this.windupElapsedSeconds >= this.windupSeconds &&
      inputs.hasLineOfSight &&
      inputs.droneDistanceToAnchor <= this.profile.strikeAnchorCaptureRange
    ) {
      this.state = 'FIRING';
    }
    return this.state;
  }

  markSpent(): void {
    if (this.state === 'FIRING') this.state = 'SPENT';
  }

  restoreSpent(): void {
    this.state = 'SPENT';
    this.windupStarted = true;
    this.windupElapsedSeconds = this.windupSeconds;
  }

  getState(): StrikeGateState {
    return this.state;
  }

  getWindupProgress(): number {
    if (!this.windupStarted) return 0;
    return Math.min(1, this.windupElapsedSeconds / this.windupSeconds);
  }
}

import type { VehicleProfile, VehicleTravelMode } from './vehicleProfile';

export interface FuelEstimate {
  minimum: number;
  expected: number;
  maximum: number;
}

export interface VehicleTravelSnapshot {
  readonly distanceMeters: number;
  readonly travelMode: VehicleTravelMode;
  readonly fuelCurrent: number;
  readonly fuelCapacity: number;
  readonly stranded: boolean;
}

export interface VehicleTravelInput {
  // -1 reverse, 0 idle, 1 forward — a discrete throttle rather than an
  // analog value, matching doc §3's control list (accelerate/brake/stop/
  // resume) without inventing pedal-feel physics this slice doesn't need.
  throttle: -1 | 0 | 1;
}

export interface VehicleTravelStateSeed {
  distanceMeters?: number;
  travelMode?: VehicleTravelMode;
  fuelCurrent?: number;
  stranded?: boolean;
}

function requireFiniteNonNegative(label: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`[VehicleTravelState] ${label} must be finite and non-negative`);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Distance a full tank affords at a given mode — pure function, doc §5's
// FuelEstimate shape (min/expected/max) so a route preview can show a range
// rather than one falsely-precise number even though this slice's only
// consumption input is distance × mode.
export function estimateFuel(distanceMeters: number, mode: VehicleTravelMode, profile: VehicleProfile): FuelEstimate {
  requireFiniteNonNegative('distanceMeters', distanceMeters);
  const expected = distanceMeters * profile.consumptionPerMeter[mode];
  return { minimum: expected * 0.85, expected, maximum: expected * 1.25 };
}

/**
 * Pure fuel/road-position domain state for the Synod road-service vehicle.
 * No Babylon, no DOM — same discipline as TerminalDockingSystem/StrikeGate.
 * VehicleSession.ts is the Babylon adapter that reads this state each frame
 * and positions the mesh/camera via RoadNetwork.positionAtDistance.
 */
export class VehicleTravelState {
  private distanceMeters: number;
  private travelMode: VehicleTravelMode;
  private fuelCurrent: number;
  private stranded: boolean;

  constructor(
    private readonly profile: VehicleProfile,
    private readonly totalLengthMeters: number,
    seed: VehicleTravelStateSeed = {},
  ) {
    requireFiniteNonNegative('totalLengthMeters', totalLengthMeters);
    this.distanceMeters = clamp(seed.distanceMeters ?? 0, 0, totalLengthMeters);
    this.travelMode = seed.travelMode ?? 'careful';
    this.fuelCurrent = clamp(seed.fuelCurrent ?? profile.fuelCapacity, 0, profile.fuelCapacity);
    this.stranded = seed.stranded ?? this.fuelCurrent <= 0;
  }

  snapshot(): VehicleTravelSnapshot {
    return Object.freeze({
      distanceMeters: this.distanceMeters,
      travelMode: this.travelMode,
      fuelCurrent: this.fuelCurrent,
      fuelCapacity: this.profile.fuelCapacity,
      stranded: this.stranded,
    });
  }

  setTravelMode(mode: VehicleTravelMode): void {
    this.travelMode = mode;
  }

  // Doc §5 stranding recovery hook: "permit ... returning with fuel."
  // Clears `stranded` the moment there's fuel to move again.
  refuel(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.fuelCurrent = clamp(this.fuelCurrent + amount, 0, this.profile.fuelCapacity);
    if (this.fuelCurrent > 0) this.stranded = false;
  }

  // Meters the vehicle can still cover at its current mode before the tank
  // is empty — the Dev HUD's "estimated range."
  estimateRemainingRangeMeters(): number {
    const consumption = this.profile.consumptionPerMeter[this.travelMode];
    return this.fuelCurrent / consumption;
  }

  update(dt: number, input: VehicleTravelInput): VehicleTravelSnapshot {
    requireFiniteNonNegative('dt', dt);
    if (input.throttle !== 0 && this.fuelCurrent > 0 && !this.stranded) {
      const speed = this.profile.speedMetersPerSecond[this.travelMode];
      const consumption = this.profile.consumptionPerMeter[this.travelMode];
      const desiredDelta = input.throttle * speed * dt;
      const affordableDistance = this.fuelCurrent / consumption;
      const distanceDelta = Math.sign(desiredDelta) * Math.min(Math.abs(desiredDelta), affordableDistance);
      const nextDistance = clamp(this.distanceMeters + distanceDelta, 0, this.totalLengthMeters);
      const actualDelta = Math.abs(nextDistance - this.distanceMeters);
      this.distanceMeters = nextDistance;
      this.fuelCurrent = Math.max(0, this.fuelCurrent - actualDelta * consumption);
    }
    // Doc §5: at zero fuel the vehicle stops at its real route position —
    // never teleported, never deleted, always exit-able and recoverable.
    if (this.fuelCurrent <= 0) this.stranded = true;
    return this.snapshot();
  }
}

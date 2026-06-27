import type { RunProfile, DepartureTime } from '@dissonance/shared-types';

export const RUN_PROFILES: Record<DepartureTime, RunProfile> = {
  afternoon: {
    departureTime: 'afternoon',
    startingLightLevel: 0.85,
    daylightDecayRate: 0.0022,
    startingFogDensity: 0.025,
    runDurationSeconds: 300,
  },
  dusk: {
    departureTime: 'dusk',
    startingLightLevel: 0.45,
    daylightDecayRate: 0.0030,
    startingFogDensity: 0.045,
    runDurationSeconds: 300,
  },
  night: {
    departureTime: 'night',
    startingLightLevel: 0.12,
    daylightDecayRate: 0.0010,
    startingFogDensity: 0.055,
    runDurationSeconds: 300,
  },
};

export const PURSUER_CONFIG = {
  startDistance: 180,
  baseSpeed: 3.2,
  maxSpeed: 8.2,
  catchRadius: 2.5,
  nearThreshold: 35,
  closeThreshold: 12,
  sprintAggressionGain: 0.022,
  stillAggressionLoss: 0.006,
  aggressionDecayRate: 0.002,
};

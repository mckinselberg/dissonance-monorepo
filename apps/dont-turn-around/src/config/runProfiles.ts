import type { RunProfile, DepartureTime } from '@dissonance/shared-types';
import type { PursuerConfig } from '@dissonance/pursuit';

export const RUN_COUNT_KEY = 'dta_run_count';

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

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

// Builds a pursuer config scaled to the player's run count.
// t=0 (run 0): learnable — slow pursuer, long stun window.
// t=1 (run 5+): full difficulty — current tuned values.
export function buildPursuerConfig(runCount: number): PursuerConfig {
  const t = Math.min(1, runCount / 5);
  return {
    startDistance: 180,
    baseSpeed:            lerp(1.8,  3.2,  t),
    maxSpeed:             lerp(4.5,  8.2,  t),
    catchRadius:          2.5,
    nearThreshold:        35,
    closeThreshold:       12,
    sprintAggressionGain: lerp(0.010, 0.022, t),
    stillAggressionLoss:  0.006,
    aggressionDecayRate:  0.002,
    stunMin:              lerp(1.8,  0.65, t),
    stunRange:            lerp(1.0,  0.35, t),
  };
}

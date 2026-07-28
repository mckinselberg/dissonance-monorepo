import type { RunProfile, DepartureTime } from '@dissonance/shared-types';
import type { PursuerConfig } from '@dissonance/pursuit';
import type { TrailPursuerProfile } from './trails';

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

export function buildPursuerConfig(profile: TrailPursuerProfile = 'stalker'): PursuerConfig {
  const t = 0.45;
  const config: PursuerConfig = {
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
    orbitStrength:        lerp(0.16, 0.34, t),
    reengageDelay:        lerp(1.8,  0.8,  t),
  };

  if (profile === 'ridge_stalker') {
    return {
      ...config,
      startDistance: 205,
      baseSpeed: config.baseSpeed * 0.90,
      maxSpeed: config.maxSpeed * 0.92,
      nearThreshold: 42,
      closeThreshold: 14,
      sprintAggressionGain: config.sprintAggressionGain * 1.12,
      aggressionDecayRate: config.aggressionDecayRate * 0.82,
      orbitStrength: config.orbitStrength * 1.22,
      reengageDelay: config.reengageDelay * 1.16,
    };
  }

  return config;
}

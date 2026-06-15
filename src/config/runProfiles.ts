import type { RunProfile, DepartureTime } from '../types';

export const RUN_PROFILES: Record<DepartureTime, RunProfile> = {
  afternoon: {
    departureTime: 'afternoon',
    startingLightLevel: 0.85,
    daylightDecayRate: 0.0022,  // per second — full run ~240s to reach dark
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
};

export const PURSUER_CONFIG = {
  startDistance: 180,
  baseSpeed: 3.2,           // units/s at aggression 0 — always closing
  maxSpeed: 8.2,            // units/s at aggression 1 — sprint-pace threat
  catchRadius: 2.5,
  nearThreshold: 35,
  closeThreshold: 12,
  sprintAggressionGain: 0.022,  // sprinting is now a real risk
  stillAggressionLoss: 0.006,
  aggressionDecayRate: 0.002,   // aggression lingers longer
};

export const PLAYER_CONFIG = {
  walkSpeed: 4.5,
  jogSpeed: 7.0,
  sprintSpeed: 10.5,
  sprintBreathGain: 0.18,    // per second
  walkBreathLoss: 0.06,      // per second recovery
  stillBreathLoss: 0.12,     // per second recovery
  breathLoadSpeedPenalty: 0.35,  // max speed reduction at breathLoad=1
  adrenalineDecay: 0.008,   // per second
};

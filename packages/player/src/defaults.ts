export const PLAYER_CONFIG = {
  walkSpeed: 4.5,
  jogSpeed: 7.0,
  sprintSpeed: 10.5,
  sprintBreathGain: 0.18,
  walkBreathLoss: 0.06,
  stillBreathLoss: 0.12,
  breathLoadSpeedPenalty: 0.35,
  adrenalineDecay: 0.008,
} as const;

export type PlayerConfig = typeof PLAYER_CONFIG;

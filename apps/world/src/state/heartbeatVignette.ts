// T28 threat-proximity vignette (docs/design/world/RURAL-INFRASTRUCTURE.md) —
// the "diegetic heartbeat response" the player feels as screen-edge darkening
// pulsing under threat, driven onto DefaultRenderingPipeline's built-in
// vignette rather than a new post-process. Same lub/dub double-pulse curve
// as packages/glow/HeartbeatGlow.ts (BPM-scaled by stress), adapted for a
// vignette that must read as fully off at stress 0 rather than glow's
// always-on baseline — everything here is gated by `stress`, not just the
// pulse amplitude, so an idle player sees no vignette at all.
//
// Deliberately does not touch packages/audio's HeartbeatAudio — its output
// gain is never ramped above 0 anywhere in that class, a prior and
// apparently deliberate mute this doesn't have context to safely reverse.
// This is visual-only.
export type HeartbeatVignetteState = { phase: number };

export function createHeartbeatVignetteState(): HeartbeatVignetteState {
  return { phase: 0 };
}

const BASE_BPM = 65;
const STRESS_BPM_RANGE = 90;
// Babylon's own ImageProcessingConfiguration default vignetteWeight is 1.5
// (vignettePower in its shader is -2.0 * vignetteWeight) — that's the scale
// a "normal, visible" vignette sits at. The original 0.15/0.55 here topped
// out under half that even at maximum threat and was near-invisible below
// it, which is why nothing read on screen. Scaled up so full threat clearly
// exceeds Babylon's own default and moderate threat is still legible.
const BASE_WEIGHT = 0.6;
const PULSE_WEIGHT = 1.8;

export function updateHeartbeatVignette(
  state: HeartbeatVignetteState,
  dt: number,
  stress: number,
): number {
  const clampedStress = Math.max(0, Math.min(1, stress));
  const bpm = BASE_BPM + clampedStress * STRESS_BPM_RANGE;
  const cycleLen = 60 / bpm;
  state.phase = (state.phase + dt / cycleLen) % 1;

  const lub = Math.pow(Math.max(0, 1 - state.phase * 5.5), 2.5);
  const dub = Math.pow(Math.max(0, 1 - Math.abs(state.phase - 0.14) * 13), 2.5) * 0.55;
  const pulse = Math.max(lub, dub);

  return clampedStress * (BASE_WEIGHT + pulse * PULSE_WEIGHT);
}

// Coarse per-threat-source weighting so a hostile patroller and the
// friendly companion dog never read the same — see main.tsx's call site.
// Combined via Math.max (whichever threat is currently scarier wins, not a
// sum, so two mild sources don't stack into something misleadingly severe).
export function combineThreatStress(patrolThreat: number, companionThreat: number): number {
  return Math.max(patrolThreat, companionThreat * COMPANION_THREAT_WEIGHT);
}

// Small and clearly named rather than zero: a pet-friend dog closing in
// during a whistle/chase game should register as a faint startle at most,
// never the real dread a dispatched hostile patroller gives. Retune (or
// zero out) here if it reads as too much/too little once seen live.
export const COMPANION_THREAT_WEIGHT = 0.12;

// Coarse buckets, not a smooth distance falloff (unlike RoadPatrolDog's own
// getThreatLevel) — a deliberately different signal SHAPE, not just a
// smaller number, since the companion dog is read through PursuerModel.state
// (far/near/close/caught) rather than exposing its own raw distance.
export function companionStateThreatLevel(state: 'far' | 'near' | 'close' | 'caught'): number {
  switch (state) {
    case 'caught': return 1;
    case 'close': return 0.6;
    case 'near': return 0.25;
    default: return 0;
  }
}

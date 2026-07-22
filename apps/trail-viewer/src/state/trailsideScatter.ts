import { signal, type Signal } from '@preact/signals';

// Independent size multipliers + a total-instance-count knob for the
// trailside hero-asset scatter (see main.tsx's trailsidePositions/
// rebuildTrailsideScatter) — same hScale/vScale shape as treeScale.ts, plus
// count since this cluster's size is itself user-tunable (unlike the fixed
// near-spawn grove).
export type TrailsideScatterSignals = {
  hScale: Signal<number>;
  vScale: Signal<number>;
  count: Signal<number>;
};

export function createTrailsideScatterSignals(defaults: {
  hScale: number;
  vScale: number;
  count: number;
}): TrailsideScatterSignals {
  return {
    hScale: signal(defaults.hScale),
    vScale: signal(defaults.vScale),
    count: signal(defaults.count),
  };
}

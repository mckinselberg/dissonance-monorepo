import { signal, type Signal } from '@preact/signals';

// hScale/vExag/waterLevel exist for every level (terrain/water construction
// always needs them) — only the scale-tuning slider UI itself is level-1-only
// (see ScaleTuningRow, rendered solely when levelKey === '1').
export type ScaleTuningSignals = {
  hScale: Signal<number>;
  vExag: Signal<number>;
  waterLevel: Signal<number>;
};

export function createScaleTuningSignals(defaults: {
  hScale: number;
  vExag: number;
  waterLevel: number;
}): ScaleTuningSignals {
  return {
    hScale: signal(defaults.hScale),
    vExag: signal(defaults.vExag),
    waterLevel: signal(defaults.waterLevel),
  };
}

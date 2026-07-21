import { signal, type Signal } from '@preact/signals';

// Independent tree-size multipliers, layered on top of ThinInstanceTrees'
// own world-scale-derived base size (see its scatter() comment) — hScale
// widens/narrows the canopy+trunk footprint, vScale stretches/squashes
// height, each without touching the other or the world's own hScale/vExag.
export type TreeScaleSignals = {
  hScale: Signal<number>;
  vScale: Signal<number>;
};

export function createTreeScaleSignals(defaults: {
  hScale: number;
  vScale: number;
}): TreeScaleSignals {
  return {
    hScale: signal(defaults.hScale),
    vScale: signal(defaults.vScale),
  };
}

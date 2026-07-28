import { signal, type Signal } from '@preact/signals';

// Same shape as trailsideScatter.ts, for the bulk/non-trail-adjacent forest
// (see main.tsx's rebuildTrees) — a separate signal group on purpose, not
// reused from treeScale/trailsideScale, since it governs a third visually
// distinct cluster (real decimated trees carved out of ThinInstanceTrees'
// own candidate pool) that the user should be able to size/densify
// independently of the other two.
export type BulkForestScatterSignals = {
  hScale: Signal<number>;
  vScale: Signal<number>;
  count: Signal<number>;
};

export function createBulkForestScatterSignals(defaults: {
  hScale: number;
  vScale: number;
  count: number;
}): BulkForestScatterSignals {
  return {
    hScale: signal(defaults.hScale),
    vScale: signal(defaults.vScale),
    count: signal(defaults.count),
  };
}

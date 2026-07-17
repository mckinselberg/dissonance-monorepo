import { signal, type Signal } from '@preact/signals';

// Not persisted anywhere in SavedSettings (confirmed — no such fields exist
// today), but still signals rather than component-local state: rebuildWorld
// (the H/V-scale rebuild in main.tsx) and rebuildClouds/rebuildTrees all
// need to re-read the current checked state from outside VisibilityToggles
// itself after disposing/recreating meshes.
export type VisibilitySignals = {
  terrain: Signal<boolean>;
  osm: Signal<boolean>;
  gpx: Signal<boolean>;
  water: Signal<boolean>;
  clouds: Signal<boolean>;
  trees: Signal<boolean>;
};

export function createVisibilitySignals(): VisibilitySignals {
  return {
    terrain: signal(true),
    osm: signal(true),
    gpx: signal(true),
    water: signal(true),
    clouds: signal(true),
    trees: signal(true),
  };
}

import { signal, type Signal } from '@preact/signals';

// Signals rather than component-local state: rebuildWorld (the H/V-scale
// rebuild in main.tsx) and rebuildClouds/rebuildTrees all need to re-read
// the current checked state from outside VisibilityToggles itself after
// disposing/recreating meshes. Persisted via SavedSettings/persistSettings
// and both buildSnapshot() export paths — see createVisibilitySignals below
// for the restore defaults.
export type VisibilitySignals = {
  terrain: Signal<boolean>;
  osm: Signal<boolean>;
  gpx: Signal<boolean>;
  water: Signal<boolean>;
  clouds: Signal<boolean>;
  grid: Signal<boolean>;
  mountains: Signal<boolean>;
  powerLines: Signal<boolean>;
  mechDog: Signal<boolean>;
};

export type VisibilitySignalDefaults = Partial<{
  terrain: boolean;
  osm: boolean;
  gpx: boolean;
  water: boolean;
  clouds: boolean;
  grid: boolean;
  mountains: boolean;
  powerLines: boolean;
  mechDog: boolean;
}>;

export function createVisibilitySignals(defaults: VisibilitySignalDefaults = {}): VisibilitySignals {
  return {
    terrain: signal(defaults.terrain ?? true),
    osm: signal(defaults.osm ?? true),
    gpx: signal(defaults.gpx ?? true),
    water: signal(defaults.water ?? true),
    clouds: signal(defaults.clouds ?? true),
    grid: signal(defaults.grid ?? false),
    mountains: signal(defaults.mountains ?? true),
    powerLines: signal(defaults.powerLines ?? true),
    mechDog: signal(defaults.mechDog ?? true),
  };
}

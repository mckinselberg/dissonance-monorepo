import { signal, type Signal } from '@preact/signals';

// The atmosphere-row pilot's reactive state — see docs/THREADS.md's "Copy
// Paste Views" thread and the plan this was built from. treeCount is
// intentionally NOT created here: its real default depends on maxTreeCount,
// which isn't known until the heightmap has loaded and the elevation-
// filtered candidate pool has been built (see main.ts) — it's created
// inline there instead, right where that number becomes available, and
// merged into this same shape for the AtmosphereRow component.
export type AtmosphereSignals = {
  timeOfDay: Signal<number>;
  fogDensity: Signal<number>;
  fogColor: Signal<string>;
  overcast: Signal<boolean>;
  starCount: Signal<number>;
  cloudCount: Signal<number>;
  cloudColor: Signal<string>;
  cloudOpacity: Signal<number>;
};

export function createAtmosphereSignals(defaults: {
  timeOfDay: number;
  fogDensity: number;
  fogColor: string;
  overcast: boolean;
  starCount: number;
  cloudCount: number;
  cloudColor: string;
  cloudOpacity: number;
}): AtmosphereSignals {
  return {
    timeOfDay: signal(defaults.timeOfDay),
    fogDensity: signal(defaults.fogDensity),
    fogColor: signal(defaults.fogColor),
    overcast: signal(defaults.overcast),
    starCount: signal(defaults.starCount),
    cloudCount: signal(defaults.cloudCount),
    cloudColor: signal(defaults.cloudColor),
    cloudOpacity: signal(defaults.cloudOpacity),
  };
}

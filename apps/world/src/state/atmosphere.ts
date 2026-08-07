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
  // Opt-in DriftingClouds shape-morph prototype (docs/intake/authored-
  // morphing-cloud-volumes-engineering-spec.md, Strategy A slice only) —
  // false keeps the original random-blob-cluster look unchanged.
  cloudShapesEnabled: Signal<boolean>;
  waterColor: Signal<string>;
  starColor: Signal<string>;
  skyDayColor: Signal<string>;
  skyNightColor: Signal<string>;
  terrainLowColor: Signal<string>;
  terrainHighColor: Signal<string>;
  sunTint: Signal<string>;
  // City-kit "fake interior" window cards (CompositeLocations.ts) — default
  // white/0 exactly reproduces the un-tuned baked-texture look every
  // existing view already has, so adding these fields doesn't change
  // anything until a profile dials them in deliberately (see the boulevard
  // concept-art view in views.json).
  windowTintColor: Signal<string>;
  windowGlow: Signal<number>;
  // Distance-cull threshold for BulkForestSystem/TrailsideForestSystem's
  // thin-instance forests (see T24 in docs/THREADS.md) — a live-tunable
  // override of the active EnvironmentRenderingProfile's
  // foliage.impostorRadius, same override-a-profile-default pattern as
  // fogDensity/fogColor above. Exists so a slow machine can dial this down
  // without editing profile data.
  vegetationCullRadius: Signal<number>;
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
  cloudShapesEnabled: boolean;
  waterColor: string;
  starColor: string;
  skyDayColor: string;
  skyNightColor: string;
  terrainLowColor: string;
  terrainHighColor: string;
  sunTint: string;
  windowTintColor: string;
  windowGlow: number;
  vegetationCullRadius: number;
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
    cloudShapesEnabled: signal(defaults.cloudShapesEnabled),
    waterColor: signal(defaults.waterColor),
    starColor: signal(defaults.starColor),
    skyDayColor: signal(defaults.skyDayColor),
    skyNightColor: signal(defaults.skyNightColor),
    terrainLowColor: signal(defaults.terrainLowColor),
    terrainHighColor: signal(defaults.terrainHighColor),
    sunTint: signal(defaults.sunTint),
    windowTintColor: signal(defaults.windowTintColor),
    windowGlow: signal(defaults.windowGlow),
    vegetationCullRadius: signal(defaults.vegetationCullRadius),
  };
}

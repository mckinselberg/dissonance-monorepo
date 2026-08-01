import { signal, type Signal } from '@preact/signals';

// A small, deliberately scoped slice of docs/engineering/reviews/dissonance-lineglass-
// engineering-review-prompt.md's much larger device (6 render layers,
// package split, custom shaders, anomaly system...) — just its §7.6
// "Geospatial Reference Layer" idea plus §6's "capable of progressively
// unlocking new scan layers", applied to the three geo-reference toggles
// that already existed as always-on HUD checkboxes (grid/OSM/GPX) with
// nothing gating them. Dan, 2026-07-27/28: "a diegetic object that when
// parts are found allows player to see latLong/osm/gpx, but only after
// collecting commensurate parts" — progressive, one layer per tier,
// confirmed over the shared-pool alternative.
export type LineglassLayerId = 'grid' | 'gpx' | 'osm';

// Ordered simplest-capability-first, matching the doc's own framing of the
// grid as the base reference and OSM (licensed, attribution-bearing,
// heaviest data) as the most "advanced" source. Threshold = total parts
// collected, not per-layer parts — collecting any 2 of the 3 authored
// parts unlocks the first two tiers, order-independent.
export const LINEGLASS_TIERS: ReadonlyArray<{ threshold: number; layer: LineglassLayerId }> = [
  { threshold: 1, layer: 'grid' },
  { threshold: 2, layer: 'gpx' },
  { threshold: 3, layer: 'osm' },
];

export function unlockedLineglassLayers(collectedCount: number): Set<LineglassLayerId> {
  const unlocked = new Set<LineglassLayerId>();
  for (const tier of LINEGLASS_TIERS) {
    if (collectedCount >= tier.threshold) unlocked.add(tier.layer);
  }
  return unlocked;
}

export type LineglassSignals = {
  // Stable part ids (see LineglassParts.ts), not a bare count — needed so a
  // previously-collected part can be recognized and skipped/hidden on
  // reload without re-triggering its unlock event.
  collectedPartIds: Signal<string[]>;
};

export function createLineglassSignals(defaults: { collectedPartIds: string[] }): LineglassSignals {
  return {
    collectedPartIds: signal(defaults.collectedPartIds),
  };
}

export interface ScatterVariationRange {
  min: number;
  max: number;
}

export interface ScatterVariationProfile {
  hueShift: ScatterVariationRange;
  valueJitter: ScatterVariationRange;
}

// T1 "decisions as data": these are the only defaults in the pipeline —
// round-trip them from a config, don't hardcode new ranges elsewhere.
// Deliberately conservative (±0.03 hue turns, ±12% value) — Echo-17's
// worn-leather swatch is already near-black, and large jitter on a dark
// source clips to solid black/white rather than reading as "varied".
export const DEFAULT_SCATTER_VARIATION_PROFILE: ScatterVariationProfile = {
  hueShift: { min: -0.03, max: 0.03 },
  valueJitter: { min: -0.12, max: 0.12 },
};

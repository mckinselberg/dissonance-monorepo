import type { ExperienceProfile, ExperienceMode } from '@dissonance/shared-types';

export const EXPERIENCE_PROFILES: Record<ExperienceMode, ExperienceProfile> = {
  radio: {
    mode: 'radio',
    treeCount: 700,
    fogDensity: 0.08,
    drawDistance: 40,
    ambientIntensity: 0.08,
    visualNoise: 0.0,
    audioLoFiAmount: 0.4,
    fogColor: { r: 0.05, g: 0.05, b: 0.07 },
    skyColor: { r: 0.02, g: 0.02, b: 0.04 },
  },
  ps1: {
    mode: 'ps1',
    treeCount: 1000,
    // Was (0.42, 0.52, 0.35) — a saturated olive-green that, combined with
    // exponential falloff, painted everything within ~30 units a flat
    // green and erased all the tree-color variation work. Neutralized
    // toward a grayer haze and the density lowered so material color
    // actually survives into the midground instead of washing out early.
    fogDensity: 0.028,
    drawDistance: 80,
    ambientIntensity: 0.28,
    visualNoise: 0.0,
    audioLoFiAmount: 0.1,
    fogColor: { r: 0.32, g: 0.36, b: 0.30 },
    skyColor: { r: 0.18, g: 0.28, b: 0.44 },
  },
  ps2: {
    mode: 'ps2',
    treeCount: 1450,
    fogDensity: 0.024,
    drawDistance: 115,
    ambientIntensity: 0.24,
    visualNoise: 0.0,
    audioLoFiAmount: 0.05,
    fogColor: { r: 0.18, g: 0.22, b: 0.20 },
    skyColor: { r: 0.11, g: 0.16, b: 0.24 },
  },
  ps3: {
    mode: 'ps3',
    treeCount: 2200,
    fogDensity: 0.013,
    drawDistance: 178,
    ambientIntensity: 0.26,
    visualNoise: 0.0,
    audioLoFiAmount: 0.02,
    // Genesis fogColor — kept as-is; the overcast look-dev pass
    // (docs/dissonance-forest-color-handoff.md) overrides fog/lighting/
    // grading/palette at the consumption sites when lookVariant is
    // 'overcast', so this value stays available if lookVariant is ever
    // set back to 'genesis'.
    fogColor: { r: 0.15, g: 0.16, b: 0.14 },
    skyColor: { r: 0.16, g: 0.18, b: 0.24 },
    lookVariant: 'overcast',
  },
};

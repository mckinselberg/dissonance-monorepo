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
};

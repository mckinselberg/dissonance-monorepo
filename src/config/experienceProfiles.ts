import type { ExperienceProfile, ExperienceMode } from '../types';

export const EXPERIENCE_PROFILES: Record<ExperienceMode, ExperienceProfile> = {
  radio: {
    mode: 'radio',
    treeCount: 350,
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
    treeCount: 500,
    fogDensity: 0.04,
    drawDistance: 80,
    ambientIntensity: 0.28,
    visualNoise: 0.0,
    audioLoFiAmount: 0.1,
    fogColor: { r: 0.42, g: 0.52, b: 0.35 },  // hazy green-grey afternoon
    skyColor: { r: 0.18, g: 0.28, b: 0.44 },  // blue sky
  },
};

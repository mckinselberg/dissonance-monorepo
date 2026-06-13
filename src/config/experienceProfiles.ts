import type { ExperienceProfile, ExperienceMode } from '../types';

export const EXPERIENCE_PROFILES: Record<ExperienceMode, ExperienceProfile> = {
  radio: {
    mode: 'radio',
    treeCount: 120,
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
    treeCount: 200,
    fogDensity: 0.05,
    drawDistance: 80,
    ambientIntensity: 0.18,
    visualNoise: 0.0,
    audioLoFiAmount: 0.1,
    fogColor: { r: 0.15, g: 0.18, b: 0.14 },
    skyColor: { r: 0.08, g: 0.10, b: 0.08 },
  },
};

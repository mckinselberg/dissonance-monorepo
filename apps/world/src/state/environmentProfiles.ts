import type { EnvironmentRenderingProfile, HazeBandTuple } from './environmentRenderingProfile';
import {
  createDefaultEnvironmentRenderingProfile,
  validateEnvironmentRenderingProfile,
} from './environmentRenderingProfile';

const urbanBands: HazeBandTuple = [
  { depth: 0, color: '#1a1c22', inscatter: 0 },
  { depth: 0.3, color: '#3d3540', inscatter: 0.45 },
  { depth: 0.6, color: '#8a4a52', inscatter: 0.8 },
  { depth: 1, color: '#c86b5a', inscatter: 1 },
];
const hardscapeBands: HazeBandTuple = [
  { depth: 0, color: '#4a4d50', inscatter: 0 },
  { depth: 0.4, color: '#6b6e72', inscatter: 0.5 },
  { depth: 0.75, color: '#8f9296', inscatter: 0.85 },
  { depth: 1, color: '#a9acb0', inscatter: 1 },
];

export function createEnvironmentProfileRegistry(options: {
  farClip: number;
  defaultFogDensity: number;
  defaultFogColor: string;
}): EnvironmentRenderingProfile[] {
  const base = createDefaultEnvironmentRenderingProfile({
    farClip: options.farClip,
    fogDensity: options.defaultFogDensity,
    fogColor: options.defaultFogColor,
  });
  const presentationBase = {
    foliage: base.foliage,
    visibility: base.visibility,
    bloom: base.bloom,
  };
  return [
    base,
    validateEnvironmentRenderingProfile({
      ...presentationBase,
      id: 'urban-edge-dusk',
      label: 'Urban Edge / Dusk',
      atmosphere: {
        fogDensity: 0.018,
        fogColor: '#3d3540',
        hazeBands: { bands: urbanBands, bandSoftness: 0.12, heightFalloff: 0.3 },
      },
      grade: {
        saturationScale: 0.7,
        shadowsHue: 250,
        shadowsDensity: 0.6,
        highlightsHue: 20,
        highlightsDensity: 0.35,
        redChannelGain: 1,
      },
      emissive: {
        windows: {
          color: '#e8a870',
          intensity: 2.2,
          bloomThreshold: 0.65,
          flicker: { amp: 0, hz: 0, seed: 0 },
          occupancyMask: null,
        },
      },
    }),
    validateEnvironmentRenderingProfile({
      ...presentationBase,
      id: 'open-hardscape-fog',
      label: 'Open Hardscape / Fog',
      atmosphere: {
        fogDensity: 0.045,
        fogColor: '#6b6e72',
        hazeBands: { bands: hardscapeBands, bandSoftness: 0.18, heightFalloff: 0.75 },
      },
      grade: {
        saturationScale: 0.25,
        shadowsHue: 220,
        shadowsDensity: 0.35,
        highlightsHue: 30,
        highlightsDensity: 0.2,
        redChannelGain: 0.85,
      },
      emissive: {
        streetLamps: {
          color: '#c89050',
          intensity: 1.4,
          bloomThreshold: 0.65,
          flicker: { amp: 0, hz: 0, seed: 0 },
          occupancyMask: null,
        },
      },
    }),
  ];
}

export function findEnvironmentProfile(
  profiles: EnvironmentRenderingProfile[],
  id: string | undefined,
): EnvironmentRenderingProfile {
  return profiles.find((profile) => profile.id === id) ?? profiles[0];
}

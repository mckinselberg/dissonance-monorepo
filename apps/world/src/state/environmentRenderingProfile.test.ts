import { describe, expect, it } from 'vitest';
import {
  createDefaultEnvironmentRenderingProfile,
  validateEnvironmentRenderingProfile,
} from './environmentRenderingProfile';

describe('EnvironmentRenderingProfile haze bands', () => {
  it('requires exactly four bands at runtime', () => {
    const profile = createDefaultEnvironmentRenderingProfile({
      farClip: 2_000,
      fogDensity: 0.001,
      fogColor: '#8ca6c7',
    });
    const malformed = {
      ...profile,
      atmosphere: {
        ...profile.atmosphere,
        hazeBands: {
          bands: [
            { depth: 0, color: '#111111', inscatter: 0 },
            { depth: 0.5, color: '#555555', inscatter: 0.5 },
            { depth: 1, color: '#999999', inscatter: 1 },
          ],
          bandSoftness: 0.1,
          heightFalloff: 0.5,
        },
      },
    };

    expect(() => validateEnvironmentRenderingProfile(
      malformed as unknown as Parameters<typeof validateEnvironmentRenderingProfile>[0],
    )).toThrow('hazeBands must contain exactly four bands');
  });
});

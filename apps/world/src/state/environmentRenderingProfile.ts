export type HazeBand = {
  depth: number;
  color: string;
  inscatter: number;
};

export type HazeBandTuple = [HazeBand, HazeBand, HazeBand, HazeBand];

export type EmissivePresentation = {
  color: string;
  intensity: number;
  bloomThreshold: number;
  flicker: { amp: number; hz: number; seed: number };
  occupancyMask: string | null;
};

export type EnvironmentRenderingProfile = {
  id: string;
  label: string;
  foliage: {
    heroRadius: number;
    heroFadeStart: number;
    heroFadeEnd: number;
    impostorRadius: number;
  };
  visibility: {
    cullRadius: number;
    streamRadius: number;
    chunkSize: number;
  };
  atmosphere: {
    fogDensity: number;
    fogColor: string;
    hazeBands?: {
      bands: HazeBandTuple;
      bandSoftness: number;
      heightFalloff: number;
    };
  };
  grade?: {
    saturationScale: number;
    shadowsHue: number;
    shadowsDensity: number;
    highlightsHue: number;
    highlightsDensity: number;
    redChannelGain: number;
  };
  bloom?: {
    threshold: number;
    weight: number;
    kernel: number;
    scale: number;
  };
  emissive?: Record<string, EmissivePresentation>;
};

const DEFAULT_HERO_FADE_START_METERS = 80;
const DEFAULT_HERO_FADE_END_METERS = 100;
const DEFAULT_HERO_RADIUS_METERS = 120;
const DEFAULT_IMPOSTOR_RADIUS_METERS = 1_000;
const DEFAULT_CHUNK_SIZE_METERS = 64;
const DEFAULT_CULL_FAR_CLIP_FRACTION = 0.75;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const PROFILE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function requireFinite(label: string, value: number) {
  if (!Number.isFinite(value)) throw new Error(`[EnvironmentRenderingProfile] ${label} must be finite`);
}

function requireFinitePositive(label: string, value: number) {
  requireFinite(label, value);
  if (value <= 0) throw new Error(`[EnvironmentRenderingProfile] ${label} must be positive`);
}

function requireUnit(label: string, value: number) {
  requireFinite(label, value);
  if (value < 0 || value > 1) throw new Error(`[EnvironmentRenderingProfile] ${label} must be within 0..1`);
}

function requireColor(label: string, value: string) {
  if (!HEX_COLOR_PATTERN.test(value)) {
    throw new Error(`[EnvironmentRenderingProfile] ${label} must be a six-digit hex color`);
  }
}

export function validateEnvironmentRenderingProfile(
  profile: EnvironmentRenderingProfile,
): EnvironmentRenderingProfile {
  if (!PROFILE_ID_PATTERN.test(profile.id)) {
    throw new Error('[EnvironmentRenderingProfile] id must be kebab-case');
  }
  if (!profile.label.trim()) throw new Error('[EnvironmentRenderingProfile] label is required');

  const { foliage, visibility, atmosphere } = profile;
  requireFinitePositive('foliage.heroFadeStart', foliage.heroFadeStart);
  requireFinitePositive('foliage.heroFadeEnd', foliage.heroFadeEnd);
  requireFinitePositive('foliage.heroRadius', foliage.heroRadius);
  requireFinitePositive('foliage.impostorRadius', foliage.impostorRadius);
  requireFinitePositive('visibility.cullRadius', visibility.cullRadius);
  requireFinitePositive('visibility.streamRadius', visibility.streamRadius);
  requireFinitePositive('visibility.chunkSize', visibility.chunkSize);
  if (!(foliage.heroFadeStart <= foliage.heroFadeEnd && foliage.heroFadeEnd <= foliage.heroRadius)) {
    throw new Error('[EnvironmentRenderingProfile] expected heroFadeStart <= heroFadeEnd <= heroRadius');
  }
  if (foliage.heroRadius > foliage.impostorRadius || foliage.impostorRadius > visibility.cullRadius) {
    throw new Error('[EnvironmentRenderingProfile] expected heroRadius <= impostorRadius <= cullRadius');
  }
  if (visibility.cullRadius > visibility.streamRadius) {
    throw new Error('[EnvironmentRenderingProfile] cullRadius must not exceed streamRadius');
  }
  requireFinite('atmosphere.fogDensity', atmosphere.fogDensity);
  if (atmosphere.fogDensity < 0) {
    throw new Error('[EnvironmentRenderingProfile] atmosphere.fogDensity must be non-negative');
  }
  requireColor('atmosphere.fogColor', atmosphere.fogColor);

  const haze = atmosphere.hazeBands;
  if (haze) {
    if (!Array.isArray(haze.bands) || haze.bands.length !== 4) {
      throw new Error('[EnvironmentRenderingProfile] hazeBands must contain exactly four bands');
    }
    requireUnit('atmosphere.hazeBands.bandSoftness', haze.bandSoftness);
    requireUnit('atmosphere.hazeBands.heightFalloff', haze.heightFalloff);
    let previousDepth = -1;
    haze.bands.forEach((band, index) => {
      requireUnit(`atmosphere.hazeBands.bands[${index}].depth`, band.depth);
      requireUnit(`atmosphere.hazeBands.bands[${index}].inscatter`, band.inscatter);
      requireColor(`atmosphere.hazeBands.bands[${index}].color`, band.color);
      if (band.depth < previousDepth) {
        throw new Error('[EnvironmentRenderingProfile] haze bands must be ordered near-to-far');
      }
      previousDepth = band.depth;
    });
  }

  if (profile.grade) {
    requireUnit('grade.saturationScale', profile.grade.saturationScale);
    requireUnit('grade.redChannelGain', profile.grade.redChannelGain);
    requireFinite('grade.shadowsHue', profile.grade.shadowsHue);
    requireFinite('grade.shadowsDensity', profile.grade.shadowsDensity);
    requireFinite('grade.highlightsHue', profile.grade.highlightsHue);
    requireFinite('grade.highlightsDensity', profile.grade.highlightsDensity);
  }
  if (profile.bloom) {
    requireUnit('bloom.threshold', profile.bloom.threshold);
    requireUnit('bloom.weight', profile.bloom.weight);
    requireFinitePositive('bloom.kernel', profile.bloom.kernel);
    requireUnit('bloom.scale', profile.bloom.scale);
  }
  Object.entries(profile.emissive ?? {}).forEach(([key, emissive]) => {
    requireColor(`emissive.${key}.color`, emissive.color);
    requireFinite(`emissive.${key}.intensity`, emissive.intensity);
    requireUnit(`emissive.${key}.bloomThreshold`, emissive.bloomThreshold);
    requireUnit(`emissive.${key}.flicker.amp`, emissive.flicker.amp);
    requireFinite(`emissive.${key}.flicker.hz`, emissive.flicker.hz);
  });
  return profile;
}

export function createDefaultEnvironmentRenderingProfile(options: {
  farClip: number;
  fogDensity: number;
  fogColor: string;
}): EnvironmentRenderingProfile {
  requireFinitePositive('farClip', options.farClip);
  const cullRadius = Math.max(DEFAULT_IMPOSTOR_RADIUS_METERS, options.farClip * DEFAULT_CULL_FAR_CLIP_FRACTION);
  return validateEnvironmentRenderingProfile({
    id: 'forest-default',
    label: 'Forest / Default',
    foliage: {
      heroRadius: DEFAULT_HERO_RADIUS_METERS,
      heroFadeStart: DEFAULT_HERO_FADE_START_METERS,
      heroFadeEnd: DEFAULT_HERO_FADE_END_METERS,
      impostorRadius: DEFAULT_IMPOSTOR_RADIUS_METERS,
    },
    visibility: { cullRadius, streamRadius: options.farClip, chunkSize: DEFAULT_CHUNK_SIZE_METERS },
    atmosphere: { fogDensity: options.fogDensity, fogColor: options.fogColor },
    grade: {
      saturationScale: 1,
      shadowsHue: 30,
      shadowsDensity: 0,
      highlightsHue: 30,
      highlightsDensity: 0,
      redChannelGain: 1,
    },
    bloom: { threshold: 0.65, weight: 0.4, kernel: 64, scale: 0.5 },
  });
}

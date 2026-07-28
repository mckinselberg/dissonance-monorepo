export type EnvironmentRenderingProfile = {
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
  };
};

const DEFAULT_HERO_FADE_START_METERS = 80;
const DEFAULT_HERO_FADE_END_METERS = 100;
const DEFAULT_HERO_RADIUS_METERS = 120;
const DEFAULT_IMPOSTOR_RADIUS_METERS = 1_000;
const DEFAULT_CHUNK_SIZE_METERS = 64;
const DEFAULT_CULL_FAR_CLIP_FRACTION = 0.75;

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function requireFinitePositive(label: string, value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`[EnvironmentRenderingProfile] ${label} must be a finite positive number`);
  }
}

export function validateEnvironmentRenderingProfile(
  profile: EnvironmentRenderingProfile,
): EnvironmentRenderingProfile {
  const { foliage, visibility, atmosphere } = profile;
  requireFinitePositive('foliage.heroFadeStart', foliage.heroFadeStart);
  requireFinitePositive('foliage.heroFadeEnd', foliage.heroFadeEnd);
  requireFinitePositive('foliage.heroRadius', foliage.heroRadius);
  requireFinitePositive('foliage.impostorRadius', foliage.impostorRadius);
  requireFinitePositive('visibility.cullRadius', visibility.cullRadius);
  requireFinitePositive('visibility.streamRadius', visibility.streamRadius);
  requireFinitePositive('visibility.chunkSize', visibility.chunkSize);

  if (!(foliage.heroFadeStart <= foliage.heroFadeEnd && foliage.heroFadeEnd <= foliage.heroRadius)) {
    throw new Error(
      '[EnvironmentRenderingProfile] expected heroFadeStart <= heroFadeEnd <= heroRadius',
    );
  }
  if (foliage.heroRadius > foliage.impostorRadius) {
    throw new Error('[EnvironmentRenderingProfile] heroRadius must not exceed impostorRadius');
  }
  if (foliage.impostorRadius > visibility.cullRadius) {
    throw new Error('[EnvironmentRenderingProfile] impostorRadius must not exceed cullRadius');
  }
  if (visibility.cullRadius > visibility.streamRadius) {
    throw new Error('[EnvironmentRenderingProfile] cullRadius must not exceed streamRadius');
  }
  if (!Number.isFinite(atmosphere.fogDensity) || atmosphere.fogDensity < 0) {
    throw new Error('[EnvironmentRenderingProfile] atmosphere.fogDensity must be finite and non-negative');
  }
  if (!HEX_COLOR_PATTERN.test(atmosphere.fogColor)) {
    throw new Error('[EnvironmentRenderingProfile] atmosphere.fogColor must be a six-digit hex color');
  }
  return profile;
}

export function createDefaultEnvironmentRenderingProfile(options: {
  farClip: number;
  fogDensity: number;
  fogColor: string;
}): EnvironmentRenderingProfile {
  requireFinitePositive('farClip', options.farClip);
  const cullRadius = Math.max(
    DEFAULT_IMPOSTOR_RADIUS_METERS,
    options.farClip * DEFAULT_CULL_FAR_CLIP_FRACTION,
  );
  return validateEnvironmentRenderingProfile({
    foliage: {
      heroRadius: DEFAULT_HERO_RADIUS_METERS,
      heroFadeStart: DEFAULT_HERO_FADE_START_METERS,
      heroFadeEnd: DEFAULT_HERO_FADE_END_METERS,
      impostorRadius: DEFAULT_IMPOSTOR_RADIUS_METERS,
    },
    visibility: {
      cullRadius,
      streamRadius: options.farClip,
      chunkSize: DEFAULT_CHUNK_SIZE_METERS,
    },
    atmosphere: {
      fogDensity: options.fogDensity,
      fogColor: options.fogColor,
    },
  });
}

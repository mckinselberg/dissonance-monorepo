const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface StrikeProfile {
  id: string;
  strikeRainThreshold: number;
  strikeWindupMinSeconds: number;
  strikeWindupMaxSeconds: number;
  rainEstablishTimeoutSeconds: number;
  losRange: number;
  strikeAnchorCaptureRange: number;
  flashIntensity: number;
  flashDurationSeconds: number;
  clapDelayFromFlashSeconds: number;
  recoveryProximityRange: number;
  droneInertSettleSeconds: number;
}

const NUMERIC_KEYS: Array<Exclude<keyof StrikeProfile, 'id'>> = [
  'strikeRainThreshold',
  'strikeWindupMinSeconds',
  'strikeWindupMaxSeconds',
  'rainEstablishTimeoutSeconds',
  'losRange',
  'strikeAnchorCaptureRange',
  'flashIntensity',
  'flashDurationSeconds',
  'clapDelayFromFlashSeconds',
  'recoveryProximityRange',
  'droneInertSettleSeconds',
];

export function parseStrikeProfile(value: unknown): StrikeProfile {
  if (typeof value !== 'object' || value === null) throw new Error('[StrikeProfile] expected an object.');
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'string' || !ID_PATTERN.test(raw.id)) {
    throw new Error('[StrikeProfile] id must be kebab-case.');
  }
  const profile = { id: raw.id } as StrikeProfile;
  for (const key of NUMERIC_KEYS) {
    const number = raw[key];
    if (typeof number !== 'number' || !Number.isFinite(number) || number < 0) {
      throw new Error(`[StrikeProfile] ${key} must be a finite non-negative number.`);
    }
    profile[key] = number;
  }
  if (profile.strikeRainThreshold > 1) throw new Error('[StrikeProfile] strikeRainThreshold must be <= 1.');
  if (profile.strikeWindupMaxSeconds < profile.strikeWindupMinSeconds) {
    throw new Error('[StrikeProfile] windup max must be >= min.');
  }
  return profile;
}

export function copyStrikeProfile(target: StrikeProfile, source: StrikeProfile): void {
  Object.assign(target, parseStrikeProfile(source));
}

export const STRIKE_PROFILE_NUMERIC_KEYS = NUMERIC_KEYS;

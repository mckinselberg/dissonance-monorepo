export interface ThunderProfile {
  minIntervalSeconds: number;
  maxIntervalSeconds: number;
  stormDistance: number;
  minClapDelaySeconds: number;
  maxClapDelaySeconds: number;
  maskFloorSpike: number;
  maskDecaySeconds: number;
}

export interface ThunderEvent {
  clapDelaySeconds: number;
  gain: number;
  maskFloorSpike: number;
  maskDecaySeconds: number;
}

export const DEFAULT_THUNDER_PROFILE: ThunderProfile = {
  minIntervalSeconds: 18,
  maxIntervalSeconds: 42,
  stormDistance: 0.45,
  minClapDelaySeconds: 0.08,
  maxClapDelaySeconds: 3.2,
  maskFloorSpike: 0.7,
  maskDecaySeconds: 1.4,
};

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export class ThunderScheduler {
  private readonly random: () => number;
  private remainingSeconds: number;

  constructor(
    seed: number,
    private readonly profile: ThunderProfile = DEFAULT_THUNDER_PROFILE,
  ) {
    this.random = mulberry32(seed);
    this.remainingSeconds = this.nextInterval();
  }

  update(dt: number, stormIntensity: number): ThunderEvent | null {
    if (stormIntensity <= 0.01) return null;
    this.remainingSeconds -= Math.max(0, dt) * stormIntensity;
    if (this.remainingSeconds > 0) return null;
    this.remainingSeconds = this.nextInterval();
    const distance = Math.max(0, Math.min(1, this.profile.stormDistance));
    return {
      clapDelaySeconds:
        this.profile.minClapDelaySeconds +
        (this.profile.maxClapDelaySeconds - this.profile.minClapDelaySeconds) * distance,
      gain: 1 - distance * 0.55,
      maskFloorSpike: this.profile.maskFloorSpike,
      maskDecaySeconds: this.profile.maskDecaySeconds,
    };
  }

  reset(): void {
    this.remainingSeconds = this.nextInterval();
  }

  private nextInterval(): number {
    return this.profile.minIntervalSeconds +
      (this.profile.maxIntervalSeconds - this.profile.minIntervalSeconds) * this.random();
  }
}

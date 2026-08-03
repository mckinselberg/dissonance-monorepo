import type { WhistleNote } from './AudioTypes';
import { BabylonAudioRuntime, RuntimeSound } from './BabylonAudioRuntime';
import {
  createBreathCatchWav,
  createBreathLoopWav,
  createDroneWav,
  createInsectsWav,
  createRainWav,
  createShelterChimeWav,
  createThunderWav,
  createTrailStepWav,
  createWhistleWav,
  createWindWav,
  dbToGain,
} from './ProceduralAudio';

export class BabylonAmbientAudio {
  static async create(runtime: BabylonAudioRuntime): Promise<BabylonAmbientAudio> {
    const [wind, insects, drone, rain, thunder] = await Promise.all([
      runtime.createSound('ambient-wind', createWindWav(), { bus: 'ambience', loop: true, maxInstances: 1 }),
      runtime.createSound('ambient-insects', createInsectsWav(), { bus: 'ambience', loop: true, maxInstances: 1 }),
      runtime.createSound('ambient-drone', createDroneWav(), { bus: 'ambience', loop: true, maxInstances: 1 }),
      runtime.createSound('ambient-rain', createRainWav(), { bus: 'ambience', loop: true, maxInstances: 1 }),
      runtime.createSound('ambient-thunder', createThunderWav(), { bus: 'ambience' }),
    ]);
    return new BabylonAmbientAudio(wind, insects, drone, rain, thunder);
  }

  private running = false;

  private constructor(
    private readonly wind: RuntimeSound,
    private readonly insects: RuntimeSound,
    private readonly drone: RuntimeSound,
    private readonly rain: RuntimeSound,
    private readonly thunder: RuntimeSound,
  ) {
    this.wind.setVolume(0.015);
    this.insects.setVolume(0);
    this.drone.setVolume(0.025);
    this.rain.setVolume(0);
  }

  start(): void {
    if (this.running) return;
    this.wind.play();
    this.insects.play();
    this.drone.play();
    this.rain.play();
    this.running = true;
  }

  stop(): void {
    if (!this.running) return;
    this.wind.stop();
    this.insects.stop();
    this.drone.stop();
    this.rain.stop();
    this.running = false;
  }

  setWeatherIntensity(intensity: number): void {
    // Weather's clear-mode wind is only ~0.05 before the user's volume
    // multiplier. A square-root curve keeps that floor audible while still
    // preserving zero as true silence and leaving headroom for gusts.
    this.wind.setVolume(Math.sqrt(clamp01(intensity)) * 0.35);
  }

  setRainIntensity(intensity: number): void {
    const amount = clamp01(intensity);
    this.rain.setVolume(amount * amount * 0.18);
  }

  playThunder(gain = 1, delaySeconds = 0): void {
    if (!this.running) return;
    this.thunder.play({
      volume: clamp01(gain) * 0.7,
      waitTime: Math.max(0, delaySeconds),
    });
  }

  setNightLevel(level: number): void {
    this.drone.setVolume(0.025 + clamp01(level) * 0.035);
  }

  dispose(): void {
    this.stop();
    this.wind.dispose();
    this.insects.dispose();
    this.drone.dispose();
    this.rain.dispose();
    this.thunder.dispose();
  }
}

export class BabylonHeartbeatAudio {
  private running = false;
  private timer: number | null = null;

  constructor(private readonly runtime: BabylonAudioRuntime) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleTick();
  }

  setStressLevel(_stress: number): void {
    // Heartbeat remains intentionally inaudible; its cadence only ducks
    // ambience and continues to drive the separate visual heartbeat system.
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
  }

  dispose(): void {
    this.stop();
  }

  private scheduleTick(): void {
    if (!this.running) return;
    this.timer = window.setTimeout(() => {
      if (!this.running) return;
      this.runtime.duckBus('ambience', dbToGain(-12), 0.38);
      this.scheduleTick();
    }, 60_000 / 65);
  }
}

export class BabylonShelterAlarmAudio {
  static async create(runtime: BabylonAudioRuntime): Promise<BabylonShelterAlarmAudio> {
    const chime = await runtime.createSound('shelter-locator', createShelterChimeWav(), {
      bus: 'world',
      maxInstances: 1,
    });
    return new BabylonShelterAlarmAudio(chime);
  }

  private timer: number | null = null;
  private running = false;
  private silenced = false;
  private intensity = 0;

  private constructor(private readonly chime: RuntimeSound) {}

  setProximity(intensity: number): void {
    if (this.silenced) return;
    this.intensity = clamp01(intensity);
    if (this.intensity > 0.01 && !this.running) {
      this.running = true;
      this.pulse();
    } else if (this.intensity <= 0.01) {
      this.stop();
    }
  }

  silence(): void {
    this.silenced = true;
    this.stop();
  }

  dispose(): void {
    this.stop();
    this.chime.dispose();
  }

  private pulse(): void {
    if (!this.running || this.silenced) return;
    this.chime.play({ volume: this.intensity * 0.12 });
    this.timer = window.setTimeout(() => this.pulse(), 2400);
  }

  private stop(): void {
    this.running = false;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    this.chime.stop();
  }
}

export class BabylonTrailPlayerAudio {
  static async create(runtime: BabylonAudioRuntime): Promise<BabylonTrailPlayerAudio> {
    const [breath, breathCatch, ...steps] = await Promise.all([
      runtime.createSound('player-breath', createBreathLoopWav(), {
        bus: 'world',
        loop: true,
        maxInstances: 1,
      }),
      runtime.createSound('player-breath-catch', createBreathCatchWav(), { bus: 'world' }),
      ...[0x51_e9_01, 0x51_e9_02, 0x51_e9_03, 0x51_e9_04].map((seed, index) =>
        runtime.createSound(`trail-step-${index + 1}`, createTrailStepWav(seed), {
          bus: 'world',
          maxInstances: 3,
          stereoEnabled: true,
        }),
      ),
    ]);
    return new BabylonTrailPlayerAudio(breath, breathCatch, steps);
  }

  private footstepInterval: number | null = null;
  private activeIntervalMs = 0;
  private breathMuted = false;
  private footstepMuted = false;
  private currentBreathLoad = 0;
  private lastBreathLoad = 0;
  private nextBreathCatchAt = 0;
  private nextStep = 0;
  private running = false;

  private constructor(
    private readonly breath: RuntimeSound,
    private readonly breathCatch: RuntimeSound,
    private readonly steps: RuntimeSound[],
  ) {
    this.breath.setVolume(0);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.breath.play();
  }

  stop(): void {
    this.running = false;
    this.breath.stop();
    this.clearFootstepInterval();
  }

  setBreathMuted(muted: boolean): void {
    this.breathMuted = muted;
    if (muted) this.breath.setVolume(0);
  }

  setFootstepMuted(muted: boolean): void {
    this.footstepMuted = muted;
  }

  updateBreath(breathLoad: number): void {
    const now = performance.now();
    this.currentBreathLoad = clamp01(breathLoad);
    const effort = this.breathMuted ? 0 : this.currentBreathLoad ** 1.55;
    this.breath.setVolume(effort * 0.23);
    this.breath.setPlaybackRate(0.72 + effort * 1.1);

    if (!this.running || this.breathMuted) {
      this.lastBreathLoad = this.currentBreathLoad;
      return;
    }
    if (this.currentBreathLoad > 0.68 && now >= this.nextBreathCatchAt) {
      const intensity = Math.min(1, (this.currentBreathLoad - 0.55) / 0.45);
      this.breathCatch.play({ volume: dbToGain(-24 + intensity * 5) });
      this.nextBreathCatchAt = now + 2300 - intensity * 850 + Math.random() * 450;
    }
    if (this.lastBreathLoad < 0.94 && this.currentBreathLoad >= 0.94) {
      this.breathCatch.play({ volume: dbToGain(-17) });
      this.nextBreathCatchAt = now + 1400;
    }
    this.lastBreathLoad = this.currentBreathLoad;
  }

  updateFootsteps(speed: number): void {
    if (!this.running || speed < 0.5) {
      this.clearFootstepInterval();
      return;
    }
    const intervalMs = speed < 5 ? 640 : speed < 8 ? 430 : 310;
    if (this.footstepInterval !== null && intervalMs === this.activeIntervalMs) return;
    this.clearFootstepInterval();
    this.activeIntervalMs = intervalMs;
    this.footstepInterval = window.setInterval(() => this.playStep(), intervalMs);
  }

  dispose(): void {
    this.stop();
    this.breath.dispose();
    this.breathCatch.dispose();
    for (const step of this.steps) step.dispose();
  }

  private playStep(): void {
    if (this.footstepMuted) return;
    const sound = this.steps[this.nextStep % this.steps.length];
    this.nextStep++;
    const volumeDb = -10 + this.currentBreathLoad * 6 + (Math.random() - 0.5) * 2;
    sound.setPan((Math.random() - 0.5) * 0.15);
    sound.play({ volume: dbToGain(volumeDb) });
  }

  private clearFootstepInterval(): void {
    if (this.footstepInterval !== null) window.clearInterval(this.footstepInterval);
    this.footstepInterval = null;
    this.activeIntervalMs = 0;
  }
}

export class BabylonWhistleAudio {
  private readonly sounds = new Map<string, Promise<RuntimeSound>>();
  private disposed = false;

  constructor(private readonly runtime: BabylonAudioRuntime) {}

  async playMelody(notes: WhistleNote[], volumeDb = -8): Promise<void> {
    if (this.disposed || notes.length === 0) return;
    const key = notes.map(({ note, time, duration }) => `${note}:${time}:${duration}`).join('|');
    let sound = this.sounds.get(key);
    if (!sound) {
      sound = this.runtime.createSound(`whistle-${this.sounds.size + 1}`, createWhistleWav(notes), {
        bus: 'world',
        maxInstances: 2,
      });
      this.sounds.set(key, sound);
    }
    try {
      const resolved = await sound;
      if (!this.disposed) resolved.play({ volume: dbToGain(volumeDb) });
    } catch (error: unknown) {
      if (!this.disposed) console.warn('Unable to play whistle melody.', error);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const sound of this.sounds.values()) {
      void sound.then((resolved) => resolved.dispose()).catch(() => {});
    }
    this.sounds.clear();
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

import type { Scene } from '@babylonjs/core';
import {
  BabylonAmbientAudio,
  BabylonAudioRuntime,
  BabylonHeartbeatAudio,
  BabylonShelterAlarmAudio,
  BabylonTrailPlayerAudio,
  BabylonWhistleAudio,
  type WhistleNote,
} from '@dissonance/audio/babylon';

export type WorldAudioEngineKind = 'babylon' | 'tone';

export interface WorldAmbientAudio {
  start(): void;
  stop(): void;
  setWeatherIntensity(intensity: number): void;
  setRainIntensity(intensity: number): void;
  playThunder(gain?: number, delaySeconds?: number): void;
  setNightLevel(level: number): void;
}

export interface WorldHeartbeatAudio {
  start(): void;
  stop(): void;
  setStressLevel(stress: number): void;
}

export interface WorldShelterAlarmAudio {
  setProximity(intensity: number): void;
  silence(): void;
}

export interface WorldPlayerAudio {
  start(): void;
  stop(): void;
  setBreathMuted(muted: boolean): void;
  setFootstepMuted(muted: boolean): void;
  updateBreath(breathLoad: number): void;
  updateFootsteps(speed: number): void;
}

export interface WorldAudioStack {
  readonly engineKind: WorldAudioEngineKind;
  readonly ambientAudio: WorldAmbientAudio;
  readonly heartbeatAudio: WorldHeartbeatAudio;
  readonly shelterAlarmAudio: WorldShelterAlarmAudio;
  readonly playerAudio: WorldPlayerAudio;
  unlock(): Promise<void>;
  setMuted(muted: boolean): void;
  playWhistle(notes: WhistleNote[]): void;
  dispose(): void;
}

export function resolveWorldAudioEngine(search: string, isDevelopment: boolean): WorldAudioEngineKind {
  // D1 (docs/THREADS.md): Tone.js owns the AudioContext, Babylon never plays
  // sound. Tone is the only engine in production; dev may force the legacy
  // Babylon stack via ?audioEngine=babylon for comparison.
  if (!isDevelopment) return 'tone';
  return new URLSearchParams(search).get('audioEngine') === 'babylon' ? 'babylon' : 'tone';
}

export async function createWorldAudioStack(
  scene: Scene,
  engineKind: WorldAudioEngineKind,
): Promise<WorldAudioStack> {
  if (engineKind === 'tone') return createToneAudioStack();
  return createBabylonAudioStack(scene);
}

async function createBabylonAudioStack(scene: Scene): Promise<WorldAudioStack> {
  const runtime = await BabylonAudioRuntime.forScene(scene);
  const [ambientAudio, shelterAlarmAudio, playerAudio] = await Promise.all([
    BabylonAmbientAudio.create(runtime),
    BabylonShelterAlarmAudio.create(runtime),
    BabylonTrailPlayerAudio.create(runtime),
  ]);
  const heartbeatAudio = new BabylonHeartbeatAudio(runtime);
  const whistleAudio = new BabylonWhistleAudio(runtime);
  runtime.setMasterVolume(0.5);

  let disposed = false;
  return {
    engineKind: 'babylon',
    ambientAudio,
    heartbeatAudio,
    shelterAlarmAudio,
    playerAudio,
    unlock: () => runtime.start(),
    setMuted: (muted) => runtime.setMuted(muted),
    playWhistle: (notes) => void whistleAudio.playMelody(notes),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      ambientAudio.dispose();
      heartbeatAudio.dispose();
      shelterAlarmAudio.dispose();
      playerAudio.dispose();
      whistleAudio.dispose();
      runtime.dispose();
    },
  };
}

async function createToneAudioStack(): Promise<WorldAudioStack> {
  const {
    AmbientAudio,
    AudioEngine,
    HeartbeatAudio,
    ShelterAlarmAudio,
    TrailPlayerAudio,
  } = await import('@dissonance/audio');
  const ambientAudio = new AmbientAudio();
  const heartbeatAudio = new HeartbeatAudio();
  const shelterAlarmAudio = new ShelterAlarmAudio();
  const playerAudio = new TrailPlayerAudio();

  let disposed = false;
  return {
    engineKind: 'tone',
    ambientAudio,
    heartbeatAudio,
    shelterAlarmAudio,
    playerAudio,
    unlock: () => AudioEngine.start(),
    setMuted: (muted) => AudioEngine.setMuted(muted),
    playWhistle: (notes) => AudioEngine.playWhistleMelody(notes),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      ambientAudio.stop();
      heartbeatAudio.dispose();
      shelterAlarmAudio.dispose();
      playerAudio.dispose();
    },
  };
}

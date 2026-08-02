import {
  CreateAudioEngineAsync,
  type AudioBus,
  type AudioEngineV2,
  type IStaticSoundOptions,
  type Node,
  type Observer,
  type Scene,
  type StaticSound,
  type Vector3,
} from '@babylonjs/core';

export const AUDIO_BUS_NAMES = ['music', 'ambience', 'world', 'ui'] as const;

export type AudioBusName = (typeof AUDIO_BUS_NAMES)[number];

export type AudioSource = ArrayBuffer | AudioBuffer | string | string[];

export type RuntimeSoundOptions = Omit<Partial<IStaticSoundOptions>, 'outBus'> & {
  bus?: AudioBusName;
};

export type AudioRuntimeState = AudioEngineV2['state'] | 'disposed';

/**
 * The feature-facing handle for a sound owned by BabylonAudioRuntime.
 *
 * Keeping Babylon's StaticSound private prevents callers from rerouting a
 * sound around the canonical buses or transferring it to another engine.
 */
export class RuntimeSound {
  private disposed = false;

  constructor(
    private readonly sound: StaticSound,
    private readonly release: (sound: RuntimeSound) => void,
  ) {}

  play(options?: Parameters<StaticSound['play']>[0]): void {
    this.assertUsable();
    this.sound.play(options);
  }

  pause(): void {
    this.assertUsable();
    this.sound.pause();
  }

  resume(): void {
    this.assertUsable();
    this.sound.resume();
  }

  stop(): void {
    if (this.disposed) return;
    this.sound.stop();
  }

  setVolume(volume: number): void {
    this.assertUsable();
    this.sound.volume = clampVolume(volume);
  }

  setPan(pan: number): void {
    this.assertUsable();
    this.sound.stereo.pan = Math.max(-1, Math.min(1, pan));
  }

  setPlaybackRate(playbackRate: number): void {
    this.assertUsable();
    this.sound.playbackRate = Math.max(0.01, playbackRate);
  }

  attachTo(node: Node | null): void {
    this.assertUsable();
    this.sound.spatial.attach(node);
  }

  setPosition(position: Vector3): void {
    this.assertUsable();
    this.sound.spatial.position = position;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.sound.dispose();
    this.release(this);
  }

  private assertUsable(): void {
    if (this.disposed) {
      throw new Error('Cannot use a disposed runtime sound.');
    }
  }
}

/**
 * The single Babylon.js Audio Engine V2 owner for one live game scene.
 *
 * Use forScene() instead of constructing an audio engine in feature code.
 * The runtime owns the listener, routing graph, sounds and teardown.
 */
export class BabylonAudioRuntime {
  private static readonly runtimes = new WeakMap<Scene, Promise<BabylonAudioRuntime>>();

  static forScene(scene: Scene): Promise<BabylonAudioRuntime> {
    const existing = this.runtimes.get(scene);
    if (existing) return existing;

    const pending = this.create(scene).catch((error: unknown) => {
      this.runtimes.delete(scene);
      throw error;
    });
    this.runtimes.set(scene, pending);
    return pending;
  }

  private static async create(scene: Scene): Promise<BabylonAudioRuntime> {
    if (scene.isDisposed) {
      throw new Error('Cannot create an audio runtime for a disposed scene.');
    }

    const engine = await CreateAudioEngineAsync({
      disableDefaultUI: true,
      listenerEnabled: true,
      resumeOnInteraction: false,
      resumeOnPause: false,
      volume: 1,
    });

    try {
      const master = engine.defaultMainBus;
      if (!master) {
        throw new Error('Babylon audio engine did not create a default main bus.');
      }
      master.name = 'master';

      const entries = await Promise.all(
        AUDIO_BUS_NAMES.map(async (name) => [name, await engine.createBusAsync(name, { outBus: master })] as const),
      );
      const buses = Object.fromEntries(entries) as Record<AudioBusName, AudioBus>;
      return new BabylonAudioRuntime(scene, engine, buses);
    } catch (error: unknown) {
      engine.dispose();
      throw error;
    }
  }

  private readonly sounds = new Set<RuntimeSound>();
  private readonly busVolumes: Record<AudioBusName, number> = {
    music: 1,
    ambience: 1,
    world: 1,
    ui: 1,
  };
  private readonly busDuckTimers: Partial<Record<AudioBusName, number>> = {};
  private readonly activeCameraObserver: Observer<Scene>;
  private readonly sceneDisposeObserver: Observer<Scene>;
  private disposed = false;
  private masterVolume = 1;
  private muted = false;

  private constructor(
    private readonly scene: Scene,
    private readonly engine: AudioEngineV2,
    private readonly buses: Readonly<Record<AudioBusName, AudioBus>>,
  ) {
    this.attachListenerToActiveCamera();
    this.activeCameraObserver = scene.onActiveCameraChanged.add(() => this.attachListenerToActiveCamera());
    this.sceneDisposeObserver = scene.onDisposeObservable.addOnce(() => this.dispose());
  }

  get state(): AudioRuntimeState {
    return this.disposed ? 'disposed' : this.engine.state;
  }

  /** Call from a user gesture before starting playback. */
  async start(): Promise<void> {
    this.assertUsable();
    await this.engine.unlockAsync();
  }

  async pause(): Promise<void> {
    this.assertUsable();
    await this.engine.pauseAsync();
  }

  async resume(): Promise<void> {
    this.assertUsable();
    await this.engine.resumeAsync();
  }

  setMuted(muted: boolean): void {
    this.assertUsable();
    this.muted = muted;
    this.applyMasterVolume();
  }

  setMasterVolume(volume: number): void {
    this.assertUsable();
    this.masterVolume = clampVolume(volume);
    this.applyMasterVolume();
  }

  setBusVolume(bus: AudioBusName, volume: number): void {
    this.assertUsable();
    const duckTimer = this.busDuckTimers[bus];
    if (duckTimer !== undefined) window.clearTimeout(duckTimer);
    delete this.busDuckTimers[bus];
    this.busVolumes[bus] = clampVolume(volume);
    this.buses[bus].volume = this.busVolumes[bus];
  }

  duckBus(bus: AudioBusName, gain: number, holdSeconds: number): void {
    this.assertUsable();
    const duckTimer = this.busDuckTimers[bus];
    if (duckTimer !== undefined) window.clearTimeout(duckTimer);
    this.buses[bus].volume = this.busVolumes[bus] * clampVolume(gain);
    this.busDuckTimers[bus] = window.setTimeout(() => {
      this.buses[bus].volume = this.busVolumes[bus];
      delete this.busDuckTimers[bus];
    }, Math.max(0, holdSeconds) * 1000);
  }

  async createSound(
    name: string,
    source: AudioSource,
    options: RuntimeSoundOptions = {},
  ): Promise<RuntimeSound> {
    this.assertUsable();
    const { bus = 'world', ...soundOptions } = options;
    const sound = await this.engine.createSoundAsync(name, source, {
      ...soundOptions,
      outBus: this.buses[bus],
    });

    if (this.disposed) {
      sound.dispose();
      throw new Error('Audio runtime was disposed while creating a sound.');
    }

    const handle = new RuntimeSound(sound, (released) => this.sounds.delete(released));
    this.sounds.add(handle);
    return handle;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    BabylonAudioRuntime.runtimes.delete(this.scene);
    this.scene.onActiveCameraChanged.remove(this.activeCameraObserver);
    this.scene.onDisposeObservable.remove(this.sceneDisposeObserver);
    this.engine.listener.detach();
    for (const timer of Object.values(this.busDuckTimers)) window.clearTimeout(timer);
    for (const sound of [...this.sounds]) sound.dispose();
    this.engine.dispose();
  }

  private attachListenerToActiveCamera(): void {
    this.engine.listener.attach(this.scene.activeCamera);
  }

  private applyMasterVolume(): void {
    this.engine.volume = this.muted ? 0 : this.masterVolume;
  }

  private assertUsable(): void {
    if (this.disposed) {
      throw new Error('Cannot use a disposed audio runtime.');
    }
  }
}

function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) return 0;
  return Math.max(0, Math.min(1, volume));
}

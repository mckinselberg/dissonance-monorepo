import { Engine, Scene, Vector3, MotionBlurPostProcess } from '@babylonjs/core';
import type { GameConfig, ExperienceProfile, RunProfile, PursuerState } from '@dissonance/shared-types';
import { SceneFactory, GameLoop } from '@dissonance/engine';
import { ForestGenerator, DaylightSystem, WeatherSystem, WatcherEffect, Terrain, CloudSystem, MountainRing } from '@dissonance/world';
import type { Collider, FoliageTechnique } from '@dissonance/world';
import { PlayerController, PLAYER_CONFIG } from '@dissonance/player';
import { AmbientAudio, PlayerAudio, AudioEngine, HeartbeatAudio } from '@dissonance/audio';
import { PursuerSystem } from '@dissonance/pursuit';

import { EXPERIENCE_PROFILES } from '../config/experienceProfiles';
import { RUN_PROFILES, PURSUER_CONFIG } from '../config/runProfiles';
import { DestinationSystem } from '../world/DestinationSystem';
import { PursuerAudio } from '../pursuer/PursuerAudio';
import { PursuerBody } from '../pursuer/PursuerBody';
import { ProximityOverlay } from '../ui/ProximityOverlay';

export interface GameDebugState {
  pursuerState: PursuerState;
  pursuerDistance: number;
  pursuerAggression: number;
  playerSpeed: number;
  breathLoad: number;
  adrenaline: number;
  destDistance: number;
  lightLevel: number;
  windIntensity: number;
  isHidden: boolean;
  isCrouching: boolean;
  fps: number;
}

export interface GameControls {
  setBellMultiplier: (v: number) => void;
  setWindOverride: (v: number | null) => void;
  setPursuerAudioMuted: (muted: boolean) => void;
  setBreathAudioMuted: (muted: boolean) => void;
  setWatcherEnabled: (enabled: boolean) => void;
  forceSpawnEyes: () => void;
  setPursuerBodyVisible: (visible: boolean) => void;
}

// ~235 units away — at jog speed ~35-40s in open air, ~3-4 min through the forest
const DEST_POS = new Vector3(190, 0, 140);

// Mountains are decorative geometry, not real colliders — this caps how far
// the player can wander so they can't walk straight through them. Kept a
// margin inside MountainRing's RING_RADIUS (340) so the boundary is never
// visible/felt before the mountain's own base is already in view.
const WORLD_BOUNDARY_RADIUS = 320;

const FOLIAGE_TECH_STORAGE_KEY = 'dta_foliage_tech';

function readFoliageTechnique(): FoliageTechnique {
  const raw = localStorage.getItem(FOLIAGE_TECH_STORAGE_KEY);
  return raw === 'noise' ? 'noise' : 'cluster';
}

export class Game {
  private engine: Engine;
  private scene: Scene;
  private loop: GameLoop;
  private player: PlayerController;
  private forest: ForestGenerator;
  private daylight: DaylightSystem;
  private weather: WeatherSystem;
  private destination: DestinationSystem;
  private pursuer: PursuerSystem;
  private pursuerAudio: PursuerAudio;
  private ambientAudio: AmbientAudio;
  private playerAudio: PlayerAudio;
  private watcher: WatcherEffect;
  private pursuerBody: PursuerBody;
  private terrain: Terrain;
  private clouds: CloudSystem;
  private mountains: MountainRing;
  private heartbeat: HeartbeatAudio;
  private proximity: ProximityOverlay;
  private colliders: Collider[] = [];
  private motionBlur: MotionBlurPostProcess;

  private expProfile: ExperienceProfile;
  private runProfile: RunProfile;

  private pursuerPos = { x: 0, z: 0 };
  private spawnPos = new Vector3(0, 1.7, 0);

  private isCaught = false;
  private catchFadeEl: HTMLElement | null = null;
  private hasWon = false;

  constructor(canvas: HTMLCanvasElement, config: GameConfig) {
    this.expProfile = EXPERIENCE_PROFILES[config.experienceMode];
    this.runProfile = RUN_PROFILES[config.departureTime];

    const { engine, scene } = SceneFactory.create(canvas, this.expProfile, this.runProfile);
    this.engine = engine;
    this.scene = scene;

    this.terrain = new Terrain(scene, this.expProfile);
    this.clouds = new CloudSystem(scene, this.expProfile);
    this.mountains = new MountainRing(scene, this.expProfile);

    // DaylightSystem must exist before the forest is generated — its
    // ShadowGenerator (off the sun/moonlight) needs to be handed to
    // ForestGenerator so trunks/branches/rocks register as shadow casters
    // as they're built.
    this.daylight = new DaylightSystem(scene, this.runProfile, this.expProfile);

    // Forest must exist before we pick a spawn point — otherwise spawn
    // can land inside an obstacle collider with no way to confirm it's
    // clear, which is exactly what trapped the player permanently.
    this.forest = new ForestGenerator();
    this.forest.generate(
      scene, this.expProfile, DEST_POS, this.terrain, readFoliageTechnique(),
      this.daylight.getShadowGenerator(),
    );
    this.colliders = this.forest.getColliders();

    this.spawnPos = Game.pickRandomSpawn(this.terrain, this.colliders);
    this.pursuerPos = Game.pickPursuerStart(this.spawnPos);

    this.player = new PlayerController(scene, this.spawnPos.clone());
    this.player.setTerrain(this.terrain);
    this.player.setColliders(this.colliders);
    this.player.setWorldBoundaryRadius(WORLD_BOUNDARY_RADIUS);

    this.motionBlur = SceneFactory.createPostProcessing(scene, this.player.camera).motionBlur;

    this.weather = new WeatherSystem(scene);
    this.weather.setMode('clear');

    this.destination = new DestinationSystem(DEST_POS);
    this.pursuer = new PursuerSystem(PURSUER_CONFIG);
    this.pursuerAudio = new PursuerAudio();
    this.ambientAudio = new AmbientAudio();
    this.playerAudio = new PlayerAudio();
    this.watcher = new WatcherEffect(scene, config.experienceMode);
    this.pursuerBody = new PursuerBody(scene, config.experienceMode);

    this.heartbeat = new HeartbeatAudio();
    this.proximity = new ProximityOverlay();
    this.catchFadeEl = this.createFadeOverlay();

    this.loop = new GameLoop(engine, (dt) => this.tick(dt));
  }

  async start(): Promise<void> {
    await AudioEngine.start();
    this.ambientAudio.start();
    this.playerAudio.start();
    this.destination.start();

    setTimeout(() => {
      this.weather.setMode('windy');
    }, 30_000);

    this.heartbeat.start();
    this.loop.start();
  }

  private tick(dt: number): void {
    if (this.isCaught || this.hasWon) return;

    this.player.update(dt);
    const playerPos = this.player.getPosition();
    const speed = this.player.getSpeed();

    // Motion blur only kicks in once actually running (jog speed and
    // below stay blur-free), ramping to its max at full sprint — a
    // constant blur regardless of movement just reads as a smeared image,
    // not as "you're moving fast."
    const runFactor = Math.max(0, Math.min(1,
      (speed - PLAYER_CONFIG.jogSpeed) / (PLAYER_CONFIG.sprintSpeed - PLAYER_CONFIG.jogSpeed),
    ));
    this.motionBlur.motionStrength = runFactor * 0.12;

    const playerPos2d = { x: playerPos.x, z: playerPos.z };
    const hasLoS = this.checkLineOfSight(playerPos2d, this.pursuerPos);
    this.pursuer.update(dt, speed, playerPos2d, this.pursuerPos, hasLoS, this.player.isCrouching);
    const pursuerModel = this.pursuer.getModel();
    this.player.adrenaline.update(dt, pursuerModel.state);

    const camYaw = this.player.camera.rotation.y;
    const dpx = this.pursuerPos.x - playerPos.x;
    const dpz = this.pursuerPos.z - playerPos.z;
    const angleToP = Math.atan2(dpx, dpz);
    const relAngle = angleToP - camYaw;
    const pan = Math.max(-1, Math.min(1, Math.sin(relAngle)));

    const weatherMask = this.weather.getMaskLevel();
    this.pursuerAudio.update(dt, pan, pursuerModel.state, weatherMask);

    const pursuerGroundY = this.terrain.getHeightAt(this.pursuerPos.x, this.pursuerPos.z);

    this.watcher.update(
      dt,
      playerPos,
      camYaw,
      this.pursuerPos,
      pursuerModel.state,
      pursuerGroundY,
      () => this.player.adrenaline.spike(0.22),
    );
    this.pursuerBody.update(dt, this.pursuerPos, pursuerGroundY);

    this.clouds.update(dt);

    this.daylight.update(dt, this.runProfile, this.expProfile);
    this.ambientAudio.setNightLevel(this.daylight.getNightLevel());

    this.weather.update(dt, (v) => this.ambientAudio.setWeatherIntensity(v));

    SceneFactory.updateFog(
      this.scene,
      this.expProfile.fogDensity,
      this.daylight.getLightLevel(),
      weatherMask,
    );

    this.destination.update(playerPos);
    if (this.destination.isReached()) {
      this.triggerWin();
      return;
    }

    const adrenaline = this.player.adrenaline.getLevel();
    this.playerAudio.updateBreath(this.player.breath.getLoad());
    this.playerAudio.updateFootsteps(speed);
    this.heartbeat.setStressLevel(adrenaline);
    this.pursuerBody.setStress(adrenaline);
    this.proximity.update(dt, pursuerModel.state, adrenaline);

    if (pursuerModel.state === 'caught') {
      this.triggerCatch();
      return;
    }

    this.scene.render();
  }

  private checkLineOfSight(
    playerPos: { x: number; z: number },
    pursuerPos: { x: number; z: number },
  ): boolean {
    const ddx = playerPos.x - pursuerPos.x;
    const ddz = playerPos.z - pursuerPos.z;
    const len2 = ddx * ddx + ddz * ddz;
    if (len2 < 0.01) return true;

    for (const c of this.colliders) {
      const tx  = c.x - pursuerPos.x;
      const tz  = c.z - pursuerPos.z;
      const t   = Math.max(0.05, Math.min(0.95, (tx * ddx + tz * ddz) / len2));
      const px  = pursuerPos.x + t * ddx - c.x;
      const pz  = pursuerPos.z + t * ddz - c.z;
      const r   = c.radius + 0.18;
      if (px * px + pz * pz < r * r) return false;
    }
    return true;
  }

  private triggerCatch(): void {
    this.isCaught = true;

    const pp = this.player.getPosition();
    this.spawnPos = new Vector3(pp.x, pp.y, pp.z);

    AudioEngine.playBranchSnap(0, 0);
    this.fadeOut(800).then(() => { this.restart(); });
  }

  private triggerWin(): void {
    this.hasWon = true;
    this.destination.stop();

    this.fadeOut(3000).then(() => {
      this.showWinText();
    });
  }

  private restart(): void {
    this.player.reset(this.spawnPos.clone());

    this.pursuerPos = Game.pickPursuerStart(this.spawnPos);
    this.pursuer.reset();
    this.destination.reset();
    this.destination.start();

    this.isCaught = false;
    this.hasWon = false;
    this.fadeIn(1200);
  }

  private static pickRandomSpawn(terrain: Terrain, colliders: Collider[]): Vector3 {
    const DEST_X = 190, DEST_Z = 140;
    const MIN_DIST_SQ = 110 * 110;
    const SAFETY_MARGIN = 1.5;

    const isClear = (x: number, z: number): boolean => {
      for (const c of colliders) {
        const dx = x - c.x, dz = z - c.z;
        const r = c.radius + SAFETY_MARGIN;
        if (dx * dx + dz * dz < r * r) return false;
      }
      return true;
    };

    for (let i = 0; i < 120; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 45 + Math.random() * 95;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const dx = x - DEST_X, dz = z - DEST_Z;
      if (dx * dx + dz * dz < MIN_DIST_SQ) continue;
      if (!isClear(x, z)) continue;
      const y = terrain.getHeightAt(x, z) + 1.7;
      return new Vector3(x, y, z);
    }
    // Fallback also needs to be collider-free, since this spot is used
    // unconditionally if every random attempt above failed.
    for (let i = 0; i < 60; i++) {
      const x = -40 - Math.random() * 60;
      const z = -40 - Math.random() * 60;
      if (!isClear(x, z)) continue;
      return new Vector3(x, terrain.getHeightAt(x, z) + 1.7, z);
    }
    return new Vector3(-70, terrain.getHeightAt(-70, -80) + 1.7, -80);
  }

  private static pickPursuerStart(playerSpawn: Vector3): { x: number; z: number } {
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 155 + Math.random() * 35;
      const x = playerSpawn.x + Math.cos(angle) * r;
      const z = playerSpawn.z + Math.sin(angle) * r;
      if (Math.abs(x) > 185 || Math.abs(z) > 185) continue;
      return { x, z };
    }
    const fx = Math.max(-185, Math.min(185, -playerSpawn.x * 1.5));
    const fz = Math.max(-185, Math.min(185, -playerSpawn.z * 1.5));
    return { x: fx, z: fz };
  }

  private createFadeOverlay(): HTMLElement {
    const fadeEl = document.createElement('div');
    fadeEl.style.cssText = `
      position: fixed; inset: 0; background: #000;
      opacity: 0; pointer-events: none;
      transition: none; z-index: 100;
    `;
    document.body.appendChild(fadeEl);
    return fadeEl;
  }

  private fadeOut(ms: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.catchFadeEl) { resolve(); return; }
      this.catchFadeEl.style.transition = `opacity ${ms}ms ease-in`;
      this.catchFadeEl.style.opacity = '1';
      setTimeout(resolve, ms);
    });
  }

  private fadeIn(ms: number): void {
    if (!this.catchFadeEl) return;
    this.catchFadeEl.style.transition = `opacity ${ms}ms ease-out`;
    this.catchFadeEl.style.opacity = '0';
  }

  private showWinText(): void {
    const winEl = document.createElement('div');
    winEl.style.cssText = `
      position: fixed; inset: 0; display: flex; align-items: center;
      justify-content: center; background: #000; z-index: 200;
    `;
    winEl.innerHTML = `<p style="color:#888;font-family:monospace;font-size:1.1rem;letter-spacing:0.2em;text-align:center;line-height:2em">
      you made it<br><br>
      <span style="font-size:0.7rem;color:#444">press F5 to go again</span>
    </p>`;
    document.body.appendChild(winEl);
  }

  getDebugState(): GameDebugState {
    const m = this.pursuer.getModel();
    const pp = this.player.getPosition();
    return {
      pursuerState: m.state,
      pursuerDistance: m.distance,
      pursuerAggression: m.aggression,
      playerSpeed: this.player.getSpeed(),
      breathLoad: this.player.breath.getLoad(),
      adrenaline: this.player.adrenaline.getLevel(),
      destDistance: this.destination.getDistance(pp),
      lightLevel: this.daylight.getLightLevel(),
      windIntensity: this.weather.getMaskLevel(),
      isHidden: this.pursuer.getModel().isHidden,
      isCrouching: this.player.isCrouching,
      fps: this.engine.getFps(),
    };
  }

  getControls(): GameControls {
    return {
      setBellMultiplier: (v) => this.destination.setGainMultiplier(v),
      setWindOverride: (v) => this.weather.setWindOverride(v),
      setPursuerAudioMuted: (muted) => this.pursuerAudio.setMuted(muted),
      setBreathAudioMuted: (muted) => this.playerAudio.setBreathMuted(muted),
      setWatcherEnabled: (enabled) => this.watcher.setEnabled(enabled),
      forceSpawnEyes: () => {
        const pp = this.player.getPosition();
        this.watcher.forceSpawn(
          this.pursuerPos,
          { x: pp.x, z: pp.z },
          'close',
          this.terrain.getHeightAt(this.pursuerPos.x, this.pursuerPos.z),
        );
      },
      setPursuerBodyVisible: (visible) => this.pursuerBody.setVisible(visible),
    };
  }

  dispose(): void {
    this.loop.stop();
    this.destination.dispose();
    this.ambientAudio.stop();
    this.playerAudio.dispose();
    this.watcher.dispose();
    this.pursuerBody.dispose();
    this.forest.dispose();
    this.terrain.dispose();
    this.clouds.dispose();
    this.mountains.dispose();
    this.heartbeat.dispose();
    this.proximity.dispose();
    this.engine.dispose();
    this.catchFadeEl?.remove();
  }
}

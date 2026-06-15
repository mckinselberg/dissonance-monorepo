import { Engine, Scene, Vector3 } from '@babylonjs/core';
import type { GameConfig, ExperienceProfile, RunProfile, PursuerState } from '../types';

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
import { EXPERIENCE_PROFILES } from '../config/experienceProfiles';
import { RUN_PROFILES } from '../config/runProfiles';
import { SceneFactory } from './SceneFactory';
import { GameLoop } from './GameLoop';
import { PlayerController } from '../player/PlayerController';
import { ForestGenerator } from '../world/ForestGenerator';
import { DaylightSystem } from '../world/DaylightSystem';
import { WeatherSystem } from '../world/WeatherSystem';
import { DestinationSystem } from '../world/DestinationSystem';
import { PursuerSystem } from '../pursuer/PursuerSystem';
import { PursuerAudio } from '../pursuer/PursuerAudio';
import { AmbientAudio } from '../audio/AmbientAudio';
import { PlayerAudio } from '../audio/PlayerAudio';
import { AudioEngine } from '../audio/AudioEngine';
import { WatcherEffect } from '../world/WatcherEffect';
import { PursuerBody } from '../pursuer/PursuerBody';
import { Terrain } from '../world/Terrain';
import { CloudSystem } from '../world/CloudSystem';
import { MountainRing } from '../world/MountainRing';
import { HeartbeatAudio } from '../audio/HeartbeatAudio';
import { ProximityOverlay } from '../ui/ProximityOverlay';
import type { Collider } from '../world/ForestGenerator';

// ~235 units away — at jog speed ~35-40s in open air, ~3-4 min through the forest
const DEST_POS = new Vector3(190, 0, 140);

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

  private expProfile: ExperienceProfile;
  private runProfile: RunProfile;

  private pursuerPos = { x: 0, z: 0 };  // set in constructor
  private spawnPos = new Vector3(0, 1.7, 0);  // updated on death

  // Catch feedback state
  private isCaught = false;
  private catchFadeEl: HTMLElement | null = null;

  // Win state
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

    this.spawnPos = Game.pickRandomSpawn(this.terrain);
    this.pursuerPos = Game.pickPursuerStart(this.spawnPos);

    this.player = new PlayerController(scene, this.spawnPos.clone());
    this.player.setTerrain(this.terrain);

    this.forest = new ForestGenerator();
    this.forest.generate(scene, this.expProfile, DEST_POS, this.terrain);
    this.colliders = this.forest.getColliders();
    this.player.setColliders(this.colliders);

    this.daylight = new DaylightSystem(scene, this.runProfile, this.expProfile);
    this.weather = new WeatherSystem(scene);
    this.weather.setMode('clear');

    this.destination = new DestinationSystem(DEST_POS);
    this.pursuer = new PursuerSystem();
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

    // Introduce wind after 30s
    setTimeout(() => {
      this.weather.setMode('windy');
    }, 30_000);

    this.heartbeat.start();
    this.loop.start();
  }

  private tick(dt: number): void {
    if (this.isCaught || this.hasWon) return;

    // Player
    this.player.update(dt);
    const playerPos = this.player.getPosition();
    const speed = this.player.getSpeed();

    // Pursuer — LoS check gates aggression and speed
    const playerPos2d = { x: playerPos.x, z: playerPos.z };
    const hasLoS = this.checkLineOfSight(playerPos2d, this.pursuerPos);
    this.pursuer.update(dt, speed, playerPos2d, this.pursuerPos, hasLoS, this.player.isCrouching);
    const pursuerModel = this.pursuer.getModel();
    this.player.adrenaline.update(dt, pursuerModel.state);

    // Pursuer audio panning — angle from player forward
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

    // Clouds
    this.clouds.update(dt);

    // Daylight
    this.daylight.update(dt, this.runProfile, this.expProfile);
    this.ambientAudio.setNightLevel(this.daylight.getNightLevel());

    // Weather
    this.weather.update(dt, this.ambientAudio);

    // Fog
    SceneFactory.updateFog(
      this.scene,
      this.expProfile.fogDensity,
      this.daylight.getLightLevel(),
      weatherMask,
    );

    // Destination
    this.destination.update(playerPos);
    if (this.destination.isReached()) {
      this.triggerWin();
      return;
    }

    // Player audio + stress systems
    const adrenaline = this.player.adrenaline.getLevel();
    this.playerAudio.updateBreath(this.player.breath.getLoad());
    this.playerAudio.updateFootsteps(speed);
    this.heartbeat.setStressLevel(adrenaline);
    this.pursuerBody.setStress(adrenaline);
    this.proximity.update(dt, pursuerModel.state, adrenaline);

    // Catch check
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
      // Project collider centre onto the pursuer→player segment
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

    // Remember the death location — player respawns here next run
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

    // Pursuer starts fresh and far from the respawn point
    this.pursuerPos = Game.pickPursuerStart(this.spawnPos);
    this.pursuer.reset();
    this.destination.reset();
    this.destination.start();

    this.isCaught = false;
    this.hasWon = false;
    this.fadeIn(1200);
  }

  // ── Spawn helpers ─────────────────────────────────────────────────────────

  private static pickRandomSpawn(terrain: Terrain): Vector3 {
    const DEST_X = 190, DEST_Z = 140;
    const MIN_DIST_SQ = 110 * 110;

    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 45 + Math.random() * 95;  // 45–140 units from world centre
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const dx = x - DEST_X, dz = z - DEST_Z;
      if (dx * dx + dz * dz < MIN_DIST_SQ) continue;  // too close to bell tower
      const y = terrain.getHeightAt(x, z) + 1.7;
      return new Vector3(x, y, z);
    }
    // Fallback — reliable far corner
    return new Vector3(-70, terrain.getHeightAt(-70, -80) + 1.7, -80);
  }

  private static pickPursuerStart(playerSpawn: Vector3): { x: number; z: number } {
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 155 + Math.random() * 35;  // 155–190 units from player
      const x = playerSpawn.x + Math.cos(angle) * r;
      const z = playerSpawn.z + Math.sin(angle) * r;
      if (Math.abs(x) > 185 || Math.abs(z) > 185) continue;  // outside map
      return { x, z };
    }
    // Fallback — roughly opposite the spawn
    const fx = Math.max(-185, Math.min(185, -playerSpawn.x * 1.5));
    const fz = Math.max(-185, Math.min(185, -playerSpawn.z * 1.5));
    return { x: fx, z: fz };
  }

  private createFadeOverlay(): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed; inset: 0; background: #000;
      opacity: 0; pointer-events: none;
      transition: none; z-index: 100;
    `;
    document.body.appendChild(el);
    return el;
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
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed; inset: 0; display: flex; align-items: center;
      justify-content: center; background: #000; z-index: 200;
    `;
    el.innerHTML = `<p style="color:#888;font-family:monospace;font-size:1.1rem;letter-spacing:0.2em;text-align:center;line-height:2em">
      you made it<br><br>
      <span style="font-size:0.7rem;color:#444">press F5 to go again</span>
    </p>`;
    document.body.appendChild(el);
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

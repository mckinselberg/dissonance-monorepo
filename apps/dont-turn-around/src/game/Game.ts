import {
  Engine,
  Scene,
  Vector3,
  MotionBlurPostProcess,
  DefaultRenderingPipeline,
  AbstractMesh,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
} from '@babylonjs/core';
import type { GameConfig, ExperienceProfile, RunProfile, PursuerState } from '@dissonance/shared-types';
import { SceneFactory, GameLoop } from '@dissonance/engine';
import {
  ForestGenerator,
  DaylightSystem,
  WeatherSystem,
  WatcherEffect,
  Terrain,
  CloudSystem,
  MountainRing,
  WildlifeSystem,
} from '@dissonance/world';
import type { Collider } from '@dissonance/world';
import { PlayerController, PLAYER_CONFIG } from '@dissonance/player';
import { AmbientAudio, PlayerAudio, AudioEngine, HeartbeatAudio, RiverAudio } from '@dissonance/audio';
import { PursuerSystem } from '@dissonance/pursuit';

import { EXPERIENCE_PROFILES } from '../config/experienceProfiles';
import { RUN_PROFILES, buildPursuerConfig } from '../config/runProfiles';
import { DEFAULT_TRAIL_ID, TRAILS } from '../config/trails';
import type { TrailDefinition } from '../config/trails';
import { DestinationSystem } from '../world/DestinationSystem';
import { PursuerAudio } from '../pursuer/PursuerAudio';
import { PursuerBody } from '../pursuer/PursuerBody';
import { ProximityOverlay } from '../ui/ProximityOverlay';
import { BreathOverlay } from '../ui/BreathOverlay';
import { InventoryUI } from '../ui/InventoryUI';
import { InstructionsOverlay } from '../ui/InstructionsOverlay';
import { TrailIntroOverlay } from '../ui/TrailIntroOverlay';
import { InventorySystem } from '../items/InventorySystem';
import { PhoneProp } from '../items/PhoneProp';
import { ArtifactProp } from '../items/ArtifactProp';
import { PlayerHand } from '../player/PlayerHand';

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
  hasLoS: boolean;
  isIlluminated: boolean;
  flashlightOn: boolean;
  hasPhone: boolean;
  carFobUnlocked: boolean;
  carAlarmSilenced: boolean;
}

export interface GameControls {
  setBellMultiplier: (v: number) => void;
  setWindOverride: (v: number | null) => void;
  setPursuerAudioMuted: (muted: boolean) => void;
  setBreathAudioMuted: (muted: boolean) => void;
  setPursuerBodyVisible: (visible: boolean) => void;
  setSSAOEnabled: (enabled: boolean) => void;
  setPostFXEnabled: (enabled: boolean) => void;
  setShadowsEnabled: (enabled: boolean) => void;
}

// ~235 units away — at jog speed ~35-40s in open air, ~3-4 min through the forest
// Mountains are decorative geometry, not real colliders — this caps how far
// the player can wander so they can't walk straight through them. Kept a
// margin inside MountainRing's RING_RADIUS (340) so the boundary is never
// visible/felt before the mountain's own base is already in view.
const WORLD_BOUNDARY_RADIUS = 320;

// Distance at which the river ambience fades to silent — wide enough that
// it's audible well before the water is in sightline, so it can act as a
// beacon through dense forest.
const RIVER_AUDIBLE_RANGE = 70;

// Tree count/draw distance are baked into world generation, so toggling
// this requires a reload — same pattern as the PS1/RADIO mode switch.
const PERF_MODE_STORAGE_KEY = 'dta_perf_mode';

function readLowSpecMode(): boolean {
  return localStorage.getItem(PERF_MODE_STORAGE_KEY) === 'low';
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
  private riverAudio: RiverAudio | null = null;
  private watcher: WatcherEffect;
  private pursuerBody: PursuerBody;
  private terrain: Terrain;
  private clouds: CloudSystem;
  private mountains: MountainRing;
  private wildlife: WildlifeSystem;
  private heartbeat: HeartbeatAudio;
  private proximity: ProximityOverlay;
  private breathOverlay: BreathOverlay;
  private instructions: InstructionsScreen;
  private inventory: InventorySystem;
  private inventoryUI: InventoryUI;
  private instructions: InstructionsOverlay;
  private trailIntro: TrailIntroOverlay;
  private trail: TrailDefinition;
  private phoneProp: PhoneProp | null = null;
  private artifactProp: ArtifactProp | null = null;
  private playerHand: PlayerHand | null = null;
  private phoneFlashlightOn = false;
  private mouseDownHandler: ((e: PointerEvent) => void) | null = null;
  private keyDownHandler: ((e: KeyboardEvent) => void) | null = null;
  private carFobUnlocked = false;
  private carAlarmSilenced = false;
  private fobCooldown = 0;
  private colliders: Collider[] = [];
  private lastHasLoS = false;
  private lastIlluminated = false;
  private motionBlur: MotionBlurPostProcess | null;
  private postFXPipeline: DefaultRenderingPipeline | null;
  private lowSpec: boolean;
  private savedShadowCasters: AbstractMesh[] | null = null;
  private atmosphericParticles: Mesh[] = [];
  private toastEl: HTMLElement | null = null;
  private toastHideTimer: number | null = null;
  private toastRemoveTimer: number | null = null;

  private expProfile: ExperienceProfile;
  private runProfile: RunProfile;

  private pursuerPos = { x: 0, z: 0 };
  private spawnPos = new Vector3(0, 1.7, 0);

  private isCaught = false;
  private catchFadeEl: HTMLElement | null = null;
  private hasWon = false;
  private proximityRustleCooldown = 0;
  private objectiveToastCooldown = 0;
  private fobToastShown = false;

  constructor(canvas: HTMLCanvasElement, config: GameConfig) {
    this.lowSpec = readLowSpecMode();
    this.trail = TRAILS[config.trailId ?? DEFAULT_TRAIL_ID] ?? TRAILS[DEFAULT_TRAIL_ID];
    this.expProfile = EXPERIENCE_PROFILES[config.experienceMode];
    if (this.lowSpec) {
      // Tree count and draw distance drive total scene complexity more
      // than anything else we control — cut both substantially, and
      // densify fog a bit to mask the shorter visible range rather than
      // letting it cut off abruptly.
      this.expProfile = {
        ...this.expProfile,
        treeCount: Math.round(this.expProfile.treeCount * 0.4),
        drawDistance: Math.round(this.expProfile.drawDistance * 0.65),
        fogDensity: this.expProfile.fogDensity * 1.3,
      };
    }
    this.runProfile = RUN_PROFILES[config.departureTime];
    const destinationPos = new Vector3(
      this.trail.destinationPosition.x,
      this.trail.destinationPosition.y,
      this.trail.destinationPosition.z,
    );

    const { engine, scene } = SceneFactory.create(canvas, this.expProfile, this.runProfile);
    this.engine = engine;
    this.scene = scene;

    // sun + ambient + 2 lamp posts + flashlight = 5 lights, exceeding the default
    // maxSimultaneousLights=4. Raise the budget on ALL material types (PBRMaterial
    // for terrain/trees, StandardMaterial for ground cover) before any geometry is
    // built so every shader includes the flashlight slot.
    scene.onNewMaterialAddedObservable.add((m) => {
      if ('maxSimultaneousLights' in m) (m as any).maxSimultaneousLights = 6;
    });

    this.terrain = new Terrain(scene, this.expProfile, {
      destinationPosition: this.trail.destinationPosition,
      flavor: this.trail.worldFlavor,
    });
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
      scene,
      this.expProfile,
      destinationPos,
      this.terrain,
      this.lowSpec ? undefined : this.daylight.getShadowGenerator(),
      { flavor: this.trail.worldFlavor, waypoints: this.trail.waypoints },
    );
    this.colliders = this.forest.getColliders();

    this.spawnPos = Game.pickRandomSpawn(this.terrain, this.colliders, this.trail.spawnPosition);
    this.pursuerPos = Game.pickPursuerStart(this.spawnPos);
    this.wildlife = new WildlifeSystem(scene, this.expProfile, this.terrain, this.spawnPos);

    this.player = new PlayerController(scene, this.spawnPos.clone());
    if (this.expProfile.mode === 'ps3') {
      this.player.setFlashlightTuning({
        intensity: 4.8,
        range: 40,
        angle: Math.PI / 4.5,
        exponent: 3.1,
        color: { r: 1.0, g: 0.82, b: 0.55 },
      });
    } else if (this.expProfile.mode === 'ps2') {
      this.player.setFlashlightTuning({
        intensity: 4.1,
        range: 32,
        angle: Math.PI / 4.7,
        exponent: 3.4,
        color: { r: 1.0, g: 0.78, b: 0.48 },
      });
    }
    this.player.setTerrain(this.terrain);
    this.player.setColliders(this.colliders);
    this.player.setWorldBoundaryRadius(WORLD_BOUNDARY_RADIUS);

    if (this.lowSpec) {
      // SSAO/bloom/grain/motion-blur are all real per-pixel GPU cost —
      // skip creating them entirely rather than creating-then-disabling.
      this.motionBlur = null;
      this.postFXPipeline = null;
    } else {
      const postFX = SceneFactory.createPostProcessing(scene, this.player.camera, this.expProfile);
      this.motionBlur = postFX.motionBlur;
      this.postFXPipeline = postFX.pipeline;
    }

    this.weather = new WeatherSystem(scene);
    this.weather.setMode('clear');
    if (this.expProfile.mode === 'ps2' || this.expProfile.mode === 'ps3') this.createAtmosphericParticles(scene);

    this.destination = new DestinationSystem(destinationPos);
    this.destination.setChirpCallback(() => this.forest.flashCarLights());
    this.pursuer = new PursuerSystem(buildPursuerConfig(this.trail.pursuerProfile));
    this.pursuerAudio = new PursuerAudio();
    this.ambientAudio = new AmbientAudio();
    this.playerAudio = new PlayerAudio();
    this.riverAudio = this.trail.worldFlavor === 'river' ? new RiverAudio() : null;
    this.watcher = new WatcherEffect(scene, config.experienceMode);
    this.pursuerBody = new PursuerBody(scene, config.experienceMode);

    this.heartbeat = new HeartbeatAudio();
    this.proximity = new ProximityOverlay();
    this.breathOverlay = new BreathOverlay();
    this.inventory = new InventorySystem();
    this.inventoryUI = new InventoryUI();
    this.instructions = new InstructionsOverlay();
    this.trailIntro = new TrailIntroOverlay();
    this.catchFadeEl = this.createFadeOverlay();

    // Flashlight off until the phone prop is picked up
    this.player.setFlashlightEnabled(false);
    this.spawnPhoneProp();
    this.spawnArtifactProp();
    this.trailIntro.show(this.trail);

    this.playerHand = new PlayerHand(scene, this.player.camera);

    this.mouseDownHandler = (e: PointerEvent) => {
      if (e.button !== 2) return;
      if (this.player.isLocked && this.inventory.hasItem('phone')) {
        e.preventDefault();
        this.togglePhone();
      }
    };
    // capture phase fires before BabylonJS canvas handlers, reliable during pointer lock
    window.addEventListener('pointerdown', this.mouseDownHandler, true);

    this.keyDownHandler = (e: KeyboardEvent) => {
      if (e.code !== 'KeyF') return;
      if (!this.player.isLocked) return;
      e.preventDefault();
      this.useKeyFob();
    };
    window.addEventListener('keydown', this.keyDownHandler, true);

    this.loop = new GameLoop(engine, (dt) => this.tick(dt));
  }

  async start(): Promise<void> {
    await AudioEngine.start();
    this.ambientAudio.start();
    this.playerAudio.start();
    this.riverAudio?.start();
    if (this.trail.alarmMode === 'continuous_until_visible') {
      this.destination.start();
    }

    setTimeout(() => {
      this.weather.setMode('windy');
    }, 30_000);

    this.heartbeat.start();
    this.loop.start();
  }

  private tick(dt: number): void {
    if (this.isCaught || this.hasWon) return;
    this.objectiveToastCooldown = Math.max(0, this.objectiveToastCooldown - dt);
    this.fobCooldown = Math.max(0, this.fobCooldown - dt);

    this.player.update(dt);
    const playerPos = this.player.getPosition();
    const speed = this.player.getSpeed();

    // Motion blur only kicks in once actually running (jog speed and
    // below stay blur-free), ramping to its max at full sprint — a
    // constant blur regardless of movement just reads as a smeared image,
    // not as "you're moving fast."
    if (this.motionBlur) {
      const runFactor = Math.max(
        0,
        Math.min(1, (speed - PLAYER_CONFIG.jogSpeed) / (PLAYER_CONFIG.sprintSpeed - PLAYER_CONFIG.jogSpeed)),
      );
      this.motionBlur.motionStrength = runFactor * 0.12;
    }

    const playerPos2d = { x: playerPos.x, z: playerPos.z };
    const hasLoS = this.checkLineOfSight(playerPos2d, this.pursuerPos);

    // Illumination check happens before pursuer.update() moves the
    // pursuer — one frame stale against where it ends up, imperceptible
    // at frame rate, but needed so the flee response can feed into the
    // same update() call that would otherwise have it approach.
    const preMoveGroundY = this.terrain.getHeightAt(this.pursuerPos.x, this.pursuerPos.z);
    const pursuerCenter = new Vector3(this.pursuerPos.x, preMoveGroundY + 0.9, this.pursuerPos.z);
    const isIlluminated = hasLoS && this.player.isPointIlluminated(pursuerCenter);
    const flashlightPressure = hasLoS ? this.player.getFlashlightPressure(pursuerCenter) : 0;
    const artifactRecovered = this.inventory.hasItem(this.trail.artifact.id);
    this.pursuerBody.setIlluminated(isIlluminated);
    this.lastHasLoS = hasLoS;
    this.lastIlluminated = isIlluminated;

    this.pursuer.update(
      dt,
      speed,
      playerPos2d,
      this.pursuerPos,
      hasLoS,
      this.player.isCrouching,
      isIlluminated,
      flashlightPressure,
      artifactRecovered,
    );
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

    this.watcher.update(dt, playerPos, camYaw, this.pursuerPos, pursuerModel.state, pursuerGroundY, () =>
      this.player.adrenaline.spike(0.22),
    );
    this.pursuerBody.update(dt, this.pursuerPos, pursuerGroundY, playerPos2d);

    this.clouds.update(dt);
    this.wildlife.update(dt, playerPos);

    this.daylight.update(dt, this.runProfile, this.expProfile);
    this.ambientAudio.setNightLevel(this.daylight.getNightLevel());

    this.weather.update(dt, (v) => this.ambientAudio.setWeatherIntensity(v));
    if (this.atmosphericParticles.length > 0) this.updateAtmosphericParticles(dt, playerPos);

    SceneFactory.updateFog(
      this.scene,
      this.expProfile.fogDensity,
      this.daylight.getLightLevel(),
      weatherMask,
      this.expProfile,
      this.runProfile,
    );

    if (this.phoneProp?.update(dt, playerPos.x, playerPos.z)) {
      this.onPhonePickup();
    }

    if (this.artifactProp?.update(dt, playerPos.x, playerPos.z)) {
      this.onArtifactPickup();
    }

    this.destination.update(playerPos);
    this.updateKeyFobUnlock(playerPos);
    if (this.riverAudio) {
      const riverDist = this.terrain.getRiverDistance(playerPos.x, playerPos.z) ?? RIVER_AUDIBLE_RANGE;
      this.riverAudio.setDistance(Math.min(1, riverDist / RIVER_AUDIBLE_RANGE));
    }
    if (this.destination.isReached()) {
      if (this.inventory.hasItem(this.trail.artifact.id)) {
        this.triggerWin();
        return;
      }
      // Missing-artifact case falls through instead of returning — this used
      // to skip the rest of tick() (including scene.render()) for as long as
      // the player stood within the reach radius, which looked like the game
      // had completely frozen rather than just showing a toast.
      this.destination.reset();
      if (this.objectiveToastCooldown <= 0) {
        this.showToast(`missing ${this.trail.artifact.name}`, 2600);
        this.objectiveToastCooldown = 5;
      }
    }

    const adrenaline = this.player.adrenaline.getLevel();
    this.playerAudio.updateBreath(this.player.breath.getLoad());
    this.playerAudio.updateFootsteps(speed);
    this.updateProximityRustle(dt, speed, playerPos2d, camYaw);
    this.heartbeat.setStressLevel(adrenaline);
    this.pursuerBody.setStress(adrenaline);
    this.proximity.update(dt, pursuerModel.state, adrenaline);
    this.breathOverlay.update(dt, this.player.breath.getLoad());

    if (pursuerModel.state === 'caught') {
      this.triggerCatch();
      return;
    }

    this.scene.render();
  }

  private updateProximityRustle(dt: number, speed: number, playerPos: { x: number; z: number }, camYaw: number): void {
    this.proximityRustleCooldown -= dt;
    if (speed < PLAYER_CONFIG.jogSpeed || this.proximityRustleCooldown > 0) return;

    let nearestSurf = Infinity,
      nearestDx = 0,
      nearestDz = 0;
    for (const c of this.colliders) {
      const dx = c.x - playerPos.x;
      const dz = c.z - playerPos.z;
      const surf = Math.sqrt(dx * dx + dz * dz) - c.radius;
      if (surf < nearestSurf) {
        nearestSurf = surf;
        nearestDx = dx;
        nearestDz = dz;
      }
    }
    if (nearestSurf < 2.0) {
      const angleToTree = Math.atan2(nearestDx, nearestDz) - camYaw;
      const pan = Math.max(-1, Math.min(1, Math.sin(angleToTree)));
      AudioEngine.playProximityRustle(pan);
      this.proximityRustleCooldown = 1.4 + Math.random() * 1.0;
    }
  }

  private checkLineOfSight(playerPos: { x: number; z: number }, pursuerPos: { x: number; z: number }): boolean {
    const ddx = playerPos.x - pursuerPos.x;
    const ddz = playerPos.z - pursuerPos.z;
    const len2 = ddx * ddx + ddz * ddz;
    if (len2 < 0.01) return true;

    for (const c of this.colliders) {
      const tx = c.x - pursuerPos.x;
      const tz = c.z - pursuerPos.z;
      const t = Math.max(0.05, Math.min(0.95, (tx * ddx + tz * ddz) / len2));
      const px = pursuerPos.x + t * ddx - c.x;
      const pz = pursuerPos.z + t * ddz - c.z;
      const r = c.radius + 0.18;
      if (px * px + pz * pz < r * r) return false;
    }
    return true;
  }

  private triggerCatch(): void {
    this.isCaught = true;

    const pp = this.player.getPosition();
    this.spawnPos = new Vector3(pp.x, pp.y, pp.z);

    AudioEngine.playBranchSnap(0, 0);
    this.fadeOut(800).then(() => {
      this.restart();
    });
  }

  private triggerWin(): void {
    this.hasWon = true;
    this.destination.stop();

    this.fadeOut(3000).then(() => {
      this.showWinText();
    });
  }

  private restart(): void {
    this.pursuer = new PursuerSystem(buildPursuerConfig(this.trail.pursuerProfile));

    this.player.reset(this.spawnPos.clone());

    this.pursuerPos = Game.pickPursuerStart(this.spawnPos);
    this.pursuer.reset();
    this.destination.reset();
    if (this.trail.alarmMode === 'continuous_until_visible' && !this.carAlarmSilenced) {
      this.destination.start();
    }
    if (!this.inventory.hasItem(this.trail.artifact.id)) this.spawnArtifactProp();

    // Reset phone/flashlight state so each run starts in darkness
    if (!this.inventory.hasItem('phone')) {
      this.spawnPhoneProp();
    } else {
      // Phone was already found — keep inventory but reset flashlight to off
      // so the player has to consciously raise it again after a restart
      this.phoneFlashlightOn = false;
      this.player.setFlashlightEnabled(false);
      this.playerHand?.setVisible(false);
    }

    this.isCaught = false;
    this.hasWon = false;
    this.fadeIn(1200);
  }

  private spawnPhoneProp(): void {
    this.phoneProp?.dispose();
    // Place phone ~5 units ahead (+Z) of spawn — player faces +Z on reset,
    // so this lands right in their path and is well outside the 2.5-unit pickup radius.
    const phoneX = this.spawnPos.x + 0.5;
    const phoneZ = this.spawnPos.z + 5.0;
    this.phoneProp = new PhoneProp(this.scene, phoneX, phoneZ, this.terrain);
  }

  private spawnArtifactProp(): void {
    if (this.inventory.hasItem(this.trail.artifact.id)) return;
    this.artifactProp?.dispose();
    const artifact = this.trail.artifact;
    this.artifactProp = new ArtifactProp(
      this.scene,
      artifact.id,
      artifact.name,
      artifact.position.x,
      artifact.position.z,
      this.terrain,
    );
  }

  private togglePhone(): void {
    this.phoneFlashlightOn = !this.phoneFlashlightOn;
    this.player.setFlashlightEnabled(this.phoneFlashlightOn);
    this.playerHand?.setVisible(this.phoneFlashlightOn);
  }

  private updateKeyFobUnlock(playerPos: Vector3): void {
    if (this.carFobUnlocked) return;
    if (this.trail.alarmMode === 'manual_chirp' || this.destination.isVisibleFrom(playerPos)) {
      this.carFobUnlocked = true;
      if (!this.fobToastShown) {
        this.showToast('key fob ready - press F for car alarm', 3000);
        this.fobToastShown = true;
      }
    }
  }

  private useKeyFob(): void {
    if (!this.carFobUnlocked || this.fobCooldown > 0) return;
    this.fobCooldown = 2.2;

    if (this.trail.alarmMode === 'continuous_until_visible' && !this.carAlarmSilenced) {
      this.carAlarmSilenced = true;
      this.destination.stop();
      this.forest.flashCarLights();
      this.showToast('alarm silenced', 2200);
      return;
    }

    this.destination.chirpOnce();
  }

  private onPhonePickup(): void {
    this.phoneProp?.dispose();
    this.phoneProp = null;
    this.inventory.addItem('phone');
    this.inventoryUI.setItem('phone');
    this.showToast('found your phone — right-click to use flashlight', 3500);
  }

  private onArtifactPickup(): void {
    const artifact = this.trail.artifact;
    this.artifactProp?.dispose();
    this.artifactProp = null;
    this.inventory.addItem(artifact.id);
    this.inventoryUI.setItem(artifact.name);
    this.showToast(`${artifact.name} recovered - return to the car`, 3800);
  }

  private showToast(text: string, durationMs: number): void {
    if (this.toastHideTimer !== null) window.clearTimeout(this.toastHideTimer);
    if (this.toastRemoveTimer !== null) window.clearTimeout(this.toastRemoveTimer);

    if (!this.toastEl) {
      this.toastEl = document.createElement('div');
      this.toastEl.style.cssText = [
        'position:fixed',
        'bottom:60px',
        'left:50%',
        'transform:translateX(-50%)',
        'pointer-events:none',
        'z-index:90',
        'box-sizing:border-box',
        'max-width:min(620px, calc(100vw - 32px))',
        'padding:8px 20px',
        'background:rgba(0,0,0,0.78)',
        'border:1px solid rgba(255,255,255,0.08)',
        'border-radius:4px',
        'color:rgba(200,210,220,0.84)',
        'font-family:monospace',
        'font-size:0.72rem',
        'line-height:1.45',
        'letter-spacing:0.09em',
        'text-align:center',
        'transition:opacity 220ms ease, transform 220ms ease',
      ].join(';');
      document.body.appendChild(this.toastEl);
    }

    this.toastEl.textContent = text;
    this.toastEl.style.opacity = '1';
    this.toastEl.style.transform = 'translateX(-50%) translateY(0)';

    this.toastHideTimer = window.setTimeout(() => {
      if (!this.toastEl) return;
      this.toastEl.style.opacity = '0';
      this.toastEl.style.transform = 'translateX(-50%) translateY(6px)';
      this.toastRemoveTimer = window.setTimeout(() => {
        this.toastEl?.remove();
        this.toastEl = null;
        this.toastRemoveTimer = null;
      }, 260);
      this.toastHideTimer = null;
    }, durationMs);
  }

  private createAtmosphericParticles(scene: Scene): void {
    const mat = new StandardMaterial('ps2AirParticleMat', scene);
    mat.disableLighting = true;
    mat.emissiveColor = new Color3(0.55, 0.46, 0.34);
    mat.diffuseColor = Color3.Black();
    mat.specularColor = Color3.Black();
    mat.alpha = 0.28;
    mat.backFaceCulling = false;

    const count = this.expProfile.mode === 'ps3' ? 240 : 120;
    const spread = this.expProfile.mode === 'ps3' ? 130 : 90;
    for (let i = 0; i < count; i++) {
      const mote = MeshBuilder.CreatePlane(
        `ps2AirMote_${i}`,
        {
          width: 0.025 + Math.random() * 0.055,
          height: 0.025 + Math.random() * 0.055,
        },
        scene,
      );
      mote.material = mat;
      mote.billboardMode = Mesh.BILLBOARDMODE_ALL;
      mote.applyFog = false;
      mote.isPickable = false;
      mote.position.set(
        this.spawnPos.x + (Math.random() - 0.5) * spread,
        this.spawnPos.y - 0.6 + Math.random() * 4.0,
        this.spawnPos.z + (Math.random() - 0.5) * spread,
      );
      this.atmosphericParticles.push(mote);
    }
  }

  private updateAtmosphericParticles(dt: number, playerPos: Vector3): void {
    for (let i = 0; i < this.atmosphericParticles.length; i++) {
      const mote = this.atmosphericParticles[i];
      mote.position.x += Math.sin(performance.now() * 0.0002 + i) * dt * 0.08;
      mote.position.z += dt * (0.1 + (i % 5) * 0.015);
      mote.rotation.z += dt * 0.25;

      const dx = mote.position.x - playerPos.x;
      const dz = mote.position.z - playerPos.z;
      const wrapRadius = this.expProfile.mode === 'ps3' ? 72 : 55;
      if (dx * dx + dz * dz > wrapRadius * wrapRadius) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 12 + Math.random() * 38;
        mote.position.set(
          playerPos.x + Math.cos(angle) * radius,
          playerPos.y - 0.8 + Math.random() * 4.2,
          playerPos.z + Math.sin(angle) * radius,
        );
      }
    }
  }

  private static pickRandomSpawn(
    terrain: Terrain,
    colliders: Collider[],
    spawnOverride?: { x: number; z: number },
  ): Vector3 {
    const SAFETY_MARGIN = 1.5;

    const isClear = (x: number, z: number): boolean => {
      for (const c of colliders) {
        const dx = x - c.x,
          dz = z - c.z;
        const r = c.radius + SAFETY_MARGIN;
        if (dx * dx + dz * dz < r * r) return false;
      }
      return true;
    };

    // Some trails (e.g. Stonejaw Ridge) start the player at their own car
    // instead of the shared southern-mountain spawn — small jitter so
    // repeated runs don't all land on the exact same spot, but the car has
    // no collider of its own so this never needs to search far.
    if (spawnOverride) {
      for (let i = 0; i < 60; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * 4;
        const x = spawnOverride.x + Math.cos(angle) * r;
        const z = spawnOverride.z + Math.sin(angle) * r;
        if (!isClear(x, z)) continue;
        return new Vector3(x, terrain.getHeightAt(x, z) + 1.7, z);
      }
      return new Vector3(spawnOverride.x, terrain.getHeightAt(spawnOverride.x, spawnOverride.z) + 1.7, spawnOverride.z);
    }

    // Spawn at the base of the southern mountains — player faces north (+Z)
    // through the forest toward the car alarm. Narrow x-band so they always
    // start centered, slight z randomisation so each run feels slightly different.
    for (let i = 0; i < 60; i++) {
      const x = -8 + Math.random() * 16; // -8 to +8
      const z = -255 - Math.random() * 15; // -255 to -270
      if (!isClear(x, z)) continue;
      return new Vector3(x, terrain.getHeightAt(x, z) + 1.7, z);
    }
    return new Vector3(0, terrain.getHeightAt(0, -260) + 1.7, -260);
  }

  private static pickPursuerStart(playerSpawn: Vector3): { x: number; z: number } {
    // Spawn in the forest interior — 30-80 units from map origin, which puts
    // the pursuer in the dense tree ring rather than at the far world edge.
    // Ensures at least 50 units separation from the player so there's time
    // to orient before the first encounter.
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 30 + Math.random() * 50;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      if (Math.abs(x) > 185 || Math.abs(z) > 185) continue;
      const dx = x - playerSpawn.x,
        dz = z - playerSpawn.z;
      if (dx * dx + dz * dz < 50 * 50) continue;
      return { x, z };
    }
    return { x: 40, z: 40 };
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
      if (!this.catchFadeEl) {
        resolve();
        return;
      }
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
      <span style="font-size:0.7rem;color:#444">return to title to choose another trail</span>
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
      hasLoS: this.lastHasLoS,
      isIlluminated: this.lastIlluminated,
      flashlightOn: this.phoneFlashlightOn,
      hasPhone: this.inventory.hasItem('phone'),
      carFobUnlocked: this.carFobUnlocked,
      carAlarmSilenced: this.carAlarmSilenced,
    };
  }

  getControls(): GameControls {
    return {
      setBellMultiplier: (v) => this.destination.setGainMultiplier(v),
      setWindOverride: (v) => this.weather.setWindOverride(v),
      setPursuerAudioMuted: (muted) => this.pursuerAudio.setMuted(muted),
      setBreathAudioMuted: (muted) => this.playerAudio.setBreathMuted(muted),
      setPursuerBodyVisible: (visible) => this.pursuerBody.setVisible(visible),
      setSSAOEnabled: (enabled) => {
        if (enabled) {
          this.scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline('ssao', this.player.camera);
        } else {
          this.scene.postProcessRenderPipelineManager.detachCamerasFromRenderPipeline('ssao', this.player.camera);
        }
      },
      setPostFXEnabled: (enabled) => {
        if (!this.postFXPipeline || !this.motionBlur) return;
        this.postFXPipeline.bloomEnabled = enabled;
        this.postFXPipeline.grainEnabled = enabled;
        this.postFXPipeline.imageProcessingEnabled = enabled;
        if (enabled) {
          this.player.camera.attachPostProcess(this.motionBlur);
        } else {
          this.player.camera.detachPostProcess(this.motionBlur);
        }
      },
      setShadowsEnabled: (enabled) => {
        const shadowMap = this.daylight.getShadowGenerator().getShadowMap()!;
        if (!enabled) {
          this.savedShadowCasters = (shadowMap.renderList ?? []).slice();
          shadowMap.renderList = [];
        } else if (this.savedShadowCasters) {
          shadowMap.renderList = this.savedShadowCasters;
          this.savedShadowCasters = null;
        }
      },
    };
  }

  dispose(): void {
    this.loop.stop();
    if (this.mouseDownHandler) {
      window.removeEventListener('pointerdown', this.mouseDownHandler, true);
    }
    if (this.keyDownHandler) {
      window.removeEventListener('keydown', this.keyDownHandler, true);
    }
    this.destination.dispose();
    this.riverAudio?.dispose();
    this.ambientAudio.stop();
    this.playerAudio.dispose();
    this.watcher.dispose();
    this.pursuerBody.dispose();
    this.forest.dispose();
    this.terrain.dispose();
    this.clouds.dispose();
    this.mountains.dispose();
    this.wildlife.dispose();
    this.heartbeat.dispose();
    this.proximity.dispose();
    this.breathOverlay.dispose();
    this.atmosphericParticles.forEach((m) => m.dispose());
    this.atmosphericParticles = [];
    this.phoneProp?.dispose();
    this.artifactProp?.dispose();
    this.playerHand?.dispose();
    this.inventoryUI.dispose();
    this.instructions.dispose();
    this.trailIntro.dispose();
    if (this.toastHideTimer !== null) window.clearTimeout(this.toastHideTimer);
    if (this.toastRemoveTimer !== null) window.clearTimeout(this.toastRemoveTimer);
    this.toastEl?.remove();
    this.engine.dispose();
    this.catchFadeEl?.remove();
  }
}

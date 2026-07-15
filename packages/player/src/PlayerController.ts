import { Vector3, FreeCamera, Scene, SpotLight, Color3 } from '@babylonjs/core';
import { PLAYER_CONFIG } from './defaults';
import { BreathSystem } from './BreathSystem';
import { AdrenalineSystem } from './AdrenalineSystem';
import type { ITerrain } from '@dissonance/world';
import type { Collider } from '@dissonance/world';

const STAND_HEIGHT = 1.7;
const CROUCH_HEIGHT = 0.9;
const PLAYER_RADIUS = 0.38;

export type PlayerControllerOptions = {
  // Uniform multiplier on the player's own physical size (eye height,
  // crouch height, collision radius) — not on movement speed. Lets a
  // scene shrink/grow the player relative to a world whose own geometry
  // was scaled independently (see HeightmapTerrain's horizontalScale/
  // verticalExaggeration), without touching DTA's own default (scale: 1).
  scale?: number;
  // Babylon's Camera.maxZ (far clip plane) defaults to 10000 — fine for
  // DTA's ~800-unit world, but far too short for a scene whose geometry
  // has been scaled up past that (distant terrain just isn't drawn).
  farClip?: number;
};

export type FlashlightTuning = {
  intensity: number;
  range: number;
  angle: number;
  exponent: number;
  color: { r: number; g: number; b: number };
};

export class PlayerController {
  readonly camera: FreeCamera;
  readonly breath: BreathSystem;
  readonly adrenaline: AdrenalineSystem;
  private readonly flashlight: SpotLight;

  isCrouching = false;

  private keys: Record<string, boolean> = {};
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;
  private isPointerLocked = false;
  private flashlightEnabled = false;
  private flashlightIntensity = 2.8;
  private sprintLocked = false;
  private currentSpeed = 0;
  private shakeTime = 0;
  private eyeHeight: number;

  private readonly standHeight: number;
  private readonly crouchHeight: number;
  private readonly playerRadius: number;

  private terrain: ITerrain | null = null;
  private colliders: Collider[] = [];
  private worldBoundaryRadius: number | null = null;
  // Extra Y added on top of the normal stand/crouch eye height — a scene-level
  // "raise the camera a bit" tweak, independent of the scale-driven eye
  // height math above (e.g. trail-viewer's shrunk-player levels compensating
  // for vertical exaggeration). Defaults to 0: no behavior change for DTA.
  private heightOffset = 0;

  constructor(scene: Scene, startPosition: Vector3, options: PlayerControllerOptions = {}) {
    const scale = options.scale ?? 1;
    this.standHeight = STAND_HEIGHT * scale;
    this.crouchHeight = CROUCH_HEIGHT * scale;
    this.playerRadius = PLAYER_RADIUS * scale;
    this.eyeHeight = this.standHeight;

    this.breath = new BreathSystem();
    this.adrenaline = new AdrenalineSystem();

    this.camera = new FreeCamera('playerCam', startPosition, scene);
    this.camera.minZ = 0.1;
    this.camera.maxZ = options.farClip ?? 10000;
    this.camera.fov = 1.05;
    this.camera.rotation = Vector3.Zero();

    // Camera-carried flashlight. Position/direction are synced manually
    // each frame in update() rather than via light.parent — matches how
    // the camera itself is driven (manual transforms, no node hierarchy
    // magic) elsewhere in this class. Deliberately no shadow generator
    // here — per-light shadow maps are expensive, and the moonlight sun
    // in DaylightSystem already covers that job.
    this.flashlight = new SpotLight(
      'flashlight', startPosition.clone(), Vector3.Forward(), Math.PI / 3, 2, scene,
    );
    this.flashlight.diffuse = new Color3(1.0, 0.82, 0.55);
    this.flashlight.specular = Color3.Black();
    this.flashlight.intensity = 0; // starts off — Game enables it after phone pickup
    this.flashlight.range = 22;

    this.setupInput(scene);
  }

  get isLocked(): boolean { return this.isPointerLocked; }

  // For scenes that swap between multiple simultaneously-alive camera
  // controllers sharing one pointer-locked canvas (e.g. trail-viewer's
  // walk/fly toggle): while this controller isn't the active one, it still
  // accumulates mousemove deltas from the shared listener. Without clearing
  // them, reactivating it applies all that pent-up delta in one jarring
  // snap. Call this right after making this controller active again.
  clearLookDelta(): void {
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
  }

  // Intensity-based toggle is more reliable than setEnabled() across BabylonJS versions.
  setFlashlightEnabled(enabled: boolean): void {
    this.flashlightEnabled = enabled;
    this.flashlight.intensity = enabled ? this.flashlightIntensity : 0;
  }

  setFlashlightTuning(tuning: FlashlightTuning): void {
    this.flashlightIntensity = tuning.intensity;
    this.flashlight.range = tuning.range;
    this.flashlight.angle = tuning.angle;
    this.flashlight.exponent = tuning.exponent;
    this.flashlight.diffuse = new Color3(tuning.color.r, tuning.color.g, tuning.color.b);
    if (this.flashlightEnabled) this.flashlight.intensity = this.flashlightIntensity;
  }

  // Cone + range test against the flashlight — same relative-angle math
  // already used elsewhere (pursuer audio panning, line-of-sight) just
  // clamped to the spotlight's half-angle instead of a full circle.
  isPointIlluminated(point: Vector3): boolean {
    if (this.flashlight.intensity <= 0) return false;
    const toPoint = point.subtract(this.camera.position);
    const dist = toPoint.length();
    if (dist < 0.001 || dist > this.flashlight.range) return false;
    const dir = this.camera.getDirection(Vector3.Forward());
    const cosAngle = Vector3.Dot(dir, toPoint.normalize());
    // Use full half-angle (not half of it) — detection fills the entire visible cone.
    return cosAngle > Math.cos(this.flashlight.angle);
  }

  getFlashlightPressure(point: Vector3): number {
    if (this.flashlight.intensity <= 0) return 0;
    const toPoint = point.subtract(this.camera.position);
    const dist = toPoint.length();
    if (dist < 0.001 || dist > this.flashlight.range) return 0;

    const dir = this.camera.getDirection(Vector3.Forward());
    const cosAngle = Vector3.Dot(dir, toPoint.normalize());
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
    const inner = this.flashlight.angle;
    const outer = inner * 1.65;
    if (angle >= outer) return 0;

    const conePressure = angle <= inner
      ? 1
      : 1 - (angle - inner) / (outer - inner);
    const rangePressure = 1 - Math.min(0.45, dist / this.flashlight.range * 0.45);
    return Math.max(0, Math.min(1, conePressure * rangePressure));
  }

  setTerrain(terrain: ITerrain): void {
    this.terrain = terrain;
  }

  setHeightOffset(offset: number): void {
    this.heightOffset = offset;
  }

  setColliders(colliders: Collider[]): void {
    this.colliders = colliders;
  }

  // Decorative meshes (mountains) aren't real colliders — without this the
  // player can walk straight through the mountain ring. A simple distance-
  // from-origin cap is far cheaper than deriving collision geometry from
  // the procedural mountain mesh, and is invisible during normal play since
  // it sits well past where the forest/pursuer logic ever needs the player.
  setWorldBoundaryRadius(radius: number | null): void {
    this.worldBoundaryRadius = radius;
  }

  private setupInput(scene: Scene): void {
    const canvas = scene.getEngine().getRenderingCanvas();
    if (!canvas) return;

    window.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
    window.addEventListener('keyup',   (e) => { this.keys[e.code] = false; });

    canvas.addEventListener('click', () => canvas.requestPointerLock());
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === canvas;
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!this.isPointerLocked) return;
      this.mouseDeltaX += e.movementX;
      this.mouseDeltaY += e.movementY;
    });
  }

  update(dt: number): void {
    const cfg = PLAYER_CONFIG;

    if (this.isPointerLocked) {
      const sens = 0.0018;
      this.camera.rotation.y += this.mouseDeltaX * sens;
      this.camera.rotation.x += this.mouseDeltaY * sens;
      this.camera.rotation.x = Math.max(-1.3, Math.min(1.3, this.camera.rotation.x));
      this.mouseDeltaX = 0;
      this.mouseDeltaY = 0;
    }

    this.isCrouching = !!(this.keys['ControlLeft'] || this.keys['ControlRight']);
    const breathLoad = this.breath.getLoad();
    if (breathLoad > 0.94) this.sprintLocked = true;
    if (breathLoad < 0.55) this.sprintLocked = false;
    const isSprinting = !this.isCrouching && !this.sprintLocked && !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
    const isMoving = !!(this.keys['KeyW'] || this.keys['KeyS'] || this.keys['KeyA'] || this.keys['KeyD']);

    let targetSpeed = 0;
    if (isMoving) {
      if (isSprinting) {
        targetSpeed = cfg.sprintSpeed;
      } else if (this.isCrouching) {
        targetSpeed = cfg.walkSpeed * 0.48;
      } else if (this.keys['KeyW'] || this.keys['KeyS']) {
        targetSpeed = cfg.jogSpeed;
      } else {
        targetSpeed = cfg.walkSpeed;
      }
    }

    this.breath.update(dt, this.currentSpeed);
    targetSpeed *= this.breath.getSpeedMultiplier();

    this.currentSpeed += (targetSpeed - this.currentSpeed) * Math.min(1, dt * 8);

    if (this.currentSpeed > 0.1 && isMoving) {
      const yaw = this.camera.rotation.y;
      const fwd   = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

      const dir = Vector3.Zero();
      if (this.keys['KeyW']) dir.addInPlace(fwd);
      if (this.keys['KeyS']) dir.subtractInPlace(fwd);
      if (this.keys['KeyA']) dir.subtractInPlace(right);
      if (this.keys['KeyD']) dir.addInPlace(right);

      if (dir.length() > 0) {
        dir.normalize().scaleInPlace(this.currentSpeed * dt);
        this.tryMove(dir.x, dir.z);
      }
    }

    const targetEye = this.isCrouching ? this.crouchHeight : this.standHeight;
    this.eyeHeight += (targetEye - this.eyeHeight) * Math.min(1, dt * 10);

    const groundY = this.terrain?.getHeightAt(this.camera.position.x, this.camera.position.z) ?? 0;
    this.camera.position.y = groundY + this.eyeHeight + this.heightOffset;

    this.shakeTime += dt * 3.0;
    const shakeMag = this.adrenaline.getShakeMagnitude() * 0.72 + this.breath.getLoad() * 0.0025;
    if (shakeMag > 0.001) {
      const nx = Math.sin(this.shakeTime * 1.7) * Math.sin(this.shakeTime * 2.3);
      const ny = Math.sin(this.shakeTime * 1.3) * Math.sin(this.shakeTime * 3.1);
      this.camera.rotation.x += nx * shakeMag;
      this.camera.rotation.y += ny * shakeMag * 0.5;
    }

    this.flashlight.position.copyFrom(this.camera.position);
    this.flashlight.direction = this.camera.getDirection(Vector3.Forward());
  }

  private tryMove(dx: number, dz: number): void {
    const nx = this.camera.position.x + dx;
    const nz = this.camera.position.z + dz;
    if (!this.isColliding(nx, nz)) {
      this.camera.position.x = nx;
      this.camera.position.z = nz;
      return;
    }
    if (!this.isColliding(nx, this.camera.position.z)) {
      this.camera.position.x = nx;
      return;
    }
    if (!this.isColliding(this.camera.position.x, nz)) {
      this.camera.position.z = nz;
      return;
    }
  }

  private isColliding(x: number, z: number): boolean {
    if (this.worldBoundaryRadius !== null) {
      const r = this.worldBoundaryRadius;
      if (x * x + z * z > r * r) return true;
    }
    for (const c of this.colliders) {
      const dx = x - c.x;
      const dz = z - c.z;
      const r = c.radius + this.playerRadius;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }

  getSpeed(): number { return this.currentSpeed; }

  getPosition(): Vector3 { return this.camera.position.clone(); }

  setPosition(pos: Vector3): void { this.camera.position.copyFrom(pos); }

  reset(startPosition: Vector3): void {
    this.camera.position.copyFrom(startPosition);
    this.camera.rotation = Vector3.Zero();
    this.breath.reset();
    this.adrenaline.reset();
    this.currentSpeed = 0;
    this.sprintLocked = false;
    this.isCrouching = false;
    this.eyeHeight = this.standHeight;
    this.keys = {};
  }
}

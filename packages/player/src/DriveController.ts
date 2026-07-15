import { Vector3, FreeCamera, Scene } from '@babylonjs/core';
import type { ITerrain } from '@dissonance/world';

export type DriveControllerOptions = {
  speed?: number; // m/s, base (unboosted) drive speed
  boostMultiplier?: number; // Shift-held speed multiplier
  farClip?: number; // Camera.maxZ — see PlayerControllerOptions.farClip for why
  // Uniform multiplier on eye height — matches PlayerControllerOptions.scale
  // so switching between Walk/Drive at the same level doesn't jump height.
  scale?: number;
};

const DEFAULT_SPEED = 30;
const DEFAULT_BOOST_MULTIPLIER = 4;
const EYE_HEIGHT = 1.7;

// A no-collision ground vehicle: WASD movement at FlightController-grade
// speed (optionally boosted), but Y is snapped to the terrain every frame
// like PlayerController — for covering a real-world-scale map quickly
// without losing the sense of moving *through* the terrain the way
// free-flying above it does. Deliberately simpler than PlayerController (no
// breath/adrenaline/collision/flashlight): this is a traversal tool, not
// the player's embodied movement — same rationale as FlightController.
export class DriveController {
  readonly camera: FreeCamera;

  private keys: Record<string, boolean> = {};
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;
  private isPointerLocked = false;
  private readonly speed: number;
  private readonly boostMultiplier: number;
  private readonly eyeHeight: number;
  private terrain: ITerrain | null = null;
  // See PlayerController.heightOffset — same idea, defaults to 0.
  private heightOffset = 0;

  constructor(scene: Scene, startPosition: Vector3, options: DriveControllerOptions = {}) {
    this.speed = options.speed ?? DEFAULT_SPEED;
    this.boostMultiplier = options.boostMultiplier ?? DEFAULT_BOOST_MULTIPLIER;
    this.eyeHeight = EYE_HEIGHT * (options.scale ?? 1);

    this.camera = new FreeCamera('driveCam', startPosition, scene);
    this.camera.minZ = 0.1;
    this.camera.maxZ = options.farClip ?? 10000;
    this.camera.fov = 1.05;
    this.camera.rotation = Vector3.Zero();

    this.setupInput(scene);
  }

  get isLocked(): boolean {
    return this.isPointerLocked;
  }

  // See PlayerController.clearLookDelta — same reasoning, needed whenever
  // multiple controllers share one pointer-locked canvas.
  clearLookDelta(): void {
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
  }

  setTerrain(terrain: ITerrain): void {
    this.terrain = terrain;
  }

  setHeightOffset(offset: number): void {
    this.heightOffset = offset;
  }

  private setupInput(scene: Scene): void {
    const canvas = scene.getEngine().getRenderingCanvas();
    if (!canvas) return;

    window.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

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
    if (this.isPointerLocked) {
      const sens = 0.0018;
      this.camera.rotation.y += this.mouseDeltaX * sens;
      this.camera.rotation.x += this.mouseDeltaY * sens;
      this.camera.rotation.x = Math.max(-1.3, Math.min(1.3, this.camera.rotation.x));
      this.mouseDeltaX = 0;
      this.mouseDeltaY = 0;
    }

    const boosting = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
    const speed = this.speed * (boosting ? this.boostMultiplier : 1);

    // Movement stays level with the ground plane regardless of where the
    // camera is looking (unlike FlightController, which tilts forward/back
    // with pitch) — this is a ground vehicle, not an aircraft.
    const yaw = this.camera.rotation.y;
    const fwd = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

    const dir = Vector3.Zero();
    if (this.keys['KeyW']) dir.addInPlace(fwd);
    if (this.keys['KeyS']) dir.subtractInPlace(fwd);
    if (this.keys['KeyA']) dir.subtractInPlace(right);
    if (this.keys['KeyD']) dir.addInPlace(right);

    if (dir.length() > 0) {
      dir.normalize().scaleInPlace(speed * dt);
      this.camera.position.x += dir.x;
      this.camera.position.z += dir.z;
    }

    const groundY = this.terrain?.getHeightAt(this.camera.position.x, this.camera.position.z) ?? 0;
    this.camera.position.y = groundY + this.eyeHeight + this.heightOffset;
  }

  getPosition(): Vector3 {
    return this.camera.position.clone();
  }

  setPosition(pos: Vector3): void {
    this.camera.position.copyFrom(pos);
  }
}

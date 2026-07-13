import { Vector3, FreeCamera, Scene } from '@babylonjs/core';

export type FlightControllerOptions = {
  speed?: number; // m/s, base (unboosted) flight speed
  boostMultiplier?: number; // Shift-held speed multiplier
  farClip?: number; // Camera.maxZ — see PlayerControllerOptions.farClip for why
};

const DEFAULT_SPEED = 30;
const DEFAULT_BOOST_MULTIPLIER = 4;

// A no-collision, no-gravity free-fly camera for quickly covering large
// distances — e.g. a real-world terrain scene too big to walk across at
// human speed. Deliberately simpler than PlayerController (no breath/
// adrenaline/flashlight/collision): this is a traversal tool, not the
// player's embodied movement.
export class FlightController {
  readonly camera: FreeCamera;

  private keys: Record<string, boolean> = {};
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;
  private isPointerLocked = false;
  private readonly speed: number;
  private readonly boostMultiplier: number;

  constructor(scene: Scene, startPosition: Vector3, options: FlightControllerOptions = {}) {
    this.speed = options.speed ?? DEFAULT_SPEED;
    this.boostMultiplier = options.boostMultiplier ?? DEFAULT_BOOST_MULTIPLIER;

    this.camera = new FreeCamera('flightCam', startPosition, scene);
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
      this.camera.rotation.x = Math.max(-1.5, Math.min(1.5, this.camera.rotation.x));
      this.mouseDeltaX = 0;
      this.mouseDeltaY = 0;
    }

    const boosting = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
    const speed = this.speed * (boosting ? this.boostMultiplier : 1);

    // Full 3D movement in camera-relative directions, plus world-up/down —
    // unlike PlayerController, forward/back tilt with the camera pitch
    // (this is a flying camera, not a feet-on-the-ground one).
    const forward = this.camera.getDirection(Vector3.Forward());
    const right = this.camera.getDirection(Vector3.Right());

    const dir = Vector3.Zero();
    if (this.keys['KeyW']) dir.addInPlace(forward);
    if (this.keys['KeyS']) dir.subtractInPlace(forward);
    if (this.keys['KeyD']) dir.addInPlace(right);
    if (this.keys['KeyA']) dir.subtractInPlace(right);
    if (this.keys['Space']) dir.addInPlace(Vector3.Up());
    if (this.keys['ControlLeft'] || this.keys['ControlRight']) dir.subtractInPlace(Vector3.Up());

    if (dir.length() > 0) {
      dir.normalize().scaleInPlace(speed * dt);
      this.camera.position.addInPlace(dir);
    }
  }

  getPosition(): Vector3 {
    return this.camera.position.clone();
  }

  setPosition(pos: Vector3): void {
    this.camera.position.copyFrom(pos);
  }
}

import { Vector3, FreeCamera, Scene } from '@babylonjs/core';
import { PLAYER_CONFIG } from './defaults';
import { BreathSystem } from './BreathSystem';
import { AdrenalineSystem } from './AdrenalineSystem';
import type { Terrain } from '@dta/world';
import type { Collider } from '@dta/world';

const STAND_HEIGHT = 1.7;
const CROUCH_HEIGHT = 0.9;
const PLAYER_RADIUS = 0.38;

export class PlayerController {
  readonly camera: FreeCamera;
  readonly breath: BreathSystem;
  readonly adrenaline: AdrenalineSystem;

  isCrouching = false;

  private keys: Record<string, boolean> = {};
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;
  private isPointerLocked = false;
  private currentSpeed = 0;
  private shakeTime = 0;
  private eyeHeight = STAND_HEIGHT;

  private terrain: Terrain | null = null;
  private colliders: Collider[] = [];

  constructor(scene: Scene, startPosition: Vector3) {
    this.breath = new BreathSystem();
    this.adrenaline = new AdrenalineSystem();

    this.camera = new FreeCamera('playerCam', startPosition, scene);
    this.camera.minZ = 0.1;
    this.camera.fov = 1.05;
    this.camera.rotation = Vector3.Zero();

    this.setupInput(scene);
  }

  setTerrain(terrain: Terrain): void {
    this.terrain = terrain;
  }

  setColliders(colliders: Collider[]): void {
    this.colliders = colliders;
  }

  private setupInput(scene: Scene): void {
    const canvas = scene.getEngine().getRenderingCanvas();
    if (!canvas) return;

    window.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
    window.addEventListener('keyup',   (e) => { this.keys[e.code] = false; });

    canvas.addEventListener('click', () => canvas.requestPointerLock());

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
    const isSprinting = !this.isCrouching && !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
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

    const targetEye = this.isCrouching ? CROUCH_HEIGHT : STAND_HEIGHT;
    this.eyeHeight += (targetEye - this.eyeHeight) * Math.min(1, dt * 10);

    const groundY = this.terrain?.getHeightAt(this.camera.position.x, this.camera.position.z) ?? 0;
    this.camera.position.y = groundY + this.eyeHeight;

    this.shakeTime += dt * 3.0;
    const shakeMag = this.adrenaline.getShakeMagnitude() + this.breath.getLoad() * 0.004;
    if (shakeMag > 0.001) {
      const nx = Math.sin(this.shakeTime * 1.7) * Math.sin(this.shakeTime * 2.3);
      const ny = Math.sin(this.shakeTime * 1.3) * Math.sin(this.shakeTime * 3.1);
      this.camera.rotation.x += nx * shakeMag;
      this.camera.rotation.y += ny * shakeMag * 0.5;
    }
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
    for (const c of this.colliders) {
      const dx = x - c.x;
      const dz = z - c.z;
      const r = c.radius + PLAYER_RADIUS;
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
    this.isCrouching = false;
    this.eyeHeight = STAND_HEIGHT;
    this.keys = {};
  }
}

import { Vector3, FreeCamera, Scene } from '@babylonjs/core';
import { PLAYER_CONFIG } from '../config/runProfiles';
import { BreathSystem } from './BreathSystem';
import { AdrenalineSystem } from './AdrenalineSystem';

export class PlayerController {
  readonly camera: FreeCamera;
  readonly breath: BreathSystem;
  readonly adrenaline: AdrenalineSystem;

  private keys: Record<string, boolean> = {};
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;
  private isPointerLocked = false;
  private currentSpeed = 0;

  // Noise for camera shake
  private shakeTime = 0;

  constructor(scene: Scene, startPosition: Vector3) {
    this.breath = new BreathSystem();
    this.adrenaline = new AdrenalineSystem();

    this.camera = new FreeCamera('playerCam', startPosition, scene);
    this.camera.minZ = 0.1;
    this.camera.fov = 1.05;
    this.camera.rotation = Vector3.Zero();

    this.setupInput(scene);
  }

  private setupInput(scene: Scene): void {
    const canvas = scene.getEngine().getRenderingCanvas();
    if (!canvas) return;

    window.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    canvas.addEventListener('click', () => {
      canvas.requestPointerLock();
    });

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

    // Mouse look
    if (this.isPointerLocked) {
      const sensitivity = 0.0018;
      this.camera.rotation.y += this.mouseDeltaX * sensitivity;
      this.camera.rotation.x += this.mouseDeltaY * sensitivity;
      this.camera.rotation.x = Math.max(-1.3, Math.min(1.3, this.camera.rotation.x));
      this.mouseDeltaX = 0;
      this.mouseDeltaY = 0;
    }

    // Determine target speed
    const isSprinting = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
    const isMoving = this.keys['KeyW'] || this.keys['KeyS'] || this.keys['KeyA'] || this.keys['KeyD'];

    let targetSpeed = 0;
    if (isMoving) {
      if (isSprinting) {
        targetSpeed = cfg.sprintSpeed;
      } else if (this.keys['KeyW'] || this.keys['KeyS']) {
        targetSpeed = cfg.jogSpeed;
      } else {
        targetSpeed = cfg.walkSpeed;
      }
    }

    // Breath penalty
    this.breath.update(dt, this.currentSpeed);
    targetSpeed *= this.breath.getSpeedMultiplier();

    // Smooth speed
    this.currentSpeed += (targetSpeed - this.currentSpeed) * Math.min(1, dt * 8);

    // Move relative to camera yaw
    if (this.currentSpeed > 0.1 && isMoving) {
      const yaw = this.camera.rotation.y;
      const fwd = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

      const dir = Vector3.Zero();
      if (this.keys['KeyW']) dir.addInPlace(fwd);
      if (this.keys['KeyS']) dir.subtractInPlace(fwd);
      if (this.keys['KeyA']) dir.subtractInPlace(right);
      if (this.keys['KeyD']) dir.addInPlace(right);

      if (dir.length() > 0) {
        dir.normalize().scaleInPlace(this.currentSpeed * dt);
        this.camera.position.addInPlace(dir);
      }
    }

    // Keep player on ground (simple)
    this.camera.position.y = 1.7;

    // Adrenaline update
    // Pursuer state injected via updateAdrenaline
    this.shakeTime += dt * 3.0;

    // Camera shake from adrenaline + breath
    const shakeMag = this.adrenaline.getShakeMagnitude() + this.breath.getLoad() * 0.004;
    if (shakeMag > 0.001) {
      const nx = Math.sin(this.shakeTime * 1.7) * Math.sin(this.shakeTime * 2.3);
      const ny = Math.sin(this.shakeTime * 1.3) * Math.sin(this.shakeTime * 3.1);
      this.camera.rotation.x += nx * shakeMag;
      this.camera.rotation.y += ny * shakeMag * 0.5;
    }
  }

  getSpeed(): number {
    return this.currentSpeed;
  }

  getPosition(): Vector3 {
    return this.camera.position.clone();
  }

  setPosition(pos: Vector3): void {
    this.camera.position.copyFrom(pos);
  }

  reset(startPosition: Vector3): void {
    this.camera.position.copyFrom(startPosition);
    this.camera.rotation = Vector3.Zero();
    this.breath.reset();
    this.adrenaline.reset();
    this.currentSpeed = 0;
    this.keys = {};
  }
}

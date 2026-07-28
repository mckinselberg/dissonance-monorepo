import type { Mesh } from '@babylonjs/core';

/**
 * Procedural follow-and-stalk animation driver for a pursuing entity's mesh:
 * gait bob/lean/roll derived from movement speed, facing toward a target,
 * and a decaying "flinch" reaction (e.g. caught in a light beam). No
 * knowledge of mesh construction, materials, or what the entity looks like —
 * takes any Mesh and animates its transform. Tuning constants (0.045, 0.12,
 * 0.18, 2.5/1.2, 1.8) are carried over from the original pursuer's tuned
 * gait feel — do not adjust without re-checking the in-game motion.
 */
export class StalkerLocomotion {
  private gaitPhase = 0;
  private lastX: number | null = null;
  private lastZ: number | null = null;
  private stress = 0;
  private flinch = 0;

  constructor(private readonly mesh: Mesh) {}

  setStress(stress: number): void {
    this.stress = Math.max(0, Math.min(1, stress));
  }

  /** Triggers a decaying recoil reaction, e.g. on the rising edge of being illuminated. */
  triggerFlinch(): void {
    this.flinch = 1;
  }

  update(
    dt: number,
    pos: { x: number; z: number },
    groundY: number,
    targetPos: { x: number; z: number },
  ): void {
    const dxMove = this.lastX === null ? 0 : pos.x - this.lastX;
    const dzMove = this.lastZ === null ? 0 : pos.z - this.lastZ;
    const speed = dt > 0 ? Math.sqrt(dxMove * dxMove + dzMove * dzMove) / dt : 0;
    this.lastX = pos.x;
    this.lastZ = pos.z;

    const gaitSpeed = Math.max(0.25, Math.min(2.2, speed * 0.38));
    this.gaitPhase = (this.gaitPhase + dt * gaitSpeed * (2.5 + this.stress * 1.2)) % (Math.PI * 2);
    this.flinch = Math.max(0, this.flinch - dt * 1.8);

    const stride = Math.min(1, speed / 5);
    const step = Math.sin(this.gaitPhase);
    const counterStep = Math.sin(this.gaitPhase + Math.PI);
    const bob = Math.abs(step) * 0.045 * stride;
    const stalkLean = -0.06 - this.stress * 0.12 - stride * 0.10;
    const recoil = this.flinch * 0.20;

    this.mesh.position.set(pos.x, groundY + bob - this.flinch * 0.025, pos.z);
    const dx = targetPos.x - pos.x;
    const dz = targetPos.z - pos.z;
    if (dx * dx + dz * dz > 0.01) {
      this.mesh.rotation.y = Math.atan2(dx, dz);
    }
    this.mesh.rotation.x = stalkLean + recoil + step * 0.025 * stride;
    this.mesh.rotation.z = (step - counterStep * 0.35) * 0.045 * stride;
    this.mesh.scaling.set(
      1 + Math.abs(step) * 0.012 * stride,
      1 - Math.abs(step) * 0.018 * stride + this.flinch * 0.018,
      1 + stride * 0.020 + this.stress * 0.012,
    );
  }
}
